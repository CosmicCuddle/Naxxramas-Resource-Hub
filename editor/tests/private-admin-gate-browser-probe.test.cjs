'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {adminGateBrowserProbe}=require('../tools/private-admin-gate-browser-probe.cjs');

test('no-login discovery is runnable and does not grant administrator approval',()=>{
  const expr=adminGateBrowserProbe();
  assert.doesNotThrow(()=>new Function('return '+expr));
  assert.match(expr,/adminPasswordInput/);
  assert.match(expr,/button\.wh-pro-admin/);
  assert.match(expr,/unambiguousEntryFound/);
  assert.match(expr,/actualAdminEditingVerified:false/);
  assert.match(expr,/gateOpened:opened/);
});
test('hidden editor controls cannot be clicked; no credentials or website writes',()=>{
  const code=fs.readFileSync(path.resolve(__dirname,
    '../tools/private-admin-gate-browser-probe.cjs'),'utf8');
  for(const forbidden of ['fetch(', 'XMLHttpRequest', 'sendBeacon(',
    'form.submit(','.requestSubmit(', 'localStorage.setItem(',
    'sessionStorage.setItem(', 'writeFileSync(', 'update_ref(',
    'create_commit(', 'editorControl.click()', '.innerHTML=', 'GITHUB_TOKEN'])
    assert.equal(code.includes(forbidden),false,forbidden);
  assert.doesNotMatch(code,/password\.value\s*=(?!=)/);
  assert.match(code,/if\(trigger\)trigger\.click\(\)/);
  assert.match(code,/candidates\.length===1/);
});
