'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {FORMAT,MAX_RETURN_TABS,RETURN_KEYS,ROUTE_ROOT,ROUTE_PREFIX,adminReturnSnapshot,
  checkReturnSnapshot,summarizeAdminReturn,reviewReturnEnterPreflight}=
  require('../tools/private-admin-return-entry-probe.cjs');
function sample({closed=false,focused=false,privilege=false,
  password='',insideLink=false,ancestorHandler=false,keyboardHandler=false}={}){
  return {
    format:FORMAT,safeReturnUnique:true,returnVisible:!closed,
    returnTabEligible:true,returnFocused:focused&&!closed,
    returnInsideLink:insideLink,
    returnAncestorInlineHandler:ancestorHandler,
    returnOwnKeyboardHandler:keyboardHandler,
    passwordPresent:true,passwordEmpty:password==='',
    passwordVisible:!closed,adminAreaVisible:!closed,
    publicSiteVisible:closed,footerVisible:closed,
    protectedEditorHidden:true,visitorPrivilegeOff:!privilege,
    routeUnchanged:true
  };
}
test('synthetic positive close result requires explicit activation (not a browser action)',()=>{
  for(const width of [390,1440]){
    const a=sample(),b=sample({focused:true}),c=sample({closed:true});
    assert.equal(checkReturnSnapshot(a).passwordEmpty,true);
    assert.equal(checkReturnSnapshot(c,{closed:true}).publicSiteVisible,true);
    const t=summarizeAdminReturn(width,a,b,c,2,{activated:true});
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
  assert.equal(t.activationWithheldForSafety,true);
  assert.equal(t.actualTabReachedReturn,false);
  assert.equal(t.enterOnlyOnVettedReturn,false);
  assert.equal(t.returnRestoredPublicSite,false);
  assert.equal(t.navigationCauseVerified,false);
});
test('non-activating navigation risk flags do not silently trigger a return',()=>{
  const a=sample({insideLink:true,ancestorHandler:true,keyboardHandler:true});
  const b=sample({focused:true,insideLink:true,ancestorHandler:true,keyboardHandler:true});
  const result=summarizeAdminReturn(390,a,b,b,2);
  assert.equal(result.originalReturnInsideLink,true);
  assert.equal(result.originalReturnAncestorInlineHandler,true);
  assert.equal(result.originalReturnOwnKeyboardHandler,true);
  assert.equal(result.navigationCauseVerified,false);
  assert.equal(result.activationWithheldForSafety,true);
  assert.equal(result.enterOnlyOnVettedReturn,false);
});
test('unsafe forged visitor state and failed closure are refused',()=>{
  const a=sample(),b=sample({focused:true});
  for(const item of [
    sample({password:'not-empty'}),sample({privilege:true}),
    {...a,protectedEditorHidden:false},{...a,safeReturnUnique:false},
    {...a,returnVisible:false},{...a,returnTabEligible:false},
    {...a,routeUnchanged:false},{...a,extra:'untrusted'}
  ])assert.throws(()=>checkReturnSnapshot(item),/safeguards|safe open-panel/);
  assert.throws(()=>summarizeAdminReturn(390,a,b,a,2,{activated:true}),/restore/);
  assert.throws(()=>summarizeAdminReturn(390,a,b,sample({closed:true}),0),/Tab reached/);
});
test('only Tab is available for the return probe; no password input',()=>{
  assert.equal(MAX_RETURN_TABS,16);
  assert.deepEqual(Object.keys(RETURN_KEYS),['tab']);
  assert.equal(RETURN_KEYS.tab.windowsVirtualKeyCode,9);
  assert.equal(Object.hasOwn(RETURN_KEYS,'enter'),false);
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
  assert.equal(result.returnInsideLink,false);
  assert.equal(result.returnAncestorInlineHandler,false);
  assert.equal(result.returnOwnKeyboardHandler,false);
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
  const defaultPaused=summarizeAdminReturn(1440,a,b,b,2);
  assert.equal(defaultPaused.activationWithheldForSafety,true);
  assert.equal(defaultPaused.enterOnlyOnVettedReturn,false);
});

test('source-only router explains isolated-root exit redirect without activating a button',()=>{
  // Read the original large source, but execute only its short routing IIFE
  // in a network-free synthetic VM. No original data or source is logged.
  const site=fs.readFileSync(path.resolve(__dirname,'../../site-content.html'),'utf8');
  const closeAt=site.indexOf('function closeAdmin(){');
  assert.ok(closeAt>=0,'original closeAdmin function must exist');
  assert.ok(site.slice(closeAt,closeAt+500).includes('showSection(currentSection);'),
    'original closeAdmin must delegate to showSection');
  const opener='<script id="naxx-multipage-routing-v1">';
  const start=site.indexOf(opener),end=site.indexOf('</script>',start);
  assert.ok(start>=0&&end>start,'the preserved multipage router must exist');
  const router=site.slice(start+opener.length,end);
  assert.ok(router.length<5000,'only a short, known router may enter the VM');
  assert.ok(router.includes('const ROOT = "/Naxxramas-Resource-Hub/";'));
  assert.ok(router.includes('return !rootPath();'));
  assert.ok(router.includes('location.assign(routeUrl(section));'));
  const harness=fs.readFileSync(path.resolve(__dirname,
    '../tools/browser-smoke-complete-site.cjs'),'utf8');
  assert.ok(harness.includes("await send('Page.navigate',{url:origin+'/'});"),
    'the existing isolated test starts at its local / route');
  assert.ok(harness.includes('const returnAfter=selectedReturn;'),
    'the unsafe real-browser return Enter must remain disabled');
  function simulate(pathname){
    let redirected=null,originalCallCount=0;
    const window={showSection(){originalCallCount++;}};
    const location={pathname,search:'',hash:'',
      assign(url){redirected=url;},
      replace(){throw Error('Unexpected synthetic route replace');}};
    vm.runInNewContext(router,{
      window,location,document:{addEventListener(){}},URLSearchParams,
      history:{replaceState(){throw Error('Unexpected synthetic history write');}}
    },{timeout:1000});
    window.showSection('Home');
    return {redirected,originalCallCount};
  }
  assert.deepEqual(simulate('/'),{
    redirected:'/Naxxramas-Resource-Hub/',originalCallCount:0
  });
  assert.deepEqual(simulate('/Naxxramas-Resource-Hub/'),{
    redirected:null,originalCallCount:1
  });
});


test('canonical-prefix Admin return snapshots reject incorrect path, query and unsafe state',()=>{
  assert.equal(ROUTE_ROOT,'/');
  assert.equal(ROUTE_PREFIX,'/Naxxramas-Resource-Hub/');
  for(const invalid of [
    '/Naxxramas-Resource-Hub','/Naxxramas-Resource-Hub/other/',
    '//Naxxramas-Resource-Hub/','/admin/','',null,42
  ])assert.throws(()=>adminReturnSnapshot(invalid),/Unrecognised/);
  function observe(pathname,search='',value='',privileged=false){
    const el=(shown,attrs={})=>({
      nodeType:1,isConnected:true,hidden:false,disabled:false,
      tabIndex:0,form:null,parentElement:null,textContent:'',
      getClientRects(){return shown?[{}]:[];},
      getAttribute(name){return attrs[name]??null;},
      hasAttribute(name){return Object.hasOwn(attrs,name);},
      closest(){return null;}
    });
    const area=el(true),lock=el(true),site=el(false),
      footer=el(false),password=el(true),editor=el(false),
      button=el(true,{onclick:'closeAdmin()'});
    password.type='password';password.value=value;
    button.textContent='Back to Website';
    lock.querySelectorAll=()=>[button];
    const ids={adminArea:area,adminLock:lock,publicSite:site,
      siteFooter:footer,adminPasswordInput:password};
    const document={
      body:{classList:{contains:()=>privileged}},
      getElementById:id=>ids[id]||null,
      querySelector:selector=>selector==='button.wh-pro-admin'?editor:null,
      activeElement:password
    };
    return vm.runInNewContext(adminReturnSnapshot(ROUTE_PREFIX),{
      document,window:{
        location:{pathname,search},
        getComputedStyle:()=>({display:'block',visibility:'visible',opacity:'1'})
      }
    },{timeout:1000});
  }
  const valid=observe(ROUTE_PREFIX);
  assert.equal(valid.routeUnchanged,true);
  assert.equal(checkReturnSnapshot(valid).visitorPrivilegeOff,true);
  for(const invalid of [
    observe('/'),observe('/Naxxramas-Resource-Hub'),
    observe('/Naxxramas-Resource-Hub/other/'),
    observe(ROUTE_PREFIX,'?debug=1'),observe(ROUTE_PREFIX,'','secret'),
    observe(ROUTE_PREFIX,'','',true)
  ])assert.throws(()=>checkReturnSnapshot(invalid),/safeguards/);
  // The previous '/' trial remains pinned to the original synthetic route.
  assert.ok(adminReturnSnapshot().endsWith('("/")'));
});

test('Chrome canonical-root rehearsal is Tab-only and cannot silently dispatch return Enter',()=>{
  const source=fs.readFileSync(path.resolve(__dirname,
    '../tools/browser-smoke-complete-site.cjs'),'utf8');
  assert.match(source,/const adminPrefixedReturnChecks=\[\]/);
  assert.match(source,/Page\.navigate',\{url:origin\+ROUTE_PREFIX\}/);
  assert.match(source,/adminReturnSnapshot\(ROUTE_PREFIX\)/);
  assert.match(source,/const initial=await observePrefixedReturn\(\)/);
  assert.match(source,/adminPrefixedReturnChecks\.push\(safe\)/);
  assert.match(source,/activationWithheldForSafety!==true/);
  assert.match(source,/\{activated:false\}/);
  assert.doesNotMatch(source,/const ev=RETURN_KEYS\.enter/);
  assert.doesNotMatch(source,/returnEnterKeyDown/);
});

test('separate canonical Enter review preflight never activates the original button',()=>{
  const original=sample(),tabReached=sample({focused:true});
  for(const width of [390,1440]){
    const result=reviewReturnEnterPreflight(width,original,tabReached,2,{
      expectedPath:ROUTE_PREFIX,formSubmissions:0,
      nonLocalResponses:0,mainFrameNavigations:0
    });
    assert.equal(result.safeForSeparateOwnerReview,true);
    assert.equal(result.canonicalPublishedPathVerified,true);
    assert.equal(result.originalButtonTabFocused,true);
    assert.equal(result.realReturnEnterDispatched,false);
    assert.equal(result.ownerActivationApproved,false);
    assert.equal(result.originalAdminSaveTested,false);
    assert.equal(result.productionApprovalGranted,false);
    assert.equal(Object.isFrozen(result),true);
  }
  const good={expectedPath:ROUTE_PREFIX,formSubmissions:0,
    nonLocalResponses:0,mainFrameNavigations:0};
  for(const invalid of [
    {},null,{...good,expectedPath:'/'},
    {...good,expectedPath:'/Naxxramas-Resource-Hub'},
    {...good,formSubmissions:1},
    {...good,nonLocalResponses:1},
    {...good,mainFrameNavigations:1},
    {...good,mainFrameNavigations:-1},
    {...good,unexpected:true}
  ])assert.throws(()=>
    reviewReturnEnterPreflight(1440,original,tabReached,2,invalid),
  /preflight refused/);
  assert.throws(()=>
    reviewReturnEnterPreflight(1440,original,original,2,good),
  /preflight requires/);
  assert.throws(()=>
    reviewReturnEnterPreflight(1440,original,tabReached,0,good),
  /Tab reached|preflight requires/);
  for(const bad of [
    sample({focused:true,insideLink:true}),
    sample({focused:true,ancestorHandler:true}),
    sample({focused:true,keyboardHandler:true})
  ])assert.throws(()=>
    reviewReturnEnterPreflight(1440,original,bad,2,good),
  /competing navigation handlers/);
  for(const bad of [
    sample({focused:true,password:'unexpected'}),
    sample({focused:true,privilege:true}),
    {...tabReached,routeUnchanged:false}
  ])assert.throws(()=>
    reviewReturnEnterPreflight(1440,original,bad,2,good),
  /safeguards/);
});

test('isolated Chrome retains separate canonical test evidence without enabling Return Enter',()=>{
  const source=fs.readFileSync(path.resolve(__dirname,
    '../tools/browser-smoke-complete-site.cjs'),'utf8');
  const returnProbe=fs.readFileSync(path.resolve(__dirname,
    '../tools/private-admin-return-entry-probe.cjs'),'utf8');
  assert.match(source,/adminPrefixedReturnChecks:report\.browserInspection\.adminPrefixedReturnChecks/);
  assert.match(source,/adminReturnEnterPreflightChecks:report\.browserInspection\.adminReturnEnterPreflightChecks/);
  assert.match(source,/report\.browserInspection\.adminPrefixedReturnChecks\.length,2/);
  assert.match(source,/report\.browserInspection\.adminReturnEnterPreflightChecks\.length,2/);
  assert.match(source,/Page\.frameNavigated/);
  assert.match(source,/mainFrameNavigations-initialMainFrameNavigations/);
  assert.match(source,/reviewReturnEnterPreflight\(width,initial,focused,tabs,/);
  assert.match(source,/realReturnEnterDispatched!==false/);
  assert.match(source,/ownerActivationApproved!==false/);
  assert.match(returnProbe,/function reviewReturnEnterPreflight/);
  assert.doesNotMatch(source,/const ev=RETURN_KEYS\.enter/);
  assert.doesNotMatch(returnProbe,/Input\.dispatchKeyEvent/);
  assert.deepEqual(Object.keys(RETURN_KEYS),['tab']);
});
