import os
import io
import csv
from typing import Dict, Any, List, Tuple, Optional
import pymupdf  # PyMuPDF
import openpyxl
from backend.detector import DetectionEngine

MAX_FILE_SIZE = 15 * 1024 * 1024  # 15 MB limit
ALLOWED_EXTENSIONS = {".pdf", ".xlsx", ".csv", ".txt"}

class FileParseException(Exception):
    def __init__(self, message: str, is_unsupported: bool = False, is_incomplete: bool = False):
        super().__init__(message)
        self.message = message
        self.is_unsupported = is_unsupported
        self.is_incomplete = is_incomplete

def parse_and_scan_prompt(
    prompt_text: str,
    engine: DetectionEngine
) -> Dict[str, Any]:
    lines = prompt_text.splitlines(keepends=True)
    findings = []
    
    # Global character offset scan
    prompt_findings = engine.scan_text_segment(
        prompt_text,
        location_type="prompt",
        location_label=f"Prompt (Chars 0-{len(prompt_text)})",
        location_meta={"start": 0, "end": len(prompt_text)}
    )
    
    # Calculate exact character offset labels and line numbers for readability
    for f in prompt_findings:
        start = f["location_meta"]["start"]
        end = f["location_meta"]["end"]
        # Determine line number
        prefix = prompt_text[:start]
        line_num = prefix.count("\n") + 1
        col_num = start - prefix.rfind("\n") if "\n" in prefix else start + 1
        f["location"] = f"Line {line_num}, Col {col_num} (Chars {start}–{end})"
        f["location_meta"]["line"] = line_num
        f["location_meta"]["col"] = col_num
        findings.append(f)

    policy_eval = engine.evaluate_policy_and_score(findings, is_incomplete_scan=False)
    
    return {
        "source_type": "prompt",
        "safe_source_label": "Text Prompt",
        "raw_text": prompt_text,
        "findings": findings,
        "is_incomplete": False,
        "coverage_notes": "100% prompt text coverage inspected via rule engine.",
        "unsupported_elements": [],
        **policy_eval
    }

def parse_and_scan_pdf(
    file_bytes: bytes,
    filename: str,
    engine: DetectionEngine
) -> Dict[str, Any]:
    findings = []
    page_texts = []
    unsupported_elements = []
    is_incomplete = False
    coverage_notes = []

    try:
        doc = pymupdf.open(stream=file_bytes, filetype="pdf")
    except Exception as e:
        raise FileParseException(f"Corrupted or invalid PDF format: {str(e)}", is_unsupported=True)

    if doc.is_encrypted:
        doc.close()
        raise FileParseException("Encrypted or password-protected PDF cannot be scanned safely.", is_unsupported=True, is_incomplete=True)

    total_pages = len(doc)
    if total_pages == 0:
        doc.close()
        raise FileParseException("PDF has 0 pages.", is_unsupported=True)

    total_extracted_chars = 0
    image_only_pages = []

    for page_idx in range(total_pages):
        page = doc[page_idx]
        page_num = page_idx + 1
        text = page.get_text("text") or ""
        page_texts.append({"page": page_num, "text": text})
        total_extracted_chars += len(text.strip())

        # Check for images on page
        images = page.get_images()
        if len(text.strip()) == 0 and len(images) > 0:
            image_only_pages.append(page_num)

        if text.strip():
            page_findings = engine.scan_text_segment(
                text,
                location_type="pdf",
                location_label=f"Page {page_num}",
                location_meta={"page": page_num}
            )
            findings.extend(page_findings)

    doc.close()

    if image_only_pages:
        is_incomplete = True
        msg = f"Page(s) {', '.join(map(str, image_only_pages))} contain embedded images without selectable text. Optical character recognition (OCR) was not run."
        unsupported_elements.append(msg)
        coverage_notes.append(msg)

    if total_extracted_chars == 0 and total_pages > 0:
        is_incomplete = True
        msg = "Image-only or scanned PDF detected. No extractable text stream found. Cannot verify document as safe."
        unsupported_elements.append(msg)
        coverage_notes.append(msg)
    else:
        coverage_notes.append(f"Scanned {total_pages} page(s), {total_extracted_chars} text characters extracted.")

    policy_eval = engine.evaluate_policy_and_score(findings, is_incomplete_scan=is_incomplete)

    safe_name = os.path.basename(filename)
    safe_label = f"PDF Document ({safe_name})"

    # Combine text for preview
    combined_text = "\n\n--- Page Break ---\n\n".join(
        f"[Page {p['page']}]\n{p['text']}" for p in page_texts
    )

    return {
        "source_type": "pdf",
        "safe_source_label": safe_label,
        "filename": safe_name,
        "raw_text": combined_text,
        "page_texts": page_texts,
        "total_pages": total_pages,
        "findings": findings,
        "is_incomplete": is_incomplete,
        "coverage_notes": " | ".join(coverage_notes),
        "unsupported_elements": unsupported_elements,
        **policy_eval
    }

