import re
from typing import List, Dict, Any, Tuple, Optional

# Category risk weights and severities
CATEGORY_METADATA = {
    "api_key": {
        "label": "API Key / Secret Token",
        "default_severity": "critical",
        "default_action": "block",
        "default_weight": 40,
        "explanation": "Rule match: Detected high-entropy secret, API key, or authorization token."
    },
    "confidential_keyword": {
        "label": "Confidential Keyword",
        "default_severity": "high",
        "default_action": "block",
        "default_weight": 35,
        "explanation": "Rule match: Document/prompt contains explicit internal-only or confidential phrase."
    },
    "account_id": {
        "label": "Account / Customer Identifier",
        "default_severity": "high",
        "default_action": "warn",
        "default_weight": 25,
        "explanation": "Rule match: Detected sensitive account or customer identifier (e.g. ACC-12345)."
    },
    "phone": {
        "label": "Phone Number",
        "default_severity": "medium",
        "default_action": "warn",
        "default_weight": 15,
        "explanation": "Rule match: Detected direct telephone / mobile contact number."
    },
    "email": {
        "label": "Email Address",
        "default_severity": "medium",
        "default_action": "warn",
        "default_weight": 15,
        "explanation": "Rule match: Detected personal or corporate email address."
    }
}

class DetectionEngine:
    def __init__(self, rules: List[Dict[str, Any]], settings: Dict[str, Any]):
        self.rules = rules
        self.settings = settings
        self.compiled_rules = self._compile_rules(rules)

    def _compile_rules(self, rules: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        compiled = []
        for r in rules:
            if not r.get("enabled", True):
                continue
            cat = r.get("category")
            cfg = r.get("config", {})
            rule_entry = {
                "id": r.get("id"),
                "name": r.get("name"),
                "category": cat,
                "severity": r.get("severity", "medium"),
                "policy_action": r.get("policy_action", "warn"),
                "weight": r.get("weight", 10),
                "regexes": []
            }

            if "pattern" in cfg and cfg["pattern"]:
                try:
                    rule_entry["regexes"].append(re.compile(cfg["pattern"], re.IGNORECASE))
                except re.error:
                    pass

            if "patterns" in cfg and isinstance(cfg["patterns"], list):
                for p in cfg["patterns"]:
                    try:
                        rule_entry["regexes"].append(re.compile(p, re.IGNORECASE))
                    except re.error:
                        pass

            if "keywords" in cfg and isinstance(cfg["keywords"], list):
                for kw in cfg["keywords"]:
                    if kw.strip():
                        # Word boundary match for phrase
                        escaped = re.escape(kw.strip())
                        pattern = rf"\b{escaped}\b"
                        try:
                            rule_entry["regexes"].append(re.compile(pattern, re.IGNORECASE))
                        except re.error:
                            pass

            compiled.append(rule_entry)
        return compiled

    def scan_text_segment(
        self,
        text: str,
        location_type: str,
        location_label: str,
        location_meta: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        findings = []
        if not text or not isinstance(text, str):
            return findings

        # Avoid executing formulas or treating formula syntax as standard text
        # (Preserves spreadsheet safety)
        is_formula = text.startswith(("=", "+", "-", "@")) and location_type == "xlsx"
        eval_text = text

        for rule in self.compiled_rules:
            cat = rule["category"]
            meta = CATEGORY_METADATA.get(cat, {})
            rule_expl = meta.get("explanation", f"Rule match: Detected {cat} pattern.")

            for regex in rule["regexes"]:
                for match in regex.finditer(eval_text):
                    val = match.group(0)
                    start, end = match.span()

                    # Filter out short false positives or isolated numbers for phone
                    if cat == "phone":
                        digits = re.sub(r"\D", "", val)
                        if len(digits) < 7 or len(digits) > 15:
                            continue

                    loc_meta_copy = dict(location_meta)
                    loc_meta_copy["start"] = start
                    loc_meta_copy["end"] = end

                    findings.append({
                        "id": f"finding_{len(findings)+1}_{cat}_{start}",
                        "rule_id": rule["id"],
                        "rule_name": rule["name"],
                        "category": cat,
                        "severity": rule["severity"],
                        "policy_action": rule["policy_action"],
                        "weight": rule["weight"],
                        "location": location_label,
                        "location_type": location_type,
                        "location_meta": loc_meta_copy,
                        "matched_value": val,
                        "explanation": f"{rule_expl} (Rule: {rule['name']})"
                    })

        # Deduplicate overlapping findings (prefer critical/high over medium/low)
        severity_rank = {"critical": 4, "high": 3, "medium": 2, "low": 1}
        deduped = []
        findings.sort(key=lambda f: (f["location_meta"].get("start", 0), -severity_rank.get(f["severity"], 1)))

        for f in findings:
            f_start = f["location_meta"].get("start", 0)
            f_end = f["location_meta"].get("end", 0)
            overlap = False
            for d in deduped:
                d_start = d["location_meta"].get("start", 0)
                d_end = d["location_meta"].get("end", 0)
                if d["location"] == f["location"] and max(f_start, d_start) < min(f_end, d_end):
                    overlap = True
                    break
            if not overlap:
                deduped.append(f)

        return deduped

    def evaluate_policy_and_score(
        self,
        findings: List[Dict[str, Any]],
        is_incomplete_scan: bool = False
    ) -> Dict[str, Any]:
        """
        Calculates heuristic risk score (0-100) and policy decision (Allow, Warn, Block).
        Crucial requirement: A low score must NEVER override a blocking policy rule.
        """
        category_counts: Dict[str, int] = {}
        blocking_reasons: List[str] = []
        score_breakdown: List[Dict[str, Any]] = []

        raw_score = 0
        severity_multipliers = {
            "low": 0.5,
            "medium": 1.0,
            "high": 1.4,
            "critical": 2.0
        }

        # Track unique findings by category
        by_category: Dict[str, List[Dict[str, Any]]] = {}
        for f in findings:
            cat = f["category"]
            category_counts[cat] = category_counts.get(cat, 0) + 1
            by_category.setdefault(cat, []).append(f)

            # Check for blocking rules
            if f.get("policy_action") == "block":
                f["is_blocking"] = True
                msg = f"Blocking rule '{f.get('rule_name')}' triggered by {cat} at {f.get('location')}."
                if msg not in blocking_reasons:
                    blocking_reasons.append(msg)
            else:
                f["is_blocking"] = False

        # Calculate score with diminishing returns for repeated matches
        for cat, items in by_category.items():
            base_weight = items[0].get("weight", 15)
            sev = items[0].get("severity", "medium")
            mult = severity_multipliers.get(sev, 1.0)

            # 1st item: full weight * mult
            # subsequent items: +25% weight each
            count = len(items)
            cat_points = round((base_weight * mult) + ((count - 1) * (base_weight * 0.25)))
            raw_score += cat_points
            score_breakdown.append({
                "category": cat,
                "count": count,
                "base_weight": base_weight,
                "severity": sev,
                "multiplier": mult,
                "points_added": cat_points
            })

        risk_score = min(100, max(0, raw_score))

        # Check policy thresholds
        allow_threshold = self.settings.get("allow_threshold", 10)
        warn_threshold = self.settings.get("warn_threshold", 11)
        block_threshold = self.settings.get("block_threshold", 60)
        strict_override = self.settings.get("strict_blocking_override", True)

        # Policy decision logic:
        # 1. If any blocking rule is triggered, decision is ALWAYS Block (score cannot override)
        # 2. Else if risk_score >= block_threshold: Block
        # 3. Else if risk_score >= warn_threshold or len(findings) > 0: Warn
        # 4. Else: Allow
        if blocking_reasons and strict_override:
            decision = "block"
            decision_summary = f"Blocked by policy rule: {len(blocking_reasons)} blocking violation(s) detected. A low score cannot override blocking rules."
        elif risk_score >= block_threshold:
            decision = "block"
            decision_summary = f"Blocked by risk threshold: Combined risk score of {risk_score} exceeds block limit ({block_threshold})."
        elif len(findings) > 0 or risk_score >= warn_threshold:
            decision = "warn"
            decision_summary = f"Warning: {len(findings)} sensitive item(s) found. User review and smart auto-fix masking required before export."
        else:
            decision = "allow"
            decision_summary = "Allowed: No sensitive items detected. Content satisfies active policy rules."

        if is_incomplete_scan:
            decision = "warn" if decision == "allow" else decision
            decision_summary += " (Notice: Scan coverage was incomplete due to unparsed or binary content)."

        # Explanation string for human transparency
        breakdown_str = ", ".join(f"{b['category']}: +{b['points_added']}pts" for b in score_breakdown) if score_breakdown else "0 findings: 0pts"
        formula_explanation = (
            f"Risk Score: {risk_score}/100. Calculated as sum of category weights ({breakdown_str}). "
            f"Thresholds: 0-{allow_threshold} Allow, {warn_threshold}-{block_threshold-1} Warn, >={block_threshold} Block. "
            f"Blocking rule override: {'ACTIVE' if strict_override else 'OFF'}."
        )

        return {
            "risk_score": risk_score,
            "policy_decision": decision,
            "decision_summary": decision_summary,
            "blocking_reasons": blocking_reasons,
            "score_breakdown": score_breakdown,
            "formula_explanation": formula_explanation,
            "category_counts": category_counts,
            "total_findings": len(findings)
        }
