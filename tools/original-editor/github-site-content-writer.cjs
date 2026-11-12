'use strict';
const https=require('node:https'),crypto=require('node:crypto');

const REPOSITORY='CosmicCuddle/Naxxramas-Resource-Hub';
const MAIN='main';
const EDIT_BRANCH='editor-saves/original-visual-editor';
const FILE='site-content.html';
const SHA=/^[a-f0-9]{40}$/;
const FORMAT='naxx-original-visual-editor-save-v1';
const MAX_SOURCE=40*1024*1024;

function gitBlobSha(bytes){
  const head=Buffer.from('blob '+bytes.length+'\0','utf8');
  return crypto.createHash('sha1').update(head).update(bytes).digest('hex');
}
function allowed(method,path){
  const base='/repos/'+REPOSITORY;
  return (
    method==='GET' && (
      path===base ||
      path===base+'/git/ref/heads/'+MAIN ||
      path===base+'/git/ref/heads/'+EDIT_BRANCH ||
      /^\/repos\/CosmicCuddle\/Naxxramas-Resource-Hub\/git\/commits\/[a-f0-9]{40}$/.test(path) ||
      /^\/repos\/CosmicCuddle\/Naxxramas-Resource-Hub\/git\/trees\/[a-f0-9]{40}$/.test(path)
    )
  ) || (
    method==='POST' && (
      path===base+'/git/refs' ||
      path===base+'/git/blobs' ||
      path===base+'/git/trees' ||
      path===base+'/git/commits'
    )
  ) || (
    method==='PATCH' && path===base+'/git/refs/heads/'+EDIT_BRANCH
  );
}
function httpsTransport(token){
  if(typeof token!=='string'||token.length<12||/[\x00-\x20\x7f]/.test(token))
    throw Error('GitHub authentication is unavailable.');
  return ({method,path,body=''})=>new Promise((resolve,reject)=>{
    if(!allowed(method,path))return reject(Error('Unapproved GitHub route.'));
    const req=https.request({
      hostname:'api.github.com',protocol:'https:',port:443,method,path,
      timeout:120000,rejectUnauthorized:true,
      headers:{
        Authorization:'Bearer '+token,
        Accept:'application/vnd.github+json',
        'Content-Type':'application/json',
        'X-GitHub-Api-Version':'2022-11-28',
        'User-Agent':'Naxxramas-Original-Visual-Editor',
        'Content-Length':String(Buffer.byteLength(body))
      }
    },res=>{
      const chunks=[];let size=0;
      res.on('data',c=>{
        size+=c.length;
        if(size>8*1024*1024){
          req.destroy();reject(Error('GitHub response was unexpectedly large.'));
        }else chunks.push(c);
      });
      res.on('end',()=>resolve({status:res.statusCode,body:Buffer.concat(chunks).toString('utf8')}));
    });
    req.on('error',()=>reject(Error('GitHub request failed or became uncertain.')));
    req.on('timeout',()=>req.destroy(Error('GitHub request timed out.')));
    req.end(body);
  });
}
function createWriter({request}){
  if(typeof request!=='function')throw Error('A GitHub transport is required.');
  const base='/repos/'+REPOSITORY;
  async function call(method,path,payload,{allow404=false}={}){
    if(!allowed(method,path))throw Error('Forbidden GitHub route.');
    const body=payload===undefined?'':JSON.stringify(payload);
    let r;
    try{r=await request({method,path,body});}
    catch(_){throw Error('SAVE_OUTCOME_UNCERTAIN: GitHub connection failed. Do not retry blindly.');}
    if(allow404&&r&&r.status===404)return null;
    if(!r||r.status<200||r.status>=300)
      throw Error('SAVE_OUTCOME_UNCERTAIN: GitHub did not confirm the operation.');
    try{return JSON.parse(r.body);}
    catch(_){throw Error('SAVE_OUTCOME_UNCERTAIN: GitHub response was invalid.');}
  }
  async function repoCheck(){
    const repo=await call('GET',base);
    if(!repo||repo.full_name!==REPOSITORY||repo.archived===true||repo.disabled===true||
       repo.default_branch!==MAIN)
      throw Error('The expected Resource Hub repository was not verified.');
  }
  async function ref(branch,allow404=false){
    const v=await call('GET',base+'/git/ref/heads/'+branch,undefined,{allow404});
    if(!v)return null;
    if(v.ref!=='refs/heads/'+branch||!v.object||!SHA.test(v.object.sha||''))
      throw Error('GitHub branch identity was not verified.');
    return v.object.sha;
  }
  async function ensureEditBranch(){
    await repoCheck();
    const main=await ref(MAIN);
    let edit=await ref(EDIT_BRANCH,true);
    if(!edit){
      const made=await call('POST',base+'/git/refs',{
        ref:'refs/heads/'+EDIT_BRANCH,sha:main
      });
      if(!made||made.ref!=='refs/heads/'+EDIT_BRANCH||!made.object||
         made.object.sha!==main)
        throw Error('Editing branch creation was not verified.');
      edit=main;
    }
    return {main,edit};
  }
  async function saveSource(bytes){
    if(!Buffer.isBuffer(bytes)||bytes.length<1024||bytes.length>MAX_SOURCE)
      throw Error('Generated website source size is invalid.');
    const branch=await ensureEditBranch();
    const before=await ref(EDIT_BRANCH);
    if(before!==branch.edit)
      throw Error('Editing branch changed while preparing Save. Retry after refreshing.');
    const parent=await call('GET',base+'/git/commits/'+before);
    if(!parent||parent.sha!==before||!parent.tree||!SHA.test(parent.tree.sha||''))
      throw Error('Editing branch parent commit could not be verified.');

    const expectedBlob=gitBlobSha(bytes);
    const blob=await call('POST',base+'/git/blobs',{
      content:bytes.toString('base64'),encoding:'base64'
    });
    if(!blob||blob.sha!==expectedBlob)
      throw Error('GitHub did not return the expected website blob.');

    const tree=await call('POST',base+'/git/trees',{
      base_tree:parent.tree.sha,
      tree:[{path:FILE,mode:'100644',type:'blob',sha:expectedBlob}]
    });
    if(!tree||!SHA.test(tree.sha||''))
      throw Error('GitHub tree was not created.');

    const commit=await call('POST',base+'/git/commits',{
      message:'Save Resource Hub edits from original visual editor',
      tree:tree.sha,parents:[before]
    });
    if(!commit||!SHA.test(commit.sha||''))
      throw Error('GitHub commit was not created.');

    await call('PATCH',base+'/git/refs/heads/'+EDIT_BRANCH,{
      sha:commit.sha,force:false
    });

    const after=await ref(EDIT_BRANCH);
    if(after!==commit.sha)
      throw Error('SAVE_OUTCOME_UNCERTAIN: editing branch did not verify at the new commit.');

    const verifyCommit=await call('GET',base+'/git/commits/'+commit.sha);
    if(!verifyCommit||verifyCommit.sha!==commit.sha||
       !Array.isArray(verifyCommit.parents)||verifyCommit.parents.length!==1||
       verifyCommit.parents[0].sha!==before||verifyCommit.tree?.sha!==tree.sha)
      throw Error('SAVE_OUTCOME_UNCERTAIN: new commit ancestry was not verified.');

    const verifyTree=await call('GET',base+'/git/trees/'+tree.sha);
    const item=Array.isArray(verifyTree?.tree)?
      verifyTree.tree.find(x=>x.path===FILE):null;
    if(!item||item.type!=='blob'||item.mode!=='100644'||item.sha!==expectedBlob)
      throw Error('SAVE_OUTCOME_UNCERTAIN: saved site-content.html was not verified.');

    const mainAfter=await ref(MAIN);
    if(mainAfter!==branch.main)
      throw Error('Main changed during Save. The editing branch was saved, but review before merge.');

    return Object.freeze({
      format:FORMAT,result:'saved-to-github-editing-branch',
      repository:REPOSITORY,branch:EDIT_BRANCH,
      parentCommit:before,commit:commit.sha,
      siteContentBlob:expectedBlob,
      mainCommit:mainAfter,mainUnchanged:true,published:false,
      compareUrl:'https://github.com/'+REPOSITORY+
        '/compare/main...editor-saves/original-visual-editor?expand=1'
    });
  }
  return Object.freeze({saveSource,ensureEditBranch});
}
module.exports=Object.freeze({
  FORMAT,REPOSITORY,MAIN,EDIT_BRANCH,FILE,MAX_SOURCE,
  gitBlobSha,allowed,httpsTransport,createWriter
});
