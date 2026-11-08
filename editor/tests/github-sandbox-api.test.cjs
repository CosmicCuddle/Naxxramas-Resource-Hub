'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createGitHubSandboxApi,ensureRepo,FORMAT,strictHttpsTransport}=
  require('../tools/github-sandbox-api.cjs');
const {treeOid}=require('../tools/rehearse-browser-zip-git-tree-intent.cjs');
const {MUTATION}=require('../tools/conditional-remote-ref-transport.cjs');
const REPO='CosmicCuddle/Naxxramas-Editor-Save-Sandbox-01',
  branch='editor-saves/test-01';
const OLD='a'.repeat(40),NEW='b'.repeat(40);
const file={path:'site-content.html',mode:'100644',oid:'c'.repeat(40)};
const tree=treeOid([file]);
function mock(){
  const seen=[];
  const send=async req=>{
    seen.push(req);
    let body={};
    if(req.path==='/graphql'){
      const payload=JSON.parse(req.body);
      if(payload.query.startsWith('query'))
        body={data:{repository:{id:'R_verifiedSandbox01',nameWithOwner:REPO,visibility:'PRIVATE',isPrivate:true,isArchived:false,isDisabled:false,isLocked:false}}};
      else body={data:{updateRefs:{clientMutationId:payload.variables.input.clientMutationId}}};
    }else if(req.path.includes('/git/ref/'))
      body={ref:'refs/heads/'+branch,object:{sha:OLD}};
    else if(req.path.includes('/git/trees/'+tree))
      body={sha:tree,truncated:false,tree:[{
        path:'site-content.html',mode:'100644',type:'blob',sha:file.oid
      }]};
    else if(req.path.endsWith('/git/blobs'))body={sha:file.oid};
    else if(req.path.endsWith('/git/trees'))body={sha:tree};
    else if(req.path.endsWith('/git/commits'))body={sha:NEW};
    else if(req.path.includes('/git/commits/'+NEW))
      body={sha:NEW,tree:{sha:tree},parents:[{sha:OLD}]};
    else throw Error('Unknown test path '+req.path);
    return {status:200,body:JSON.stringify(body)};
  };
  return {seen,send};
}
function connect(m){
  return createGitHubSandboxApi({
    enabledForExplicitSandboxTest:true,disposableTestApproved:true,
    token:'ghs_FictionalSecret_NOT_REAL',
    repository:REPO,branch,request:m.send
  });
}
test('production repository, missing opt-in, insecure sandbox name and main branch are blocked',()=>{
  for(const name of [
    'CosmicCuddle/Naxxramas-Resource-Hub','Other/sandbox',
    'CosmicCuddle/Naxxramas-Editor-Save-Sandbox-../evil'
  ])assert.throws(()=>ensureRepo(name));
  const m=mock();
  assert.throws(()=>createGitHubSandboxApi({
    repository:REPO,branch,request:m.send,token:'ghs_FictionalSecret_NOT_REAL'
  }));
  assert.throws(()=>createGitHubSandboxApi({
    enabledForExplicitSandboxTest:true,disposableTestApproved:true,
    repository:REPO,branch:'main',request:m.send,
    token:'ghs_FictionalSecret_NOT_REAL'
  }));
  const httpsTransport=strictHttpsTransport();
  assert.throws(()=>httpsTransport({
    method:'POST',path:'/repos/CosmicCuddle/Naxxramas-Resource-Hub/git/refs',
    headers:{},body:''
  }),/Unapproved/);
});
test('GitHub adapter serializes source objects and verified node identity without returning credentials',async()=>{
  const m=mock(),api=connect(m);
  assert.equal(api.format,FORMAT);
  const node=await api.readRepositoryNodeId();
  assert.equal(node.nodeId,'R_verifiedSandbox01');
  const blob=await api.objects.createBlob({
    repository:REPO,content:'YWJjZA==',encoding:'base64'
  });
  assert.equal(blob.sha,file.oid);
  const madeTree=await api.objects.createTree({
    repository:REPO,base_tree:OLD,tree:[{
      path:file.path,mode:file.mode,type:'blob',sha:file.oid
    }]
  });
  assert.equal(madeTree.sha,tree);
  const commit=await api.objects.createCommit({
    repository:REPO,message:'Sandbox test',tree,parents:[OLD]
  });
  assert.equal(commit.sha,NEW);
  const read=await api.objects.readCommit(NEW);
  assert.equal(read.treeOid,tree);
  assert.equal(m.seen.length,5);
  assert.equal(m.seen[0].path,'/graphql');
  assert.ok(m.seen.every(x=>
    x.headers.Authorization==='Bearer ghs_FictionalSecret_NOT_REAL'));
  assert.equal(JSON.stringify(api).includes('FictionalSecret'),false);
});
test('conditional ref update requires verified repository node and independently checked Git tree',async()=>{
  const m=mock(),api=connect(m);
  await api.readRepositoryNodeId();
  const before=await api.refs.readRef();
  assert.equal(before.oid,OLD);
  const variables={input:{
    repositoryId:'R_verifiedSandbox01',
    clientMutationId:'naxx-sandbox-1234',
    refUpdates:[{name:'refs/heads/'+branch,
      beforeOid:OLD,afterOid:NEW,force:false}]
  }};
  const receipt=await api.refs.updateRefs(MUTATION,variables);
  assert.equal(receipt.data.updateRefs.clientMutationId,'naxx-sandbox-1234');
  const after=await api.refs.readCommit();
  assert.equal(after.commit,NEW);
  assert.equal(after.treeOid,tree);
  assert.equal(after.checkedBlobsAndPaths,true);
  assert.ok(m.seen.some(r=>r.path.endsWith('?recursive=1')));
});
test('forged repository node, protected source path and force=true fail before network write',async()=>{
  const m=mock(),api=connect(m);
  await assert.rejects(api.objects.createTree({
    repository:REPO,base_tree:OLD,
    tree:[{path:'index.html',mode:'100644',type:'blob',sha:NEW}]
  }));
  await assert.rejects(api.objects.createBlob({
    repository:'CosmicCuddle/Naxxramas-Resource-Hub',
    content:'YWJjZA==',encoding:'base64'
  }));
  await api.readRepositoryNodeId();
  const count=m.seen.length;
  await assert.rejects(api.refs.updateRefs(MUTATION,{input:{
    repositoryId:'R_bad',
    refUpdates:[{name:'refs/heads/'+branch,
      beforeOid:OLD,afterOid:NEW,force:false}]
  }}));
  await assert.rejects(api.refs.updateRefs(MUTATION,{input:{
    repositoryId:'R_verifiedSandbox01',
    refUpdates:[{name:'refs/heads/'+branch,
      beforeOid:OLD,afterOid:NEW,force:true}]
  }}));
  assert.equal(m.seen.length,count);
});
test('unknown GitHub response is uncertain, never automatically retried or leaks a token',async()=>{
  const api=connect({send:async()=>({status:500,body:'{"token":"PRIVATE"}'})});
  await assert.rejects(api.readRepositoryNodeId(),/rejected/);
  let calls=0;
  const failed=connect({send:async()=>{calls++;throw Error('SECRET token');}});
  await assert.rejects(failed.readRepositoryNodeId(),
    err=>!err.message.includes('SECRET')&&/OUTCOME_UNCERTAIN/.test(err.message));
  assert.equal(calls,1);
});
