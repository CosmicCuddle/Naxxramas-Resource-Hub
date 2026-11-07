'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {SOURCE_SHA}=require('../tools/audit-source-storage-budget.cjs');
const {splitInMemory,restoreInMemory}=
  require('../tools/check-legacy-roundtrip.cjs');
const {planChangeSet}=require('../tools/rehearse-resource-change-set.cjs');
const {verify,save,draftFrom,plan,withTemporaryVersions}=
  require('../tools/rehearse-versioned-resource-sessions.cjs');
const {PAGES,NAV,runs}=require('../tools/plan-page-draft.cjs');
const {
  FORMAT,LEGACY_TITLE,LEGACY_RESOURCE,LEGACY_PAGE,
  parseBytes,identify,prepareResourceReview,inspectPageDraft,demonstrate
}=require('../tools/rehearse-legacy-draft-bridge.cjs');
const original=fs.readFileSync(path.resolve(__dirname,'..','..','site-content.html'));
const root=path.resolve(__dirname,'..','..');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const resource=changes=>({format:LEGACY_RESOURCE,baselineSha256:SOURCE_SHA,changes});
test('original resource v2 title and multiline content bridge is byte-equivalent to the independent legacy planner',async()=>{
  await withTemporaryVersions(original,async dir=>{
    const old=resource([
      {index:0,title:'Private conversion test title'},
      {index:413,content:'Private multiline content.\n\nSecond paragraph.'}
    ]);
    const bytes=Buffer.from(JSON.stringify(old)),before=Buffer.from(bytes);
    const result=await prepareResourceReview(dir,original,bytes);
    assert.equal(result.format,FORMAT);
    assert.equal(result.decision,'review-only');
    assert.equal(result.oldDraftFormat,'resource-v2');
    assert.equal(result.originalDraftPreserved,true);
    assert.equal(result.originalDraftSha256,sha(bytes));
    assert.equal(result.originalDraftBytes,bytes.length);
    assert.equal(result.editedResourceCount,2);
    assert.equal(result.titleChanges,1);
    assert.equal(result.multilineContentChanges,1);
    assert.equal(result.nextRevision,1);
    assert.equal(result.proposedFileCount,4);
    assert.equal(result.needsOwnerReview,true);
    assert.equal(result.automaticRebaseForbidden,true);
    assert.equal(result.sourceOfTruthApproved,false);
    assert.equal(result.githubBranchVerified,false);
    assert.equal(result.canApply,false);
    assert.equal(result.canMerge,false);
    assert.equal(result.canPublish,false);
    assert.equal(result.filesWritten,0);
    assert.equal(result.githubWrites,0);
    assert.ok(bytes.equals(before));
    const snapshot=verify(dir,original);
    const proposed=plan(snapshot,result.convertedDraft);
    const generated=restoreInMemory(snapshot.split,proposed.newRecords);
    const independent=await planChangeSet(original,old);
    assert.ok(independent.expected.equals(generated));
    assert.equal(sha(generated),result.receipt.proposedFullSiteSha256);
    assert.equal(result.receipt.editedResourceCount,2);
    assert.equal(snapshot.manifest.revision,0);
    assert.equal(sha(original),SOURCE_SHA);
  });
});
test('v1 title-only draft remains supported and never alters source content',async()=>{
  await withTemporaryVersions(original,async dir=>{
    const legacy={format:LEGACY_TITLE,baselineSha256:SOURCE_SHA,
      changes:[{index:0,title:'Private v1 title'}]};
    const r=await prepareResourceReview(dir,original,JSON.stringify(legacy));
    assert.equal(r.decision,'review-only');
    assert.equal(r.oldDraftFormat,'title-v1');
    assert.equal(r.titleChanges,1);
    assert.equal(r.multilineContentChanges,0);
    assert.equal(r.proposedFileCount,3);
    const current=verify(dir,original);
    const changed=plan(current,r.convertedDraft);
    assert.equal(changed.indices.length,1);
    assert.equal(changed.newRecords[413],current.records[413]);
    assert.equal(changed.manifest.revision,1);
  });
});
test('zero-edit legacy resource draft is retained as no-op; never invents an update',async()=>{
  await withTemporaryVersions(original,async dir=>{
    const r=await prepareResourceReview(dir,original,
      JSON.stringify(resource([])));
    assert.equal(r.decision,'no-resource-edits');
    assert.equal(r.editedResourceCount,0);
    assert.equal(r.convertedDraft,null);
    assert.equal(r.receipt,null);
    assert.equal(r.filesWritten,0);
    assert.equal(verify(dir,original).manifest.revision,0);
  });
});
test('v2 original draft is refused after unrelated session advances source revision without silent rebase',async()=>{
  await withTemporaryVersions(original,async dir=>{
    const existing=verify(dir,original);
    const old=Buffer.from(JSON.stringify(resource([
      {index:0,title:'Private stale title to keep'}
    ])));
    const shaBefore=sha(old);
    const first=save(dir,original,draftFrom(existing,[
      {index:413,title:'Different resource edited first'}
    ]));
    const blocked=await prepareResourceReview(dir,original,old);
    assert.equal(blocked.decision,'stale-original-draft');
    assert.equal(blocked.sourceRevision,1);
    assert.equal(blocked.originalDraftSha256,shaBefore);
    assert.equal(blocked.originalDraftPreserved,true);
    assert.equal(blocked.convertedDraft,null);
    assert.equal(blocked.receipt,null);
    assert.equal(blocked.automaticRebaseForbidden,true);
    assert.equal(blocked.needsOwnerReview,true);
    assert.equal(blocked.filesWritten,0);
    assert.equal(blocked.githubWrites,0);
    assert.equal(first.after.manifest.revision,1);
    assert.equal(verify(dir,original).manifest.revision,1);
  });
});
test('bad resource input, forged schema, duplicate indexes, unsafe markup and unchanged fields are all rejected',async()=>{
  await withTemporaryVersions(original,async dir=>{
    const originalTitle=(await require('../resource-title-core.js')
      .open(original.toString('utf8'),crypto.webcrypto)).resources[0].title;
    const inputs=[
      {...resource([{index:0,title:'valid'}]),baselineSha256:'a'.repeat(64)},
      resource([{index:0,title:'same'},{index:0,title:'other'}]),
      resource([{index:0,title:'<script>not allowed</script>'}]),
      resource([{index:415,title:'out of bounds'}]),
      resource([{index:0,title:originalTitle}]),
      resource([{index:0,title:'valid',other:'bad'}]),
      {format:'naxx-private-versioned-resource-draft-v1',
        sourceBaselineSha256:SOURCE_SHA,changes:[]},
      {format:LEGACY_PAGE,sourceBranchHint:'invalid'},
    ];
    for(const input of inputs)await assert.rejects(
      prepareResourceReview(dir,original,Buffer.from(JSON.stringify(input))),
      /only original v1\/v2|Unsupported|Unexpected|Invalid|duplicate|unchanged|draft|protected/i
    );
    assert.equal(verify(dir,original).manifest.revision,0);
  });
});
test('invalid JSON and unsafe encodings are refused without leaking draft text',()=>{
  assert.throws(()=>parseBytes(Buffer.from('{')),
    /JSON is invalid/);
  assert.throws(()=>parseBytes(Buffer.from([0xff])),
    /UTF-8 encoding/);
  assert.throws(()=>parseBytes(Buffer.alloc(0)),
    /size or UTF-8/);
  assert.throws(()=>parseBytes(Buffer.alloc(16777217,0x20)),
    /size or UTF-8/);
  assert.equal(identify({format:LEGACY_RESOURCE}),'resource-v2');
  assert.equal(identify({format:LEGACY_TITLE}),'title-v1');
  assert.equal(identify({format:LEGACY_PAGE}),'page-v3');
  assert.equal(identify({format:'unrecognised'}),null);
});
test('physical source modification prevents any bridge planning',async()=>{
  await withTemporaryVersions(original,async dir=>{
    const file=path.join(dir,'content','resource-overlays','resources','0200.fragment');
    const saved=fs.readFileSync(file);
    fs.writeFileSync(file,'private invalid source bytes');
    await assert.rejects(
      prepareResourceReview(dir,original,JSON.stringify(resource([
        {index:0,title:'Private valid original title'}
      ]))),
      /checksum|fragment/i);
    fs.writeFileSync(file,saved);
    assert.equal(verify(dir,original).manifest.revision,0);
  });
});
test('page/navigation v3 draft is independently reviewed, preserved and never converted into resource overlay',()=>{
  const files=PAGES.map(relative=>({
    path:relative,
    sourceSha256:sha(fs.readFileSync(path.join(root,relative))),edits:{}
  }));
  const run=runs(fs.readFileSync(path.join(root,PAGES[0]),'utf8'))
    .find(x=>x.kind==='text');
  assert.ok(run);
  files[0].edits[run.id]='Private page guide bridge review';
  const navBytes=fs.readFileSync(path.join(root,NAV));
  const nav=JSON.parse(navBytes.toString('utf8'));
  nav.pages[1].label='Private page navigation title';
  const page={format:LEGACY_PAGE,
    sourceBranchHint:'feature/multi-file-editor-export-2026-11-05',
    sourceCommitVerified:false,createdAt:'2026-11-05T00:00:00Z',
    files,navigation:{path:NAV,sourceSha256:sha(navBytes),document:nav}};
  const originalBytes=Buffer.from(JSON.stringify(page));
  const before=Buffer.from(originalBytes);
  const result=inspectPageDraft(root,originalBytes);
  assert.equal(result.format,FORMAT);
  assert.equal(result.oldDraftFormat,'page-v3');
  assert.equal(result.decision,'separate-page-review');
  assert.equal(result.pageDraftStillSeparate,true);
  assert.equal(result.resourceMigrationPerformed,false);
  assert.equal(result.originalPagesSourceVerified,true);
  assert.equal(result.sourceCommitVerified,false);
  assert.equal(result.pageAndNavigationFilesChecked,5);
  assert.equal(result.proposedPageAndNavigationFiles.length,2);
  assert.equal(result.resourceDraft,null);
  assert.equal(result.originalDraftSha256,sha(originalBytes));
  assert.equal(result.originalDraftPreserved,true);
  assert.equal(result.filesWritten,0);
  assert.equal(result.githubWrites,0);
  assert.equal(result.canApply,false);
  assert.equal(result.canPublish,false);
  assert.ok(originalBytes.equals(before));
  assert.equal(result.proposedPageAndNavigationFiles.every(x=>
    x.path===PAGES[0]||x.path===NAV),true);
  const forged={...page,files:page.files.map(x=>({...x}))};
  forged.files[0].sourceSha256='f'.repeat(64);
  assert.throws(()=>inspectPageDraft(root,JSON.stringify(forged)),
    /source hash mismatch/);
  assert.throws(()=>inspectPageDraft(root,JSON.stringify(resource([]))),
    /not a page\/navigation-v3/);
});
test('standalone private bridge rehearsal preserves original source and destroys simulated folder',async()=>{
  const report=await demonstrate(original,root);
  assert.equal(report.format,FORMAT);
  assert.equal(report.oldV2ConvertedForReview,true);
  assert.equal(report.oldDraftSha256Retained,true);
  assert.equal(report.resourceChanges,2);
  assert.equal(report.proposedRevision,1);
  assert.equal(report.proposedPathCount,4);
  assert.equal(report.obsoleteV2RejectedAfterVersionAdvance,true);
  assert.equal(report.pageV3RemainsSeparate,true);
  assert.equal(report.originalDraftsDeleted,0);
  assert.equal(report.temporaryFolderDeleted,true);
  assert.equal(report.gitHubWrites,0);
  assert.equal(report.canPublish,false);
  assert.equal(sha(original),SOURCE_SHA);
});
test('bridge contains no GitHub API, release export or real-file write calls',()=>{
  const source=fs.readFileSync(path.resolve(__dirname,
    '../tools/rehearse-legacy-draft-bridge.cjs'),'utf8');
  for(const keyword of ['https.request(','fetch(','GITHUB_TOKEN',
    'update_ref(','create_commit(','writeFileSync(','fs.rmSync(',
    'localStorage','sessionStorage'])
    assert.equal(source.includes(keyword),false,keyword);
});
