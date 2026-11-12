import sqlite3
import json
import os
import uuid
from datetime import datetime
from typing import Dict, Any, List, Optional

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "promptshield.db")

DEFAULT_POLICY_RULES = [
    {
        "id": "rule_email",
        "name": "Email Address Detection",
        "category": "email",
        "description": "Flags personal and corporate email addresses found in prompt text or files.",
        "severity": "medium",
        "policy_action": "warn",
        "enabled": 1,
        "weight": 15,
        "config_json": json.dumps({"pattern": r"\b[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+\b"})
    },
    {
        "id": "rule_phone",
        "name": "Phone Number Detection",
        "category": "phone",
        "description": "Flags national and international phone numbers and mobile digits.",
        "severity": "medium",
        "policy_action": "warn",
        "enabled": 1,
        "weight": 15,
        "config_json": json.dumps({"pattern": r"(\+?\d{1,3}[-.\s]?)?(\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}\b"})
    },
    {
        "id": "rule_account_id",
        "name": "Customer / Account ID Pattern",
        "category": "account_id",
        "description": "Flags customer account identifiers (e.g. ACC-12345, ACCT-9999).",
        "severity": "high",
        "policy_action": "warn",
        "enabled": 1,
        "weight": 25,
        "config_json": json.dumps({"pattern": r"\b(ACC-\d{5}|ACCT-[A-Z0-9-]{4,10}|CUST-\d{5,8})\b"})
    },
    {
        "id": "rule_api_key",
        "name": "API Keys & Secrets",
        "category": "api_key",
        "description": "Blocks AI prompts or files containing API keys, OAuth tokens, and secrets.",
        "severity": "critical",
        "policy_action": "block",
        "enabled": 1,
        "weight": 40,
        "config_json": json.dumps({
            "patterns": [
                r"\b(sk-[a-zA-Z0-9]{20,})\b",
                r"\b(AKIA[0-9A-Z]{16})\b",
                r"\b(ghp_[a-zA-Z0-9]{36})\b",
                r"\b(AIza[0-9A-Za-z-_]{35})\b",
                r"\bBearer\s+[a-zA-Z0-9_\-\.]{25,}\b",
                r"\bxox[baprs]-[0-9a-zA-Z]{10,}\b"
            ]
        })
    },
    {
        "id": "rule_confidential_keywords",
        "name": "Confidential & Restrictive Keywords",
        "category": "confidential_keyword",
        "description": "Blocks or warns on sensitive company terms such as 'confidential', 'internal only', 'secret quotation'.",
        "severity": "high",
        "policy_action": "block",
        "enabled": 1,
        "weight": 35,
        "config_json": json.dumps({
            "keywords": [
                "confidential",
                "internal only",
                "secret quotation",
                "strictly confidential",
                "proprietary information",
                "do not distribute",
                "restricted distribution",
                "nda protected"
            ]
        })
    }
]

DEFAULT_SETTINGS = {
    "allow_threshold": 10,
    "warn_threshold": 11,
    "block_threshold": 60,
    "strict_blocking_override": True,
    "explain_scoring": True
}

def get_connection():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_connection()
    cursor = conn.cursor()

    # Policy rules table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS policy_rules (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        description TEXT NOT NULL,
        severity TEXT NOT NULL,
        policy_action TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1,
        weight INTEGER NOT NULL DEFAULT 10,
        config_json TEXT NOT NULL
    )
    """)

    # Policy settings table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS policy_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
    )
    """)

    # Audit logs table
    # CRITICAL: Do NOT store raw prompts, sensitive content, personal filenames, or placeholder mappings.
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL,
        source_type TEXT NOT NULL,
        safe_source_label TEXT NOT NULL,
        finding_counts_json TEXT NOT NULL,
        total_findings INTEGER NOT NULL,
        risk_score INTEGER NOT NULL,
        policy_decision TEXT NOT NULL,
        action_taken TEXT NOT NULL,
        incomplete_scan INTEGER NOT NULL DEFAULT 0,
        notes TEXT
    )
    """)

    # Seed default rules if empty
    cursor.execute("SELECT COUNT(*) FROM policy_rules")
    if cursor.fetchone()[0] == 0:
        for rule in DEFAULT_POLICY_RULES:
            cursor.execute("""
            INSERT INTO policy_rules (id, name, category, description, severity, policy_action, enabled, weight, config_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                rule["id"], rule["name"], rule["category"], rule["description"],
                rule["severity"], rule["policy_action"], rule["enabled"], rule["weight"], rule["config_json"]
            ))

    # Seed default settings if empty
    for key, val in DEFAULT_SETTINGS.items():
        cursor.execute("SELECT value FROM policy_settings WHERE key = ?", (key,))
        if not cursor.fetchone():
            cursor.execute("INSERT INTO policy_settings (key, value) VALUES (?, ?)", (key, json.dumps(val)))

    conn.commit()
    conn.close()

