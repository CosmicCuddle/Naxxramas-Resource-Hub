'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {
  FORMAT,KEYS,adminKeyboardStateProbe,
  validateKeyboardSnapshot,summarizeKeyboardTrail
}=require('../tools/private-admin-keyboard-browser-probe.cjs');
function fake({width=390,focus='password',open=true,auth=false,
  passwordValue='',protectedVisible=false}={}){
  const root={nodeType:1,hidden:false,isConnected:true};
  const panel={nodeType:1,hidden:false,isConnected:true,parentElement:root,
    getClientRects(){return [{}];},
    contains(el){return el===password||el===close;},
    getAttribute(){return null;},
    closest(){return null;}};
  function element(tag,text,vis){
    return {
      tagName:tag,textContent:text,disabled:false,form:null,hidden:false,
      isConnected:true,nodeType:1,parentElement:panel,
      getAttribute(){return null;},hasAttribute(){return false;},
      closest(){return null;},
      getClientRects(){return vis?[{}]:[];}
    };
  }
  const password=element('INPUT','',open);
  password.type='password';password.value=passwordValue;
  const entry=element('BUTTON','Admin',true);
  const editor=element('BUTTON','',protectedVisible);
  const close=element('BUTTON','Close',open);
  const extra=element('BUTTON','Other',true);
  const doc={
    body:{nodeType:1,classList:{contains(){return auth;}}},
    documentElement:root,
    getElementById(id){return id==='adminPasswordInput'?password:null;},
    querySelector(q){return q==='button.wh-pro-admin'?editor:null;},
    querySelectorAll(q){return q==='button'?[entry,editor,close,extra]:[];},
    activeElement:null
  };
  const choice={password,entry,editor,close,extra,body:doc.body};
  doc.activeElement=choice[focus]||doc.body;
  const browser={
    document:doc,window:{
      location:{pathname:'/',search:''},innerWidth:width,
      getComputedStyle(el){return {
        display:el===password&&!open||el===editor&&!protectedVisible?'none':'block',
        visibility:'visible',opacity:'1'
      };}
    }
  };
  return vm.runInNewContext(adminKeyboardStateProbe(),
    browser,{timeout:1000});
}
test('private snapshot classifies original focus safely and omits labels and text',()=>{
  const s=fake();
  assert.equal(s.format,FORMAT);
  assert.equal(s.passwordPresent,true);
  assert.equal(s.passwordVisible,true);
  assert.equal(s.passwordFocused,true);
  assert.equal(s.passwordEmpty,true);
  assert.equal(s.visitorPrivilegeOff,true);
  assert.equal(s.focusOnProtectedEditor,false);
  assert.equal(s.protectedEditorHidden,true);
  assert.equal(s.focusOnVisitorEntry,false);
  assert.equal(validateKeyboardSnapshot(s,{initial:true}).passwordFocused,true);
  const out=JSON.stringify(s);
  assert.ok(!out.includes('"Admin"'));
  assert.ok(!out.includes('"Close"'));
  assert.ok(!out.includes('adminPasswordInput'));
});
test('Tab, Shift+Tab and Escape observations are diagnostics, not pass claims',()=>{
  for(const width of [390,1440]){
    const before=fake({width});
    const afterTab=fake({width,focus:'extra'});
    const afterShift=fake({width,focus:'password'});
    const afterEscape=fake({width,focus:'entry',open:false});
    const trail=summarizeKeyboardTrail(width,before,afterTab,afterShift,afterEscape);
    assert.equal(trail.tabMovedFocusFromPassword,true);
    assert.equal(trail.shiftTabReturnedToPassword,true);
    assert.equal(trail.escapeClosedPasswordPanel,true);
    assert.equal(trail.escapeReturnedFocusToVisitorEntry,true);
    assert.equal(trail.noPasswordEverEntered,true);
    assert.equal(trail.onlyNonSubmittingKeyboardKeysDispatched,true);
    assert.equal(trail.completeKeyboardAcceptanceVerified,false);
    assert.equal(trail.ownerApprovalForProductionChanges,false);
    assert.equal(Object.isFrozen(trail),true);
  }
});
test('nonfunctional Escape or unusual Tab path remains honest diagnostic',()=>{
  const before=fake();
  const still=fake();
  const trail=summarizeKeyboardTrail(390,before,still,still,still);
  assert.equal(trail.tabMovedFocusFromPassword,false);
  assert.equal(trail.shiftTabReturnedToPassword,true);
  assert.equal(trail.escapeClosedPasswordPanel,false);
  assert.equal(trail.escapeLeftPanelOpen,true);
  assert.equal(trail.escapeReturnedFocusToVisitorEntry,false);
  assert.equal(trail.completeKeyboardAcceptanceVerified,false);
});
test('unexpected password text, admin privilege, editor focus and invalid record fail closed',()=>{
  const sample=fake();
  for(const obj of [
    {...sample,passwordEmpty:false},
    {...sample,visitorPrivilegeOff:false},
    {...sample,protectedEditorHidden:false},
    {...sample,focusOnProtectedEditor:true},
    {...sample,pageRouteUnchanged:false},
    {...sample,noAuthenticationAttempted:false},
    {...sample,passwordFocused:'true'},
    {...sample,extraUnsafeField:'text'}
  ])assert.throws(()=>validateKeyboardSnapshot(obj),/no-login safeguard/);
  assert.throws(()=>summarizeKeyboardTrail(1200,sample,sample,sample,sample),
    /Unknown private keyboard test viewport/);
});
test('key allowlist has exactly Tab, Shift+Tab, Escape and NO text/Enter',()=>{
  assert.deepEqual(KEYS.map(x=>x.name),['Tab','Shift+Tab','Escape']);
  assert.deepEqual(KEYS.map(x=>x.windowsVirtualKeyCode),[9,9,27]);
  assert.deepEqual(KEYS.map(x=>x.modifiers),[0,8,0]);
  for(const item of KEYS){
    assert.equal(item.text,undefined);
    assert.equal(item.unmodifiedText,undefined);
    assert.equal(Object.isFrozen(item),true);
  }
});
test('private keyboard observer has no network, login, DOM mutation, script injection or publish',()=>{
  const source=fs.readFileSync(path.resolve(__dirname,
    '../tools/private-admin-keyboard-browser-probe.cjs'),'utf8');
  assert.doesNotThrow(()=>new Function(
    'return '+adminKeyboardStateProbe()));
  for(const needle of [
    'fetch(', 'XMLHttpRequest','sendBeacon(','.click(','.focus(',
    '.dispatchEvent(','.submit(','.requestSubmit(','writeFileSync(',
    'create_commit(', 'update_ref(', 'GITHUB_TOKEN','localStorage.setItem'
  ])assert.equal(source.includes(needle),false,needle);
  assert.match(source,/noAuthenticationAttempted:true/);
  assert.match(source,/completeKeyboardAcceptanceVerified:false/);
});
