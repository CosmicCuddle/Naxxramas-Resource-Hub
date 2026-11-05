'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {readJsString,summarizeData,inspectJsonInitializer}=require('../tools/audit-legacy-json.cjs');

test('safely decodes escaped JSON in a JavaScript single-quoted literal',()=>{
  const sample = "'{\\\"resources\\\":[{\\\"id\\\":1,\\\"title\\\":\\\"Book\\\"}]}'";
  const decoded=readJsString(sample,0);
  assert.equal(decoded.value,'{"resources":[{"id":1,"title":"Book"}]}');
  assert.equal(decoded.end,sample.length);
  assert.deepEqual(JSON.parse(decoded.value).resources.map(x=>x.id),[1]);
});
test('does not evaluate template interpolation or incomplete strings',()=>{
  const template=String.fromCharCode(96);
  assert.equal(readJsString(template+'hello $'+'{process.env.SECRET}'+template,0),null);
  assert.equal(readJsString("'unfinished",0),null);
  assert.equal(readJsString("'\\8'",0),null);
});
test('aggregates only preapproved key names and counts duplicate/missing IDs',()=>{
  const data={resources:[{id:1,title:'Hello',url:'https://example.test',privateToken:'SECRET'},
    {id:1,title:'Duplicate'},{title:'No ID'}],superPrivate:'HIDDEN'};
  const output=summarizeData(data);
  assert.equal(output.rootType,'object');
  assert.equal(output.candidateCollections.length,1);
  assert.equal(output.candidateCollections[0].itemCount,3);
  assert.equal(output.candidateCollections[0].duplicateIdCount,1);
  assert.equal(output.candidateCollections[0].objectRecordMissingIdCount,1);
  assert.equal(output.candidateCollections[0].knownFieldOccurrences.title,3);
  assert.equal(output.unknownRootKeyCount,1);
  const text=JSON.stringify(output);
  assert.ok(!text.includes('SECRET')&&!text.includes('HIDDEN')&&!text.includes('example.test'));
});
test('baseline guard rejects arbitrary input rather than parsing it',()=>{
  assert.throws(()=>inspectJsonInitializer(Buffer.from('const DATA=JSON.parse("PRIVATE")')));
});
