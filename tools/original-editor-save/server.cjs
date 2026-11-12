'use strict';
/*
 * Naxxramas original visual editor — localhost GitHub Save companion.
 *
 * Serves the EXISTING Resource Hub UI from the extracted repository folder.
 * The only remote write permitted is site-content.html on the fixed
 * editor-saves/original-ui branch. main is never updated here.
 *
 * GitHub authentication comes from the owner's existing `gh auth login`
 * session. The token stays in this Node process and is never sent to browser JS.
 */
const http=require('node:http');
const https=require('node:https');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const cp=require('node:child_process');

const REPO='CosmicCuddle/Naxxramas-Resource-Hub';
const BRANCH='editor-saves/original-ui';
const FILE='site-content.html';
const BASELINE_BLOB='71ab9f2bf4cf12282fcbe135f7ec787805715b62';
const ROOT=path.resolve(__dirname,'..','..');
const MAX_HTML=40*1024*1024;
const MAX_JSON_REPLY=3*1024*1024;
const SHA=/^[a-f0-9]{40}$/;
const MARKER='<script id="embedded-data">';
const MIME=new Map([
  ['.html','text/html; charset=utf-8'],['.css','text/css; charset=utf-8'],
  ['.js','text/javascript; charset=utf-8'],['.json','application/json; charset=utf-8'],
  ['.svg','image/svg+xml'],['.png','image/png'],['.jpg','image/jpeg'],
  ['.jpeg','image/jpeg'],['.gif','image/gif'],['.webp','image/webp'],
  ['.ico','image/x-icon'],['.woff','font/woff'],['.woff2','font/woff2'],
  ['.pdf','application/pdf'],
  ['.docx','application/vnd.openxmlformats-officedocument.wordprocessingml.document']
]);