def parse_and_scan_xlsx(
    file_bytes: bytes,
    filename: str,
    engine: DetectionEngine
) -> Dict[str, Any]:
    findings = []
    unsupported_elements = []
    is_incomplete = False
    coverage_notes = []

    try:
        wb = openpyxl.load_workbook(io.BytesIO(file_bytes), data_only=False)
    except Exception as e:
        raise FileParseException(f"Unable to parse Excel workbook: {str(e)}", is_unsupported=True)

    sheet_data = {}
    total_cells_checked = 0
    formula_cells_count = 0

    for sheet_name in wb.sheetnames:
        sheet = wb[sheet_name]
        sheet_rows = []

        # Check for drawing/shapes
        if hasattr(sheet, "_images") and len(sheet._images) > 0:
            is_incomplete = True
            msg = f"Sheet '{sheet_name}' contains {len(sheet._images)} embedded image(s)/drawing(s) that cannot be inspected for sensitive data."
            unsupported_elements.append(msg)

        for row_idx, row in enumerate(sheet.iter_rows(values_only=False), start=1):
            row_vals = []
            for col_idx, cell in enumerate(row, start=1):
                val = cell.value
                cell_coord = cell.coordinate  # e.g. "B2"
                loc_label = f"{sheet_name}!{cell_coord}"

                str_val = ""
                if val is not None:
                    str_val = str(val)

                # Never execute spreadsheet formulas
                if str_val.startswith(("=", "+", "-", "@")):
                    formula_cells_count += 1
                    # We inspect formula string content without executing
                    
                row_vals.append({
                    "coordinate": cell_coord,
                    "value": str_val,
                    "row": row_idx,
                    "col": col_idx
                })

                if str_val.strip():
                    total_cells_checked += 1
                    cell_findings = engine.scan_text_segment(
                        str_val,
                        location_type="xlsx",
                        location_label=loc_label,
                        location_meta={
                            "sheet": sheet_name,
                            "cell": cell_coord,
                            "row": row_idx,
                            "col": col_idx
                        }
                    )
                    findings.extend(cell_findings)

            sheet_rows.append(row_vals)
        sheet_data[sheet_name] = sheet_rows

    if formula_cells_count > 0:
        coverage_notes.append(f"{formula_cells_count} formula cells inspected safely without execution.")

    coverage_notes.append(f"Scanned {len(wb.sheetnames)} sheet(s) across {total_cells_checked} non-empty text cells.")

    policy_eval = engine.evaluate_policy_and_score(findings, is_incomplete_scan=is_incomplete)

    # Build tab-separated plain text preview for before/after comparison
    preview_lines = []
    for sheet_name, rows in sheet_data.items():
        preview_lines.append(f"[{sheet_name}]")
        for r in rows[:100]:  # limit preview
            preview_lines.append("\t".join(c["value"] for c in r))
    raw_preview = "\n".join(preview_lines)

    safe_name = os.path.basename(filename)
    return {
        "source_type": "xlsx",
        "safe_source_label": f"Excel Workbook ({safe_name})",
        "filename": safe_name,
        "raw_text": raw_preview,
        "sheet_data": sheet_data,
        "findings": findings,
        "is_incomplete": is_incomplete,
        "coverage_notes": " | ".join(coverage_notes),
        "unsupported_elements": unsupported_elements,
        **policy_eval
    }

def parse_and_scan_csv(
    file_bytes: bytes,
    filename: str,
    engine: DetectionEngine
) -> Dict[str, Any]:
    findings = []
    unsupported_elements = []
    coverage_notes = []

    try:
        # Decode UTF-8 or latin1 fallback
        try:
            content = file_bytes.decode("utf-8")
        except UnicodeDecodeError:
            content = file_bytes.decode("latin1")
    except Exception as e:
        raise FileParseException(f"Unable to read CSV text encoding: {str(e)}", is_unsupported=True)

    reader = csv.reader(io.StringIO(content))
    rows = []
    header = []
    total_cells = 0

    for row_idx, row in enumerate(reader, start=1):
        rows.append(row)
        if row_idx == 1 and row:
            header = row
        for col_idx, cell_val in enumerate(row, start=1):
            if cell_val.strip():
                total_cells += 1
                col_name = header[col_idx - 1] if col_idx <= len(header) and row_idx > 1 else f"Col {col_idx}"
                loc_label = f"Row {row_idx}, {col_name}"
                cell_findings = engine.scan_text_segment(
                    cell_val,
                    location_type="csv",
                    location_label=loc_label,
                    location_meta={
                        "row": row_idx,
                        "col": col_idx,
                        "col_name": col_name
                    }
                )
                findings.extend(cell_findings)

    coverage_notes.append(f"Scanned {len(rows)} row(s), {total_cells} populated cells.")
    policy_eval = engine.evaluate_policy_and_score(findings, is_incomplete_scan=False)

    safe_name = os.path.basename(filename)
    return {
        "source_type": "csv",
        "safe_source_label": f"CSV File ({safe_name})",
        "filename": safe_name,
        "raw_text": content,
        "csv_rows": rows,
        "findings": findings,
        "is_incomplete": False,
        "coverage_notes": " | ".join(coverage_notes),
        "unsupported_elements": unsupported_elements,
        **policy_eval
    }
