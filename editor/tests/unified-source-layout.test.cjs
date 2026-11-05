'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const crypto=require('node:crypto'),cp=require('node:child_process');
const {PAGES,NAV,runs}=require('../tools/plan-page-draft.cjs');
const {bindAtReview}=require('../tools/bind-editor-drafts.cjs');
const {createPagePackage,MANIFEST:PAGE_MANIFEST,GUIDE:PAGE_GUIDE}=
  require('../tools/package-reviewed-page-update.cjs');
const {createResourcePreview}=require('../tools/package-reviewed-resource-preview.cjs');
const {encode,decode}=require('../tools/private-source-zip.cjs');
const {TRACKED,SPARSE_COUNT,assertCandidateTreeUnadopted,verifyAssembled,rehearseUnified}=
  require('../tools/rehearse-unified-source-layout.cjs');
const root=path.resolve(__dirname,'..','..');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const gitHead=()=>cp.execFileSync('git',['rev-parse','HEAD'],{
  cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']
}).trim();
const BASE='34455f6d901c538e2491a8c16681692e4c02d918b1984d7d0ba081aacb1049e8';
function drafts(){
  const files=PAGES.map(relative=>({
    path:relative,sourceSha256:sha(fs.readFileSync(path.join(root,relative))),edits:{}
  }));
  const chosen=runs(fs.readFileSync(path.join(root,PAGES[0]),'utf8'))
    .find(item=>item.kind==='text');
  assert.ok(chosen);
  files[0].edits[chosen.id]='Private unified preview changed text.';
  const navFile=fs.readFileSync(path.join(root,NAV));
  const doc=JSON.parse(navFile.toString('utf8'));
  doc.pages[1].label='Unified Preview Server Rules';
  return {
    pages:{format:'naxx-local-draft-v3',
      sourceBranchHint:'feature/multi-file-editor-export-2026-11-05',
      sourceCommitVerified:false,createdAt:'2026-11-05T00:00:00Z',
      files,navigation:{path:NAV,sourceSha256:sha(navFile),document:doc}},
    resources:{format:'naxx-local-resource-draft-v2',baselineSha256:BASE,
      changes:[{index:0,title:'Unified preview resource test'},
        {index:413,content:'Unified preview multiline content.\n\nAnother line.'}]}
  };
}
let cached=null;
async function inputs(){
  if(!cached)cached=(async()=>{
    const d=drafts();
    const receipt=await bindAtReview(root,d,gitHead());
    const pages=await createPagePackage(root,d,receipt);
    const resources=await createResourcePreview(root,d,receipt);
    return {d,receipt,pages,resources};
  })();
  return cached;
}
test('verified paired ZIP entries stage to proposed 425-file sparse repository layout with exact rebuild and original rollback',async()=>{
  const x=await inputs();
  const report=await rehearseUnified(root,x.d,x.receipt,x.pages.bytes,x.resources.bytes);
  assert.equal(report.format,'naxx-unified-sparse-source-rehearsal-v1');
  assert.equal(report.reviewedGitCommit,gitHead());
  assert.equal(report.stagedFileCount,425);
  assert.equal(report.stagedFileCount,SPARSE_COUNT);
  assert.equal(report.sourceTreeFiles,418);
  assert.equal(report.existingTrackedFiles,7);
  assert.equal(TRACKED.length,7);
  assert.equal(report.changedPages,2);
  assert.equal(report.changedResourceFragments,2);
  assert.equal(report.generatedCompatibilitySha256,
    x.receipt.proposedGeneratedSiteSha256);
  assert.equal(report.exactCompatibilityRebuild,true);
  assert.equal(report.allResourceBytesVerified,true);
  assert.equal(report.customSourceLayoutUnchanged,true);
  assert.equal(report.rootLoaderUnchanged,true);
  assert.equal(report.allEditedPagesVerified,true);
  assert.equal(report.rollbackExact,true);
  assert.equal(report.originalSiteRestored,true);
  assert.equal(report.candidateTreeRemoved,true);
  assert.equal(report.temporaryFilesDeleted,true);
  assert.equal(report.realGitCheckoutUnchanged,true);
  assert.equal(report.browserReadyFullSite,false);
  assert.equal(report.completeRepositoryBackup,false);
  assert.equal(report.adoptedSourceTree,false);
  assert.equal(report.githubReady,false);
  assert.equal(report.deployable,false);
  assert.equal(report.ownerApproved,false);
  assert.equal(report.repositoryFilesWritten,0);
  assert.ok(!JSON.stringify(report).includes('Unified preview resource test'));
  assert.ok(!JSON.stringify(report).includes('Unified Preview Server Rules'));
});
test('forged canonical ZIP bytes or altered review commit fail before a candidate integration is accepted',async()=>{
  const x=await inputs();
  const expected=new Set([
    PAGE_MANIFEST,PAGE_GUIDE,...x.pages.manifest.files.map(item=>item.path)
  ]);
  const all=decode(x.pages.bytes,expected).entries;
  const modified=encode(all.map(entry=>entry.name===x.pages.manifest.files[0].path?
    {...entry,bytes:Buffer.from('wrong reviewed page content')}:entry),expected);
  assert.equal(decode(modified,expected).entryCount,expected.size);
  await assert.rejects(
    rehearseUnified(root,x.d,x.receipt,modified,x.resources.bytes),
    /Page archive does not match/);
  await assert.rejects(
    rehearseUnified(root,x.d,{...x.receipt,reviewedGitCommit:'0'.repeat(40)},
      x.pages.bytes,x.resources.bytes),
    /modified after creation/);
  await assert.rejects(
    rehearseUnified('relative-path',x.d,x.receipt,x.pages.bytes,x.resources.bytes),
    /absolute local Git checkout/);
});
test('sparse workspace verification refuses missing and unexpected files',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'naxx-sparse-malformed-test-'));
  try{
    assert.throws(()=>verifyAssembled(dir,{root},null,null,Buffer.alloc(0)),
      /missing, extra or unapproved/);
    fs.writeFileSync(path.join(dir,'unexpected.html'),'do not deploy');
    assert.throws(()=>verifyAssembled(dir,{root},null,null,Buffer.alloc(0)),
      /missing, extra or unapproved/);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('candidate-only migration guard refuses a previously adopted resource folder',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'naxx-source-migration-guard-'));
  try{
    assert.equal(assertCandidateTreeUnadopted(dir),true);
    fs.mkdirSync(path.join(dir,'content','legacy'),{recursive:true});
    assert.throws(()=>assertCandidateTreeUnadopted(dir),
      /proposed resource source-tree path already exists/);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
