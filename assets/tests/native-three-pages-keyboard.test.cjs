// Browser-protocol keyboard regression. No packages, deployment, login, or Tally calls.
"use strict";
const fs=require("node:fs"),path=require("node:path"),os=require("node:os"),http=require("node:http"),cp=require("node:child_process");
const root=path.resolve(__dirname,"../.."),pause=ms=>new Promise(ok=>setTimeout(ok,ms));
function chrome(){for(const n of ["google-chrome","google-chrome-stable","chromium","chromium-browser"]){const x=cp.spawnSync("which",[n],{encoding:"utf8"});if(x.status===0)return x.stdout.trim();}throw Error("Chrome missing");}
function serve(req,res){
 const rel=decodeURIComponent(new URL(req.url,"http://127.0.0.1").pathname).replace(/^\/+/,"");
 let file=path.resolve(root,rel);
 if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
 try{if(fs.statSync(file).isDirectory())file=path.join(file,"index.html");
  const mime=({".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".png":"image/png",".jpg":"image/jpeg",".svg":"image/svg+xml"})[path.extname(file)]||"application/octet-stream";
  res.setHeader("Content-Type",mime);res.setHeader("Content-Length",fs.statSync(file).size);fs.createReadStream(file).pipe(res);
 }catch(e){res.writeHead(404);res.end("Not found");}
}
async function connect(browser,url,width){
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),"naxx-keys-"));
 const args=["--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--no-first-run","--disable-extensions",
 "--disable-background-networking","--remote-debugging-port=0","--remote-allow-origins=*",
 "--user-data-dir="+profile,"--window-size="+width+",900",url];
 const child=cp.spawn(browser,args,{stdio:["ignore","ignore","pipe"]});
 let stderr="",ws;child.stderr.on("data",x=>stderr=(stderr+x.toString()).slice(-500));
 async function close(){try{ws?.close();}catch(e){}child.kill("SIGKILL");await pause(200);fs.rmSync(profile,{recursive:true,force:true});}
 try{
  let port=0;
  for(let i=0;i<100;i++){const f=path.join(profile,"DevToolsActivePort");
   if(fs.existsSync(f)){port=Number(fs.readFileSync(f,"utf8").split("\n")[0]);break;}await pause(150);}
  if(!port)throw Error("DevTools unavailable: "+stderr);
  let target;
  for(let i=0;i<60;i++){const pages=await fetch("http://127.0.0.1:"+port+"/json/list").then(r=>r.json());
   target=pages.find(x=>x.type==="page"&&x.webSocketDebuggerUrl&&x.url.startsWith("http"))||pages.find(x=>x.type==="page"&&x.webSocketDebuggerUrl);
   if(target)break;await pause(150);}
  if(!target)throw Error("Page debug target unavailable");
  ws=new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{ws.addEventListener("open",resolve,{once:true});ws.addEventListener("error",reject,{once:true});});
  const pending=new Map();let next=0;
  ws.addEventListener("message",e=>{let m;try{m=JSON.parse(e.data);}catch{return;}
   if(!m.id||!pending.has(m.id))return;
   const p=pending.get(m.id);pending.delete(m.id);clearTimeout(p.timer);
   m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);
  });
  function send(method,params={}){return new Promise((resolve,reject)=>{const id=++next;
   const timer=setTimeout(()=>{pending.delete(id);reject(Error("Timed out CDP "+method));},15000);
   pending.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params}));
  });}
  async function evaluate(expression){const r=await send("Runtime.evaluate",{expression,returnByValue:true});
   if(r.exceptionDetails)throw Error("Page script exception: "+r.exceptionDetails.text);return r.result?.value;}
  async function until(expression,stage){for(let i=0;i<140;i++){try{if(await evaluate(expression))return;}catch(e){/* document.write/reload can recreate context */}await pause(250);}throw Error("Failed keyboard stage: "+stage);}
  async function enter(){const p={key:"Enter",code:"Enter",windowsVirtualKeyCode:13,nativeVirtualKeyCode:13};
   await send("Input.dispatchKeyEvent",Object.assign({type:"keyDown",text:"\r",unmodifiedText:"\r"},p));
   await send("Input.dispatchKeyEvent",Object.assign({type:"keyUp"},p));}
  return {evaluate,until,enter,close};
 }catch(e){await close();throw e;}
}
// GitHub-hosted Chrome occasionally fails before creating DevToolsActivePort.
// Retry only this browser-startup failure once; never hide a keyboard/assertion failure.
async function connectWithStartupRetry(browser,url,width){
 for(let attempt=1;attempt<=2;attempt++){
  try{return await connect(browser,url,width);}catch(e){
   if(attempt===2||!String(e.message||e).startsWith("DevTools unavailable:"))throw e;
   console.warn("Chrome DevTools startup failed; retrying once with a fresh profile");
   await pause(800);
  }
 }
 throw Error("Chrome startup retry unexpectedly exhausted");
}
async function desktop(browser,base){
 const s=await connectWithStartupRetry(browser,base+"apply/",1440);
 try{
  await s.until('document.querySelectorAll("#steps .naxx-guide-step").length===3&&!!document.querySelector("#naxx-tally-live-application")',"Apply page ready");
  const focused=await s.evaluate('(()=>{const b=document.querySelector("#mainNav button[data-naxx-guide-link=rules]");if(!b)return false;b.focus();return document.activeElement===b;})()');
  if(!focused)throw Error("Desktop Rules control cannot receive focus");
  await s.enter();
  try{const state=await s.evaluate('JSON.stringify({path:location.pathname,active:document.activeElement?.getAttribute("data-naxx-guide-link"),rules:document.querySelectorAll(".naxx-guide-rule").length})');console.log("DESKTOP_AFTER_ENTER",state);}catch(e){console.log("DESKTOP_AFTER_ENTER",String(e));}
  await s.until('location.pathname.endsWith("/rules/")&&document.querySelectorAll(".naxx-guide-rule").length===12',"Enter opened Rules from Apply");
  console.log("PASS: browser keyboard Enter navigated desktop Apply to Rules");
 }finally{await s.close();}
}
async function mobile(browser,base){
 const s=await connectWithStartupRetry(browser,base,390);
 try{
  await s.until('!!document.getElementById("resourceGrid")&&!!document.getElementById("mobileNav")',"mobile Home ready");
  const focused=await s.evaluate('(()=>{const b=Array.from(document.querySelectorAll(".mobile-top button")).find(x=>/Menu/i.test(x.textContent));if(!b)return false;b.focus();return document.activeElement===b;})()');
  if(!focused)throw Error("Mobile Menu control cannot receive focus");
  await s.enter();
  await s.until('(()=>{const b=document.querySelector("#mobileNav button[data-naxx-guide-link=rules]");return !!b&&b.getClientRects().length>0;})()',"Enter opened mobile menu");
  const rules=await s.evaluate('(()=>{const b=document.querySelector("#mobileNav button[data-naxx-guide-link=rules]");if(!b)return false;b.focus();return document.activeElement===b;})()');
  if(!rules)throw Error("Mobile Rules control cannot receive focus");
  await s.enter();
  await s.until('location.pathname.endsWith("/rules/")&&document.querySelectorAll(".naxx-guide-rule").length===12',"Enter opened Rules from mobile menu");
  console.log("PASS: browser keyboard Enter opened native mobile Menu and Rules");
 }finally{await s.close();}
}
(async()=>{
 const server=http.createServer(serve);await new Promise(ok=>server.listen(0,"127.0.0.1",ok));
 try{const browser=chrome(),base="http://127.0.0.1:"+server.address().port+"/";
  await desktop(browser,base);await mobile(browser,base);
  console.log("PASS: desktop and mobile keyboard controls, without deployment or Tally");
 }finally{await new Promise(ok=>server.close(ok));}
})().catch(e=>{console.error(e);process.exitCode=1;});
