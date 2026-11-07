'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {audit,summarizeSideCollection,literalString}=require('../tools/audit-side-collection.cjs');

test('side collection scanner counts shapes without exposing source values',()=>{
  const source='[{name:"Hidden A",flag:true,detail:{x:1}}, {name:"Hidden A",values:[1,2]},{name:"Hidden B"}]';
  const report=summarizeSideCollection(source,0);
  assert.equal(report.recordCount,3);
  assert.equal(report.nameFields,3);
  assert.equal(report.duplicatedLiteralNames,1);
  assert.equal(report.idFields,0);
  assert.equal(report.propertyValueTypeCounts.object,1);
  assert.equal(report.propertyValueTypeCounts.array,1);
  assert.equal(report.fieldsCouldNotBeParsed,0);
  assert.ok(!JSON.stringify(report).includes('Hidden'));
});

test('only quoted literal names are interpreted',()=>{
  assert.equal(literalString('"Escaped\\nname"',0,15),'Escaped\nname');
  assert.equal(literalString('computeName()',0,13),null);
  assert.throws(()=>summarizeSideCollection('[{name:"A"}, null]',0));
});

test('full preserved source has 29 distinct side objects (read only)',()=>{
  const original=fs.readFileSync(path.resolve(__dirname,'..','..','site-content.html'));
  const report=audit(original);
  assert.equal(report.originalSourceVerified,true);
  assert.equal(report.directRootMembers,27);
  assert.equal(report.arrayMemberIndex,17);
  assert.equal(report.recordCount,29);
  assert.equal(report.nameFields,29);
  assert.equal(report.idFields,0);
  assert.equal(report.sourceCodeExecuted,false);
  assert.equal(report.valuesOrNamesEmitted,false);
  assert.equal(report.fieldsCouldNotBeParsed,0);
  assert.ok(!Object.hasOwn(report,'names'));
  assert.ok(!Object.hasOwn(report,'records'));
});
