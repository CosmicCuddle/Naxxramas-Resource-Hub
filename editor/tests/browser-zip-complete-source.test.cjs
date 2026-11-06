'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),
  cp=require('node:child_process'),vm=require('node:vm');
const root=path.resolve(__dirname,'..','..'),editor=path.join(root,'editor');
const {PAGES,NAV,runs}=require('../tools/plan-page-draft.cjs');
const {SOURCE_SHA}=require('../tools/audit-source-storage-budget.cjs');
const {filePaths,recordPath,MANIFEST}=require('../tools/rehearse-resource-only-overlay.cjs');
const {RUNTIME}=require('../tools/plan-private-github-source-review.cjs');
const {FORMAT,verifyCompletePackage,withCompletePrivateCandidate,demonstrate}=
  require('../tools/rehearse-browser-zip-complete-source.cjs');
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const head=cp.execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
const status=()=>cp.execFileSync('git',['status','--porcelain=v1',
  '--untracked-files=all'],{cwd:root,encoding:'utf8'}).trim();
function drafts(){
  const first=fs.readFileSync(path.join(root,PAGES[0]),'utf8');
  const anchor=runs(first).find(r=>r.kind==='text');
  if(!anchor)throw Error('Cannot locate original page title token.');
  const navBytes=fs.readFileSync(path.join(root,NAV));
  const nav=JSON.parse(navBytes.toString('utf8'));
  nav.pages[0].label='Offline authoring review';
  return {
    page:{format:'naxx-local-draft-v3',
      sourceBranchHint:'feature/multi-file-editor-export-2026-11-05',
      sourceCommitVerified:false,createdAt:'2026-11-06T20:00:00.000Z',
      files:PAGES.map(name=>({
        path:name,sourceSha256:sha(fs.readFileSync(path.join(root,name))),
        edits:name===PAGES[0]?{[anchor.id]:'Sample private staged page text'}:{}
      })),
      navigation:{path:NAV,sourceSha256:sha(navBytes),document:nav}
    },
    resource:{format:'naxx-local-resource-draft-v2',
      baselineSha256:SOURCE_SHA,changes:[
        {index:0,title:'Private complete physical source title'},
        {index:413,content:'Staged content paragraph.\n\nSecond paragraph.'}
      ]}
  };
}
async function archive(page,resource){
  const box={TextEncoder,Blob,Uint8Array,Uint32Array,DataView,
    crypto:crypto.webcrypto,document:{getElementById(){return null;}}};
  for(const file of ['export-zip.js','review-package.js'])
    vm.runInNewContext(fs.readFileSync(path.join(editor,file),'utf8'),box,
      {filename:file,timeout:5000});
  const result=await box.NaxxEditorReview.build(page,resource,box.NaxxEditorZip);
  return Buffer.from(await result.blob.arrayBuffer());
}
function file(root,relative){return path.join(root,...relative.split('/'));}
test('real browser ZIP yields complete staged 415-source migration and rebuilt HTML only in disposable storage',async()=>{
  const d=drafts(),zip=await archive(d.page,d.resource);
  const initial=status(),original=fs.readFileSync(path.join(root,RUNTIME));
  let stagePath,overlayPath;
  const report=await withCompletePrivateCandidate(root,zip,head,
    ({stage,overlay,original,proposedPages,resourceReceipt,evidence})=>{
      stagePath=stage;overlayPath=overlay;
      assert.equal(evidence.completeResourceSourceFiles,415);
      assert.equal(evidence.resourceFragmentsVerified,414);
      assert.equal(evidence.editedPageNavigationFilesVerified,2);
      assert.equal(evidence.stagedPathCount,418);
      assert.equal(evidence.initialSourceMigrationComplete,true);
      assert.equal(resourceReceipt.editedResourceCount,2);
      for(const path of filePaths()){
        assert.ok(fs.readFileSync(file(stage,path)).equals(
          fs.readFileSync(file(overlay,path))),path);
      }
      assert.ok(fs.readFileSync(file(stage,RUNTIME)).length>30000000);
      assert.equal(sha(fs.readFileSync(file(stage,RUNTIME))),
        resourceReceipt.proposedFullSiteSha256);
      assert.equal(sha(fs.readFileSync(file(stage,recordPath(205)))),
        sha(fs.readFileSync(file(overlay,recordPath(205)))));
      assert.equal(sha(fs.readFileSync(path.join(root,RUNTIME))),SOURCE_SHA);
      const again=verifyCompletePackage(stage,overlay,original,
        proposedPages,resourceReceipt);
      assert.equal(again.stagedPathCount,418);
      return {reviewed:again.generatedRuntimeSha256};
    });
  assert.equal(report.sourceCheckoutUnchanged,true);
  assert.equal(report.temporaryPackageDeleted,true);
  assert.ok(!fs.existsSync(stagePath));
  assert.ok(!fs.existsSync(overlayPath));
  assert.equal(status(),initial);
  assert.ok(fs.readFileSync(path.join(root,RUNTIME)).equals(original));
  assert.notEqual(report.reviewed,SOURCE_SHA);
});
test('tampering with any staged runtime, resource, page or extra file is rejected and temp cleaned',async()=>{
  const d=drafts(),zip=await archive(d.page,d.resource);
  let stagePath;
  const result=await withCompletePrivateCandidate(root,zip,head,
    ({stage,overlay,original,proposedPages,resourceReceipt})=>{
      stagePath=stage;
      function mutate(relative,bytes,error){
        const target=file(stage,relative),saved=fs.readFileSync(target);
        try{
          fs.writeFileSync(target,bytes);
          assert.throws(()=>verifyCompletePackage(stage,overlay,original,
            proposedPages,resourceReceipt),error);
        }finally{fs.writeFileSync(target,saved);}
      }
      mutate(RUNTIME,Buffer.from('Broken private candidate runtime'),
        /Candidate runtime/);
      mutate(recordPath(36),Buffer.from('Wrong resource source fragment'),
        /Packaged overlay source/);
      mutate(PAGES[0],Buffer.from('Incorrect page content'),
        /Packaged page/);
      mutate(MANIFEST,Buffer.from('{"format":"forged"}'),
        /Packaged overlay source/);
      const extra=path.join(stage,'unreviewed-source.txt');
      fs.writeFileSync(extra,'not part of reviewed candidate');
      try{assert.throws(()=>verifyCompletePackage(stage,overlay,original,
        proposedPages,resourceReceipt),/missing or extra/);}
      finally{fs.rmSync(extra);}
      const valid=verifyCompletePackage(stage,overlay,original,
        proposedPages,resourceReceipt);
      assert.equal(valid.stagedPathCount,418);
      return {recovered:true};
    });
  assert.equal(result.recovered,true);
  assert.equal(result.temporaryPackageDeleted,true);
  assert.ok(!fs.existsSync(stagePath));
});
test('source layout is unapproved and full package cannot be assembled from page-only or stale ZIP',async()=>{
  const d=drafts(),zip=await archive(d.page,d.resource);
  await assert.rejects(
    withCompletePrivateCandidate(root,zip,'f'.repeat(40),()=>{}),
    /Checkout commit changed/);
  const one=await archive(d.page,null);
  await assert.rejects(
    withCompletePrivateCandidate(root,one,head,()=>{}),
    /Full mixed source package requires page and resource review drafts/);
  const result=await demonstrate(root,zip,head);
  assert.equal(result.format,FORMAT);
  assert.equal(result.sourceFilesStaged,415);
  assert.equal(result.editedExistingFiles,2);
  assert.equal(result.totalCandidatePaths,418);
  assert.equal(result.originalWebsiteResourceCount,414);
  assert.equal(result.completeCompatibilityHashVerified,true);
  assert.equal(result.initialUnchangedResourceFragmentsIncluded,true);
  assert.equal(result.sourceLayoutChosen,false);
  assert.equal(result.sourceMigrationApproved,false);
  assert.equal(result.realGitHubWriter,false);
  assert.equal(result.fullRepositoryBackup,false);
  assert.equal(result.canApply,false);
  assert.equal(result.canPush,false);
  assert.equal(result.canMerge,false);
  assert.equal(result.canPublish,false);
  assert.equal(result.repositoryFilesWritten,0);
  assert.equal(result.gitHubWrites,0);
  assert.equal(result.sourceCheckoutUnchanged,true);
  assert.equal(result.temporaryPackageDeleted,true);
});
test('complete source staging has no GitHub writer, editable repository path or publish command',()=>{
  const src=fs.readFileSync(path.resolve(__dirname,'..','tools',
    'rehearse-browser-zip-complete-source.cjs'),'utf8');
  for(const forbidden of ['https.request(', 'fetch(', 'create_commit(',
    'update_ref(', 'git push','git commit','GITHUB_TOKEN','process.env.'])
    assert.equal(src.includes(forbidden),false,forbidden);
  assert.match(src,/fs\.mkdtempSync\(path\.join\(os\.tmpdir\(\)/);
  assert.match(src,/initialSourceMigrationComplete:true/);
  assert.match(src,/sourceLayoutChosen:false,sourceMigrationApproved:false/);
});
