import os
import time
import uuid
import json
from typing import Dict, Any, Optional, List
from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel
import io

from backend.database import (
    init_db, get_policy_rules, update_policy_rule, get_policy_settings,
    update_policy_settings, reset_policy_to_defaults, create_audit_log,
    get_audit_logs, get_audit_stats, clear_audit_logs
)
from backend.detector import DetectionEngine
from backend.parser import (
    parse_and_scan_prompt, parse_and_scan_pdf, parse_and_scan_xlsx,
    parse_and_scan_csv, FileParseException, MAX_FILE_SIZE, ALLOWED_EXTENSIONS
)
from backend.sanitizer import Sanitizer

app = FastAPI(title="PromptShield AI API", version="1.0.0")

# Allow CORS for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize database on startup
@app.on_event("startup")
def startup_event():
    init_db()

# Temporary in-memory session cache with TTL to avoid storing raw sensitive data permanently.
# Working session data automatically expires after 30 minutes.
SESSIONS: Dict[str, Dict[str, Any]] = {}
SESSION_TTL_SECONDS = 1800

def cleanup_old_sessions():
    now = time.time()
    expired = [sid for sid, data in SESSIONS.items() if now - data.get("created_at", 0) > SESSION_TTL_SECONDS]
    for sid in expired:
        del SESSIONS[sid]

def get_engine() -> DetectionEngine:
    rules = get_policy_rules()
    settings = get_policy_settings()
    return DetectionEngine(rules, settings)

# Pydantic models
class PromptScanRequest(BaseModel):
    prompt: str

class AutoFixRequest(BaseModel):
    session_id: str

class ExportRequest(BaseModel):
    session_id: str
    export_format: str  # "txt", "csv", "xlsx"
    user_confirmed: bool

class SimulateSubmitRequest(BaseModel):
    session_id: str
    user_confirmed: bool

class RuleUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    severity: Optional[str] = None
    policy_action: Optional[str] = None
    enabled: Optional[bool] = None
    weight: Optional[int] = None
    config: Optional[Dict[str, Any]] = None

class SettingsUpdateRequest(BaseModel):
    allow_threshold: Optional[int] = None
    warn_threshold: Optional[int] = None
    block_threshold: Optional[int] = None
    strict_blocking_override: Optional[bool] = None

@app.get("/api/health")
def health_check():
    return {"status": "ok", "app": "PromptShield AI", "timestamp": time.time()}

@app.post("/api/scan/prompt")
def scan_prompt(payload: PromptScanRequest):
    cleanup_old_sessions()
    text = payload.prompt.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Prompt text cannot be empty.")

    engine = get_engine()
    result = parse_and_scan_prompt(text, engine)

    session_id = f"sess_{uuid.uuid4().hex}"
    SESSIONS[session_id] = {
        "created_at": time.time(),
        "source_type": "prompt",
        "safe_source_label": "Direct Prompt",
        "raw_text": text,
        "findings": result["findings"],
        "risk_score": result["risk_score"],
        "policy_decision": result["policy_decision"],
        "sanitized_data": None,
        "is_incomplete": False
    }

    # Save anonymized audit metadata ONLY
    audit_id = create_audit_log(
        source_type="prompt",
        safe_source_label="Direct Text Prompt",
        finding_counts=result["category_counts"],
        total_findings=result["total_findings"],
        risk_score=result["risk_score"],
        policy_decision=result["policy_decision"],
        action_taken="scanned",
        incomplete_scan=False,
        notes=result["decision_summary"]
    )

    return {
        "session_id": session_id,
        "audit_id": audit_id,
        "source_type": "prompt",
        "safe_source_label": "Direct Text Prompt",
        "raw_text": text,
        "findings": result["findings"],
        "total_findings": result["total_findings"],
        "category_counts": result["category_counts"],
        "risk_score": result["risk_score"],
        "policy_decision": result["policy_decision"],
        "decision_summary": result["decision_summary"],
        "blocking_reasons": result["blocking_reasons"],
        "score_breakdown": result["score_breakdown"],
        "formula_explanation": result["formula_explanation"],
        "coverage_notes": result["coverage_notes"],
        "unsupported_elements": result["unsupported_elements"],
        "is_incomplete": result["is_incomplete"]
    }

