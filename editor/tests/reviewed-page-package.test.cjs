'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const crypto=require('node:crypto'),cp=require('node:child_process');
const {PAGES,NAV,runs}=require('../tools/plan-page-draft.cjs');
const {bindAtReview}=require('../tools/bind-editor-drafts.cjs');
const {encode,decode}=require('../tools/private-source-zip.cjs');
const {createPagePackage,verifyPagePackage,saveReviewedPagePackage,
  MANIFEST,GUIDE,parseArgs}=require('../tools/package-reviewed-page-update.cjs');
const root=path.resolve(__dirname,'..','..');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const commit=()=>cp.execFileSync('git',['rev-parse','HEAD'],{
  cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']
}).trim();
const baseline='34455f6d901c538e2491a8c16681692e4c02d918b1984d7d0ba081aacb1049e8';
function drafts(withResources=false){
  const files=PAGES.map(relative=>({
    path:relative,sourceSha256:sha(fs.readFileSync(path.join(root,relative))),edits:{}
  }));
  const page=fs.readFileSync(path.join(root,PAGES[2]),'utf8');
  const item=runs(page).find(run=>run.kind==='text');
  assert.ok(item);
  files[2].edits[item.id]='Tested page & navigation changes <must escape>';
  const navFile=fs.readFileSync(path.join(root,NAV));
  const doc=JSON.parse(navFile.toString('utf8'));
  doc.pages[1].label='Reviewed Server Rules';
  const d={
    pages:{
      format:'naxx-local-draft-v3',
      sourceBranchHint:'feature/multi-file-editor-export-2026-11-05',
      sourceCommitVerified:false,createdAt:'2026-11-05T00:00:00Z',
      files,navigation:{path:NAV,sourceSha256:sha(navFile),document:doc}
    }
  };
  if(withResources)d.resources={
    format:'naxx-local-resource-draft-v2',baselineSha256:baseline,
    changes:[{index:0,title:'Excluded unapproved resource change'}]
  };
  return d;
}
function privateFolder(fn){
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'naxx-reviewed-page-zip-test-'));
  fs.chmodSync(tmp,0o700);
  return Promise.resolve().then(()=>fn(tmp))
    .finally(()=>fs.rmSync(tmp,{force:true,recursive:true}));
}
test('receipt-gated existing-file ZIP retains exact paths and excludes all resource source files',async()=>{
  const d=drafts(true),receipt=await bindAtReview(root,d,commit());
  const result=await createPagePackage(root,d,receipt);
  assert.equal(result.report.changedTrackedFiles,2);
  assert.equal(result.report.excludedCandidateResourceChanges,1);
  assert.equal(result.report.completeWebsiteUpdate,false);
  assert.equal(result.report.ownerApproved,false);
  assert.equal(result.report.repositoryModified,false);
  assert.equal(result.report.githubReadyForDeployment,false);
  assert.equal(result.manifest.partialWebsiteUpdate,true);
  assert.equal(result.manifest.generatedSiteContentIncluded,false);
  assert.equal(result.manifest.rootLoaderIncluded,false);
  assert.equal(result.manifest.reviewReceiptSha256,receipt.receiptSha256);
  const expected=new Set(['apply/content.html','content/navigation.json',MANIFEST,GUIDE]);
  const zip=decode(result.bytes,expected);
  assert.deepEqual(new Set(zip.entries.map(e=>e.name)),expected);
  assert.ok(!zip.entries.some(e=>e.name.includes('legacy')||
    e.name==='site-content.html'||e.name==='index.html'));
  const written=zip.entries.find(e=>e.name==='apply/content.html').bytes.toString('utf8');
  assert.match(written,/Tested page &amp; navigation changes &lt;must escape&gt;/);
  const instructions=zip.entries.find(e=>e.name===GUIDE).bytes.toString('utf8');
  assert.match(instructions,/Resource edits are NOT included/);
  assert.match(instructions,/DO NOT COPY THIS ZIP TO A LIVE WEBSITE/);
  assert.match(instructions,/Candidate resource edits excluded: 1/);
  const validation=verifyPagePackage(result.bytes,result.manifest,
    [{path:'apply/content.html',bytes:zip.entries.find(e=>e.name==='apply/content.html').bytes,
      sourceSha256:result.manifest.files.find(x=>x.path==='apply/content.html').originalSha256,
      nextSha256:result.manifest.files.find(x=>x.path==='apply/content.html').proposedSha256},
     {path:NAV,bytes:zip.entries.find(e=>e.name===NAV).bytes,
      sourceSha256:result.manifest.files.find(x=>x.path===NAV).originalSha256,
      nextSha256:result.manifest.files.find(x=>x.path===NAV).proposedSha256}]);
  assert.equal(validation.originalPathsPreserved,true);
  assert.equal(validation.unexpectedFilesAccepted,false);
});
test('page-only receipt exports a complete-for-scope two-file change package',async()=>{
  const d=drafts(),receipt=await bindAtReview(root,d,commit());
  const result=await createPagePackage(root,d,receipt);
  assert.equal(result.manifest.partialWebsiteUpdate,false);
  assert.equal(result.manifest.excludedCandidateResourceChanges,0);
  assert.equal(result.manifest.resourceDraftSha256,null);
  assert.equal(result.manifest.files.length,2);
  assert.equal(result.manifest.ownerApproved,false);
  assert.equal(result.manifest.githubReadyForDeployment,false);
});
test('modified page draft, stale commit or missing resource draft invalidates the binding',async()=>{
  const d=drafts(true),receipt=await bindAtReview(root,d,commit());
  const altered=structuredClone(d);
  altered.pages.navigation.document.pages[1].label='Another plausible label';
  await assert.rejects(createPagePackage(root,altered,receipt),/no longer matches exact saved drafts/);
  await assert.rejects(createPagePackage(root,{pages:d.pages},receipt),/no longer matches exact saved drafts/);
  const wrong={...receipt,reviewedGitCommit:'0'.repeat(40)};
  await assert.rejects(createPagePackage(root,d,wrong),/modified after creation/);
  await assert.rejects(createPagePackage(root,{resources:d.resources},receipt),/page\/navigation draft/);
});
test('ZIP manifest, changed payload and safety guide cannot be silently altered',async()=>{
  const d=drafts(),receipt=await bindAtReview(root,d,commit());
  const result=await createPagePackage(root,d,receipt);
  const allow=new Set([MANIFEST,GUIDE,...result.manifest.files.map(x=>x.path)]);
  const files=decode(result.bytes,allow).entries;
  const corrupt=files.map(item=>item.name==='apply/content.html'?
    {...item,bytes:Buffer.from('Tampered')}:item);
  const tamperedZip=encode(corrupt,allow);
  assert.throws(()=>verifyPagePackage(tamperedZip,result.manifest,
    result.manifest.files.map(f=>({
      path:f.path,bytes:files.find(x=>x.name===f.path).bytes,
      sourceSha256:f.originalSha256,nextSha256:f.proposedSha256
    }))),/exact planned bytes/);
  const corruptedGuide=encode(files.map(item=>item.name===GUIDE?
    {...item,bytes:Buffer.from('unsafe instructions')}:item),allow);
  assert.throws(()=>verifyPagePackage(corruptedGuide,result.manifest,
    result.manifest.files.map(f=>({
      path:f.path,bytes:files.find(x=>x.name===f.path).bytes,
      sourceSha256:f.originalSha256,nextSha256:f.proposedSha256
    }))),/safety instructions changed/);
  assert.throws(()=>encode([...files,{name:'index.html',bytes:Buffer.from('bad')}],
    new Set([...allow,'index.html'])),/Unsafe|unsafe|ZIP/);
});
test('explicit private local save produces verifiable ZIP and refuses overwrite or repo path',async()=>{
  await privateFolder(async tmp=>{
    const d=drafts(),receipt=await bindAtReview(root,d,commit());
    const page=path.join(tmp,'pages.json'),proof=path.join(tmp,'review.review.json');
    const output=path.join(tmp,'tracked-pages.zip');
    fs.writeFileSync(page,JSON.stringify(d.pages),{mode:0o600});
    fs.writeFileSync(proof,JSON.stringify(receipt),{mode:0o600});
    const saved=await saveReviewedPagePackage(root,{
      pagesFile:page,receiptFile:proof,output
    });
    assert.equal(saved.savedOutsideRepository,true);
    assert.equal(saved.changedTrackedFiles,2);
    assert.equal(saved.deployable,false);
    const archive=fs.readFileSync(output);
    assert.equal(sha(archive),saved.archiveSha256);
    assert.equal(decode(archive,new Set([MANIFEST,GUIDE,NAV,'apply/content.html'])).entryCount,4);
    if(process.platform!=='win32')assert.equal(fs.statSync(output).mode&0o077,0);
    await assert.rejects(saveReviewedPagePackage(root,{pagesFile:page,receiptFile:proof,output}),
      /already exists/);
    await assert.rejects(saveReviewedPagePackage(root,{pagesFile:page,receiptFile:proof,
      output:path.join(root,'editor','unsafe.zip')}),/outside the repository/);
    const old=drafts();
    old.pages.files[2].sourceSha256='0'.repeat(64);
    const bad=path.join(tmp,'bad-draft.json');
    fs.writeFileSync(bad,JSON.stringify(old.pages));
    await assert.rejects(saveReviewedPagePackage(root,{pagesFile:bad,receiptFile:proof,
      output:path.join(tmp,'should-not-exist.zip')}),/source hash mismatch/);
    assert.equal(fs.existsSync(path.join(tmp,'should-not-exist.zip')),false);
  });
});
test('CLI needs both a private source draft and exact review receipt',()=>{
  assert.deepEqual(parseArgs([
    '--output','/tmp/patch.zip','--pages','/tmp/draft.json','--receipt','/tmp/receipt.json'
  ]),{
    pagesFile:'/tmp/draft.json',receiptFile:'/tmp/receipt.json',
    resourcesFile:null,output:'/tmp/patch.zip'
  });
  assert.throws(()=>parseArgs([]),/Provide/);
  assert.throws(()=>parseArgs(['--pages','draft.json']),/required/);
  assert.throws(()=>parseArgs([
    '--pages','draft','--receipt','receipt','--output','out','--output','out'
  ]),/duplicate/);
});
