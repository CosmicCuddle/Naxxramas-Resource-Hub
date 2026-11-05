'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),
  fs=require('node:fs'),path=require('node:path');
const {audit,inspectContents}=require('../tools/audit-resource-content.cjs');
test('verified original content fields are exactly 414, without emitted values',()=>{
  const bytes=fs.readFileSync(path.resolve(__dirname,'..','..','site-content.html'));
  const report=audit(bytes);
  assert.equal(report.originalSourceVerified,true);
  assert.equal(report.resourcesChecked,414);
  assert.equal(report.contentFields,414);
  assert.equal(report.contentValuesOrResourceIdentifiersEmitted,false);
  assert.equal(report.sourceCodeEvaluated,false);
  assert.equal(report.maxDecodedCharacters>=report.minDecodedCharacters,true);
  assert.ok(!Object.hasOwn(report,'contents'));
  assert.ok(!Object.hasOwn(report,'ids'));
});
test('changed website fingerprint stops before content inventory',()=>{
  const bytes=fs.readFileSync(path.resolve(__dirname,'..','..','site-content.html'));
  assert.throws(()=>audit(Buffer.concat([bytes,Buffer.from(' ')])),/fingerprint|Aborting/i);
});
test('requires 414 content-bearing resources, refuses source expressions',()=>{
  assert.throws(()=>inspectContents([]),/Unexpected/);
  const source=Array.from({length:414},()=>'{id:"x",content:callFunction()}');
  assert.throws(()=>inspectContents(source),/literal/);
});
