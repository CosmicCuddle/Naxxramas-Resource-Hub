'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const vm=require('node:vm'),crypto=require('node:crypto'),
  cp=require('node:child_process');
const {
  FORMAT,checkPaths,compareBrowserZipLayouts
}=require('../tools/review-browser-zip-layout-choices.cjs');
const {SOURCE_SHA}=require('../tools/audit-source-storage-budget.cjs');
const {PAGES,NAV,runs}=require('../tools/plan-page-draft.cjs');
const {recordPath,MANIFEST}=require('../tools/rehearse-resource-only-overlay.cjs');
const {RUNTIME}=require('../tools/plan-private-github-source-review.cjs');
const root=path.resolve(__dirname,'..','..');
const head=cp.execFileSync('git',['rev-parse','HEAD'],{
  cwd:root,encoding:'utf8'}).trim();
const digest=value=>crypto.createHash('sha256').update(value).digest('hex');
function sample(){
  const filename=PAGES[0],input=fs.readFileSync(path.join(root,filename),'utf8');
  const token=runs(input).find(x=>x.kind==='text');
  if(!token)throw Error('Missing test page text token.');
  return {
    page:{
      format:'naxx-local-draft-v3',
      sourceBranchHint:'feature/multi-file-editor-export-2026-11-05',
      sourceCommitVerified:false,createdAt:'2026-11-06T08:00:00.000Z',
      files:PAGES.map(name=>({
        path:name,sourceSha256:digest(fs.readFileSync(path.join(root,name))),
        edits:name===filename?{[token.id]:'Private dual-layout ZIP page text'}:{}
      })),
      navigation:{
        path:NAV,sourceSha256:digest(fs.readFileSync(path.join(root,NAV))),
        document:JSON.parse(fs.readFileSync(path.join(root,NAV),'utf8'))
      }
    },
    resource:{
      format:'naxx-local-resource-draft-v2',baselineSha256:SOURCE_SHA,
      changes:[{index:0,title:'Private dual-layout ZIP example'},
        {index:413,content:'Private dual-layout paragraph.\n\nSecond paragraph.'}]
    }
  };
}
async function archive(page,resource){
  const box={TextEncoder,Blob,Uint8Array,Uint32Array,DataView,
    crypto:crypto.webcrypto,document:{getElementById(){return null;}}};
  for(const filename of ['export-zip.js','review-package.js']){
    const src=fs.readFileSync(path.join(root,'editor',filename),'utf8');
    vm.runInNewContext(src,box,{filename,timeout:5000});
  }
  const zip=await box.NaxxEditorReview.build(page,resource,box.NaxxEditorZip);
  return Buffer.from(await zip.blob.arrayBuffer());
}
test('same actual saved combined editor ZIP agrees on 418 and 415 layouts',async()=>{
  const d=sample();
  const zip=await archive(d.page,d.resource);
  const before=cp.execFileSync('git',['status','--porcelain=v1',
    '--untracked-files=all'],{cwd:root,encoding:'utf8'}).trim();
  const result=await compareBrowserZipLayouts(root,zip,head);
  assert.equal(result.format,FORMAT);
  assert.equal(result.reviewedGitCommit,head);
  assert.equal(result.reviewZipSha256,digest(zip));
  assert.equal(result.originalWebsiteSha256,SOURCE_SHA);
  assert.notEqual(result.generatedWebsiteSha256,SOURCE_SHA);
  assert.equal(result.existingPageAndNavigationChanges,1);
  assert.equal(result.editedResourceCount,2);
  assert.equal(result.proposedChangedFileCount,5);
  assert.equal(result.fullSourceTreeCandidateFiles,418);
  assert.equal(result.versionedResourceOnlyCandidateFiles,415);
  assert.equal(result.sourceTreeDifferenceFiles,3);
  for(const k of [
    'generatedCompatibilityMatches','pathInventoriesConsistent',
    'original414ResourcesVerified','localGitCheckoutVerifiedBeforeAndAfter',
    'candidate418UsedInPrivateRehearsal','candidate415UsedInPrivateRehearsal'
  ])assert.equal(result[k],true,k);
  for(const k of [
    'eitherCanonicalLayoutApproved','ownerApproved','userSourceEdited',
    'liveGitHubSourceUpdated','originalWebsiteModified',
    'realAdminSaveOrRestoreVerified','completeIndependentBackupVerified',
    'canApply','canPush','canMerge','canPublish'
  ])assert.equal(result[k],false,k);
  assert.equal(result.githubWrites,0);
  assert.equal(result.repositoryFilesWritten,0);
  assert.equal(Object.isFrozen(result),true);
  const shown=JSON.stringify(result);
  assert.ok(!shown.includes('Private dual-layout ZIP'));
  assert.ok(!shown.includes('Second paragraph'));
  assert.equal(cp.execFileSync('git',['status','--porcelain=v1',
    '--untracked-files=all'],{cwd:root,encoding:'utf8'}).trim(),before);
});
test('one-sided review ZIP cannot claim to resolve the dual-layout choice',async()=>{
  const d=sample();
  const zip=await archive(d.page,null);
  await assert.rejects(compareBrowserZipLayouts(root,zip,head),
    /Both page and resource drafts are needed/);
});
test('changed source SHA and tampered ZIP are rejected before candidate comparison',async()=>{
  const d=sample();
  const clean=await archive(d.page,d.resource);
  const corrupted=Buffer.from(clean);
  const i=corrupted.indexOf(Buffer.from('Private dual-layout ZIP page text'));
  assert.ok(i>0);corrupted[i]^=1;
  await assert.rejects(compareBrowserZipLayouts(root,corrupted,head),
    /incomplete|unsafe|corrupted/i);
  await assert.rejects(compareBrowserZipLayouts(root,clean,'0'.repeat(40)),
    /Checkout commit changed/);
});
test('independent layout path reconciliation refuses a resource byte mismatch',()=>{
  const old='a'.repeat(64),next='b'.repeat(64),runtime='c'.repeat(64);
  const source={
    existingPageAndNavigationChanges:1,proposedResourceChanges:1,
    proposedCompatibilitySha256:runtime,
    proposedPaths:[
      {path:PAGES[0],oldSha256:old,newSha256:next,trackedInGit:true},
      {path:'content/legacy/resources/0001.fragment',oldSha256:old,
        newSha256:next,trackedInGit:false}
    ]
  };
  const comparison={
    unifiedProposedFileCount:4,
    proposedFiles:[
      {path:PAGES[0],domain:'existing-page-or-navigation',
        oldSha256:old,newSha256:next},
      {path:recordPath(0),domain:'candidate-resource',
        oldSha256:old,newSha256:next},
      {path:MANIFEST,domain:'candidate-manifest',
        oldSha256:old,newSha256:next},
      {path:RUNTIME,domain:'generated-runtime',
        oldSha256:old,newSha256:runtime}
    ]
  };
  assert.equal(checkPaths(source,comparison).matchingResourceChanges,1);
  comparison.proposedFiles[1].newSha256='f'.repeat(64);
  assert.throws(()=>checkPaths(source,comparison),
    /Resource field bytes changed/);
  comparison.proposedFiles[1].newSha256=next;
  comparison.proposedFiles[0].newSha256='f'.repeat(64);
  assert.throws(()=>checkPaths(source,comparison),
    /Page or navigation changed/);
  comparison.proposedFiles[0].newSha256=next;
  comparison.proposedFiles[3].newSha256='f'.repeat(64);
  assert.throws(()=>checkPaths(source,comparison),
    /reconstructed website/);
});
test('dual-layout comparison never calls a GitHub writer or changes the installed site',()=>{
  const src=fs.readFileSync(path.resolve(__dirname,'..','tools',
    'review-browser-zip-layout-choices.cjs'),'utf8');
  for(const needle of ['fetch(', 'https.request(', 'update_ref(',
    'create_commit(', 'fs.writeFileSync(', 'fs.rmSync(', 'GITHUB_TOKEN',
    'git push','git commit'])
    assert.equal(src.includes(needle),false,needle);
  assert.match(src,/eitherCanonicalLayoutApproved:false/);
  assert.match(src,/repositoryFilesWritten:0,githubWrites:0/);
});
