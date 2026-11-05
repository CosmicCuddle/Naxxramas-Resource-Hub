'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {splitInMemory, restoreInMemory, makeReport} = require('../tools/check-legacy-roundtrip.cjs');

const original = fs.readFileSync(path.resolve(__dirname, '..', '..', 'site-content.html'));
const split = splitInMemory(original);

test('414 existing resource fragments rebuild the original HTML byte-for-byte', () => {
  assert.equal(split.records.length, 414);
  assert.equal(split.separators.length, 415);
  assert.ok(split.records.every(chunk => chunk.trim().startsWith('{') && chunk.trim().endsWith('}')));
  const rebuilt = restoreInMemory(split);
  assert.equal(rebuilt.length, original.length);
  assert.ok(rebuilt.equals(original));
});

test('every ordering or content change is detectable before release', () => {
  const reordered = split.records.slice();
  [reordered[0], reordered[1]] = [reordered[1], reordered[0]];
  const result = restoreInMemory(split, reordered);
  assert.ok(!result.equals(original), 'Reordered resource records must not be accepted as identical.');
  const altered = split.records.slice();
  altered[0] += ' ';
  assert.ok(!restoreInMemory(split, altered).equals(original),
    'Whitespace changes should not pass a byte-exact round trip.');
});

test('missing resource records are rejected instead of silently dropped', () => {
  assert.throws(() => restoreInMemory(split, split.records.slice(0, -1)), /Incomplete resource set/);
});

test('read-only round-trip summary prints hashes and counts but no record values', () => {
  const report = makeReport(original);
  assert.equal(report.resourcesSeparatedInMemory, 414);
  assert.equal(report.completeHtmlRebuiltByteForByte, true);
  assert.equal(report.originalSha256, report.restoredSha256);
  assert.equal(report.writesPerformed, 0);
  assert.equal(report.restoredByteLength, 30976969);
  assert.ok(!JSON.stringify(report).includes(split.records[0].trim().slice(0, 120)));
});
