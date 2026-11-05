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
      relative=decodeURIComponent(encoded).replace(/^\/+/,'');
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
    let eventError=null;
    socket.addEventListener('message',e=>{
      let x;try{x=JSON.parse(e.data);}catch(_){return;}
      if(x.id&&pending.has(x.id)){
        const wait=pending.get(x.id);pending.delete(x.id);
        clearTimeout(wait.timer);
        if(x.error)wait.reject(Error('Browser protocol rejected '+x.error.message));
        else wait.resolve(x.result);
        return;
      }
      if(x.method==='Network.responseReceived'){
        if(!permittedRequest(x.params.response.url,
          x.params.response.requestHeaders?.[':method']||'GET',origin))
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
      {page:'new-players',route:'/new-players/',width:1440},
      {page:'rules',route:'/rules/',width:390},
      {page:'apply',route:'/apply/',width:1440},
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
        throw Error('Private '+scenario.page+' browser checks did not pass: '+failed.join(', '));
      }
      checks.push({route:scenario.page,width:scenario.width,passed:Object.keys(last.checks).length});
    }
    assert.ok(metrics.localReadRequests>12,'Local resource scripts/assets were not loaded.');
    assert.equal(metrics.formSubmissions,0,'No browser form submission is permitted.');
    assert.equal(metrics.nonLocalResponses,0,'Non-local browser responses are forbidden.');
    return {
      safeLocalBrowserCheck:true,pass:true,
      scenarios:checks,localReadRequests:metrics.localReadRequests,
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
    assert.equal(report.browserInspection.scenarios.length,5);
    assert.equal(report.browserInspection.formSubmissions,0);
    assert.equal(report.browserInspection.nonLocalResponses,0);
    assert.equal(report.deployable,false);
    process.stdout.write(JSON.stringify({
      format:'naxx-local-complete-site-browser-smoke-v1',
      reviewedGitCommit:git,
      completeOriginalTrackedSnapshot:report.allOriginalTrackedFilesCopied,
      completeTemporaryFileCount:report.completeTemporaryFileCount,
      tests:report.browserInspection.scenarios,
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
