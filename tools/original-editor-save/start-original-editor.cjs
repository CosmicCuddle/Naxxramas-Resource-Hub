'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const crypto=require('node:crypto'),cp=require('node:child_process');
const {createStore,REPOSITORY,BRANCH}=require('./github-site-content-store.cjs');
const ROOT=path.resolve(__dirname,'..','..');
const CSRF=crypto.randomBytes(32).toString('hex');
const MAX_HTML=40*1024*1024;
const MIME={
  '.html':'text/html; charset=utf-8','.htm':'text/html; charset=utf-8',
  '.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8',
  '.json':'application/json; charset=utf-8','.svg':'image/svg+xml',
  '.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg',
  '.gif':'image/gif','.webp':'image/webp','.ico':'image/x-icon',
  '.woff':'font/woff','.woff2':'font/woff2','.ttf':'font/ttf',
  '.wasm':'application/wasm','.pdf':'application/pdf',
  '.docx':'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
};
function tokenFromGh(spawn=cp.spawnSync){
  const result=spawn('gh',['auth','token','--hostname','github.com'],{
    shell:false,encoding:'utf8',timeout:15000,
    stdio:['ignore','pipe','pipe'],maxBuffer:128*1024
  });
  if(!result||result.error||result.status!==0||typeof result.stdout!=='string')
    throw Error('GitHub CLI is not authenticated.');
  const token=result.stdout.trim();
  if(token.length<12||/[\x00-\x20\x7f]/.test(token))
    throw Error('GitHub CLI did not provide a supported credential.');
  return token;
}
function safeFile(raw){
  const url=new URL(raw,'http://127.0.0.1/');
  const decoded=decodeURIComponent(url.pathname);
  const relative=decoded==='/'?'index.html':decoded.replace(/^\/+/,'');
  const full=path.resolve(ROOT,...relative.split('/'));
  const prefix=ROOT.endsWith(path.sep)?ROOT:ROOT+path.sep;
  if(full!==ROOT&&!full.startsWith(prefix))return null;
  return full;
}
function json(res,status,value){
  const body=Buffer.from(JSON.stringify(value),'utf8');
  res.writeHead(status,{
    'Content-Type':'application/json; charset=utf-8',
    'Content-Length':body.length,'Cache-Control':'no-store',
    'X-Content-Type-Options':'nosniff','Connection':'close'
  });
  res.end(body);
}
function staticReply(req,res){
  if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);res.end();return;}
  let file;
  try{file=safeFile(req.url);}catch(_){res.writeHead(400);res.end();return;}
  if(!file){res.writeHead(403);res.end();return;}
  let stat;
  try{
    stat=fs.statSync(file);
    if(stat.isDirectory()){file=path.join(file,'index.html');stat=fs.statSync(file);}
    if(!stat.isFile())throw Error('not file');
  }catch(_){res.writeHead(404);res.end();return;}
  const type=MIME[path.extname(file).toLowerCase()]||'application/octet-stream';
  res.writeHead(200,{
    'Content-Type':type,'Content-Length':stat.size,'Cache-Control':'no-store',
    'X-Content-Type-Options':'nosniff','Connection':'close'
  });
  if(req.method==='HEAD'){res.end();return;}
  fs.createReadStream(file).pipe(res);
}
async function createServer({store}){
  if(!store||typeof store.status!=='function'||typeof store.save!=='function')
    throw Error('Protected GitHub store is required.');
  let uncertain=false;
  const server=http.createServer(async(req,res)=>{
    const host=req.headers.host||'';
    const origin='http://'+host;
    const pathname=new URL(req.url,origin).pathname;
    if(req.method==='GET'&&pathname==='/api/original-editor/status'){
      if(uncertain){
        json(res,503,{error:'Earlier Save outcome is uncertain. Inspect the review branch before restarting.'});
        return;
      }
      try{
        const state=await store.status();
        json(res,200,{
          format:'naxx-original-editor-save-capability-v1',
          ready:true,repository:REPOSITORY,branch:BRANCH,
          expectedHead:state.expectedHead,mainHead:state.mainHead,
          publishDisabled:true,csrfToken:CSRF
        });
      }catch(error){
        json(res,503,{error:error&&error.message||'GitHub review branch is not ready.'});
      }
      return;
    }
    if(req.method==='POST'&&pathname==='/api/original-editor/save'){
      if(uncertain){
        json(res,423,{error:'Earlier Save outcome is uncertain. Inspect the review branch before retrying.'});
        return;
      }
      if(req.headers.origin!==origin||
         req.headers['x-naxx-editor-protocol']!=='naxx-original-admin-save-v1'||
         req.headers['x-naxx-csrf-token']!==CSRF||
         !/^[0-9a-f]{40}$/.test(req.headers['x-naxx-expected-head']||'')||
         !/^text\/html(?:;|$)/i.test(req.headers['content-type']||'')){
        json(res,403,{error:'Protected Save request was refused.'});return;
      }
      const chunks=[];let total=0,tooLarge=false;
      try{
        for await(const chunk of req){
          total+=chunk.length;
          if(total>MAX_HTML){tooLarge=true;break;}
          chunks.push(chunk);
        }
        if(tooLarge){json(res,413,{error:'Prepared website source exceeded the Save limit.'});return;}
        const bytes=Buffer.concat(chunks);
        const result=await store.save(bytes,req.headers['x-naxx-expected-head']);
        json(res,200,result);
      }catch(error){
        const message=error&&error.message||'Save failed.';
        if(message.includes('SAVE_OUTCOME_UNCERTAIN'))uncertain=true;
        json(res,message.includes('SAVE_OUTCOME_UNCERTAIN')?503:409,{error:message});
      }
      return;
    }
    staticReply(req,res);
  });
  return server;
}
async function start({token,request}={}){
  const credential=token||tokenFromGh();
  const store=createStore({token:credential,...(request?{request}: {})});
  await store.status();
  const server=await createServer({store});
  await new Promise((ok,bad)=>server.once('error',bad).listen(0,'127.0.0.1',ok));
  const url='http://127.0.0.1:'+server.address().port+'/';
  return Object.freeze({server,url,repository:REPOSITORY,branch:BRANCH,published:false});
}
if(require.main===module){
  (async()=>{
    if(process.argv.length!==3||process.argv[2]!=='--original-editor')
      throw Error('Explicit --original-editor action is required.');
    const running=await start();
    process.stdout.write(
      'Naxxramas original website editor: '+running.url+'\n'+
      'Same visual Admin Mode; Save goes to GitHub review branch only.\n'+
      'Live main branch is NOT published by this launcher.\n'+
      'Close this window when you are finished editing.\n');
    if(process.platform==='win32'){
      cp.spawnSync('powershell.exe',[
        '-NoLogo','-NoProfile','-Command',
        'Start-Process -FilePath '+JSON.stringify(running.url)
      ],{shell:false,stdio:'ignore',timeout:10000});
    }
  })().catch(error=>{
    process.stderr.write(
      'Original editor could not start: '+(error&&error.message||'unknown error')+
      '\nNothing was saved or published.\n');
    process.exitCode=1;
  });
}
module.exports=Object.freeze({ROOT,tokenFromGh,safeFile,createServer,start});
