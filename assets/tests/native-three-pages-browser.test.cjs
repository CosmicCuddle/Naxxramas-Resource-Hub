// No dependencies, data uploads, deployment or external API calls.
// Runs the draft release site in a local browser. Checks web integration, not Tally submissions.
"use strict";
const fs=require("node:fs");
const path=require("node:path");
const os=require("node:os");
const http=require("node:http");
const cp=require("node:child_process");
const {URL}=require("node:url");
const root=path.resolve(__dirname,"../..");
const expected={"apply":0,"rules":0,"new-players":24,"home":0,"clients":0};
function browserBinary(){
 for(const name of ["google-chrome","google-chrome-stable","chromium","chromium-browser"]){
  const r=cp.spawnSync("which",[name],{encoding:"utf8"});
  if(r.status===0)return r.stdout.trim();
 }
 throw Error("Chrome/Chromium executable missing; cannot claim browser QA");
}
function probe(slug,viewportWidth){
 const frame=document.getElementById("site");
 const out=document.getElementById("result");
 let settled=false, navClicked=false, initialChecks=null, searchStarted=false, searchChecks=0;
 function finish(ready,checks){
  if(settled)return;
  settled=true;
  out.textContent="QA_RESULT:"+JSON.stringify({page:slug,width:viewportWidth,ready,checks:checks});
 }
 function check(){
  if(settled)return;
  let d;
  try{d=frame.contentDocument;}catch(e){finish(false,{sameOrigin:false});return;}
  if(!d)return;
  if(navClicked){
   const rules=d.querySelector('[data-naxx-guide-content="rules"]');
   if(!rules)return;
   const checks=Object.assign({},initialChecks,{
    realClickNavigatedToRules:frame.contentWindow.location.pathname.endsWith("/rules/"),
    rulesMountedAfterClick:rules.querySelectorAll(".naxx-guide-rule").length===12,
    rulesHeadingAfterClick:(d.getElementById("sectionHeading")||{}).textContent?.includes("Server Rules")===true,
    noOverflowAfterClick:d.documentElement.scrollWidth<=frame.contentWindow.innerWidth+3
   });
   finish(Object.values(checks).every(Boolean),checks);
   return;
  }
  if(slug==="home"){
   const main=d.getElementById("mainNav"),mobile=d.getElementById("mobileNav");
   if(!main||!mobile||!d.getElementById("resourceGrid"))return;
   const homeButton=main.querySelector('button[data-section="Home"]');
   const mobileHome=mobile.querySelector('button[data-section="Home"]');
   const siteHeading=d.getElementById("sectionHeading");
   if(!homeButton||!mobileHome||!siteHeading||!d.querySelector('#mainNav button[data-naxx-guide-link="apply"]'))return;
   const desktopGuide=main.querySelectorAll("button[data-naxx-guide-link]");
   const mobileGuide=mobile.querySelectorAll("button[data-naxx-guide-link]");
   const originalButtons=main.querySelectorAll("button[data-section]");
   const focusButton=main.querySelector('button[data-naxx-guide-link="rules"]');
   if(viewportWidth===1440)focusButton.focus();
   const checks={
    nativeRootLoaded:!!d.getElementById("resourceGrid"),
    originalHomePreserved:!!homeButton&&!!mobileHome,
    originalNavigationRetained:originalButtons.length>=5,
    threeNewNativeDesktopLinks:desktopGuide.length===3,
    threeNewNativeMobileLinks:mobileGuide.length===3,
    newControlsAreNativeButtons:Array.from(desktopGuide).every(b=>b.tagName==="BUTTON"&&b.type==="button"),
    mobileButtonsHaveNativeKeyboardSemantics:Array.from(mobileGuide).every(b=>b.tagName==="BUTTON"&&b.type==="button"&&!b.disabled&&b.tabIndex>=0),
    desktopGuideButtonFocuses:viewportWidth===390||d.activeElement===focusButton,
    homeNotOverwrittenByGuide:!d.body.classList.contains("naxx-three-page-route"),
    noGuideContentOnHome:!d.querySelector("[data-naxx-guide-content]"),
    originalSectionButtonsRemain:["Class Handbooks","Dungeon Handbooks","Game Clients","Change Notes","Patches","Temporary Banned"].every(
      label=>Array.from(main.querySelectorAll('button[data-section]')).some(btn=>String(btn.textContent).includes(label))),
    originalSearchAndResultsRemain:!!d.querySelector('#searchInput[type="search"]')&&!!d.getElementById("globalSearchResults"),
    originalAdminControlsRemain:!!d.querySelector("button.wh-pro-admin")&&
      d.querySelector("#adminPasswordInput")?.type==="password",
    originalFooterRemains:!!d.querySelector("footer"),
    noHorizontalOverflow:d.documentElement.scrollWidth<=frame.contentWindow.innerWidth+3
   };
   if(viewportWidth===390&&Object.values(checks).every(Boolean)){
    const menu=Array.from(d.querySelectorAll(".mobile-top button"))
      .find(b=>/Menu/i.test(b.textContent));
    checks.mobileMenuControlPresent=!!menu;
    if(!menu){finish(false,checks);return;}
    menu.click();
    const mobileRules=d.querySelector('#mobileNav button[data-naxx-guide-link="rules"]');
    checks.mobileRulesLinkPresent=!!mobileRules;
    if(!mobileRules){finish(false,checks);return;}
    mobileRules.focus();
    checks.mobileDrawerRulesButtonFocuses=d.activeElement===mobileRules;
    if(!checks.mobileDrawerRulesButtonFocuses){finish(false,checks);return;}
    initialChecks=checks;
    navClicked=true;
    mobileRules.click();
    return;
   }
   if(viewportWidth===1440&&Object.values(checks).every(Boolean)){
    const input=d.getElementById("searchInput"),results=d.getElementById("globalSearchResults");
    if(!searchStarted){
     searchStarted=true;
     input.value="Mage";
     input.dispatchEvent(new frame.contentWindow.Event("input",{bubbles:true}));
     return;
    }
    checks.originalSearchResponds=!!results&&!results.classList.contains("hidden");
    checks.originalSearchFindsMage=!!results&&results.textContent.toLowerCase().includes("mage");
    if(!checks.originalSearchResponds&&searchChecks++<15)return;
    input.value="";
    input.dispatchEvent(new frame.contentWindow.Event("input",{bubbles:true}));
    finish(Object.values(checks).every(Boolean),checks);
    return;
   }
   finish(Object.values(checks).every(Boolean),checks);
   return;
  }
  if(slug==="clients"){
   const guide=d.getElementById("naxx-game-client-guide");
   if(!guide)return;
   const cards=Array.from(guide.querySelectorAll(".naxx-client-download-card"));
   const explainer=guide.querySelector(".naxx-client-explainer");
   const candidate=cards.find(card=>card.querySelector("h4")?.textContent.includes("Eternion"));
   const warmane=cards.find(card=>card.querySelector("h4")?.textContent.trim()==="Warmane");
   const note=warmane?.querySelector(".naxx-client-service-note");
   const positions=cards.map(card=>card.getBoundingClientRect());
   // Read-only simulation of the visual-admin CSS state. No login is attempted.
   const legacy=d.querySelector("#resourceGrid > .game-client-card.naxx-legacy-client-card");
   const originalAdminClass=d.body.classList.contains("visual-admin-active");
   d.body.classList.add("visual-admin-active");
   const adminKeepsOriginalCard=!!legacy&&
     frame.contentWindow.getComputedStyle(legacy).display!=="none"&&
     frame.contentWindow.getComputedStyle(guide).display==="none";
   const adminRestoresGridLayout=frame.contentWindow.getComputedStyle(
     d.getElementById("resourceGrid")).display==="grid";
   if(!originalAdminClass)d.body.classList.remove("visual-admin-active");
   const visitorGuideRestores=frame.contentWindow.getComputedStyle(guide).display!=="none"&&
     !!legacy&&frame.contentWindow.getComputedStyle(legacy).display==="none";
   const checks={
    firstBannerBeforeHeading:!!explainer&&guide.firstElementChild===explainer&&
     !!explainer.querySelector("#naxx-client-explainer-title"),
    bannerExplainsClientVsServer:!!explainer&&
     explainer.textContent.includes("game client")&&
     explainer.textContent.includes("game server")&&
     explainer.textContent.includes("Downloading their client does not mean you will play on their server")&&
     explainer.textContent.includes("acceptance email"),
    bannerHostingAndWotlkClear:!!explainer&&
     explainer.textContent.includes("do not currently host the base game files ourselves")&&
     explainer.textContent.includes("Wrath of the Lich King (WotLK)")&&
     explainer.textContent.includes("patch 3.3.5a (build 12340)"),
    downloadSelectorGuidance:!!guide.querySelector("#naxx-client-download")&&
     guide.querySelector("#naxx-client-download").textContent.includes("If a download website asks for the expansion or patch")&&
     guide.querySelector("#naxx-client-download").textContent.includes("Wrath of the Lich King (WotLK)"),
    eternionCandidateSafe:!!candidate&&
     candidate.textContent.includes("Full client")&&
     candidate.textContent.includes("Eternion Launcher")&&
     !!candidate.querySelector('a[href="https://eternion-wow.net/download"]')&&
     !!candidate.querySelector(".naxx-client-unavailable")&&
     !candidate.querySelector(".game-client-external-button"),
    providerPlainArchiveInstructions:!!candidate&&
     candidate.textContent.includes("scroll past the launcher")&&
     candidate.textContent.includes("Full client — 3.3.5a (build 12340)")&&
     candidate.textContent.includes("16.5 GB")&&
     candidate.textContent.includes("Their separate setup instructions are for Eternion"),
    correctLoginVersionExplained:!!guide.querySelector("#naxx-client-prepare")&&
     guide.querySelector("#naxx-client-prepare").textContent.includes("Version 3.3.5 (12340)")&&
     guide.querySelector("#naxx-client-prepare").textContent.includes("this is normal for the 3.3.5a client"),
    simulatedAdminKeepsOriginalCard:adminKeepsOriginalCard,
    simulatedAdminKeepsOriginalGrid:adminRestoresGridLayout,
    visitorModeRestoresGuide:visitorGuideRestores,
    directLinkOpensGameClients:(d.getElementById("sectionHeading")||{}).textContent?.includes("Game Clients")===true,
    completeGuideRendered:guide.getBoundingClientRect().height>0,
    threeDownloadCards:cards.length===3,
    warmaneNoteAtTop:!!warmane&&warmane.firstElementChild===note&&
     note.textContent.trim()==="Currently out of order",
    warmaneUsesOfficialLink:!!warmane?.querySelector('a[href="https://www.warmane.com/download"]'),
    warmaneDescriptionIsNormal:!!warmane?.querySelector("p")&&
     !/out of order|unavailable|service returns/i.test(warmane.querySelector("p").textContent),
    requiredPatchesListed:guide.textContent.includes("patch-V.mpq")&&guide.textContent.includes("patch-Z.mpq"),
    optionalPatchesAreClear:guide.textContent.includes("patch-J.mpq")&&
     guide.textContent.includes("patch-U.mpq")&&
     guide.textContent.includes("patch-C.mpq")&&
     guide.textContent.includes("Choose J or C, never both")&&
     !!guide.querySelector('a[href="https://github.com/CosmicCuddle/Naxxramas-Server-Patches/blob/main/OPTIONAL-PATCHES.md"]'),
    privacyPreserved:guide.textContent.includes("acceptance email")&&
     !/\\b(?:\\d{1,3}\\.){3}\\d{1,3}\\b/.test(guide.innerHTML),
    mobileCardsStack:viewportWidth!==390||positions.length===3&&
     positions[0].top<positions[1].top&&positions[1].top<positions[2].top,
    desktopCardsInRow:viewportWidth!==1440||positions.length===3&&
     Math.abs(positions[0].top-positions[1].top)<3&&Math.abs(positions[1].top-positions[2].top)<3,
    noHorizontalOverflow:d.documentElement.scrollWidth<=frame.contentWindow.innerWidth+3
   };
   finish(Object.values(checks).every(Boolean),checks);
   return;
  }
  const article=d.querySelector('[data-naxx-guide-content="'+slug+'"]');
  if(!article)return;
  const navCount=function(id){
   const nav=d.getElementById(id);
   return nav ? nav.querySelectorAll("button[data-naxx-guide-link]").length : 0;
  };
  const focusLink=d.querySelector('#mainNav button[data-naxx-guide-link="rules"]');
  const mobileLink=d.querySelector('#mobileNav button[data-naxx-guide-link="rules"]');
  if(focusLink&&viewportWidth===1440)focusLink.focus();
  const checks={
   articleLoaded:!!article,
   visibleDesktopButtonFocuses:viewportWidth===390||!!focusLink&&d.activeElement===focusLink,
   mobileButtonHasNativeKeyboardSemantics:!!mobileLink&&mobileLink.tagName==="BUTTON"&&mobileLink.type==="button"&&!mobileLink.disabled&&mobileLink.tabIndex>=0,
   nativePageClass:d.body.classList.contains("naxx-three-page-route"),
   correctHeading:(d.getElementById("sectionHeading")||{}).textContent?.includes(
    slug==="apply"?"Apply to Join":slug==="rules"?"Server Rules":"New Player Guide"
   )===true,
   desktopNavigation:navCount("mainNav")===3,
   mobileNavigation:navCount("mobileNav")===3,
   faqCount:article.querySelectorAll(".naxx-guide-qa").length===expected[slug],
   noHorizontalOverflow:d.documentElement.scrollWidth<=frame.contentWindow.innerWidth+3
  };
  if(slug==="rules"){
   checks.allTwelveRules=article.querySelectorAll(".naxx-guide-rule").length===12;
   checks.noAccordions=article.querySelectorAll("details,summary").length===0;
  }
  if(slug==="apply"){
   const form=article.querySelector("#naxx-tally-live-application");
   const tally=article.querySelector('iframe[data-tally-src]');
   const fallback=article.querySelector("#naxx-application-demo");
   const privacy=article.querySelector("#privacy");
   checks.wordDownload=!!article.querySelector('a[href="naxxramas-application.docx"][download]');
   checks.closedFallbackHidden=!!fallback&&fallback.hidden;
   checks.tallyPanelVisible=!!form&&!form.hidden;
   checks.ownerTallyConfigured=!!tally&&
    (tally.getAttribute("data-tally-src")||"").startsWith("https://tally.so/embed/q5Lqr8?");
   checks.openStatus=article.textContent.includes("Applications are open.");
   checks.privacyNoticeAvailable=!!privacy&&
    !!privacy.querySelector('a[href="mailto:naxxapplicationteam@gmail.com"]')&&
    privacy.textContent.includes("90 days of submission")&&
    privacy.textContent.includes("30 days of the decision");
   checks.privacyContactEmailOnly=!!privacy&&
    !privacy.textContent.includes("privately message the owner on Discord");
  }
  if(slug==="apply"&&viewportWidth===1440&&Object.values(checks).every(Boolean)){
   const rulesLink=d.querySelector('#mainNav button[data-naxx-guide-link="rules"]');
   if(!rulesLink){checks.rulesLinkClickable=false;finish(false,checks);return;}
   initialChecks=checks;
   navClicked=true;
   rulesLink.click();
   return;
  }
  finish(Object.values(checks).every(Boolean),checks);
 }
 const interval=setInterval(check,200);
 setTimeout(function(){clearInterval(interval);if(!settled)finish(false,{timeout:"Native route did not mount within browser budget"});},18000);
 check();
}
function harnessHtml(slug,width){
 const code="var expected="+JSON.stringify(expected)+";("+probe.toString()+")("+JSON.stringify(slug)+","+Number(width)+");";
 return '<!doctype html><html><head><meta charset="utf-8"><title>Local draft QA</title>'+
  '<meta name="viewport" content="width=device-width,initial-scale=1"></head>'+
  '<body style="margin:0;background:#17100b"><iframe id="site" title="Naxxramas QA" '+
  'style="display:block;border:0;width:'+Number(width)+'px;height:900px" src="/'+(slug==="home"?"":slug==="clients"?"Naxxramas-Resource-Hub/?section=Game%20Clients":slug+"/")+'"></iframe>'+
  '<pre id="result">QA_PENDING</pre><script>'+code+'</'+'script></body></html>';
}
function contentType(file){
 const ext=path.extname(file).toLowerCase();
 return ({".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",
 ".css":"text/css; charset=utf-8",".docx":"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
 ".jpg":"image/jpeg",".png":"image/png",".svg":"image/svg+xml",".json":"application/json"})[ext]||"application/octet-stream";
}
function serverHandler(req,res){
 const url=new URL(req.url,"http://127.0.0.1");
 if(url.pathname==="/__qa__"){
  const slug=url.searchParams.get("page"),width=Number(url.searchParams.get("width"));
  if(!Object.hasOwn(expected,slug)||![390,1440].includes(width)){res.writeHead(400);res.end("Bad QA arguments");return;}
  res.setHeader("Content-Type","text/html; charset=utf-8");
  res.end(harnessHtml(slug,width));return;
 }
 // Mirror the production GitHub Pages prefix; the native router expects this path.
 const normalisedPath=url.pathname.replace(/^\/Naxxramas-Resource-Hub(?=\/|$)/,"");
 const baseline=normalisedPath.startsWith("/__baseline__/");
 const base=baseline?path.resolve(root,"baseline"):root;
 const relative=decodeURIComponent(normalisedPath).replace(/^\/+/,"").replace(/^__baseline__\/?/,"");
 let file=path.resolve(base,relative);
 if(file!==base&&!file.startsWith(base+path.sep)){res.writeHead(403);res.end();return;}
 try{
  if(fs.statSync(file).isDirectory())file=path.join(file,"index.html");
  const stat=fs.statSync(file);
  res.setHeader("Content-Type",contentType(file));
  res.setHeader("Content-Length",stat.size);
  if(req.method==="HEAD"){res.end();return;}
  fs.createReadStream(file).pipe(res);
 }catch(e){res.writeHead(404);res.end("Not found");}
}
function captureChrome(browser,url){
 return new Promise((resolve,reject)=>{
  const args=["--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage",
  "--no-first-run","--disable-extensions","--disable-background-networking",
  "--virtual-time-budget=22000","--window-size=1500,1000","--dump-dom",url];
  const child=cp.spawn(browser,args,{stdio:["ignore","pipe","pipe"]});
  let stdout="",stderr="",done=false;
  const timer=setTimeout(()=>{child.kill("SIGKILL");finish(Error("Chrome timed out: "+url+" "+stderr.slice(-900)));},75000);
  function finish(e,value){if(done)return;done=true;clearTimeout(timer);e?reject(e):resolve(value);}
  child.stdout.on("data",chunk=>{stdout+=chunk.toString();if(stdout.length>3*1024*1024)finish(Error("Chrome output unexpectedly large"));});
  child.stderr.on("data",chunk=>{stderr=(stderr+chunk.toString()).slice(-4000);});
  child.on("error",finish);
  child.on("close",code=>code===0?finish(null,stdout):finish(Error("Chrome exited "+code+" "+stderr.slice(-1200))));
 });
}

