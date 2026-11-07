'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const cp=require('node:child_process'),vm=require('node:vm');
const {PAGES,NAV,runs}=require('../tools/plan-page-draft.cjs');
const {SOURCE_SHA}=require('../tools/audit-source-storage-budget.cjs');
const {RUNTIME}=require('../tools/plan-private-github-source-review.cjs');
const {recordPath,MANIFEST}=require('../tools/rehearse-resource-only-overlay.cjs');
const {gitBlobOid,treeOid,gitTreeInventory,reviewBrowserGitTree,FORMAT}=
  require('../tools/rehearse-browser-zip-git-tree-intent.cjs');
const root=path.resolve(__dirname,'..','..');
const head=cp.execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
const tree=cp.execFileSync('git',['rev-parse','HEAD^{tree}'],{cwd:root,encoding:'utf8'}).trim();
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const status=()=>cp.execFileSync('git',['status','--porcelain=v1',
  '--untracked-files=all'],{cwd:root,encoding:'utf8'}).trim();
const file=(r,p)=>path.join(r,...p.split('/'));
function drafts(){
  const text=fs.readFileSync(file(root,PAGES[0]),'utf8');
  const first=runs(text).find(x=>x.kind==='text');
  assert.ok(first);
  const originalNav=fs.readFileSync(file(root,NAV));
  const nextNav=JSON.parse(originalNav.toString('utf8'));
  nextNav.pages[0].title='Git blob intent private test';
  return {
    pages:{
      format:'naxx-local-draft-v3',
      sourceBranchHint:'feature/multi-file-editor-export-2026-11-05',
      sourceCommitVerified:false,createdAt:'2026-11-07T12:00:00.000Z',
      files:PAGES.map(p=>({
        path:p,sourceSha256:sha(fs.readFileSync(file(root,p))),
        edits:p===PAGES[0]?{[first.id]:'Git tree metadata private draft'}:{}
      })),
      navigation:{path:NAV,sourceSha256:sha(originalNav),document:nextNav}
    },
    resources:{
      format:'naxx-local-resource-draft-v2',
      baselineSha256:SOURCE_SHA,
      changes:[{index:0,title:'Private Git object source verification'}]
    }
  };
}
async function zip(pages,resources){
  const sandbox={TextEncoder,Blob,Uint8Array,Uint32Array,DataView,
    crypto:crypto.webcrypto,document:{getElementById(){return null;}}};
  for(const name of ['export-zip.js','review-package.js']){
    vm.runInNewContext(fs.readFileSync(file(root,'editor/'+name),'utf8'),
      sandbox,{filename:name,timeout:5000});
  }
  const packed=await sandbox.NaxxEditorReview.build(
    pages,resources,sandbox.NaxxEditorZip);
  return Buffer.from(await packed.blob.arrayBuffer());
}
test('computed Git SHA-1 blob IDs match Git object format without writing',()=>{
  assert.equal(gitBlobOid(Buffer.alloc(0)),
    'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391');
  for(const bytes of [
    Buffer.from('hello\n'),Buffer.from('an\0embedded\0zero'),
    Buffer.from('private example – source','utf8')
  ]){
    const expected=cp.execFileSync('git',
      ['hash-object','--stdin','--no-filters'],
      {cwd:root,input:bytes,encoding:'utf8'}).trim();
    assert.equal(gitBlobOid(bytes),expected);
  }
});
test('independently rebuilt original Git tree equals the ACTUAL reviewed commit tree',()=>{
  const original=gitTreeInventory(root,head);
  assert.equal(original.treeOid,tree);
  assert.ok(original.files.length>50);
  assert.equal(treeOid(original.files),tree);
  assert.ok(original.files.some(f=>f.path===RUNTIME));
  assert.ok(original.files.some(f=>f.path==='index.html'));
});
test('Git tree builder refuses unsafe paths, symlinks, file-folder collisions and duplicate identities',()=>{
  const ok={path:'safe/file.txt',mode:'100644',oid:'a'.repeat(40)};
  for(const entry of [
    {...ok,path:'../outside.txt'},
    {...ok,path:'safe\\wrong.txt'},
    {...ok,mode:'120000'},
    {...ok,oid:'not-oid'}
  ])assert.throws(()=>treeOid([entry]),/Unsafe, duplicated or invalid/);
  assert.throws(()=>treeOid([ok,{...ok}]),/Unsafe, duplicated or invalid/);
  assert.throws(()=>treeOid([
    {path:'safe',mode:'100644',oid:'a'.repeat(40)},ok
  ]),/file\/directory path collision/);
  assert.throws(()=>treeOid([
    ok,{...ok,path:'safe/file.txt/x'}
  ]),/file\/directory path collision/);
});
test('actual private browser ZIP yields exact original Git OIDs and a complete DIFFERENT hypothetical tree',async()=>{
  const d=drafts(),before=status(),bytes=await zip(d.pages,d.resources);
  let sitePath,stagePath;
  const report=await reviewBrowserGitTree(root,bytes,head,view=>{
    sitePath=view.site;stagePath=view.stage;
    assert.equal(view.proof.reviewedGitCommit,head);
    assert.equal(view.proof.originalTreeOid,tree);
    assert.equal(view.proof.changedExistingGitBlobs,3);
    assert.equal(view.proof.newOverlayGitBlobs,415);
    assert.equal(view.proof.proposedTreeIdentityIndependentlyReconstructible,true);
    assert.notEqual(view.proof.proposedTreeOidCalculatedInMemory,tree);
    assert.equal(view.proof.totalProposedGitFiles,
      view.proof.originalGitBlobsVerified+415);
    assert.equal(view.rerun().proposedTreeOidCalculatedInMemory,
      view.proof.proposedTreeOidCalculatedInMemory);
    function tamper(relative,data,error){
      const p=file(view.site,relative),old=fs.readFileSync(p);
      try{
        fs.writeFileSync(p,data);
        assert.throws(()=>view.rerun(),error);
      }finally{fs.writeFileSync(p,old);}
    }
    tamper('index.html',Buffer.from('corrupted original home loader'),
      /Untouched Git-tracked file was modified/);
    tamper(PAGES[0],Buffer.from('incorrect edited page'),
      /Changed source file does not match/);
    tamper(RUNTIME,Buffer.from('corrupted complete compatibility runtime'),
      /Changed source file does not match/);
    tamper(recordPath(205),Buffer.from('corrupted unchanged source fragment'),
      /Proposed resource source bytes differ/);
    tamper(MANIFEST,Buffer.from('forged resource manifest'),
      /Proposed resource source bytes differ/);
    assert.equal(view.rerun().fullProposedPathDigestSha256,
      view.proof.fullProposedPathDigestSha256);
  });
  assert.equal(report.format,FORMAT);
  assert.equal(report.changedExistingGitBlobs,3);
  assert.equal(report.newOverlayGitBlobs,415);
  assert.equal(report.completeTrackedWebsiteRecovered,true);
  assert.equal(report.temporaryCandidateDeleted,true);
  assert.equal(report.reviewedOriginalGitCheckoutUnchanged,true);
  assert.equal(report.sourceLayoutOwnerApproved,false);
  assert.equal(report.realGitCommitObjectCreated,false);
  assert.equal(report.canApply,false);
  assert.equal(report.canPush,false);
  assert.equal(report.canPublish,false);
  assert.equal(report.originalRepositoryFilesWritten,0);
  assert.equal(report.gitHubWrites,0);
  assert.equal(report.sourceValuesPrinted,false);
  assert.ok(!fs.existsSync(sitePath)&&!fs.existsSync(stagePath));
  assert.equal(status(),before);
  assert.equal(sha(fs.readFileSync(file(root,RUNTIME))),SOURCE_SHA);
});
test('invalid review commit and incomplete browser ZIP are refused with no Git changes',async()=>{
  const d=drafts(),bytes=await zip(d.pages,d.resources);
  await assert.rejects(reviewBrowserGitTree(root,bytes,'f'.repeat(40)),
    /Checkout commit changed/);
  const one=await zip(d.pages,null);
  await assert.rejects(reviewBrowserGitTree(root,one,head),
    /Full mixed source package requires page and resource review drafts/);
});
test('Git tree rehearsal cannot push, publish, read tokens or write Git objects',()=>{
  const s=fs.readFileSync(file(root,
    'editor/tools/rehearse-browser-zip-git-tree-intent.cjs'),'utf8');
  for(const forbidden of [
    'fetch(', 'https.request(', 'update_ref(', 'create_commit(',
    'git push','git commit','GITHUB_TOKEN','hash-object -w',
    'writeFileSync(', 'node:https'
  ])assert.equal(s.includes(forbidden),false,forbidden);
  assert.match(s,/proposedTreeIdentityIndependentlyReconstructible:true/);
  assert.match(s,/sourceLayoutOwnerApproved:false/);
  assert.match(s,/realGitCommitObjectCreated:false/);
});