@app.post("/api/scan/file")
async def scan_file(file: UploadFile = File(...)):
    cleanup_old_sessions()
    filename = file.filename or "uploaded_file"
    ext = os.path.splitext(filename)[1].lower()

    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file extension '{ext}'. PromptShield supports PDF, XLSX, CSV, and TXT files."
        )

    file_bytes = await file.read()
    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"File exceeds maximum allowed size of {MAX_FILE_SIZE // (1024*1024)}MB."
        )

    engine = get_engine()

    try:
        if ext == ".pdf":
            result = parse_and_scan_pdf(file_bytes, filename, engine)
        elif ext == ".xlsx":
            result = parse_and_scan_xlsx(file_bytes, filename, engine)
        elif ext == ".csv":
            result = parse_and_scan_csv(file_bytes, filename, engine)
        elif ext == ".txt":
            try:
                txt_content = file_bytes.decode("utf-8")
            except UnicodeDecodeError:
                txt_content = file_bytes.decode("latin1")
            result = parse_and_scan_prompt(txt_content, engine)
            result["source_type"] = "txt"
            result["safe_source_label"] = f"Text File ({os.path.basename(filename)})"
        else:
            raise HTTPException(status_code=400, detail="Unsupported format.")
    except FileParseException as e:
        # Create an audit log for incomplete/unsupported scan
        create_audit_log(
            source_type=ext.replace(".", ""),
            safe_source_label=f"File ({ext})",
            finding_counts={},
            total_findings=0,
            risk_score=50,
            policy_decision="warn",
            action_taken="scan_failed",
            incomplete_scan=True,
            notes=str(e)
        )
        raise HTTPException(
            status_code=422,
            detail=f"File scanning warning: {str(e)}. File status: Incomplete scan / Unsupported."
        )

    session_id = f"sess_{uuid.uuid4().hex}"
    SESSIONS[session_id] = {
        "created_at": time.time(),
        "source_type": result["source_type"],
        "safe_source_label": result["safe_source_label"],
        "filename": filename,
        "file_bytes": file_bytes,
        "raw_text": result.get("raw_text", ""),
        "page_texts": result.get("page_texts"),
        "sheet_data": result.get("sheet_data"),
        "csv_rows": result.get("csv_rows"),
        "findings": result["findings"],
        "risk_score": result["risk_score"],
        "policy_decision": result["policy_decision"],
        "sanitized_data": None,
        "is_incomplete": result["is_incomplete"]
    }

    # Log to audit without sensitive filename or personal information
    audit_id = create_audit_log(
        source_type=result["source_type"],
        safe_source_label=result["safe_source_label"],
        finding_counts=result["category_counts"],
        total_findings=result["total_findings"],
        risk_score=result["risk_score"],
        policy_decision=result["policy_decision"],
        action_taken="scanned",
        incomplete_scan=result["is_incomplete"],
        notes=result["decision_summary"]
    )

    return {
        "session_id": session_id,
        "audit_id": audit_id,
        "source_type": result["source_type"],
        "safe_source_label": result["safe_source_label"],
        "filename": filename,
        "raw_text": result.get("raw_text", ""),
        "findings": result["findings"],
        "total_findings": result["total_findings"],
        "category_counts": result["category_counts"],
        "risk_score": result["risk_score"],
        "policy_decision": result["policy_decision"],
        "decision_summary": result["decision_summary"],
        "blocking_reasons": result["blocking_reasons"],
        "score_breakdown": result["score_breakdown"],
        "formula_explanation": result["formula_explanation"],
        "coverage_notes": result["coverage_notes"],
        "unsupported_elements": result["unsupported_elements"],
        "is_incomplete": result["is_incomplete"]
    }

