'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {
  safeTitle,replaceTitleInRecord,simulateTitleEdit
}=require('../tools/rehearse-title-edit.cjs');
const original=fs.readFileSync(path.resolve(__dirname,'..','..','site-content.html'));

test('one synthetic title change leaves all 413 other records byte-identical',()=>{
  const report=simulateTitleEdit(original,0,'Development Preview Title');
  assert.equal(report.originalRecords,414);
  assert.equal(report.recordsLeftByteIdentical,413);
  assert.equal(report.resourcesWithIntendedTextChange,1);
  assert.equal(report.originalOutsideResourceArrayPreserved,true);
  assert.equal(report.writtenToDisk,false);
  assert.equal(report.published,false);
  assert.notEqual(report.originalSha256,report.modifiedSha256);
});
test('rehearsal can target the last record without changing earlier records',()=>{
  const report=simulateTitleEdit(original,413,'Another Development Title');
  assert.equal(report.recordsLeftByteIdentical,413);
  assert.equal(report.resourcesWithIntendedTextChange,1);
});
test('editing titles escapes quotes safely and keeps all original fields',()=>{
  const input='{id:"a",title:"Existing",section:"test",classes:[],content:"Text",custom:"keep"}';
  const result=replaceTitleInRecord(input,'Example "Quoted" Title');
  assert.match(result.record,/title:"Example \\"Quoted\\" Title"/);
  assert.ok(result.record.includes('custom:"keep"'));
  assert.ok(result.record.includes('content:"Text"'));
});
test('unsafe titles and invalid positions are blocked',()=>{
  for(const value of ['','<script>alert(1)</script>','Line\nbreak','a'.repeat(161)])
    assert.equal(safeTitle(value),false);
  assert.throws(()=>simulateTitleEdit(original,-1,'Test'));
  assert.throws(()=>simulateTitleEdit(original,414,'Test'));
  assert.throws(()=>replaceTitleInRecord('{id:"a",title:buildTitle()}', 'Test'),
    /static string literal/);
});
