'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const cp=require('node:child_process'),vm=require('node:vm');
const crypto=require('node:crypto');
const {PAGES,NAV,runs}=require('../tools/plan-page-draft.cjs');
const {SOURCE_SHA}=require('../tools/audit-source-storage-budget.cjs');
const {gitBlobOid}=require('../tools/rehearse-browser-zip-git-tree-intent.cjs');
const {prepareSandboxSource,FORMAT}=
  require('../tools/prepare-sandbox-source-from-zip.cjs');
const {rehearseSandboxRemoteSave}=
  require('../tools/rehearse-sandbox-remote-save.cjs');
const root=path.resolve(__dirname,'..','..');
const editor=path.resolve(__dirname,'..');
const REPO='CosmicCuddle/Naxxramas-Editor-Save-Sandbox-01';
const BRANCH='editor-saves/original-source-check';
const NEW='f'.repeat(40);
const head=cp.execFileSync('git',['rev-parse','HEAD'],{
  cwd:root,encoding:'utf8'}).trim();
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const gitStatus=()=>cp.execFileSync('git',['status','--porcelain=v1','--untracked-files=all'],{
  cwd:root,encoding:'utf8'}).trim();
async function originalBrowserZip(){
  const pageOriginal=fs.readFileSync(path.join(root,PAGES[0]),'utf8');
  const text=runs(pageOriginal).find(x=>x.kind==='text');
  assert.ok(text);
  const navOriginal=fs.readFileSync(path.join(root,NAV));
  const nav=JSON.parse(navOriginal.toString('utf8'));
  nav.pages[0].label='Private Git sandbox verification only';
  const pages={format:'naxx-local-draft-v3',
    sourceBranchHint:'feature/multi-file-editor-export-2026-11-05',
    sourceCommitVerified:false,createdAt:'2026-11-08T00:00:00Z',
    files:PAGES.map(file=>({
      path:file,sourceSha256:sha(fs.readFileSync(path.join(root,file))),
      edits:file===PAGES[0]?{[text.id]:'Verified local source before any GitHub test'}:{}
    })),
    navigation:{path:NAV,sourceSha256:sha(navOriginal),document:nav}
  };
  const resources={
    format:'naxx-local-resource-draft-v2',baselineSha256:SOURCE_SHA,
    changes:[
      {index:0,title:'Temporary source-to-test-branch check'},
      {index:413,content:'A fictional private test resource.\n\nIts second paragraph.'}
    ]
  };
  const box={TextEncoder,Blob,Uint8Array,Uint32Array,DataView,
    crypto:crypto.webcrypto,document:{getElementById(){return null;}}};
  for(const name of ['export-zip.js','review-package.js']){
    vm.runInNewContext(fs.readFileSync(path.join(editor,name),'utf8'),
      box,{filename:name,timeout:5000});
  }
  const output=await box.NaxxEditorReview.build(pages,resources,box.NaxxEditorZip);
  return Buffer.from(await output.blob.arrayBuffer());
}
function fictionalAdapters(candidate){
  let current=candidate.expectedParent,uploads=0,commitCalls=0,
    refCalls=0,treeCalls=0,readbacks=0;
  const expectedTree=candidate.expectedNextTree;
  const objects={
    createBlob:async r=>{
      uploads++;
      assert.equal(r.repository,REPO);
      return {sha:gitBlobOid(Buffer.from(r.content,'base64'))};
    },
    createTree:async r=>{
      treeCalls++;
      assert.equal(r.repository,REPO);
      assert.equal(r.base_tree,candidate.expectedBaseTree);
      assert.equal(r.tree.length,418);
      return {sha:expectedTree};
    },
    createCommit:async r=>{
      commitCalls++;
      assert.equal(r.repository,REPO);
      assert.deepEqual(r.parents,[candidate.expectedParent]);
      assert.equal(r.tree,expectedTree);
      return {sha:NEW};
    },
    readCommit:async id=>{
      assert.equal(id,NEW);
      readbacks++;
      return {repository:REPO,sha:NEW,treeOid:expectedTree,
        parents:[candidate.expectedParent]};
    }
  };
  const refs={
    readRef:async()=>({repository:REPO,branch:BRANCH,oid:current}),
    updateRefs:async(_query,variables)=>{
      refCalls++;
      const rule=variables.input.refUpdates[0];
      assert.equal(rule.name,'refs/heads/'+BRANCH);
      assert.equal(rule.beforeOid,candidate.expectedParent);
      assert.equal(rule.afterOid,NEW);
      assert.equal(rule.force,false);
      assert.equal(current,rule.beforeOid);
      current=NEW;
      return {data:{updateRefs:{clientMutationId:variables.input.clientMutationId}}};
    },
    readCommit:async()=>({
      repository:REPO,commit:NEW,parentCommit:candidate.expectedParent,
      treeOid:expectedTree,checkedBlobsAndPaths:true
    })
  };
  return {objects,refs,get counters(){
    return {uploads,commitCalls,refCalls,treeCalls,readbacks,current};
  }};
}
test('actual original 31 MB browser ZIP produces exact 418 Git blobs after byte-exact private rollback, and test-only remote Save succeeds',async()=>{
  const before=gitStatus();
  const original=fs.readFileSync(path.join(root,'site-content.html'));
  assert.equal(original.length,30976969);
  assert.equal(sha(original),SOURCE_SHA);
  const zip=await originalBrowserZip();
  const prepared=await prepareSandboxSource(root,zip,head,REPO);
  assert.equal(prepared.format,FORMAT);
  assert.equal(prepared.originalSourceCommit,head);
  assert.equal(prepared.originalSourceCheckoutPreserved,true);
  assert.equal(prepared.localTemporarySiteRolledBackAndDeleted,true);
  assert.equal(prepared.ownerHeldGitHistoryBackupPresent,false);
  assert.equal(prepared.productionGitHubWriteAuthorized,false);
  assert.equal(prepared.canonical415SourceLayoutApproved,false);
  assert.equal(prepared.candidate.files.length,418);
  assert.equal(prepared.candidate.proof.changedExistingGitBlobs,3);
  const rebuilt=prepared.candidate.files.find(x=>x.path==='site-content.html');
  assert.ok(rebuilt&&rebuilt.bytes.length>29*1024*1024);
  assert.notEqual(sha(rebuilt.bytes),SOURCE_SHA);
  const fake=fictionalAdapters(prepared.candidate);
  const result=await rehearseSandboxRemoteSave({
    candidate:prepared.candidate,branch:BRANCH,
    repositoryId:'R_fictionalVerifiedNodeOnly',
    disposableTestOnly:true,publishDisabled:true,
    ownerBackupNotClaimed:true
  },fake);
  assert.equal(result.blobsVerified,418);
  assert.equal(result.remoteHeadAndTreeIndependentlyReadBack,true);
  assert.equal(result.exactOldHeadVerifiedAtMutation,true);
  assert.equal(result.productionSaveEnabled,false);
  assert.equal(result.ownerHeldBackupVerified,false);
  assert.equal(result.canPublish,false);
  assert.deepEqual(fake.counters,{
    uploads:418,commitCalls:1,refCalls:1,treeCalls:1,
    readbacks:1,current:NEW
  });
  assert.equal(gitStatus(),before);
  assert.equal(sha(fs.readFileSync(path.join(root,'site-content.html'))),SOURCE_SHA);
});
test('source preparation rejects production repository without opening temporary stage',async()=>{
  await assert.rejects(prepareSandboxSource(root,Buffer.alloc(64),head,
    'CosmicCuddle/Naxxramas-Resource-Hub'),/sandbox/);
});