function gitBlobSha(bytes){
  const head=Buffer.from('blob '+bytes.length+'\0','utf8');
  return crypto.createHash('sha1').update(head).update(bytes).digest('hex');
}
function getToken(spawn=cp.spawnSync){
  const r=spawn('gh',['auth','token','--hostname','github.com'],{
    shell:false,encoding:'utf8',timeout:15000,
    stdio:['ignore','pipe','pipe'],maxBuffer:128*1024
  });
  if(!r||r.error||r.status!==0||typeof r.stdout!=='string')
    throw Error('GitHub CLI is not logged in. Run gh auth login first.');
  const token=r.stdout.trim();
  if(token.length<12||/[\x00-\x20\x7f]/.test(token))
    throw Error('GitHub CLI did not return a usable login token.');
  return token;
}
function splitEmbedded(text){
  const start=text.indexOf(MARKER);
  if(start<0||text.indexOf(MARKER,start+MARKER.length)>=0)
    throw Error('Website source does not contain exactly one embedded-data block.');
  const bodyStart=start+MARKER.length;
  const end=text.indexOf('</script>',bodyStart);
  if(end<0)throw Error('Website embedded-data block is incomplete.');
  return {prefix:text.slice(0,bodyStart),body:text.slice(bodyStart,end),
    suffix:text.slice(end)};
}
function validateBaseline(){
  const bytes=fs.readFileSync(path.join(ROOT,FILE));
  if(gitBlobSha(bytes)!==BASELINE_BLOB)
    throw Error('This extracted website does not match the approved original editor source.');
  const split=splitEmbedded(bytes.toString('utf8'));
  return {bytes,split};
}
function validateCandidate(bytes,baseline){
  if(!Buffer.isBuffer(bytes)||bytes.length<20*1024*1024||bytes.length>MAX_HTML)
    throw Error('Saved website source has an unexpected size.');
  const text=bytes.toString('utf8');
  if(!Buffer.from(text,'utf8').equals(bytes))
    throw Error('Saved website source is not valid UTF-8.');
  const split=splitEmbedded(text);
  if(split.prefix!==baseline.split.prefix||split.suffix!==baseline.split.suffix)
    throw Error('Save refused because something outside the editor data changed.');
  const prefix='window.NAXX_DATA = ';
  if(!split.body.startsWith(prefix)||!split.body.endsWith(';'))
    throw Error('Saved editor data wrapper is invalid.');
  let data;
  try{data=JSON.parse(split.body.slice(prefix.length,-1));}
  catch(_){throw Error('Saved editor data is not valid JSON.');}
  if(!data||typeof data!=='object'||Array.isArray(data)||
     !Array.isArray(data.resources)||data.resources.length<1||
     data.resources.length>2000||typeof data.siteTitle!=='string')
    throw Error('Saved editor data structure is incomplete.');
  return {bytes,text,blobSha:gitBlobSha(bytes),resourceCount:data.resources.length};
}
function githubRequest(token,method,apiPath,body=null,raw=false){
  return new Promise((resolve,reject)=>{
    let payload=null;
    if(body!==null)payload=Buffer.from(JSON.stringify(body),'utf8');
    const headers={
      'Authorization':'Bearer '+token,
      'Accept':raw?'application/vnd.github.raw+json':'application/vnd.github+json',
      'X-GitHub-Api-Version':'2022-11-28',
      'User-Agent':'Naxxramas-Original-Editor-Save'
    };
    if(payload){
      headers['Content-Type']='application/json';
      headers['Content-Length']=String(payload.length);
    }
    const req=https.request({hostname:'api.github.com',port:443,protocol:'https:',
      method,path:apiPath,headers,timeout:120000,rejectUnauthorized:true},res=>{
      let size=0;const chunks=[];
      const cap=raw?MAX_HTML:MAX_JSON_REPLY;
      res.on('data',chunk=>{
        size+=chunk.length;
        if(size>cap){req.destroy();reject(Error('GitHub response was unexpectedly large.'));}
        else chunks.push(chunk);
      });
      res.on('end',()=>{
        const bytes=Buffer.concat(chunks);
        if(res.statusCode<200||res.statusCode>=300)
          return reject(Error('GitHub rejected the request ('+res.statusCode+').'));
        if(raw)return resolve(bytes);
        try{resolve(JSON.parse(bytes.toString('utf8')));}
        catch(_){reject(Error('GitHub returned an unreadable response.'));}
      });
    });
    req.on('timeout',()=>req.destroy(Error('GitHub request timed out.')));
    req.on('error',()=>reject(Error('GitHub connection failed. Save outcome was not assumed.')));
    if(payload)req.write(payload);
    req.end();
  });
}
async function readRemoteState(token,withBytes){
  const repo=await githubRequest(token,'GET','/repos/'+REPO);
  if(!repo||repo.full_name!==REPO||repo.archived===true||repo.disabled===true)
    throw Error('The expected Resource Hub repository was not verified.');
  const ref=await githubRequest(token,'GET',
    '/repos/'+REPO+'/git/ref/heads/'+BRANCH);
  const head=ref&&ref.object&&ref.object.sha;
  if(!SHA.test(head||''))throw Error('The editor draft branch was not verified.');
  const commit=await githubRequest(token,'GET','/repos/'+REPO+'/git/commits/'+head);
  if(!commit||commit.sha!==head||!commit.tree||!SHA.test(commit.tree.sha||''))
    throw Error('The editor draft commit was not verified.');
  const tree=await githubRequest(token,'GET',
    '/repos/'+REPO+'/git/trees/'+commit.tree.sha);
  const entry=tree&&Array.isArray(tree.tree)?
    tree.tree.find(x=>x&&x.path===FILE&&x.type==='blob'&&x.mode==='100644'):null;
  if(!entry||!SHA.test(entry.sha||''))
    throw Error('The editor draft site-content.html blob was not verified.');
  let bytes=null;
  if(withBytes){
    bytes=await githubRequest(token,'GET','/repos/'+REPO+'/git/blobs/'+entry.sha,null,true);
    if(gitBlobSha(bytes)!==entry.sha)
      throw Error('The downloaded editor draft bytes failed Git blob verification.');
  }
  return {head,treeSha:commit.tree.sha,blobSha:entry.sha,bytes};
}
async function writeRemote(token,candidate,expectedHead){
  const current=await readRemoteState(token,false);
  if(current.head!==expectedHead)
    throw Error('The GitHub draft changed since this editor loaded. Restart the editor before saving.');
  const blob=await githubRequest(token,'POST','/repos/'+REPO+'/git/blobs',{
    content:candidate.bytes.toString('base64'),encoding:'base64'
  });
  if(!blob||blob.sha!==candidate.blobSha)
    throw Error('GitHub did not confirm the exact website blob.');
  const tree=await githubRequest(token,'POST','/repos/'+REPO+'/git/trees',{
    base_tree:current.treeSha,
    tree:[{path:FILE,mode:'100644',type:'blob',sha:blob.sha}]
  });
  if(!tree||!SHA.test(tree.sha||''))
    throw Error('GitHub did not confirm the updated website tree.');
  const commit=await githubRequest(token,'POST','/repos/'+REPO+'/git/commits',{
    message:'Save Resource Hub editor changes',
    tree:tree.sha,parents:[expectedHead]
  });
  if(!commit||!SHA.test(commit.sha||''))
    throw Error('GitHub did not confirm the editor Save commit.');
  await githubRequest(token,'PATCH',
    '/repos/'+REPO+'/git/refs/heads/'+BRANCH,{sha:commit.sha,force:false});
  const verified=await readRemoteState(token,false);
  if(verified.head!==commit.sha||verified.blobSha!==candidate.blobSha)
    throw Error('GitHub Save readback did not match the exact saved website.');
  return {commit:commit.sha,blobSha:candidate.blobSha};
}
function safeStaticPath(urlPath){
  let decoded;
  try{decoded=decodeURIComponent(urlPath);}catch(_){return null;}
  const rel=decoded==='/'?'index.html':decoded.replace(/^\/+/, '');
  const full=path.resolve(ROOT,rel);
  const prefix=ROOT+path.sep;
  if(full!==ROOT&&!full.startsWith(prefix))return null;
  return full;
}
async function start(options={}){
  const baseline=validateBaseline();
  const token=(options.getToken||getToken)();
  let remote=await readRemoteState(token,true);
  validateCandidate(remote.bytes,baseline);
  const csrf=crypto.randomBytes(32).toString('hex');
  let draftBytes=remote.bytes;
  let remoteHead=remote.head;

  const server=http.createServer(async(req,res)=>{
    const address=server.address();
    const host='127.0.0.1:'+(address&&address.port);
    if(req.headers.host!==host){
      res.writeHead(403,{'Content-Type':'text/plain; charset=utf-8'});res.end('Local editor only.');return;
    }
    const parsed=new URL(req.url,'http://'+host);
    const pathname=parsed.pathname;
    function json(status,value){
      res.writeHead(status,{'Content-Type':'application/json; charset=utf-8',
        'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',
        'Referrer-Policy':'no-referrer','X-Frame-Options':'SAMEORIGIN'});
      res.end(JSON.stringify(value));
    }
    if(req.method==='GET'&&pathname==='/api/original-editor/status'){
      try{
        const fresh=await readRemoteState(token,false);
        remoteHead=fresh.head;
        json(200,{format:'naxx-original-editor-save-capability-v1',
          ready:true,repository:REPO,branch:BRANCH,
          expectedHead:remoteHead,publishDisabled:true,csrfToken:csrf});
      }catch(_){
        json(503,{format:'naxx-original-editor-error-v1',
          error:'GitHub Save connection is unavailable.'});
      }
      return;
    }
    if(req.method==='POST'&&pathname==='/api/original-editor/save'){
      const origin='http://'+host;
      if(req.headers.origin!==origin||
         req.headers['x-naxx-editor-protocol']!=='naxx-original-editor-save-v1'||
         req.headers['x-naxx-csrf-token']!==csrf||
         !SHA.test(req.headers['x-naxx-expected-head']||'')||
         !/^text\/html(?:;|$)/i.test(req.headers['content-type']||'')){
        json(403,{format:'naxx-original-editor-error-v1',error:'Save request was refused.'});return;
      }
      const expected=req.headers['x-naxx-expected-head'];
      const chunks=[];let total=0;
      try{
        for await(const chunk of req){
          total+=chunk.length;
          if(total>MAX_HTML)throw Error('Saved website source is too large.');
          chunks.push(chunk);
        }
        const candidate=validateCandidate(Buffer.concat(chunks),baseline);
        const saved=await writeRemote(token,candidate,expected);
        draftBytes=candidate.bytes;remoteHead=saved.commit;
        json(200,{format:'naxx-original-editor-save-result-v1',
          result:'saved-and-verified',repository:REPO,branch:BRANCH,
          commit:saved.commit,blobSha:saved.blobSha,
          resources:candidate.resourceCount,published:false});
      }catch(error){
        json(409,{format:'naxx-original-editor-error-v1',
          error:error&&error.message?error.message:'Save was not verified.'});
      }
      return;
    }
    if(req.method!=='GET'&&req.method!=='HEAD'){
      res.writeHead(405,{'Content-Type':'text/plain; charset=utf-8'});res.end('Method not allowed.');return;
    }
    if(pathname==='/site-content.html'){
      res.writeHead(200,{'Content-Type':'text/html; charset=utf-8',
        'Content-Length':String(draftBytes.length),'Cache-Control':'no-store',
        'X-Content-Type-Options':'nosniff'});
      if(req.method==='GET')res.end(draftBytes);else res.end();
      return;
    }
    const file=safeStaticPath(pathname);
    if(!file||!fs.existsSync(file)||!fs.statSync(file).isFile()){
      res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});res.end('Not found.');return;
    }
    const stat=fs.statSync(file);
    res.writeHead(200,{'Content-Type':MIME.get(path.extname(file).toLowerCase())||
      'application/octet-stream','Content-Length':String(stat.size),
      'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
    if(req.method==='HEAD'){res.end();return;}
    fs.createReadStream(file).pipe(res);
  });
  await new Promise((ok,bad)=>server.once('error',bad).listen(0,'127.0.0.1',ok));
  return {server,url:'http://127.0.0.1:'+server.address().port+'/',branch:BRANCH};
}

if(require.main===module){
  (async()=>{
    const running=await start();
    process.stdout.write(
      'NAXXRAMAS ORIGINAL EDITOR: '+running.url+'\n'+
      'Save Changes -> GitHub branch '+running.branch+'\n'+
      'The live website main branch is NOT changed by Save.\n'+
      'Close this window when you finish editing.\n');
    if(process.platform==='win32'){
      cp.spawnSync('powershell.exe',['-NoLogo','-NoProfile','-Command',
        'Start-Process -FilePath '+JSON.stringify(running.url)],
        {shell:false,stdio:'ignore',timeout:10000});
    }
  })().catch(error=>{
    process.stderr.write((error&&error.message?error.message:
      'The original editor could not start.')+'\nNothing was saved.\n');
    process.exitCode=1;
  });
}

module.exports=Object.freeze({REPO,BRANCH,FILE,BASELINE_BLOB,gitBlobSha,
  splitEmbedded,validateCandidate,validateBaseline,getToken,start});
