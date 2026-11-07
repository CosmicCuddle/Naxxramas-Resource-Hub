'use strict';
/* Physical original-source proof for experimental read-only revision reader.
 * No repository writes, network, GitHub credentials or publication.
 * Any "trusted" expected SHA here is independently recomputed from a
 * verified local original, not copied from the untrusted candidate manifest.
 */
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const crypto=require('node:crypto');
const {webcrypto}=crypto;
const {splitInMemory,restoreInMemory}=
  require('../tools/check-legacy-roundtrip.cjs');
const {makeManifest}=require('../tools/rehearse-versioned-resource-sessions.cjs');
const {recordPath}=require('../tools/rehearse-resource-only-overlay.cjs');
const {replaceTitleInRecord}=require('../tools/rehearse-title-edit.cjs');
const {replaceContentInRecord}=require('../tools/rehearse-content-edit.cjs');
const reader=require('../revision-source-reader.js');
const anchor=fs.readFileSync(path.resolve(__dirname,'..','..','site-content.html'));
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
assert.equal(hash(anchor),reader.ANCHOR);
const split=splitInMemory(anchor);
const paths=Array.from({length:414},(_,i)=>recordPath(i));
const shell={
  prefix:split.source.slice(0,split.arrayBegin),
  suffix:split.source.slice(split.arrayEnd),
  separators:split.separators.slice()
};
const shellHash=hash(Buffer.from(JSON.stringify([
  shell.prefix,shell.suffix,shell.separators
])));
function snapshot(records,revision,parent){
  return {manifest:makeManifest(split,records,revision,parent),
    shell:{prefix:shell.prefix,suffix:shell.suffix,
      separators:shell.separators.slice()},
    fragments:records.slice()};
}
function trust(revision,sourceSha,parent){
  return {expectedRevision:revision,expectedSourceSha256:sourceSha,
    expectedParentSha256:parent,expectedShellSha256:shellHash,
    expectedRecordPaths:paths.slice()};
}
function independentlyRebuiltSha(records){
  return hash(restoreInMemory(split,records));
}
test('read-only verifier accepts actual unchanged original 31 MB source at revision zero',async()=>{
  const original=snapshot(split.records,0,null);
  const originalBefore=original.manifest.sourceSha256;
  const checked=await reader.inspect(original,trust(0,reader.ANCHOR,null),webcrypto);
  assert.equal(checked.sourceSha256,reader.ANCHOR);
  assert.equal(checked.sourceBytes,anchor.length);
  assert.equal(checked.resourcesVerified,414);
  assert.equal(checked.shellMatched,true);
  assert.equal(checked.fullSourceMatched,true);
  assert.equal(checked.publishable,false);
  assert.equal(checked.githubReady,false);
  assert.equal(checked.filesWritten,0);
  assert.equal(original.manifest.sourceSha256,originalBefore);
});
test('first and second revisions reopen with intact source shell and 412 unrelated records',async()=>{
  const firstRecords=split.records.slice();
  firstRecords[0]=replaceTitleInRecord(firstRecords[0],
    'First fictional editing session').record;
  const s1=independentlyRebuiltSha(firstRecords);
  assert.notEqual(s1,reader.ANCHOR);
  const first=snapshot(firstRecords,1,reader.ANCHOR);
  const firstVerified=await reader.inspect(first,
    trust(1,s1,reader.ANCHOR),webcrypto);
  assert.equal(firstVerified.revision,1);
  assert.equal(firstVerified.sourceSha256,s1);

  const secondRecords=firstRecords.slice();
  secondRecords[413]=replaceContentInRecord(secondRecords[413],
    'Second fictional session.\n\nMultiline source retained.').record;
  const s2=independentlyRebuiltSha(secondRecords);
  assert.notEqual(s2,s1);
  const second=snapshot(secondRecords,2,s1);
  const secondVerified=await reader.inspect(second,trust(2,s2,s1),webcrypto);
  assert.equal(secondVerified.revision,2);
  assert.equal(secondVerified.sourceSha256,s2);
  assert.equal(secondRecords[0],firstRecords[0]);
  assert.equal(secondRecords[0]===split.records[0],false);
  assert.equal(secondRecords[413]===split.records[413],false);
  for(let i=1;i<413;i++)assert.equal(secondRecords[i],split.records[i]);
  assert.equal(hash(anchor),reader.ANCHOR,
    'No original source file was ever modified');
  assert.equal(restoreInMemory(split,split.records).equals(anchor),true);

  await assert.rejects(
    reader.inspect(first,trust(2,s2,s1),webcrypto),
    /stale|trusted expectations/i);
  await assert.rejects(
    reader.inspect(second,trust(1,s1,reader.ANCHOR),webcrypto),
    /stale|trusted expectations/i);
});
test('resource checksum, shell seal and complete source checksum fail closed',async()=>{
  const source=snapshot(split.records,0,null),expected=trust(0,reader.ANCHOR,null);
  const damagedRecord=snapshot(split.records,0,null);
  damagedRecord.fragments[0]+=' ';
  await assert.rejects(reader.inspect(damagedRecord,expected,webcrypto),
    /Resource checksum mismatch/);

  const tamperedShell=snapshot(split.records,0,null);
  tamperedShell.shell.suffix+=' ';
  await assert.rejects(reader.inspect(tamperedShell,expected,webcrypto),
    /non-resource website shell/);

  const wrongBody=snapshot(split.records,0,null);
  wrongBody.manifest.sourceBytes++;
  await assert.rejects(reader.inspect(wrongBody,expected,webcrypto),
    /Complete source length or SHA-256/);

  const forged=snapshot(split.records,0,null);
  forged.fragments[0]+=' ';
  forged.manifest.resources[0].sha256=hash(Buffer.from(forged.fragments[0]));
  // Even a self-consistent changed per-record hash must not bypass the
  // independently trusted full runtime checksum.
  await assert.rejects(reader.inspect(forged,expected,webcrypto),
    /Complete source length or SHA-256/);
  assert.equal(source.manifest.sourceSha256,reader.ANCHOR);
});
test('wrong parent, stale revision and untrusted record path are refused before hashing',async()=>{
  const valid=snapshot(split.records,0,null),expected=trust(0,reader.ANCHOR,null);
  const unknownPath=snapshot(split.records,0,null);
  unknownPath.manifest.resources[0].path='../escape.fragment';
  await assert.rejects(reader.inspect(unknownPath,expected,webcrypto),
    /untrusted resource path/);
  const reordered=snapshot(split.records,0,null);
  reordered.manifest.resources[0].index=1;
  await assert.rejects(reader.inspect(reordered,expected,webcrypto),
    /untrusted resource path/);
  const missing=snapshot(split.records,0,null);
  missing.manifest.resources.pop();
  await assert.rejects(reader.inspect(missing,expected,webcrypto),
    /Invalid or unsupported versioned source manifest/);
  const wrongRevision=trust(1,reader.ANCHOR,'f'.repeat(64));
  await assert.rejects(reader.inspect(valid,wrongRevision,webcrypto),
    /stale|trusted expectations/);
  const illegalParent=snapshot(split.records,0,null);
  illegalParent.manifest.parentSha256='a'.repeat(64);
  await assert.rejects(reader.inspect(illegalParent,expected,webcrypto),
    /Invalid or unsupported versioned source manifest/);
  const missingTrust={...expected};
  delete missingTrust.expectedShellSha256;
  await assert.rejects(reader.inspect(valid,missingTrust,webcrypto),
    /separate, complete trusted revision/);
  const extraField=snapshot(split.records,0,null);
  extraField.manifest.unexpected='untrusted';
  await assert.rejects(reader.inspect(extraField,expected,webcrypto),
    /Invalid or unsupported versioned source manifest/);
});
test('the verifier has no source-write, network or GitHub publishing path',()=>{
  const text=fs.readFileSync(path.join(rootPath(),'editor',
    'revision-source-reader.js'),'utf8');
  for(const token of ['fetch(', 'XMLHttpRequest','sendBeacon(',
    'writeFileSync(', 'localStorage', 'github.com/', 'git push'])
    assert.equal(text.includes(token),false,
      'A private read-only verifier must not implement '+token);
});
function rootPath(){return path.resolve(__dirname,'..','..');}
