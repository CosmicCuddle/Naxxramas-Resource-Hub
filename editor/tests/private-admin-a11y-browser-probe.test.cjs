'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {adminAccessibilityBrowserProbe}=require(
  '../tools/private-admin-a11y-browser-probe.cjs');
function setup({width=390,withLabel=true,withDialog=true,
  clipped=false,focus=true,close=true,overflow=false,loggedIn=false}={}){
  function element(tag,visible=true,parent=null){
    return {
      tagName:tag,nodeType:1,parentElement:parent,
      isConnected:true,hidden:false,visible,
      disabled:false,tabIndex:0,labels:[],value:'',
      textContent:'',id:'',getClientRects(){return this.visible?[{}]:[];},
      getBoundingClientRect(){return {
        left:clipped?width-10:5,top:10,
        right:clipped?width+100:205,bottom:60,
        width:200,height:50
      };},
      getAttribute(){return null;},hasAttribute(){return false;},
      closest(){return null;},querySelectorAll(){return [];}
    };
  }
  const panel=element('DIV');
  const field=element('INPUT',true,panel);
  field.type='password';
  if(withLabel)field.labels=[{}];
  const editor=element('BUTTON',false);
  const dismiss=element('BUTTON',true,panel);
  dismiss.getAttribute=name=>name==='aria-label'?'Close':null;
  const candidates=[field,...(close?[dismiss]:[])];
  panel.querySelectorAll=()=>candidates;
  const dialog=withDialog?element('DIALOG'):null;
  field.closest=selector=>
    selector==='dialog,[role="dialog"],[aria-modal="true"]'?dialog:
      selector==='[aria-modal="true"]'?dialog:null;
  if(dialog)dialog.querySelectorAll=()=>candidates;
  const doc={
    body:{classList:{contains:()=>loggedIn}},
    activeElement:focus?field:editor,
    documentElement:{scrollWidth:overflow?width+100:width},
    getElementById(id){
      return id==='adminPasswordInput'?field:null;
    },
    querySelector(query){return query==='button.wh-pro-admin'?editor:null;}
  };
  const win={
    innerWidth:width,innerHeight:900,
    getComputedStyle(el){return {
      display:el.visible?'block':'none',visibility:'visible',opacity:'1'
    };}
  };
  const expression=adminAccessibilityBrowserProbe();
  return vm.runInNewContext(expression,
    {document:doc,window:win},{timeout:1200});
}
test('passive mobile and desktop browser probe returns only accessibility flags',()=>{
  for(const width of [390,1440]){
    const result=setup({width});
    assert.equal(result.format,'naxx-private-admin-a11y-diagnostics-v1');
    assert.equal(result.viewportClass,width<500?'mobile':'desktop');
    assert.equal(result.structuralSafety,true);
    assert.equal(result.diagnostics.passwordHasProgrammaticName,true);
    assert.equal(result.diagnostics.passwordCanReceiveTab,true);
    assert.equal(result.diagnostics.passwordFitsViewport,true);
    assert.equal(result.diagnostics.closeControlFocusable,true);
    assert.equal(result.visibleCloseControls,1);
    assert.equal(result.visibleTabStopsNearPassword,2);
    assert.equal(result.diagnostics.passwordCurrentlyFocused,true);
    assert.equal(result.diagnostics.semanticDialogPresent,true);
    assert.equal(result.diagnostics.ariaModalDeclared,true);
    assert.equal(result.diagnostics.protectedEditorHidden,true);
    assert.equal(result.diagnostics.unauthenticatedVisitor,true);
    for(const name of [
      'keyboardNavigationActuallyDispatched','escapeDismissalActuallyTested',
      'completeWCAGConformanceVerified','ownerAdminAcceptanceVerified',
      'loginAttempted','credentialsCollected','formSubmitted','domModified',
      'externalRequestsMade','publicationApproved'
    ])assert.equal(result[name],false,name);
    const out=JSON.stringify(result);
    assert.ok(!out.includes('Close'));
    assert.ok(!out.includes('adminPasswordInput'));
  }
});
test('accessibility concerns remain visible diagnostics, never false approval',()=>{
  const report=setup({width:390,withLabel:false,withDialog:false,
    clipped:true,focus:false,close:false,overflow:true});
  assert.equal(report.structuralSafety,true);
  assert.equal(report.diagnostics.passwordHasProgrammaticName,false);
  assert.equal(report.diagnostics.passwordFitsViewport,false);
  assert.equal(report.diagnostics.noHorizontalPageOverflow,false);
  assert.equal(report.diagnostics.semanticDialogPresent,false);
  assert.equal(report.diagnostics.closeControlFocusable,false);
  assert.equal(report.visibleTabStopsNearPassword,1);
  assert.equal(report.completeWCAGConformanceVerified,false);
});
test('privilege escalation is a hard safety failure and never admin approval',()=>{
  const result=setup({loggedIn:true});
  assert.equal(result.structuralSafety,false);
  assert.equal(result.diagnostics.unauthenticatedVisitor,false);
  assert.equal(result.ownerAdminAcceptanceVerified,false);
});
test('admin accessibility audit cannot dispatch keys, focus, type, save or send data',()=>{
  const source=fs.readFileSync(path.resolve(__dirname,
    '../tools/private-admin-a11y-browser-probe.cjs'),'utf8');
  assert.doesNotThrow(()=>new Function('return '+adminAccessibilityBrowserProbe()));
  for(const token of [
    'fetch(', 'XMLHttpRequest','sendBeacon(','.click(','.focus(',
    '.dispatchEvent(', '.submit(', '.requestSubmit(', '.innerHTML=',
    'localStorage.setItem(', 'create_commit(', 'update_ref(',
    'writeFileSync(', 'GITHUB_TOKEN'
  ])assert.equal(source.includes(token),false,token);
  assert.match(source,/keyboardNavigationActuallyDispatched:false/);
  assert.match(source,/loginAttempted:false,credentialsCollected:false/);
});
