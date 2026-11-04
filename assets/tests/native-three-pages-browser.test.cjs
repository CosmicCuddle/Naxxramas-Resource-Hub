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
const expected={"apply":8,"rules":35,"new-players":38};
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
 let settled=false;
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
  const article=d.querySelector('[data-naxx-guide-content="'+slug+'"]');
  if(!article)return;
  const navCount=function(id){
   const nav=d.getElementById(id);
   return nav ? nav.querySelectorAll("button[data-naxx-guide-link]").length : 0;
  };
  const checks={
   articleLoaded:!!article,
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
  'style="display:block;border:0;width:'+Number(width)+'px;height:900px" src="/'+slug+'/"></iframe>'+
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
  for(const [page,width] of [["apply",1440],["apply",390],["rules",390],["new-players",1440]]){
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
 }finally{
  await new Promise(resolve=>server.close(resolve));
 }
 if(failures)throw Error(failures+" browser scenario(s) failed");
 console.log("PASS: four local Chrome checks; no external Tally submission attempted");
}
main().catch(e=>{console.error(e);process.exitCode=1;});
