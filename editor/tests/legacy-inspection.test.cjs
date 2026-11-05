'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const {inspectSource} = require('../tools/inspect-legacy.cjs');

test('read-only inventory reports counts and hashes, never the source content', () => {
  const secret = 'PRIVATE-MARKER-DO-NOT-EXPOSE';
  const content = Buffer.from('<style></style>\n<script>const DATA={resources:[]};const hidden="' +
    secret + '";const sample="data:image/png;base64,AA==";</script>', 'utf8');
  const result = inspectSource(content);
  assert.equal(result.sourceByteLength, content.length);
  assert.equal(result.htmlStyleOpenTags, 1);
  assert.equal(result.htmlScriptOpenTags, 1);
  assert.equal(result.embeddedDataImagePrefixOccurrences, 1);
  assert.equal(result.candidateDataAssignmentMarkers, 1);
  assert.equal(result.candidateResourcesKeys, 1);
  assert.equal(result.resourceRecordsVerified, false);
  assert.equal(result.resourceRecordsCount, null);
  assert.equal(result.sha256, crypto.createHash('sha256').update(content).digest('hex'));
  assert.ok(!JSON.stringify(result).includes(secret));
  assert.ok(!JSON.stringify(result).includes('data:image/png;base64,AA=='));
});

test('rejects non-buffer input', () => {
  assert.throws(() => inspectSource('private raw HTML'));
});
