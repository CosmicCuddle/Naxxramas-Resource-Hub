'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {enclosingParts,property,kind} = require('../tools/audit-legacy-shape.cjs');

test('lexical scan counts direct records but ignores commas and braces inside strings', () => {
  const source = '{resources:[{id:1,title:"A, B",body:"{not structural}"},{id:2,title:"Second"}],other:["a,b","x"]}';
  const root = enclosingParts(source,0);
  assert.equal(root.segments.length,2);
  const first = property(source,root.segments[0]);
  assert.equal(first.key,'resources');
  assert.equal(first.type,'array');
  const inner = enclosingParts(source,first.valueStart);
  assert.equal(inner.segments.length,2);
  assert.equal(kind(source,inner.segments[0][0]),'object');
});
test('scanner ignores comments and nested function argument commas', () => {
  const src = '{resources: [{id:1/* ,ignored*/},{id:2}], meta: function(x,y){return x+y;}}';
  const root = enclosingParts(src,0);
  assert.equal(root.segments.length,2);
  assert.equal(property(src,root.segments[0]).key,'resources');
  assert.equal(enclosingParts(src,src.indexOf('[',property(src,root.segments[0]).valueStart)).segments.length,2);
});
test('accepts quoted keys without revealing their contents', () => {
  const source = '{"resources":[], "dungeons":{ "resources": [{}] }, "secretKey":"PRIVATE-NEVER-PRINT"}';
  const properties = enclosingParts(source,0).segments.map(x=>property(source,x));
  assert.equal(properties[0].key,'resources');
  assert.equal(properties[1].key,'dungeons');
  assert.equal(properties[2].key,'secretKey');
});
test('mismatched syntax and unterminated strings fail closed', () => {
  assert.throws(()=>enclosingParts('{resources:[}',0));
  assert.throws(()=>enclosingParts('{a:"broken}',0));
});