function screenshot(browser,url,file,w,h){
 return new Promise((resolve,reject)=>{
  const args=["--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage",
   "--no-first-run","--disable-extensions","--disable-background-networking","--hide-scrollbars",
   "--force-device-scale-factor=1","--virtual-time-budget=14000",
   "--window-size="+w+","+h,"--screenshot="+file,url];
  const child=cp.spawn(browser,args,{stdio:["ignore","pipe","pipe"]});
  let stderr="",done=false;
  const timer=setTimeout(()=>{child.kill("SIGKILL");complete(Error("Screenshot time-out: "+url));},75000);
  function complete(e){if(done)return;done=true;clearTimeout(timer);e?reject(e):resolve();}
  child.stderr.on("data",x=>stderr=(stderr+x.toString()).slice(-600));
  child.on("error",complete);
  child.on("close",code=>{
   if(code!==0)return complete(Error("Screenshot Chrome exit "+code+": "+stderr));
   try{
    const data=fs.readFileSync(file);
    if(data.length<3500||data.toString("hex",0,8)!=="89504e470d0a1a0a")
     throw Error("Missing/invalid PNG screenshot: "+file);
    console.log("PASS: visual capture "+path.basename(file)+" ("+
     data.readUInt32BE(16)+"×"+data.readUInt32BE(20)+", "+data.length+" bytes)");
    complete();
   }catch(e){complete(e);}
  });
 });
}
async function captureVisualGallery(browser,port){
 const output=path.join(root,"qa-screenshots");
 fs.mkdirSync(output,{recursive:true});
 const shots=[
  ["01-original-home","Current Home", "/__baseline__/",1440,900],
  ["02-draft-home","Draft Home","/",1440,900],
  ["03-guide-desktop","New Player Guide — desktop","/new-players/",1440,900],
  ["04-rules-desktop","Server Rules — desktop","/rules/",1440,900],
  ["05-apply-desktop","Apply to Join — desktop","/apply/",1440,900],
  ["06-guide-mobile","New Player Guide — mobile","/new-players/",390,844],
  ["07-rules-mobile","Server Rules — mobile","/rules/",390,844],
  ["08-apply-mobile","Apply to Join — mobile","/apply/",390,844],
  ["09-clients-desktop","Game Clients — desktop","/Naxxramas-Resource-Hub/?section=Game%20Clients",1440,900],
  ["10-clients-mobile","Game Clients — mobile","/Naxxramas-Resource-Hub/?section=Game%20Clients",390,844],
  ["11-clients-desktop-long","Game Clients — extended desktop review","/Naxxramas-Resource-Hub/?section=Game%20Clients",1440,3500],
  ["12-clients-mobile-long","Game Clients — extended mobile review","/Naxxramas-Resource-Hub/?section=Game%20Clients",390,5500]
 ];
 for(const [id,label,route,w,h] of shots){
  const url="http://127.0.0.1:"+port+route;
  await screenshot(browser,url,path.join(output,id+".png"),w,h);
 }
 const cards=shots.map(([id,label,route,w])=>'<section><h2>'+label+'</h2><p>'+w+
  'px width</p><a href="'+id+'.png"><img src="'+id+'.png" alt="'+label+'"></a></section>').join("\n");
 const html='<!doctype html><html lang="en"><head><meta charset="utf-8">'+
  '<meta name="viewport" content="width=device-width, initial-scale=1"><title>Naxxramas Draft Visual Review</title>'+
  '<style>body{font:14px system-ui;background:#0e0b09;color:#ead3a5;padding:16px}h1{color:#ffcf84}h2{font-size:17px}'+
  '.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(290px,1fr));gap:16px}'+
  'section{border:1px solid #7b583b;background:#1c1510;padding:12px}img{width:100%;height:auto;display:block}'+
  'a:focus-visible{outline:3px solid #f6ca7d}p{color:#c4b4a0}</style></head><body>'+
  '<h1>Naxxramas Resource Hub — Visual Review</h1><p>Unpublished application-open release preview #47. No test submissions or applicant data.</p>'+
  '<p>Compare the original and draft Home first, then review the three new pages. Click an image to enlarge.</p>'+
  '<div class="grid">'+cards+'</div></body></html>';
 fs.writeFileSync(path.join(output,"00-open-visual-review.html"),html);
 console.log("PASS: twelve draft visual screenshots, including extended Game Clients desktop/mobile views; no deployment");
}

