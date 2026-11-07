'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const {adminSurfaceBrowserProbe}=require('../tools/private-admin-surface-browser-probe.cjs');

function element({tagName='BUTTON',label='',visible=true,parent=null}={}){
  return {
    tagName, textContent:label, className:'',id:'',hidden:false,
    parentElement:parent,nodeType:1,isConnected:true,
    getAttribute(){return null;},
    hasAttribute(){return false;},
    getClientRects(){return this.visible?[{}]:[];},
    closest(){return null;},
    visible
  };
}

test('private inventory reports counts only and does not leak label values',()=>{
  const parent=element({tagName:'DIV',visible:false});
  const password=element({tagName:'INPUT',parent,visible:false});
  password.type='password';
  const edit=element({label:'private synthetic editing control',visible:false});
  const login=element({label:'Admin access'});
  const link=element({tagName:'A',label:'Log in'});
  const hidden=element({label:'Administrator settings',visible:false});
  const unrelated=element({label:'Game Clients'});
  const doc={
    body:{classList:{contains:()=>false}},
    getElementById(id){
      if(id==='adminPasswordInput')return password;
      if(id==='resourceGrid'||id==='sectionHeading')return element();
      return null;
    },
    querySelector(s){return s==='button.wh-pro-admin'?edit:null;},
    querySelectorAll(s){
      if(s==='script:not([src])')return [{textContent:'adminPasswordInput'}];
      return [edit,login,link,hidden,unrelated];
    }
  };
  const expression=adminSurfaceBrowserProbe();
  const out=vm.runInNewContext(expression,{document:doc,window:{
    getComputedStyle(el){return {
      display:el.visible?'block':'none',visibility:'visible',opacity:'1'
    };}
  }},{timeout:1000});
  assert.equal(out.format,'naxx-private-admin-surface-inventory-v1');
  assert.equal(out.passwordFieldPresent,true);
  assert.equal(out.passwordVisibleToVisitor,false);
  assert.equal(out.passwordHasProgrammaticLabel,false);
  assert.equal(out.passwordKeyboardFocusable,false);
  assert.equal(out.passwordFocusedAfterOpen,false);
  assert.equal(out.passwordInsideAriaModal,false);
  assert.equal(out.editorControlPresent,true);
  assert.equal(out.editorControlVisibleToVisitor,false);
  assert.equal(out.candidateControls.visibleMatchingButtons,1);
  assert.equal(out.candidateControls.visibleMatchingLinks,1);
  assert.equal(out.candidateControls.hiddenMatchingButtons,1);
  assert.equal(out.visibleButtonProfile.uniqueCandidate,true);
  assert.equal(out.visibleButtonProfile.labelContainsAdmin,true);
  assert.equal(out.visibleButtonProfile.labelContainsLogin,false);
  assert.equal(out.visibleButtonProfile.submitType,false);
  assert.equal(out.visibleButtonProfile.insideForm,false);
  assert.equal(out.loginAttempted,false);
  assert.equal(out.actualAdminEditingVerified,false);
  const safe=JSON.stringify(out);
  assert.equal(safe.includes('Admin access'),false);
  assert.equal(safe.includes('Log in'),false);
  assert.equal(safe.includes('Administrator settings'),false);
  assert.equal(Object.values(out.visibleButtonProfile).every(x=>typeof x==='boolean'),true);
  assert.equal(Object.keys(out.visibleButtonProfile).length,17);
  // Reuse the same synthetic DOM after showing a labelled, focusable
  // password panel; only booleans leave the probe, never label content.
  password.visible=true;
  parent.visible=true;
  password.labels=[{}];
  password.tabIndex=0;
  doc.activeElement=password;
  password.closest=selector=>selector==='[aria-modal="true"]'?{}:null;
  const after=vm.runInNewContext(expression,{document:doc,window:{
    getComputedStyle(el){return {
      display:el.visible?'block':'none',visibility:'visible',opacity:'1'
    };}
  }},{timeout:1000});
  assert.equal(after.passwordVisibleToVisitor,true);
  assert.equal(after.passwordHasProgrammaticLabel,true);
  assert.equal(after.passwordKeyboardFocusable,true);
  assert.equal(after.passwordFocusedAfterOpen,true);
  assert.equal(after.passwordInsideAriaModal,true);
  assert.equal(JSON.stringify(after).includes('Admin access'),false);
});

test('read-only browser audit has no submissions, source-value export or write path',()=>{
  const source=fs.readFileSync(path.join(__dirname,
    '../tools/private-admin-surface-browser-probe.cjs'),'utf8');
  assert.doesNotThrow(()=>new Function('return '+adminSurfaceBrowserProbe()));
  for(const denied of ['fetch(', 'sendBeacon(', 'XMLHttpRequest',
    'writeFileSync(', 'update_ref(', 'create_commit(', 'form.submit(',
    '.click()', '.innerHTML=', 'localStorage.setItem', 'GITHUB_TOKEN'])
    assert.equal(source.includes(denied),false,denied);
  assert.match(source,/loginAttempted:false/);
  assert.match(source,/publicationApproved:false/);
  assert.match(source,/actualAdminEditingVerified:false/);
});
