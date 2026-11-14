'use strict';

const https=require('node:https');
const crypto=require('node:crypto');

const REPOSITORY='CosmicCuddle/Naxxramas-Resource-Hub';
const BRANCH='editor-saves/original-admin';
const FILE='site-content.html';
const BASE='/repos/'+REPOSITORY;
const SHA=/^[a-f0-9]{40}$/;
const FORMAT='naxx-original-admin-github-draft-v1';
const MIN_BYTES=20*1024*1024;
const MAX_BYTES=40*1024*1024;
const MAX_REPLY=12*1024*1024;

function gitBlobOid(bytes){
  return crypto.createHash('sha1')
    .update(Buffer.from('blob '+bytes.length+'\0','utf8')).update(bytes).digest('hex');
}
function isCommitPath(p){
  const prefix=BASE+'/git/commits/';
  return p.startsWith(prefix)&&SHA.test(p.slice(prefix.length));
}
function validRoute(method,p){
  if(method==='GET'&&(p===BASE||
      p===BASE+'/git/ref/heads/main'||
      p===BASE+'/git/ref/heads/'+BRANCH||
      p===BASE+'/compare/main...'+BRANCH||
      isCommitPath(p)))return true;
  if(method==='POST'&&(p===BASE+'/git/refs'||
      p===BASE+'/git/blobs'||p===BASE+'/git/trees'||p===BASE+'/git/commits'))return true;
  if(method==='PATCH'&&p===BASE+'/git/refs/heads/'+BRANCH)return true;
  return false;
}
function strictHttpsTransport(){
  return function request({method,path,body,headers}){
    if(!validRoute(method,path)||typeof body!=='string'||
       Buffer.byteLength(body)>56*1024*1024)
      throw Error('Unapproved original-editor GitHub route.');
    return new Promise((resolve,reject)=>{
      const req=https.request({
        hostname:'api.github.com',protocol:'https:',port:443,
        method,path,headers,timeout:120000,rejectUnauthorized:true
      },res=>{
        let size=0;const chunks=[];
        res.on('data',chunk=>{
          size+=chunk.length;
          if(size>MAX_REPLY){
            req.destroy();
            reject(Error('GitHub response exceeded the protected limit.'));
          }else chunks.push(chunk);
        });
        res.on('end',()=>resolve({
          status:res.statusCode,
          body:Buffer.concat(chunks).toString('utf8')
        }));
      });
      req.on('error',()=>reject(Error('GitHub draft Save network result is uncertain.')));
      req.on('timeout',()=>req.destroy(Error('GitHub draft Save timed out.')));
      req.end(body);
    });
  };
}
function validateHtml(bytes){
  if(!Buffer.isBuffer(bytes)||bytes.length<MIN_BYTES||bytes.length>MAX_BYTES)
    throw Error('The original editor output is outside the expected website size.');
  const text=bytes.toString('utf8');
  if(!Buffer.from(text,'utf8').equals(bytes)||
     !/^<!doctype html>/i.test(text.slice(0,80))||
     !/id=["']embedded-data["']/.test(text)||
     !/window\.NAXX_DATA\s*=/.test(text)||
     !/function\s+exportUpdatedHtml\s*\(/.test(text)||
     text.includes('data-naxx-loader-injected="1"')||
     text.includes("data-naxx-loader-injected='1'")||
     /<body[^>]*class=["'][^"']*\bvisual-admin-active\b/i.test(text))
    throw Error('The original editor output failed its site-content safety checks.');
  return Object.freeze({
    blobSha:gitBlobOid(bytes),
    sha256:crypto.createHash('sha256').update(bytes).digest('hex')
  });
}
function createOriginalAdminGitHubStore(options){
  if(!options||options.enabledByExplicitOwnerApproval!==true||
     options.repository!==REPOSITORY||
     typeof options.token!=='string'||options.token.length<12||
     /[\x00-\x20\x7f]/.test(options.token)||
     typeof options.request!=='function')
    throw Error('Explicit owner-approved GitHub draft storage is required.');
  const validate=typeof options.validate==='function'?options.validate:validateHtml;

  async function call(method,p,payload,flags={}){
    if(!validRoute(method,p))throw Error('Forbidden original-editor GitHub route.');
    const body=payload===undefined?'':JSON.stringify(payload);
    let response;
    try{
      response=await options.request({method,path:p,body,headers:{
        'Authorization':'Bearer '+options.token,
        'Accept':'application/vnd.github+json',
        'Content-Type':'application/json',
        'X-GitHub-Api-Version':'2022-11-28',
        'User-Agent':'Naxxramas-Original-Admin-Draft-Save',
        'Content-Length':String(Buffer.byteLength(body))
      }});
    }catch(_){throw Error('GITHUB_DRAFT_OUTCOME_UNCERTAIN');}
    if(flags.allow404&&response&&response.status===404)return null;
    if(flags.allow422&&response&&response.status===422)return null;
    if(!response||response.status<200||response.status>=300||
       typeof response.body!=='string')
      throw Error('GITHUB_DRAFT_OUTCOME_UNCERTAIN');
    try{return JSON.parse(response.body);}
    catch(_){throw Error('GITHUB_DRAFT_OUTCOME_UNCERTAIN');}
  }

  async function verifyRepo(){
    const repo=await call('GET',BASE);
    if(!repo||repo.full_name!==REPOSITORY||repo.archived===true||
       repo.disabled===true||repo.default_branch!=='main')
      throw Error('The Resource Hub repository identity was not verified.');
  }
  async function ref(name,allow404=false){
    const data=await call('GET',BASE+'/git/ref/heads/'+name,undefined,{allow404});
    if(!data)return null;
    if(data.ref!=='refs/heads/'+name||!data.object||!SHA.test(data.object.sha||''))
      throw Error('GitHub branch identity was not verified.');
    return data.object.sha;
  }
  async function verifyDraftScope(){
    const comparison=await call('GET',BASE+'/compare/main...'+BRANCH);
    if(!comparison||!Array.isArray(comparison.files)||
       comparison.files.some(file=>!file||file.filename!==FILE))
      throw Error('The GitHub editor draft branch contains an unexpected file change.');
  }
  async function status(){
    await verifyRepo();
    const main=await ref('main');
    const draft=await ref(BRANCH,true);
    if(draft)await verifyDraftScope();
    return Object.freeze({
      format:FORMAT,repository:REPOSITORY,branch:BRANCH,file:FILE,
      branchExists:!!draft,expectedHead:draft||main,mainHead:main,
      liveMainWriteAllowed:false,published:false
    });
  }
  async function ensureBranch(expectedMain){
    let draft=await ref(BRANCH,true);
    if(draft)return draft;
    const main=await ref('main');
    if(main!==expectedMain)
      throw Error('Main changed before the draft branch could be created.');
    const created=await call('POST',BASE+'/git/refs',
      {ref:'refs/heads/'+BRANCH,sha:main},{allow422:true});
    if(created&&created.ref==='refs/heads/'+BRANCH&&created.object&&
       SHA.test(created.object.sha||''))return created.object.sha;
    draft=await ref(BRANCH,true);
    if(!draft)throw Error('The GitHub draft branch could not be created safely.');
    return draft;
  }
  async function save(bytes,expectedHead){
    const checked=validate(bytes);
    if(!checked||!SHA.test(checked.blobSha||'')||
       !/^[a-f0-9]{64}$/.test(checked.sha256||'')||
       !SHA.test(expectedHead||''))
      throw Error('The edited website or pinned GitHub draft head is invalid.');

    const before=await status();
    if(before.expectedHead!==expectedHead)
      throw Error('The GitHub draft changed. Check the connection before saving again.');

    const oldHead=await ensureBranch(expectedHead);
    if(oldHead!==expectedHead)
      throw Error('The GitHub draft branch changed during setup.');

    const oldCommit=await call('GET',BASE+'/git/commits/'+oldHead);
    if(!oldCommit||oldCommit.sha!==oldHead||!oldCommit.tree||
       !SHA.test(oldCommit.tree.sha||''))
      throw Error('The existing GitHub draft commit was not verified.');

    const blob=await call('POST',BASE+'/git/blobs',{
      content:bytes.toString('base64'),encoding:'base64'
    });
    if(!blob||blob.sha!==checked.blobSha)
      throw Error('GitHub did not acknowledge the exact edited website bytes.');

    const tree=await call('POST',BASE+'/git/trees',{
      base_tree:oldCommit.tree.sha,
      tree:[{path:FILE,mode:'100644',type:'blob',sha:checked.blobSha}]
    });
    if(!tree||!SHA.test(tree.sha||''))
      throw Error('GitHub did not create the protected website draft tree.');

    const commit=await call('POST',BASE+'/git/commits',{
      message:'Save Resource Hub edits from original Admin editor',
      tree:tree.sha,parents:[oldHead]
    });
    if(!commit||!SHA.test(commit.sha||''))
      throw Error('GitHub did not create the protected website draft commit.');

    const moved=await call('PATCH',BASE+'/git/refs/heads/'+BRANCH,{
      sha:commit.sha,force:false
    });
    if(!moved||moved.ref!=='refs/heads/'+BRANCH||
       !moved.object||moved.object.sha!==commit.sha)
      throw Error('GitHub refused the non-forced draft branch update.');

    const after=await ref(BRANCH);
    const verified=await call('GET',BASE+'/git/commits/'+commit.sha);
    if(after!==commit.sha||!verified||verified.sha!==commit.sha||
       !verified.tree||verified.tree.sha!==tree.sha||
       !Array.isArray(verified.parents)||verified.parents.length!==1||
       verified.parents[0].sha!==oldHead)
      throw Error('GITHUB_DRAFT_OUTCOME_UNCERTAIN');

    await verifyDraftScope();
    return Object.freeze({
      format:FORMAT,result:'saved-to-github-draft',
      repository:REPOSITORY,branch:BRANCH,file:FILE,
      parentCommit:oldHead,commit:commit.sha,
      blobSha:checked.blobSha,sha256:checked.sha256,
      liveMainWriteAllowed:false,published:false
    });
  }
  return Object.freeze({format:FORMAT,repository:REPOSITORY,branch:BRANCH,status,save});
}
module.exports=Object.freeze({
  FORMAT,REPOSITORY,BRANCH,FILE,gitBlobOid,validateHtml,validRoute,
  strictHttpsTransport,createOriginalAdminGitHubStore
});
