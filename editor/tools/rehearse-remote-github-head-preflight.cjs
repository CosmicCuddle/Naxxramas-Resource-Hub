'use strict';
/*
 * READ-ONLY REMOTE GITHUB BRANCH SNAPSHOT CHECK.
 * HEAD IS OBSERVED TWICE BUT NOT LOCKED. NEVER USE AS SAVE PERMISSION.
 *
 * A narrow HTTPS GET /repos/{owner}/{repo}/git/ref/heads/{branch} client
 * with Contents:read token. No requests to arbitrary hosts; no writes,
 * uploads, GitHub mutations, credentials in logs, or auto-retries.
 * The production site/editor is NEVER modified by this tool.
 */
const https=require('node:https');
const path=require('node:path');
const {validBranch,verifyCheckoutBaseline}=
  require('./rehearse-local-git-head-preflight.cjs');
const HEX=/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;
const REPO=/^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/;
const EXPECTED_REPO='CosmicCuddle/Naxxramas-Resource-Hub';
const EXPECTED_BRANCH='feature/multi-file-editor-export-2026-11-05';
const MAX_JSON=65536;
const FORMAT='naxx-github-remote-ref-read-only-v1';
function validateIdentity(repo,branch,sha){
  if(typeof repo!=='string'||!REPO.test(repo)||
     repo.split('/').some(s=>s==='.'||s==='..'||s.startsWith('.'))||
     !validBranch(branch)||typeof sha!=='string'||!HEX.test(sha))
    throw Error('Invalid pinned GitHub repository, branch or commit.');
  return {repo,branch,sha};
}
function apiRefPath(repo,branch){
  validateIdentity(repo,branch,'0'.repeat(40));
  const [owner,name]=repo.split('/');
  return '/repos/'+encodeURIComponent(owner)+'/'+encodeURIComponent(name)+
    '/git/ref/heads/'+branch.split('/').map(encodeURIComponent).join('/');
}
function readReference(repo,branch,token){
  const {repo:validatedRepo,branch:validatedBranch}=validateIdentity(
    repo,branch,'0'.repeat(40));
  if(typeof token!=='string'||token.length<10||
     /[\r\n]/.test(token))
    return Promise.reject(Error('Read-only GitHub token was not provided.'));
  return new Promise((resolve,reject)=>{
    // Never allow redirects; the only request target is api.github.com:443.
    const request=https.request({
      protocol:'https:',hostname:'api.github.com',port:443,
      method:'GET',path:apiRefPath(validatedRepo,validatedBranch),
      timeout:10000,
      headers:{
        'Accept':'application/vnd.github+json',
        'Authorization':'Bearer '+token,
        'User-Agent':'Naxx-ReadOnly-Remote-Head-Preflight',
        'X-GitHub-Api-Version':'2022-11-28',
        'Cache-Control':'no-cache'
      }
    },response=>{
      if(response.statusCode!==200){
        response.resume();
        reject(Error('GitHub read-only ref request was unsuccessful.'));
        return;
      }
      const chunks=[];let size=0;
      response.on('data',chunk=>{
        size+=chunk.length;
        if(size>MAX_JSON){
          request.destroy(Error('GitHub ref response exceeded the strict size limit.'));
        }else chunks.push(chunk);
      });
      response.once('end',()=>{
        try{
          if(size===0)throw Error('Empty remote ref response.');
          resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
        }catch(_){reject(Error('GitHub ref response was invalid.'));}
      });
      response.once('error',()=>reject(Error('GitHub read-only ref body could not be read.')));
    });
    request.once('timeout',()=>{
      request.destroy(Error('GitHub read-only ref request timed out.'));
    });
    request.once('error',()=>reject(Error('GitHub read-only ref request failed.')));
    request.end();
  });
}
function parseReference(reply,repo,branch){
  validateIdentity(repo,branch,'0'.repeat(40));
  const expected='refs/heads/'+branch;
  if(!reply||typeof reply!=='object'||Array.isArray(reply)||
     reply.ref!==expected||!reply.object||
     reply.object.type!=='commit'||!HEX.test(reply.object.sha))
    throw Error('Remote GitHub returned an unexpected branch or non-commit ref.');
  // GitHub normally includes a commit-object URL. Validate it if present;
  // never follow it. Validation does not turn the response into a lock.
  const [owner,name]=repo.split('/');
  const url='https://api.github.com/repos/'+encodeURIComponent(owner)+
    '/'+encodeURIComponent(name)+'/git/commits/'+reply.object.sha;
  if(reply.object.url!==undefined&&reply.object.url!==url)
    throw Error('Remote GitHub returned inconsistent commit metadata.');
  return reply.object.sha;
}
async function observeRemoteHead(opts){
  if(!opts||typeof opts!=='object')
    throw Error('A read-only branch snapshot plan is required.');
  const {repo,branch,expectedSha,readRef,checkCheckout}=opts;
  validateIdentity(repo,branch,expectedSha);
  if(typeof readRef!=='function'||typeof checkCheckout!=='function')
    throw Error('Both independent remote and local review functions are required.');
  const first=parseReference(await readRef(repo,branch),repo,branch);
  if(first!==expectedSha)
    throw Error('Remote GitHub branch advanced before source verification.');
  const checked=await checkCheckout(expectedSha);
  if(!checked||checked.checkedOutCommitMatched!==true||
     checked.originalWebsiteSha256Matched!==true||
     checked.canPush!==false||checked.canPublish!==false)
    throw Error('Independently verified local checkout proof is missing.');
  const last=parseReference(await readRef(repo,branch),repo,branch);
  if(last!==expectedSha)
    throw Error('Remote GitHub branch advanced during source verification.');
  return Object.freeze({
    format:FORMAT,readOnly:true,
    repo,branch,expectedCommit:expectedSha,
    remoteRefReadCount:2,
    remoteRefSameAtTwoObservations:true,
    independentlyCheckedLocalCommit:true,
    originalWebsiteSha256Matched:true,
    githubContentsReadOnly:true,
    remoteBranchLocked:false,
    atomicUpdateGuaranteed:false,
    sourceLayoutApproved:false,
    actualEditorSaveConnected:false,
    canApply:false,canPush:false,canMerge:false,canPublish:false,
    dataValuesPrinted:false,repositoryWrites:0
  });
}
function fakeResponse(branch,sha){
  return {ref:'refs/heads/'+branch,
    object:{type:'commit',sha}};
}
async function simulate(){
  const sha='a'.repeat(40),repo=EXPECTED_REPO,branch=EXPECTED_BRANCH;
  const local=async s=>({
    checkedOutCommitMatched:s===sha,
    originalWebsiteSha256Matched:true,
    canPush:false,canPublish:false
  });
  let observed=0;
  const success=await observeRemoteHead({repo,branch,expectedSha:sha,
    readRef:async()=>{observed++;return fakeResponse(branch,sha);},
    checkCheckout:local
  });
  if(observed!==2||success.canPush)
    throw Error('Remote read-only simulation was not conservative.');
  let staleBefore=false;
  try{await observeRemoteHead({repo,branch,expectedSha:sha,
    readRef:async()=>fakeResponse(branch,'b'.repeat(40)),
    checkCheckout:local});}
  catch(e){staleBefore=/advanced before/.test(e.message);}
  let reads=0,staleBetween=false;
  try{await observeRemoteHead({repo,branch,expectedSha:sha,
    readRef:async()=>fakeResponse(branch,++reads===1?sha:'b'.repeat(40)),
    checkCheckout:local});}
  catch(e){staleBetween=/advanced during/.test(e.message);}
  if(!staleBefore||!staleBetween)
    throw Error('Remote branch drift was not refused.');
  return {
    format:'naxx-remote-read-only-simulation-v1',
    matchingTwoReads:observed===2,
    staleRemoteBeforeRejected:staleBefore,
    staleRemoteBetweenRejected:staleBetween,
    privateRepositoryDataPrinted:false,
    networkRequests:0,gitWrites:0,canPush:false,ownerApproved:false
  };
}
function selectCIIdentity(env,mode){
  if(!env||!['--ci-remote','--ci-pr-remote'].includes(mode)||
     env.GITHUB_REPOSITORY!==EXPECTED_REPO||
     !HEX.test(env.GITHUB_SHA||''))
    throw Error('GitHub workflow repository or checked-out commit is not permitted.');
  if(mode==='--ci-remote'){
    if(env.GITHUB_EVENT_NAME!=='push'||
       env.GITHUB_REF!=='refs/heads/'+EXPECTED_BRANCH)
      throw Error('GitHub push branch identity is not permitted.');
    return Object.freeze({
      mode:'push',headCommit:env.GITHUB_SHA,checkoutCommit:env.GITHUB_SHA,
      checkoutIsSyntheticPRMerge:false
    });
  }
  if(env.GITHUB_EVENT_NAME!=='pull_request'||
     env.PR_HEAD_REPO!==EXPECTED_REPO||
     env.PR_HEAD_REF!==EXPECTED_BRANCH||
     String(env.PR_NUMBER)!=='56'||
     !HEX.test(env.PR_HEAD_SHA||'')||
     env.GITHUB_REF!=='refs/pull/56/merge')
    throw Error('GitHub pull-request branch identity is not permitted.');
  return Object.freeze({
    mode:'pull_request',headCommit:env.PR_HEAD_SHA,
    checkoutCommit:env.GITHUB_SHA,
    checkoutIsSyntheticPRMerge:true
  });
}
async function runCli(){
  if(process.argv.length!==3||![
    '--simulate','--ci-remote','--ci-pr-remote'
  ].includes(process.argv[2]))
    throw Error('An explicitly supported read-only mode is required.');
  const simulation=await simulate();
  if(process.argv[2]==='--simulate'){
    process.stdout.write(JSON.stringify(simulation,null,2)+'\n');
    return;
  }
  const id=selectCIIdentity(process.env,process.argv[2]);
  const token=process.env.GITHUB_TOKEN;
  const proof=await observeRemoteHead({
    repo:EXPECTED_REPO,branch:EXPECTED_BRANCH,
    expectedSha:id.headCommit,
    readRef:(r,b)=>readReference(r,b,token),
    // On a PR, GITHUB_SHA is a synthetic test merge commit and
    // PR_HEAD_SHA is the remote branch head: do not conflate them.
    checkCheckout:()=>verifyCheckoutBaseline(
      path.resolve(__dirname,'..','..'),id.checkoutCommit)
  });
  process.stdout.write(JSON.stringify({
    simulation,
    remoteObservation:proof,
    workflowMode:id.mode,
    checkoutIsSyntheticPRMerge:id.checkoutIsSyntheticPRMerge,
    observedRemoteHeadSameAsCheckedOutCommit:
      id.checkoutCommit===id.headCommit,
    remoteHeadContentsIndependentlyVerified:false,
    remoteBranchLocked:false,
    canApply:false,canPush:false,canPublish:false
  },null,2)+'\n');
}
if(require.main===module){
  runCli().catch(_=>{
    process.stderr.write('Private remote GitHub head preflight stopped safely.\n');
    process.exitCode=1;
  });
}
module.exports={EXPECTED_REPO,EXPECTED_BRANCH,FORMAT,MAX_JSON,
  validateIdentity,apiRefPath,parseReference,readReference,
  observeRemoteHead,selectCIIdentity,fakeResponse,simulate};
