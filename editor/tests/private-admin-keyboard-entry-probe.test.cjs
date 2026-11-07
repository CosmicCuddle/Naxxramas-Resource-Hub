'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {
  FORMAT,KEYS,MAX_TABS,adminKeyboardEntrySnapshot,check,summarize
}=require('../tools/private-admin-keyboard-entry-probe.cjs');
function fixture({focus='none',open=false,ambiguous=false,
  editorVisible=false,passwordText='',admin=false,form=false,
  tabIndex=0,ariaExpanded=false,ariaControls=false,
  entryShown=true,route='/'}={}){
  const root={nodeType:1,isConnected:true,hidden:false};
  const body={nodeType:1,isConnected:true,hidden:false,
    classList:{contains:k=>k==='visual-admin-active'&&admin}};
  function el(tag,text,visible){
    return {
      tagName:tag,textContent:text,isConnected:true,hidden:false,
      nodeType:1,parentElement:root,shown:visible,disabled:false,
      tabIndex:0,form:null,
      getClientRects(){return this.shown?[{}]:[];},
      getAttribute(){return null;},hasAttribute(){return false;},
      closest(){return null;}
    };
  }
  const entry=el('BUTTON','Admin',entryShown);
  entry.tabIndex=tabIndex;
  entry.form=form?{}:null;
  entry.closest=selector=>form&&selector==='form'?{}:null;
  entry.hasAttribute=key=>
    key==='aria-expanded'?ariaExpanded:key==='aria-controls'?ariaControls:false;
  const twin=el('BUTTON','Admin',ambiguous);
  const editor=el('BUTTON','',editorVisible);
  const password=el('INPUT','',open);
  password.type='password';password.value=passwordText;
  const active={entry,password,body}[focus]||body;
  const document={
    body,activeElement:active,documentElement:root,
    getElementById:id=>id==='adminPasswordInput'?password:null,
    querySelector:key=>key==='button.wh-pro-admin'?editor:null,
    querySelectorAll:key=>key==='button'?[entry,twin,editor]:[]
  };
  const window={location:{pathname:route,search:''},
    getComputedStyle:node=>({
      display:node.shown===false?'none':'block',visibility:'visible',opacity:'1'
    })};
  return vm.runInNewContext(adminKeyboardEntrySnapshot(),
    {document,window},{timeout:1200});
}
test('pre-open private inventory finds one safe visitor button without leaking its label',()=>{
  const r=fixture();
  assert.equal(r.format,FORMAT);
  assert.equal(r.unambiguousSafeEntry,true);
  assert.equal(r.entryEligibleForTab,true);
  assert.equal(r.entryVisible,true);
  assert.equal(r.passwordVisible,false);
  assert.equal(r.passwordEmpty,true);
  assert.equal(r.entryFocused,false);
  assert.equal(r.protectedEditorHidden,true);
  assert.equal(check(r,{initial:true}).passwordPresent,true);
  const out=JSON.stringify(r);
  assert.ok(!out.includes('"Admin"'));
  assert.ok(!out.includes('adminPasswordInput'));
});
test('real Tab-reached visible Admin and Enter outcome are reported, not approved',()=>{
  for(const width of [390,1440]){
    const before=fixture();
    const focused=fixture({focus:'entry'});
    const opened=fixture({focus:'password',open:true});
    const trail=summarize(width,before,focused,opened,4);
    assert.equal(trail.width,width);
    assert.equal(trail.keyboardReachedEntry,true);
    assert.equal(trail.enterOpenedPasswordPanel,true);
    assert.equal(trail.enterFocusedPassword,true);
    assert.equal(trail.passwordStayedEmpty,true);
    assert.equal(trail.protectedEditorAlwaysHidden,true);
    assert.equal(trail.completeKeyboardAcceptanceVerified,false);
    assert.equal(trail.productionChangeApproved,false);
  }
});
test('not reachable within bounded Tab budget is diagnostic and NEVER sends Enter',()=>{
  const before=fixture(),focused=fixture({focus:'none'});
  const result=summarize(390,before,focused,focused,MAX_TABS);
  assert.equal(result.keyboardReachedEntry,false);
  assert.equal(result.enterDispatchedOnlyAtSafeEntry,false);
  assert.equal(result.enterOpenedPasswordPanel,false);
  assert.equal(result.boundedTabsDispatched,MAX_TABS);
  assert.equal(result.noCredentialsEntered,true);
  // If the genuine entry is not Tab-eligible, dispatch zero keys; never
  // claim 80 real keys were sent or activate with a forced focus.
  const notEligible=fixture({tabIndex:-1});
  const blocked=summarize(390,notEligible,notEligible,notEligible,0);
  assert.equal(blocked.boundedTabsDispatched,0);
  assert.equal(blocked.enterDispatchedOnlyAtSafeEntry,false);
});
test('ambiguous, form, disabled and unsafe visitor entry cannot pass preflight',()=>{
  for(const bad of [
    {ambiguous:true},{form:true},{editorVisible:true},
    {passwordText:'should never be accepted'},{admin:true},{route:'/apply/'}
  ])assert.throws(()=>check(fixture(bad),{initial:true}),
    /visitor safety invariant/);
  assert.equal(fixture({tabIndex:-1}).entryEligibleForTab,false);
  const r=fixture({ariaExpanded:true,ariaControls:true});
  assert.equal(r.entryHasAriaExpanded,true);
  assert.equal(r.entryHasAriaControls,true);
});
test('original entry may hide after safe activation without relaxing password or privilege guards',()=>{
  const pre=fixture(),focused=fixture({focus:'entry'});
  const opened=fixture({open:true,focus:'password',entryShown:false});
  assert.equal(opened.unambiguousSafeEntry,false);
  assert.throws(()=>check(opened),/unambiguousSafeEntry/);
  const report=summarize(390,pre,focused,opened,2);
  assert.equal(report.enterOpenedPasswordPanel,true);
  assert.equal(report.enterFocusedPassword,true);
  assert.equal(report.passwordStayedEmpty,true);
  assert.equal(report.protectedEditorAlwaysHidden,true);
  assert.equal(report.noVisitorPrivilegeGranted,true);
  assert.throws(()=>summarize(390,pre,focused,{
    ...opened,passwordEmpty:false
  },2),/passwordEmpty/);
  assert.throws(()=>summarize(390,pre,focused,{
    ...opened,visitorPrivilegeOff:false
  },2),/visitorPrivilegeOff/);
});

