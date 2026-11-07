'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {replaceContentInRecord,simulateContentEdit}=require('../tools/rehearse-content-edit.cjs');
const bytes=fs.readFileSync(path.resolve(__dirname,'..','..','site-content.html'));
test('content edit preserves all other fields in a synthetic record',()=>{
  const original='{id:"id1",title:"Title",section:"A",classes:["X"],content:"Old\\ntext",customFlag:true,customLinks:{a:1}}';
  const changed=replaceContentInRecord(original,'New "quoted" text\n\nSecond line.');
  assert.ok(changed.record.includes('content:"New \\"quoted\\" text\\n\\nSecond line."'));
  assert.ok(changed.record.includes('customFlag:true'));
  assert.ok(changed.record.includes('customLinks:{a:1}'));
  assert.ok(changed.record.includes('classes:["X"]'));
});
for(const position of [0,413]){
  test('one original content change at '+position+' preserves 413 others and non-resource bytes',()=>{
    const report=simulateContentEdit(bytes,position,'Safe replacement content\n\nParagraph two.');
    assert.equal(report.originalSourceVerified,true);
    assert.equal(report.unchangedResourceFragments,413);
    assert.equal(report.originalNonResourceSourcePreserved,true);
    assert.equal(report.editedFields,1);
    assert.equal(report.published,false);
    assert.equal(report.sourceValuesOrIdsEmitted,false);
    assert.notEqual(report.originalSha256,report.rebuiltSha256);
  });
}
test('original empty content can be filled and nonempty content cleared without changing custom fields',()=>{
  const empty='{id:"one",title:"One",content:"",privateMeta:{flag:true}}';
  assert.ok(replaceContentInRecord(empty,'Two lines\n\nMore').record.includes('privateMeta:{flag:true}'));
  assert.ok(replaceContentInRecord('{id:"one",content:"old",x:1}','').record.includes('content:""'));
});
test('unsafe markup or source expressions are refused',()=>{
  assert.throws(()=>replaceContentInRecord('{id:"x",content:"safe"}','<script>alert(1)</script>'));
  assert.throws(()=>replaceContentInRecord('{id:"x",content:compute()}','new text'));
  assert.throws(()=>replaceContentInRecord('{id:"x",content:"safe",content:"duplicated"}','new text'));
  assert.throws(()=>simulateContentEdit(Buffer.concat([bytes,Buffer.from('x')]),0,'new text'),/fingerprint|Aborting/i);
});
