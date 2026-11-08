'use strict';
/*
 * PRIVATE COMPLETE-WEBSITE BROWSER SMOKE — no site publication.
 * A verified Git-commit-bound full-site snapshot is served ONLY to
 * headless Chrome on 127.0.0.1. Every non-local browser request is failed by
 * Chrome DevTools interception; HTTP response CSP blocks frames, forms and
 * external scripts/assets. No login, form click, screenshot, archive or upload.
 * The verified site snapshot and browser profile are destroyed afterward.
 */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const http=require('node:http'),cp=require('node:child_process');
const crypto=require('node:crypto');
const assert=require('node:assert/strict');
const {PAGES,NAV,runs}=require('./plan-page-draft.cjs');
const {bindAtReview}=require('./bind-editor-drafts.cjs');
const {createPagePackage}=require('./package-reviewed-page-update.cjs');
const {createResourcePreview}=require('./package-reviewed-resource-preview.cjs');
const {rehearseCompleteSnapshot}=require('./rehearse-complete-site-snapshot.cjs');
const {layoutProbe}=require('./private-site-layout-probes.cjs');
const {adminGateBrowserProbe}=require('./private-admin-gate-browser-probe.cjs');
const {adminSurfaceBrowserProbe}=require('./private-admin-surface-browser-probe.cjs');
const {adminAccessibilityBrowserProbe}=require('./private-admin-a11y-browser-probe.cjs');
const {KEYS,adminKeyboardStateProbe,validateKeyboardSnapshot,
  summarizeKeyboardTrail}=require('./private-admin-keyboard-browser-probe.cjs');
const {KEYS:ENTRY_KEYS,MAX_TABS,adminKeyboardEntrySnapshot,
  check:checkKeyboardEntry,summarize:summarizeKeyboardEntry}=
  require('./private-admin-keyboard-entry-probe.cjs');
const {MAX_RETURN_TABS,RETURN_KEYS,ROUTE_PREFIX,adminReturnSnapshot,
  checkReturnSnapshot,summarizeAdminReturn,reviewReturnEnterPreflight}=
  require('./private-admin-return-entry-probe.cjs');
