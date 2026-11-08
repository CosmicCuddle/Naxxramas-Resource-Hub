'use strict';
/*
 * An explicitly opted-in, server-only GitHub REST/GraphQL transport for a
 * SEPARATE editor sandbox repository. Never import into browser scripts.
 * No default GitHub network client, token discovery, CLI, or startup hook.
 */
const https=require('node:https');
const {treeOid}=require('./rehearse-browser-zip-git-tree-intent.cjs');
const {MUTATION,safeBranch}=require('./conditional-remote-ref-transport.cjs');
const {filePaths}=require('./rehearse-resource-only-overlay.cjs');
const {PAGES,NAV}=require('./plan-page-draft.cjs');
const {RUNTIME}=require('./plan-private-github-source-review.cjs');
const SOURCE_FILES=filePaths(), TRACKED=new Set([...PAGES,NAV,RUNTIME]);
const FORMAT='naxx-server-only-github-sandbox-transport-v1';
const SHA=/^[a-f0-9]{40}$/;
const TEST_REPO=/^CosmicCuddle\/Naxxramas-Editor-Save-Sandbox-[a-z0-9-]{1,40}$/;
const NODE_ID=/^[A-Za-z0-9_+=-]{3,180}$/;
const MAX_JSON=64*1024*1024;
function ensureRepo(repository) {
  if(typeof repository!=='string'||!TEST_REPO.test(repository))
    throw Error('Only an expressly named, separate editor sandbox repository is permitted.');
  return repository;
}
function strictHttpsTransport() {
  // This transport has no saved credentials and only contacts api.github.com.
  // The adapter itself must be explicitly opted in and given a token in memory.
  return function send({method,path,headers,body}) {
    if(!['GET','POST'].includes(method)||typeof path!=='string'||
       !(/^\/repos\/CosmicCuddle\/Naxxramas-Editor-Save-Sandbox-[a-z0-9-]+\/git\//.test(path)||path==='/graphql'))
      throw Error('Unapproved GitHub sandbox API endpoint.');
    return new Promise((resolve,reject)=>{
      const req=https.request({protocol:'https:',hostname:'api.github.com',port:443,
        method,path,headers,timeout:90000,rejectUnauthorized:true},res=>{
        let size=0;const chunks=[];
        res.on('data',chunk=>{
          size+=chunk.length;
          if(size>MAX_JSON){req.destroy();reject(Error('GitHub response exceeded safe limit.'));return;}
          chunks.push(chunk);
        });
        res.on('end',()=>{
          // Redirects are never followed; never send credentials to another host.
          try{resolve({status:res.statusCode,body:Buffer.concat(chunks).toString('utf8')});}
          catch(_){reject(Error('GitHub response could not be decoded.'));}
        });
      });
      req.on('timeout',()=>req.destroy(Error('GitHub response timed out.')));
      req.on('error',()=>reject(Error('GitHub sandbox network request failed.')));
      req.end(body);
    });
  };
}
function createGitHubSandboxApi(options) {
  if(!options||options.enabledForExplicitSandboxTest!==true||
     options.disposableTestApproved!==true||
     typeof options.token!=='string'||options.token.length<12||
     /[\x00-\x20\x7f]/.test(options.token)||
     typeof options.request!=='function'||
     !safeBranch(options.branch))
    throw Error('An explicitly opted-in, non-publishing sandbox and in-memory server token are required.');
  const repository=ensureRepo(options.repository);
  const [owner,name]=repository.split('/');
  const base='/repos/'+owner+'/'+name;
  const branch=options.branch;
  let verifiedNodeId=null;
  let pendingAfter=null;
  function assertTarget(value){if(value!==repository)throw Error('Sandbox API target repository mismatch.');}
  function assertPrivateIdentity(){
    if(verifiedNodeId===null)
      throw Error('Private sandbox repository identity must be verified BEFORE object access.');
  }
  async function call(method,path,payload){
    const serialized=payload===undefined?'':JSON.stringify(payload);
    if(Buffer.byteLength(serialized)>MAX_JSON)throw Error('Sandbox Git request exceeded 64 MiB limit.');
    let response;
    try{
      response=await options.request({method,path,body:serialized,headers:{
        'Authorization':'Bearer '+options.token,
        'Accept':'application/vnd.github+json',
        'Content-Type':'application/json',
        'X-GitHub-Api-Version':'2022-11-28',
        'User-Agent':'Naxxramas-Editor-Sandbox-Verification',
        'Content-Length':String(Buffer.byteLength(serialized))
      }});
    }catch(_){throw Error('SANDBOX_OUTCOME_UNCERTAIN: GitHub request did not return safely.');}
    if(!response||response.status<200||response.status>=300||
       typeof response.body!=='string'||response.body.length>MAX_JSON)
      throw Error('Sandbox GitHub API rejected the request; do not retry automatically.');
    try {return JSON.parse(response.body);}catch(_){
      throw Error('SANDBOX_OUTCOME_UNCERTAIN: unrecognised GitHub API response.');
    }
  }
  const branchPath=branch.split('/').map(encodeURIComponent).join('/');
  async function readRepositoryNodeId(){
    // A failed refresh invalidates earlier identity. Refuse public,
    // internal, archived, locked or disabled test repositories.
    verifiedNodeId=null;
    pendingAfter=null;
    const data=await call('POST','/graphql',{
      query:'query NaxxEditorSandboxRepository($owner:String!,$name:String!){repository(owner:$owner,name:$name){id nameWithOwner visibility isPrivate isArchived isDisabled isLocked}}',
      variables:{owner,name}
    });
    const value=data&&data.data&&data.data.repository;
    if(!value||value.nameWithOwner!==repository||
       !NODE_ID.test(value.id||'')||
       value.visibility!=='PRIVATE'||value.isPrivate!==true||
       value.isArchived!==false||value.isDisabled!==false||
       value.isLocked!==false)
      throw Error('The GitHub test repository is not a verified active PRIVATE sandbox.');
    verifiedNodeId=value.id;
    return Object.freeze({repository,nodeId:verifiedNodeId,
      visibility:'PRIVATE',active:true});
  }
  const objects={
    async createBlob({repository:target,content,encoding}){
      assertPrivateIdentity();
      assertTarget(target);
      if(encoding!=='base64'||typeof content!=='string'||content.length>55*1024*1024||
         !/^[a-zA-Z0-9+/]*={0,2}$/.test(content))
        throw Error('Unexpected sandbox blob encoding/size.');
      return call('POST',base+'/git/blobs',{content,encoding});
    },
    async createTree({repository:target,base_tree,tree}){
      assertPrivateIdentity();
      assertTarget(target);
      if(!SHA.test(base_tree||'')||!Array.isArray(tree)||tree.length<1||tree.length>500||
         tree.some(f=>!f||!(SOURCE_FILES.has(f.path)||TRACKED.has(f.path))||
           !['100644','100755'].includes(f.mode)||f.type!=='blob'||!SHA.test(f.sha||'')))
        throw Error('Unapproved Git tree paths or source metadata.');
      return call('POST',base+'/git/trees',{base_tree,tree});
    },
    async createCommit({repository:target,message,tree,parents}){
      assertPrivateIdentity();
      assertTarget(target);
      if(typeof message!=='string'||message.length>180||
         !SHA.test(tree||'')||!Array.isArray(parents)||parents.length!==1||!SHA.test(parents[0]||''))
        throw Error('Unsafe sandbox commit parent or tree.');
      return call('POST',base+'/git/commits',{message,tree,parents});
    },
    async readCommit(commit){
      assertPrivateIdentity();
      if(!SHA.test(commit||''))throw Error('Invalid sandbox commit ref.');
      const data=await call('GET',base+'/git/commits/'+commit);
      if(!data||data.sha!==commit||!data.tree||!SHA.test(data.tree.sha||'')||
         !Array.isArray(data.parents)||data.parents.length!==1||!SHA.test(data.parents[0].sha||''))
        throw Error('GitHub sandbox commit metadata is inconsistent.');
      return Object.freeze({repository,sha:commit,treeOid:data.tree.sha,parents:[data.parents[0].sha]});
    }
  };
  const refs={
    async readRef(){
      assertPrivateIdentity();
      const result=await call('GET',base+'/git/ref/heads/'+branchPath);
      if(!result||result.ref!=='refs/heads/'+branch||!result.object||
         !SHA.test(result.object.sha||''))
        throw Error('Sandbox branch identity was not verified.');
      return {repository,branch,oid:result.object.sha};
    },
    async updateRefs(query,variables){
      assertPrivateIdentity();
      const earlierNodeId=verifiedNodeId;
      // Refresh actual private/active status at the final write boundary.
      const current=await readRepositoryNodeId();
      if(current.nodeId!==earlierNodeId)
        throw Error('Sandbox repository identity changed before the ref update.');
      const i=variables&&variables.input;
      if(query!==MUTATION||!i||i.repositoryId!==verifiedNodeId||
         !Array.isArray(i.refUpdates)||i.refUpdates.length!==1||
         i.refUpdates[0].name!=='refs/heads/'+branch||
         !SHA.test(i.refUpdates[0].beforeOid||'')||
         !SHA.test(i.refUpdates[0].afterOid||'')||
         i.refUpdates[0].force!==false)
        throw Error('Unsafe conditional sandbox branch update was refused.');
      pendingAfter=i.refUpdates[0].afterOid;
      return call('POST','/graphql',{query,variables});
    },
    async readCommit(){
      assertPrivateIdentity();
      if(!pendingAfter)throw Error('No conditional sandbox commit was submitted.');
      const saved=await objects.readCommit(pendingAfter);
      const listing=await call('GET',base+'/git/trees/'+saved.treeOid+'?recursive=1');
      if(!listing||listing.sha!==saved.treeOid||listing.truncated!==false||
         !Array.isArray(listing.tree)||!listing.tree.length)
        throw Error('The complete sandbox Git tree could not be verified.');
      if(listing.tree.some(e=>e.type!=='blob'&&e.type!=='tree'))
        throw Error('Unsupported Git object type in sandbox site.');
      const files=listing.tree.filter(e=>e.type==='blob').map(e=>({
        path:e.path,mode:e.mode,oid:e.sha
      }));
      if(files.length<1||treeOid(files)!==saved.treeOid)
        throw Error('GitHub sandbox tree contents do not match verified Git identities.');
      return {repository,commit:pendingAfter,parentCommit:saved.parents[0],
        treeOid:saved.treeOid,checkedBlobsAndPaths:true};
    }
  };
  return Object.freeze({format:FORMAT,repository,branch,objects:Object.freeze(objects),
    refs:Object.freeze(refs),readRepositoryNodeId});
}
module.exports=Object.freeze({FORMAT,ensureRepo,strictHttpsTransport,createGitHubSandboxApi});
