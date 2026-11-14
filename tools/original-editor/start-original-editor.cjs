'use strict';
/*
 * ORIGINAL Naxxramas visual Admin editor — local authoring server.
 *
 * Serves the extracted Resource Hub under the SAME /Naxxramas-Resource-Hub/
 * path used by GitHub Pages, so the existing Admin UI and navigation behave
 * normally. The 31 MB site-content.html is patched IN MEMORY only: the
 * original export sanitisation remains unchanged, while its obsolete ZIP /
 * index.html download tail is replaced by the local protected Save bridge.
 *
 * No local website file is overwritten. Save can update only
 * site-content.html on editor-saves/visual-admin through GitHub CLI.
 */
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const cp=require('node:child_process');
const {status:githubStatus,saveHtml,gitBlobSha,REPOSITORY,BRANCH,FILE,MAX_HTML}=
  require('./github-visual-admin-writer.cjs');

const PREFIX='/Naxxramas-Resource-Hub/';
const ROOT=path.resolve(__dirname,'..','..');
const BRIDGE=path.join(__dirname,'original-editor-save-bridge.js');
const SESSION=crypto.randomBytes(32).toString('hex');
const ORIGINAL_SOURCE_GIT_BLOB_SHA='71ab9f2bf4cf12282fcbe135f7ec787805715b62';
function embeddedDataBounds(text){
  if(typeof text!=='string')throw Error('Website source must be text.');
  const re=/<script\\b[^>]*\\bid=(["'])embedded-data\\1[^>]*>/ig;
  const matches=[...text.matchAll(re)];
  if(matches.length!==1)throw Error('Expected exactly one embedded-data script.');
  const open=matches[0];
  const start=open.index+open[0].length;
  const end=text.toLowerCase().indexOf('</script>',start);
  if(end<0)throw Error('Embedded data script did not close.');
  const inner=text.slice(start,end).trim();
  if(!inner.startsWith('window.NAXX_DATA = ')||!inner.endsWith(';')||
     inner.length<1000000||inner.length>38*1024*1024)
    throw Error('Embedded website data did not match the original Admin format.');
  return {start,end,inner};
}
function rebuildOriginalSiteContent(originalBytes,exportedBytes){
  if(!Buffer.isBuffer(originalBytes)||!Buffer.isBuffer(exportedBytes))
    throw Error('Original and exported website bytes are required.');
  const localOriginal=originalBytes.toString('utf8');
  const exported=exportedBytes.toString('utf8');
  if(!Buffer.from(localOriginal,'utf8').equals(originalBytes)||
     !Buffer.from(exported,'utf8').equals(exportedBytes))
    throw Error('Website source was not valid UTF-8.');
  // GitHub ZIPs retain LF while Git for Windows may present CRLF. Always
  // reconstruct the GitHub-bound file with canonical LF bytes so Windows
  // line endings can never turn the whole 31 MB file into a false change.
  const original=localOriginal.replace(/\\r\\n/g,'\\n');
  if(gitBlobSha(Buffer.from(original,'utf8'))!==ORIGINAL_SOURCE_GIT_BLOB_SHA)
    throw Error('The local original site-content.html is not the approved website source.');
  const base=embeddedDataBounds(original);
  const edited=embeddedDataBounds(exported);
  const rebuilt=Buffer.from(
    original.slice(0,base.start)+edited.inner+original.slice(base.end),
    'utf8'
  );
  const check=embeddedDataBounds(rebuilt.toString('utf8'));
  if(check.inner!==edited.inner||
     rebuilt.length<20*1024*1024||rebuilt.length>MAX_HTML)
    throw Error('Edited website data could not be rebuilt into the original source shell.');
  return rebuilt;
}
const MIME=new Map([
  ['.html','text/html; charset=utf-8'],['.htm','text/html; charset=utf-8'],
  ['.css','text/css; charset=utf-8'],['.js','text/javascript; charset=utf-8'],
  ['.json','application/json; charset=utf-8'],['.svg','image/svg+xml'],
  ['.png','image/png'],['.jpg','image/jpeg'],['.jpeg','image/jpeg'],
  ['.gif','image/gif'],['.webp','image/webp'],['.ico','image/x-icon'],
  ['.woff','font/woff'],['.woff2','font/woff2'],['.ttf','font/ttf'],
  ['.wasm','application/wasm'],['.pdf','application/pdf'],
  ['.docx','application/vnd.openxmlformats-officedocument.wordprocessingml.document']
]);
function patchOriginalEditor(html){
  if(typeof html!=='string'||html.length<20*1024*1024)
    throw Error('Original website source is missing or incomplete.');
  const fn='function exportUpdatedHtml(){';
  const first=html.indexOf(fn);
  if(first<0||html.indexOf(fn,first+fn.length)>=0)
    throw Error('Expected exactly one original visual Admin export function.');
  const outputMarker='  const output = "<!doctype html>\\n" + clone.outerHTML;';
  const output=html.indexOf(outputMarker,first);
  if(output<0)throw Error('Original visual Admin output builder was not found.');
  const tail=html.indexOf('  const zipBlob =',output+outputMarker.length);
  const init=html.indexOf('init();',tail);
  const end=init>=0?html.lastIndexOf('}',init):-1;
  if(tail<0||init<0||end<tail||init-end>32||end-tail>7000)
    throw Error('Original visual Admin export tail did not match the reviewed shape.');
  const eol=html.includes('\\r\\n')?'\\r\\n':'\\n';
  const oldTail=html.slice(tail,end);
  if(!oldTail.includes('name:"index.html"')||
     !oldTail.includes('Naxxramas_Resource_Hub_GitHub_Update.zip')||
     !oldTail.includes('replace the existing index.html'))
    throw Error('Obsolete original export tail was not recognised safely.');
  const localTail=[
    '',
    '',
    '  if(typeof window.naxxLocalSaveUpdatedSite !== "function"){',
    '    adminMsg("Local Save bridge is unavailable. Your edits are still open and nothing was published.","error");',
    '    return;',
    '  }',
    '',
    '  window.naxxLocalSaveUpdatedSite(output);'
  ].join(eol);
  let patched=html.slice(0,tail)+localTail+html.slice(end);
  const lower=patched.toLowerCase();
  const body=lower.lastIndexOf('</body>');
  if(body<0)throw Error('Original website closing body was not found.');
  const tag='\n<script src="/__naxx_local_original_save_bridge.js"></script>\n';
  patched=patched.slice(0,body)+tag+patched.slice(body);
  const patchedInit=patched.indexOf('init();',first);
  const fnEnd=patchedInit>=0?patched.lastIndexOf('}',patchedInit):-1;
  const savedFunction=patched.slice(first,fnEnd);
  if(!savedFunction.includes('clone.querySelector("#resourceGrid")')||
     !savedFunction.includes('JSON.stringify(DATA)')||
     !savedFunction.includes('naxxLocalSaveUpdatedSite(output)')||
     savedFunction.includes('name:"index.html"')||
     savedFunction.includes('Naxxramas_Resource_Hub_GitHub_Update.zip'))
    throw Error('Original editor Save bridge did not preserve the reviewed sanitisation boundary.');
  return patched;
}
function safeLocalFile(urlPath){
  if(!urlPath.startsWith(PREFIX))return null;
  let rel=decodeURIComponent(urlPath.slice(PREFIX.length));
  if(!rel)rel='index.html';
  rel=rel.replace(/\\/g,'/');
  if(rel.includes('\0')||rel.split('/').some(x=>x==='..'||x==='.git'))
    return null;
  let full=path.resolve(ROOT,rel);
  const prefix=ROOT.endsWith(path.sep)?ROOT:ROOT+path.sep;
  if(full!==ROOT&&!full.startsWith(prefix))return null;
  if(fs.existsSync(full)&&fs.statSync(full).isDirectory())full=path.join(full,'index.html');
  return full;
}
function writeJson(res,status,data){
  const body=Buffer.from(JSON.stringify(data),'utf8');
  res.writeHead(status,{
    'Content-Type':'application/json; charset=utf-8',
    'Content-Length':String(body.length),
    'Cache-Control':'no-store',
    'X-Content-Type-Options':'nosniff',
    'X-Frame-Options':'DENY',
    'Referrer-Policy':'no-referrer'
  });
  res.end(body);
}
function createOriginalEditorServer(dependencies={}){
  const getStatus=dependencies.status||githubStatus;
  const save=dependencies.saveHtml||saveHtml;
  const root=dependencies.root||ROOT;
  const bridgeFile=dependencies.bridgeFile||BRIDGE;
  const session=dependencies.session||SESSION;
  const server=http.createServer(async(req,res)=>{
    const address=server.address();
    const host='127.0.0.1:'+(address&&address.port);
    if(req.headers.host!==host){
      writeJson(res,403,{error:'Only the local original editor is allowed.'});return;
    }
    let pathname;
    try{pathname=new URL(req.url,'http://'+host).pathname;}
    catch(_){writeJson(res,404,{error:'Not found.'});return;}
    if(req.method==='GET'&&pathname==='/'){
      res.writeHead(302,{Location:PREFIX,'Cache-Control':'no-store'});res.end();return;
    }
    if(req.method==='GET'&&pathname==='/__naxx_local_original_save_bridge.js'){
      const bytes=fs.readFileSync(bridgeFile);
      res.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8',
        'Content-Length':String(bytes.length),'Cache-Control':'no-store',
        'X-Content-Type-Options':'nosniff'});
      res.end(bytes);return;
    }
    if(req.method==='GET'&&pathname==='/__naxx_api/status'){
      try{
        const state=getStatus();
        writeJson(res,200,{format:'naxx-original-editor-save-status-v1',
          ready:true,repository:REPOSITORY,branch:BRANCH,file:FILE,
          expectedHead:state.expectedHead,published:false,csrfToken:session});
      }catch(_){
        writeJson(res,503,{error:'GitHub draft Save is not ready. Check GitHub CLI authentication.'});
      }
      return;
    }
    if(req.method==='POST'&&pathname==='/__naxx_api/save'){
      const origin='http://'+host;
      const csrf=req.headers['x-naxx-csrf-token'];
      const expected=req.headers['x-naxx-expected-head'];
      if(req.headers.origin!==origin||
         typeof csrf!=='string'||csrf!==session||
         typeof expected!=='string'||!/^[a-f0-9]{40}$/.test(expected)||
         !/^text\/html(?:;\s*charset=utf-8)?$/i.test(req.headers['content-type']||'')){
        writeJson(res,403,{error:'Local Save session was not verified.'});return;
      }
      const declared=Number(req.headers['content-length']);
      if(!Number.isSafeInteger(declared)||declared<1024*1024||declared>MAX_HTML){
        writeJson(res,413,{error:'Generated website file is outside the protected size range.'});return;
      }
      try{
        let size=0;const chunks=[];
        for await(const chunk of req){
          size+=chunk.length;
          if(size>declared||size>MAX_HTML)throw Error('Oversized Save.');
          chunks.push(chunk);
        }
        if(size!==declared)throw Error('Incomplete Save body.');
        const exported=Buffer.concat(chunks);
        const original=fs.readFileSync(path.join(root,'site-content.html'));
        const rebuilt=rebuildOriginalSiteContent(original,exported);
        const result=save(rebuilt,expected);
        writeJson(res,200,{format:'naxx-original-editor-save-result-v1',
          ...result,published:false,mainUpdated:false});
      }catch(_){
        writeJson(res,503,{error:'Save was not confirmed. Your editor remains open; do not assume GitHub changed.'});
      }
      return;
    }
    if(req.method!=='GET'&&req.method!=='HEAD'){
      writeJson(res,405,{error:'Method not allowed.'});return;
    }
    // Serve both the real GitHub Pages base path and a redirect from root.
    let full;
    if(dependencies.root){
      // Tests may supply a disposable root.
      if(!pathname.startsWith(PREFIX)){writeJson(res,404,{error:'Not found.'});return;}
      let rel=decodeURIComponent(pathname.slice(PREFIX.length))||'index.html';
      full=path.resolve(root,rel);
      const rp=root.endsWith(path.sep)?root:root+path.sep;
      if(full!==root&&!full.startsWith(rp)){writeJson(res,403,{error:'Forbidden.'});return;}
      if(fs.existsSync(full)&&fs.statSync(full).isDirectory())full=path.join(full,'index.html');
    }else full=safeLocalFile(pathname);
    if(!full||!fs.existsSync(full)||!fs.statSync(full).isFile()){
      res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'});
      res.end('Not found.');return;
    }
    try{
      let bytes;
      if(path.basename(full)==='site-content.html'&&path.dirname(full)===root){
        bytes=Buffer.from(patchOriginalEditor(fs.readFileSync(full,'utf8')),'utf8');
      }else bytes=fs.readFileSync(full);
      const type=MIME.get(path.extname(full).toLowerCase())||'application/octet-stream';
      res.writeHead(200,{'Content-Type':type,'Content-Length':String(bytes.length),
        'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
      if(req.method==='HEAD')res.end();else res.end(bytes);
    }catch(_){
      res.writeHead(500,{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'});
      res.end('Local editor could not safely serve this file.');
    }
  });
  return server;
}
async function start(){
  // Refuse to open the editor unless the fixed Save branch and GitHub CLI
  // authentication can be read successfully.
  githubStatus();
  const server=createOriginalEditorServer();
  await new Promise((ok,bad)=>server.once('error',bad).listen(0,'127.0.0.1',ok));
  const url='http://127.0.0.1:'+server.address().port+PREFIX;
  process.stdout.write(
    'NAXXRAMAS ORIGINAL EDITOR: '+url+'\n'+
    'Use the website exactly as before, enter Admin Mode, edit, then choose Save Website Changes.\n'+
    'Save updates only GitHub branch '+BRANCH+'; main and the live site are not published.\n'+
    'Close this window when you finish editing.\n'
  );
  if(process.platform==='win32'){
    const r=cp.spawnSync('powershell.exe',['-NoLogo','-NoProfile','-Command',
      'Start-Process -FilePath '+JSON.stringify(url)],
      {shell:false,stdio:'ignore',timeout:10000});
    if(r.error||r.status!==0)process.stdout.write('Open the URL above in your browser.\n');
  }
  return server;
}
if(require.main===module){
  start().catch(()=>{
    process.stderr.write('Original editor could not start. Check Node.js, GitHub CLI login and the protected GitHub draft branch. Nothing was changed.\n');
    process.exitCode=1;
  });
}
module.exports=Object.freeze({PREFIX,ROOT,ORIGINAL_SOURCE_GIT_BLOB_SHA,
  embeddedDataBounds,rebuildOriginalSiteContent,patchOriginalEditor,
  createOriginalEditorServer,start});
