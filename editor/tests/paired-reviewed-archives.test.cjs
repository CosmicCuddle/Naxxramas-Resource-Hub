'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const crypto=require('node:crypto'),cp=require('node:child_process');
const {PAGES,NAV,runs}=require('../tools/plan-page-draft.cjs');
const {bindAtReview}=require('../tools/bind-editor-drafts.cjs');
const {createPagePackage}=require('../tools/package-reviewed-page-update.cjs');
const {createResourcePreview}=require('../tools/package-reviewed-resource-preview.cjs');
const {encode,decode}=require('../tools/private-source-zip.cjs');
const {MANIFEST:PAGE_MANIFEST,GUIDE:PAGE_GUIDE}=
  require('../tools/package-reviewed-page-update.cjs');
const {MANIFEST:RESOURCE_MANIFEST,README:RESOURCE_GUIDE,
  PREVIEW,reviewPath}=require('../tools/package-reviewed-resource-preview.cjs');
const {verifyPairedArchives,verifySavedPair,parseArgs,privateFile}=
  require('../tools/verify-paired-editor-archives.cjs');

const root=path.resolve(__dirname,'..','..');
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const commit=()=>cp.execFileSync('git',['rev-parse','HEAD'],{
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
  files[0].edits[chosen.id]='Matched private website page content.';
  const navFile=fs.readFileSync(path.join(root,NAV));
  const doc=JSON.parse(navFile.toString('utf8'));
  doc.pages[1].label='Matched Review Rules';
  return {
    pages:{
      format:'naxx-local-draft-v3',
      sourceBranchHint:'feature/multi-file-editor-export-2026-11-05',
      sourceCommitVerified:false,createdAt:'2026-11-05T00:00:00Z',
      files,navigation:{path:NAV,sourceSha256:sha(navFile),document:doc}
    },
    resources:{
      format:'naxx-local-resource-draft-v2',baselineSha256:BASE,
      changes:[{index:0,title:'Matched resource review title'},
        {index:413,content:'Matched resource review content.\n\nNext paragraph.'}]
    }
  };
}
let cached;
async function pair(){
  if(!cached){
    cached=(async()=>{
      const d=drafts();
      const receipt=await bindAtReview(root,d,commit());
      const pages=await createPagePackage(root,d,receipt);
      const resources=await createResourcePreview(root,d,receipt);
      return {d,receipt,pages,resources};
    })();
  }
  return cached;
}
async function temporary(fn){
  const folder=fs.mkdtempSync(path.join(os.tmpdir(),'naxx-matched-editor-archives-'));
  fs.chmodSync(folder,0o700);
  try{return await fn(folder);}
  finally{fs.rmSync(folder,{force:true,recursive:true});}
}
test('same commit-bound draft pair validates both exact ZIPs and all cross-area edit counts',async()=>{
  const p=await pair();
  const report=await verifyPairedArchives(root,p.d,p.receipt,p.pages.bytes,p.resources.bytes);
  assert.equal(report.sameReviewedGitCommit,true);
  assert.equal(report.sameReviewReceipt,true);
  assert.equal(report.reviewReceiptSha256,p.receipt.receiptSha256);
  assert.equal(report.reviewedGitCommit,commit());
  assert.equal(report.exactPageDraft,true);
  assert.equal(report.exactResourceDraft,true);
  assert.equal(report.existingPageChanges,2);
  assert.equal(report.proposedResourceChanges,2);
  assert.equal(report.pageZipSha256,sha(p.pages.bytes));
  assert.equal(report.resourceZipSha256,sha(p.resources.bytes));
  assert.equal(report.generatedPreviewSha256,p.receipt.proposedGeneratedSiteSha256);
  assert.equal(report.compatibilityReconstructedExactly,true);
  assert.equal(report.compatibilityRolledBackExactly,true);
  assert.equal(report.pairCompleteForReview,true);
  assert.equal(report.finalGitHubPackage,false);
  assert.equal(report.sourceTreeCommitted,false);
  assert.equal(report.deployable,false);
  assert.equal(report.ownerApproved,false);
  assert.equal(report.sourceCheckoutModified,false);
  assert.equal(JSON.stringify(report).includes('Matched resource review title'),false);
  assert.equal(JSON.stringify(report).includes('Matched private website page content'),false);
});
test('same HEAD with a different draft, altered review receipt, missing area or missing ZIP fails closed',async()=>{
  const p=await pair();
  const other=structuredClone(p.d);
  other.pages.files[0].edits[
    Object.keys(other.pages.files[0].edits)[0]
  ]='Another review of the same Git commit.';
  await assert.rejects(
    verifyPairedArchives(root,other,p.receipt,p.pages.bytes,p.resources.bytes),
    /no longer matches exact saved drafts/);
  await assert.rejects(
    verifyPairedArchives(root,p.d,{...p.receipt,reviewedGitCommit:'0'.repeat(40)},
      p.pages.bytes,p.resources.bytes),
    /modified after creation/);
  await assert.rejects(
    verifyPairedArchives(root,{pages:p.d.pages},p.receipt,p.pages.bytes,p.resources.bytes),
    /Both exact draft formats/);
  await assert.rejects(
    verifyPairedArchives(root,p.d,p.receipt,Buffer.from('bad'),p.resources.bytes),
    /Missing or oversized/);
});
test('valid ZIP with re-signed CRC but replaced page bytes is refused, not treated as a matching pair',async()=>{
  const p=await pair();
  const allowed=new Set([PAGE_MANIFEST,PAGE_GUIDE,...p.pages.manifest.files.map(x=>x.path)]);
  const entries=decode(p.pages.bytes,allowed).entries;
  const changed=entries.map(entry=>entry.name===p.pages.manifest.files[0].path?
    {...entry,bytes:Buffer.from('CRC-correct but wrong reviewed page')}:entry);
  const repairedZip=encode(changed,allowed);
  assert.equal(decode(repairedZip,allowed).entryCount,allowed.size);
  await assert.rejects(
    verifyPairedArchives(root,p.d,p.receipt,repairedZip,p.resources.bytes),
    /Page archive does not match/);
});
test('private saved files can be verified as a pair without creating a combined archive',async()=>{
  const p=await pair();
  await temporary(async folder=>{
    const names={
      pagesFile:path.join(folder,'pages.json'),
      resourcesFile:path.join(folder,'resources.json'),
      receiptFile:path.join(folder,'review.review.json'),
      pageZipFile:path.join(folder,'changed-pages.zip'),
      resourceZipFile:path.join(folder,'private-resource-preview.zip')
    };
    fs.writeFileSync(names.pagesFile,JSON.stringify(p.d.pages),{mode:0o600});
    fs.writeFileSync(names.resourcesFile,JSON.stringify(p.d.resources),{mode:0o600});
    fs.writeFileSync(names.receiptFile,JSON.stringify(p.receipt),{mode:0o600});
    fs.writeFileSync(names.pageZipFile,p.pages.bytes,{mode:0o600});
    fs.writeFileSync(names.resourceZipFile,p.resources.bytes,{mode:0o600});
    const result=await verifySavedPair(root,names);
    assert.equal(result.pairCompleteForReview,true);
    assert.equal(result.privateFilesUnchanged,true);
    assert.equal(result.finalGitHubPackage,false);
    assert.equal(result.ownerApproved,false);
    assert.deepEqual(new Set(Object.keys(result)).has('archiveContents'),false);
    if(process.platform!=='win32'){
      const alias=path.join(folder,'alias-pages.zip');
      fs.symlinkSync(names.pageZipFile,alias);
      assert.throws(()=>privateFile(root,alias,'archive',75*1024*1024),
        /Unsafe or oversized/);
    }
    fs.writeFileSync(names.receiptFile,'{"format":"forged"}');
    await assert.rejects(verifySavedPair(root,names),/not a permitted commit-bound/);
  });
});
test('command refuses duplicate, missing, non-absolute and checkout-local private archive paths',()=>{
  assert.deepEqual(parseArgs([
    '--receipt','/private/receipt.json','--pages','/private/pages.json',
    '--resources','/private/resources.json','--page-zip','/private/pages.zip',
    '--resource-zip','/private/resources.zip'
  ]),{
    pagesFile:'/private/pages.json',resourcesFile:'/private/resources.json',
    receiptFile:'/private/receipt.json',pageZipFile:'/private/pages.zip',
    resourceZipFile:'/private/resources.zip'
  });
  assert.throws(()=>parseArgs([]),/Provide/);
  assert.throws(()=>parseArgs([
    '--receipt','a','--pages','b','--resources','c','--page-zip','d',
    '--page-zip','e'
  ]),/repeated/);
  assert.throws(()=>privateFile(root,path.join(root,'editor','README.md'),'archive',75*1024*1024),
    /outside the Git repository/);
  assert.throws(()=>privateFile(root,'relative.zip','archive',75*1024*1024),
    /absolute private/);
});
