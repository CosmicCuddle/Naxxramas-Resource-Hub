'use strict';
/*
 * TEMPORARY-ONLY split-to-files rehearsal for the original Resource Hub.
 *
 * The script never exports an artifact, never writes into the repository, and
 * deletes its private temporary directory after verifying all 414 fragments.
 * File names are deliberately numeric: IDs and resource contents stay private.
 *
 * This is NOT the user-facing export format and cannot publish changes.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const {splitInMemory} = require('./check-legacy-roundtrip.cjs');

const RECORD_COUNT = 414;
const ORIGINAL_SOURCE_SHA256 = '34455f6d901c538e2491a8c16681692e4c02d918b1984d7d0ba081aacb1049e8';
const HASH = /^[a-f0-9]{64}$/;
function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}
function resourcePath(index) {
  if (!Number.isInteger(index) || index < 0 || index >= RECORD_COUNT)
    throw new Error('Resource position is outside the approved baseline.');
  return path.join('resources', String(index + 1).padStart(4, '0') + '.fragment');
}
function writeOwned(root, relative, value) {
  // Paths are determined by this module only, never by source metadata or IDs.
  const destination = path.join(root, relative);
  fs.writeFileSync(destination, value, {flag:'wx', mode:0o600});
  return sha256(Buffer.isBuffer(value) ? value : Buffer.from(value, 'utf8'));
}
function readVerified(root, relative, expectedHash) {
  if (!HASH.test(expectedHash))
    throw new Error('Invalid package manifest checksum.');
  const filename = path.join(root, relative);
  const info = fs.lstatSync(filename);
  if (!info.isFile() || info.isSymbolicLink())
    throw new Error('Expected a regular package file.');
  const value = fs.readFileSync(filename);
  if (sha256(value) !== expectedHash)
    throw new Error('A package fragment is missing, changed, or reordered.');
  return value;
}
function createTemporaryPackage(root, original) {
  if (!Buffer.isBuffer(original)) throw new Error('Expected complete original bytes.');
  const split = splitInMemory(original);
  if (split.records.length !== RECORD_COUNT || split.separators.length !== RECORD_COUNT + 1)
    throw new Error('Cannot package a partial record collection.');
  fs.mkdirSync(path.join(root, 'resources'), {mode:0o700});
  fs.mkdirSync(path.join(root, 'layout'), {mode:0o700});

  // These two files preserve every byte outside the resources array, including
  // image data, scripts, admin UI, and the later window variable assignment.
  const prefix = split.source.slice(0, split.arrayBegin);
  const suffix = split.source.slice(split.arrayEnd);
  const layout = JSON.stringify(split.separators);
  const manifest = {
    format:'naxx-legacy-temporary-package-v1',
    recordCount:RECORD_COUNT,
    sourceLength:original.length,
    sourceSha256:sha256(original),
    files:{
      prefix:writeOwned(root,'layout/prefix.utf8',prefix),
      suffix:writeOwned(root,'layout/suffix.utf8',suffix),
      separators:writeOwned(root,'layout/separators.json',layout)
    },
    resources:split.records.map((record, index) => writeOwned(root,resourcePath(index),record))
  };
  writeOwned(root, 'manifest.json', JSON.stringify(manifest, null, 2) + '\n');
  return manifest;
}
function reconstructTemporaryPackage(root) {
  const manifestFile = path.join(root, 'manifest.json');
  if (!fs.lstatSync(manifestFile).isFile())
    throw new Error('Invalid package manifest type.');
  const manifest = JSON.parse(fs.readFileSync(manifestFile,'utf8'));
  if (!manifest || manifest.format !== 'naxx-legacy-temporary-package-v1' ||
      manifest.recordCount !== RECORD_COUNT || !Array.isArray(manifest.resources) ||
      manifest.resources.length !== RECORD_COUNT ||
      manifest.sourceSha256 !== ORIGINAL_SOURCE_SHA256 ||
      !manifest.files || manifest.sourceLength !== 30976969)
    throw new Error('Incomplete or unexpected package manifest.');

  const prefix = readVerified(root,'layout/prefix.utf8',manifest.files.prefix);
  const suffix = readVerified(root,'layout/suffix.utf8',manifest.files.suffix);
  const encodedSeparators = readVerified(root,'layout/separators.json',manifest.files.separators);
  const separators = JSON.parse(encodedSeparators.toString('utf8'));
  if (!Array.isArray(separators) || separators.length !== RECORD_COUNT + 1 ||
      separators.some(value => typeof value !== 'string'))
    throw new Error('Incorrect resource separator layout.');
  let arraySource = separators[0];
  for (let index = 0; index < RECORD_COUNT; index++) {
    const fragment = readVerified(root,resourcePath(index),manifest.resources[index]);
    arraySource += fragment.toString('utf8') + separators[index+1];
  }
  const complete = Buffer.concat([prefix,Buffer.from(arraySource,'utf8'),suffix]);
  if (complete.length !== manifest.sourceLength || sha256(complete) !== manifest.sourceSha256)
    throw new Error('Rebuilt site does not exactly match the original hash.');
  return complete;
}
function withTemporaryPackage(original, callback) {
  if (typeof callback !== 'function')
    throw new Error('A synchronous local-only validation callback is required.');
  // A private directory under the OS temporary location, outside Git checkout.
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'naxx-legacy-rehearsal-'));
  fs.chmodSync(root, 0o700);
  try {
    const manifest = createTemporaryPackage(root,original);
    return callback(root,manifest);
  } finally {
    fs.rmSync(root,{recursive:true,force:true});
  }
}
function rehearse(original) {
  let temporaryRoot;
  const report=withTemporaryPackage(original,(root,manifest)=>{
    temporaryRoot=root;
    const rebuilt = reconstructTemporaryPackage(root);
    if (!rebuilt.equals(original))
      throw new Error('The reconstructed temporary source differs from the original.');
    return {
      format:'naxx-legacy-temporary-package-test-v1',
      rehearsalOnly:true,siteFilesChanged:false,
      temporaryPackagePublished:false,
      separatelyWrittenResourceFragments:manifest.recordCount,
      originalByteCount:original.length,reconstructedByteCount:rebuilt.length,
      byteExactMatch:true,matchingSha256:sha256(rebuilt)
    };
  });
  if(!temporaryRoot || fs.existsSync(temporaryRoot))
    throw new Error('Temporary package cleanup was not confirmed.');
  report.temporaryFolderDeletedAfterTest=true;
  report.note='Generated content existed only in a private temporary directory, then was deleted.';
  return report;
}
if (require.main === module) {
  try {
    const input = fs.readFileSync(path.resolve(__dirname,'..','..','site-content.html'));
    process.stdout.write(JSON.stringify(rehearse(input),null,2)+'\n');
  } catch (_) {
    process.stderr.write('Temporary package rehearsal stopped safely. No source content was printed.\n');
    process.exitCode=1;
  }
}
module.exports = {withTemporaryPackage,reconstructTemporaryPackage,rehearse,resourcePath};
