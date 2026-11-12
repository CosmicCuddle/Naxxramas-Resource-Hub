'use strict';
/*
 * Local-only host for the ORIGINAL Naxxramas Resource Hub visual editor.
 * Serves the extracted website unchanged and exposes one protected POST:
 * edited site-content.html -> editor-saves/cosmic-working.
 *
 * No Git executable is required. GitHub CLI is used only to obtain the
 * already-authorised credential in memory; the browser never sees it.
 */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const crypto=require('node:crypto'),cp=require('node:child_process');
const {
  REPOSITORY,WORKING_BRANCH,createHttpsRequest,createWriter
}=require('./github-writer.cjs');

const MAX_HTML=45*1024*1024;
const SHA=/^[0-9a-f]{40}$/;
const MIME={
  '.html':'text/html; charset=utf-8','.htm':'text/html; charset=utf-8',
  '.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8',
  '.json':'application/json; charset=utf-8','.svg':'image/svg+xml',
  '.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg',
  '.gif':'image/gif','.webp':'image/webp','.ico':'image/x-icon',
  '.woff':'font/woff','.woff2':'font/woff2','.ttf':'font/ttf',
  '.pdf':'application/pdf',
  '.docx':'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
};
function getGhToken(spawn=cp.spawnSync){
  const r=spawn('gh',['auth','token','--hostname','github.com'],{
    shell:false,encoding:'utf8',timeout:15000,
    stdio:['ignore','pipe','pipe'],maxBuffer:128*1024
  });
  if(!r||r.error||r.status!==0||typeof r.stdout!=='string')
    throw Error('GitHub CLI is not signed in on this computer.');
  const token=r.stdout.trim();
  if(token.length<12||/[\x00-\x20\x7f]/.test(token))
    throw Error('GitHub CLI did not return a usable authentication token.');
  return token;
}
function parseArgs(args){
  if(!Array.isArray(args)||args.length!==1||args[0]!=='--original-editor')
    throw Error('Explicit --original-editor action is required.');
  return Object.freeze({originalEditor:true});
}
function createServer({root,writer}){
  if(typeof root!=='string'||!path.isAbsolute(root)||!writer||
     typeof writer.repositoryState!=='function'||typeof writer.save!=='function')
    throw Error('Verified website root and GitHub writer are required.');
  const csrf=crypto.randomBytes(32).toString('hex');
  let saving=false,frozen=false,origin=null;

  function json(res,status,value){
    const body=Buffer.from(JSON.stringify(value));
    res.writeHead(status,{
      'Content-Type':'application/json; charset=utf-8',
      'Content-Length':body.length,'Cache-Control':'no-store',
      'X-Content-Type-Options':'nosniff'
    });
    res.end(body);
  }
  function safeFile(url){
    const pathname=new URL(url,'http://127.0.0.1').pathname;
    let decoded;
    try{decoded=decodeURIComponent(pathname);}catch(_){return null;}
    let relative=decoded.replace(/^\/+/,'');
    if(!relative)relative='index.html';
    const resolved=path.resolve(root,...relative.split('/'));
    const prefix=root.endsWith(path.sep)?root:root+path.sep;
    if(resolved!==root&&!resolved.startsWith(prefix))return null;
    let file=resolved;
    try{if(fs.statSync(file).isDirectory())file=path.join(file,'index.html');}
    catch(_){return null;}
    return file;
  }
  async function handle(req,res){
    const url=new URL(req.url,'http://127.0.0.1');
    if(req.method==='GET'&&url.pathname==='/api/naxx-editor/status'){
      if(frozen){
        json(res,503,{error:'Save is paused after an uncertain GitHub result. Restart the editor after checking the working branch.'});
        return;
      }
      try{
        const state=await writer.repositoryState();
        json(res,200,{
          format:'naxx-original-editor-status-v1',
          ready:true,repository:REPOSITORY,branch:WORKING_BRANCH,
          mainHead:state.main,workingHead:state.working,
          publishDisabled:true,csrfToken:csrf
        });
      }catch(_){
        json(res,503,{error:'GitHub Save connection could not be verified.'});
      }
      return;
    }
    if(req.method==='POST'&&url.pathname==='/api/naxx-editor/save'){
      if(frozen){json(res,423,{error:'Save is paused after an uncertain result. Do not retry automatically.'});return;}
      if(saving){json(res,409,{error:'A website Save is already running.'});return;}
      const expectedOrigin=origin;
      const reqOrigin=req.headers.origin||'';
      const protocol=req.headers['x-naxx-editor-protocol'];
      const token=req.headers['x-naxx-csrf-token'];
      const expected=req.headers['x-naxx-expected-working-head'];
      const type=(req.headers['content-type']||'').split(';')[0].trim().toLowerCase();
      const length=Number(req.headers['content-length']);
      if(!expectedOrigin||reqOrigin!==expectedOrigin||
         protocol!=='naxx-original-visual-editor-save-v1'||
         token!==csrf||type!=='text/html'||
         !Number.isSafeInteger(length)||length<20*1024*1024||length>MAX_HTML||
         !(expected==='none'||SHA.test(expected||''))){
        json(res,403,{error:'The protected original-editor Save request was refused.'});return;
      }
      saving=true;
      try{
        const chunks=[];let size=0;
        for await(const chunk of req){
          size+=chunk.length;
          if(size>MAX_HTML||size>length)throw Error('Edited website upload exceeded its declared size.');
          chunks.push(chunk);
        }
        if(size!==length)throw Error('Edited website upload was incomplete.');
        const result=await writer.save(Buffer.concat(chunks),expected==='none'?null:expected);
        json(res,200,result);
      }catch(error){
        if(error&&/SAVE_OUTCOME_UNCERTAIN/.test(error.message||''))frozen=true;
        json(res,frozen?503:422,{
          error:frozen?
            'SAVE_OUTCOME_UNCERTAIN: keep the editor open and do not retry automatically.':
            ((error&&error.message)||'Website Save was refused.')
        });
      }finally{saving=false;}
      return;
    }
    if(req.method!=='GET'&&req.method!=='HEAD'){
      json(res,405,{error:'Local editor accepts only read requests plus its protected Save route.'});return;
    }
    const file=safeFile(req.url);
    if(!file||!fs.existsSync(file)||!fs.statSync(file).isFile()){
      res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'});
      res.end('404 - Local Naxxramas editor file not found');return;
    }
    const info=fs.statSync(file),ext=path.extname(file).toLowerCase();
    res.writeHead(200,{
      'Content-Type':MIME[ext]||'application/octet-stream',
      'Content-Length':info.size,'Cache-Control':'no-store',
      'X-Content-Type-Options':'nosniff'
    });
    if(req.method==='HEAD')res.end();
    else fs.createReadStream(file).pipe(res);
  }
  const server=http.createServer((req,res)=>{
    Promise.resolve(handle(req,res)).catch(()=>{
      if(!res.headersSent)json(res,500,{error:'Local editor request failed safely.'});
      else res.destroy();
    });
  });
  server.once('listening',()=>{
    const address=server.address();
    origin='http://127.0.0.1:'+address.port;
  });
  return server;
}
async function start(args,dependencies={}){
  parseArgs(args);
  const root=dependencies.root||path.resolve(__dirname,'..','..');
  for(const required of ['index.html','site-content.html','assets/naxx-original-editor-save-bridge.js']){
    if(!fs.existsSync(path.join(root,required)))
      throw Error('The complete original-editor website package is missing '+required+'.');
  }
  const token=(dependencies.getToken||getGhToken)();
  const request=dependencies.request||createHttpsRequest(token);
  const writer=dependencies.writer||createWriter(request);
  await writer.repositoryState();
  const server=createServer({root,writer});
  await new Promise((ok,bad)=>server.once('error',bad).listen(0,'127.0.0.1',ok));
  const url='http://127.0.0.1:'+server.address().port+'/';
  return Object.freeze({server,url,published:false,branch:WORKING_BRANCH});
}
if(require.main===module){
  (async()=>{
    const started=await start(process.argv.slice(2));
    process.stdout.write(
      '\nNaxxramas original website editor: '+started.url+'\n'+
      'Same visual editor. Save writes ONLY site-content.html to '+started.branch+'.\n'+
      'The live main branch is NOT published by Save.\n'+
      'Close this window when you finish editing.\n\n'
    );
    if(process.platform==='win32'){
      const r=cp.spawnSync('powershell.exe',[
        '-NoLogo','-NoProfile','-Command',
        'Start-Process -FilePath '+JSON.stringify(started.url)
      ],{shell:false,stdio:'ignore',timeout:10000});
      if(r.error||r.status!==0)
        process.stdout.write('Open the editor URL above in your browser.\n');
    }
  })().catch(error=>{
    process.stderr.write(
      'Naxxramas editor could not start: '+
      ((error&&error.message)||'unknown error')+
      '\nNothing was saved or published.\n'
    );
    process.exitCode=1;
  });
}
module.exports=Object.freeze({getGhToken,parseArgs,createServer,start});
