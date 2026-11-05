'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const cp=require('node:child_process');
const {bindAtReview,verifyReviewBinding,canonical,objectDigest}=
  require('../tools/bind-editor-drafts.cjs');
const {PAGES,NAV,runs}=require('../tools/plan-page-draft.cjs');
const root=path.resolve(__dirname,'..','..');
const base='34455f6d901c538e2491a8c16681692e4c02d918b1984d7d0ba081aacb1049e8';
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const head=()=>cp.execFileSync('git',['rev-parse','HEAD'],{
  cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']
}).trim();
function drafts(){
  const files=PAGES.map(relative=>({
    path:relative,sourceSha256:hash(fs.readFileSync(path.join(root,relative))),edits:{}
  }));
  const first=runs(fs.readFileSync(path.join(root,PAGES[0]),'utf8'))
    .find(item=>item.kind==='text');
  assert.ok(first);
  files[0].edits[first.id]='New reviewed page copy.';
  const navBytes=fs.readFileSync(path.join(root,NAV));
  const nav=JSON.parse(navBytes.toString('utf8'));
  nav.pages[0].label='Reviewed New Players';
  return {
    pages:{format:'naxx-local-draft-v3',
      sourceBranchHint:'feature/multi-file-editor-export-2026-11-05',
      sourceCommitVerified:false,createdAt:'2026-11-05T00:00:00.000Z',
      files,navigation:{path:NAV,sourceSha256:hash(navBytes),document:nav}},
    resources:{format:'naxx-local-resource-draft-v2',baselineSha256:base,
      changes:[{index:0,title:'Private bound title'},
        {index:413,content:'A verified review\n\nSecond paragraph.'}]}
  };
}
test('exact reviewed Git commit binds both untouched source fingerprints and edited draft hashes',async()=>{
  const d=drafts(),commit=head();
  const receipt=await bindAtReview(root,d,commit);
  assert.equal(receipt.format,'naxx-draft-commit-review-binding-v1');
  assert.equal(receipt.reviewedGitCommit,commit);
  assert.match(receipt.reviewedGitTree,/^[a-f0-9]{40,64}$/);
  assert.match(receipt.receiptSha256,/^[a-f0-9]{64}$/);
  assert.equal(receipt.sourceFiles.length,6);
  assert.ok(receipt.sourceFiles.some(x=>x.path==='site-content.html'&&x.sourceSha256===base));
  assert.equal(receipt.changedExistingPageCount,2);
  assert.equal(receipt.changedProposedResourceCount,2);
  assert.deepEqual(receipt.plannedChanges.map(x=>x.path),[
    'content/legacy/resources/0001.fragment',
    'content/legacy/resources/0414.fragment',
    'content/navigation.json',
    'new-players/content.html'
  ]);
  assert.ok(receipt.plannedChanges.slice(0,2).every(x=>x.trackedAtReview===false));
  assert.equal(receipt.boundAtReview,true);
  assert.equal(receipt.authoredAtThisCommitProven,false);
  assert.equal(receipt.cryptographicallySigned,false);
  assert.equal(receipt.githubReady,false);
  assert.equal(receipt.approvedByOwner,false);
  assert.equal(receipt.resourceSourceTreeCommitted,false);
  assert.ok(!JSON.stringify(receipt).includes('Private bound title'));
  assert.ok(!JSON.stringify(receipt).includes('New reviewed page copy'));
  const verified=await verifyReviewBinding(root,d,receipt);
  assert.equal(verified.checkoutMatchesRequestedCommit,true);
  assert.equal(verified.reviewedChangeCount,4);
  assert.equal(verified.pageDraftMatchesReceipt,true);
  assert.equal(verified.resourceDraftMatchesReceipt,true);
  assert.equal(verified.noRepositoryWrites,true);
  assert.equal(verified.githubReady,false);
});
test('binding refuses unstated or stale commit rather than guessing HEAD',async()=>{
  const draft=drafts();
  await assert.rejects(bindAtReview(root,draft),/explicit reviewed Git commit/);
  await assert.rejects(bindAtReview(root,draft,'0'.repeat(40)),/Checkout commit changed/);
  await assert.rejects(bindAtReview(root,draft,'not-a-commit'),/explicit reviewed Git commit/);
  await assert.rejects(bindAtReview(root,{unknown:true},head()),/supported draft fields/);
});
test('receipt verification rejects changed draft content even when original HTML hashes still match',async()=>{
  const d=drafts(),receipt=await bindAtReview(root,d,head());
  const modified=drafts();
  modified.resources.changes[1].content='A different, plausible text field.';
  await assert.rejects(verifyReviewBinding(root,modified,receipt),
    /no longer matches exact saved drafts/);
  const nav=drafts();
  nav.pages.navigation.document.pages[0].label='Different reviewed menu';
  await assert.rejects(verifyReviewBinding(root,nav,receipt),
    /no longer matches exact saved drafts/);
});
test('receipt corruption or self-proclaimed publication approval fails closed',async()=>{
  const d=drafts(),receipt=await bindAtReview(root,d,head());
  const mutated={...receipt,reviewedGitTree:'0'.repeat(40)};
  await assert.rejects(verifyReviewBinding(root,d,mutated),/modified after creation/);
  const extra={...receipt,unrecognisedField:'hello'};
  await assert.rejects(verifyReviewBinding(root,d,extra),/modified after creation/);
  const forged={...receipt,githubReady:true};
  await assert.rejects(verifyReviewBinding(root,d,forged),/not a permitted/);
  const selfSigned={...receipt,cryptographicallySigned:true};
  await assert.rejects(verifyReviewBinding(root,d,selfSigned),/not a permitted/);
});
test('canonical hash is stable under object key order but rejects unsafe metadata',()=>{
  assert.equal(canonical({b:[1,true],a:{y:null,x:'A'}}),
    canonical({a:{x:'A',y:null},b:[1,true]}));
  assert.equal(objectDigest({b:2,a:1}),objectDigest({a:1,b:2}));
  assert.throws(()=>canonical(JSON.parse('{"__proto__":{}}')),/Unsafe draft metadata/);
  assert.throws(()=>canonical({x:undefined}),/non-JSON value/);
  assert.throws(()=>canonical({x:Infinity}),/non-JSON value/);
});
