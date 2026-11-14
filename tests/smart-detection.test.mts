import test from 'node:test';
import assert from 'node:assert/strict';
import {getEngine,PolicyStore,DetectionEngine,Sanitizer} from '../src/server/engine.ts';
const scan=(text:string)=>getEngine().scanTextSegment(text,'prompt','test',{});
function has(text:string,category:string,value:string){
 const findings=scan(text);assert.ok(findings.some(f=>f.category===category&&f.matched_value===value),JSON.stringify(findings.map(f=>[f.category,f.matched_value])));
 for(const f of findings) assert.equal(text.slice(f.location_meta.start,f.location_meta.end),f.matched_value);
}
test('JSON and config secrets preserve labels and include punctuation',()=>{
 has('{"password":"Snow!Wolf#82"}','api_key','Snow!Wolf#82');
 has('client_secret = "a secret with spaces"','api_key','a secret with spaces');
 has('password=fox!88','api_key','fox!88');
 has('My password is fox!88.','api_key','fox!88.');
});
test('Hinglish secret labels select the value',()=>{
 has('Mera password fox!88 hai.','api_key','fox!88');
 has('Mera password hai fox!88','api_key','fox!88');
});
test('full private key body wins over overlapping header',()=>{
 const key='-----BEGIN RSA PRIVATE KEY-----\nQUJDREVGR0hJSktMTU5PUA==\n-----END RSA PRIVATE KEY-----';
 has('credential\n'+key+'\nend','api_key',key);
 const e=getEngine(),findings=scan(key);const fixed=Sanitizer.sanitizePrompt(key,findings,e);
 assert.equal(fixed.sanitized_content,'[API_KEY_1]');
});
test('hidden Unicode and fullwidth lookalikes keep original offsets',()=>{
 const hidden='abc\u200B@example.com'; has('👋 Contact '+hidden,'email',hidden);
 has('Email：ａｂｃ＠ｅｘａｍｐｌｅ．ｃｏｍ','email','ａｂｃ＠ｅｘａｍｐｌｅ．ｃｏｍ');
 has('password=ｆｏｘ１２３','api_key','ｆｏｘ１２３');
 const e=getEngine(), t='Contact '+hidden;const fixed=Sanitizer.sanitizePrompt(t,scan(t),e);
 assert.equal(fixed.sanitized_content,'Contact [EMAIL_1]');
 assert.equal(fixed.re_scan_findings.length,0);
});
test('obfuscated emails and Indian financial identifiers',()=>{
 has('Email: demo [at] example [dot] com','email','demo [at] example [dot] com');
 has('UPI ID: user123@oksbi','account_id','user123@oksbi');
 has('Aadhaar: 234567890123','gov_id','234567890123');
 has('Bank account: 123456789012','account_id','123456789012');
});
test('contextual rules respect disabled category',()=>{
 const s=new PolicyStore();s.updateRule('rule_api_key',{enabled:false});
 assert.deepEqual(new DetectionEngine(s.rules,s.settings).scanTextSegment('password=Snow!Wolf#82','prompt','test',{}),[]);
});
test('zero-length custom patterns terminate without empty findings',()=>{
 const s=new PolicyStore();s.updateRule('rule_email',{config:{pattern:'^|$'}});
 assert.deepEqual(new DetectionEngine(s.rules,s.settings).scanTextSegment('hello','prompt','test',{}),[]);
});
test('safe placeholders survive fresh scan and assignments keep their structure',()=>{
 const e=getEngine(),t='{"password":"Snow!Wolf#82"}';
 const fixed=Sanitizer.sanitizePrompt(t,scan(t),e);
 assert.equal(fixed.sanitized_content,'{"password":"[API_KEY_1]"}');
 assert.equal(fixed.re_scan_findings.length,0);
});
test('educational and nonliteral contexts do not become private disclosures',()=>{
 for(const t of ['Can you explain why asthma happens?','This tutorial explains how to treat diabetes.','The company pays a salary of 98000 rupees.','My password is very strong.','My name is public.']) assert.deepEqual(scan(t),[],t);
});
test('a name is captured completely in a mixed employment sentence',()=>{
 has('The employee named Kavya Sinha earns 98000 rupees monthly.','person_name','Kavya Sinha');
});
test('CSV re-scan preserves cell boundaries',()=>{
 const result=Sanitizer.sanitizeCsv([['Name','Note'],['Widget','hello, "world"\nnext'],['Formula','=SUM(1;2)']],[],getEngine());
 assert.equal(result.re_scan_findings.length,0);
});
test('existing saved preferences retire only the old secret assignment pattern',()=>{
 const s=new PolicyStore(); const api=s.rules.find(r=>r.id==='rule_api_key')!;
 api.config.patterns!.push('\\b(?:password|passwd|pwd|api_key|apikey|secret_key|access_token|auth_token|client_secret)\\s*[:=]\\s*[^\\s]{4,}');
 api.config.patterns!.push('custom-secret-[A-Z]+');
 const saved=JSON.stringify({rules:s.rules,settings:s.settings});
 const prev=globalThis.localStorage;
 (globalThis as any).localStorage={getItem:(key:string)=>key.includes('preferences')?saved:'[]'};
 try{
  const restored=new PolicyStore();restored.restoreLocalState();
  const patterns=restored.rules.find(r=>r.id==='rule_api_key')!.config.patterns!;
  assert.ok(patterns.includes('custom-secret-[A-Z]+'));
  assert.ok(!patterns.some(p=>p.startsWith('\\b(?:password|passwd|pwd|api_key|apikey|secret_key|access_token|auth_token|client_secret)')));
 }finally{(globalThis as any).localStorage=prev;}
});
