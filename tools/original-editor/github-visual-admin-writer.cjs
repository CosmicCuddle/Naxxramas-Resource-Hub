'use strict';
/*
 * GitHub writer for the ORIGINAL visual-admin editor.
 *
 * It updates ONLY site-content.html on the fixed non-live branch:
 *   editor-saves/visual-admin
 * using the user's existing GitHub CLI authentication.
 *
 * It never invokes git, never writes main, never force-updates refs, and
 * never stores or prints a token. GitHub Pages publishing remains separate.
 */
const cp=require('node:child_process');
const crypto=require('node:crypto');
const REPOSITORY='CosmicCuddle/Naxxramas-Resource-Hub';
const BRANCH='editor-saves/visual-admin';
const FILE='site-content.html';
const SHA=/^[a-f0-9]{40}$/;
const MAX_HTML=40*1024*1024;
function gitBlobSha(bytes){
  return crypto.createHash('sha1')
    .update(Buffer.from('blob '+bytes.length+'\0','utf8')).update(bytes).digest('hex');
}
function ghApi(endpoint,method='GET',payload,spawn=cp.spawnSync){
  if(typeof endpoint!=='string'||!endpoint.startsWith('repos/'+REPOSITORY+'/'))
    throw Error('Unapproved GitHub API endpoint.');
  if(!['GET','POST','PATCH'].includes(method))throw Error('Unapproved GitHub API method.');
  const args=['api','--hostname','github.com','--method',method,endpoint];
  let input;
  if(payload!==undefined){
    args.push('--input','-');
    input=JSON.stringify(payload);
  }
  const r=spawn('gh',args,{shell:false,encoding:'utf8',input,
    timeout:120000,maxBuffer:4*1024*1024,
    stdio:['pipe','pipe','pipe']});
  if(!r||r.error||r.status!==0||typeof r.stdout!=='string')
    throw Error('GitHub rejected the protected website draft operation.');
  try{return JSON.parse(r.stdout);}
  catch(_){throw Error('GitHub returned an unrecognised response.');}
}
function branchRefPath(){
  return 'repos/'+REPOSITORY+'/git/ref/heads/'+BRANCH;
}
function refsPath(){
  return 'repos/'+REPOSITORY+'/git/refs/heads/'+BRANCH;
}
function checkHead(api=ghApi){
  const ref=api(branchRefPath());
  if(!ref||ref.ref!=='refs/heads/'+BRANCH||!ref.object||!SHA.test(ref.object.sha||''))
    throw Error('The protected website draft branch is unavailable.');
  return ref.object.sha;
}
function validateHtml(bytes){
  if(!Buffer.isBuffer(bytes)||bytes.length<1024*1024||bytes.length>MAX_HTML)
    throw Error('Edited website HTML is outside the protected size range.');
  const text=bytes.toString('utf8');
  if(!Buffer.from(text,'utf8').equals(bytes)||
     !/^<!doctype html>/i.test(text.slice(0,64))||
     !text.includes('id="embedded-data"')||
     !text.includes('function exportUpdatedHtml()')||
     !text.includes('Naxxramas')||
     !/<\/html>\s*$/i.test(text))
    throw Error('Edited website HTML does not match the original Resource Hub shape.');
  return text;
}
function status(api=ghApi){
  return Object.freeze({repository:REPOSITORY,branch:BRANCH,
    expectedHead:checkHead(api),file:FILE,published:false});
}
function saveHtml(bytes,expectedHead,api=ghApi){
  validateHtml(bytes);
  if(!SHA.test(expectedHead||''))throw Error('A pinned draft branch head is required.');
  const head=checkHead(api);
  if(head!==expectedHead)throw Error('The GitHub draft changed. Reload before saving again.');
  const commit=api('repos/'+REPOSITORY+'/git/commits/'+head);
  if(!commit||commit.sha!==head||!commit.tree||!SHA.test(commit.tree.sha||''))
    throw Error('The current draft commit could not be verified.');
  const localBlob=gitBlobSha(bytes);
  const blob=api('repos/'+REPOSITORY+'/git/blobs','POST',{
    content:bytes.toString('base64'),encoding:'base64'
  });
  if(!blob||blob.sha!==localBlob)throw Error('GitHub did not store the exact edited website bytes.');
  const tree=api('repos/'+REPOSITORY+'/git/trees','POST',{
    base_tree:commit.tree.sha,
    tree:[{path:FILE,mode:'100644',type:'blob',sha:blob.sha}]
  });
  if(!tree||!SHA.test(tree.sha||''))throw Error('GitHub did not create the protected draft tree.');
  const next=api('repos/'+REPOSITORY+'/git/commits','POST',{
    message:'Save Resource Hub edits from original visual Admin editor',
    tree:tree.sha,parents:[head]
  });
  if(!next||!SHA.test(next.sha||'')||next.sha===head)
    throw Error('GitHub did not create the protected draft commit.');
  const moved=api(refsPath(),'PATCH',{sha:next.sha,force:false});
  if(!moved||!moved.object||moved.object.sha!==next.sha)
    throw Error('GitHub did not advance the protected draft branch.');
  const confirmed=checkHead(api);
  if(confirmed!==next.sha)throw Error('The protected draft branch readback did not match.');
  return Object.freeze({repository:REPOSITORY,branch:BRANCH,file:FILE,
    parentCommit:head,commit:next.sha,gitBlobSha:blob.sha,
    bytesVerified:bytes.length,published:false,mainUpdated:false});
}
module.exports=Object.freeze({REPOSITORY,BRANCH,FILE,MAX_HTML,
  gitBlobSha,validateHtml,ghApi,status,saveHtml});
