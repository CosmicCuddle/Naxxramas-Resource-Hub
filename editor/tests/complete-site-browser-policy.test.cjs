'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {permittedRequest,CSP,browserProbe}=
  require('../tools/browser-smoke-complete-site.cjs');
const origin='http://127.0.0.1:39117';
test('local Chrome request gate blocks external, other ports, unsafe methods and credentials',()=>{
  assert.equal(permittedRequest(origin+'/new-players/','GET',origin),true);
  assert.equal(permittedRequest(origin+'/content/navigation.json','HEAD',origin),true);
  for(const [url,method] of [
    ['https://tally.so/embed/q5Lqr8','GET'],
    ['https://wow.zamimg.com/icon.jpg','GET'],
    ['http://127.0.0.1:39118/','GET'],
    ['http://localhost:39117/','GET'],
    [origin+'/apply/','POST'],
    [origin+'/apply/','PUT'],
    ['file:///etc/passwd','GET'],
    ['about:blank','GET'],
    ['not-a-URL','GET']
  ])assert.equal(permittedRequest(url,method,origin),false);
});
test('complete browser copy carries strict no-form, no-frame and same-origin script policy',()=>{
  for(const piece of [
    "connect-src 'self'","form-action 'none'","frame-src 'none'",
    "script-src 'self'","object-src 'none'","base-uri 'none'"
  ]) assert.ok(CSP.includes(piece));
  assert.ok(!CSP.includes("connect-src *"));
  assert.ok(!CSP.includes('https:'));
});
test('all private website probes are executable Boolean-only expressions',()=>{
  for(const page of ['home','new-players','rules','apply','clients']){
    const code=browserProbe(page);
    assert.ok(code.startsWith('(()=>{'));
    assert.doesNotThrow(()=>new Function('return '+code+';'));
    assert.ok(code.includes('Browser Preview Server Rules'));
    assert.ok(!code.includes('http://'));
    assert.ok(!code.includes('fetch('));
    assert.ok(!code.includes('submit('));
  }
});
