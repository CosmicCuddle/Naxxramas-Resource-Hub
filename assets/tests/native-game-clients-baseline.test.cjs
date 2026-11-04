// Local read-only A/B regression investigation of original Game Clients navigation.
// Serves the EXACT main branch and draft branch from separate directories.
// Never deploys, modifies data, loads Tally or sends credentials.
"use strict";
const fs=require("node:fs");
const path=require("node:path");
const http=require("node:http");
const cp=require("node:child_process");
const {URL}=require("node:url");
const draftRoot=path.resolve(__dirname,"../..");
const baselineRoot=path.join(draftRoot,"baseline");
let activeVariant="main"; // Only set between sequential browser subprocesses; no concurrency.
function chromeExecutable(){
 for(const name of ["google-chrome","google-chrome-stable","chromium","chromium-browser"]){
  const out=cp.spawnSync("which",[name],{encoding:"utf8"});
  if(out.status===0)return out.stdout.trim();
 }
 throw Error("Chrome was not installed; cannot compare actual navigation");
}
function pageHarness(variant){
 function runProbe(variant){
  const frame=document.getElementById("page");
  const out=document.getElementById("report");
  let stage="ready",cycles=0,after=0,searchSeen=false,clicked=false,loaded=false;
  let reached=false,emptySeen=false,firstState=null,lastState=null,visual=null,guide=null,fail="";
  function currentState(){
   let d;
   try{d=frame.contentDocument;}catch(e){return {crossOrigin:true};}
   if(!d)return {documentMissing:true};
   const heading=d.getElementById("sectionHeading");
   return {
    path:frame.contentWindow.location.pathname,
    hasBody:!!d.body,hasGrid:!!d.getElementById("resourceGrid"),
    hasNav:!!d.getElementById("mainNav"),hasSearch:!!d.getElementById("searchInput"),
    heading:heading?String(heading.textContent).trim().slice(0,70):"",
    readyState:d.readyState
   };
  }
  function homeStyleSnapshot(){
   const d=frame.contentDocument,w=frame.contentWindow;
   function css(selector){
    const el=d.querySelector(selector);
    if(!el)return {present:false};
    const st=w.getComputedStyle(el);
    return {
      display:st.display,fontFamily:st.fontFamily,fontSize:st.fontSize,fontWeight:st.fontWeight,
      color:st.color,backgroundColor:st.backgroundColor,padding:st.padding,
      borderTopColor:st.borderTopColor,borderTopWidth:st.borderTopWidth,
      borderRadius:st.borderRadius,lineHeight:st.lineHeight
    };
   }
   return {
    originalHomeButton:css('#mainNav button[data-section="Home"]'),
    nativeSidebar:css("#mainNav"),
    originalSearch:css("#searchInput"),
    originalPageHeading:css("#sectionHeading"),
    originalContentGrid:css("#resourceGrid"),
    originalContextTitle:css("#whProContextTitle")
   };
  }
  function finish(){
   clearInterval(interval);
   out.textContent="AB_RESULT:"+JSON.stringify({
    variant,searchSeen,clicked,reached,emptySeen,fail,
    initial:firstState,last:lastState,visual,guide
   });
  }
  const interval=setInterval(()=>{
   if(stage==="ready"){
    const d=frame.contentDocument;
    if(!d)return;
    const nav=d.getElementById("mainNav"),input=d.getElementById("searchInput");
    if(!nav||!input||!d.getElementById("resourceGrid")){
     if(++cycles>80){fail="Root site did not initialise";finish();}
     return;
    }
    const client=Array.from(nav.querySelectorAll("button[data-section]")).find(b=>String(b.textContent).includes("Game Clients"));
    if(!client){fail="Original Game Clients button missing";finish();return;}
    firstState=currentState();visual=homeStyleSnapshot();loaded=true;
    input.value="Mage";
    input.dispatchEvent(new frame.contentWindow.Event("input",{bubbles:true}));
    stage="search";
    return;
   }
   if(stage==="search"){
    const d=frame.contentDocument,results=d?.getElementById("globalSearchResults");
    if(results&&!results.classList.contains("hidden")&&String(results.textContent).toLowerCase().includes("mage")){
     searchSeen=true;
     const input=d.getElementById("searchInput");
     input.value="";
     input.dispatchEvent(new frame.contentWindow.Event("input",{bubbles:true}));
     const client=Array.from(d.querySelectorAll('#mainNav button[data-section]')).find(b=>String(b.textContent).includes("Game Clients"));
     if(!client){fail="Original Game Clients button lost";finish();return;}
     stage="after";clicked=true;client.click();return;
    }
    if(++cycles>100){fail="Original Mage search did not respond";finish();}
    return;
   }
   if(stage==="after"){
    after++;lastState=currentState();
    if(lastState.hasBody===false||!lastState.hasGrid)emptySeen=true;
    if(lastState.heading?.includes("Game Clients")){
     reached=true;
     // Navigation alone cannot prove the new Game Clients content is mounted.
     // The main baseline intentionally has no new guide; inspect the draft only.
     if(variant==="draft"){
      const d=frame.contentDocument;
      const article=d.getElementById("naxx-game-client-guide");
      if(!article){
       if(after<75)return;
       fail="Game Clients heading appeared, but the draft guide never mounted";
       finish();return;
      }
      const cards=Array.from(article.querySelectorAll(".naxx-client-download-card"));
      const warmane=cards.find(c=>c.querySelector("h4")?.textContent.trim()==="Warmane");
      const legacy=Array.from(d.querySelectorAll(".game-client-card")).find(
       c=>c.querySelector(".game-client-title")?.textContent.trim()==="ChromieCraft");
      const html=article.innerHTML;
      guide={
       renderedAndVisible:getComputedStyle(article).display!=="none"&&article.getBoundingClientRect().height>0,
       twoDownloadChoices:cards.length===2&&
        cards[0].querySelector("h4")?.textContent.trim()==="ChromieCraft"&&
        cards[1].querySelector("h4")?.textContent.trim()==="Warmane"&&
        !article.textContent.includes("Eternion"),
       warmaneOutageNoticeRemoved:!!warmane&&!warmane.querySelector(".naxx-client-service-note")&&
        !warmane.textContent.includes("Currently out of order"),
       warmaneOwnerTestedArchive:!!warmane?.querySelector('a[href="https://web.archive.org/web/20260228080116/https://www.warmane.com/download"]')&&
        warmane.textContent.includes("saved copy of Warmane's download page"),
       correctGameVersion:article.textContent.includes("3.3.5a")&&article.textContent.includes("12340"),
       bothPatchesExplained:article.textContent.includes("patch-V.mpq")&&article.textContent.includes("patch-Z.mpq"),
       privateConnectionInstructions:article.textContent.includes("acceptance email")&&
        article.textContent.includes("realmlist.wtf"),
       noPublicRealmAddress:!(/\\b(?:\\d{1,3}\\.){3}\\d{1,3}\\b/.test(html)||/set\\s+real(?:m)?list\\s+/i.test(html)),
       originalEditableCardPreserved:!!legacy,
       visitorDuplicateHidden:!!legacy&&getComputedStyle(legacy).display==="none",
       noHorizontalOverflow:d.documentElement.scrollWidth<=frame.contentWindow.innerWidth+3
      };
      if(!Object.values(guide).every(Boolean))
       fail="Draft Game Clients content or privacy checks failed";
     }
     finish();return;
    }
    if(after>=80)finish();
   }
  },200);
  setTimeout(()=>{if(!out.textContent.startsWith("AB_RESULT:")){fail="Probe timed out";lastState=currentState();finish();}},25000);
 }
 const script="("+runProbe.toString()+")("+JSON.stringify(variant)+");";
 return '<!doctype html><html><head><meta charset="utf-8"><title>Baseline verification</title></head>'+
 '<body><iframe id="page" title="Local Resource Hub" style="width:1440px;height:900px;border:0" src="/'+variant+'/"></iframe>'+
 '<pre id="report">AB_PENDING</pre><script>'+script+'</'+'script></body></html>';
}
function mime(f){
 const ext=path.extname(f).toLowerCase();
 return ({".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",
 ".png":"image/png",".jpg":"image/jpeg",".svg":"image/svg+xml"})[ext]||"application/octet-stream";
}
function server(req,res){
 const pathname=new URL(req.url,"http://127.0.0.1").pathname;
 if(pathname.startsWith("/probe/")){
  const variant=pathname.split("/")[2];
  if(!["main","draft"].includes(variant)){res.writeHead(400);res.end();return;}
  res.setHeader("Content-Type","text/html; charset=utf-8");
  res.end(pageHarness(variant));return;
 }
 let parts,which;
 if(pathname==="/Naxxramas-Resource-Hub"||pathname.startsWith("/Naxxramas-Resource-Hub/")){
  // The original site uses its real GitHub Pages base URL for internal navigation.
  // Re-route this local-only URL to the same checkout being tested; otherwise the
  // test server would return a false 404 on BOTH main and draft.
  which=activeVariant;
  parts=pathname.replace(/^\/Naxxramas-Resource-Hub\/?/,"").split("/").filter(Boolean);
 }else{
  parts=pathname.split("/").filter(Boolean);
  which=parts.shift();
 }
 if(!["main","draft"].includes(which)){res.writeHead(404);res.end();return;}
 const root=which==="main"?baselineRoot:draftRoot;
 let target=path.resolve(root,decodeURIComponent(parts.join("/")));
 if(target!==root&&!target.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
 try{
  if(fs.statSync(target).isDirectory())target=path.join(target,"index.html");
  res.setHeader("Content-Type",mime(target));
  res.setHeader("Content-Length",fs.statSync(target).size);
  fs.createReadStream(target).pipe(res);
 }catch(e){res.writeHead(404);res.end("Not found");}
}
function browserDump(browser,url){
 return new Promise((resolve,reject)=>{
  const args=["--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage",
  "--no-first-run","--disable-extensions","--disable-background-networking",
  "--virtual-time-budget=34000","--window-size=1500,1000","--dump-dom",url];
  const child=cp.spawn(browser,args,{stdio:["ignore","pipe","pipe"]});
  let stdout="",stderr="",finished=false;
  const timer=setTimeout(()=>{child.kill("SIGKILL");complete(Error("Chrome timed out: "+stderr.slice(-300)));},75000);
  function complete(error,value){if(finished)return;finished=true;clearTimeout(timer);error?reject(error):resolve(value);}
  child.stdout.on("data",x=>{stdout+=x.toString();if(stdout.length>1000000)complete(Error("Excessive Chrome output"));});
  child.stderr.on("data",x=>stderr=(stderr+x.toString()).slice(-1200));
  child.on("error",e=>complete(e));
  child.on("close",code=>code===0?complete(null,stdout):complete(Error("Chrome exit "+code+" "+stderr)));
 });
}
async function main(){
 if(!fs.existsSync(path.join(baselineRoot,"site-content.html")))
  throw Error("Main-branch reference checkout missing at baseline/; cannot compare");
 const browser=chromeExecutable(),serverInstance=http.createServer(server);
 await new Promise(done=>serverInstance.listen(0,"127.0.0.1",done));
 const port=serverInstance.address().port,results=[];
 try{
  for(const variant of ["main","draft"]){
   activeVariant=variant;
   const url="http://127.0.0.1:"+port+"/probe/"+variant;
   const html=await browserDump(browser,url);
   const found=html.match(/<pre id="report">AB_RESULT:([^<]+)<\/pre>/);
   if(!found)throw Error("No completed browser probe for "+variant);
   const obj=JSON.parse(found[1].replace(/&quot;/g,'"').replace(/&amp;/g,"&"));
   results.push(obj);
   console.log("GAME_CLIENTS_BASELINE_"+variant.toUpperCase(),JSON.stringify(obj));
  }
 }finally{await new Promise(resolve=>serverInstance.close(resolve));}
 const original=results[0],draft=results[1];
 if(original.fail||draft.fail)throw Error("Cannot compare because a site/search baseline probe did not initialise");
 for(const [selector,originalCss] of Object.entries(original.visual||{})){
  const draftCss=draft.visual?.[selector];
  if(JSON.stringify(originalCss)!==JSON.stringify(draftCss))
   throw Error("Original Home computed styling differs in draft for "+selector+
    ": main="+JSON.stringify(originalCss)+" draft="+JSON.stringify(draftCss));
 }
 console.log("PASS: original Home computed CSS matches main for all six native elements");
 if(!original.clicked||!draft.clicked||!original.searchSeen||!draft.searchSeen)
  throw Error("The same original Game Clients control was not exercised on both branches");
 if(original.reached&&!draft.reached)
  throw Error("DRAFT REGRESSION: main reached Game Clients but draft did not");
 if(!original.reached&&!draft.reached)
  console.warn("UNRESOLVED BASELINE MATCH: main and draft both did not reach the Game Clients heading after the original click; inspect the reported destination before concluding anything");
 if(!original.reached&&draft.reached)
  console.log("BASELINE DIFFERENCE: draft reached Game Clients, original main did not");
 if(original.reached&&draft.reached)
  console.log("PASS: original Game Clients navigation reached on both unchanged main and draft");
 if(!draft.guide||!Object.values(draft.guide).every(Boolean))
  throw Error("Game Clients draft did not pass rendered-content checks");
 console.log("PASS: draft Game Clients renders its guide, Warmane notice, required patches and private onboarding safely");
 console.log("PASS: A/B comparison finished without a draft-only navigation regression");
}
main().catch(e=>{console.error(e);process.exitCode=1;});
