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
const path=require('node:path');
const {createCompanion}=require('./local-save-companion.cjs');
const {createOriginalAdminGitHubStore,strictHttpsTransport,REPOSITORY}=
  require('./original-admin-github-store.cjs');
function parseArgs(args){
  if(!Array.isArray(args)||args.length!==1||
     !['--original-admin','--private-drafts'].includes(args[0]))
    throw Error('Explicit --original-admin owner action is required.');
  return Object.freeze({originalAdmin:true});
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
  const store=createOriginalAdminGitHubStore({
    enabledByExplicitOwnerApproval:true,
    repository:REPOSITORY,token,
    request:dependencies.request||strictHttpsTransport()
  });
  const state=await store.status();
  if(state.repository!==REPOSITORY||
     state.branch!=='editor-saves/original-admin'||
     !state.expectedHead||state.liveMainWriteAllowed!==false||
     state.published!==false)
    throw Error('Original Admin GitHub draft connection was not verified.');
  const server=createCompanion({
    originalAdminStore:store,
    serveOriginalSite:true,
    siteDir:path.resolve(__dirname,'..','..')
  });
  await new Promise((ok,bad)=>server.once('error',bad).listen(0,'127.0.0.1',ok));
  const port=server.address().port;
  const url='http://127.0.0.1:'+port+'/Naxxramas-Resource-Hub/';
  return Object.freeze({server,url,originalAdmin:true,published:false});
}
if(require.main===module){
  (async()=>{
    const started=await startOwnerPrivateEditor(process.argv.slice(2));
    process.stdout.write(
      'ORIGINAL NAXXRAMAS EDITOR: '+started.url+'\n'+
      'Save writes only to GitHub draft branch editor-saves/original-admin.\n'+
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
      'Original editor could not start. Check GitHub CLI login and your local connection. Nothing was saved.\n');
    process.exitCode=1;
  });
}
module.exports=Object.freeze({parseArgs,getGhToken,startOwnerPrivateEditor});
