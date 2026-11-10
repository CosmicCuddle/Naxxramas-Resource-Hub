'use strict';
/*
 * EXPLICIT WINDOWS LOCAL PRIVATE DRAFT EDITOR — NEVER AUTOSTARTS.
 *
 * The owner manually runs this CLI after the separate private sandbox has
 * an initial main commit and GitHub CLI has been authorised on their computer.
 * Reads the credential from GitHub CLI into local server memory only.
 * All HTTPS requests are pinned by private-draft-github-store.cjs to the
 * ONE separately named PRIVATE draft repository and a single ZIP path.
 *
 * No token is exposed to the webpage, logged, saved to a project file,
 * sent to the public Resource Hub, or included in source history.
 * No original website checkout is modified and Pages is not published.
 *
 * The owner can close the console to stop the server. No background service.
 */
const cp=require('node:child_process');
const {createCompanion}=require('./local-save-companion.cjs');
const {createPrivateDraftStore,strictHttpsTransport,REPOSITORY}=
  require('./private-draft-github-store.cjs');
function parseArgs(args){
  if(!Array.isArray(args)||args.length!==1||args[0]!=='--private-drafts')
    throw Error('Explicit --private-drafts owner action is required.');
  return Object.freeze({privateDrafts:true});
}
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
async function startOwnerPrivateEditor(args,dependencies={}){
  parseArgs(args);
  const token=(dependencies.getToken||getGhToken)();
  const store=createPrivateDraftStore({
    enabledByExplicitOwnerApproval:true,
    repository:REPOSITORY,token,
    request:dependencies.request||strictHttpsTransport()
  });
  // Verify PRIVATE identity and an existing main branch BEFORE opening
  // a browser or enabling the private-draft connection. An EMPTY repository
  // must be explicitly bootstrapped after separate owner approval.
  const state=await store.status();
  if(state.privateVerified!==true||!state.expectedHead||
     state.repository!==REPOSITORY)
    throw Error('Private draft repository was not independently verified.');
  const server=createCompanion({privateDraftStore:store});
  await new Promise((ok,bad)=>server.once('error',bad).listen(0,'127.0.0.1',ok));
  const port=server.address().port;
  const url='http://127.0.0.1:'+port+'/editor/index.html';
  return Object.freeze({server,url,privateDrafts:true,published:false});
}
if(require.main===module){
  (async()=>{
    const started=await startOwnerPrivateEditor(process.argv.slice(2));
    process.stdout.write(
      'PRIVATE DRAFT EDITOR: '+started.url+'\n'+
      'Save stores unpublished edits only in the private sandbox.\n'+
      'The original public website and GitHub Pages are unchanged.\n'+
      'Close this window to stop the local editor.\n');
    if(process.platform==='win32'){
      const launched=cp.spawnSync('powershell.exe',[
        '-NoLogo','-NoProfile','-Command',
        'Start-Process -FilePath '+JSON.stringify(started.url)
      ],{shell:false,stdio:'ignore',timeout:10000});
      if(launched.error||launched.status!==0)
        process.stdout.write('Open the private editor URL above in your browser.\n');
    }
  })().catch(_=>{
    process.stderr.write(
      'Private editor could not start. Check GitHub CLI login, the existing private sandbox main branch and your local connection. Nothing was saved.\n');
    process.exitCode=1;
  });
}
module.exports=Object.freeze({parseArgs,getGhToken,startOwnerPrivateEditor});
