'use strict';

const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const cp=require('node:child_process');
const {
  REPOSITORY,BRANCH,strictHttpsTransport,createOriginalAdminGitHubStore
}=require('./original-admin-github-store.cjs');

const SITE_ALIAS='/Naxxramas-Resource-Hub';
const SHA=/^[a-f0-9]{40}$/;
const MIN_HTML=20*1024*1024;
const MAX_HTML=40*1024*1024;
const DENY=new Set(['.git','.github','docs','tools']);
const MIME=Object.freeze({
  '.html':'text/html; charset=utf-8','.htm':'text/html; charset=utf-8',
  '.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8',
  '.json':'application/json; charset=utf-8','.svg':'image/svg+xml',
  '.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg',
  '.gif':'image/gif','.webp':'image/webp','.ico':'image/x-icon',
  '.woff':'font/woff','.woff2':'font/woff2','.ttf':'font/ttf',
  '.wasm':'application/wasm','.pdf':'application/pdf',
  '.docx':'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
});

function getGhToken(spawn=cp.spawnSync){
  const r=spawn('gh',['auth','token','--hostname','github.com'],{
    shell:false,encoding:'utf8',timeout:15000,
    stdio:['ignore','pipe','pipe'],maxBuffer:128*1024
  });
  if(!r||r.error||r.status!==0||typeof r.stdout!=='string')
    throw Error('GitHub CLI is not authenticated on this computer.');
  const token=r.stdout.trim();
  if(token.length<12||/[\x00-\x20\x7f]/.test(token))
    throw Error('No supported local GitHub authentication is available.');
  return token;
}
function parseArgs(args){
  if(!Array.isArray(args)||args.length!==1||args[0]!=='--original-admin')
    throw Error('Use --original-admin.');
  return Object.freeze({originalAdmin:true});
}
function safeSitePath(siteDir,requestPath){
  let decoded=decodeURIComponent(requestPath);
  if(decoded===SITE_ALIAS)decoded=SITE_ALIAS+'/';
  if(decoded.startsWith(SITE_ALIAS+'/'))decoded=decoded.slice(SITE_ALIAS.length);
  if(!decoded.startsWith('/')||decoded.includes('\\')||decoded.includes('\0'))
    throw Error('Invalid local website path.');
  const parts=decoded.split('/').filter(Boolean);
  if(parts.some(part=>part==='.'||part==='..'||DENY.has(part)))
    throw Error('Private development path is not public website content.');
  let file=path.resolve(siteDir,'.'+decoded);
  const prefix=siteDir.endsWith(path.sep)?siteDir:siteDir+path.sep;
  if(file!==siteDir&&!file.startsWith(prefix))
    throw Error('Local website path escaped its root.');
  let info=fs.lstatSync(file);
  if(info.isDirectory()){
    file=path.join(file,'index.html');
    info=fs.lstatSync(file);
  }
  if(!info.isFile()||info.isSymbolicLink()||info.size>40*1024*1024)
    throw Error('Unsafe local website asset.');
  return Object.freeze({file,info});
}
function createServer({store,siteDir}){
  if(!store||store.repository!==REPOSITORY||store.branch!==BRANCH||
     typeof store.status!=='function'||typeof store.save!=='function')
    throw Error('The protected original Admin GitHub store is required.');
  if(typeof siteDir!=='string'||!path.isAbsolute(siteDir))
    throw Error('An absolute extracted website folder is required.');

  const csrf=crypto.randomBytes(32).toString('hex');
  let saving=false;
  const server=http.createServer(async(req,res)=>{
    const addr=server.address();
    const host='127.0.0.1:'+(addr&&addr.port);
    function json(status,data){
      res.writeHead(status,{
        'Content-Type':'application/json; charset=utf-8',
        'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',
        'Referrer-Policy':'no-referrer','X-Frame-Options':'DENY',
        'Cross-Origin-Resource-Policy':'same-origin'
      });
      res.end(JSON.stringify(data));
    }
    function reject(status,message){
      json(status,{format:'naxx-original-admin-local-error-v1',error:message});
    }
    if(req.headers.host!==host){
      reject(403,'Only the local website editor origin is allowed.');return;
    }
    if(typeof req.url!=='string'||req.url.length>600||req.url.includes('#')){
      reject(404,'Unknown local editor route.');return;
    }
    const raw=req.url;
    const pathname=raw.split('?')[0];

    if(req.method==='GET'&&raw==='/api/original-admin/status'){
      try{
        const state=await store.status();
        if(!state||state.repository!==REPOSITORY||state.branch!==BRANCH||
           state.file!=='site-content.html'||!SHA.test(state.expectedHead||'')||
           state.liveMainWriteAllowed!==false||state.published!==false)
          throw Error('Unsafe GitHub draft status.');
        json(200,{
          format:'naxx-original-admin-local-save-capability-v1',
          ready:!saving,repository:REPOSITORY,branch:BRANCH,
          file:'site-content.html',expectedHead:state.expectedHead,
          branchExists:state.branchExists===true,
          liveMainWriteAllowed:false,published:false,csrfToken:csrf
        });
      }catch(_){
        reject(503,'The GitHub draft Save connection is not ready.');
      }
      return;
    }

    if(req.method==='POST'&&raw==='/api/original-admin/save'){
      const origin='http://'+host;
      const submitted=typeof req.headers['x-naxx-csrf-token']==='string'&&
        /^[a-f0-9]{64}$/.test(req.headers['x-naxx-csrf-token']) ?
        Buffer.from(req.headers['x-naxx-csrf-token'],'hex') : Buffer.alloc(32);
      const matches=crypto.timingSafeEqual(submitted,Buffer.from(csrf,'hex'));
      if(req.headers.origin!==origin||
         (req.headers['sec-fetch-site']&&req.headers['sec-fetch-site']!=='same-origin')||
         req.headers['x-naxx-editor-protocol']!=='naxx-original-admin-save-v1'||
         !matches){
        reject(403,'The local original Admin Save session was not verified.');return;
      }
      if(saving){
        reject(409,'A website Save is already running.');return;
      }
      if(!/^text\/html;\s*charset=utf-8$/i.test(String(req.headers['content-type']||''))){
        reject(415,'The complete edited site-content HTML is required.');return;
      }
      const expected=String(req.headers['x-naxx-expected-head']||'');
      if(!SHA.test(expected)){
        reject(409,'The GitHub draft branch head is invalid.');return;
      }
      const rawLength=req.headers['content-length'];
      const declared=rawLength===undefined?null:Number(rawLength);
      if(declared!==null&&(!Number.isSafeInteger(declared)||
         declared<MIN_HTML||declared>MAX_HTML)){
        reject(413,'The edited website size is outside the protected range.');return;
      }
      saving=true;
      try{
        let total=0;const chunks=[];
        for await(const chunk of req){
          total+=chunk.length;
          if(total>MAX_HTML||(declared!==null&&total>declared))
            throw Error('Edited website exceeded the protected size.');
          chunks.push(chunk);
        }
        if(total<MIN_HTML||(declared!==null&&total!==declared))
          throw Error('Edited website was incomplete.');
        const result=await store.save(Buffer.concat(chunks),expected);
        if(!result||result.result!=='saved-to-github-draft'||
           result.repository!==REPOSITORY||result.branch!==BRANCH||
           result.file!=='site-content.html'||result.parentCommit!==expected||
           !SHA.test(result.commit||'')||!SHA.test(result.blobSha||'')||
           result.liveMainWriteAllowed!==false||result.published!==false)
          throw Error('GitHub did not return a verified draft Save.');
        json(200,{
          format:'naxx-original-admin-local-save-result-v1',
          result:'saved-to-github-draft',repository:REPOSITORY,
          branch:BRANCH,file:'site-content.html',
          parentCommit:result.parentCommit,commit:result.commit,
          blobSha:result.blobSha,sha256:result.sha256,
          liveMainWriteAllowed:false,published:false
        });
      }catch(_){
        reject(503,'SAVE_OUTCOME_UNCERTAIN: keep this editor open and do not click Save again until the draft branch is checked.');
      }finally{saving=false;}
      return;
    }

    if(req.method==='OPTIONS'||pathname.startsWith('/api/')){
      reject(403,'Cross-origin or unknown API requests are not permitted.');return;
    }
    if(req.method!=='GET'&&req.method!=='HEAD'){
      reject(405,'The local website is read-only except for the protected Save endpoint.');return;
    }
    try{
      const entry=safeSitePath(siteDir,pathname);
      const type=MIME[path.extname(entry.file).toLowerCase()]||
        'application/octet-stream';
      res.writeHead(200,{
        'Content-Type':type,'Content-Length':entry.info.size,
        'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',
        'Referrer-Policy':'no-referrer',
        'Cross-Origin-Resource-Policy':'same-origin'
      });
      if(req.method==='HEAD')res.end();
      else fs.createReadStream(entry.file).pipe(res);
    }catch(_){
      reject(404,'Local website file not found.');
    }
  });
  server.requestTimeout=180000;
  server.headersTimeout=15000;
  server.timeout=180000;
  return server;
}
async function startOriginalEditor(args,dependencies={}){
  parseArgs(args);
  const token=(dependencies.getToken||getGhToken)();
  const store=createOriginalAdminGitHubStore({
    enabledByExplicitOwnerApproval:true,repository:REPOSITORY,token,
    request:dependencies.request||strictHttpsTransport()
  });
  const state=await store.status();
  if(!state||state.repository!==REPOSITORY||state.branch!==BRANCH||
     !state.expectedHead||state.liveMainWriteAllowed!==false||
     state.published!==false)
    throw Error('The GitHub draft connection could not be verified.');

  const siteDir=dependencies.siteDir||path.resolve(__dirname,'..','..');
  const server=createServer({store,siteDir});
  await new Promise((ok,bad)=>server.once('error',bad).listen(0,'127.0.0.1',ok));
  const url='http://127.0.0.1:'+server.address().port+SITE_ALIAS+'/';
  return Object.freeze({server,url,branch:BRANCH,published:false});
}
if(require.main===module){
  (async()=>{
    const started=await startOriginalEditor(process.argv.slice(2));
    process.stdout.write(
      'NAXXRAMAS ORIGINAL WEBSITE EDITOR\n'+
      started.url+'\n\n'+
      'Save target: GitHub draft branch '+BRANCH+'\n'+
      'Live main / GitHub Pages are NOT changed by Save.\n'+
      'Close this window when you finish editing.\n'
    );
    if(process.platform==='win32'){
      const launched=cp.spawnSync('powershell.exe',[
        '-NoLogo','-NoProfile','-Command',
        'Start-Process -FilePath '+JSON.stringify(started.url)
      ],{shell:false,stdio:'ignore',timeout:10000});
      if(launched.error||launched.status!==0)
        process.stdout.write('Open the local editor URL above in your browser.\n');
    }
  })().catch(_=>{
    process.stderr.write(
      'The original website editor could not start. Check Node.js, GitHub CLI login and your internet connection. Nothing was saved.\n'
    );
    process.exitCode=1;
  });
}
module.exports=Object.freeze({
  SITE_ALIAS,getGhToken,parseArgs,safeSitePath,createServer,startOriginalEditor
});
