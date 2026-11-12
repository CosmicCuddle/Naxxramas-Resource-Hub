'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const cp=require('node:child_process');
const {
  REPOSITORY,EDIT_BRANCH,httpsTransport,createWriter
}=require('./github-site-content-writer.cjs');

const ROOT=path.resolve(__dirname,'..','..');
const LIVE_PREFIX='/Naxxramas-Resource-Hub';
const SAVE='/__naxx/original-editor/save';
const BRIDGE='/tools/original-editor/original-save-bridge.js';
const MAX_BODY=36*1024*1024;
const EMBED=/(<script\b[^>]*\bid=(['"])embedded-data\2[^>]*>)([\s\S]*?)(<\/script\s*>)/i;

function getGhToken(spawn=cp.spawnSync){
  const r=spawn('gh',['auth','token','--hostname','github.com'],{
    shell:false,encoding:'utf8',timeout:15000,
    stdio:['ignore','pipe','pipe'],maxBuffer:128*1024
  });
  if(!r||r.error||r.status!==0||typeof r.stdout!=='string')
    throw Error('GitHub CLI login is unavailable.');
  const token=r.stdout.trim();
  if(token.length<12||/[\x00-\x20\x7f]/.test(token))
    throw Error('GitHub CLI did not provide a usable login.');
  return token;
}
function decodeDataScript(script){
  if(typeof script!=='string'||script.length<100||script.length>MAX_BODY||
     /<\/script/i.test(script))
    throw Error('The editor data package is invalid.');
  const m=/^\s*window\.NAXX_DATA\s*=\s*([\s\S]*?)\s*;\s*$/.exec(script);
  if(!m)throw Error('The editor data package format is invalid.');
  let data;
  try{data=JSON.parse(m[1]);}
  catch(_){throw Error('The editor data package is not valid JSON.');}
  if(!data||typeof data!=='object'||Array.isArray(data)||
     !Array.isArray(data.resources)||data.resources.length<1||
     data.resources.length>3000)
    throw Error('The editor data structure is invalid.');
  return data;
}
function rebuildSiteContent(originalBytes,updatedScript){
  if(!Buffer.isBuffer(originalBytes)||originalBytes.length<1024)
    throw Error('Original site-content.html is missing.');
  const original=originalBytes.toString('utf8');
  if(!Buffer.from(original,'utf8').equals(originalBytes))
    throw Error('Original site-content.html is not lossless UTF-8.');
  const match=EMBED.exec(original);
  if(!match)throw Error('Original embedded website data was not found.');
  const beforeData=decodeDataScript(match[3].trim());
  const nextData=decodeDataScript(updatedScript.trim());
  const required=Object.keys(beforeData);
  if(required.some(k=>!Object.hasOwn(nextData,k)))
    throw Error('The edited website data dropped an original top-level field.');
  if(Object.keys(nextData).length>required.length+8)
    throw Error('The edited website data added unexpected top-level structures.');
  const replacement=match[1]+updatedScript.trim()+match[4];
  const rebuilt=original.slice(0,match.index)+replacement+
    original.slice(match.index+match[0].length);
  if(rebuilt.length<1024||rebuilt.length>40*1024*1024)
    throw Error('Rebuilt website source size is invalid.');
  return Buffer.from(rebuilt,'utf8');
}
function safeStaticPath(urlPath){
  let decoded=decodeURIComponent((urlPath||'/').split('?')[0]);
  if(decoded===LIVE_PREFIX)decoded=LIVE_PREFIX+'/';
  if(decoded.startsWith(LIVE_PREFIX+'/'))decoded=decoded.slice(LIVE_PREFIX.length);
  if(decoded==='/')decoded='/index.html';
  const rel=decoded.replace(/^\/+/,'').replace(/\//g,path.sep);
  const file=path.resolve(ROOT,rel);
  const prefix=ROOT.endsWith(path.sep)?ROOT:ROOT+path.sep;
  if(file!==ROOT&&!file.startsWith(prefix))throw Error('Forbidden path.');
  return file;
}
function mime(file){
  return ({
    '.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8',
    '.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8',
    '.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg',
    '.jpeg':'image/jpeg','.gif':'image/gif','.webp':'image/webp',
    '.ico':'image/x-icon','.woff':'font/woff','.woff2':'font/woff2',
    '.pdf':'application/pdf',
    '.docx':'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  })[path.extname(file).toLowerCase()]||'application/octet-stream';
}
function injectBridge(bytes){
  const text=bytes.toString('utf8');
  const tag='<script src="'+LIVE_PREFIX+BRIDGE+'"></script>';
  if(text.includes(tag))return bytes;
  const i=text.toLowerCase().lastIndexOf('</body>');
  if(i<0)throw Error('site-content.html has no closing body.');
  return Buffer.from(text.slice(0,i)+tag+text.slice(i),'utf8');
}
function json(res,status,obj){
  const body=Buffer.from(JSON.stringify(obj),'utf8');
  res.writeHead(status,{
    'Content-Type':'application/json; charset=utf-8',
    'Content-Length':body.length,'Cache-Control':'no-store',
    'X-Content-Type-Options':'nosniff'
  });res.end(body);
}
function createOriginalEditorServer({writer}){
  if(!writer||typeof writer.saveSource!=='function')
    throw Error('Protected GitHub writer is required.');
  let origin='';
  const server=http.createServer(async(req,res)=>{
    try{
      const target=new URL(req.url,'http://127.0.0.1');
      if(req.method==='POST'&&target.pathname===SAVE){
        if(req.headers.origin!==origin||
           req.headers['x-naxx-original-editor']!=='save-v1'||
           !/^text\/plain(?:;|$)/i.test(req.headers['content-type']||'')){
          json(res,403,{error:'Protected local Save request was refused.'});return;
        }
        const declared=Number(req.headers['content-length']);
        if(!Number.isSafeInteger(declared)||declared<100||declared>MAX_BODY){
          json(res,413,{error:'Website Save package size was refused.'});return;
        }
        const chunks=[];let total=0;
        for await(const chunk of req){
          total+=chunk.length;
          if(total>declared||total>MAX_BODY)throw Error('Website Save package exceeded its declared size.');
          chunks.push(chunk);
        }
        if(total!==declared)throw Error('Website Save package was incomplete.');
        const bytes=Buffer.concat(chunks);
        const script=bytes.toString('utf8');
        if(!Buffer.from(script,'utf8').equals(bytes))
          throw Error('Website Save package was not valid UTF-8.');
        const original=fs.readFileSync(path.join(ROOT,'site-content.html'));
        const rebuilt=rebuildSiteContent(original,script);
        const saved=await writer.saveSource(rebuilt);
        json(res,200,saved);return;
      }
      if(req.method!=='GET'&&req.method!=='HEAD'){
        json(res,405,{error:'Local editor supports only GET/HEAD and protected Save.'});return;
      }
      let file=safeStaticPath(target.pathname);
      if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');
      if(!fs.existsSync(file)||!fs.statSync(file).isFile()){
        const body=Buffer.from('Not found.','utf8');
        res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8','Content-Length':body.length});
        res.end(req.method==='HEAD'?undefined:body);return;
      }
      let body=fs.readFileSync(file);
      if(path.basename(file)==='site-content.html')body=injectBridge(body);
      res.writeHead(200,{
        'Content-Type':mime(file),'Content-Length':body.length,
        'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'
      });
      res.end(req.method==='HEAD'?undefined:body);
    }catch(error){
      json(res,500,{error:error&&error.message?error.message:'Local editor error.'});
    }
  });
  server.on('listening',()=>{
    const address=server.address();
    origin='http://127.0.0.1:'+address.port;
  });
  return server;
}
async function start({token,request}={}){
  const auth=token||getGhToken();
  const writer=createWriter({request:request||httpsTransport(auth)});
  await writer.ensureEditBranch();
  const server=createOriginalEditorServer({writer});
  await new Promise((ok,bad)=>server.once('error',bad).listen(0,'127.0.0.1',ok));
  const url='http://127.0.0.1:'+server.address().port+LIVE_PREFIX+'/';
  return {server,url,branch:EDIT_BRANCH,repository:REPOSITORY};
}
function openBrowser(url,spawn=cp.spawn){
  if(process.platform!=='win32')return false;
  const child=spawn('cmd.exe',['/c','start','',url],{
    detached:true,stdio:'ignore',windowsHide:true
  });
  child.unref();return true;
}
if(require.main===module){
  (async()=>{
    const running=await start();
    process.stdout.write(
      '\nNaxxramas ORIGINAL website editor\n'+
      '---------------------------------\n'+
      'Open: '+running.url+'\n'+
      'Save target: '+running.repository+' / '+running.branch+'\n'+
      'The live main branch is NOT changed by Save.\n'+
      'Close this window when you are finished editing.\n\n'
    );
    openBrowser(running.url);
  })().catch(error=>{
    process.stderr.write(
      'Original website editor could not start. '+
      (error&&error.message?error.message:'Nothing was changed.')+'\n'
    );
    process.exitCode=1;
  });
}
module.exports=Object.freeze({
  ROOT,LIVE_PREFIX,SAVE,MAX_BODY,getGhToken,decodeDataScript,
  rebuildSiteContent,safeStaticPath,injectBridge,
  createOriginalEditorServer,start,openBrowser
});
