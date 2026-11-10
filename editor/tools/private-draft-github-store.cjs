'use strict';
/*
 * PRIVATE DRAFT-ONLY GITHUB SAVE — UNCONNECTED DEVELOPMENT MODULE.
 *
 * Stores ONE bounded combined editor ZIP in the owner's existing PRIVATE
 * sandbox, not the real public website. A save updates only
 * editor-drafts/latest-review.zip on the sandbox's own main branch.
 *
 * No resource source migration, original website history import, publication,
 * deployment, or GitHub credential discovery. The caller must explicitly
 * supply an owner-approved scoped token in memory AND a pinned HTTPS request
 * function. No production companion/launcher imports or enables this module.
 *
 * The private repo needs one existing main commit before the first draft Save.
 * A missing branch fails closed; this utility NEVER creates a repository/ref.
 */
const https=require('node:https');
const {gitBlobOid}=require('./rehearse-browser-zip-git-tree-intent.cjs');
const REPOSITORY='CosmicCuddle/Naxxramas-Editor-Save-Sandbox-01';
const BASE='/repos/'+REPOSITORY;
const BRANCH='main',PATH='editor-drafts/latest-review.zip';
const SHA=/^[0-9a-f]{40}$/;
const MAX_ZIP=20*1024*1024;
const MAX_REPLY=45*1024*1024;
const FORMAT='naxx-private-editor-draft-store-v1';
function validRoute(method,url){
  return (method==='GET'&&(url===BASE||
    url===BASE+'/git/ref/heads/'+BRANCH||
    url===BASE+'/contents/'+PATH+'?ref='+BRANCH||
    /^\/repos\/CosmicCuddle\/Naxxramas-Editor-Save-Sandbox-01\/git\/commits\/[a-f0-9]{40}$/.test(url)))||
    (method==='PUT'&&url===BASE+'/contents/'+PATH);
}
function strictHttpsTransport(){
  return function request({method,path,headers,body}){
    if(!validRoute(method,path)||!['GET','PUT'].includes(method)||
       typeof body!=='string'||Buffer.byteLength(body)>MAX_REPLY)
      throw Error('Unapproved private draft GitHub transport route.');
    return new Promise((resolve,reject)=>{
      const req=https.request({hostname:'api.github.com',protocol:'https:',port:443,
        method,path,headers,timeout:90000,rejectUnauthorized:true},res=>{
        let size=0;const chunks=[];
        res.on('data',chunk=>{
          size+=chunk.length;
          if(size>MAX_REPLY){
            req.destroy();reject(Error('Private draft GitHub response was oversized.'));
          }else chunks.push(chunk);
        });
        res.on('end',()=>{
          resolve({status:res.statusCode,body:Buffer.concat(chunks).toString('utf8')});
        });
      });
      req.on('error',()=>reject(Error('Private draft GitHub network result is uncertain.')));
      req.on('timeout',()=>req.destroy(Error('Private draft GitHub response timed out.')));
      req.end(body);
    });
  };
}
function createPrivateDraftStore(options){
  if(!options||options.enabledByExplicitOwnerApproval!==true||
     options.repository!==REPOSITORY||
     typeof options.token!=='string'||options.token.length<12||
     /[\x00-\x20\x7f]/.test(options.token)||
     typeof options.request!=='function')
    throw Error('Explicit owner-approved PRIVATE sandbox storage and an in-memory scoped token are required.');
  let privateVerified=false;
  async function call(method,url,payload,allow404=false){
    if(!validRoute(method,url))throw Error('Forbidden private draft GitHub API path.');
    const body=payload===undefined?'':JSON.stringify(payload);
    if(Buffer.byteLength(body)>MAX_REPLY)throw Error('Private draft request was oversized.');
    let r;
    try{
      r=await options.request({method,path:url,body,headers:{
        'Authorization':'Bearer '+options.token,
        'Accept':'application/vnd.github+json',
        'Content-Type':'application/json',
        'X-GitHub-Api-Version':'2022-11-28',
        'User-Agent':'Naxxramas-Private-Draft-Save',
        'Content-Length':String(Buffer.byteLength(body))
      }});
    }catch(_){throw Error('PRIVATE_DRAFT_OUTCOME_UNCERTAIN: no automatic retry.');}
    if(allow404&&r&&r.status===404)return null;
    if(!r||r.status<200||r.status>=300||typeof r.body!=='string'||
       Buffer.byteLength(r.body)>MAX_REPLY)
      throw Error('PRIVATE_DRAFT_OUTCOME_UNCERTAIN: GitHub rejected or did not confirm the request.');
    try{return JSON.parse(r.body);}catch(_){
      throw Error('PRIVATE_DRAFT_OUTCOME_UNCERTAIN: unrecognised GitHub response.');
    }
  }
  async function checkPrivate(){
    privateVerified=false;
    const repo=await call('GET',BASE);
    if(!repo||repo.full_name!==REPOSITORY||repo.private!==true||
       repo.visibility!=='private'||repo.archived!==false||
       repo.disabled!==false)
      throw Error('The owner-owned draft repository is not active and PRIVATE.');
    privateVerified=true;
    return true;
  }
  async function head(){
    if(!privateVerified)throw Error('PRIVATE identity check required.');
    const ref=await call('GET',BASE+'/git/ref/heads/'+BRANCH,undefined,true);
    if(!ref||ref.ref!=='refs/heads/'+BRANCH||!ref.object||
       !SHA.test(ref.object.sha||''))
      throw Error('The private draft branch is not initialised yet.');
    return ref.object.sha;
  }
  async function readFile(){
    if(!privateVerified)throw Error('PRIVATE identity check required.');
    const file=await call('GET',BASE+'/contents/'+PATH+'?ref='+BRANCH,undefined,true);
    if(!file)return null;
    if(file.type!=='file'||file.path!==PATH||file.encoding!=='base64'||
       !SHA.test(file.sha||'')||typeof file.content!=='string')
      throw Error('Unexpected private draft file metadata.');
    const text=file.content.replace(/\s/g,'');
    if(!/^[A-Za-z0-9+/]*={0,2}$/.test(text)||text.length>Math.ceil(MAX_ZIP*4/3)+8)
      throw Error('Unexpected private draft content encoding.');
    const bytes=Buffer.from(text,'base64');
    if(bytes.length<22||bytes.length>MAX_ZIP||gitBlobOid(bytes)!==file.sha)
      throw Error('Private draft bytes do not match GitHub Git-blob identity.');
    return Object.freeze({sha:file.sha,bytes});
  }
  async function status(){
    await checkPrivate();
    const current=await head();
    const draft=await readFile();
    return Object.freeze({format:FORMAT,repository:REPOSITORY,branch:BRANCH,
      expectedHead:current,draftGitBlobSha:draft?draft.sha:null,
      privateVerified:true,draftExists:!!draft,published:false});
  }
  async function load(){
    const before=await status();
    const found=await readFile();
    if(!found)return null;
    if(found.sha!==before.draftGitBlobSha||(await head())!==before.expectedHead)
      throw Error('Private draft changed during read. Do not use an uncertain copy.');
    return Object.freeze({bytes:found.bytes,sha:found.sha,
      commit:before.expectedHead,published:false});
  }
  async function save(zip,expectedHead){
    if(!Buffer.isBuffer(zip)||zip.length<22||zip.length>MAX_ZIP||
       zip[0]!==0x50||zip[1]!==0x4b||zip[2]!==0x03||zip[3]!==0x04||
       !SHA.test(expectedHead||''))
      throw Error('Private draft ZIP or pinned old head is invalid.');
    const old=await status();
    if(old.expectedHead!==expectedHead)
      throw Error('Private draft has moved. Reload before saving.');
    const nextBlob=gitBlobOid(zip);
    if(old.draftGitBlobSha===nextBlob)
      throw Error('Private draft is unchanged; no new GitHub commit is necessary.');
    const payload={message:'Save unpublished Naxxramas website editor draft',
      content:zip.toString('base64'),branch:BRANCH};
    if(old.draftGitBlobSha)payload.sha=old.draftGitBlobSha;
    const written=await call('PUT',BASE+'/contents/'+PATH,payload);
    const commit=written&&written.commit,blob=written&&written.content;
    if(!commit||!SHA.test(commit.sha||'')||
       !blob||blob.path!==PATH||blob.sha!==nextBlob)
      throw Error('PRIVATE_DRAFT_OUTCOME_UNCERTAIN: GitHub did not acknowledge the exact draft.');
    // Independent readback: the Save is successful ONLY if the one-parent
    // commit advances EXACTLY the expected old branch and bytes are identical.
    const current=await head();
    const meta=await call('GET',BASE+'/git/commits/'+commit.sha);
    const restored=await readFile();
    if(current!==commit.sha||!meta||meta.sha!==commit.sha||
       !Array.isArray(meta.parents)||meta.parents.length!==1||
       meta.parents[0].sha!==expectedHead||!restored||
       restored.sha!==nextBlob||!restored.bytes.equals(zip))
      throw Error('PRIVATE_DRAFT_OUTCOME_UNCERTAIN: saved draft readback was not verified.');
    return Object.freeze({format:FORMAT,result:'private-draft-saved-and-verified',
      repository:REPOSITORY,branch:BRANCH,commit:commit.sha,
      parentCommit:expectedHead,gitBlobSha:nextBlob,bytesVerified:zip.length,
      privateVerified:true,published:false,websiteSourceUnchanged:true});
  }
  return Object.freeze({format:FORMAT,repository:REPOSITORY,status,load,save});
}
module.exports=Object.freeze({FORMAT,REPOSITORY,BRANCH,PATH,
  validRoute,strictHttpsTransport,createPrivateDraftStore});
