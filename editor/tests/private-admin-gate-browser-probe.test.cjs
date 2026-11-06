'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {adminGateBrowserProbe}=require('../tools/private-admin-gate-browser-probe.cjs');

test('private probe is runnable JavaScript without source or administrator secrets',()=>{
  const expr=adminGateBrowserProbe();
  assert.doesNotThrow(()=>new Function('return '+expr));
  assert.match(expr,/adminPasswordInput/);
  assert.match(expr,/button\.wh-pro-admin/);
  assert.match(expr,/entryOpensPasswordGate/);
  assert.match(expr,/noAdminPrivilegeWasGranted/);
});
test('admin entry probe contains no credentials, network, submissions or website writers',()=>{
  const text=fs.readFileSync(path.resolve(__dirname,
    '../tools/private-admin-gate-browser-probe.cjs'),'utf8');
  for(const forbidden of ['fetch(', 'XMLHttpRequest', 'sendBeacon(',
    'form.submit(','.requestSubmit(', 'localStorage.setItem(',
    'sessionStorage.setItem(', 'writeFileSync(', 'update_ref(',
    'create_commit(', '.innerHTML=', 'GITHUB_TOKEN'])
    assert.equal(text.includes(forbidden),false,forbidden);
  assert.doesNotMatch(text,/password\.value\s*=(?!=)/);
  assert.match(text,/Only Boolean outcomes leave the browser/);
});