test('unexpected post-Enter privilege, password data and route changes fail closed',()=>{
  const original=fixture(),focused=fixture({focus:'entry'}),opened=fixture({open:true});
  for(const altered of [
    {...opened,passwordEmpty:false},
    {...opened,visitorPrivilegeOff:false},
    {...opened,protectedEditorHidden:false},
    {...opened,routeUnchanged:false},
    {...opened,unexpectedField:'leak'}
  ])assert.throws(()=>summarize(390,original,focused,altered,1),
    /visitor safety invariant/);
  assert.throws(()=>summarize(390,original,focused,opened,0),
    /Tab-reached/);
  assert.throws(()=>summarize(390,original,fixture(),opened,1),
    /Enter must not be dispatched/);
});
test('only non-form Tab and safe Admin Enter, with no disk, network or page mutation',()=>{
  assert.equal(KEYS.tab.key,'Tab');
  assert.equal(KEYS.enter.key,'Enter');
  assert.equal(KEYS.enter.windowsVirtualKeyCode,13);
  assert.equal(KEYS.tab.windowsVirtualKeyCode,9);
  assert.equal(KEYS.tab.text,undefined);
  // Standard Chrome keyDown uses a carriage-return CONTROL character for
  // Enter, never a printable value or credential.
  assert.equal(KEYS.enter.text,'\r');
  assert.equal(KEYS.enter.unmodifiedText,'\r');
  assert.equal(KEYS.enter.text.length,1);
  assert.equal(Object.isFrozen(KEYS.tab),true);
  assert.equal(Object.isFrozen(KEYS.enter),true);
  assert.ok(MAX_TABS>1&&MAX_TABS<=100);
  const s=fs.readFileSync(path.resolve(__dirname,
    '../tools/private-admin-keyboard-entry-probe.cjs'),'utf8');
  for(const bad of ['fetch(', 'XMLHttpRequest','sendBeacon(','.click(',
    '.focus(','.submit(','.dispatchEvent(','.innerHTML=',
    'writeFileSync(', 'create_commit(', 'update_ref(','GITHUB_TOKEN'])
    assert.equal(s.includes(bad),false,bad);
  assert.match(s,/productionChangeApproved:false/);
});
