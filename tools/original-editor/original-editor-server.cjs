'use strict';
/*
 * One local launcher for the ORIGINAL visual editor. All website routes and
 * native editing controls are unchanged. Only the local export action is
 * adapted. GitHub receives one checked source file on a review branch.
 */
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
const {locateData,prepareSavedSource,sameShell,localPreview}=require('./native-save-core.cjs');
const {REPO,SOURCE,MAX_FILE,blobOid,getToken,transport,createStore}=require('./github-native-store.cjs');
const ROOT=path.resolve(__dirname,'..','..');
const PREFIX='/Naxxramas-Resource-Hub/';
const MIME={
  '.html':'text/html; charset=utf-8','.htm':'text/html; charset=utf-8',
  '.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8',
  '.json':'application/json; charset=utf-8','.svg':'image/svg+xml',
  '.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp',
  '.gif':'image/gif','.ico':'image/x-icon','.woff':'font/woff','.woff2':'font/woff2',
  '.pdf':'application/pdf','.docx':'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.wasm':'application/wasm','.txt':'text/plain; charset=utf-8'
};
const CSP="default-src 'self' data: blob:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https:; img-src 'self' data: blob: https:; font-src 'self' data: https:; connect-src 'self'; frame-src 'self' https:; object-src 'none'; base-uri 'self'; frame-ancestors 'self'";
const SESSION=/^[a-f0-9]{64}$/;
const PUBLIC_ROOTS=new Set(['assets','apply','new-players','rules','patches','change-notes','talents','game-clients']);
function safePublicPath(relative){
  if(relative==='index.html'||relative===SOURCE)return true;
  const parts=relative.split('/');
  return parts.length>1&&PUBLIC_ROOTS.has(parts[0])&&
    parts.every(p=>p&&p!=='.'&&p!=='..'&&!p.startsWith('.')&&
      !/[\x00-\x1f\x7f\\]/.test(p));
}
function routePath(url){
  let p;
  try{p=decodeURIComponent(new URL(url,'http://127.0.0.1').pathname);}
  catch(_){return null;}
  if(p.startsWith(PREFIX))p='/'+p.slice(PREFIX.length);
  if(p==='/'||p==='/index.html')return 'index.html';
  const relative=p.slice(1);
  if(!p.startsWith('/')||p.includes('\\')||p.includes('\0'))return null;
  if(p.endsWith('/'))return safePublicPath(relative+'index.html')?relative+'index.html':null;
  return safePublicPath(relative)?relative:null;
}
function exactText(bytes){
  const s=bytes.toString('utf8');
  if(!Buffer.from(s,'utf8').equals(bytes))throw Error('Website source encoding is not lossless UTF-8.');
  return s;
}
async function loadFile(root,relative,sha,store){
  if(!safePublicPath(relative))throw Error('Unapproved website file.');
  try{
    const filename=path.join(root,...relative.split('/'));
    const real=fs.realpathSync(filename);
    const within=path.relative(fs.realpathSync(root),real);
    if(within&&!within.startsWith('..'+path.sep)&&within!=='..'&&!path.isAbsolute(within)&&
       fs.statSync(real).isFile()&&fs.statSync(real).size<=MAX_FILE){
      const b=fs.readFileSync(real);
      if(blobOid(b)===sha)return b;
    }
  }catch(_){}
  // A changed or missing local file is read at its exact Git object identity,
  // rather than requiring the owner to download another website ZIP.
  return store.blob(sha);
}
function bridgeScript(session){
  if(!SESSION.test(session))throw Error('Invalid local editor session.');
  return '('+function(token){
    'use strict';
    let busy=false;
    const buttons=()=>Array.from(document.querySelectorAll('[onclick="exportUpdatedHtml()"]'));
    const linkOk=url=>typeof url==='string'&&
      /^https:\/\/github\.com\/CosmicCuddle\/Naxxramas-Resource-Hub\/(?:pull\/[1-9]\d*|tree\/editor-saves\/native-[a-f0-9]{12})$/.test(url);
    function status(text,url){
      for(const button of buttons()){
        let notice=button.parentNode.querySelector('[data-naxx-native-save-status]');
        if(!notice){
          notice=document.createElement('span');
          notice.setAttribute('data-naxx-native-save-status','');
          notice.style.cssText='display:inline-block;margin:4px 8px;font-size:0.9em';
          button.insertAdjacentElement('afterend',notice);
        }
        notice.textContent=text;
        if(linkOk(url)){
          const a=document.createElement('a');
          a.href=url;a.target='_blank';a.rel='noopener noreferrer';
          a.style.marginLeft='8px';a.textContent='View GitHub update';
          notice.appendChild(a);
        }
      }
    }
    window.NaxxOriginalEditorSave=async function(data){
      if(busy)return;
      if(!window.confirm('Save your website changes to GitHub for review?\n\nThe Resource Hub repository is public. Your changes will be stored on a separate review branch. Your live website will NOT change until you approve and merge the update.'))return;
      let snapshot;
      try{snapshot=JSON.stringify(data);}
      catch(_){window.alert('Your website data could not be saved. Your edits are still open.');return;}
      busy=true;
      for(const b of buttons()){b.disabled=true;b.textContent='Saving to GitHub…';}
      status('Saving…');
      try{
        const response=await fetch('/__naxx_editor/save',{
          method:'POST',cache:'no-store',credentials:'same-origin',
          redirect:'error',headers:{'Content-Type':'application/json',
            'X-Naxx-Editor-Session':token},body:snapshot
        });
        const result=await response.json();
        if(!response.ok||!result||result.published!==false||
           typeof result.changed!=='boolean')
          throw Error(result&&typeof result.error==='string'?result.error:'Save was not confirmed.');
        if(!result.changed){
          status('No new changes to save.',result.reviewUrl||null);
        }else{
          const url=result.reviewUrl||result.branchUrl;
          if(!linkOk(url))throw Error('The GitHub Save link was not verified.');
          const more=JSON.stringify(data)!==snapshot;
          status(more?'Saved earlier edits. Newer edits are still unsaved.':
            'Saved to GitHub ✓',url);
        }
      }catch(error){
        status('Save not confirmed. Keep your editor open.');
        window.alert(error&&error.message?error.message:'Save not confirmed. Your edits are still open.');
      }finally{
        busy=false;
        for(const b of buttons()){b.disabled=false;b.textContent='Save to GitHub';}
      }
    };
  }.toString()+')('+JSON.stringify(session)+');\n';
}

