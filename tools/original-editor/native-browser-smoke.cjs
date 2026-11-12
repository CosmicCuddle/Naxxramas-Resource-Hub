'use strict';
/*
 * Disposable browser check of the actual original visual editor. Uses the
 * genuine original page/toolbar and in-memory fictional GitHub writer.
 * No production credentials, network destination, or GitHub write.
 */
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const cp=require('node:child_process'),assert=require('node:assert/strict');
const {createOriginalServer}=require('./original-editor-server.cjs');
const {locateData,sameShell}=require('./native-save-core.cjs');
const {REPO,SOURCE}=require('./github-native-store.cjs');
const root=path.resolve(__dirname,'..','..'),BASE='5064a9d3cadb7071caa1d0f67e43f87d4b591043';
const original=fs.readFileSync(path.join(root,SOURCE),'utf8');
const pause=ms=>new Promise(ok=>setTimeout(ok,ms));
async function waitFor(fn,timeout=90000){
  const until=Date.now()+timeout;
  while(Date.now()<until){
    try{const result=await fn();if(result)return result;}catch(_){}
    await pause(250);
  }
  throw Error('Original visual editor browser check timed out.');
}
function client(url){
  const ws=new WebSocket(url),pending=new Map();let id=0;
  const connected=new Promise((ok,bad)=>{
    ws.addEventListener('open',ok,{once:true});
    ws.addEventListener('error',bad,{once:true});
  });
  ws.addEventListener('message',event=>{
    let reply;try{reply=JSON.parse(event.data);}catch(_){return;}
    if(reply.id&&pending.has(reply.id)){
      const p=pending.get(reply.id);pending.delete(reply.id);
      clearTimeout(p.timer);
      if(reply.error)p.reject(Error('Browser protocol request failed.'));
      else p.resolve(reply.result);
    }
  });
  async function send(method,params={}){
    await connected;
    return new Promise((resolve,reject)=>{
      const ticket=++id,timer=setTimeout(()=>{
        pending.delete(ticket);reject(Error('Browser protocol request timed out.'));
      },30000);
      pending.set(ticket,{resolve,reject,timer});
      ws.send(JSON.stringify({id:ticket,method,params}));
    });
  }
  async function evaluate(expression){
    const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
    if(r.exceptionDetails)throw Error('Original browser script refused the requested test operation.');
    return r.result?.value;
  }
  return {send,evaluate,close(){ws.close();}};
}
async function run(){
  const listing=cp.execFileSync('git',['ls-tree','-r','-z',BASE],{cwd:root,encoding:'utf8'}).split('\0').filter(Boolean).map(line=>{
    const m=/^([0-9]+) (blob|tree|commit) ([a-f0-9]{40})\t(.+)$/.exec(line);
    assert.ok(m);return {mode:m[1],type:m[2],sha:m[3],path:m[4]};
  });
  const state={listing:{tree:listing},uncertain:false};
  let saved=0,last=null,stage='opening original website';
  const store={
    async blob(sha){return cp.execFileSync('git',['cat-file','blob',sha],
      {cwd:root,maxBuffer:70*1024*1024});},
    async save(s,bytes){
      last=bytes.toString('utf8');
      assert.equal(sameShell(original,last),true);
      assert.equal(locateData(last).data.adminPassword,locateData(original).data.adminPassword);
      saved++;
      return {changed:true,published:false,commit:'b'.repeat(40),
        branchUrl:'https://github.com/'+REPO+'/tree/editor-saves/native-'+BASE.slice(0,12),
        reviewUrl:'https://github.com/'+REPO+'/pull/42'};
    }
  };
  const server=createOriginalServer({root,store,state,source:original});
  await new Promise((ok,bad)=>server.once('error',bad).listen(0,'127.0.0.1',ok));
  const url='http://127.0.0.1:'+server.address().port+'/';
  const profile=fs.mkdtempSync(path.join(os.tmpdir(),'naxx-original-editor-browser-'));
  const chrome=process.env.CHROME_BIN||['/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chromium-browser'].find(fs.existsSync);
  if(!chrome)throw Error('Chrome is unavailable for the original visual editor check.');
  let browser,dev;
  try{
    browser=cp.spawn(chrome,[
      '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-gpu',
      '--no-first-run','--no-default-browser-check','--disable-background-networking',
      '--disable-component-update','--disable-sync','--disable-extensions',
      '--remote-debugging-address=127.0.0.1','--remote-debugging-port=0',
      '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1',
      '--user-data-dir='+profile,'about:blank'
    ],{stdio:'ignore'});
    const port=await waitFor(()=>{
      const p=fs.readFileSync(path.join(profile,'DevToolsActivePort'),'utf8').split('\n')[0];
      return /^\d+$/.test(p)?p:null;
    });
    const target=await waitFor(async()=>{
      const tabs=await (await fetch('http://127.0.0.1:'+port+'/json/list')).json();
      return tabs.find(t=>t.type==='page'&&t.webSocketDebuggerUrl);
    });
    dev=client(target.webSocketDebuggerUrl);
    await dev.send('Runtime.enable');await dev.send('Page.enable');
    await dev.send('Page.navigate',{url});
    const ready=()=>dev.evaluate('typeof window.NaxxOriginalEditorSave === "function" && typeof DATA === "object" && !!document.getElementById("visualAdminToolbar")');
    await waitFor(ready);
    stage='checking existing native visual toolbar';
    const first='Fictional native original editor Save 1';
    const second='Fictional native original editor Save 2';
    const entered=await dev.evaluate('(()=>{window.confirm=()=>true;window.alert=()=>{window.__naxxTestAlert=true;};enterVisualAdminMode();const b=document.querySelector("#visualAdminToolbar [onclick=\\"exportUpdatedHtml()\\"]");return !!b&&b.textContent==="Save to GitHub"&&!document.getElementById("visualAdminToolbar").classList.contains("hidden");})()');
    assert.equal(entered,true);
    stage='first native button Save';
    await dev.evaluate('(()=>{DATA.resources[0].title='+JSON.stringify(first)+';document.querySelector("#visualAdminToolbar [onclick=\\"exportUpdatedHtml()\\"]").click();return true;})()');
    await waitFor(async()=>saved===1&&await dev.evaluate('Array.from(document.querySelectorAll("[data-naxx-native-save-status]")).some(e=>e.textContent.includes("Saved to GitHub"))'));
    assert.equal(locateData(last).data.resources[0].title,first);
    stage='second native button Save without reconnecting';
    await dev.evaluate('(()=>{DATA.resources[0].title='+JSON.stringify(second)+';document.querySelector("#visualAdminToolbar [onclick=\\"exportUpdatedHtml()\\"]").click();return true;})()');
    await waitFor(async()=>saved===2&&await dev.evaluate('Array.from(document.querySelectorAll("[data-naxx-native-save-status]")).some(e=>e.textContent.includes("Saved to GitHub"))'));
    assert.equal(locateData(last).data.resources[0].title,second);
    stage='reloading saved original website';
    await dev.send('Page.reload',{ignoreCache:true});
    await waitFor(async()=>await ready()&&await dev.evaluate('DATA.resources[0].title==='+JSON.stringify(second)));
    console.log('PASS: original visual toolbar saved twice and reopened the saved native data. Original shell retained. Fictional writer only; no GitHub writes.');
  }catch(error){
    throw Error('Original browser check failed at '+stage+': '+error.message);
  }finally{
    if(dev)dev.close();
    if(browser){browser.kill();await pause(500);}
    server.closeAllConnections();await new Promise(ok=>server.close(ok));
    fs.rmSync(profile,{recursive:true,force:true,maxRetries:5});
  }
}
run().catch(error=>{console.error(error.message);process.exitCode=1;});
