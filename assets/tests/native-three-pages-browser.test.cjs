// No dependencies, data uploads, deployment or external API calls.
// Runs the REAL draft site in a local browser with the Tally gate kept OFF.
"use strict";
const fs=require("node:fs");
const path=require("node:path");
const os=require("node:os");
const http=require("node:http");
const cp=require("node:child_process");
const {URL}=require("node:url");
const root=path.resolve(__dirname,"../..");
const expected={"apply":8,"rules":35,"new-players":38,"home":0};
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
 let settled=false, navClicked=false, initialChecks=null;
 function finish(ready,checks){
  if(settled)return;
  settled=true;
  const d=frame.contentDocument;
  let mobileMenuProbe;
  if(d&&viewportWidth===390&&slug==="home"){
   const mini=function(el){return {tag:el.tagName,id:el.id||"",className:String(el.className||"").slice(0,110),
    label:(el.getAttribute("aria-label")||"").slice(0,90),
    controls:(el.getAttribute("aria-controls")||"").slice(0,90),
    expanded:el.getAttribute("aria-expanded"),
    text:String(el.textContent||"").trim().replace(/\\s+/g," ").slice(0,55)};};
   const mobile=d.getElementById("mobileNav"),parents=[];
   for(let e=mobile,i=0;e&&i<6;e=e.parentElement,i++)parents.push(mini(e));
   const toggles=Array.from(d.querySelectorAll("button,[role=button]"))
    .filter(e=>/menu|sidebar|nav|hamburger/i.test([e.id,e.className,e.getAttribute("aria-label"),e.getAttribute("title"),e.getAttribute("aria-controls")].join(" ")))
    .slice(0,20).map(mini);
   mobileMenuProbe={parents,toggles};
  }
  out.textContent="QA_RESULT:"+JSON.stringify({page:slug,width:viewportWidth,ready,checks:checks,mobileMenuProbe});
 }
 function check(){
  if(settled)return;
  let d;
  try{d=frame.contentDocument;}catch(e){finish(false,{sameOrigin:false});return;}
  if(!d)return;
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
    noHorizontalOverflow:d.documentElement.scrollWidth<=frame.contentWindow.innerWidth+3
   };
   finish(Object.values(checks).every(Boolean),checks);
   return;
  }
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
   const file=article.querySelector("#naxx-disabled-file");
   checks.wordDownload=!!article.querySelector('a[href="naxxramas-application.docx"][download]');
   checks.fileInputDisabled=!!file&&file.disabled;
   checks.tallyPanelHidden=!!form&&form.hidden;
   checks.tallyIframeInert=!!tally&&!tally.hasAttribute("src");
   checks.closedStatus=article.textContent.includes("Applications are not currently open");
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
  'style="display:block;border:0;width:'+Number(width)+'px;height:900px" src="/'+(slug==="home"?"":slug+"/")+'"></iframe>'+
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
 const relative=decodeURIComponent(url.pathname).replace(/^\/+/,"");
 let file=path.resolve(root,relative);
 if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
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
  for(const [page,width] of [["home",1440],["home",390],["apply",1440],["apply",390],["rules",390],["new-players",1440]]){
   const target="http://127.0.0.1:"+port+"/__qa__?page="+page+"&width="+width;
   const html=await captureChrome(browser,target);
   const match=html.match(/<pre id="result">QA_RESULT:([^<]*)<\/pre>/);
   if(!match){console.error("FAIL: no browser QA result for "+page+" at "+width);failures++;continue;}
   let result;
   try{result=JSON.parse(match[1].replace(/&quot;/g,'"').replace(/&amp;/g,"&"));}catch(e){
    console.error("FAIL: unreadable browser result",e);failures++;continue;
   }
   if(page==="home"&&width===390)console.log("MOBILE_MENU_PROBE",JSON.stringify(result.mobileMenuProbe||{}));
   if(result.ready)console.log("PASS: "+page+" "+width+"px",JSON.stringify(result.checks));
   else{console.error("FAIL: "+page+" "+width+"px",JSON.stringify(result.checks));failures++;}
  }
 }finally{
  await new Promise(resolve=>server.close(resolve));
 }
 if(failures)throw Error(failures+" browser scenario(s) failed");
 console.log("PASS: six local Chrome checks, native-home preservation and real sidebar click; no external Tally submission attempted");
}
main().catch(e=>{console.error(e);process.exitCode=1;});