function createOriginalServer({root,store,state,source}){
  if(!store||!state||typeof source!=='string'||!Array.isArray(state.listing?.tree))
    throw Error('The original website was not verified.');
  let current=source,preview=localPreview(current),saving=false;
  const session=crypto.randomBytes(32).toString('hex');
  const files=new Map();
  for(const e of state.listing.tree)
    if(e.type==='blob'&&['100644','100755'].includes(e.mode)&&safePublicPath(e.path))
      files.set(e.path,e.sha);
  if(!files.has('index.html')||!files.has(SOURCE))
    throw Error('Original website files are incomplete.');
  const server=http.createServer(async(req,res)=>{
    const host='127.0.0.1:'+server.address()?.port;
    function send(status,body,type='application/json; charset=utf-8'){
      if(res.destroyed)return;
      const bytes=Buffer.isBuffer(body)?body:Buffer.from(type.startsWith('application/json')?
        JSON.stringify(body):String(body),'utf8');
      res.writeHead(status,{'Content-Type':type,'Content-Length':bytes.length,
        'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',
        'Referrer-Policy':'no-referrer','Content-Security-Policy':CSP,
        'Cross-Origin-Resource-Policy':'same-origin'});
      if(req.method==='HEAD')res.end();else res.end(bytes);
    }
    const fail=(status,error)=>send(status,{error,published:false});
    if(req.headers.host!==host){fail(403,'Only the local editor can use this connection.');return;}
    const url=req.url||'';
    if(req.method==='POST'&&url==='/__naxx_editor/save'){
      const supplied=req.headers['x-naxx-editor-session'];
      const valid=typeof supplied==='string'&&SESSION.test(supplied)&&
        crypto.timingSafeEqual(Buffer.from(supplied,'hex'),Buffer.from(session,'hex'));
      if(req.headers.origin!=='http://'+host||
         (req.headers['sec-fetch-site']&&req.headers['sec-fetch-site']!=='same-origin')||
         !valid||req.headers['content-type']!=='application/json'){
        fail(403,'This Save request was not authorised by the local editor.');return;
      }
      if(saving||state.uncertain){
        fail(409,state.uncertain?'An earlier Save has an uncertain result. Keep your edits open and check GitHub before retrying.':'A Save is already running.');return;
      }
      const size=Number(req.headers['content-length']);
      if(!Number.isSafeInteger(size)||size<2||size>MAX_FILE){
        fail(413,'The website data is outside the supported size limit.');return;
      }
      saving=true;
      try{
        let count=0;const chunks=[];
        for await(const chunk of req){
          count+=chunk.length;
          if(count>size||count>MAX_FILE)throw Error('Incomplete website data.');
          chunks.push(chunk);
        }
        if(count!==size)throw Error('Incomplete website data.');
        let candidate;
        try{
          candidate=prepareSavedSource(current,exactText(Buffer.concat(chunks)));
          // Verify the same original Save controls can still be served after editing.
          if(candidate.changed)localPreview(candidate.html);
        }catch(error){
          fail(422,error.message);return;
        }
        if(!candidate.changed){
          send(200,{changed:false,published:false});return;
        }
        const result=await store.save(state,Buffer.from(candidate.html,'utf8'));
        if(!result||result.changed!==true||result.published!==false)
          throw Error('GitHub Save was not independently confirmed.');
        current=candidate.html;preview=localPreview(current);
        send(200,result);
      }catch(_){
        fail(503,state.uncertain?
          'GitHub Save outcome is uncertain. Keep your edits open and inspect the editor-saves branch before retrying.':
          'GitHub Save was refused or not confirmed. Your changes remain open. Check the current GitHub branch before trying again.');
      }finally{saving=false;}
      return;
    }
    if(req.method!=='GET'&&req.method!=='HEAD'){fail(405,'Unsupported local request.');return;}
    if(url==='/__naxx_editor/bridge.js'){
      send(200,bridgeScript(session),MIME['.js']);return;
    }
    let relative=routePath(url);
    if(relative&&!files.has(relative)&&safePublicPath(relative+'/index.html')&&
       files.has(relative+'/index.html'))relative+='/index.html';
    if(!relative||!files.has(relative)){fail(404,'Original website file not found.');return;}
    try{
      if(relative===SOURCE){
        send(200,preview,MIME['.html']);return;
      }
      const bytes=await loadFile(root,relative,files.get(relative),store);
      send(200,bytes,MIME[path.extname(relative).toLowerCase()]||'application/octet-stream');
    }catch(_){fail(503,'An original website file could not be independently verified.');}
  });
  server.requestTimeout=150000;
  server.headersTimeout=10000;
  server.keepAliveTimeout=5000;
  return server;
}

