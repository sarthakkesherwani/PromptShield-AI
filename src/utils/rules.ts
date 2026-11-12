/**
 * Client-side utility functions for PromptShield AI policy, badges,
 * placeholder tags, and calculation helpers.
 */

export interface Finding {
  id: string;
  rule_id: string;
  rule_name: string;
  category: 'email' | 'phone' | 'account_id' | 'api_key' | 'confidential_keyword' | 'custom_regex';
  severity: 'low' | 'medium' | 'high' | 'critical';
  policy_action: 'warn' | 'block';
  weight: number;
  location: string;
  location_type: 'prompt' | 'pdf' | 'xlsx' | 'csv' | 'txt';
  location_meta: Record<string, any>;
  matched_value: string;
  placeholder?: string;
  explanation: string;
  is_blocking?: boolean;
}

export type PolicyDecision = 'allow' | 'warn' | 'block';

export function getDecisionBadgeProps(decision: PolicyDecision) {
  switch (decision) {
    case 'allow':
      return {
        label: 'ALLOW',
        bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        badgeBg: 'bg-emerald-500',
        description: 'Safe to process or export'
      };
    case 'warn':
      return {
        label: 'WARN',
        bg: 'bg-amber-50 text-amber-700 border-amber-200',
        badgeBg: 'bg-amber-500',
        description: 'Sensitive data detected — review & masking required'
      };
    case 'block':
      return {
        label: 'BLOCK',
        bg: 'bg-rose-50 text-rose-700 border-rose-200',
        badgeBg: 'bg-rose-600',
        description: 'Action blocked by security policy rules'
      };
  }
}

export function getSeverityBadgeProps(severity: string) {
  switch (severity) {
    case 'critical':
      return {
        label: 'Critical',
        classes: 'bg-rose-100 text-rose-800 border-rose-300'
      };
    case 'high':
      return {
        label: 'High',
        classes: 'bg-orange-100 text-orange-800 border-orange-300'
      };
    case 'medium':
      return {
        label: 'Medium',
        classes: 'bg-amber-100 text-amber-800 border-amber-300'
      };
    case 'low':
    default:
      return {
        label: 'Low',
        classes: 'bg-sky-100 text-sky-800 border-sky-300'
      };
  }
}

export function getCategoryIconName(category: string): string {
  switch (category) {
    case 'email':
      return 'Mail';
    case 'phone':
      return 'Phone';
    case 'account_id':
      return 'CreditCard';
    case 'api_key':
      return 'Key';
    case 'confidential_keyword':
      return 'ShieldAlert';
    default:
      return 'AlertCircle';
  }
}

export function calculateLocalRiskScore(
  categoryWeights: Record<string, number>,
  findings: Array<{ category: string; severity?: string; is_blocking?: boolean }>
): { score: number; decision: PolicyDecision; hasBlocking: boolean } {
  const multipliers: Record<string, number> = {
    low: 0.5,
    medium: 1.0,
    high: 1.4,
    critical: 2.0
  };

  let raw = 0;
  let hasBlocking = false;
  const counts: Record<string, number> = {};

  for (const f of findings) {
    if (f.is_blocking) {
      hasBlocking = true;
    }
    const cat = f.category;
    counts[cat] = (counts[cat] || 0) + 1;
    const base = categoryWeights[cat] || 15;
    const mult = multipliers[f.severity || 'medium'] || 1.0;

    if (counts[cat] === 1) {
      raw += Math.round(base * mult);
    } else {
      raw += Math.round(base * 0.25);
    }
  }

  const score = Math.min(100, Math.max(0, raw));
  let decision: PolicyDecision = 'allow';

  // Rule: Low score must never override a blocking policy rule
  if (hasBlocking) {
    decision = 'block';
  } else if (score >= 60) {
    decision = 'block';
  } else if (findings.length > 0 || score >= 11) {
    decision = 'warn';
  }

  return { score, decision, hasBlocking };
}

export function formatLocation(loc: string, type: string): string {
  if (!loc) return 'Unknown';
  return loc;
}
