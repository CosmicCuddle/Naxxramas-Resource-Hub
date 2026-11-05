'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  withTemporaryPackage,reconstructTemporaryPackage,rehearse,resourcePath
} = require('../tools/rehearse-resource-files.cjs');

const original = fs.readFileSync(path.resolve(__dirname, '..', '..', 'site-content.html'));

test('414 independent files rebuild exactly and private temporary folder is deleted', () => {
  let tmp;
  const result = withTemporaryPackage(original,(root,manifest)=>{
    tmp = root;
    assert.ok(!root.includes('/Naxxramas-Resource-Hub/'),
      'Rehearsal must not write into the repository checkout.');
    assert.equal(manifest.resources.length,414);
    assert.equal(fs.readdirSync(path.join(root,'resources')).length,414);
    assert.ok(fs.existsSync(path.join(root,'layout','prefix.utf8')));
    assert.ok(fs.existsSync(path.join(root,'layout','suffix.utf8')));
    assert.ok(fs.existsSync(path.join(root,'layout','separators.json')));
    assert.ok(fs.existsSync(path.join(root,'manifest.json')));
    const rebuilt = reconstructTemporaryPackage(root);
    assert.ok(rebuilt.equals(original));
    return {count:manifest.recordCount,bytes:rebuilt.length};
  });
  assert.equal(result.count,414);
  assert.equal(result.bytes,30976969);
  assert.equal(fs.existsSync(tmp),false,'Temporary package must be removed.');
});

test('altered or missing record fragment fails closed and is cleaned up', () => {
  let tmp;
  assert.throws(()=>withTemporaryPackage(original,(root)=>{
    tmp=root;
    const filename=path.join(root,resourcePath(3));
    fs.appendFileSync(filename,' deliberate test change');
    reconstructTemporaryPackage(root);
  }),/missing, changed, or reordered/);
  assert.equal(fs.existsSync(tmp),false);

  assert.throws(()=>withTemporaryPackage(original,(root)=>{
    tmp=root;
    fs.unlinkSync(path.join(root,resourcePath(6)));
    reconstructTemporaryPackage(root);
  }));
  assert.equal(fs.existsSync(tmp),false);
});

test('swapping two record files is detected even though count stays unchanged',()=>{
  let tmp;
  assert.throws(()=>withTemporaryPackage(original,(root)=>{
    tmp=root;
    const a=path.join(root,resourcePath(0));
    const b=path.join(root,resourcePath(1));
    const left=fs.readFileSync(a),right=fs.readFileSync(b);
    fs.writeFileSync(a,right);
    fs.writeFileSync(b,left);
    reconstructTemporaryPackage(root);
  }),/missing, changed, or reordered/);
  assert.equal(fs.existsSync(tmp),false);
});

test('safe report includes only aggregate totals and hashes',()=>{
  const report=rehearse(original);
  assert.equal(report.separatelyWrittenResourceFragments,414);
  assert.equal(report.byteExactMatch,true);
  assert.equal(report.temporaryPackagePublished,false);
  assert.equal(report.temporaryFolderDeletedAfterTest,true);
  assert.equal(report.siteFilesChanged,false);
  assert.equal(report.matchingSha256,'34455f6d901c538e2491a8c16681692e4c02d918b1984d7d0ba081aacb1049e8');
  assert.ok(!Object.hasOwn(report,'resourceContents'));
  assert.ok(!Object.hasOwn(report,'resourceIds'));
});
