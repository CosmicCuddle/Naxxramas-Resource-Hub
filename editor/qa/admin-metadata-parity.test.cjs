'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const cp=require('node:child_process'),vm=require('node:vm');
const {PAGES,NAV,runs}=require('../tools/plan-page-draft.cjs');
const {SOURCE_SHA}=require('../tools/audit-source-storage-budget.cjs');
const {
  FORMAT,parseRecord,compareRecords,editMapFromDraft,
  reviewAdminFieldParity
}=require('../tools/rehearse-admin-metadata-parity.cjs');
const root=path.resolve(__dirname,'..','..');
const at=(r,p)=>path.join(r,...p.split('/'));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const commit=cp.execFileSync('git',['rev-parse','HEAD'],{
  cwd:root,encoding:'utf8'}).trim();
const status=()=>cp.execFileSync('git',
  ['status','--porcelain=v1','--untracked-files=all'],{
    cwd:root,encoding:'utf8'}).trim();
function fake(){
  const records=Array.from({length:414},(_,i)=>
    '{id: '+i+', title: "Original", content: "Hello", '+
    'classes: ["a"], customSpecial: {value: 99}}');
  const next=records.slice();
  next[0]=next[0].replace('title: "Original"','title: "Updated"');
  return {records,next,edits:new Map([[0,new Set(['title'])]])};
}
function draft(){
  const orig=fs.readFileSync(at(root,PAGES[0]),'utf8');
  const field=runs(orig).find(x=>x.kind==='text');
  assert.ok(field);
  const nav=fs.readFileSync(at(root,NAV));
  return {
    pages:{
      format:'naxx-local-draft-v3',
      sourceBranchHint:'feature/multi-file-editor-export-2026-11-05',
      sourceCommitVerified:false,createdAt:'2026-11-07T00:00:00.000Z',
      files:PAGES.map(name=>({path:name,
        sourceSha256:sha(fs.readFileSync(at(root,name))),
        edits:name===PAGES[0]?{[field.id]:'Admin metadata parity test edit'}:{}
      })),
      navigation:{path:NAV,sourceSha256:sha(nav),
        document:JSON.parse(nav.toString('utf8'))}
    },
    resources:{
      format:'naxx-local-resource-draft-v2',baselineSha256:SOURCE_SHA,
      changes:[
        {index:0,title:'Private admin metadata test title'},
        {index:413,content:'Private admin metadata paragraph.\nSecond line.'}
      ]
    }
  };
}
async function realZip(pages,resources){
  const browser={TextEncoder,Blob,Uint8Array,Uint32Array,DataView,
    crypto:crypto.webcrypto,document:{getElementById(){return null;}}};
  for(const name of ['export-zip.js','review-package.js'])
    vm.runInNewContext(fs.readFileSync(at(root,'editor/'+name),'utf8'),
      browser,{filename:name,timeout:5000});
  const saved=await browser.NaxxEditorReview.build(
    pages,resources,browser.NaxxEditorZip);
  return Buffer.from(await saved.blob.arrayBuffer());
}
test('only the approved literal may change, preserving unknown custom fields',()=>{
  const {records,next,edits}=fake();
  const report=compareRecords(records,next,edits);
  assert.equal(report.resourceRecordsCompared,414);
  assert.equal(report.changedApprovedTextLiterals,1);
  assert.equal(report.changedResourceRecords,1);
  assert.equal(report.uneditedResourcesByteExact,413);
  assert.equal(report.protectedAdditionalCustomFieldOccurrences,414);
  assert.equal(report.allOtherResourceBytesIdentical,true);
});
test('unknown custom, ID, class, property order and unrequested content alterations are refused',()=>{
  const {records,next,edits}=fake();
  const vary=(index,from,to,pattern)=>{
    const original=next[index];
    assert.ok(original.includes(from));
    const changed=next.slice();
    changed[index]=original.replace(from,to);
    assert.throws(()=>compareRecords(records,changed,edits),pattern);
  };
  vary(0,'customSpecial: {value: 99}','customSpecial: {value: 98}',
    /non-editable resource property/);
  vary(0,'id: 0','id: 1',/non-editable resource property/);
  vary(0,'classes: ["a"]','classes: ["b"]',
    /non-editable resource property/);
  vary(0,'content: "Hello"','content: "Unreviewed"',
    /non-editable resource property/);
  vary(1,'title: "Original"','title: "Unreviewed"',
    /unedited resource/);
  vary(0,'customSpecial: {value: 99}', '',
    /removed or reordered|unparseable/);
  vary(0,'title: "Updated"','title: readSecret()',
    /not one plain string literal/);
  vary(0,'title: "Updated"','title: "Original"',
    /unchanged or retyped/);
});
test('strict edit maps reject unapproved fields, duplicate edits and unsafe indices',()=>{
  const good=editMapFromDraft({
    format:'naxx-local-resource-draft-v2',changes:[
      {index:0,title:'One'}, {index:413,content:'Two'}
    ]
  });
  assert.equal(good.size,2);
  assert.deepEqual([...good.get(0)],['title']);
  for(const changes of [
    [{index:414,title:'out of range'}],
    [{index:0,custom:'forbidden'}],
    [{index:0,title:'one'},{index:0,title:'two'}],
    [{index:-1,content:'bad'}],
    [{index:0,title:42}]
  ]){
    assert.throws(()=>editMapFromDraft({
      format:'naxx-local-resource-draft-v2',changes
    }),/unsafe|Duplicated|Unapproved/i);
  }
  assert.throws(()=>parseRecord('{id: 1, id: 2}'),
    /duplicate custom properties/);
});
test('REAL editor review ZIP retains every unknown resource field, associations, and original DATA shell',async()=>{
  const input=draft(),zip=await realZip(input.pages,input.resources);
  const before=status();
  const report=await reviewAdminFieldParity(root,zip,commit,proof=>{
    const evidence=proof.rerun();
    assert.equal(evidence.resourceRecordsCompared,414);
    assert.equal(evidence.changedResourceRecords,2);
    assert.equal(evidence.changedApprovedTextLiterals,2);
    assert.equal(evidence.uneditedResourcesByteExact,412);
    assert.equal(evidence.protectedAdditionalCustomFieldOccurrences,13821);
    assert.equal(evidence.allOtherResourceBytesIdentical,true);
    const changed=proof.proposedRecords.slice();
    // Deliberately change only source formatting in a protected field:
    // even this is not permitted by a title/content-only draft.
    const fields=parseRecord(changed[0]);
    const protectedField=fields.find(f=>f.key!=='title'&&f.key!=='content');
    assert.ok(protectedField);
    const atField=protectedField.segment[0];
    changed[0]=changed[0].slice(0,atField)+' '+
      changed[0].slice(atField);
    assert.throws(()=>compareRecords(
      proof.originalRecords,changed,proof.expectedFields),
      /non-editable resource property/);
  });
  assert.equal(report.format,FORMAT);
  assert.equal(report.protectedAdditionalCustomFieldOccurrences,13821);
  assert.equal(report.changedResourceRecords,2);
  assert.equal(report.changedApprovedTextLiterals,2);
  assert.equal(report.sourceBoundOriginalDataShellPreserved,true);
  assert.equal(report.completeProposedRuntimeMatchesPhysicalSource,true);
  assert.equal(report.originalDirectDataMembersProtectedByShell,true);
  assert.equal(report.originalSeparateSideCollectionProtectedByShell,true);
  assert.equal(report.embeddedNonResourceMediaProtectedByShell,true);
  assert.equal(report.originalAdminScriptsProtectedByShell,true);
  assert.equal(report.noAdministratorLoginAttempted,true);
  assert.equal(report.actualAdminFeatureAcceptanceCompleted,false);
  assert.equal(report.finalResourceLayoutOwnerApproved,false);
  assert.equal(report.productionReleaseBackupRetained,false);
  assert.equal(report.canApply,false);
  assert.equal(report.canSave,false);
  assert.equal(report.canPublish,false);
  assert.equal(report.websiteFilesWritten,0);
  assert.equal(report.githubWrites,0);
  assert.equal(report.noResourceValuesOrIdentifiersPrinted,true);
  assert.equal(sha(fs.readFileSync(at(root,'site-content.html'))),SOURCE_SHA);
  assert.equal(status(),before);
});
test('stale original commit and missing resource draft cannot pass custom data parity',async()=>{
  const input=draft(),zip=await realZip(input.pages,input.resources);
  await assert.rejects(
    reviewAdminFieldParity(root,zip,'f'.repeat(40)),
    /Checkout commit changed/);
  const pageOnly=await realZip(input.pages,null);
  await assert.rejects(
    reviewAdminFieldParity(root,pageOnly,commit),
    /Both page and resource drafts/);
});
test('custom metadata parity tool cannot log source values, authenticate, write or publish',()=>{
  const source=fs.readFileSync(
    at(root,'editor/tools/rehearse-admin-metadata-parity.cjs'),'utf8');
  for(const unsafe of ['fetch(', 'https.request(', 'create_commit(',
    'update_ref(', 'writeFileSync(', 'git push','git commit',
    'GITHUB_TOKEN','process.env.'])
    assert.equal(source.includes(unsafe),false,unsafe);
  assert.match(source,/actualAdminFeatureAcceptanceCompleted:false/);
  assert.match(source,/noResourceValuesOrIdentifiersPrinted:true/);
  assert.match(source,/originalAdminScriptsProtectedByShell:true/);
});
