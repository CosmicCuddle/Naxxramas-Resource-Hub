'use strict';
/*
 * GitHub writer for the ORIGINAL Naxxramas visual editor.
 * Writes exactly one existing public website file: site-content.html.
 * Never writes main, index.html, workflows, assets, or any other path.
 */
const https=require('node:https'),crypto=require('node:crypto');

const REPOSITORY='CosmicCuddle/Naxxramas-Resource-Hub';
const WORKING_BRANCH='editor-saves/cosmic-working';
const MAIN_BRANCH='main';
const SITE_PATH='site-content.html';
const SHA=/^[0-9a-f]{40}$/;
const MAX_HTML=45*1024*1024;
const MAX_REPLY=2*1024*1024;

function gitBlobSha(bytes){
  return crypto.createHash('sha1')
    .update(Buffer.from('blob '+bytes.length+'\0'))
    .update(bytes).digest('hex');
}
function approvedPath(method,url){
  const base='/repos/'+REPOSITORY;
  if(method==='GET'&&(
    url===base||
    url===base+'/git/ref/heads/main'||
    url===base+'/git/ref/heads/'+WORKING_BRANCH||
    /^\/repos\/CosmicCuddle\/Naxxramas-Resource-Hub\/git\/commits\/[a-f0-9]{40}$/.test(url)||
    /^\/repos\/CosmicCuddle\/Naxxramas-Resource-Hub\/git\/trees\/[a-f0-9]{40}$/.test(url)
  ))return true;
  if(method==='POST'&&(
    url===base+'/git/blobs'||
    url===base+'/git/trees'||
    url===base+'/git/commits'||
    url===base+'/git/refs'
  ))return true;
  if(method==='PATCH'&&url===base+'/git/refs/heads/'+WORKING_BRANCH)return true;
  return false;
}
function createHttpsRequest(token){
  if(typeof token!=='string'||token.length<12||/[\x00-\x20\x7f]/.test(token))
    throw Error('GitHub authentication is unavailable.');
  return function request({method,path,body}){
    if(!approvedPath(method,path))throw Error('Unapproved GitHub route.');
    const text=body===undefined?'':JSON.stringify(body);
    if(Buffer.byteLength(text)>65*1024*1024)throw Error('GitHub request was oversized.');
    return new Promise((resolve,reject)=>{
      let settled=false;
      const req=https.request({
        hostname:'api.github.com',protocol:'https:',port:443,
        method,path,timeout:120000,rejectUnauthorized:true,
        headers:{
          'Authorization':'Bearer '+token,
          'Accept':'application/vnd.github+json',
          'Content-Type':'application/json',
          'X-GitHub-Api-Version':'2022-11-28',
          'User-Agent':'Naxxramas-Original-Editor-Save',
          'Content-Length':String(Buffer.byteLength(text))
        }
      },res=>{
        let size=0;const chunks=[];
        res.on('data',chunk=>{
          size+=chunk.length;
          if(size>MAX_REPLY){
            req.destroy();return reject(Error('GitHub response exceeded safe limit.'));
          }
          chunks.push(chunk);
        });
        res.on('end',()=>{
          if(settled)return;settled=true;
          resolve({status:res.statusCode,body:Buffer.concat(chunks).toString('utf8')});
        });
      });
      req.on('error',()=>{if(!settled){settled=true;reject(Error('GitHub request outcome is uncertain.'));}});
      req.on('timeout',()=>req.destroy());
      req.end(text);
    });
  };
}
function createWriter(request){
  if(typeof request!=='function')throw Error('GitHub request adapter required.');
  async function call(method,path,body,{notFound=false}={}){
    if(!approvedPath(method,path))throw Error('Unapproved GitHub operation.');
    let result;
    try{result=await request({method,path,body});}
    catch(_){throw Error('SAVE_OUTCOME_UNCERTAIN: GitHub did not return a verified response.');}
    if(notFound&&result&&result.status===404)return null;
    if(!result||result.status<200||result.status>=300||typeof result.body!=='string')
      throw Error('SAVE_OUTCOME_UNCERTAIN: GitHub refused or did not verify the operation.');
    try{return JSON.parse(result.body);}
    catch(_){throw Error('SAVE_OUTCOME_UNCERTAIN: GitHub response was not valid JSON.');}
  }
  function validateHtml(bytes){
    if(!Buffer.isBuffer(bytes)||bytes.length<20*1024*1024||bytes.length>MAX_HTML)
      throw Error('Updated website HTML is outside the expected size.');
    const start=bytes.subarray(0,4096).toString('utf8').toLowerCase();
    const whole=bytes.toString('utf8');
    if(!start.includes('<!doctype html>')||
       !whole.includes('id="embedded-data"')||
       !whole.includes('window.NAXX_DATA = ')||
       !whole.includes('function exportUpdatedHtml')||
       whole.includes('data-naxx-loader-injected')||
       whole.includes('Loading the Naxxramas Resource Hub…'))
      throw Error('Updated website HTML did not match the original visual-editor source format.');
    return gitBlobSha(bytes);
  }
  async function repositoryState(){
    const base='/repos/'+REPOSITORY;
    const meta=await call('GET',base);
    if(!meta||meta.full_name!==REPOSITORY||meta.archived===true||meta.disabled===true)
      throw Error('The expected Resource Hub repository is unavailable.');
    const main=await call('GET',base+'/git/ref/heads/main');
    if(!main||main.ref!=='refs/heads/main'||!main.object||!SHA.test(main.object.sha||''))
      throw Error('The public main branch could not be verified.');
    const work=await call('GET',base+'/git/ref/heads/'+WORKING_BRANCH,undefined,{notFound:true});
    if(work&&(!work.object||!SHA.test(work.object.sha||'')||
       work.ref!=='refs/heads/'+WORKING_BRANCH))
      throw Error('The editor working branch identity was invalid.');
    return Object.freeze({main:main.object.sha,working:work?work.object.sha:null});
  }
  async function save(bytes,expectedWorkingHead){
    const blobExpected=validateHtml(bytes);
    const state=await repositoryState();
    if(expectedWorkingHead!==null&&expectedWorkingHead!==undefined&&
       expectedWorkingHead!==state.working)
      throw Error('The editor working branch changed. Reload its status before saving.');
    if(!state.working&&expectedWorkingHead)
      throw Error('The editor expected a working branch that does not exist.');
    const parent=state.working||state.main;
    const base='/repos/'+REPOSITORY;
    const parentCommit=await call('GET',base+'/git/commits/'+parent);
    if(!parentCommit||parentCommit.sha!==parent||!parentCommit.tree||
       !SHA.test(parentCommit.tree.sha||''))
      throw Error('The current GitHub parent commit was not verified.');
    const oldTree=await call('GET',base+'/git/trees/'+parentCommit.tree.sha);
    const oldIndex=oldTree&&Array.isArray(oldTree.tree)?
      oldTree.tree.find(x=>x.path==='index.html'&&x.type==='blob'):null;
    const oldSite=oldTree&&Array.isArray(oldTree.tree)?
      oldTree.tree.find(x=>x.path===SITE_PATH&&x.type==='blob'):null;
    if(!oldIndex||!SHA.test(oldIndex.sha||'')||!oldSite||!SHA.test(oldSite.sha||''))
      throw Error('The current root website files were not verified.');

    const blob=await call('POST',base+'/git/blobs',{
      content:bytes.toString('base64'),encoding:'base64'
    });
    if(!blob||blob.sha!==blobExpected)
      throw Error('SAVE_OUTCOME_UNCERTAIN: GitHub blob did not match the edited website.');

    const tree=await call('POST',base+'/git/trees',{
      base_tree:parentCommit.tree.sha,
      tree:[{path:SITE_PATH,mode:'100644',type:'blob',sha:blob.sha}]
    });
    if(!tree||!SHA.test(tree.sha||''))
      throw Error('SAVE_OUTCOME_UNCERTAIN: GitHub tree was not acknowledged.');

    const commit=await call('POST',base+'/git/commits',{
      message:'Save Resource Hub edits from original visual editor',
      tree:tree.sha,parents:[parent]
    });
    if(!commit||!SHA.test(commit.sha||''))
      throw Error('SAVE_OUTCOME_UNCERTAIN: GitHub commit was not acknowledged.');

    if(state.working){
      await call('PATCH',base+'/git/refs/heads/'+WORKING_BRANCH,{
        sha:commit.sha,force:false
      });
    }else{
      await call('POST',base+'/git/refs',{
        ref:'refs/heads/'+WORKING_BRANCH,sha:commit.sha
      });
    }

    const verifyRef=await call('GET',base+'/git/ref/heads/'+WORKING_BRANCH);
    const verifyCommit=await call('GET',base+'/git/commits/'+commit.sha);
    const verifyTree=await call('GET',base+'/git/trees/'+tree.sha);
    const entries=verifyTree&&Array.isArray(verifyTree.tree)?verifyTree.tree:[];
    const newIndex=entries.find(x=>x.path==='index.html'&&x.type==='blob');
    const newSite=entries.find(x=>x.path===SITE_PATH&&x.type==='blob');
    if(!verifyRef||verifyRef.object.sha!==commit.sha||
       !verifyCommit||verifyCommit.sha!==commit.sha||
       !Array.isArray(verifyCommit.parents)||verifyCommit.parents.length!==1||
       verifyCommit.parents[0].sha!==parent||
       !newIndex||newIndex.sha!==oldIndex.sha||
       !newSite||newSite.sha!==blobExpected)
      throw Error('SAVE_OUTCOME_UNCERTAIN: GitHub readback did not prove a safe one-file Save.');

    return Object.freeze({
      format:'naxx-original-editor-save-v1',
      repository:REPOSITORY,branch:WORKING_BRANCH,
      parentCommit:parent,commit:commit.sha,
      siteContentBlob:blobExpected,indexHtmlUnchanged:true,
      changedPath:SITE_PATH,published:false
    });
  }
  return Object.freeze({repositoryState,save});
}
module.exports=Object.freeze({
  REPOSITORY,WORKING_BRANCH,MAIN_BRANCH,SITE_PATH,
  gitBlobSha,approvedPath,createHttpsRequest,createWriter
});