const {restoreBrowserProbe}=require('./private-restore-browser-probe.cjs');
const {fileReviewBrowserProbe}=require('./private-restore-file-browser-probe.cjs');
const {folderBrowserProbe}=require('./private-restore-folder-browser-probe.cjs');
const {saveReviewBrowserProbe}=require('./private-save-review-browser-probe.cjs');
const {unifiedBrowserProbe}=require('./private-unified-review-browser-probe.cjs');
const {revisionDemoBrowserProbe}=require('./private-revision-demo-browser-probe.cjs');
const root=path.resolve(__dirname,'..','..');
const BASE='34455f6d901c538e2491a8c16681692e4c02d918b1984d7d0ba081aacb1049e8';
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const CSP=[
  "default-src 'self' data: blob:",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "connect-src 'self'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "media-src 'self' data: blob:",
  "frame-src 'none'",
  "form-action 'none'",
  "object-src 'none'",
  "base-uri 'none'"
].join('; ');
function permittedRequest(url,method,origin){
  try{
    const parsed=new URL(url);
    return parsed.origin===origin && ['GET','HEAD'].includes(method);
  }catch(_){return false;}
}
function mime(file){
  return ({
    '.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8',
    '.css':'text/css; charset=utf-8','.json':'application/json',
    '.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg',
    '.webp':'image/webp','.svg':'image/svg+xml',
    '.woff':'font/woff','.woff2':'font/woff2',
    '.docx':'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  })[path.extname(file).toLowerCase()]||'application/octet-stream';
}
function createHandler(site,metrics){
  return (req,res)=>{
    const method=req.method;
    if(method!=='GET'&&method!=='HEAD'){
      metrics.formSubmissions++;
      res.writeHead(405,{'Allow':'GET, HEAD','Content-Security-Policy':CSP});
      res.end();return;
    }
    let relative;
    try{
      const encoded=new URL(req.url,'http://127.0.0.1').pathname;
      // Original native buttons intentionally navigate to GitHub Pages'
      // repository-prefixed URLs; map ONLY that exact prefix to the same
      // isolated temporary folder, as the existing browser QA does.
      const localRoute=encoded.replace(/^\/Naxxramas-Resource-Hub(?=\/|$)/,'');
      relative=decodeURIComponent(localRoute).replace(/^\/+/,'');
      if(relative.includes('\0')||relative.includes('\\'))throw Error('bad path');
      if(!relative)relative='index.html';
      const target=path.resolve(site,relative);
      if(target!==site&&!target.startsWith(site+path.sep))throw Error('outside');
      let filename=target,stat=fs.lstatSync(filename);
      if(stat.isSymbolicLink())throw Error('symlink');
      if(stat.isDirectory()){
        filename=path.join(filename,'index.html');
        stat=fs.lstatSync(filename);
      }
      if(!stat.isFile()||stat.isSymbolicLink())throw Error('not file');
      const check=path.relative(site,filename).split(path.sep);
      let parent=site;
      for(const segment of check.slice(0,-1)){
        parent=path.join(parent,segment);
        if(fs.lstatSync(parent).isSymbolicLink())throw Error('unsafe parent');
      }
      metrics.localReadRequests++;
      res.writeHead(200,{
        'Content-Type':mime(filename),'Content-Length':stat.size,
        'Content-Security-Policy':CSP,
        'X-Content-Type-Options':'nosniff',
        'Cache-Control':'no-store',
        'Referrer-Policy':'no-referrer'
      });
      if(method==='HEAD'){res.end();return;}
      fs.createReadStream(filename).pipe(res);
    }catch(_){
      res.writeHead(404,{'Content-Security-Policy':CSP});
      res.end('Not found');
    }
  };
}
function browserBinary(){
  for(const name of ['google-chrome','google-chrome-stable','chromium','chromium-browser']){
    const found=cp.spawnSync('which',[name],{encoding:'utf8'});
    if(found.status===0)return found.stdout.trim();
  }
  throw Error('Chrome or Chromium not available: complete-site browser check cannot run.');
}
function browserProbe(page){
  // Return only booleans to the test process; never log original resource text.
  return '(()=>{const d=document,body=d.body,nav=d.getElementById("mainNav"),'
    +'mobile=d.getElementById("mobileNav"),grid=d.getElementById("resourceGrid");'
    +'const label=!!nav&&Array.from(nav.querySelectorAll("button")).some(b=>'
    +'b.textContent.includes("Browser Preview Server Rules"));'
    +'const common=!!grid&&!!nav&&!!mobile&&label;'
    +'const article=d.querySelector("[data-naxx-guide-content=\\""+'+JSON.stringify(page)+'+"\\"]");'
    +'const guide=d.getElementById("naxx-game-client-guide");'
    +'const checks={nativeSite:common,rootLoaderRetained:!!d.getElementById("sectionHeading")};'
    +'if('+JSON.stringify(page)+'==="home"){checks.homeSection=!!nav.querySelector("button[data-section=\\"Home\\"]");'
    +'checks.resourceGrid=!!grid;checks.originalSearch=!!d.getElementById("searchInput");}'
    +'if('+JSON.stringify(page)+'==="new-players"){checks.editedPageText=!!article&&article.textContent.includes("Browser-only private changed guide text.");'
    +'checks.guidePresent=!!article;}'
    +'if('+JSON.stringify(page)+'==="rules"){checks.allTwelveRules=!!article&&article.querySelectorAll(".naxx-guide-rule").length===12;}'
    +'if('+JSON.stringify(page)+'==="apply"){checks.applicationNotice=!!article&&article.textContent.includes("Applications are open.");'
    +'checks.privacyPanel=!!article&&!!article.querySelector("#privacy");'
    +'checks.externalFrameNotLoaded=!!article&&!!article.querySelector("iframe[data-tally-src]");}'
    +'if('+JSON.stringify(page)+'==="clients"){checks.guidePresent=!!guide&&guide.querySelectorAll(".naxx-client-download-card").length===2;}'
    +'return {checks,ready:Object.values(checks).every(Boolean),loaded:!!body&&d.readyState!=="loading"};})()';
}
async function inspectBrowser(site,work){
  const metrics={localReadRequests:0,formSubmissions:0,nonLocalResponses:0,
    rejectedExternalRequests:0};
  const server=http.createServer(createHandler(site,metrics));
  await new Promise((resolve,reject)=>{
    server.once('error',reject);
    server.listen(0,'127.0.0.1',resolve);
  });
  const origin='http://127.0.0.1:'+server.address().port;
  let chrome=null,socket=null;
  const profile=path.join(work,'chrome-profile');
  fs.mkdirSync(profile,{mode:0o700});
  let lastError='';
  try{
    chrome=cp.spawn(browserBinary(),[
      '--headless=new','--no-sandbox','--disable-gpu',
      '--disable-dev-shm-usage','--disable-extensions',
      '--disable-background-networking','--no-first-run',
      '--no-default-browser-check','--disable-sync',
      '--disable-component-update','--disable-features=DnsOverHttps,MediaRouter',
      '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1',
      '--remote-allow-origins=*','--remote-debugging-port=0',
      '--user-data-dir='+profile,'--window-size=1440,900',
      'about:blank'
    ],{stdio:['ignore','ignore','pipe']});
    chrome.stderr.on('data',chunk=>{lastError=(lastError+String(chunk)).slice(-350);});
    let port;
    for(let attempt=0;attempt<100;attempt++){
      const active=path.join(profile,'DevToolsActivePort');
      if(fs.existsSync(active)){
        port=Number(fs.readFileSync(active,'utf8').split('\n')[0]);break;
      }
      if(chrome.exitCode!==null)break;
      await delay(150);
    }
    if(!port)throw Error('Chrome debugging endpoint unavailable. '+lastError);
    let page;
    for(let attempt=0;attempt<80;attempt++){
      try{
        const items=await fetch('http://127.0.0.1:'+port+'/json/list').then(r=>r.json());
        page=items.find(x=>x.type==='page'&&x.webSocketDebuggerUrl);
        if(page)break;
      }catch(_){}
      await delay(120);
    }
    if(!page)throw Error('Chrome private page unavailable.');
    socket=new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve,reject)=>{
      socket.addEventListener('open',resolve,{once:true});
      socket.addEventListener('error',reject,{once:true});
    });
    const pending=new Map();let next=0;
    function send(method,params={}){
      return new Promise((resolve,reject)=>{
        const id=++next;
        const timer=setTimeout(()=>{
          pending.delete(id);reject(Error('Chrome response timed out: '+method));
        },30000);
        pending.set(id,{resolve,reject,timer});
        socket.send(JSON.stringify({id,method,params}));
      });
    }
    let eventError=null,mainFrameNavigations=0;
    socket.addEventListener('message',e=>{
      let x;try{x=JSON.parse(e.data);}catch(_){return;}
      if(x.id&&pending.has(x.id)){
        const wait=pending.get(x.id);pending.delete(x.id);
        clearTimeout(wait.timer);
        if(x.error)wait.reject(Error('Browser protocol rejected '+x.error.message));
        else wait.resolve(x.result);
        return;
      }
      if(x.method==='Page.frameNavigated'&&!x.params?.frame?.parentId)
        mainFrameNavigations++;
      if(x.method==='Network.responseReceived'){
        // data:/blob:/about: are self-contained browser resources, not
        // network responses. Count any real HTTP(S) reply from another
        // origin, and any unexpected file: reply, as a release-blocker.
        const responseUrl=x.params.response.url;
        let parsed;
        try{parsed=new URL(responseUrl);}catch(_){metrics.nonLocalResponses++;return;}
        if(['http:','https:','file:'].includes(parsed.protocol)&&
           parsed.origin!==origin)
          metrics.nonLocalResponses++;
      }
      if(x.method==='Fetch.requestPaused'){
        const request=x.params.request,allow=permittedRequest(request.url,request.method,origin);
        if(!allow)metrics.rejectedExternalRequests++;
        send(allow?'Fetch.continueRequest':'Fetch.failRequest',
          allow?{requestId:x.params.requestId}:
            {requestId:x.params.requestId,errorReason:'BlockedByClient'})
          .catch(err=>{eventError=err;});
      }
    });
    await send('Page.enable');
    await send('Runtime.enable');
    await send('Network.enable');
    await send('Fetch.enable',{patterns:[{urlPattern:'*',requestStage:'Request'}]});
    const checks=[];
    for(const scenario of [
      {page:'home',route:'/',width:1440},
      {page:'home',route:'/',width:390},
      {page:'new-players',route:'/new-players/',width:1440},
      {page:'new-players',route:'/new-players/',width:390},
      {page:'rules',route:'/rules/',width:1440},
      {page:'rules',route:'/rules/',width:390},
      {page:'apply',route:'/apply/',width:1440},
      {page:'apply',route:'/apply/',width:390},
      {page:'clients',route:'/',width:1440},
      {page:'clients',route:'/',width:390}
    ]){
      await send('Emulation.setDeviceMetricsOverride',{
        width:scenario.width,height:900,deviceScaleFactor:1,mobile:scenario.width<500
      });
      await send('Page.navigate',{url:origin+scenario.route});
      // Native Game Clients is a section inside the original website, not
      // one of the new standalone routes. Exercise the actual native button,
      // rather than assuming the query parameter selected that section.
      if(scenario.page==='clients'){
        let buttonReady=false;
        for(let n=0;n<100;n++){
          const target=await send('Runtime.evaluate',{
            expression:'location.pathname==="/" && location.search==="" && document.readyState==="complete" && !!document.getElementById("resourceGrid") && Array.from(document.querySelectorAll("#mainNav button")).some(x=>x.textContent.includes("Browser Preview Server Rules")) && !!document.querySelector("#mainNav button[data-section=\\\"Game Clients\\\"]")',
            returnByValue:true
          });
          if(target.result?.value){buttonReady=true;break;}
          await delay(150);
        }
        if(!buttonReady)throw Error('Original Game Clients navigation control missing.');
        const clicked=await send('Runtime.evaluate',{
          expression:'(()=>{const b=document.querySelector("#mainNav button[data-section=\\\"Game Clients\\\"]");b.click();return true;})()',
          returnByValue:true
        });
        if(clicked.exceptionDetails||clicked.result?.value!==true)
          throw Error('Native Game Clients navigation failed to activate.');
      }
      let last=null;
      for(let attempt=0;attempt<120;attempt++){
        if(eventError)throw eventError;
        try{
          const result=await send('Runtime.evaluate',{
            expression:browserProbe(scenario.page),returnByValue:true
          });
          if(result.exceptionDetails)throw Error('Website browser probe failed.');
          last=result.result?.value;
          if(last?.ready)break;
        }catch(err){
          if(attempt>115)throw err;
        }
        await delay(180);
      }
      if(!last?.ready){
        const failed=Object.keys(last?.checks||{}).filter(k=>!last.checks[k]);
        // Metadata-only diagnostics; never capture website text or visitor data.
        const debug=await send('Runtime.evaluate',{
          expression:'({pathname:location.pathname,search:location.search,ready:document.readyState,grid:!!document.getElementById("resourceGrid"),heading:!!document.getElementById("sectionHeading"),navButtons:document.querySelectorAll("#mainNav button").length,loading:!!document.querySelector(".naxx-loading"),clientGuide:!!document.getElementById("naxx-game-client-guide")})',
          returnByValue:true
        });
        throw Error('Private '+scenario.page+' browser checks did not pass: '+
          failed.join(', ')+'; state='+JSON.stringify(debug.result?.value)+
          '; localReads='+metrics.localReadRequests+
          '; blocked='+metrics.rejectedExternalRequests);
      }
      // Inert geometry, native admin-controls and CSS-only visitor/admin
      // checks. A false result fails closed; no login or content dump.
      const layout=await send('Runtime.evaluate',{
        expression:layoutProbe(scenario.page),returnByValue:true
      });
      if(layout.exceptionDetails)throw Error('Private layout probe failed.');
      const measured=layout.result?.value;
      if(!measured?.ready){
        const failed=Object.keys(measured?.checks||{}).filter(k=>!measured.checks[k]);
        throw Error('Private '+scenario.page+' '+scenario.width+
          'px layout/admin checks did not pass: '+failed.join(', '));
      }
      checks.push({route:scenario.page,width:scenario.width,
        functionalChecks:Object.keys(last.checks).length,
        layoutAdminChecks:Object.keys(measured.checks).length});
    }
    // Discover the original visitor-visible admin entry without forcing
    // hidden .wh-pro-admin editing controls. Diagnostic-only: a missing
    // unambiguous login trigger remains UNVERIFIED, not a false pass.
    // No passwords, login submission or real website writes are attempted.
    const adminGateChecks=[];
    const adminSurfaceChecks=[];
    const adminAccessibilityChecks=[];
    const adminKeyboardChecks=[];
    const adminReturnChecks=[];
    const adminPrefixedReturnChecks=[];
    const adminReturnEnterPreflightChecks=[];
    for(const width of [1440,390]){
      await send('Emulation.setDeviceMetricsOverride',{
        width,height:900,deviceScaleFactor:1,mobile:width<500
      });
      await send('Page.navigate',{url:origin+'/'});
      let available=false;
      for(let n=0;n<120;n++){
        const state=await send('Runtime.evaluate',{
          expression:'document.readyState==="complete" && !!document.querySelector("button.wh-pro-admin") && !!document.getElementById("adminPasswordInput") && !!document.getElementById("resourceGrid")',
          returnByValue:true
        });
        if(state.result?.value){available=true;break;}
        await delay(150);
      }
      if(!available)throw Error('Original admin entry did not load in the private browser.');
      const response=await send('Runtime.evaluate',{
        expression:adminGateBrowserProbe(),awaitPromise:true,returnByValue:true
      });
      if(response.exceptionDetails)throw Error('Original no-login admin probe crashed.');
      const measured=response.result?.value;
      if(!measured?.ready){
        const failed=Object.keys(measured?.checks||{}).filter(k=>!measured.checks[k]);
        throw Error('Private no-login admin gate '+width+
          'px failed: '+failed.join(', '));
      }
      // Confirmed on the original desktop AND mobile snapshot at 9f86f775:
      // opening the genuine visitor Admin entry must reveal the password
      // panel, without credential input or privilege escalation. Treat loss
      // of this existing behaviour as a regression, not a successful probe.
      if(measured.unambiguousEntryFound!==true||
         measured.gateOpened!==true||
         measured.loginAttempted!==false||
         measured.actualAdminEditingVerified!==false)
        throw Error('Original admin password entry regression at '+width+'px.');
      adminGateChecks.push({width,checks:Object.keys(measured.checks).length,
        visibleEntryFound:measured.unambiguousEntryFound===true,
        passwordGateOpened:measured.gateOpened===true,
        actualAdminEditingVerified:false,loginAttempted:false});
      // Read-only topology audit after the no-login discovery. No labels,
      // private strings, HTML, passwords or user values leave Chrome.
      const inventory=await send('Runtime.evaluate',{
        expression:adminSurfaceBrowserProbe(),returnByValue:true
      });
      if(inventory.exceptionDetails)throw Error('Admin surface inventory crashed.');
      const info=inventory.result?.value;
      if(!info||info.format!=='naxx-private-admin-surface-inventory-v1'||
        info.pageReady!==true||info.passwordFieldPresent!==true||
        info.editorControlPresent!==true||info.loginAttempted!==false||
        info.formSubmitted!==false||info.domModified!==false||
        info.actualAdminEditingVerified!==false||
        info.publicationApproved!==false||
        !info.candidateControls||
        Object.values(info.candidateControls).some(n=>
          !Number.isSafeInteger(n)||n<0||n>10000)||
        !info.visibleButtonProfile||
        Object.keys(info.visibleButtonProfile).length!==17||
        Object.values(info.visibleButtonProfile).some(x=>typeof x!=='boolean')||
        ['passwordHasProgrammaticLabel','passwordKeyboardFocusable',
         'passwordFocusedAfterOpen','passwordInsideAriaModal'].some(key=>
           typeof info[key]!=='boolean'))
        throw Error('Admin surface inventory did not meet read-only integrity conditions.');
      adminSurfaceChecks.push({width,
        editorControlVisibleToVisitor:info.editorControlVisibleToVisitor,
        passwordVisibleToVisitor:info.passwordVisibleToVisitor,
        passwordInsideForm:info.passwordInsideForm,
        passwordInsideDialog:info.passwordInsideDialog,
        passwordHasProgrammaticLabel:info.passwordHasProgrammaticLabel,
        passwordKeyboardFocusable:info.passwordKeyboardFocusable,
        passwordFocusedAfterOpen:info.passwordFocusedAfterOpen,
        passwordInsideAriaModal:info.passwordInsideAriaModal,
        passwordHasAdminNamedAncestor:info.passwordHasAdminNamedAncestor,
        passwordHasModalNamedAncestor:info.passwordHasModalNamedAncestor,
        candidateControls:info.candidateControls,
        visibleButtonProfile:info.visibleButtonProfile,
        inlineScriptBlocks:info.inlineScriptBlocks,
        inlineScriptsMentioningPassword:info.inlineScriptsMentioningPassword,
        inlineScriptsMentioningEditorControl:info.inlineScriptsMentioningEditorControl,
        actualAdminEditingVerified:false});
      // Passive keyboard and small-screen diagnostics. This probe does not
      // click, focus, type, submit, send keys or exercise credentials.
      const a11y=await send('Runtime.evaluate',{
        expression:adminAccessibilityBrowserProbe(),returnByValue:true
      });
      if(a11y.exceptionDetails)
        throw Error('Passive original Admin accessibility probe crashed.');
      const report=a11y.result?.value;
      if(!report||report.format!=='naxx-private-admin-a11y-diagnostics-v1'||
         report.viewportClass!==(width<500?'mobile':'desktop')||
         report.structuralSafety!==true||
         !report.diagnostics||
         Object.keys(report.diagnostics).length!==15||
         Object.values(report.diagnostics).some(v=>typeof v!=='boolean')||
         !Number.isSafeInteger(report.visibleTabStopsNearPassword)||
         report.visibleTabStopsNearPassword<0||
         report.visibleTabStopsNearPassword>300||
         !Number.isSafeInteger(report.visibleCloseControls)||
         report.visibleCloseControls<0||report.visibleCloseControls>300||
         ['keyboardNavigationActuallyDispatched',
          'escapeDismissalActuallyTested',
          'completeWCAGConformanceVerified','ownerAdminAcceptanceVerified',
          'loginAttempted','credentialsCollected','formSubmitted',
          'domModified','externalRequestsMade','publicationApproved']
            .some(name=>report[name]!==false))
        throw Error('Original Admin accessibility inventory violated safety bounds.');
      adminAccessibilityChecks.push({width,
        diagnostics:report.diagnostics,
        visibleTabStopsNearPassword:report.visibleTabStopsNearPassword,
        visibleCloseControls:report.visibleCloseControls,
        actualKeyboardTestPerformed:false,
        completeWCAGConformanceVerified:false,ownerAdminAcceptanceVerified:false});

      // Only three non-submitting keyboard actions, after the genuine
      // visitor entry was safely opened on the disposable website. This is
      // an actual Chrome DevTools keyboard trail, not scripted DOM focus.
      async function observeAdminKeyboard(initial){
        const response=await send('Runtime.evaluate',{
          expression:adminKeyboardStateProbe(),returnByValue:true
        });
        if(response.exceptionDetails)
          throw Error('Original Admin keyboard observation could not run.');
        return validateKeyboardSnapshot(response.result?.value,{initial});
      }
      const keyBefore=await observeAdminKeyboard(true);
      const keyAfter=[];
      for(const action of KEYS){
        const props={
          key:action.key,code:action.code,
          windowsVirtualKeyCode:action.windowsVirtualKeyCode,
          nativeVirtualKeyCode:action.nativeVirtualKeyCode,
          modifiers:action.modifiers
        };
        // No text, Enter, Space, mouse activation or form submission.
        await send('Input.dispatchKeyEvent',{type:'rawKeyDown',...props});
        await send('Input.dispatchKeyEvent',{type:'keyUp',...props});
        await delay(90);
        keyAfter.push(await observeAdminKeyboard(false));
      }
      if(keyAfter.length!==3||metrics.formSubmissions!==0||
         metrics.nonLocalResponses!==0)
        throw Error('Private Admin keyboard inspection violated isolation.');
      const trail=summarizeKeyboardTrail(width,keyBefore,...keyAfter);
      adminKeyboardChecks.push(trail);
      // Original locked Admin view has a vetted non-form "Back to Website"
      // closeAdmin() control. Diagnose Tab reachability ONLY: a previous
      // real Enter trial unexpectedly navigated. Never activate this exit
      // or the adjacent Unlock Admin control pending investigation.
      async function observeReturn(closed=false){
        const result=await send('Runtime.evaluate',{
          expression:adminReturnSnapshot(),returnByValue:true
        });
        if(result.exceptionDetails)
          throw Error('Original Admin return observation crashed.');
        return checkReturnSnapshot(result.result?.value,{closed});
      }
      const returnStart=await observeReturn(false);
      let selectedReturn=returnStart,returnTabs=0;
      for(let n=0;n<MAX_RETURN_TABS&&!selectedReturn.returnFocused;n++){
        const ev=RETURN_KEYS.tab;
        const props={key:ev.key,code:ev.code,
          windowsVirtualKeyCode:ev.windowsVirtualKeyCode,
          nativeVirtualKeyCode:ev.nativeVirtualKeyCode,
          modifiers:ev.modifiers};
        await send('Input.dispatchKeyEvent',{type:'rawKeyDown',...props});
        await send('Input.dispatchKeyEvent',{type:'keyUp',...props});
        returnTabs++;
        selectedReturn=await observeReturn(false);
      }
      // The prior Enter trial unexpectedly changed the original-page
      // route. Withhold activation until this isolated transition has
      // been explained. Real Tab discovery alone cannot grant acceptance.
      const returnAfter=selectedReturn;
      if(metrics.formSubmissions!==0||metrics.nonLocalResponses!==0)
        throw Error('Private Admin return test escaped browser isolation.');
      adminReturnChecks.push(summarizeAdminReturn(width,
        returnStart,selectedReturn,returnAfter,returnTabs,{activated:false}));
    }
    // Separate canonical-prefix rehearsal. The original source router
    // expects /Naxxramas-Resource-Hub/; our earlier synthetic '/' route
    // was not equivalent. This trial never activates Back to Website.
    // Keep the existing '/' trial intact, and validate the fixed canonical
    // pathname before and after the safe visitor entry and real Tab keys.
    for(const width of [1440,390]){
      await send('Emulation.setDeviceMetricsOverride',{
        width,height:900,deviceScaleFactor:1,mobile:width<500
      });
      await send('Page.navigate',{url:origin+ROUTE_PREFIX});
      let ready=false;
      for(let n=0;n<120;n++){
        const state=await send('Runtime.evaluate',{
          expression:'document.readyState==="complete" && location.pathname==="/Naxxramas-Resource-Hub/" && location.search==="" && !!document.querySelector("button.wh-pro-admin") && !!document.getElementById("adminPasswordInput") && !!document.getElementById("resourceGrid")',
          returnByValue:true
        });
        if(state.result?.value){ready=true;break;}
        await delay(150);
      }
      if(!ready)throw Error('Canonical-prefix Admin rehearsal did not load its original page.');
      const opened=await send('Runtime.evaluate',{
        expression:adminGateBrowserProbe(),awaitPromise:true,returnByValue:true
      });
      if(opened.exceptionDetails)
        throw Error('Canonical-prefix visitor-only gate observer crashed.');
      const gate=opened.result?.value;
      if(gate?.ready!==true||gate?.unambiguousEntryFound!==true||
         gate?.gateOpened!==true||gate?.loginAttempted!==false||
         gate?.actualAdminEditingVerified!==false||
         gate?.editorControlVisibleToVisitor!==false)
        throw Error('Canonical-prefix visitor gate did not pass strict original checks.');
      async function observePrefixedReturn(){
        const result=await send('Runtime.evaluate',{
          expression:adminReturnSnapshot(ROUTE_PREFIX),returnByValue:true
        });
        if(result.exceptionDetails)
          throw Error('Canonical-prefix Admin return observation crashed.');
        return checkReturnSnapshot(result.result?.value);
      }
      const initial=await observePrefixedReturn();
      const initialMainFrameNavigations=mainFrameNavigations;
      let focused=initial,tabs=0;
      while(!focused.returnFocused&&tabs<MAX_RETURN_TABS){
        const ev=RETURN_KEYS.tab;
        const props={
          key:ev.key,code:ev.code,windowsVirtualKeyCode:ev.windowsVirtualKeyCode,
          nativeVirtualKeyCode:ev.nativeVirtualKeyCode,modifiers:ev.modifiers
        };
        await send('Input.dispatchKeyEvent',{type:'rawKeyDown',...props});
        await send('Input.dispatchKeyEvent',{type:'keyUp',...props});
        tabs++;
        focused=await observePrefixedReturn();
      }
      if(!focused.returnFocused||metrics.formSubmissions!==0||
         metrics.nonLocalResponses!==0)
        throw Error('Canonical-prefix Admin return failed focus or browser isolation.');
      const safe=summarizeAdminReturn(width,initial,focused,focused,tabs,
        {activated:false});
      if(safe.actualTabReachedReturn!==true||
         safe.activationWithheldForSafety!==true||
         safe.enterOnlyOnVettedReturn!==false||
         safe.noPasswordEntered!==true||
         safe.visitorPrivilegeNeverEnabled!==true)
        throw Error('Canonical-prefix Admin return produced an unsafe trail.');
      adminPrefixedReturnChecks.push(safe);
      // Strict passive preflight for a *future, separately authorised*
      // Enter activation. This only checks the real Tab trail and traffic;
      // no Enter key or original Admin editing action is dispatched.
      const preflight=reviewReturnEnterPreflight(width,initial,focused,tabs,{
        expectedPath:ROUTE_PREFIX,
        formSubmissions:metrics.formSubmissions,
        nonLocalResponses:metrics.nonLocalResponses,
        mainFrameNavigations:mainFrameNavigations-initialMainFrameNavigations
      });
      if(preflight.safeForSeparateOwnerReview!==true||
         preflight.realReturnEnterDispatched!==false||
         preflight.ownerActivationApproved!==false||
         preflight.productionApprovalGranted!==false)
        throw Error('Original return Enter preflight produced an unsafe approval state.');
      adminReturnEnterPreflightChecks.push(preflight);
    }
    // A SECOND, independent trial starts with the original login CLOSED,
    // reloading the disposable home page before any key is sent. Only Tab
    // can discover a unique safe entry; Enter is allowed ONLY when actual
    // Chrome keyboard focus reaches that already vetted visitor button.
    // Do not substitute programmatic .focus() for genuine Tab navigation.
    const adminKeyboardEntryChecks=[];
    for(const width of [1440,390]){
      await send('Emulation.setDeviceMetricsOverride',{
        width,height:900,deviceScaleFactor:1,mobile:width<500
      });
      await send('Page.navigate',{url:origin+'/'});
      let ready=false;
      for(let n=0;n<120;n++){
        const r=await send('Runtime.evaluate',{
          expression:'document.readyState==="complete" && !!document.querySelector("button.wh-pro-admin") && !!document.getElementById("adminPasswordInput") && !!document.getElementById("resourceGrid")',
          returnByValue:true
        });
        if(r.result?.value){ready=true;break;}
        await delay(150);
      }
      if(!ready)
        throw Error('Private keyboard-only Admin entry page did not load.');
      async function observeEntry(initial,afterActivation=false){
        const r=await send('Runtime.evaluate',{
          expression:adminKeyboardEntrySnapshot(),returnByValue:true
        });
        if(r.exceptionDetails)
          throw Error('Private keyboard-only Admin entry snapshot crashed.');
        return checkKeyboardEntry(r.result?.value,{initial,afterActivation});
      }
      const start=await observeEntry(true);
      let selected=start,tabs=0;
      if(start.entryEligibleForTab){
        for(let n=0;n<MAX_TABS&&!selected.entryFocused;n++){
          const event=ENTRY_KEYS.tab;
          await send('Input.dispatchKeyEvent',{
            type:'rawKeyDown',key:event.key,code:event.code,
            windowsVirtualKeyCode:event.windowsVirtualKeyCode,
            nativeVirtualKeyCode:event.nativeVirtualKeyCode,
            modifiers:event.modifiers
          });
          await send('Input.dispatchKeyEvent',{
            type:'keyUp',key:event.key,code:event.code,
            windowsVirtualKeyCode:event.windowsVirtualKeyCode,
            nativeVirtualKeyCode:event.nativeVirtualKeyCode,
            modifiers:event.modifiers
          });
          tabs++;
          selected=await observeEntry(false);
        }
      }else{
        // A Tab-ineligible visitor entry cannot be activated. Record
        // zero actual key dispatches; never fake a full Tab scan.
        tabs=0;
      }
      let opened=selected;
      if(selected.entryFocused&&tabs===0)
        throw Error('Visitor Admin entry focus was not reached by a Tab key.');
      if(selected.passwordVisible)
        throw Error('Original password panel opened unexpectedly during Tab search.');
      if(selected.entryFocused&&tabs>0){
        const event=ENTRY_KEYS.enter;
        const props={key:event.key,code:event.code,
          windowsVirtualKeyCode:event.windowsVirtualKeyCode,
          nativeVirtualKeyCode:event.nativeVirtualKeyCode,
          modifiers:event.modifiers
        };
        // Chrome's normal keyboard Enter uses keyDown with a CR
        // control character. RawKeyDown without text does NOT reliably
        // activate native buttons; do not mistake that for a UI defect.
        // This is not a password or printable user input.
        if(event.text!=='\r'||event.unmodifiedText!=='\r')
          throw Error('Untrusted visitor-only Enter event configuration.');
        await send('Input.dispatchKeyEvent',{
          type:'keyDown',...props,
          text:event.text,unmodifiedText:event.unmodifiedText
        });
        await send('Input.dispatchKeyEvent',{type:'keyUp',...props});
        await delay(150);
        opened=await observeEntry(false,true);
      }
      if(metrics.formSubmissions!==0||metrics.nonLocalResponses!==0)
        throw Error('Private Admin entry keyboard trial escaped isolation.');
      adminKeyboardEntryChecks.push(
        summarizeKeyboardEntry(width,start,selected,opened,tabs));
    }
    // Four fictional conflict examples at two screen widths, served only
    // from the same temporary copy. This page has no source import/save
    // controls, and the private browser blocks all external connections.
    const restorePreflightExamples=[];
    for(const width of [1440,390]){
      await send('Emulation.setDeviceMetricsOverride',{
        width,height:900,deviceScaleFactor:1,mobile:width<500
      });
      await send('Page.navigate',{url:origin+'/editor/restore-preflight-preview.html'});
      let ready=false;
      for(let attempt=0;attempt<100;attempt++){
        const state=await send('Runtime.evaluate',{
          expression:"document.documentElement.dataset.previewReady==='true' && !!document.getElementById('result')",
          returnByValue:true
        });
        if(state.result?.value){ready=true;break;}
        await delay(120);
      }
      if(!ready)throw Error('Private restore conflict preview did not initialize.');
      const result=await send('Runtime.evaluate',{
        expression:restoreBrowserProbe(),returnByValue:true
      });
      if(result.exceptionDetails)throw Error('Private restore preview browser probe failed.');
      const inspected=result.result?.value;
      if(!inspected?.ready){
        const failed=Object.keys(inspected?.checks||{}).filter(k=>!inspected.checks[k]);
        throw Error('Private restore preview '+width+'px did not pass: '+failed.join(', '));
      }
      restorePreflightExamples.push({width,checks:Object.keys(inspected.checks).length});
    }
    // Real File API selection of synthetic JSON only. No original content
    // or user files; the read-only page cannot save, submit or publish.
    const restoreFileChecks=[];
    for(const width of [1440,390]){
      await send('Emulation.setDeviceMetricsOverride',{
        width,height:900,deviceScaleFactor:1,mobile:width<500
      });
      await send('Page.navigate',{url:origin+'/editor/restore-file-check.html'});
      let loaded=false;
      for(let attempt=0;attempt<100;attempt++){
        const state=await send('Runtime.evaluate',{
          expression:"document.documentElement.dataset.localFileReviewReady==='true'",
          returnByValue:true
        });
        if(state.result?.value){loaded=true;break;}
        await delay(120);
      }
      if(!loaded)throw Error('Private JSON file preflight did not initialize.');
      const tested=await send('Runtime.evaluate',{
        expression:fileReviewBrowserProbe(),awaitPromise:true,returnByValue:true
      });
      if(tested.exceptionDetails)throw Error('Private JSON file browser probe failed.');
      const checked=tested.result?.value;
      if(!checked?.ready){
        const failed=Object.keys(checked?.checks||{}).filter(k=>!checked.checks[k]);
        throw Error('Private JSON file review '+width+'px failed: '+failed.join(', '));
      }
      restoreFileChecks.push({width,checks:Object.keys(checked.checks).length});
    }
    // Experimental directory-picker integrity check with 414 synthetic
    // File objects (never actual user content or website source fragments).
    const restoreFolderChecks=[];
    for(const width of [1440,390]){
      await send('Emulation.setDeviceMetricsOverride',{
        width,height:900,deviceScaleFactor:1,mobile:width<500
      });
      await send('Page.navigate',{url:origin+'/editor/restore-folder-check.html'});
      let ready=false;
      for(let attempt=0;attempt<100;attempt++){
        const probe=await send('Runtime.evaluate',{
          expression:"document.documentElement.dataset.privateFolderReady==='true'",
          returnByValue:true
        });
        if(probe.result?.value){ready=true;break;}
        await delay(120);
      }
      if(!ready)throw Error('Private resource folder screen did not initialize.');
      const looked=await send('Runtime.evaluate',{
        expression:folderBrowserProbe(),awaitPromise:true,returnByValue:true
      });
      if(looked.exceptionDetails)throw Error('Private synthetic folder browser probe failed.');
      const measured=looked.result?.value;
      if(!measured?.ready){
        const failed=Object.keys(measured?.checks||{}).filter(k=>!measured.checks[k]);
        throw Error('Private resource folder '+width+'px failed: '+failed.join(', '));
      }
      restoreFolderChecks.push({width,checks:Object.keys(measured.checks).length});
    }
    // A separate, read-only owner's proposed-file review screen.
    // Every File and fixture is fictional. No real Save or GitHub writes.
    const saveReviewChecks=[];
    for(const width of [1440,390]){
      await send('Emulation.setDeviceMetricsOverride',{
        width,height:900,deviceScaleFactor:1,mobile:width<500
      });
      await send('Page.navigate',{url:origin+'/editor/save-review-preview.html'});
      let ready=false;
      for(let n=0;n<100;n++){
        const state=await send('Runtime.evaluate',{
          expression:"document.documentElement.dataset.privateSaveReviewReady==='true'",
          returnByValue:true
        });
        if(state.result?.value){ready=true;break;}
        await delay(120);
      }
      if(!ready)throw Error('Read-only save review screen failed to initialize.');
      const looked=await send('Runtime.evaluate',{
        expression:saveReviewBrowserProbe(),awaitPromise:true,returnByValue:true
      });
      if(looked.exceptionDetails)throw Error('Save review browser probe crashed.');
      const measured=looked.result?.value;
      if(!measured?.ready){
        const failed=Object.keys(measured?.checks||{}).filter(k=>!measured.checks[k]);
        throw Error('Read-only Save review '+width+'px failed: '+failed.join(', '));
      }
      saveReviewChecks.push({width,checks:Object.keys(measured.checks).length});
    }
    // Read-only review of the independent page/navigation and resource
    // metadata receipt, using fictional browser inputs at desktop/mobile.
    const unifiedReviewChecks=[];
    for(const width of [1440,390]){
      await send('Emulation.setDeviceMetricsOverride',{
        width,height:900,deviceScaleFactor:1,mobile:width<500
      });
      await send('Page.navigate',{url:origin+'/editor/unified-review-preview.html'});
      let ready=false;
      for(let i=0;i<100;i++){
        const current=await send('Runtime.evaluate',{
          expression:"document.documentElement.dataset.privateUnifiedReviewReady==='true'",
          returnByValue:true
        });
        if(current.result?.value){ready=true;break;}
        await delay(120);
      }
      if(!ready)throw Error('Read-only unified review screen failed to initialize.');
      const outcome=await send('Runtime.evaluate',{
        expression:unifiedBrowserProbe(),awaitPromise:true,returnByValue:true
      });
      if(outcome.exceptionDetails)throw Error('Unified review browser probe crashed.');
      const measured=outcome.result?.value;
      if(!measured?.ready){
        const failed=Object.keys(measured?.checks||{}).filter(k=>!measured.checks[k]);
        throw Error('Read-only unified review '+width+'px failed: '+failed.join(', '));
      }
      unifiedReviewChecks.push({width,checks:Object.keys(measured.checks).length});
    }
    // Isolated fictional Version 1 -> Version 2 editing. No real source,
    // credential, browser Save or network call is supplied to the preview.
    const revisionDemoChecks=[];
    for(const width of [1440,390]){
      await send('Emulation.setDeviceMetricsOverride',{
        width,height:900,deviceScaleFactor:1,mobile:width<500
      });
      await send('Page.navigate',{url:origin+'/editor/revision-demo-preview.html'});
      let ready=false;
      for(let i=0;i<160;i++){
        const state=await send('Runtime.evaluate',{
          expression:"document.readyState==='complete' && !!document.getElementById('demo-status') && !document.getElementById('prepare-draft')?.disabled",
          returnByValue:true
        });
        if(state.result?.value){ready=true;break;}
        await delay(120);
      }
      if(!ready)throw Error('Fictional repeated-edit preview failed to initialize.');
      const looked=await send('Runtime.evaluate',{
        expression:revisionDemoBrowserProbe(),awaitPromise:true,returnByValue:true
      });
      if(looked.exceptionDetails)throw Error('Fictional repeated-edit browser probe crashed.');
      const result=looked.result?.value;
      if(!result?.ready){
        const failed=Object.keys(result?.checks||{})
          .filter(k=>!result.checks[k]);
        throw Error('Fictional repeated-edit preview '+width+'px failed: '+failed.join(', '));
      }
      revisionDemoChecks.push({width,checks:Object.keys(result.checks).length});
    }

    // Real keyboard-only trial in a freshly loaded FICTIONAL page.
    // Unlike the DOM-click probe above, Tab and Enter come from Chrome CDP.
    // Enter is dispatched only to a verified fictional Version 2 button:
    // never to original Admin, forms, source pickers or navigation links.
    const revisionDemoKeyboardChecks=[];
    for(const width of [1440,390]){
      await send('Emulation.setDeviceMetricsOverride',{
        width,height:900,deviceScaleFactor:1,mobile:width<500
      });
      await send('Page.navigate',{url:origin+'/editor/revision-demo-preview.html'});
      let ready=false;
      for(let i=0;i<160;i++){
        const state=await send('Runtime.evaluate',{
          expression:"document.readyState==='complete' && document.activeElement===document.body && !document.getElementById('prepare-draft')?.disabled",
          returnByValue:true
        });
        if(state.result?.value){ready=true;break;}
        await delay(120);
      }
      if(!ready)throw Error('Fictional keyboard preview not ready at body focus.');
      const trail=[];
      for(let i=0;i<6;i++){
        const event={key:'Tab',code:'Tab',
          windowsVirtualKeyCode:9,nativeVirtualKeyCode:9,modifiers:0};
        await send('Input.dispatchKeyEvent',{type:'rawKeyDown',...event});
        await send('Input.dispatchKeyEvent',{type:'keyUp',...event});
        await delay(70);
        const focused=await send('Runtime.evaluate',{
          expression:"({id:document.activeElement?.id||'',tag:document.activeElement?.tagName||''})",
          returnByValue:true
        });
        if(focused.exceptionDetails)throw Error('Fictional keyboard focus observation failed.');
        trail.push(focused.result?.value);
        if(i===1){
          if(trail[i]?.id!=='revision-two'||trail[i]?.tag!=='BUTTON')
            throw Error('Tab did not reach the fictional Version 2 button safely.');
          const enter={key:'Enter',code:'Enter',windowsVirtualKeyCode:13,
            nativeVirtualKeyCode:13,modifiers:0};
          await send('Input.dispatchKeyEvent',{
            type:'keyDown',...enter,text:'\r',unmodifiedText:'\r'
          });
          await send('Input.dispatchKeyEvent',{type:'keyUp',...enter});
          await delay(100);
        }
      }
      const after=await send('Runtime.evaluate',{
        expression:"({pathname:location.pathname,revision:document.getElementById('revision-label')?.textContent,source:document.getElementById('held-summary')?.textContent,focused:document.activeElement?.id})",
        returnByValue:true
      });
      if(after.exceptionDetails)throw Error('Fictional keyboard status observation failed.');
      const ids=trail.map(item=>item?.id);
      const expected=['revision-one','revision-two','resource-index',
        'edit-title','edit-content','prepare-draft'];
      if(ids.join(',')!==expected.join(',')||
         !after.result?.value?.revision?.includes('Version 2')||
         !after.result.value.pathname.endsWith('/editor/revision-demo-preview.html')||
         !after.result.value.source?.includes('No fictional draft')||
         metrics.formSubmissions!==0||metrics.nonLocalResponses!==0)
        throw Error('Fictional keyboard-only Tab/Enter sequence differed from safe expected controls.');
      revisionDemoKeyboardChecks.push({
        width,realChromeTabPresses:6,realChromeEnterPresses:1,
        exactFocusOrder:true,fictionalVersion2Activated:true,
        savedFiles:0,formsSubmitted:0
      });
    }
    assert.ok(metrics.localReadRequests>12,'Local resource scripts/assets were not loaded.');
    assert.equal(metrics.formSubmissions,0,'No browser form submission is permitted.');
    assert.equal(metrics.nonLocalResponses,0,'Non-local browser responses are forbidden.');
    return {
      safeLocalBrowserCheck:true,pass:true,
      scenarios:checks,adminGateChecks,adminSurfaceChecks,adminAccessibilityChecks,adminKeyboardChecks,adminReturnChecks,adminPrefixedReturnChecks,adminReturnEnterPreflightChecks,adminKeyboardEntryChecks,restorePreflightExamples,restoreFileChecks,restoreFolderChecks,saveReviewChecks,unifiedReviewChecks,revisionDemoChecks,revisionDemoKeyboardChecks,
      localReadRequests:metrics.localReadRequests,
      rejectedExternalRequests:metrics.rejectedExternalRequests,
      nonLocalResponses:metrics.nonLocalResponses,
      formSubmissions:metrics.formSubmissions,
      noLoginPerformed:true,noExternalFramesLoaded:true,
      screenshotsCreated:false
    };
  }finally{
    try{socket?.close();}catch(_){}
    if(chrome&&chrome.exitCode===null)chrome.kill('SIGKILL');
    await new Promise(resolve=>server.close(resolve));
  }
}
async function buildDrafts(){
  const files=PAGES.map(rel=>({
    path:rel,sourceSha256:sha(fs.readFileSync(path.join(root,rel))),edits:{}
  }));
  const editable=runs(fs.readFileSync(path.join(root,PAGES[0]),'utf8'))
    .find(x=>x.kind==='text');
  if(!editable)throw Error('No protected New Players text span available.');
  files[0].edits[editable.id]='Browser-only private changed guide text.';
  const navBytes=fs.readFileSync(path.join(root,NAV));
  const doc=JSON.parse(navBytes.toString('utf8'));
  doc.pages[1].label='Browser Preview Server Rules';
  return {
    pages:{
      format:'naxx-local-draft-v3',
      sourceBranchHint:'feature/multi-file-editor-export-2026-11-05',
      sourceCommitVerified:false,createdAt:'2026-11-05T00:00:00Z',
      files,navigation:{path:NAV,sourceSha256:sha(navBytes),document:doc}
    },
    resources:{
      format:'naxx-local-resource-draft-v2',baselineSha256:BASE,
      changes:[{index:0,title:'Private browser-only QA resource'},
        {index:413,content:'Private browser-only multiline content.\nSecond line.'}]
    }
  };
}
async function main(){
  const work=fs.mkdtempSync(path.join(os.tmpdir(),'naxx-full-browser-qa-'));
  fs.chmodSync(work,0o700);
  try{
    const git=cp.execFileSync('git',['rev-parse','HEAD'],{
      cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']
    }).trim();
    const drafts=await buildDrafts();
    const receipt=await bindAtReview(root,drafts,git);
    const pages=await createPagePackage(root,drafts,receipt);
    const resources=await createResourcePreview(root,drafts,receipt);
    const report=await rehearseCompleteSnapshot(root,drafts,receipt,
      pages.bytes,resources.bytes,site=>inspectBrowser(site,work));
    assert.equal(report.temporaryPreviewDeleted,true);
    assert.equal(report.realGitCheckoutUnchanged,true);
    assert.equal(report.stagedFilesUnchangedAfterInspection,true);
    assert.equal(report.browserInspection.scenarios.length,10);
    assert.equal(report.browserInspection.adminGateChecks.length,2);
    assert.equal(report.browserInspection.adminSurfaceChecks.length,2);
    assert.equal(report.browserInspection.adminAccessibilityChecks.length,2);
    assert.equal(report.browserInspection.adminKeyboardChecks.length,2);
    assert.equal(report.browserInspection.adminReturnChecks.length,2);
    assert.equal(report.browserInspection.adminPrefixedReturnChecks.length,2);
    assert.equal(report.browserInspection.adminReturnEnterPreflightChecks.length,2);
    assert.equal(report.browserInspection.adminKeyboardEntryChecks.length,2);
    assert.equal(report.browserInspection.restorePreflightExamples.length,2);
    assert.equal(report.browserInspection.restoreFileChecks.length,2);
    assert.equal(report.browserInspection.restoreFolderChecks.length,2);
    assert.equal(report.browserInspection.saveReviewChecks.length,2);
    assert.equal(report.browserInspection.unifiedReviewChecks.length,2);
    assert.equal(report.browserInspection.revisionDemoChecks.length,2);
    assert.equal(report.browserInspection.revisionDemoKeyboardChecks.length,2);
    assert.equal(report.browserInspection.formSubmissions,0);
    assert.equal(report.browserInspection.nonLocalResponses,0);
    assert.equal(report.deployable,false);
    process.stdout.write(JSON.stringify({
      format:'naxx-local-complete-site-browser-smoke-v1',
      reviewedGitCommit:git,
      completeOriginalTrackedSnapshot:report.allOriginalTrackedFilesCopied,
      completeTemporaryFileCount:report.completeTemporaryFileCount,
      tests:report.browserInspection.scenarios,
      adminGateChecks:report.browserInspection.adminGateChecks,
      adminSurfaceChecks:report.browserInspection.adminSurfaceChecks,
      adminAccessibilityChecks:report.browserInspection.adminAccessibilityChecks,
      adminKeyboardChecks:report.browserInspection.adminKeyboardChecks,
      adminReturnChecks:report.browserInspection.adminReturnChecks,
      adminPrefixedReturnChecks:report.browserInspection.adminPrefixedReturnChecks,
      adminReturnEnterPreflightChecks:report.browserInspection.adminReturnEnterPreflightChecks,
      adminKeyboardEntryChecks:report.browserInspection.adminKeyboardEntryChecks,
      restorePreflightExamples:report.browserInspection.restorePreflightExamples,
      restoreFileChecks:report.browserInspection.restoreFileChecks,
      restoreFolderChecks:report.browserInspection.restoreFolderChecks,
      saveReviewChecks:report.browserInspection.saveReviewChecks,
      unifiedReviewChecks:report.browserInspection.unifiedReviewChecks,
      revisionDemoChecks:report.browserInspection.revisionDemoChecks,
      revisionDemoKeyboardChecks:report.browserInspection.revisionDemoKeyboardChecks,
      localReadRequests:report.browserInspection.localReadRequests,
      blockedExternalAttempts:report.browserInspection.rejectedExternalRequests,
      nonLocalResponses:0,formSubmissions:0,
      exactResourceCompatibility:report.completeSourceRebuildExact,
      stagedFilesUnchangedAfterInspection:true,
      temporaryFilesDeleted:true,realGitCheckoutUnchanged:true,
      ownerApproved:false,publishable:false,deployable:false
    },null,2)+'\n');
  }finally{fs.rmSync(work,{recursive:true,force:true});}
}
if(require.main===module)
  main().catch(err=>{process.stderr.write('Private Chrome QA failed: '+
    String(err&&err.message||err).slice(0,300)+'\n');process.exitCode=1;});
module.exports={permittedRequest,CSP,createHandler,browserProbe};
