import assert from 'node:assert/strict';
import fs from 'node:fs';
const memory = new Map<string,string>();
(globalThis as any).localStorage = {getItem:(k:string)=>memory.get(k)??null,setItem:(k:string,v:string)=>memory.set(k,v)};
(globalThis as any).window = {fetch:async()=>new Response('not found',{status:404})};
(globalThis as any).location = {href:'http://localhost/',origin:'http://localhost'};
await import('../src/local-api.ts');
const {default:ExcelJS} = await import('exceljs');
const {store} = await import('../src/server/engine.ts');
const request = (path:string,body:any) => window.fetch('/api/'+path,{method:'POST',body:body instanceof FormData?body:JSON.stringify(body)});
async function scan(name:string,bytes:Uint8Array|string){const form=new FormData();form.append('file',new File([typeof bytes === 'string' ? bytes : new Uint8Array(bytes).buffer],name));const r=await request('scan/file',form);assert.equal(r.status,200,await r.clone().text());return r.json();}
async function fix(d:any){const r=await request('autofix',{session_id:d.session_id});assert.equal(r.status,200,await r.clone().text());return r.json();}
const download = (d:any,format:string,confirmed=true)=>request('export',{session_id:d.session_id,export_format:format,user_confirmed:confirmed});
// No findings: a real Excel ZIP, never plain text renamed to XLSX.
const clean=new ExcelJS.Workbook();const ws=clean.addWorksheet('Inventory');ws.getCell('A1').value='Item';ws.getCell('B5').value=42;ws.getCell('C5').value={formula:'SUM(1,2)',result:3};clean.creator='Original private metadata';
let d=await scan('clean.xlsx',new Uint8Array(await clean.xlsx.writeBuffer()));assert.equal(d.total_findings,0);
assert.equal((await download(d,'xlsx',false)).status,403);
let r=await download(d,'xlsx');assert.equal(r.status,200);assert.match(r.headers.get('content-type')!,/spreadsheetml/);let bytes=new Uint8Array(await r.arrayBuffer());assert.equal(String.fromCharCode(...bytes.slice(0,2)),'PK');
let out=new ExcelJS.Workbook();await out.xlsx.load(bytes.buffer);assert.equal(out.getWorksheet('Inventory')!.getCell('B5').value,42);assert.equal(out.getWorksheet('Inventory')!.getCell('C5').formula,undefined);assert.notEqual(out.creator,'Original private metadata');
assert.equal((await download(d,'csv')).status,403);assert.equal((await download(d,'pdf')).status,403);
// Findings in cells AND notes must be removed from the resulting workbook.
const sensitive=new ExcelJS.Workbook();const sw=sensitive.addWorksheet('Customers');sw.getCell('B2').value='a@example.com';sw.getCell('B2').note='Contact a@example.com';
d=await scan('sensitive.xlsx',new Uint8Array(await sensitive.xlsx.writeBuffer()));assert.equal((await download(d,'xlsx')).status,403);await fix(d);r=await download(d,'xlsx');assert.equal(r.status,200,await r.clone().text());out=new ExcelJS.Workbook();await out.xlsx.load(await r.arrayBuffer());assert.equal(out.getWorksheet('Customers')!.getCell('B2').text,'[EMAIL_1]');assert.doesNotMatch(JSON.stringify(out.getWorksheet('Customers')!.getCell('B2').note),/a@example.com/);
// TSV must become true CSV, with comma/quote/newline escaping and formula neutralization.
d=await scan('data.tsv','Name\tNote\nWidget\t"hello, \"\"world\"\"\nnext"\nFormula\t=SUM(1;2)');r=await download(d,'csv');assert.equal(r.status,200);const csv=await r.text();assert.match(csv,/Name,Note/);assert.match(csv,/"hello, ""world""\nnext"/);assert.match(csv,/'=SUM/);
// Standard CSV masks actual content; sensitive text is absent from downloads.
d=await scan('customers.csv',fs.readFileSync('public/demo_samples/customers.csv'));await fix(d);r=await download(d,'csv');assert.equal(r.status,200);assert.doesNotMatch(await r.text(),/rahul@example.com|ACC-12345/);
// Current policy, not a stale scan badge, controls release.
d=await (await request('scan/prompt',{prompt:'Project Zebra notes'})).json();
const confidential=store.getRules().find(r=>r.category==='confidential_keyword')!;store.updateRule(confidential.id,{config:{keywords:['Project Zebra']}});assert.equal((await download(d,'txt')).status,403);store.resetToDefaults();
// Empty sanitized content must not fall back to the original sensitive source.
const {prepareExport}=await import('../src/server/export.ts');const empty=await prepareExport({source_type:'prompt',policy_decision:'warn',findings:[{}],raw_text:'a@example.com',sanitized_data:{sanitized_content:'',re_scan_findings:[],re_scan_policy_decision:'allow'}},'txt');assert.equal(empty.body,'');
d=await scan('unsupported.dat',new Uint8Array([0,255,0]));assert.equal((await download(d,'txt')).status,403);
console.log('PASS: genuine clean/masked XLSX, comment masking, CSV serialization and formula safety, format restrictions, review gate, fresh policy checks, empty content, incomplete scans.');
