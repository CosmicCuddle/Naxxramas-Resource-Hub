'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const cp=require('node:child_process'),crypto=require('node:crypto');
const {bindAtReview}=require('../tools/bind-editor-drafts.cjs');
const {PAGES,NAV,runs}=require('../tools/plan-page-draft.cjs');
const {planChangeSet}=require('../tools/rehearse-resource-change-set.cjs');
const {encode,decode}=require('../tools/private-source-zip.cjs');
const {FORMAT,ROOT,PREVIEW,MANIFEST,README,reviewPath,
  createResourcePreview,verifyResourcePreview,saveResourcePreview,parseArgs}=
    require('../tools/package-reviewed-resource-preview.cjs');
const checkout=path.resolve(__dirname,'..','..');
const source=fs.readFileSync(path.join(checkout,'site-content.html'));
const baseline='34455f6d901c538e2491a8c16681692e4c02d918b1984d7d0ba081aacb1049e8';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const commit=()=>cp.execFileSync('git',['rev-parse','HEAD'],{
  cwd:checkout,encoding:'utf8',stdio:['ignore','pipe','pipe']
}).trim();
function drafts(mixed=false){
  const resources={
    format:'naxx-local-resource-draft-v2',baselineSha256:baseline,
    changes:[
      {index:0,title:'Private preview title',content:'Line one\n\nLine three.'},
      {index:413,content:'Private preview final resource content.'}
    ]
  };
  if(!mixed)return {resources};
  const files=PAGES.map(relative=>({
    path:relative,sourceSha256:sha(fs.readFileSync(path.join(checkout,relative))),edits:{}
  }));
  const chosen=runs(fs.readFileSync(path.join(checkout,PAGES[0]),'utf8'))
    .find(run=>run.kind==='text');
  assert.ok(chosen);
  files[0].edits[chosen.id]='Preview excludes this existing page edit.';
  const nav=fs.readFileSync(path.join(checkout,NAV));
  return {resources,pages:{
    format:'naxx-local-draft-v3',
    sourceBranchHint:'feature/multi-file-editor-export-2026-11-05',
    sourceCommitVerified:false,createdAt:'2026-11-05T00:00:00Z',
    files,navigation:{path:NAV,sourceSha256:sha(nav),
      document:JSON.parse(nav.toString('utf8'))}
  }};
}
function temp(fn){
  const folder=fs.mkdtempSync(path.join(os.tmpdir(),'naxx-preview-resource-private-'));
  fs.chmodSync(folder,0o700);
  return Promise.resolve().then(()=>fn(folder))
    .finally(()=>fs.rmSync(folder,{recursive:true,force:true}));
}
test('reviewed resource archive contains only changed candidate fragment names plus exact complete compatibility preview',async()=>{
  const d=drafts(true),receipt=await bindAtReview(checkout,d,commit());
  const result=await createResourcePreview(checkout,d,receipt);
  assert.equal(result.manifest.format,FORMAT);
  assert.equal(result.manifest.reviewedGitCommit,commit());
  assert.equal(result.manifest.sourceTreeCommitted,false);
  assert.equal(result.manifest.githubReady,false);
  assert.equal(result.manifest.publishable,false);
  assert.equal(result.manifest.ownerApproved,false);
  assert.equal(result.manifest.partialWebsiteReview,true);
  assert.equal(result.manifest.excludedTrackedPageEdits,1);
  assert.equal(result.manifest.changedFragments.length,2);
  assert.equal(result.report.changedFragments,2);
  assert.equal(result.report.generatedCompatibilitySourceVerified,true);
  assert.equal(result.report.originalSourceRollbackVerified,true);
  const wanted=new Set([reviewPath(0),reviewPath(413),PREVIEW,MANIFEST,README]);
  const extracted=decode(result.bytes,wanted);
  assert.equal(extracted.entryCount,5);
  assert.deepEqual(new Set(extracted.entries.map(x=>x.name)),wanted);
  assert.ok(!extracted.entries.some(x=>x.name==='site-content.html'||
    x.name==='index.html'||x.name.startsWith('content/legacy/')));
  const preview=extracted.entries.find(x=>x.name===PREVIEW).bytes;
  const intended=await planChangeSet(source,d.resources);
  assert.equal(preview.equals(intended.expected),true);
  assert.equal(sha(preview),result.manifest.previewSourceSha256);
  assert.equal(result.manifest.previewSourceSha256,receipt.proposedGeneratedSiteSha256);
  assert.ok(preview.length>30_000_000);
  assert.ok(result.report.archiveBytes>30_000_000);
  assert.equal(result.manifest.originalSourceSha256,baseline);
  assert.equal(result.manifest.sourceTreeContainsAllResources,false);
  assert.ok(!JSON.stringify(result.manifest).includes('Private preview title'));
  assert.ok(!JSON.stringify(result.report).includes('Private preview final resource'));
  const readme=extracted.entries.find(x=>x.name===README).bytes.toString('utf8');
  assert.match(readme,/PRIVATE REVIEW ONLY/);
  assert.match(readme,/Existing page\/navigation changes excluded: 1/);
  assert.match(readme,/DO NOT UPLOAD THIS ZIP/);
});
test('resource-only review ZIP has no missing-page warning and preserves exact rollback',async()=>{
  const d=drafts(false),receipt=await bindAtReview(checkout,d,commit());
  const result=await createResourcePreview(checkout,d,receipt);
  assert.equal(result.manifest.partialWebsiteReview,false);
  assert.equal(result.manifest.excludedTrackedPageEdits,0);
  assert.equal(result.manifest.pageDraftSha256,null);
  assert.equal(result.manifest.rollbackVerified,true);
  assert.equal(result.report.publicFilesWritten,0);
  assert.equal(result.report.deployable,false);
});
test('changed draft, stale commit, missing page companion or manipulated receipt fail closed',async()=>{
  const d=drafts(true),receipt=await bindAtReview(checkout,d,commit());
  const changed=structuredClone(d);
  changed.resources.changes[1].content='A different but valid resource text.';
  await assert.rejects(createResourcePreview(checkout,changed,receipt),/no longer matches exact saved drafts/);
  await assert.rejects(createResourcePreview(checkout,{resources:d.resources},receipt),
    /no longer matches exact saved drafts/);
  const wrong={...receipt,reviewedGitCommit:'0'.repeat(40)};
  await assert.rejects(createResourcePreview(checkout,d,wrong),/modified after creation/);
  await assert.rejects(createResourcePreview(checkout,{pages:d.pages},receipt),/resource draft is required/);
  await assert.rejects(createResourcePreview(checkout,{
    ...d,resources:{...d.resources,baselineSha256:'0'.repeat(64)}
  },receipt),/mismatched|Unsupported/);
});
test('repacked ZIP tampering is rejected even when ZIP CRC is recomputed',async()=>{
  const d=drafts(false),receipt=await bindAtReview(checkout,d,commit());
  const result=await createResourcePreview(checkout,d,receipt);
  const plan=await planChangeSet(source,d.resources);
  const allowed=new Set([reviewPath(0),reviewPath(413),PREVIEW,MANIFEST,README]);
  const files=decode(result.bytes,allowed).entries;
  const badFragment=encode(files.map(item=>item.name===reviewPath(0)?
    {...item,bytes:Buffer.from('forged resource literal')}:item),allowed);
  assert.throws(()=>verifyResourcePreview(badFragment,result.manifest,plan,source),
    /differs from intended/);
  const badPreview=encode(files.map(item=>item.name===PREVIEW?
    {...item,bytes:Buffer.from('not the reviewed website')}:item),allowed);
  assert.throws(()=>verifyResourcePreview(badPreview,result.manifest,plan,source),
    /compatibility preview differs/);
  const badNotice=encode(files.map(item=>item.name===README?
    {...item,bytes:Buffer.from('Unsafe changed notice')}:item),allowed);
  assert.throws(()=>verifyResourcePreview(badNotice,result.manifest,plan,source),
    /manifest or safety notice was altered/);
  const forgedManifest={...result.manifest,sourceTreeCommitted:true};
  assert.throws(()=>verifyResourcePreview(result.bytes,forgedManifest,plan,source),
    /unverified metadata/);
  assert.throws(()=>encode([...files,{name:'site-content.html',bytes:source}],
    new Set([...allowed,'site-content.html'])),/unsafe|Unsafe|ZIP/);
});
test('private CLI writes only outside Git, refuses overwrite and preserves exact preview hash',async()=>{
  await temp(async folder=>{
    const d=drafts(false),receipt=await bindAtReview(checkout,d,commit());
    const resourcePath=path.join(folder,'resource-draft.json');
    const proofPath=path.join(folder,'verified.review.json');
    const output=path.join(folder,'Private-Resource-Preview.zip');
    fs.writeFileSync(resourcePath,JSON.stringify(d.resources),{mode:0o600});
    fs.writeFileSync(proofPath,JSON.stringify(receipt),{mode:0o600});
    const summary=await saveResourcePreview(checkout,{
      resourcesFile:resourcePath,receiptFile:proofPath,output
    });
    assert.equal(summary.savedOutsideGit,true);
    assert.equal(summary.generatedCompatibilitySourceVerified,true);
    assert.equal(summary.deployable,false);
    const contents=fs.readFileSync(output);
    assert.equal(sha(contents),summary.archiveSha256);
    assert.equal(decode(contents,new Set([
      reviewPath(0),reviewPath(413),PREVIEW,MANIFEST,README
    ])).entryCount,5);
    if(process.platform!=='win32')
      assert.equal(fs.statSync(output).mode&0o077,0);
    await assert.rejects(saveResourcePreview(checkout,{
      resourcesFile:resourcePath,receiptFile:proofPath,output
    }),/already exists/);
    await assert.rejects(saveResourcePreview(checkout,{
      resourcesFile:resourcePath,receiptFile:proofPath,
      output:path.join(checkout,'editor','private.zip')
    }),/outside the repository/);
    const wrong=JSON.parse(fs.readFileSync(resourcePath,'utf8'));
    wrong.changes[0].title='Different title after receipt';
    fs.writeFileSync(resourcePath,JSON.stringify(wrong));
    await assert.rejects(saveResourcePreview(checkout,{
      resourcesFile:resourcePath,receiptFile:proofPath,
      output:path.join(folder,'should-not-exist.zip')
    }),/no longer matches exact saved drafts/);
    assert.equal(fs.existsSync(path.join(folder,'should-not-exist.zip')),false);
  });
});
test('private resource preview CLI demands exact review inputs',()=>{
  assert.deepEqual(parseArgs([
    '--receipt','/private/proof.json','--resources','/private/draft.json',
    '--output','/private/preview.zip'
  ]),{
    resourcesFile:'/private/draft.json',receiptFile:'/private/proof.json',
    pagesFile:null,output:'/private/preview.zip'
  });
  assert.throws(()=>parseArgs([]),/Specify/);
  assert.throws(()=>parseArgs(['--resources','foo']),/required/);
  assert.throws(()=>parseArgs([
    '--receipt','a','--resources','b','--output','c','--output','d'
  ]),/duplicate/);
  assert.equal(reviewPath(0),ROOT+'/0001.fragment');
  assert.equal(reviewPath(413),ROOT+'/0414.fragment');
});
