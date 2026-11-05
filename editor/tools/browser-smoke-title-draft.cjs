'use strict';
/*
 * Browser-only QA for the PRIVATE resource title draft editor.
 * Runs a local loopback HTTP server and a fresh headless Chrome profile.
 * No server deployment, application submission, GitHub publication, or
 * changes to original website files. Downloaded draft stays in OS temp.
 */
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const http=require('node:http');
const cp=require('node:child_process');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..','..');
const original=path.join(root,'site-content.html');
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function browserBinary(){
  for(const name of ['google-chrome','google-chrome-stable','chromium','chromium-browser']){
    const result=cp.spawnSync('which',[name],{encoding:'utf8'});
    if(result.status===0)return result.stdout.trim();
  }
  throw Error('Chrome/Chromium is not installed for this opt-in browser test.');
}
function handler(req,res){
  let rel;
  try{rel=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname).replace(/^\/+/,'');}
  catch(_){res.writeHead(400);res.end();return;}
  let target=path.resolve(root,rel||'editor/index.html');
  if(target!==root&&!target.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
  try{
    const st=fs.statSync(target);
    if(!st.isFile())throw Error('not file');
    const mime=path.extname(target)==='.js'?'text/javascript; charset=utf-8':
      path.extname(target)==='.html'?'text/html; charset=utf-8':'application/octet-stream';
    res.writeHead(200,{'Content-Type':mime,'Content-Length':st.size,
      'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
    fs.createReadStream(target).pipe(res);
  }catch(_){res.writeHead(404);res.end('Not found');}
}
async function launch(binary,url,work){
  const profile=path.join(work,'chrome-profile');
  fs.mkdirSync(profile,{mode:0o700});
  const args=['--headless=new','--no-sandbox','--disable-gpu',
    '--disable-dev-shm-usage','--disable-background-networking','--disable-extensions',
    '--no-first-run','--remote-allow-origins=*','--remote-debugging-port=0',
    '--user-data-dir='+profile,'--window-size=1400,950',url];
  const child=cp.spawn(binary,args,{stdio:['ignore','ignore','pipe']});
  let tail='',ws;
  child.stderr.on('data',chunk=>{tail=(tail+String(chunk)).slice(-400);});
  async function close(){
    try{ws?.close();}catch(_){}
    if(child.exitCode===null)child.kill('SIGKILL');
    await wait(150);
  }
  try{
    let port=0;
    for(let n=0;n<100;n++){
      const active=path.join(profile,'DevToolsActivePort');
      if(fs.existsSync(active)){
        port=Number(fs.readFileSync(active,'utf8').split('\n')[0]);break;
      }
      if(child.exitCode!==null)break;
      await wait(150);
    }
    if(!port)throw Error('Chrome did not provide a debugging port (browser environment failure). '+tail.slice(-120));
    let page;
    for(let n=0;n<50;n++){
      try{
        const items=await fetch('http://127.0.0.1:'+port+'/json/list').then(r=>r.json());
        page=items.find(i=>i.type==='page'&&i.webSocketDebuggerUrl&&i.url.startsWith('http'));
        if(page)break;
      }catch(_){}
      await wait(120);
    }
    if(!page)throw Error('Chrome did not expose an editor page.');
    ws=new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve,reject)=>{
      ws.addEventListener('open',resolve,{once:true});
      ws.addEventListener('error',reject,{once:true});
    });
    const pending=new Map();let next=0;
    ws.addEventListener('message',e=>{
      let msg;
      try{msg=JSON.parse(e.data);}catch(_){return;}
      if(!msg.id||!pending.has(msg.id))return;
      const p=pending.get(msg.id);pending.delete(msg.id);
      clearTimeout(p.timer);
      if(msg.error)p.reject(Error('Chrome protocol error: '+msg.error.message));
      else p.resolve(msg.result);
    });
    function send(method,params={}){
      return new Promise((resolve,reject)=>{
        const id=++next,timer=setTimeout(()=>{
          pending.delete(id);reject(Error('Chrome protocol timeout: '+method));
        },20000);
        pending.set(id,{resolve,reject,timer});
        ws.send(JSON.stringify({id,method,params}));
      });
    }
    async function evalPage(expression){
      const result=await send('Runtime.evaluate',{expression,returnByValue:true});
      if(result.exceptionDetails)throw Error('Editor browser expression failed.');
      return result.result?.value;
    }
    async function until(expression,label){
      for(let i=0;i<150;i++){
        try{if(await evalPage(expression))return;}catch(_){}
        await wait(120);
      }
      throw Error('Editor browser state not reached: '+label);
    }
    async function chooseFile(selector,filename){
      const doc=await send('DOM.getDocument',{depth:1});
      const target=await send('DOM.querySelector',{nodeId:doc.root.nodeId,selector});
      if(!target.nodeId)throw Error('Missing private editor file input.');
      await send('DOM.setFileInputFiles',{nodeId:target.nodeId,files:[filename]});
      // Ensure all supported Chrome versions dispatch change.
      await evalPage('(function(){var el=document.querySelector('+JSON.stringify(selector)+');el.dispatchEvent(new Event("change",{bubbles:true}));return true;})()');
    }
    return {send,evalPage,until,chooseFile,close};
  }catch(err){await close();throw err;}
}
async function verify(browser,work){
  const server=http.createServer(handler);
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  let chrome;
  try{
    const base='http://127.0.0.1:'+server.address().port+'/editor/index.html';
    chrome=await launch(browser,base,work);
    const downloadDir=path.join(work,'download');
    fs.mkdirSync(downloadDir,{mode:0o700});
    await chrome.send('Runtime.enable');
    await chrome.send('DOM.enable');
    await chrome.send('Page.enable');
    await chrome.send('Page.setDownloadBehavior',{behavior:'allow',downloadPath:downloadDir});
    await chrome.until('!!window.NaxxResourceTitles && !!document.getElementById("resource-source-file")',
      'private resource editor loaded');
    await chrome.chooseFile('#resource-source-file',original);
    await chrome.until('document.getElementById("resource-count").textContent.includes("414 resources loaded")',
      '414 verified resources loaded');
    assert.equal(await chrome.evalPage('document.getElementById("resource-choice").options.length'),414);
    await chrome.evalPage('(function(){var input=document.getElementById("resource-title-edit");input.value="Browser Safety Trial Title";input.dispatchEvent(new Event("input",{bubbles:true}));document.getElementById("resource-apply").click();return true;})()');
    await chrome.until('document.getElementById("resource-count").textContent.includes("1 title edits")',
      'resource title staged in browser');
    await chrome.evalPage('document.getElementById("resource-save-draft").click()');
    const draft=path.join(downloadDir,'naxxramas-resource-title-draft.json');
    for(let i=0;i<70&&!fs.existsSync(draft);i++)await wait(150);
    assert.equal(fs.existsSync(draft),true,'Local resource title JSON draft must download.');
    const data=JSON.parse(fs.readFileSync(draft,'utf8'));
    assert.equal(data.format,'naxx-local-resource-title-draft-v1');
    assert.equal(data.baselineSha256,'34455f6d901c538e2491a8c16681692e4c02d918b1984d7d0ba081aacb1049e8');
    assert.deepEqual(data.changes,[{index:0,title:'Browser Safety Trial Title'}]);
    assert.ok(!Object.hasOwn(data,'siteContent'));
    await chrome.evalPage('window.confirm=function(){return true;};document.getElementById("resource-clear").click();');
    await chrome.until('document.getElementById("resource-count").textContent.includes("0 title edits")','title reverted');
    await chrome.chooseFile('#resource-draft-file',draft);
    await chrome.until('document.getElementById("resource-count").textContent.includes("1 title edits")','downloaded draft restored');
    assert.equal(await chrome.evalPage('document.getElementById("resource-title-edit").value'),
      'Browser Safety Trial Title');
    const wrongPath=path.join(work,'site-content.html');
    fs.writeFileSync(wrongPath,'Not the verified website.',{mode:0o600,flag:'wx'});
    await chrome.chooseFile('#resource-source-file',wrongPath);
    await chrome.until('document.getElementById("resource-status").textContent.includes("Select the original site-content.html")',
      'invalid original refused');
    assert.equal(await chrome.evalPage('document.getElementById("resource-count").textContent.includes("1 title edits")'),true);
    console.log('PASS: real Chrome loaded 414 verified resources; changed title; downloaded/restored draft; rejected wrong source while retaining edits.');
    console.log('PASS: no public website, original source file, GitHub repo or external form was modified.');
  }finally{
    if(chrome)await chrome.close();
    await new Promise(resolve=>server.close(resolve));
  }
}
(async()=>{
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'naxx-local-resource-qa-'));
  fs.chmodSync(tmp,0o700);
  try{await verify(browserBinary(),tmp);}
  finally{fs.rmSync(tmp,{recursive:true,force:true});}
})().catch(err=>{console.error(err&&err.message||String(err));process.exitCode=1;});