async function startOriginalEditor(args,dependencies={}){
  if(!Array.isArray(args)||args.length!==1||args[0]!=='--original-editor')
    throw Error('Start the original editor with its Windows launcher.');
  const store=dependencies.store||createStore(transport(getToken()));
  const root=dependencies.root||ROOT,state=await store.open();
  const main=exactText(await loadFile(root,SOURCE,state.mainSource,store));
  const source=state.source===state.mainSource?main:exactText(await loadFile(root,SOURCE,state.source,store));
  if(!sameShell(main,source))throw Error('The saved editor branch changed the original website code.');
  if(source!==main)
    prepareSavedSource(main,JSON.stringify(locateData(source).data));
  const server=createOriginalServer({root,store,state,source});
  await new Promise((resolve,reject)=>server.once('error',reject).listen(0,'127.0.0.1',resolve));
  return {server,url:'http://127.0.0.1:'+server.address().port+'/'};
}
if(require.main===module){
  startOriginalEditor(process.argv.slice(2)).then(({url})=>{
    console.log('Naxxramas original visual editor: '+url);
    console.log('Use your existing Admin Mode and Save to GitHub button.');
    console.log('Save creates a review branch; the live website is not published.');
    console.log('Close this window when you have finished.');
    if(process.platform==='win32'){
      const r=spawnSync('powershell.exe',['-NoLogo','-NoProfile','-Command',
        'Start-Process -FilePath '+JSON.stringify(url)],
        {stdio:'ignore',timeout:10000});
      if(r.error||r.status!==0)console.log('Open the local URL above in your browser.');
    }
  }).catch(error=>{
    console.error('The original editor could not start. '+(error?.message||'Check your local GitHub connection.'));
    process.exitCode=1;
  });
}
module.exports={createOriginalServer,startOriginalEditor,routePath,bridgeScript,loadFile};
