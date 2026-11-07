'use strict';
/*
 * In-memory, read-only reconstruction test for original resources.
 *
 * No files are emitted, no website JavaScript is evaluated, and no resource
 * values, IDs, URLs, images, or individual hashes are printed.
 * This is a byte-preservation feasibility test — NOT a migration/export.
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {inspectSource, MAIN_BASELINE_BLOB_SHA} = require('./inspect-legacy.cjs');
const {enclosingParts, property} = require('./audit-legacy-shape.cjs');

function space(text, i) {
  while (i < text.length && /\s/.test(text[i])) i++;
  return i;
}
function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}
function findSourceArray(bytes) {
  if (!Buffer.isBuffer(bytes)) throw new Error('Source must be a Buffer.');
  const fingerprint = inspectSource(bytes);
  if (fingerprint.gitBlobSha !== MAIN_BASELINE_BLOB_SHA)
    throw new Error('Unexpected original file fingerprint. Aborting before scanning.');
  const source = bytes.toString('utf8');
  if (!Buffer.from(source, 'utf8').equals(bytes))
    throw new Error('Original file cannot be reconstructed losslessly from UTF-8.');

  // The verified DATA initializer clones a named window property; never eval.
  const patterns = [...source.matchAll(/\b(?:const|let|var)\s+DATA\s*=\s*JSON\s*\.\s*parse\s*\(\s*JSON\s*\.\s*stringify\s*\(\s*(window\s*\.\s*[A-Za-z_$][\w$]*)\s*\)\s*\)/g)];
  if (patterns.length !== 1)
    throw new Error('Expected exactly one verified DATA clone expression.');
  const clone = patterns[0];
  const name = clone[1].replace(/\s/g, '');
  const candidates = [];
  // Only accept a direct object assignment before the DATA expression.
  for (let i = source.indexOf(name); i >= 0 && i < clone.index; i = source.indexOf(name, i + name.length)) {
    const after = space(source, i + name.length);
    if (source[after] !== '=' || source[after + 1] === '=' || source[after + 1] === '>') continue;
    const value = space(source, after + 1);
    if (source[value] === '{') candidates.push(value);
  }
  if (candidates.length !== 1)
    throw new Error('Expected exactly one pre-clone DATA object assignment.');

  const root = enclosingParts(source, candidates[0]);
  if (root.segments.length !== 27)
    throw new Error('The original DATA object structure differs from the audit.');
  const matches = root.segments.map(range => property(source, range))
    .filter(field => field.key === 'resources' && field.type === 'array');
  if (matches.length !== 1)
    throw new Error('Expected one original resources array.');
  const arrayBegin = space(source, matches[0].valueStart);
  const array = enclosingParts(source, arrayBegin);
  if (array.segments.length !== 414)
    throw new Error('Original resource record count differs from the audit.');
  array.segments.forEach(range => {
    const recordBegin = space(source, range[0]);
    if (source[recordBegin] !== '{')
      throw new Error('Expected a resource object literal.');
    const record = enclosingParts(source, recordBegin);
    if (source.slice(record.close + 1, range[1]).trim())
      throw new Error('Unexpected expression after resource object.');
  });
  return {source, bytes, arrayBegin, arrayEnd:array.close + 1, ranges:array.segments};
}
function splitInMemory(bytes) {
  const found = findSourceArray(bytes);
  const {source, arrayBegin, arrayEnd, ranges} = found;
  const records = [], separators = [source.slice(arrayBegin, ranges[0][0])];
  for (let i = 0; i < ranges.length; i++) {
    const [begin, end] = ranges[i];
    records.push(source.slice(begin, end));
    separators.push(source.slice(end, i + 1 < ranges.length ? ranges[i + 1][0] : arrayEnd));
  }
  if (separators.length !== records.length + 1)
    throw new Error('Resource separators do not match the array size.');
  return {source, bytes, arrayBegin, arrayEnd, records, separators};
}
function restoreInMemory(split, records = split.records) {
  if (!split || !Array.isArray(records) || records.length !== split.separators.length - 1)
    throw new Error('Incomplete resource set. Nothing reconstructed.');
  let joined = split.separators[0];
  for (let i = 0; i < records.length; i++)
    joined += records[i] + split.separators[i + 1];
  return Buffer.from(
    split.source.slice(0, split.arrayBegin) + joined + split.source.slice(split.arrayEnd),
    'utf8'
  );
}
function makeReport(bytes) {
  const split = splitInMemory(bytes);
  const rebuilt = restoreInMemory(split);
  const exact = rebuilt.equals(bytes);
  if (!exact) throw new Error('Byte-preserving resource reconstruction FAILED.');
  return {
    format:'naxx-legacy-roundtrip-v1',
    readOnly:true, baselineVerified:true, dataEvaluated:false,
    resourcesSeparatedInMemory:split.records.length,
    allOriginalResourceFragmentsRetained:split.records.every(x=>x.trim().startsWith('{')),
    recordDelimiterSectionsRetained:split.separators.length,
    completeHtmlRebuiltByteForByte:exact,
    originalByteLength:bytes.length, restoredByteLength:rebuilt.length,
    originalSha256:sha256(bytes), restoredSha256:sha256(rebuilt),
    writesPerformed:0,
    note:'Proof of an in-memory structural round trip, not an editable format, deployment, or runtime equivalence proof.'
  };
}
if (require.main === module) {
  try {
    const filename = path.resolve(__dirname, '..', '..', 'site-content.html');
    process.stdout.write(JSON.stringify(makeReport(fs.readFileSync(filename)), null, 2) + '\n');
  } catch (_) {
    process.stderr.write('Legacy round-trip check stopped safely; no resource content was printed.\n');
    process.exitCode = 1;
  }
}
module.exports = {findSourceArray,splitInMemory,restoreInMemory,makeReport};
