'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {audit,scanNested}=require('../tools/audit-side-nested.cjs');

test('nested audit counts exact literal links but never prints secret values or keys',()=>{
  const source='[{name:"Secret",one:{label:"resource-1",nested:{count:2},tags:["resource-2","other"]},two:{label:"resource-2"},three:{}}]';
  const data=scanNested(source,0,new Set(['resource-1','resource-2']));
  assert.equal(data.sideObjects,1);
  assert.equal(data.directObjectFieldsInSideRecords,3);
  assert.equal(data.distinctPotentiallyMatchedResourceIds,2);
  assert.equal(data.exactNestedLiteralMatchesToResourceIds,3);
  assert.equal(data.exactOuterLiteralMatchesToResourceIds,0);
  assert.equal(data.depthLimitReached,0);
  assert.equal(data.valuesNamesKeysOrIdsEmitted,false);
  const report=JSON.stringify(data);
  for(const secret of ['Secret','resource-1','resource-2','label','tags'])
    assert.equal(report.includes(secret),false);
});

test('nested object parsing refuses broken or unsafe syntax',()=>{
  assert.throws(()=>scanNested('[{name:"x",obj:{a:1,b:2},null}]',0,new Set()));
  assert.throws(()=>scanNested('[{name:"x",obj:{unterminated:"x}]',0,new Set()));
  assert.throws(()=>scanNested('[null]',0,new Set()));
});

test('verified 29-item side collection has 87 first-level nested objects',()=>{
  const bytes=fs.readFileSync(path.resolve(__dirname,'..','..','site-content.html'));
  const result=audit(bytes);
  assert.equal(result.originalSourceVerified,true);
  assert.equal(result.sideObjects,29);
  assert.equal(result.sideFieldOccurrences,203);
  assert.equal(result.directObjectFieldsInSideRecords,87);
  assert.equal(result.valuesNamesKeysOrIdsEmitted,false);
  assert.equal(result.sourceCodeExecuted,false);
  assert.equal(result.unparseableNestedFields,0);
  assert.equal(result.duplicateNestedFieldKeys,0);
  assert.equal(result.depthLimitReached,0);
  assert.ok(!Object.hasOwn(result,'resourceIds'));
  assert.ok(!Object.hasOwn(result,'sideNames'));
});

test('a changed original file is rejected before scanning side relationships',()=>{
  const bytes=fs.readFileSync(path.resolve(__dirname,'..','..','site-content.html'));
  const changed=Buffer.concat([bytes,Buffer.from(' ')]);
  assert.throws(()=>audit(changed),/fingerprint|Unexpected|Aborting/i);
});