@app.post("/api/autofix")
def autofix_session(payload: AutoFixRequest):
    cleanup_old_sessions()
    session = SESSIONS.get(payload.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session expired or not found. Please re-scan.")

    engine = get_engine()
    stype = session["source_type"]
    findings = session["findings"]

    if not findings:
        return {
            "session_id": payload.session_id,
            "message": "No sensitive findings require masking.",
            "original_content": session.get("raw_text", ""),
            "sanitized_content": session.get("raw_text", ""),
            "placeholder_map": {},
            "re_scan_policy_decision": "allow",
            "re_scan_risk_score": 0,
            "can_export": True
        }

    if stype in ["prompt", "txt"]:
        res = Sanitizer.sanitize_prompt(session["raw_text"], findings, engine)
        session["sanitized_data"] = res
    elif stype == "pdf":
        res = Sanitizer.sanitize_pdf_to_text(session["raw_text"], session.get("page_texts", []), findings, engine)
        session["sanitized_data"] = res
    elif stype == "csv":
        res = Sanitizer.sanitize_csv(session.get("csv_rows", []), findings, engine)
        session["sanitized_data"] = res
    elif stype == "xlsx":
        xlsx_bytes, res = Sanitizer.sanitize_xlsx_workbook(session["file_bytes"], findings, engine)
        res["sanitized_xlsx_bytes"] = xlsx_bytes
        session["sanitized_data"] = res
    else:
        raise HTTPException(status_code=400, detail="Unknown source type.")

    # Inviolable rule: "Auto-Fix must not automatically approve previously blocked content."
    # If the original scan was blocked, and the re-scan still has blocking violations or strict policy fails,
    # the user is warned and policy remains blocked.
    re_decision = res["re_scan_policy_decision"]
    re_score = res["re_scan_risk_score"]

    # Even after auto-fix, if any blocking findings remained unmasked or if re-scan detected new blocking violations:
    can_proceed = (re_decision in ["allow", "warn"]) and (re_score < engine.settings.get("block_threshold", 60))

    # Log action to audit
    create_audit_log(
        source_type=stype,
        safe_source_label=session["safe_source_label"],
        finding_counts=session.get("category_counts", {}),
        total_findings=len(findings),
        risk_score=re_score,
        policy_decision=re_decision,
        action_taken="auto_fixed",
        incomplete_scan=session.get("is_incomplete", False),
        notes=f"Auto-fixed {len(res['placeholder_map'])} distinct sensitive entities into numbered placeholders."
    )

    return {
        "session_id": payload.session_id,
        "original_content": res["original_content"],
        "sanitized_content": res["sanitized_content"],
        "placeholder_map": res["placeholder_map"],
        "re_scan_findings": res["re_scan_findings"],
        "re_scan_risk_score": re_score,
        "re_scan_policy_decision": re_decision,
        "re_scan_summary": res["re_scan_summary"],
        "can_proceed": can_proceed,
        "export_note": res.get("export_note")
    }

@app.post("/api/export")
def export_sanitized_content(payload: ExportRequest):
    cleanup_old_sessions()
    session = SESSIONS.get(payload.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session expired or not found. Please re-scan.")

    # BACKEND POLICY VALIDATION:
    # 1. Require explicit user confirmation
    if not payload.user_confirmed:
        raise HTTPException(status_code=403, detail="Policy violation: Explicit user confirmation is required before export.")

    # 2. Verify sanitized data exists
    sanitized = session.get("sanitized_data")
    if not sanitized and len(session["findings"]) > 0:
        raise HTTPException(status_code=403, detail="Policy violation: Unsanitized content with active findings cannot be exported.")

    # 3. Check re-scan policy decision: If blocked, export is denied!
    if sanitized:
        if sanitized.get("re_scan_policy_decision") == "block":
            raise HTTPException(
                status_code=403,
                detail="Policy violation: Content is BLOCKED by policy rules. Export disabled until blocking issue is resolved."
            )

    stype = session["source_type"]
    fmt = payload.export_format.lower()

    # Generate appropriate export
    if fmt == "xlsx" and stype == "xlsx" and sanitized and "sanitized_xlsx_bytes" in sanitized:
        create_audit_log(
            source_type=stype,
            safe_source_label=session["safe_source_label"],
            finding_counts={},
            total_findings=0,
            risk_score=sanitized.get("re_scan_risk_score", 0),
            policy_decision="allow",
            action_taken="exported_xlsx"
        )
        return StreamingResponse(
            io.BytesIO(sanitized["sanitized_xlsx_bytes"]),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": 'attachment; filename="sanitized_export.xlsx"'}
        )
    elif fmt == "csv":
        csv_data = sanitized["sanitized_content"] if sanitized else session.get("raw_text", "")
        create_audit_log(
            source_type=stype,
            safe_source_label=session["safe_source_label"],
            finding_counts={},
            total_findings=0,
            risk_score=sanitized.get("re_scan_risk_score", 0) if sanitized else 0,
            policy_decision="allow",
            action_taken="exported_csv"
        )
        return StreamingResponse(
            io.StringIO(csv_data),
            media_type="text/csv",
            headers={"Content-Disposition": 'attachment; filename="sanitized_export.csv"'}
        )
    else:
        # Default to txt
        txt_data = sanitized["sanitized_content"] if sanitized else session.get("raw_text", "")
        create_audit_log(
            source_type=stype,
            safe_source_label=session["safe_source_label"],
            finding_counts={},
            total_findings=0,
            risk_score=sanitized.get("re_scan_risk_score", 0) if sanitized else 0,
            policy_decision="allow",
            action_taken="exported_txt"
        )
        return StreamingResponse(
            io.StringIO(txt_data),
            media_type="text/plain; charset=utf-8",
            headers={"Content-Disposition": 'attachment; filename="sanitized_export.txt"'}
        )

@app.post("/api/simulate-submit")
def simulate_ai_submission(payload: SimulateSubmitRequest):
    cleanup_old_sessions()
    session = SESSIONS.get(payload.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session expired or not found. Please re-scan.")

    # BACKEND POLICY VALIDATION
    if not payload.user_confirmed:
        raise HTTPException(status_code=403, detail="Submission denied: User review confirmation required.")

    sanitized = session.get("sanitized_data")
    if not sanitized and len(session["findings"]) > 0:
        raise HTTPException(status_code=403, detail="Submission denied: Content must be sanitized before submission.")

    if sanitized and sanitized.get("re_scan_policy_decision") == "block":
        raise HTTPException(status_code=403, detail="Submission denied: Content contains blocking policy violations.")

    safe_payload = sanitized["sanitized_content"] if sanitized else session.get("raw_text", "")

    # Log to audit without sensitive payload
    create_audit_log(
        source_type=session["source_type"],
        safe_source_label=session["safe_source_label"],
        finding_counts={},
        total_findings=0,
        risk_score=sanitized.get("re_scan_risk_score", 0) if sanitized else session.get("risk_score", 0),
        policy_decision="allow",
        action_taken="simulated_submitted",
        notes="Simulated AI submission approved and executed with sanitized placeholders."
    )

    # Return simulated AI assistant response
    preview_snippet = safe_payload[:200] + "..." if len(safe_payload) > 200 else safe_payload
    return {
        "status": "success",
        "message": "Sanitized payload securely received by AI Gateway (Simulated).",
        "submitted_payload_snippet": preview_snippet,
        "masked_entities_count": len(sanitized["placeholder_map"]) if sanitized else 0,
        "simulated_ai_response": (
            "Hello! I received your sanitized inquiry. All sensitive identifiers were cleanly abstracted into safe placeholders. "
            "How can I assist you with analyzing this customer record or prompt?"
        ),
        "timestamp": time.time()
    }

@app.get("/api/policy")
def get_policy():
    rules = get_policy_rules()
    settings = get_policy_settings()
    return {
        "rules": rules,
        "settings": settings
    }

@app.put("/api/policy/rules/{rule_id}")
def update_rule(rule_id: str, updates: RuleUpdateRequest):
    update_data = updates.dict(exclude_unset=True)
    update_policy_rule(rule_id, update_data)
    return {"status": "success", "rule_id": rule_id, "updated": update_data}

@app.put("/api/policy/settings")
def update_settings(updates: SettingsUpdateRequest):
    update_data = updates.dict(exclude_unset=True)
    update_policy_settings(update_data)
    return {"status": "success", "settings": get_policy_settings()}

@app.post("/api/policy/reset")
def reset_policy():
    reset_policy_to_defaults()
    return {"status": "success", "message": "Policy rules and settings reset to defaults."}

@app.get("/api/audit")
def fetch_audit_logs(limit: int = Query(100, ge=1, le=500)):
    logs = get_audit_logs(limit)
    return {"logs": logs}

@app.get("/api/audit/stats")
def fetch_audit_stats():
    return get_audit_stats()

@app.delete("/api/audit")
def purge_audit_logs():
    clear_audit_logs()
    return {"status": "success", "message": "Audit logs cleared."}

@app.get("/api/demo/samples")
def get_demo_samples():
    return {
        "normal_prompt": {
            "title": "Normal Prompt (Allowed)",
            "description": "Standard coding and algorithmic question with no PII or sensitive data.",
            "text": "Can you explain how Dijkstra's shortest path algorithm works and provide a clean Python implementation with time complexity analysis?"
        },
        "sensitive_prompt": {
            "title": "Sensitive Prompt (Warns)",
            "description": "Customer support escalation with personal email, phone number, and customer account ID.",
            "text": "Support escalation: Customer Priya Sharma (email: priya.sharma@example.com, phone: +1-555-0199) requested an urgent renewal for account ACC-67890. Please draft an email to resolve this."
        },
        "confidential_prompt": {
            "title": "Confidential Prompt (Blocked)",
            "description": "Contains explicit confidential keywords, internal-only secrets, and a test API key.",
            "text": "INTERNAL ONLY & STRICTLY CONFIDENTIAL: Project Titan acquisition secret quotation is $4,850,000. Use production API key sk-live99482710492817491028 to query the confidential partner ledger."
        },
        "files": [
            {
                "name": "customers.xlsx",
                "label": "Synthetic Customer Database (Excel)",
                "description": "Contains Rahul (rahul@example.com, ACC-12345) and Priya (priya@example.com, ACC-67890) at Sheet1!B2, Sheet1!C2, Sheet1!B3, Sheet1!C3.",
                "download_url": "/api/demo/file/customers.xlsx"
            },
            {
                "name": "customers.csv",
                "label": "Synthetic Customer Data (CSV)",
                "description": "CSV format of customer records with rows and columns for email and account ID.",
                "download_url": "/api/demo/file/customers.csv"
            },
            {
                "name": "customer_escalations.pdf",
                "label": "Customer Escalations (PDF)",
                "description": "Text-based PDF report with page numbers and personal contacts.",
                "download_url": "/api/demo/file/customer_escalations.pdf"
            },
            {
                "name": "unsupported_binary.dat",
                "label": "Corrupted / Unsupported Binary File",
                "description": "Triggers DeepFile Guard explicit 'Incomplete scan / Unsupported' state rather than claiming safe.",
                "download_url": "/api/demo/file/unsupported_binary.dat"
            }
        ]
    }

@app.get("/api/demo/file/{filename}")
def download_demo_file(filename: str):
    base_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "demo_samples")
    file_path = os.path.join(base_dir, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Demo file not found.")

    with open(file_path, "rb") as f:
        content = f.read()

    media_type = "application/octet-stream"
    if filename.endswith(".xlsx"):
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    elif filename.endswith(".csv"):
        media_type = "text/csv"
    elif filename.endswith(".pdf"):
        media_type = "application/pdf"
    elif filename.endswith(".txt"):
        media_type = "text/plain"

    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )
