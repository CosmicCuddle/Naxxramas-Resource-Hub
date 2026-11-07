'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const vm=require('node:vm');
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
  assert.match(code,/if\(trigger&&!beforeVisible&&!beforeAdmin\)trigger\.click\(\)/);
  assert.match(code,/candidates\.length===1/);
});

function simulate(label,{type='button',explicitType=false,inlineClick=true,formAssoc=false,formAttr=false}={}){
  let clicked=0;
  const base=(tag,shown=true)=>({
    tagName:tag,isConnected:true,nodeType:1,parentElement:null,
    textContent:'',className:'',disabled:false,type:'button',visible:shown,
    getClientRects(){return this.visible?[{}]:[];},
    getAttribute(key){return key==='type'&&this.explicitType?'submit':null;},
    hasAttribute(key){return key==='onclick'&&this.inlineClick===true||
      key==='form'&&this.formAttr===true;},
    closest(){return null;}
  });
  const editor=base('BUTTON',false);
  const trigger=base('BUTTON');
  trigger.textContent=label;
  trigger.type=type;
  trigger.explicitType=explicitType;
  trigger.inlineClick=inlineClick;
  trigger.form=formAssoc?{}:null;
  trigger.formAttr=formAttr;
  const password=base('INPUT',false);
  password.type='password';password.value='';
  trigger.click=()=>{clicked++;password.visible=true;};
  const shell=base('DIV');
  const d={
    body:{classList:{contains:()=>false}},
    querySelector(selector){return selector==='button.wh-pro-admin'?editor:null;},
    querySelectorAll(selector){return selector==='button'?[editor,trigger]:[];},
    getElementById(id){return id==='adminPasswordInput'?password:
      ['searchInput','resourceGrid','sectionHeading'].includes(id)?shell:null;}
  };
  const w={location:{pathname:'/',search:''},getComputedStyle(el){
    return {display:el.visible?'block':'none',visibility:'visible',opacity:'1'};
  }};
  return vm.runInNewContext(adminGateBrowserProbe(),
    {document:d,window:w,setTimeout(fn){fn();}},
    {timeout:2000}).then(out=>({out,clicked}));
}
test('single Admin-labelled visitor entry opens only its password gate',async()=>{
  const {out,clicked}=await simulate('Admin Access 🔐');
  assert.equal(clicked,1);
  assert.equal(out.ready,true);
  assert.equal(out.unambiguousEntryFound,true);
  assert.equal(out.gateOpened,true);
  assert.equal(out.loginAttempted,false);
  assert.equal(out.actualAdminEditingVerified,false);
  assert.equal(out.checks.noPasswordEntered,true);
  assert.equal(out.checks.visitorPrivilegeRemainsOff,true);
});
test('untyped button with implicit HTML submit default outside forms remains eligible',async()=>{
  const {out,clicked}=await simulate('Admin Access 🔐',{type:'submit',explicitType:false});
  assert.equal(clicked,1);
  assert.equal(out.unambiguousEntryFound,true);
  assert.equal(out.gateOpened,true);
});
test('unsafe administrator actions and submit buttons are never clicked',async()=>{
  for(const [label,options] of [
    ['Admin Delete All',{}],['Admin Reset',{}],
    ['Admin Access 🔐',{type:'submit',explicitType:true}],
    ['Admin Access 🔐',{inlineClick:false}],
    ['Admin Access 🔐',{formAssoc:true}],
    ['Admin Access 🔐',{formAttr:true}]
  ]){
    const {out,clicked}=await simulate(label,options);
    assert.equal(clicked,0,label);
    assert.equal(out.gateOpened,false,label);
    assert.equal(out.loginAttempted,false,label);
    assert.equal(out.ready,true,label);
  }
});

test('complete-site browser regression must require the original password entry at both widths',()=>{
  const source=fs.readFileSync(path.resolve(__dirname,
    '../tools/browser-smoke-complete-site.cjs'),'utf8');
  assert.match(source,/measured\.unambiguousEntryFound!==true/);
  assert.match(source,/measured\.gateOpened!==true/);
  assert.match(source,/Original admin password entry regression/);
  assert.match(source,/for\(const width of \[1440,390\]\)/);
  assert.match(source,/actualAdminEditingVerified:false,loginAttempted:false/);
});
