'use strict';
/* node --test editor/tests/export.test.cjs */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');

const editorRoot = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(editorRoot, 'export-zip.js'), 'utf8');
const environment = {
  TextEncoder, Blob, Uint8Array, Uint32Array, DataView, Set, Array, crypto: webcrypto
};
vm.runInNewContext(source, environment, { filename: 'editor/export-zip.js' });
const zip = environment.NaxxEditorZip;

async function localEntries(blob) {
  const buffer = Buffer.from(await blob.arrayBuffer());
  let offset = 0;
  const entries = [];
  while (offset + 4 <= buffer.length && buffer.readUInt32LE(offset) === 0x04034b50) {
    const flags = buffer.readUInt16LE(offset + 6);
    const method = buffer.readUInt16LE(offset + 8);
    const crc = buffer.readUInt32LE(offset + 14);
    const size = buffer.readUInt32LE(offset + 18);
    const filenameSize = buffer.readUInt16LE(offset + 26);
    const extraSize = buffer.readUInt16LE(offset + 28);
    const start = offset + 30 + filenameSize + extraSize;
    const filename = buffer.subarray(offset + 30, offset + 30 + filenameSize).toString('utf8');
    entries.push({ filename, flags, method, crc, content: buffer.subarray(start, start + size).toString('utf8') });
    offset = start + size;
  }
  assert.equal(buffer.readUInt32LE(buffer.length - 22), 0x06054b50, 'Missing ZIP end of directory');
  assert.equal(buffer.readUInt16LE(buffer.length - 12), entries.length, 'ZIP directory entry count mismatch');
  return entries;
}

test('ZIP keeps exact relative paths and Unicode content', async () => {
  const entries = await localEntries(zip.makeZip([
    { path: 'new-players/content.html', content: '<p>Progression ✓</p>' },
    { path: 'game-clients/content.html', content: '<p>Game Clients</p>' },
    { path: 'content/navigation.json', content: '{"format":"naxx-navigation-v1"}' },
    { path: 'UPDATE-MANIFEST.json', content: '{"ok":true}' }
  ]));
  assert.equal(entries.length, 4);
  assert.equal(entries[0].filename, 'new-players/content.html');
  assert.equal(entries[0].content, '<p>Progression ✓</p>');
  assert.equal(entries[1].filename, 'game-clients/content.html');
  assert.equal(entries[2].filename, 'content/navigation.json');
  assert.equal(entries[3].filename, 'UPDATE-MANIFEST.json');
  assert.equal(entries[0].method, 0, 'ZIP is intentionally uncompressed');
  assert.equal(entries[0].flags & 0x800, 0x800, 'UTF-8 filename flag should be set');
});

test('known CRC32 of Hello agrees with standard ZIP CRC32', async () => {
  const [entry] = await localEntries(zip.makeZip([{ path: 'rules/content.html', content: 'Hello' }]));
  assert.equal(entry.crc, 0xf7d18982);
});

test('rejects traversal, absolute, backslash and duplicate names', () => {
  ['index.html', '../index.html', '/index.html', 'rules\\content.html', 'rules/../index.html', 'assets/unknown.js'].forEach((filename) => {
    assert.throws(() => zip.makeZip([{ path: filename, content: 'x' }]));
  });
  assert.throws(() => zip.makeZip([
    { path: 'rules/content.html', content: 'a' },
    { path: 'Rules/content.html', content: 'b' }
  ]));
});

test('SHA-256 manifest hash is deterministic', async () => {
  assert.equal(await zip.sha256('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});

test('the isolated editor compiles and does not modify the site loader', () => {
  const ui = fs.readFileSync(path.join(editorRoot, 'editor.js'), 'utf8');
  const html = fs.readFileSync(path.join(editorRoot, 'index.html'), 'utf8');
  assert.doesNotThrow(() => new vm.Script(ui));
  assert.match(html, /src="editor\.js"/);
  assert.match(html, /src="export-zip\.js"/);
  assert.match(ui, /new-players\/content\.html/);
  assert.match(ui, /rules\/content\.html/);
  assert.match(ui, /apply\/content\.html/);
  assert.match(ui, /game-clients\/content\.html/);
  assert.match(ui, /content\/navigation\.json/);
  assert.doesNotMatch(ui, /fetch\s*\(|XMLHttpRequest|sendBeacon\s*\(/);
});

test('review ZIP cannot exceed the local recovery reader entry or archive limits',async()=>{
  const manifest={path:'REVIEW-MANIFEST.json',content:'{}'};
  const instructions={path:'READ_ME_FIRST.txt',content:'Private review'};
  const page=content=>({path:'REVIEW-PAGE-DRAFT.json',content});
  const resource=content=>({path:'REVIEW-RESOURCE-DRAFT.json',content});
  // Writer must fail before CRC calculation/download, keeping editor drafts intact.
  assert.throws(()=>zip.makeReviewZip([
    page(new Uint8Array(16*1024*1024+1)),manifest,instructions
  ]),/oversized recovery file/);
  assert.throws(()=>zip.makeReviewZip([
    page(new Uint8Array(11*1024*1024)),
    resource(new Uint8Array(11*1024*1024)),
    manifest,instructions
  ]),/20 MiB recovery limit/);
  assert.throws(()=>zip.makeReviewZip([page(''),manifest,instructions]),
    /empty or oversized/);
  // A valid small review package is still a STORE ZIP with accurate byte size.
  const small=zip.makeReviewZip([page('{"example":true}'),manifest,instructions]);
  assert.ok(small.size>22&&small.size<20*1024*1024);
  assert.equal((await localEntries(small)).length,3);
  // The separate changed-files writer retains its own path and size policy.
  assert.equal((await localEntries(zip.makeZip([
    {path:'rules/content.html',content:'Page source remains separate'}
  ]))).length,1);
});
