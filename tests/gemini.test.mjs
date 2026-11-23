import test from 'node:test';
import assert from 'node:assert/strict';
import { generateResumeText } from '../app/api/generate/gemini.mjs';
import { generationErrorMessage } from '../app/generation-errors.mjs';
const input = { prompt: 'Accountant with inventory reconciliation experience', type: 'summary', language: 'en' };
const config = { apiKey: 'test-only-not-a-real-key', log: () => {} };
const response = (data, status = 200) => new Response(JSON.stringify(data), {status, headers:{'Content-Type':'application/json'}});
const complete = text => ({candidates:[{finishReason:'STOP',content:{parts:[{text}]}}]});

test('missing key does not send request', async () => {
  let calls=0; const r=await generateResumeText(input,{...config,apiKey:'',fetchImpl:async()=>{calls++;}});
  assert.equal(r.code,'AI_CONFIGURATION');assert.equal(calls,0);
});
test('model path is validated before request', async () => {
  let calls=0; const r=await generateResumeText(input,{...config,model:'../../secret',fetchImpl:async()=>{calls++;}});
  assert.equal(r.code,'AI_CONFIGURATION');assert.equal(calls,0);
});
test('success uses server header, bounded output and separate factual instructions', async () => {
  let request; const r=await generateResumeText(input,{...config,fetchImpl:async(url,options)=>{request={url,options};return response(complete(' Revised summary '));}});
  assert.equal(r.result,'Revised summary'); assert.ok(!request.url.includes(config.apiKey));
  assert.equal(request.options.headers['x-goog-api-key'],config.apiKey);
  assert.ok(request.options.signal instanceof AbortSignal);
  const body=JSON.parse(request.options.body);
  assert.equal(body.contents[0].parts[0].text,input.prompt);
  assert.match(body.systemInstruction.parts[0].text,/Do not invent/);
  assert.equal(body.generationConfig.maxOutputTokens,2048);
});
test('Arabic experience instructions preserve facts', async () => {
  let body; await generateResumeText({...input,language:'ar',type:'experience'},{...config,fetchImpl:async(_,o)=>{body=JSON.parse(o.body);return response(complete('نص'));}});
  assert.match(body.systemInstruction.parts[0].text,/لا تخترع/);assert.match(body.systemInstruction.parts[0].text,/bullet/);
});
test('explicit model override is preserved', async () => {
  let url; await generateResumeText(input,{...config,model:'configured-model',fetchImpl:async u=>{url=u;return response(complete('ok'));}});
  assert.ok(url.includes('configured-model:generateContent'));
});
for(const [status,reason,code] of [[400,'API_KEY_INVALID','AI_CONFIGURATION'],[403,'API_KEY_SERVICE_BLOCKED','AI_CONFIGURATION'],[403,'BILLING_DISABLED','AI_CONFIGURATION'],[404,null,'AI_CONFIGURATION'],[429,null,'AI_RATE_LIMIT'],[503,null,'AI_UNAVAILABLE']]) {
  test(`provider ${status}/${reason} sanitized without fallback or secret leak`,async()=>{
    let calls=0;const logs=[];const r=await generateResumeText(input,{...config,log:(...x)=>logs.push(x),fetchImpl:async()=>{calls++;return response({error:{message:config.apiKey,details:[{reason}]}},status);}});
    assert.equal(r.code,code);assert.equal(calls,1);assert.ok(!JSON.stringify([r,logs]).includes(config.apiKey));
  });
}
for(const [name,data] of [['empty',{}],['blocked',{promptFeedback:{blockReason:'SAFETY'}}],['truncated',{candidates:[{finishReason:'MAX_TOKENS',content:{parts:[{text:'partial'}]}}]}],['oversized',complete('x'.repeat(20001))]]) {
  test(`rejects ${name} output`,async()=>{const r=await generateResumeText(input,{...config,fetchImpl:async()=>response(data)});assert.equal(r.code,'AI_INCOMPLETE');assert.ok(!r.result);});
}
test('thought parts never included in resume',async()=>{
  const r=await generateResumeText(input,{...config,fetchImpl:async()=>response({candidates:[{finishReason:'STOP',content:{parts:[{text:'private reasoning',thought:true},{text:'final'}]}}]})});assert.equal(r.result,'final');
});
test('malformed JSON is safe',async()=>{
  const r=await generateResumeText(input,{...config,fetchImpl:async()=>new Response('<html>error</html>')});assert.equal(r.code,'AI_UNAVAILABLE');
});
test('network error is safe',async()=>{
  const r=await generateResumeText(input,{...config,fetchImpl:async()=>{throw new Error(config.apiKey);}});assert.equal(r.code,'AI_UNAVAILABLE');assert.ok(!JSON.stringify(r).includes(config.apiKey));
});
test('request aborts at timeout with no fallback',async()=>{
  let calls=0;const r=await generateResumeText(input,{...config,timeoutMs:10,fetchImpl:async(_,o)=>{calls++;return new Promise((_,reject)=>o.signal.addEventListener('abort',()=>reject(new DOMException('aborted','AbortError'))));}});
  assert.equal(r.code,'AI_TIMEOUT');assert.equal(r.status,504);assert.equal(calls,1);
});
test('client errors distinguish configuration, limit, timeout and incomplete text in both languages',()=>{
  for(const lang of ['ar','en']) for(const code of ['AI_CONFIGURATION','AI_RATE_LIMIT','AI_TIMEOUT','AI_INCOMPLETE','anything']) {
    const s=generationErrorMessage(code,lang);assert.equal(typeof s,'string');assert.ok(s.length>25);
    assert.ok(!s.includes('anything'));assert.ok(!s.includes('API_KEY'));
  }
  assert.match(generationErrorMessage('AI_CONFIGURATION','en'),/Retrying will not fix/);
});
