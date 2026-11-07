'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {SOURCE_SHA}=require('../tools/audit-source-storage-budget.cjs');
const {recordPath,MANIFEST}=require('../tools/rehearse-resource-only-overlay.cjs');
const {withTemporaryVersions,verify,draftFrom,save}=
  require('../tools/rehearse-versioned-resource-sessions.cjs');
const {checkSource,verifyCompleteReadOnly,verifyInventory,parseDraft}=
  require('../tools/verify-physical-resource-sources.cjs');
const original=fs.readFileSync(path.resolve(__dirname,'..','..','site-content.html'));
const sha=buffer=>crypto.createHash('sha256').update(buffer).digest('hex');
const file=(root,rel)=>path.join(root,...rel.split('/'));
test('physical review reads every resource, reconstructs exact original and never grants save capability',async()=>{
  await withTemporaryVersions(original,root=>{
    const current=verify(root,original);
    const draft=draftFrom(current,[{index:0,title:'Private resource review only'}]);
    const status=verifyCompleteReadOnly(root,original,Buffer.from(JSON.stringify(draft)));
    assert.equal(status.format,'naxx-physical-resource-source-review-v1');
    assert.equal(status.sourceVerified,true);
    assert.equal(status.resourceFilesVerified,414);
    assert.equal(status.filesVerified,415);
    assert.equal(status.decision,'review-only');
    assert.equal(status.fullHtmlSha256Matched,true);
    assert.equal(status.originalShellSha256Matched,true);
    assert.equal(status.originalNonResourceDataPreserved,true);
    assert.equal(status.canApply,false);
    assert.equal(status.canPublish,false);
    assert.equal(status.canAutoMerge,false);
    assert.equal(status.filesWritten,0);
    assert.equal(status.sourceValuesPrinted,false);
    assert.equal(sha(original),SOURCE_SHA);
  });
});
test('after a real disposable second revision, stale draft is rejected only after complete physical source checks',async()=>{
  await withTemporaryVersions(original,root=>{
    const state0=verify(root,original);
    const old=draftFrom(state0,[{index:0,title:'Original session edit'}]);
    save(root,original,draftFrom(state0,[{index:413,content:'Modified in another session.'}]));
    const stale=verifyCompleteReadOnly(root,original,old);
    assert.equal(stale.decision,'stale');
    assert.equal(stale.sourceVerified,true);
    const now=verify(root,original);
    const fresh=draftFrom(now,[{index:0,title:'Later review draft'}]);
    assert.equal(verifyCompleteReadOnly(root,original,fresh).decision,'review-only');
    assert.equal(verifyCompleteReadOnly(root,original,fresh).filesWritten,0);
  });
});
test('missing, extra, and reordered or modified resource files fail closed',async()=>{
  await withTemporaryVersions(original,root=>{
    const state=verify(root,original);
    const draft=draftFrom(state,[{index:0,title:'Protected test'}]);
    const first=file(root,recordPath(0)),second=file(root,recordPath(1));
    const firstOriginal=fs.readFileSync(first),secondOriginal=fs.readFileSync(second);
    fs.writeFileSync(first,secondOriginal);
    fs.writeFileSync(second,firstOriginal);
    assert.throws(()=>verifyCompleteReadOnly(root,original,draft),/manifest checksum/);
    fs.writeFileSync(first,firstOriginal);
    fs.writeFileSync(second,secondOriginal);
    fs.rmSync(first);
    assert.throws(()=>verifyCompleteReadOnly(root,original,draft),/Missing or unexpected resource files/);
    fs.writeFileSync(first,firstOriginal);
    const extra=file(root,'unapproved-fragment.txt');
    fs.writeFileSync(extra,'not approved');
    assert.throws(()=>verifyCompleteReadOnly(root,original,draft),/Too many files|Missing or unexpected resource files/);
    fs.rmSync(extra);
    assert.equal(verifyCompleteReadOnly(root,original,draft).decision,'review-only');
  });
});
test('source and manifest tampering are detected before even a version-matching draft can be reviewed',async()=>{
  await withTemporaryVersions(original,root=>{
    const state=verify(root,original),draft=draftFrom(state,[{index:0,title:'No changes'}]);
    const mf=file(root,MANIFEST);
    const originalManifest=fs.readFileSync(mf);
    const forged=JSON.parse(originalManifest.toString('utf8'));
    forged.sourceSha256='c'.repeat(64);
    fs.writeFileSync(mf,JSON.stringify(forged));
    assert.throws(()=>verifyCompleteReadOnly(root,original,draft),
      /Resource manifest has invalid version\/record structure/);
    fs.writeFileSync(mf,originalManifest);
    // On a legitimate later revision, a plausible forged source hash
    // must be caught by independently reconstructing the complete HTML.
    save(root,original,draftFrom(state,[
      {index:413,title:'New verified resource revision'}
    ]));
    const current=verify(root,original),revisedDraft=draftFrom(current,[
      {index:0,title:'Fresh private source revision'}
    ]);
    const revisedManifest=fs.readFileSync(mf);
    const altered=JSON.parse(revisedManifest.toString('utf8'));
    altered.sourceSha256='c'.repeat(64);
    fs.writeFileSync(mf,JSON.stringify(altered));
    assert.throws(()=>verifyCompleteReadOnly(root,original,revisedDraft),
      /Complete HTML reconstruction does not match/);
    fs.writeFileSync(mf,revisedManifest);
    const wrong=Buffer.from(original);wrong[2]^=1;
    assert.throws(()=>verifyCompleteReadOnly(root,wrong,revisedDraft),
      /Original website shell fingerprint is incorrect/);
    assert.equal(verifyCompleteReadOnly(root,original,revisedDraft).decision,'review-only');
  });
});
test('a symlink and malformed, oversized or outdated draft input are never trusted',async()=>{
  await withTemporaryVersions(original,root=>{
    const state=verify(root,original),draft=draftFrom(state,[{index:0,title:'Safe'}]);
    assert.throws(()=>parseDraft(Buffer.from('{')),/draft JSON is invalid/);
    assert.throws(()=>parseDraft(Buffer.alloc(0)),/Draft file size is not allowed/);
    assert.throws(()=>parseDraft(Buffer.alloc(16777217,0x20)),/Draft file size is not allowed/);
    assert.throws(()=>parseDraft({...draft,extra:1}),/draft structure is invalid/);
    const rel=recordPath(41),target=file(root,rel),bytes=fs.readFileSync(target);
    fs.rmSync(target);
    fs.symlinkSync(file(root,recordPath(42)),target);
    assert.throws(()=>verifyCompleteReadOnly(root,original,draft),/Symlink in source folder/);
    fs.rmSync(target);fs.writeFileSync(target,bytes);
    assert.equal(verifyInventory(root),415);
    assert.equal(checkSource(root,original).filesVerified,415);
  });
});
test('test-only full-source verifier does not rely on source-value logging, uploads or permanent artifacts',()=>{
  const content=fs.readFileSync(path.resolve(__dirname,'../tools/verify-physical-resource-sources.cjs'),'utf8');
  assert.ok(content.includes('restoreInMemory(split,records)'));
  assert.ok(content.includes('sha(built)!==manifest.sourceSha256'));
  assert.ok(content.includes('originalShellSha256Matched'));
  for(const needle of ['fetch(', 'http.request(', 'https.request(', 'child_process',
    'exec(', 'spawn(', 'localStorage', 'uploads/', 'writeFileSync(target']){
    assert.equal(content.includes(needle),false,'Unexpected side effect: '+needle);
  }
});
