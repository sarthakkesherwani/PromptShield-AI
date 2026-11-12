import io
import csv
from typing import Dict, Any, List, Tuple
import openpyxl
from backend.detector import DetectionEngine

PLACEHOLDER_PREFIXES = {
    "email": "EMAIL",
    "phone": "PHONE",
    "account_id": "ACCOUNT",
    "api_key": "API_KEY",
    "confidential_keyword": "CONFIDENTIAL",
    "custom_regex": "REDACTED"
}

class Sanitizer:
    @staticmethod
    def generate_placeholder_map(findings: List[Dict[str, Any]]) -> Dict[str, str]:
        """
        Creates consistent numbered placeholders:
        [EMAIL_1], [PHONE_1], [ACCOUNT_1], [API_KEY_1]...
        Uses the SAME placeholder for repeated occurrences of the same value within a scan.
        """
        category_counters: Dict[str, int] = {}
        value_to_placeholder: Dict[str, str] = {}

        for f in findings:
            cat = f.get("category", "custom_regex")
            val = f.get("matched_value", "")
            if not val:
                continue

            if val not in value_to_placeholder:
                prefix = PLACEHOLDER_PREFIXES.get(cat, "REDACTED")
                category_counters[prefix] = category_counters.get(prefix, 0) + 1
                placeholder = f"[{prefix}_{category_counters[prefix]}]"
                value_to_placeholder[val] = placeholder

            f["placeholder"] = value_to_placeholder[val]

        return value_to_placeholder

    @staticmethod
    def sanitize_text(text: str, value_to_placeholder: Dict[str, str]) -> str:
        if not text:
            return text
        sanitized = text
        # Replace longer strings first to avoid substring clipping
        sorted_pairs = sorted(value_to_placeholder.items(), key=lambda x: len(x[0]), reverse=True)
        for orig, placeholder in sorted_pairs:
            sanitized = sanitized.replace(orig, placeholder)
        return sanitized

    @classmethod
    def sanitize_prompt(
        cls,
        prompt_text: str,
        findings: List[Dict[str, Any]],
        engine: DetectionEngine
    ) -> Dict[str, Any]:
        placeholder_map = cls.generate_placeholder_map(findings)
        sanitized_text = cls.sanitize_text(prompt_text, placeholder_map)

        # Re-scan sanitized content
        re_scan_findings = engine.scan_text_segment(
            sanitized_text,
            location_type="prompt",
            location_label="Sanitized Prompt",
            location_meta={"start": 0, "end": len(sanitized_text)}
        )
        re_scan_eval = engine.evaluate_policy_and_score(re_scan_findings, is_incomplete_scan=False)

        # Highlight diff blocks
        diff_highlights = []
        for orig, ph in placeholder_map.items():
            diff_highlights.append({
                "original": orig,
                "replacement": ph
            })

        return {
            "original_content": prompt_text,
            "sanitized_content": sanitized_text,
            "placeholder_map": placeholder_map,
            "diff_highlights": diff_highlights,
            "re_scan_findings": re_scan_findings,
            "re_scan_risk_score": re_scan_eval["risk_score"],
            "re_scan_policy_decision": re_scan_eval["policy_decision"],
            "re_scan_summary": re_scan_eval["decision_summary"]
        }

    @classmethod
    def sanitize_pdf_to_text(
        cls,
        raw_text: str,
        page_texts: List[Dict[str, Any]],
        findings: List[Dict[str, Any]],
        engine: DetectionEngine
    ) -> Dict[str, Any]:
        placeholder_map = cls.generate_placeholder_map(findings)
        sanitized_pages = []
        for p in page_texts:
            sanitized_p_text = cls.sanitize_text(p["text"], placeholder_map)
            sanitized_pages.append({
                "page": p["page"],
                "text": sanitized_p_text
            })

        combined_sanitized = "\n\n--- Page Break ---\n\n".join(
            f"[Page {p['page']}]\n{p['text']}" for p in sanitized_pages
        )

        re_scan_findings = engine.scan_text_segment(
            combined_sanitized,
            location_type="pdf",
            location_label="Sanitized PDF Text",
            location_meta={}
        )
        re_scan_eval = engine.evaluate_policy_and_score(re_scan_findings, is_incomplete_scan=False)

        return {
            "original_content": raw_text,
            "sanitized_content": combined_sanitized,
            "placeholder_map": placeholder_map,
            "re_scan_findings": re_scan_findings,
            "re_scan_risk_score": re_scan_eval["risk_score"],
            "re_scan_policy_decision": re_scan_eval["policy_decision"],
            "re_scan_summary": re_scan_eval["decision_summary"],
            "export_note": "Export provides sanitized text extraction. Does not claim to produce redacted binary PDF."
        }

    @classmethod
    def sanitize_csv(
        cls,
        csv_rows: List[List[str]],
        findings: List[Dict[str, Any]],
        engine: DetectionEngine
    ) -> Dict[str, Any]:
        placeholder_map = cls.generate_placeholder_map(findings)
        sanitized_rows = []
        for row in csv_rows:
            sanitized_row = [cls.sanitize_text(c, placeholder_map) for c in row]
            sanitized_rows.append(sanitized_row)

        out = io.StringIO()
        writer = csv.writer(out)
        writer.writerows(sanitized_rows)
        sanitized_csv_text = out.getvalue()

        # Re-scan sanitized csv text
        re_scan_findings = engine.scan_text_segment(
            sanitized_csv_text,
            location_type="csv",
            location_label="Sanitized CSV",
            location_meta={}
        )
        re_scan_eval = engine.evaluate_policy_and_score(re_scan_findings, is_incomplete_scan=False)

        # Original csv text for diff
        orig_out = io.StringIO()
        orig_writer = csv.writer(orig_out)
        orig_writer.writerows(csv_rows)
        orig_csv_text = orig_out.getvalue()

        return {
            "original_content": orig_csv_text,
            "sanitized_content": sanitized_csv_text,
            "sanitized_rows": sanitized_rows,
            "placeholder_map": placeholder_map,
            "re_scan_findings": re_scan_findings,
            "re_scan_risk_score": re_scan_eval["risk_score"],
            "re_scan_policy_decision": re_scan_eval["policy_decision"],
            "re_scan_summary": re_scan_eval["decision_summary"]
        }

    @classmethod
    def sanitize_xlsx_workbook(
        cls,
        file_bytes: bytes,
        findings: List[Dict[str, Any]],
        engine: DetectionEngine
    ) -> Tuple[bytes, Dict[str, Any]]:
        placeholder_map = cls.generate_placeholder_map(findings)
        wb = openpyxl.load_workbook(io.BytesIO(file_bytes), data_only=False)

        all_sanitized_text = []
        all_original_text = []

        for sheet_name in wb.sheetnames:
            sheet = wb[sheet_name]
            all_sanitized_text.append(f"[{sheet_name}]")
            all_original_text.append(f"[{sheet_name}]")

            for row in sheet.iter_rows():
                orig_row_strs = []
                san_row_strs = []
                for cell in row:
                    val = cell.value
                    if val is not None:
                        val_str = str(val)
                        orig_row_strs.append(val_str)
                        # Avoid tampering with formula syntax if it starts with =
                        if not val_str.startswith(("=", "+", "-", "@")):
                            new_val = cls.sanitize_text(val_str, placeholder_map)
                            cell.value = new_val
                            san_row_strs.append(new_val)
                        else:
                            san_row_strs.append(val_str)
                    else:
                        orig_row_strs.append("")
                        san_row_strs.append("")
                all_original_text.append("\t".join(orig_row_strs))
                all_sanitized_text.append("\t".join(san_row_strs))

        out_buffer = io.BytesIO()
        wb.save(out_buffer)
        sanitized_xlsx_bytes = out_buffer.getvalue()

        combined_sanitized_text = "\n".join(all_sanitized_text)
        re_scan_findings = engine.scan_text_segment(
            combined_sanitized_text,
            location_type="xlsx",
            location_label="Sanitized XLSX Text",
            location_meta={}
        )
        re_scan_eval = engine.evaluate_policy_and_score(re_scan_findings, is_incomplete_scan=False)

        meta = {
            "original_content": "\n".join(all_original_text),
            "sanitized_content": combined_sanitized_text,
            "placeholder_map": placeholder_map,
            "re_scan_findings": re_scan_findings,
            "re_scan_risk_score": re_scan_eval["risk_score"],
            "re_scan_policy_decision": re_scan_eval["policy_decision"],
            "re_scan_summary": re_scan_eval["decision_summary"]
        }

        return sanitized_xlsx_bytes, meta
