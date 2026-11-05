'use strict';
/*
 * Read-only site-content.html inventory.
 * Prints ONLY fixed aggregate fields and hashes. Never outputs source text,
 * extracted URLs, tokens, credentials, account data or resource descriptions.
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const MAIN_BASELINE_BLOB_SHA = '71ab9f2bf4cf12282fcbe135f7ec787805715b62';

function occurrences(content, regex) {
  return Array.from(content.matchAll(regex)).length;
}
function inspectSource(bytes) {
  if (!Buffer.isBuffer(bytes)) throw new Error('Expected a local Buffer.');
  const text = bytes.toString('utf8');
  const blobHeader = Buffer.from('blob ' + bytes.length + '\0', 'utf8');
  const gitBlobSha = crypto.createHash('sha1').update(blobHeader).update(bytes).digest('hex');
  return {
    reportFormat: 'naxx-legacy-inspection-v1',
    source: 'site-content.html',
    readOnly: true,
    sourceByteLength: bytes.length,
    sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
    gitBlobSha,
    equalsRecordedMainBaseline: gitBlobSha === MAIN_BASELINE_BLOB_SHA,
    approximateLineCount: occurrences(text, /\n/g) + 1,
    htmlScriptOpenTags: occurrences(text, /<script\b/gi),
    htmlStyleOpenTags: occurrences(text, /<style\b/gi),
    embeddedDataImagePrefixOccurrences: occurrences(text, /data:image\/(?:png|jpe?g|gif|webp);base64,/gi),
    candidateDataAssignmentMarkers: occurrences(text, /\b(?:const|let|var)\s+DATA\s*=/g),
    candidateResourcesKeys: occurrences(text, /\bresources\s*:/g),
    resourceRecordsCount: null,
    resourceRecordsVerified: false,
    note: 'Marker occurrences are not resource counts. No source code was evaluated and no assets were extracted.'
  };
}
function inspectFile() {
  // Deliberately fixed path: this utility never accepts remote URLs or reads
  // private application or server directories.
  const source = path.resolve(__dirname, '..', '..', 'site-content.html');
  const bytes = fs.readFileSync(source);
  return inspectSource(bytes);
}
if (require.main === module) {
  // No file writes or account details. Output is numeric aggregates and hashes.
  process.stdout.write(JSON.stringify(inspectFile(), null, 2) + '\n');
}
module.exports = { inspectSource, MAIN_BASELINE_BLOB_SHA };
