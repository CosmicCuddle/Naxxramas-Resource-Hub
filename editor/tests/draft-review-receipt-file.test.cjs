'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const crypto=require('node:crypto'),cp=require('node:child_process');
const {saveReceipt,destination,parseArgs,sourceDraft}=
  require('../tools/create-draft-review-receipt.cjs');
const {verifyReviewBinding}=require('../tools/bind-editor-drafts.cjs');
const {PAGES,NAV,runs}=require('../tools/plan-page-draft.cjs');
const root=path.resolve(__dirname,'..','..');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const commit=()=>cp.execFileSync('git',['rev-parse','HEAD'],{
  cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']
}).trim();
function fixture(fn){
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'naxx-private-draft-review-receipt-'));
  fs.chmodSync(tmp,0o700);
  const page=path.join(tmp,'page-draft.json'),output=path.join(tmp,'bound-draft.review.json');
  const files=PAGES.map(relative=>({
    path:relative,sourceSha256:hash(fs.readFileSync(path.join(root,relative))),edits:{}
  }));
  const text=runs(fs.readFileSync(path.join(root,PAGES[0]),'utf8'))
    .find(x=>x.kind==='text');
  files[0].edits[text.id]='Copied, reviewed page wording.';
  const originalNav=fs.readFileSync(path.join(root,NAV));
  const doc=JSON.parse(originalNav.toString('utf8'));
  const draft={
    format:'naxx-local-draft-v3',
    sourceBranchHint:'feature/multi-file-editor-export-2026-11-05',
    sourceCommitVerified:false,createdAt:'2026-11-05T00:00:00Z',
    files,navigation:{path:NAV,sourceSha256:hash(originalNav),document:doc}
  };
  fs.writeFileSync(page,JSON.stringify(draft,null,2)+'\n',{mode:0o600});
  return Promise.resolve().then(()=>fn({tmp,page,output,draft}))
    .finally(()=>fs.rmSync(tmp,{recursive:true,force:true}));
}
test('explicitly saves verified review receipt outside repository and can reverify it',async()=>{
  await fixture(async({page,output,draft})=>{
    const report=await saveReceipt(root,{commit:commit(),pagesFile:page,output});
    assert.equal(report.privateReceiptWritten,true);
    assert.equal(report.draftAuthoringCommitProven,false);
    assert.equal(report.githubReady,false);
    assert.equal(report.repositoryFilesChanged,false);
    assert.equal(report.changedExistingPageCount,1);
    assert.equal(report.changedProposedResourceCount,0);
    const receipt=JSON.parse(fs.readFileSync(output,'utf8'));
    assert.equal(receipt.reviewedGitCommit,commit());
    assert.equal(receipt.authoredAtThisCommitProven,false);
    assert.equal(receipt.sourceFiles.length,6);
    assert.equal(receipt.pageDraftSha256!==null,true);
    assert.equal(receipt.resourceDraftSha256,null);
    assert.equal(receipt.githubReady,false);
    const confirmation=await verifyReviewBinding(root,{pages:draft},receipt);
    assert.equal(confirmation.checkoutMatchesRequestedCommit,true);
    assert.equal(confirmation.pageDraftMatchesReceipt,true);
    if(process.platform!=='win32')assert.equal(fs.statSync(output).mode&0o077,0);
    await assert.rejects(saveReceipt(root,{commit:commit(),pagesFile:page,output}),
      /already exists/);
    assert.equal(fs.readFileSync(output,'utf8'),JSON.stringify(receipt,null,2)+'\n');
  });
});
test('no output on wrong Git commit, stale draft file, unapproved output path',async()=>{
  await fixture(async({tmp,page,output})=>{
    await assert.rejects(saveReceipt(root,{commit:'0'.repeat(40),pagesFile:page,output}),
      /Checkout commit changed/);
    assert.equal(fs.existsSync(output),false);
    const draft=JSON.parse(fs.readFileSync(page,'utf8'));
    draft.files[0].sourceSha256='0'.repeat(64);
    fs.writeFileSync(page,JSON.stringify(draft));
    await assert.rejects(saveReceipt(root,{commit:commit(),pagesFile:page,output}),
      /Page source hash mismatch/);
    assert.equal(fs.existsSync(output),false);
    assert.throws(()=>destination(path.join(root,'editor','nope.review.json'),root),
      /outside the Git repository/);
    assert.throws(()=>destination('relative.review.json',root),/absolute private/);
    const dest=path.join(tmp,'occupied.review.json');
    fs.writeFileSync(dest,'Do not overwrite.');
    assert.throws(()=>destination(dest,root),/already exists/);
  });
});
test('safe argument parsing requires exact explicit commit, files, and output',()=>{
  assert.deepEqual(parseArgs([
    '--output','/private/folder/copy.review.json','--commit','a'.repeat(40),
    '--pages','/private/page.json'
  ]),{
    commit:'a'.repeat(40),output:'/private/folder/copy.review.json',
    pagesFile:'/private/page.json',resourcesFile:null
  });
  assert.throws(()=>parseArgs([]),/Required/);
  assert.throws(()=>parseArgs(['--commit','a'.repeat(40)]),/at least one draft|Specify reviewed/);
  assert.throws(()=>parseArgs(['--commit','x','--commit','x',
    '--pages','foo','--output','out']),/duplicate/);
});
test('symlinked draft file and symlinked output directory pointing into repository are refused',async()=>{
  await fixture(async({tmp,page})=>{
    const linked=path.join(tmp,'linked.json');
    fs.symlinkSync(page,linked);
    assert.throws(()=>sourceDraft(linked),/safe, nonempty regular/);
    if(process.platform!=='win32'){
      const alias=path.join(tmp,'repo-alias');
      fs.symlinkSync(root,alias,'dir');
      assert.throws(()=>destination(path.join(alias,'sneaky.review.json'),root),
        /outside the Git repository/);
    }
  });
});
