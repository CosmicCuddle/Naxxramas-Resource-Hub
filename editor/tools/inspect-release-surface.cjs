'use strict';
/*
 * RESEARCH ONLY: read GitHub public branch metadata, repository ruleset
 * inventory and (where accessible) Pages configuration. Zero mutations.
 *
 * A branch or ruleset observation is not a lock or evidence of permission
 * to Save. External hosts, Github Actions configuration/secret settings and
 * future branch state are outside this audit's visibility.
 */
const https=require('node:https');
const {EXPECTED_REPO}=require('./rehearse-remote-github-head-preflight.cjs');
const BRANCHES=Object.freeze([
  'main',
  'feature/multi-file-editor-export-2026-11-05',
  'research/read-only-revision-chain-2026-11-08'
]);
const SHA=/^[a-f0-9]{40}$/;
const FORMAT='naxx-research-read-only-public-release-surface-v1';
const MAX_RESPONSE=128*1024;
const BASE='/repos/CosmicCuddle/Naxxramas-Resource-Hub/';
function approvedEndpoint(endpoint){
  if(endpoint==='rulesets'||endpoint==='pages')return BASE+endpoint;
  if(BRANCHES.includes(endpoint))
    return BASE+'branches/'+endpoint.split('/').map(encodeURIComponent).join('/');
  throw Error('Unapproved remote repository settings endpoint.');
}
function getJson(endpoint,token){
  const route=approvedEndpoint(endpoint);
  if(typeof token!=='string'||token.length<10||/[\r\n]/.test(token))
    return Promise.reject(Error('A read-only GitHub token is required.'));
  return new Promise((resolve,reject)=>{
    const request=https.request({
      protocol:'https:',hostname:'api.github.com',port:443,
      method:'GET',path:route,timeout:10000,
      headers:{
        Accept:'application/vnd.github+json',
        Authorization:'Bearer '+token,
        'X-GitHub-Api-Version':'2022-11-28',
        'Cache-Control':'no-cache',
        'User-Agent':'Naxx-ReadOnly-Release-Surface-Audit'
      }
    },response=>{
      // Pages access is optional. A 403/404 must never be mistaken for
      // proof that Pages does not exist.
      if(endpoint==='pages'&&(response.statusCode===403||response.statusCode===404)){
        response.resume();
        resolve({httpStatus:response.statusCode,unavailable:true});
        return;
      }
      if(response.statusCode!==200){
        response.resume();
        reject(Error('GitHub release-surface metadata could not be verified.'));
        return;
      }
      let len=0;const buffers=[];
      response.on('data',part=>{
        len+=part.length;
        if(len>MAX_RESPONSE)request.destroy(
          Error('GitHub metadata exceeded the strict read-only limit.'));
        else buffers.push(part);
      });
      response.once('end',()=>{
        try{
          if(!len)throw Error('No metadata returned.');
          resolve({httpStatus:200,data:JSON.parse(
            Buffer.concat(buffers).toString('utf8'))});
        }catch(_){reject(Error('GitHub release metadata was malformed.'));}
      });
      response.once('error',()=>reject(
        Error('GitHub release metadata request was interrupted.')));
    });
    request.once('timeout',()=>request.destroy(
      Error('GitHub release metadata request timed out.')));
    request.once('error',()=>reject(
      Error('GitHub release metadata request failed.')));
    request.end();
  });
}
function checkedBranch(response,branch){
  if(!BRANCHES.includes(branch)||!response||response.httpStatus!==200||
     !response.data||response.data.name!==branch||
     !SHA.test(response.data.commit?.sha||'')||
     typeof response.data.protected!=='boolean'||
     !response.data.protection||typeof response.data.protection.enabled!=='boolean')
    throw Error('GitHub branch protection and ref identity are unavailable.');
  return Object.freeze({
    branch,head:response.data.commit.sha,
    protected:response.data.protected,
    protectionEnabled:response.data.protection.enabled,
    // API metadata does not establish whether a future ref is protected.
    protectionObservedAtOneRead:true
  });
}
function checkedRulesets(response){
  if(!response||response.httpStatus!==200||!Array.isArray(response.data)||
     response.data.length>100)
    throw Error('GitHub repository ruleset inventory is unavailable.');
  const ids=new Set();
  for(const item of response.data){
    if(!item||typeof item.id!=='number'||!Number.isSafeInteger(item.id)||
       ids.has(item.id)||typeof item.name!=='string'||
       typeof item.enforcement!=='string')
      throw Error('Malformed or duplicate repository ruleset metadata.');
    ids.add(item.id);
  }
  // A rulesets listing is not a permission check or Pages release lock.
  return Object.freeze({observed:true,listedRulesets:ids.size});
}
function checkedPages(response){
  if(response?.unavailable===true&&
     (response.httpStatus===403||response.httpStatus===404))
    return Object.freeze({pagesApiReadable:false,githubPagesEnabledKnown:false,
      githubPagesEnabled:null,pagesBuildType:null,pagesSourceBranch:null});
  if(!response||response.httpStatus!==200||!response.data||
     typeof response.data!=='object'||Array.isArray(response.data))
    throw Error('GitHub Pages configuration was invalid.');
  const data=response.data;
  if(data.build_type!==undefined&&typeof data.build_type!=='string')
    throw Error('Untrusted GitHub Pages build type.');
  if(data.source!==undefined&&data.source!==null&&
     (typeof data.source!=='object'||Array.isArray(data.source)||
      typeof data.source.branch!=='string'))
    throw Error('Untrusted GitHub Pages source branch.');
  return Object.freeze({
    pagesApiReadable:true,githubPagesEnabledKnown:true,
    githubPagesEnabled:true,
    pagesBuildType:data.build_type||null,
    pagesSourceBranch:data.source?.branch||null
  });
}
function checkResearchIdentity(env){
  if(!env||env.GITHUB_EVENT_NAME!=='pull_request'||
     env.GITHUB_REPOSITORY!==EXPECTED_REPO||
     env.GITHUB_REF!=='refs/pull/57/merge'||
     env.PR_NUMBER!=='57'||
     env.PR_HEAD_REPO!==EXPECTED_REPO||
     env.PR_HEAD_REF!==BRANCHES[2]||
     !SHA.test(env.PR_HEAD_SHA||''))
    throw Error('Only the same-repository, exact PR 57 research head is permitted.');
  return env.PR_HEAD_SHA;
}
async function inspectReleaseSurface({expectedResearchSha,read}={}){
  if(!SHA.test(expectedResearchSha||'')||typeof read!=='function')
    throw Error('Pinned research head and read-only GitHub metadata reader required.');
  const heads=[];
  for(const branch of BRANCHES)
    heads.push(checkedBranch(await read(branch),branch));
  if(heads[2].head!==expectedResearchSha)
    throw Error('Research branch moved before settings review.');
  const rules=checkedRulesets(await read('rulesets'));
  const pages=checkedPages(await read('pages'));
  // Recheck research head after settings requests. Still not a ref lock.
  const latest=checkedBranch(await read(BRANCHES[2]),BRANCHES[2]);
  if(latest.head!==expectedResearchSha||
     latest.protected!==heads[2].protected||
     latest.protectionEnabled!==heads[2].protectionEnabled)
    throw Error('Research branch changed during settings review.');
  return Object.freeze({
    format:FORMAT,repository:EXPECTED_REPO,
    source:'authenticated GitHub read-only metadata snapshot',
    researchHead:expectedResearchSha,
    branches:heads,listedRulesets:rules.listedRulesets,
    rulesetsEndpointRead:true,
    anyBranchReportedUnprotected:heads.some(x=>!x.protected||!x.protectionEnabled),
    pages,
    branchProtectionAuthorizationVerified:false,
    externalHostingServicesChecked:false,
    repositorySecretsAndPermissionsAudited:false,
    allDeployTriggersIndependentlyAudited:false,
    branchLocked:false,refWrites:0,websiteFilesWritten:0,
    sourceLayoutApproved:false,durableBackupRetained:false,
    ownerApproved:false,canSave:false,canMerge:false,canPublish:false,
    canDeploy:false
  });
}
async function runCli(){
  if(process.argv.length!==3||process.argv[2]!=='--ci-pr57-settings')
    throw Error('Explicit read-only PR 57 GitHub settings inspection required.');
  const sha=checkResearchIdentity(process.env);
  const token=process.env.GITHUB_TOKEN;
  const evidence=await inspectReleaseSurface({
    expectedResearchSha:sha,
    read:endpoint=>getJson(endpoint,token)
  });
  process.stdout.write(JSON.stringify(evidence,null,2)+'\n');
}
if(require.main===module)
  runCli().catch(_=>{
    process.stderr.write('Read-only release-surface inspection stopped safely.\n');
    process.exitCode=1;
  });
module.exports=Object.freeze({BRANCHES,FORMAT,approvedEndpoint,checkedBranch,
  checkedRulesets,checkedPages,checkResearchIdentity,inspectReleaseSurface,getJson});
