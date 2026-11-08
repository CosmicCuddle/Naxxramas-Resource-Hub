'use strict';
/*
 * Pinned original LOCAL Git blob -> independently derived trust -> verified
 * resource draft. The source website is never written or published.
 */
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {webcrypto}=require('node:crypto');
const {originalTrustFromPinnedCheckout}=
  require('../tools/prepare-pinned-original-revision-trust.cjs');
const {runGit,getBlob}=require('../tools/rehearse-local-git-head-preflight.cjs');
const {splitBase,plan}=require('../tools/rehearse-versioned-resource-sessions.cjs');
const {SOURCE_SHA}=require('../tools/audit-source-storage-budget.cjs');
const reader=require('../revision-source-reader.js');
const draftReview=require('../revision-draft-review.js');
const ROOT=path.resolve(__dirname,'..','..');
const HEAD=runGit(ROOT,['rev-parse','--verify','HEAD^{commit}']).trim();

test('an independently pinned original Git blob can supply revision-zero browser trust',async()=>{
  const result=originalTrustFromPinnedCheckout(ROOT,HEAD);
  const {snapshot,trust,evidence}=result;
  assert.equal(evidence.pinnedLocalGitCommit,HEAD);
  assert.equal(evidence.sourceFromGitBlob,true);
  assert.equal(evidence.remoteGitHubTipAuthenticated,false);
  assert.equal(evidence.futureRevisionAuthenticated,false);
  assert.equal(evidence.sourceLayoutApproved,false);
  assert.equal(evidence.readOnly,true);
  assert.equal(evidence.canApply,false);
  assert.equal(evidence.canPublish,false);
  assert.equal(evidence.gitHubWrites,0);
  assert.equal(evidence.filesWritten,0);
  assert.equal(evidence.fullSourceBytesVerified,30976969);
  assert.equal(trust.expectedRevision,0);
  assert.equal(trust.expectedSourceSha256,SOURCE_SHA);
  assert.equal(trust.expectedParentSha256,null);
  assert.equal(trust.expectedRecordPaths.length,414);
  assert.equal(snapshot.manifest.revision,0);
  assert.equal(snapshot.manifest.sourceSha256,SOURCE_SHA);
  assert.equal(snapshot.fragments.length,414);
  assert.equal(snapshot.shell.separators.length,415);
  const inspection=await reader.inspect(snapshot,trust,webcrypto);
  assert.equal(inspection.sourceSha256,SOURCE_SHA);
  assert.equal(inspection.sourceBytes,30976969);
  assert.equal(inspection.resourcesVerified,414);
  assert.equal(inspection.fullSourceMatched,true);
  assert.equal(inspection.filesWritten,0);
});

test('pinned original Git trust lets a fictional first draft be prepared, not published',async()=>{
  const {snapshot,trust}=originalTrustFromPinnedCheckout(ROOT,HEAD);
  const changes=[{index:0,title:'Fictional pinned-Git first resource title'}];
  const prepared=await draftReview.prepare(snapshot,trust,webcrypto,changes);
  assert.equal(prepared.revision,0);
  assert.equal(prepared.sourceSha256,SOURCE_SHA);
  assert.equal(prepared.sourceBaselineSha256,SOURCE_SHA);
  assert.equal(prepared.changes.length,1);
  assert.equal(prepared.changes[0].index,0);
  assert.equal(prepared.changes[0].expectedSha256,
    snapshot.manifest.resources[0].sha256);
  const original=getBlob(ROOT,HEAD,'site-content.html');
  const split=splitBase(original);
  const proposed=plan({split,records:snapshot.fragments,
    manifest:snapshot.manifest},prepared);
  assert.equal(proposed.manifest.revision,1);
  assert.equal(proposed.manifest.parentSha256,SOURCE_SHA);
  assert.notEqual(proposed.manifest.sourceSha256,SOURCE_SHA);
  assert.equal(proposed.indices.length,1);
  for(let i=1;i<414;i++)
    assert.equal(proposed.newRecords[i],snapshot.fragments[i]);
  assert.throws(()=>plan({split,records:proposed.newRecords,
    manifest:proposed.manifest},prepared),/Stale save/);
  assert.equal(getBlob(ROOT,HEAD,'site-content.html').equals(original),true);
});

test('pinned original trust does not silently authenticate revision one or forged original',async()=>{
  const {snapshot,trust}=originalTrustFromPinnedCheckout(ROOT,HEAD);
  const revisionOne={
    manifest:{...snapshot.manifest,
      revision:1,parentSha256:SOURCE_SHA,
      sourceSha256:'a'.repeat(64)},
    shell:snapshot.shell,fragments:snapshot.fragments
  };
  await assert.rejects(reader.inspect(revisionOne,trust,webcrypto),
    /stale|trusted expectations/i);
  await assert.rejects(draftReview.prepare(revisionOne,trust,webcrypto,
    [{index:0,title:'Not trusted first revision'}]),
    /stale|trusted expectations/i);
  const forged={
    manifest:{...snapshot.manifest,
      resources:snapshot.manifest.resources.map(r=>({...r}))},
    shell:snapshot.shell,fragments:snapshot.fragments.slice()
  };
  forged.fragments[0]+=' ';
  await assert.rejects(reader.inspect(forged,trust,webcrypto),
    /Resource checksum mismatch/i);
  const untrusted={
    ...trust,expectedSourceSha256:'b'.repeat(64)
  };
  await assert.rejects(reader.inspect(snapshot,untrusted,webcrypto),
    /stale|trusted expectations/i);
});

test('wrong pinned checkout, absent commit and malformed input fail closed',()=>{
  assert.throws(()=>originalTrustFromPinnedCheckout(ROOT,'0'.repeat(40)),
    /Checkout commit has drifted|local Git object or ref/i);
  assert.throws(()=>originalTrustFromPinnedCheckout(ROOT,'not-a-commit'),
    /separately supplied, exact local Git commit/i);
  assert.throws(()=>originalTrustFromPinnedCheckout(ROOT,''),
    /separately supplied, exact local Git commit/i);
  assert.throws(()=>originalTrustFromPinnedCheckout(ROOT,null),
    /separately supplied, exact local Git commit/i);
  assert.throws(()=>originalTrustFromPinnedCheckout('/missing-naxx-repo',HEAD),
    /local Git object|checkout commit/i);
});

test('baseline trust builder is pure local-read and cannot authenticate a remote or publish',()=>{
  const content=fs.readFileSync(path.join(ROOT,'editor','tools',
    'prepare-pinned-original-revision-trust.cjs'),'utf8');
  for(const forbidden of [
    'fetch(', 'XMLHttpRequest','https.request(',
    'writeFileSync(', 'fs.writeFile(', 'spawn(', 'git push',
    'git commit','git update-ref','github.com/','Authorization:',
    'GITHUB_TOKEN','process.env.GITHUB_TOKEN','localStorage'
  ])assert.equal(content.includes(forbidden),false,
    'Unexpected network, writer or token path: '+forbidden);
  assert.deepEqual(Object.keys(require('../tools/prepare-pinned-original-revision-trust.cjs')),
    ['originalTrustFromPinnedCheckout']);
  assert.equal(reader.ANCHOR,SOURCE_SHA);
});