def get_policy_rules() -> List[Dict[str, Any]]:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM policy_rules ORDER BY weight DESC")
    rows = cursor.fetchall()
    rules = []
    for r in rows:
        rules.append({
            "id": r["id"],
            "name": r["name"],
            "category": r["category"],
            "description": r["description"],
            "severity": r["severity"],
            "policy_action": r["policy_action"],
            "enabled": bool(r["enabled"]),
            "weight": r["weight"],
            "config": json.loads(r["config_json"])
        })
    conn.close()
    return rules

def update_policy_rule(rule_id: str, updates: Dict[str, Any]):
    conn = get_connection()
    cursor = conn.cursor()
    fields = []
    params = []
    for field in ["name", "description", "severity", "policy_action", "enabled", "weight"]:
        if field in updates:
            fields.append(f"{field} = ?")
            params.append(int(updates[field]) if field == "enabled" else updates[field])
    if "config" in updates:
        fields.append("config_json = ?")
        params.append(json.dumps(updates["config"]))
    
    if fields:
        params.append(rule_id)
        query = f"UPDATE policy_rules SET {', '.join(fields)} WHERE id = ?"
        cursor.execute(query, params)
        conn.commit()
    conn.close()

def get_policy_settings() -> Dict[str, Any]:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT key, value FROM policy_settings")
    rows = cursor.fetchall()
    settings = {}
    for r in rows:
        settings[r["key"]] = json.loads(r["value"])
    conn.close()
    return settings

def update_policy_settings(settings: Dict[str, Any]):
    conn = get_connection()
    cursor = conn.cursor()
    for key, val in settings.items():
        cursor.execute("""
        INSERT INTO policy_settings (key, value) VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
        """, (key, json.dumps(val)))
    conn.commit()
    conn.close()

def reset_policy_to_defaults():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM policy_rules")
    for rule in DEFAULT_POLICY_RULES:
        cursor.execute("""
        INSERT INTO policy_rules (id, name, category, description, severity, policy_action, enabled, weight, config_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            rule["id"], rule["name"], rule["category"], rule["description"],
            rule["severity"], rule["policy_action"], rule["enabled"], rule["weight"], rule["config_json"]
        ))
    for key, val in DEFAULT_SETTINGS.items():
        cursor.execute("""
        INSERT INTO policy_settings (key, value) VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
        """, (key, json.dumps(val)))
    conn.commit()
    conn.close()

def create_audit_log(
    source_type: str,
    safe_source_label: str,
    finding_counts: Dict[str, int],
    total_findings: int,
    risk_score: int,
    policy_decision: str,
    action_taken: str,
    incomplete_scan: bool = False,
    notes: Optional[str] = None
) -> str:
    log_id = f"audit_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}_{uuid.uuid4().hex[:6]}"
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
    INSERT INTO audit_logs (
        id, timestamp, source_type, safe_source_label, finding_counts_json,
        total_findings, risk_score, policy_decision, action_taken, incomplete_scan, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        log_id,
        datetime.utcnow().isoformat() + "Z",
        source_type,
        safe_source_label,
        json.dumps(finding_counts),
        total_findings,
        risk_score,
        policy_decision,
        action_taken,
        1 if incomplete_scan else 0,
        notes
    ))
    conn.commit()
    conn.close()
    return log_id

def get_audit_logs(limit: int = 100) -> List[Dict[str, Any]]:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT ?", (limit,))
    rows = cursor.fetchall()
    logs = []
    for r in rows:
        logs.append({
            "id": r["id"],
            "timestamp": r["timestamp"],
            "source_type": r["source_type"],
            "safe_source_label": r["safe_source_label"],
            "finding_counts": json.loads(r["finding_counts_json"]),
            "total_findings": r["total_findings"],
            "risk_score": r["risk_score"],
            "policy_decision": r["policy_decision"],
            "action_taken": r["action_taken"],
            "incomplete_scan": bool(r["incomplete_scan"]),
            "notes": r["notes"]
        })
    conn.close()
    return logs

def get_audit_stats() -> Dict[str, Any]:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*), AVG(risk_score) FROM audit_logs")
    total_scans, avg_score = cursor.fetchone()
    
    cursor.execute("SELECT policy_decision, COUNT(*) FROM audit_logs GROUP BY policy_decision")
    decision_counts = {r[0]: r[1] for r in cursor.fetchall()}

    cursor.execute("SELECT source_type, COUNT(*) FROM audit_logs GROUP BY source_type")
    source_counts = {r[0]: r[1] for r in cursor.fetchall()}

    cursor.execute("SELECT action_taken, COUNT(*) FROM audit_logs GROUP BY action_taken")
    action_counts = {r[0]: r[1] for r in cursor.fetchall()}

    conn.close()
    return {
        "total_scans": total_scans or 0,
        "avg_risk_score": round(avg_score, 1) if avg_score else 0,
        "decisions": {
            "allow": decision_counts.get("allow", 0),
            "warn": decision_counts.get("warn", 0),
            "block": decision_counts.get("block", 0)
        },
        "sources": source_counts,
        "actions": action_counts
    }

def clear_audit_logs():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM audit_logs")
    conn.commit()
    conn.close()

# Auto-initialize on import
init_db()

