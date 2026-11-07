'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {inventory,validSignature}=require('../tools/audit-legacy-media.cjs');

test('header checks identify declared PNG, GIF and WebP signatures',()=>{
  assert.equal(validSignature('png',Buffer.from('89504e470d0a1a0a','hex')),true);
  assert.equal(validSignature('png',Buffer.from('00','hex')),false);
  assert.equal(validSignature('jpeg',Buffer.from('ffd8ff','hex')),true);
  assert.equal(validSignature('gif',Buffer.from('GIF89a','ascii')),true);
  assert.equal(validSignature('webp',Buffer.concat([
    Buffer.from('RIFF','ascii'),Buffer.alloc(4),Buffer.from('WEBP','ascii')
  ])),true);
});
test('original website images stay separate from the resource records',()=>{
  const file=path.resolve(__dirname,'..','..','site-content.html');
  const result=inventory(fs.readFileSync(file));
  assert.equal(result.sourceBaselineVerified,true);
  assert.equal(result.readOnly,true);
  assert.equal(result.imageMarkersFound,95);
  assert.equal(result.distinctImagePayloadsByHash,71);
  assert.equal(result.validDeclaredImageHeaders,95);
  assert.equal(result.completeBase64RoundTrips,95);
  assert.equal(result.invalidOrUnrecognizedHeaders,0);
  assert.equal(result.totalDecodedImageBytes,19598519);
  assert.equal(result.mimeCounts.png,47);
  assert.equal(result.mimeCounts.jpeg,32);
  assert.equal(result.mimeCounts.webp,16);
  assert.equal(result.originalPositions.withinResources,0);
  assert.equal(result.resourcesWithMarkerOccurrences,0);
  assert.equal(result.imageMarkersFound,result.originalPositions.beforeResources+
    result.originalPositions.withinResources+result.originalPositions.afterResources);
  assert.ok(result.distinctImagePayloadsByHash<=result.imageMarkersFound);
  assert.ok(!Object.hasOwn(result,'imageData'));
});
