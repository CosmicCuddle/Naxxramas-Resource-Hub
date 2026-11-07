'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {FORMAT,MAX_RETURN_TABS,RETURN_KEYS,adminReturnSnapshot,
  checkReturnSnapshot,summarizeAdminReturn}=require('../tools/private-admin-return-entry-probe.cjs');
function sample({closed=false,focused=false,privilege=false,
  password=''}={}){
  return {
    format:FORMAT,safeReturnUnique:true,returnVisible:!closed,
    returnTabEligible:true,returnFocused:focused&&!closed,
    passwordPresent:true,passwordEmpty:password==='',
    passwordVisible:!closed,adminAreaVisible:!closed,
    publicSiteVisible:closed,footerVisible:closed,
    protectedEditorHidden:true,visitorPrivilegeOff:!privilege,
    routeUnchanged:true
  };
}
test('Tab-reached original Back to Website restores the public view safely',()=>{
  for(const width of [390,1440]){
    const a=sample(),b=sample({focused:true}),c=sample({closed:true});
    assert.equal(checkReturnSnapshot(a).passwordEmpty,true);
    assert.equal(checkReturnSnapshot(c,{closed:true}).publicSiteVisible,true);
    const t=summarizeAdminReturn(width,a,b,c,2);
    assert.equal(t.actualTabReachedReturn,true);
    assert.equal(t.enterOnlyOnVettedReturn,true);
    assert.equal(t.returnRestoredPublicSite,true);
    assert.equal(t.returnHidAdminArea,true);
    assert.equal(t.noPasswordEntered,true);
    assert.equal(t.realOriginalAdminEditingVerified,false);
    assert.equal(Object.isFrozen(t),true);
  }
});
test('no Enter when Tab could not reach return button',()=>{
  const a=sample();
  const t=summarizeAdminReturn(390,a,a,a,MAX_RETURN_TABS);
  assert.equal(t.actualTabReachedReturn,false);
  assert.equal(t.enterOnlyOnVettedReturn,false);
  assert.equal(t.returnRestoredPublicSite,false);
});
test('unsafe forged visitor state and failed closure are refused',()=>{
  const a=sample(),b=sample({focused:true});
  for(const item of [
    sample({password:'not-empty'}),sample({privilege:true}),
    {...a,protectedEditorHidden:false},{...a,safeReturnUnique:false},
    {...a,returnVisible:false},{...a,returnTabEligible:false},
    {...a,routeUnchanged:false},{...a,extra:'untrusted'}
  ])assert.throws(()=>checkReturnSnapshot(item),/safeguards|safe open-panel/);
  assert.throws(()=>summarizeAdminReturn(390,a,b,a,2),/restore/);
  assert.throws(()=>summarizeAdminReturn(390,a,b,sample({closed:true}),0),/Tab reached/);
});
test('only Tab and exact safe Enter are available; no password input',()=>{
  assert.equal(MAX_RETURN_TABS,16);
  assert.deepEqual(Object.keys(RETURN_KEYS),['tab','enter']);
  assert.equal(RETURN_KEYS.tab.windowsVirtualKeyCode,9);
  assert.equal(RETURN_KEYS.enter.windowsVirtualKeyCode,13);
  assert.equal(RETURN_KEYS.enter.text,'\r');
  const src=fs.readFileSync(path.resolve(__dirname,
    '../tools/private-admin-return-entry-probe.cjs'),'utf8');
  for(const forbidden of ['fetch(', 'XMLHttpRequest','sendBeacon(','.click(',
    '.focus(','.submit(','.dispatchEvent(','.requestSubmit(',
    'writeFileSync(', 'localStorage.setItem','GITHUB_TOKEN'])
    assert.equal(src.includes(forbidden),false,forbidden);
  assert.match(src,/closeAdmin\(\)/);
  assert.match(src,/Back to Website/);
});
test('passive browser observer sees only Boolean metadata and never source labels',()=>{
  function elt(name,visible,text=''){
    return {nodeType:1,isConnected:true,hidden:false,disabled:false,
      tabIndex:0,type:name==='INPUT'?'password':undefined,value:'',
      textContent:text,parentElement:null,form:null,
      getClientRects(){return visible?[{}]:[];},
      getAttribute(k){return k==='onclick'&&text==='Back to Website'?'closeAdmin()':null;},
      hasAttribute(){return false;},closest(){return null;},
      querySelectorAll(){return [];}
    };
  }
  const area=elt('DIV',true),lock=elt('DIV',true);
  const site=elt('DIV',false),footer=elt('DIV',false);
  const pass=elt('INPUT',true),editor=elt('BUTTON',false);
  const back=elt('BUTTON',true,'Back to Website');
  lock.querySelectorAll=()=>[back];
  const map={adminArea:area,adminLock:lock,publicSite:site,
    siteFooter:footer,adminPasswordInput:pass};
  const d={body:{classList:{contains:()=>false}},
    getElementById:k=>map[k]||null,querySelector:k=>k==='button.wh-pro-admin'?editor:null,
    activeElement:pass};
  const result=vm.runInNewContext(adminReturnSnapshot(),{
    document:d,window:{location:{pathname:'/',search:''},
      getComputedStyle:()=>({display:'block',visibility:'visible',opacity:'1'})}
  },{timeout:1000});
  assert.equal(result.safeReturnUnique,true);
  assert.equal(result.returnVisible,true);
  assert.equal(result.returnFocused,false);
  assert.equal(result.passwordEmpty,true);
  assert.equal(result.adminAreaVisible,true);
  assert.equal(result.publicSiteVisible,false);
  assert.equal(checkReturnSnapshot(result).safeReturnUnique,true);
  const json=JSON.stringify(result);
  assert.equal(json.includes('Back to Website'),false);
  assert.equal(json.includes('adminPasswordInput'),false);
});
test('Chrome harness uses real Tab but withholds unsafe return Enter',()=>{
  const source=fs.readFileSync(path.resolve(__dirname,
    '../tools/browser-smoke-complete-site.cjs'),'utf8');
  assert.match(source,/const adminReturnChecks=\[\]/);
  assert.match(source,/checkReturnSnapshot/);
  assert.match(source,/summarizeAdminReturn/);
  assert.match(source,/const returnAfter=selectedReturn/);
  assert.match(source,/activated:false/);
  assert.doesNotMatch(source,/const ev=RETURN_KEYS.enter/);
  const a=sample(),b=sample({focused:true});
  const paused=summarizeAdminReturn(390,a,b,b,2,{activated:false});
  assert.equal(paused.actualTabReachedReturn,true);
  assert.equal(paused.enterOnlyOnVettedReturn,false);
  assert.equal(paused.returnRestoredPublicSite,false);
  assert.equal(paused.activationWithheldForSafety,true);
});