async function main(){
 const browser=browserBinary();
 const server=http.createServer(serverHandler);
 await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
 const port=server.address().port;
 let failures=0;
 try{
  const crypto=require("node:crypto");
  const url="http://127.0.0.1:"+port+"/apply/naxxramas-application.docx";
  const response=await fetch(url);
  if(response.status!==200)throw Error("Approved Word download failed HTTP GET: "+response.status);
  if(!response.headers.get("content-type")?.startsWith("application/vnd.openxmlformats-officedocument.wordprocessingml.document"))throw Error("Word download missing correct MIME type");
  const actual=crypto.createHash("sha256").update(Buffer.from(await response.arrayBuffer())).digest("hex");
  if(actual!=="f6617c8a4da6e9b75b56b020361f8aab57a8cca47921a9225685b0c0cddfa695")throw Error("Word download bytes changed");
  console.log("PASS: application DOCX downloads by HTTP with correct type and exact approved SHA-256");
  for(const [page,width] of [["home",1440],["home",390],["apply",1440],["apply",390],["rules",390],["new-players",1440],["clients",1440],["clients",390]]){
   const target="http://127.0.0.1:"+port+"/__qa__?page="+page+"&width="+width;
   const html=await captureChrome(browser,target);
   const match=html.match(/<pre id="result">QA_RESULT:([^<]*)<\/pre>/);
   if(!match){console.error("FAIL: no browser QA result for "+page+" at "+width);failures++;continue;}
   let result;
   try{result=JSON.parse(match[1].replace(/&quot;/g,'"').replace(/&amp;/g,"&"));}catch(e){
    console.error("FAIL: unreadable browser result",e);failures++;continue;
   }
   if(result.ready)console.log("PASS: "+page+" "+width+"px",JSON.stringify(result.checks));
   else{console.error("FAIL: "+page+" "+width+"px",JSON.stringify(result.checks));failures++;}
  }
  if(process.env.NAXX_VISUAL_REVIEW==="1")await captureVisualGallery(browser,port);
 }finally{
  await new Promise(resolve=>server.close(resolve));
 }
 if(failures)throw Error(failures+" browser scenario(s) failed");
 console.log("PASS: eight local Chrome checks including Game Clients desktop/mobile, privacy, legacy navigation and approved DOCX; no application submission attempted");
}
main().catch(e=>{console.error(e);process.exitCode=1;});
