import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateLocalRiskScore, getDecisionBadgeProps, getSeverityBadgeProps } from './rules.ts';

test('calculateLocalRiskScore returns allow for 0 findings', () => {
  const result = calculateLocalRiskScore({}, []);
  assert.equal(result.score, 0);
  assert.equal(result.decision, 'allow');
  assert.equal(result.hasBlocking, false);
});

test('calculateLocalRiskScore returns warn for non-blocking sensitive findings', () => {
  const weights = { email: 15, account_id: 25 };
  const findings = [
    { category: 'email', severity: 'medium', is_blocking: false },
    { category: 'account_id', severity: 'high', is_blocking: false }
  ];
  const result = calculateLocalRiskScore(weights, findings);
  assert.equal(result.decision, 'warn');
  assert.ok(result.score > 0);
  assert.equal(result.hasBlocking, false);
});

test('calculateLocalRiskScore enforces blocking rule even if score is low', () => {
  const weights = { api_key: 10 };
  const findings = [
    { category: 'api_key', severity: 'critical', is_blocking: true }
  ];
  const result = calculateLocalRiskScore(weights, findings);
  // Blocking flag must force 'block' decision
  assert.equal(result.decision, 'block');
  assert.equal(result.hasBlocking, true);
});

test('getDecisionBadgeProps handles all decisions properly', () => {
  assert.equal(getDecisionBadgeProps('allow').label, 'ALLOW');
  assert.equal(getDecisionBadgeProps('warn').label, 'WARN');
  assert.equal(getDecisionBadgeProps('block').label, 'BLOCK');
});

test('getSeverityBadgeProps maps critical, high, medium, low', () => {
  assert.equal(getSeverityBadgeProps('critical').label, 'Critical');
  assert.equal(getSeverityBadgeProps('high').label, 'High');
  assert.equal(getSeverityBadgeProps('medium').label, 'Medium');
  assert.equal(getSeverityBadgeProps('low').label, 'Low');
});
