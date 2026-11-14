import test from 'node:test';
import assert from 'node:assert/strict';
import { detectContext } from '../src/model/detector.ts';
import { getEngine, PolicyStore, DetectionEngine, Sanitizer } from '../src/server/engine.ts';
import { parseAndScanPrompt, parseAndScanCsv } from '../src/server/parsers.ts';
import { Buffer } from 'buffer';
const cases = [
 ['My name is Kavya Sinha.', 'person_name', 'Kavya Sinha'],
 ['I live at 62 Cedar Road Jaipur.', 'address', '62 Cedar Road Jaipur'],
 ['My password is RiverFox92.', 'api_key', 'RiverFox92'],
 ['Mera password RiverFox92 hai.', 'api_key', 'RiverFox92'],
 ['I was diagnosed with diabetes.', 'health_info', 'diabetes'],
 ['My monthly salary is 98000 rupees.', 'financial_info', '98000 rupees'],
] as const;
for (const [text,category,value] of cases) test(`context: ${category} with unseen values`, () => {
 const f=detectContext(text); assert.ok(f.some(s=>s.category===category && text.slice(s.start,s.end)===value),JSON.stringify(f));
});
test('educational questions and dates are not private data',()=>{
 for(const t of ['Explain how passwords work.','What is diabetes?','Explain salary tax calculation.','Write a Python sorting algorithm.','My appointment is on 2026-11-15.','The server IP is 192.168.1.1.']) assert.deepEqual(detectContext(t),[],t);
});
test('hybrid findings have exact offsets and policy source',()=>{
 const text='My name is Kavya Sinha. Email kavya@example.com.';
 const result=parseAndScanPrompt(text,getEngine());
 assert.ok(result.findings.some(f=>f.detection_source==='rule' && f.category==='email'));
 assert.ok(result.findings.some(f=>f.detection_source==='model' && f.category==='person_name'));
 for (const f of result.findings) assert.equal(text.slice(f.location_meta.start,f.location_meta.end),f.matched_value);
});
test('model masking and re-scan use safe placeholders',()=>{
 const text='My name is Kavya Sinha.'; const engine=getEngine();
 const result=Sanitizer.sanitizePrompt(text,engine.scanTextSegment(text,'prompt','test',{}),engine);
 assert.ok(!result.sanitized_content.includes('Kavya')); assert.equal(result.re_scan_findings.length,0);
});
test('disabling model category respects policy',()=>{
 const store=new PolicyStore(); store.updateRule('rule_person_name',{enabled:false});
 const e=new DetectionEngine(store.rules,store.settings);
 assert.equal(e.scanTextSegment('My name is Kavya Sinha.','prompt','test',{}).length,0);
});
test('CSV cells use the same hybrid engine',()=>{
 const r=parseAndScanCsv(Buffer.from('note\n"My name is Kavya Sinha."'),'people.csv',getEngine());
 assert.ok(r.findings.some(f=>f.category==='person_name' && f.detection_source==='model'));
});
