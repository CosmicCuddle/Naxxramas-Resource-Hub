'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const cp=require('node:child_process');
const {PAGES,NAV,runs}=require('../tools/plan-page-draft.cjs');
const {rehearseMixed}=require('../tools/rehearse-mixed-update.cjs');
const root=path.resolve(__dirname,'..','..');
const base='34455f6d901c538e2491a8c16681692e4c02d918b1984d7d0ba081aacb1049e8';
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function edits(){
 const files=PAGES.map(rel=>({
   path:rel,sourceSha256:hash(fs.readFileSync(path.join(root,rel))),edits:{}
 }));
 const first=runs(fs.readFileSync(path.join(root,PAGES[1]),'utf8')).find(x=>x.kind==='text');
 assert.ok(first);
 files[1].edits[first.id]='Temporary, reviewed rule text.';
 const nav=fs.readFileSync(path.join(root,NAV));
 const json=JSON.parse(nav.toString('utf8'));
 json.pages[2].intro='Rehearsed application information.';
 return {
  pages:{format:'naxx-local-draft-v3',sourceBranchHint:'feature/multi-file-editor-export-2026-11-05',
    sourceCommitVerified:false,createdAt:'2026-11-05T00:00:00Z',files,
    navigation:{path:NAV,sourceSha256:hash(nav),document:json}},
  resources:{format:'naxx-local-resource-draft-v2',baselineSha256:base,
    changes:[{index:0,title:'Mixed rehearsal title'},
      {index:413,content:'Safe rehearsal text\n\nAnother paragraph.'}]}
 };
}
test('mixed private rehearsal stages changed pages separately from candidate resources and exactly rolls back',async()=>{
  const report=await rehearseMixed(root,edits());
  assert.equal(report.pagesStaged,2);
  assert.equal(report.pagesUntouched,3);
  assert.equal(report.existingPageFilesVerified,5);
  assert.equal(report.existingPageRollbackExact,true);
  assert.equal(report.candidateResourcesVerified,2);
  assert.equal(report.candidateResourceSourceRebuilt,true);
  assert.equal(report.candidateResourceRollbackExact,true);
  assert.equal(report.privateFolderDeleted,true);
  assert.equal(report.originalCheckoutUnchanged,true);
  assert.equal(report.liveFilesWritten,0);
  assert.equal(report.rootLoaderChanged,false);
  assert.equal(report.generatedWebsiteChanged,false);
  assert.equal(report.githubReady,false);
  assert.equal(report.deployable,false);
  assert.ok(!JSON.stringify(report).includes('Mixed rehearsal title'));
  assert.ok(!JSON.stringify(report).includes('Temporary, reviewed rule text.'));
});
test('mixed private rehearsal works with page-only edits and never invents a source-tree deployment',async()=>{
 const d=edits();
 const result=await rehearseMixed(root,{pages:d.pages});
 assert.equal(result.pagesStaged,2);
 assert.equal(result.pagesUntouched,3);
 assert.equal(result.candidateResourcesVerified,0);
 assert.equal(result.candidateResourceSourceRebuilt,null);
 assert.equal(result.originalCheckoutUnchanged,true);
 assert.equal(result.generatedWebsiteChanged,false);
});
test('mixed private rehearsal supports resource-only drafts and leaves all existing pages untouched',async()=>{
 const d=edits();
 const result=await rehearseMixed(root,{resources:d.resources});
 assert.equal(result.pagesStaged,0);
 assert.equal(result.pagesUntouched,5);
 assert.equal(result.candidateResourcesVerified,2);
 assert.equal(result.candidateResourceRollbackExact,true);
 assert.equal(result.originalCheckoutUnchanged,true);
});
test('stale hash, unrelated source commit or unapproved path fail before temporary page changes',async()=>{
 const bad=edits();bad.pages.files[1].sourceSha256='0'.repeat(64);
 await assert.rejects(rehearseMixed(root,bad),/Page source hash mismatch/);
 const other=edits();other.pages.files[1].path='index.html';
 await assert.rejects(rehearseMixed(root,other),/Unapproved page path/);
 const mismatched=edits();
 await assert.rejects(rehearseMixed(root,{...mismatched,expectedCommit:'0'.repeat(40)}),/Checkout commit changed/);
 const actual=cp.execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
 const passed=await rehearseMixed(root,{...edits(),expectedCommit:actual});
 assert.equal(passed.checkoutCommit,actual);
});
