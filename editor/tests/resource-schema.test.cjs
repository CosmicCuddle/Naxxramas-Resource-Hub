'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {summarize,stringValue}=require('../tools/audit-resource-schema.cjs');

test('decoded identifiers are compared by value and never logged',()=>{
  assert.equal(stringValue('"hello"'),'hello');
  assert.equal(stringValue("'hello'"),'hello');
  assert.equal(stringValue('"a\\nline"'),'a\nline');
  assert.equal(stringValue('42'),'42');
  assert.equal(stringValue('"unterminated'),null);
  assert.equal(stringValue('getPrivateIdentifier()'),null);
});

test('full source schema preserves all records and accounts for every property',()=>{
  const file=path.resolve(__dirname,'..','..','site-content.html');
  const report=summarize(fs.readFileSync(file));
  assert.equal(report.originalSourceVerified,true);
  assert.equal(report.recordsInspected,414);
  for(const key of ['id','title','section','classes','content'])
    assert.equal(report.resourceFieldOccurrences[key],414);
  assert.equal(report.idFieldPresent,414);
  assert.equal(report.unknownFieldOccurrences>0,true);
  assert.equal(report.fieldsCouldNotBeParsed,0);
  assert.equal(report.sourceCodeEvaluated,false);
  assert.ok(!Object.hasOwn(report,'resourceValues'));
  assert.ok(!Object.hasOwn(report,'decodedIds'));
  assert.ok(!Object.hasOwn(report,'classNames'));
});
