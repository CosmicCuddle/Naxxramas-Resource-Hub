'use strict';
/*
 * RESEARCH ONLY: compare the exact branch ref and Git commit TREE reported
 * over read-only GitHub APIs with an independently pinned LOCAL Git checkout.
 *
 * This cannot reserve a branch, authorize Save, authenticate who authored a
 * commit, upload data, or update any ref. No browser-side credentials.
 * GitHub Actions may exercise this only on PR #57, with contents:read.
 */
const https=require('node:https');
const path=require('node:path');
const {readReference,parseReference,EXPECTED_REPO}=
  require('./rehearse-remote-github-head-preflight.cjs');
const {runGit,verifyCheckoutBaseline}=
  require('./rehearse-local-git-head-preflight.cjs');

const RESEARCH_BRANCH='research/read-only-revision-chain-2026-11-08';
const SHA=/^[a-f0-9]{40}$/;
const LIMIT=256*1024;
const FORMAT='naxx-research-remote-commit-tree-read-only-v1';
function checkIdentity(repo,branch,commit){
  if(repo!==EXPECTED_REPO||branch!==RESEARCH_BRANCH||
     !SHA.test(commit||''))
    throw Error('Unapproved GitHub repository, research branch or pinned commit.');
}
function commitApiPath(repo,commit){
  checkIdentity(repo,RESEARCH_BRANCH,commit);
  return '/repos/CosmicCuddle/Naxxramas-Resource-Hub/git/commits/'+commit;
}
function parseCommitTree(reply,repo,commit){
  checkIdentity(repo,RESEARCH_BRANCH,commit);
  const base='https://api.github.com'+commitApiPath(repo,commit);
  if(!reply||typeof reply!=='object'||Array.isArray(reply)||
     reply.sha!==commit||!reply.tree||typeof reply.tree!=='object'||
     !SHA.test(reply.tree.sha||''))
    throw Error('GitHub commit response is not the exact pinned Git object/tree.');
  if(reply.url!==undefined&&reply.url!==base)
    throw Error('GitHub commit response contained a mismatched API URL.');
  const treeUrl='https://api.github.com/repos/CosmicCuddle/Naxxramas-Resource-Hub/git/trees/'+reply.tree.sha;
  if(reply.tree.url!==undefined&&reply.tree.url!==treeUrl)
    throw Error('GitHub commit tree points outside the reviewed Git repository.');
  return reply.tree.sha;
}
function readCommitTree(repo,commit,token){
  checkIdentity(repo,RESEARCH_BRANCH,commit);
  if(typeof token!=='string'||token.length<10||/[\r\n]/.test(token))
    return Promise.reject(Error('Read-only GitHub token was not provided.'));
  return new Promise((resolve,reject)=>{
    const request=https.request({
      protocol:'https:',hostname:'api.github.com',port:443,
      method:'GET',path:commitApiPath(repo,commit),timeout:10000,
      headers:{
        Accept:'application/vnd.github+json',
        Authorization:'Bearer '+token,
        'X-GitHub-Api-Version':'2022-11-28',
        'Cache-Control':'no-cache',
        'User-Agent':'Naxx-Research-Remote-Tree-ReadOnly'
      }
    },response=>{
      if(response.statusCode!==200){
        response.resume();
        reject(Error('Read-only GitHub commit request was unsuccessful.'));
        return;
      }
      const parts=[];let size=0;
      response.on('data',part=>{
        size+=part.length;
        if(size>LIMIT)request.destroy(Error('GitHub commit response exceeded safe size.'));
        else parts.push(part);
      });
      response.once('end',()=>{
        try{
          if(!size)throw Error('Empty GitHub commit response.');
          resolve(JSON.parse(Buffer.concat(parts).toString('utf8')));
        }catch(_){reject(Error('GitHub commit response was malformed.'));}
      });
      response.once('error',()=>reject(Error('GitHub commit response was interrupted.')));
    });
    request.once('timeout',()=>request.destroy(Error('GitHub commit request timed out.')));
    request.once('error',()=>reject(Error('Read-only GitHub commit request failed.')));
    request.end();
  });
}
function inspectLocalCheckout(checkout,commit,tree){
  if(typeof checkout!=='string'||!path.isAbsolute(checkout)||
     !SHA.test(commit||'')||!SHA.test(tree||''))
    throw Error('A pinned absolute local Git checkout and tree are required.');
  const beforeCommit=runGit(checkout,['rev-parse','--verify','HEAD^{commit}']).trim();
  const beforeTree=runGit(checkout,['rev-parse','--verify','HEAD^{tree}']).trim();
  if(beforeCommit!==commit||beforeTree!==tree)
    throw Error('The exact checked-out commit/tree differs from GitHub.');
  // The original immutable website must be an ordinary tracked Git blob.
  const original=verifyCheckoutBaseline(checkout,commit);
  if(original.checkedOutCommitMatched!==true||
     original.originalWebsiteSha256Matched!==true||
     original.canApply!==false||original.canPush!==false)
    throw Error('Protected original site cannot be verified from Git objects.');
  const afterCommit=runGit(checkout,['rev-parse','--verify','HEAD^{commit}']).trim();
  const afterTree=runGit(checkout,['rev-parse','--verify','HEAD^{tree}']).trim();
  if(afterCommit!==commit||afterTree!==tree)
    throw Error('Local Git checkout changed during read-only source inspection.');
  return Object.freeze({
    exactLocalCommitMatched:true,exactLocalTreeMatched:true,
    originalWebsiteGitBlobVerified:true,localCheckoutStable:true,
    canApply:false,canPush:false,canPublish:false
  });
}
async function inspectRemoteCommitTree({repo,branch,commit,readRef,readCommit,checkLocal}={}){
  checkIdentity(repo,branch,commit);
  if(typeof readRef!=='function'||typeof readCommit!=='function'||
     typeof checkLocal!=='function')
    throw Error('Independent remote ref, remote Git object and local inspections required.');
  const first=parseReference(await readRef(repo,branch),repo,branch);
  if(first!==commit)throw Error('Remote branch moved before Git object inspection.');
  const commitResult=await readCommit(repo,commit);
  const remoteTree=parseCommitTree(commitResult,repo,commit);
  const inspected=await checkLocal(commit,remoteTree);
  if(!inspected||inspected.exactLocalCommitMatched!==true||
     inspected.exactLocalTreeMatched!==true||
     inspected.originalWebsiteGitBlobVerified!==true||
     inspected.localCheckoutStable!==true||
     inspected.canApply!==false||inspected.canPush!==false||
     inspected.canPublish!==false)
    throw Error('Independent local Git object inspection is missing or unsafe.');
  const last=parseReference(await readRef(repo,branch),repo,branch);
  if(last!==commit)throw Error('Remote branch moved during Git tree inspection.');
  return Object.freeze({
    format:FORMAT,
    repository:repo,branch,remoteCommit:commit,remoteTree,
    remoteRefObservations:2,remoteCommitTreeReads:1,
    sameRemoteRefAtObservations:true,
    remoteTreeMatchesPinnedLocalTree:true,
    protectedOriginalGitBlobMatched:true,
    localCheckoutStable:true,
    branchLocked:false,remoteMutationPerformed:false,
    remoteAuthorIdentityVerified:false,
    everyRemoteBlobIndividuallyDownloaded:false,
    futureRemoteHeadGuaranteed:false,
    userSourceLayoutApproved:false,
    ownerRetainedBackupVerified:false,
    approvedForSave:false,approvedForDeploy:false,
    canApply:false,canPush:false,canMerge:false,canPublish:false,
    filesWritten:0,gitHubWrites:0
  });
}
function selectResearchCI(env){
  if(!env||env.GITHUB_EVENT_NAME!=='pull_request'||
     env.GITHUB_REPOSITORY!==EXPECTED_REPO||
     env.GITHUB_REF!=='refs/pull/57/merge'||
     env.PR_NUMBER!=='57'||env.PR_HEAD_REPO!==EXPECTED_REPO||
     env.PR_HEAD_REF!==RESEARCH_BRANCH||
     !SHA.test(env.PR_HEAD_SHA||''))
    throw Error('Only the exact protected same-repository research PR is supported.');
  return env.PR_HEAD_SHA;
}
async function runCli(){
  if(process.argv.length!==3||process.argv[2]!=='--ci-research-remote')
    throw Error('Explicit read-only research CI mode required.');
  const commit=selectResearchCI(process.env),token=process.env.GITHUB_TOKEN;
  const result=await inspectRemoteCommitTree({
    repo:EXPECTED_REPO,branch:RESEARCH_BRANCH,commit,
    readRef:(r,b)=>readReference(r,b,token),
    readCommit:(r,s)=>readCommitTree(r,s,token),
    checkLocal:(s,tree)=>inspectLocalCheckout(
      path.resolve(__dirname,'..','..'),s,tree)
  });
  process.stdout.write(JSON.stringify({
    ...result,
    transport:'explicit GitHub HTTPS GET using Actions contents:read token',
    actualRemoteRefAndCommitReadOnly:true,
    noWriteCredentialsPersisted:true
  },null,2)+'\n');
}
if(require.main===module){
  runCli().catch(_=>{
    process.stderr.write('Read-only research GitHub commit/tree verification failed closed.\n');
    process.exitCode=1;
  });
}
module.exports=Object.freeze({FORMAT,RESEARCH_BRANCH,checkIdentity,
  commitApiPath,parseCommitTree,readCommitTree,inspectLocalCheckout,
  inspectRemoteCommitTree,selectResearchCI});
