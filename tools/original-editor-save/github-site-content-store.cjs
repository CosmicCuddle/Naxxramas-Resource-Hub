'use strict';
const https=require('node:https'),crypto=require('node:crypto');
const REPOSITORY='CosmicCuddle/Naxxramas-Resource-Hub';
const BRANCH='editor-saves/original-admin';
const FILE='site-content.html';
const SHA=/^[0-9a-f]{40}$/;
const MAX_HTML=40*1024*1024;
const MAX_REPLY=4*1024*1024;
const FORMAT='naxx-original-editor-github-store-v1';
const OVERLAY_FILES=[
  'naxx-countdowns.css','naxx-theme-v2.css','naxx-theme-v3.css',
  'naxx-countdowns-compact.css','naxx-home-class-selector.css',
  'naxx-three-pages.css','naxx-game-clients-guide.css',
  'naxx-countdowns.js','naxx-resource-navigation.js',
  'naxx-handbook-progression-fix.js','naxx-resource-information.js',
  'naxx-home-class-selector.js','naxx-talent-set-sync.js',
  'naxx-talent-sets-full-sync.js','naxx-warrior-talent-sets.js',
  'naxx-final-vanilla-talent-sets.js','naxx-three-pages.js',
  'naxx-game-clients-guide.js','naxx-original-admin-save.js'
];
function blobSha(bytes){
  return crypto.createHash('sha1')
    .update(Buffer.from('blob '+bytes.length+'\0','utf8')).update(bytes).digest('hex');
}
function approvedRoute(method,url){
  const base='/repos/'+REPOSITORY;
  return (method==='GET'&&(
    url===base||
    url===base+'/git/ref/heads/main'||
    url===base+'/git/ref/heads/'+BRANCH||
    url===base+'/contents/'+FILE+'?ref=main'||
    url===base+'/contents/'+FILE+'?ref='+BRANCH||
    url===base+'/compare/main...'+BRANCH||
    new RegExp('^'+base.replace(/[.*+?^$()|[\]\\{}]/g,'\\$&')+
      '/git/commits/[0-9a-f]{40}$').test(url)
  )) || (method==='PUT'&&url===base+'/contents/'+FILE);
}
function requestTransport(){
  return function request({method,path,headers,body}){
    if(!approvedRoute(method,path)||typeof body!=='string'||
       Buffer.byteLength(body)>58*1024*1024)
      throw Error('Unapproved Resource Hub GitHub API operation.');
    return new Promise((resolve,reject)=>{
      let settled=false;
      const req=https.request({
        hostname:'api.github.com',protocol:'https:',port:443,method,path,
        headers,timeout:120000,rejectUnauthorized:true
      },res=>{
        let size=0;const chunks=[];
        res.on('data',chunk=>{
          if(settled)return;
          size+=chunk.length;
          if(size>MAX_REPLY){
            settled=true;req.destroy();
            reject(Error('GitHub reply exceeded the protected limit.'));
          }else chunks.push(chunk);
        });
        res.on('end',()=>{
          if(settled)return;settled=true;
          resolve({status:res.statusCode,body:Buffer.concat(chunks).toString('utf8')});
        });
      });
      req.on('error',()=>{
        if(!settled){settled=true;reject(Error('GitHub Save network result is uncertain.'));}
      });
      req.on('timeout',()=>req.destroy(Error('GitHub Save request timed out.')));
      req.end(body);
    });
  };
}
function parseJson(text){
  try{return JSON.parse(text);}catch(_){throw Error('GitHub returned an unreadable response.');}
}
function validateHtml(bytes){
  if(!Buffer.isBuffer(bytes)||bytes.length<20*1024*1024||bytes.length>MAX_HTML)
    throw Error('The prepared Resource Hub HTML size was not expected.');
  const text=bytes.toString('utf8');
  if(!Buffer.from(text,'utf8').equals(bytes)||
     !/^<!doctype html>/i.test(text.trimStart())||
     !text.includes('id="embedded-data"')||
     !text.includes('window.NAXX_DATA')||
     !text.includes('function exportUpdatedHtml')||
     text.includes('Loading the Naxxramas Resource Hub'))
    throw Error('The original editor output was not a complete site-content document.');
  for(const asset of OVERLAY_FILES){
    const escaped=asset.replace(/[.*+?^$()|[\]\\{}]/g,'\\$&');
    const tag=new RegExp(
      "<(?:script|link)\\b[^>]*(?:src|href)=([\"'])[^\"']*"+escaped+
      "(?:\\?[^\"']*)?\\1",'i');
    if(tag.test(text))
      throw Error('Loader-injected overlay remained in the saved source: '+asset);
  }
  return Object.freeze({bytes,text,sha:blobSha(bytes)});
}
function createStore({token,request=requestTransport()}){
  if(typeof token!=='string'||token.length<12||/[\x00-\x20\x7f]/.test(token)||
     typeof request!=='function')
    throw Error('An in-memory GitHub CLI credential is required.');
  async function call(method,url,payload,allow404=false){
    if(!approvedRoute(method,url))throw Error('Forbidden GitHub route.');
    const body=payload===undefined?'':JSON.stringify(payload);
    let result;
    try{
      result=await request({method,path:url,body,headers:{
        'Authorization':'Bearer '+token,
        'Accept':'application/vnd.github+json',
        'Content-Type':'application/json',
        'X-GitHub-Api-Version':'2022-11-28',
        'User-Agent':'Naxxramas-Original-Editor-Save',
        'Content-Length':String(Buffer.byteLength(body))
      }});
    }catch(_){throw Error('SAVE_OUTCOME_UNCERTAIN: inspect the review branch before retrying.');}
    if(allow404&&result&&result.status===404)return null;
    if(!result||result.status<200||result.status>=300||
       typeof result.body!=='string'||Buffer.byteLength(result.body)>MAX_REPLY)
      throw Error('GitHub rejected or did not confirm the requested operation.');
    return parseJson(result.body);
  }
  async function status(){
    const base='/repos/'+REPOSITORY;
    const meta=await call('GET',base);
    if(meta.full_name!==REPOSITORY||meta.archived===true||meta.disabled===true)
      throw Error('The Resource Hub repository identity is not active.');
    const main=await call('GET',base+'/git/ref/heads/main');
    const review=await call('GET',base+'/git/ref/heads/'+BRANCH);
    if(main.ref!=='refs/heads/main'||review.ref!=='refs/heads/'+BRANCH||
       !SHA.test(main.object&&main.object.sha||'')||
       !SHA.test(review.object&&review.object.sha||''))
      throw Error('Required GitHub branch identity was not verified.');
    const comparison=await call('GET',base+'/compare/main...'+BRANCH);
    if(typeof comparison.behind_by!=='number'||comparison.behind_by!==0)
      throw Error('Review branch is behind main. Refresh it before saving.');
    const source=await call('GET',base+'/contents/'+FILE+'?ref='+BRANCH);
    if(!source||source.type!=='file'||source.path!==FILE||
       !SHA.test(source.sha||'')||source.size<20*1024*1024||
       source.size>MAX_HTML)
      throw Error('Review branch site-content.html was not verified.');
    return Object.freeze({
      format:FORMAT,repository:REPOSITORY,branch:BRANCH,
      expectedHead:review.object.sha,mainHead:main.object.sha,
      currentBlobSha:source.sha,currentBytes:source.size,
      behindMain:comparison.behind_by,aheadOfMain:comparison.ahead_by||0,
      published:false
    });
  }
  async function save(htmlBytes,expectedHead){
    const candidate=validateHtml(htmlBytes);
    if(!SHA.test(expectedHead||''))throw Error('Expected review head is invalid.');
    const before=await status();
    if(before.expectedHead!==expectedHead)
      throw Error('Review branch moved. Reload the editor before saving again.');
    if(candidate.sha===before.currentBlobSha)
      throw Error('Nothing changed in site-content.html; no GitHub commit was created.');
    const base='/repos/'+REPOSITORY;
    const payload={
      message:'Save Resource Hub visual-admin changes',
      content:candidate.bytes.toString('base64'),
      branch:BRANCH,sha:before.currentBlobSha
    };
    const written=await call('PUT',base+'/contents/'+FILE,payload);
    if(!written||!written.commit||!SHA.test(written.commit.sha||'')||
       !written.content||written.content.path!==FILE||
       written.content.sha!==candidate.sha)
      throw Error('SAVE_OUTCOME_UNCERTAIN: GitHub did not acknowledge the exact source blob.');
    const commitSha=written.commit.sha;
    const afterRef=await call('GET',base+'/git/ref/heads/'+BRANCH);
    const commit=await call('GET',base+'/git/commits/'+commitSha);
    const afterFile=await call('GET',base+'/contents/'+FILE+'?ref='+BRANCH);
    const mainAfter=await call('GET',base+'/git/ref/heads/main');
    if(afterRef.object.sha!==commitSha||commit.sha!==commitSha||
       !Array.isArray(commit.parents)||commit.parents.length!==1||
       commit.parents[0].sha!==expectedHead||
       afterFile.sha!==candidate.sha||afterFile.size!==candidate.bytes.length||
       mainAfter.object.sha!==before.mainHead)
      throw Error('SAVE_OUTCOME_UNCERTAIN: independent GitHub readback did not match.');
    return Object.freeze({
      format:'naxx-original-editor-save-result-v1',
      result:'saved-to-review-branch',repository:REPOSITORY,branch:BRANCH,
      parentCommit:expectedHead,commit:commitSha,blobSha:candidate.sha,
      bytes:candidate.bytes.length,mainHead:before.mainHead,
      mainUnchanged:true,published:false
    });
  }
  return Object.freeze({format:FORMAT,status,save});
}
module.exports=Object.freeze({
  FORMAT,REPOSITORY,BRANCH,FILE,approvedRoute,blobSha,validateHtml,
  requestTransport,createStore
});
