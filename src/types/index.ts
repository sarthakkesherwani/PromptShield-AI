export interface Finding {
  id: string;
  rule_id: string;
  rule_name: string;
  category: 'email' | 'phone' | 'account_id' | 'gov_id' | 'credit_card' | 'api_key' | 'confidential_keyword' | 'custom_regex';
  severity: 'low' | 'medium' | 'high' | 'critical';
  policy_action: 'warn' | 'block';
  weight: number;
  location: string;
  location_type: 'prompt' | 'pdf' | 'docx' | 'xlsx' | 'csv' | 'json' | 'txt';
  location_meta: Record<string, any>;
  matched_value: string;
  placeholder?: string;
  explanation: string;
  is_blocking?: boolean;
}

export type PolicyDecision = 'allow' | 'warn' | 'block';

export interface ScoreBreakdownItem {
  category: string;
  count: number;
  base_weight: number;
  severity: string;
  multiplier: number;
  points_added: number;
}

export interface ScanResult {
  session_id: string;
  audit_id: string;
  source_type: 'prompt' | 'pdf' | 'docx' | 'xlsx' | 'csv' | 'json' | 'txt';
  safe_source_label: string;
  filename?: string;
  raw_text?: string;
  findings: Finding[];
  total_findings: number;
  category_counts: Record<string, number>;
  risk_score: number;
  policy_decision: PolicyDecision;
  decision_summary: string;
  blocking_reasons: string[];
  score_breakdown: ScoreBreakdownItem[];
  formula_explanation: string;
  coverage_notes: string;
  unsupported_elements: string[];
  is_incomplete: boolean;
}

export interface AutoFixResult {
  session_id: string;
  original_content: string;
  sanitized_content: string;
  placeholder_map: Record<string, string>;
  re_scan_findings: Finding[];
  re_scan_risk_score: number;
  re_scan_policy_decision: PolicyDecision;
  re_scan_summary: string;
  can_proceed: boolean;
  export_note?: string;
}

export interface AuditRecord {
  id: string;
  timestamp: string;
  source_type: string;
  safe_source_label: string;
  finding_counts: Record<string, number>;
  total_findings: number;
  risk_score: number;
  policy_decision: PolicyDecision;
  action_taken: string;
  incomplete_scan: boolean;
  notes?: string;
}

export interface AuditStats {
  total_scans: number;
  avg_risk_score: number;
  decisions: {
    allow: number;
    warn: number;
    block: number;
  };
  sources: Record<string, number>;
  actions: Record<string, number>;
}

export interface PolicyRule {
  id: string;
  name: string;
  category: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  policy_action: 'warn' | 'block';
  enabled: boolean;
  weight: number;
  config: {
    pattern?: string;
    patterns?: string[];
    keywords?: string[];
    [key: string]: any;
  };
}

export interface PolicySettings {
  allow_threshold: number;
  warn_threshold: number;
  block_threshold: number;
  strict_blocking_override: boolean;
  explain_scoring?: boolean;
}
