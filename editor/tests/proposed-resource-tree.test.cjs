'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {planChangeSet}=require('../tools/rehearse-resource-change-set.cjs');
const {ROOT,MANIFEST,layout,resourcePath,expectedPaths,withCandidateTree,
  verifyCandidate,rollbackCandidate,rehearse}=
  require('../tools/rehearse-proposed-resource-tree.cjs');
const original=fs.readFileSync(path.resolve(__dirname,'..','..','site-content.html'));
const BASE='34455f6d901c538e2491a8c16681692e4c02d918b1984d7d0ba081aacb1049e8';
const draft={format:'naxx-local-resource-draft-v2',baselineSha256:BASE,
  changes:[{index:0,title:'Test first title',content:'First line\n\nMore text'},
    {index:213,content:'Middle text.'},{index:413,title:'Test last title'}]};
const digest=value=>crypto.createHash('sha256').update(value).digest('hex');

test('proposed paths are stable and do not replace the small root loader',()=>{
  assert.equal(ROOT,'content/legacy');
  assert.equal(MANIFEST,'content/legacy/manifest.json');
  assert.equal(resourcePath(0),'content/legacy/resources/0001.fragment');
  assert.equal(resourcePath(213),'content/legacy/resources/0214.fragment');
  assert.equal(resourcePath(413),'content/legacy/resources/0414.fragment');
  const paths=[...expectedPaths()];
  assert.equal(paths.length,418);
  assert.equal(new Set(paths).size,418);
  assert.ok(paths.every(p=>p.startsWith('content/legacy/')));
  assert.ok(!paths.includes('index.html'));
  assert.ok(!paths.includes('site-content.html'));
});

test('all 414 untouched resources and three layout files rebuild exact original bytes',async()=>{
  let root;
  const summary=await withCandidateTree(original,null,(dir,plan)=>{
    root=dir;assert.equal(plan,null);
    return verifyCandidate(dir,original,null);
  });
  assert.equal(summary.fileCount,418);
  assert.equal(summary.resourceFiles,414);
  assert.equal(summary.changedFragments,0);
  assert.equal(summary.unchangedFragments,414);
  assert.equal(summary.originalSourceByteIdentical,true);
  assert.equal(summary.intendedSourceByteIdentical,true);
  assert.equal(summary.stagedSourceSha256,BASE);
  assert.ok(summary.candidateTreeBytes>original.length);
  assert.equal(summary.githubFilesWritten,0);
  assert.equal(fs.existsSync(root),false);
});
test('three independently edited resource fragments reconstruct complete intended source and roll back',async()=>{
  const report=await rehearse(original,draft);
  assert.equal(report.privateTemporaryOnly,true);
  assert.equal(report.staged.fileCount,418);
  assert.equal(report.staged.changedFragments,3);
  assert.equal(report.staged.unchangedFragments,411);
  assert.notEqual(report.staged.stagedSourceSha256,BASE);
  assert.equal(report.staged.intendedSourceByteIdentical,true);
  assert.equal(report.staged.originalLayoutByteIdentical,true);
  assert.equal(report.rollback.changedFragments,0);
  assert.equal(report.rollback.unchangedFragments,414);
  assert.equal(report.rollback.stagedSourceSha256,BASE);
  assert.equal(report.rollbackExactOriginal,true);
  assert.equal(report.temporaryDirectoryDeleted,true);
  assert.equal(report.publicFilesModified,false);
});
test('changed manifest lists only fixed numeric paths and verified original/new hashes',async()=>{
  await withCandidateTree(original,draft,(root,plan)=>{
    const disk=JSON.parse(fs.readFileSync(path.join(root,MANIFEST)));
    assert.equal(disk.format,'naxx-proposed-legacy-source-tree-preflight-v1');
    assert.equal(disk.candidateOnly,true);
    assert.equal(disk.publishable,false);
    assert.equal(disk.deployable,false);
    assert.equal(disk.githubReady,false);
    assert.equal(disk.recordCount,414);
    assert.equal(disk.resources.length,414);
    assert.deepEqual(disk.changedPaths,[
      resourcePath(0),resourcePath(213),resourcePath(413)
    ]);
    assert.equal(disk.files.prefix.path,layout.prefix);
    assert.equal(disk.files.suffix.path,layout.suffix);
    assert.equal(disk.files.separators.path,layout.separators);
    for(const record of disk.resources){
      const bytes=fs.readFileSync(path.join(root,record.path));
      assert.equal(digest(bytes),record.stagedSha256);
      assert.equal(record.changed,disk.changedPaths.includes(record.path));
    }
    assert.equal(disk.stagedSourceSha256,digest(plan.expected));
    assert.equal(JSON.stringify(disk).includes('Test first title'),false);
    assert.equal(JSON.stringify(disk).includes('Middle text.'),false);
  });
});
test('an unrelated altered resource or layout is rejected, even if it is syntactically valid',async()=>{
  await withCandidateTree(original,draft,(root,plan)=>{
    const extra=path.join(root,resourcePath(90));
    fs.appendFileSync(extra,'x');
    assert.throws(()=>verifyCandidate(root,original,plan),/differs from verified|checksum|manifest/i);
    const old=plan.split.records[90];
    fs.writeFileSync(extra,old,'utf8');
    fs.appendFileSync(path.join(root,layout.suffix),'x');
    assert.throws(()=>verifyCandidate(root,original,plan),/checksum|bytes changed/i);
  });
});
test('missing, extra and symlinked files are rejected',async()=>{
  await withCandidateTree(original,null,root=>{
    const last=path.join(root,resourcePath(413));
    fs.unlinkSync(last);
    assert.throws(()=>verifyCandidate(root,original,null),/missing or unapproved/);
    fs.writeFileSync(last,'corruption');
    assert.throws(()=>verifyCandidate(root,original,null),/differs from verified/);
  });
  await withCandidateTree(original,null,root=>{
    const extra=path.join(root,'content/legacy/resources/other.fragment');
    fs.writeFileSync(extra,'not allowed');
    assert.throws(()=>verifyCandidate(root,original,null),/missing or unapproved/);
  });
  await withCandidateTree(original,null,root=>{
    const target=path.join(root,resourcePath(1));
    fs.unlinkSync(target);
    fs.symlinkSync(path.join(root,resourcePath(0)),target);
    assert.throws(()=>verifyCandidate(root,original,null),/symlink/);
  });
});
test('manifest tampering and baseline mismatch reject preflight without touching repository',async()=>{
  await withCandidateTree(original,draft,(root,plan)=>{
    const name=path.join(root,MANIFEST);
    const manifest=JSON.parse(fs.readFileSync(name,'utf8'));
    manifest.changedPaths.push('index.html');
    fs.writeFileSync(name,JSON.stringify(manifest));
    assert.throws(()=>verifyCandidate(root,original,plan),/manifest/i);
    assert.throws(()=>rollbackCandidate(root,original,plan),/manifest/i);
  });
  await assert.rejects(withCandidateTree(
    Buffer.concat([original,Buffer.from('x')]),draft,()=>null),/exact original/);
  const bad={...draft,baselineSha256:'0'.repeat(64)};
  await assert.rejects(withCandidateTree(original,bad,()=>null),/mismatched|Unsupported/);
});
test('a rejected candidate test still removes its private directory',async()=>{
  let temporary;
  await assert.rejects(withCandidateTree(original,null,(root)=>{
    temporary=root;
    throw Error('Simulated failure for cleanup');
  }),/Simulated failure/);
  assert.equal(fs.existsSync(temporary),false);
});
