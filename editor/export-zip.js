/* Local-only Naxxramas editor ZIP writer. No network, credentials or GitHub writes. */
(function (root) {
  'use strict';
  var enc = new TextEncoder();
  var CRC_TABLE = (function () {
    var t = new Uint32Array(256);
    for (var i = 0; i < 256; i++) {
      var c = i;
      for (var j = 0; j < 8; j++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      t[i] = c >>> 0;
    }
    return t;
  })();

  function bytes(value) {
    return typeof value === 'string' ? enc.encode(value) : value;
  }
  function crc32(data) {
    var c = 0xffffffff;
    for (var i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 255] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }
  function u16(view, offset, n) { view.setUint16(offset, n, true); }
  function u32(view, offset, n) { view.setUint32(offset, n >>> 0, true); }
  function safePath(path) {
    return typeof path === 'string' && path.length < 240 &&
      !/^[\/\\]/.test(path) && !/\\/.test(path) &&
      !/(^|\/)\.{1,2}(\/|$)/.test(path) &&
      !/[\x00-\x1f]/.test(path) &&
      /^[a-zA-Z0-9._/-]+$/.test(path) &&
      !path.endsWith('/');
  }
  var ALLOWED_EXPORT_PATHS = new Set([
    'new-players/content.html', 'rules/content.html', 'apply/content.html',
    'game-clients/content.html',
    'content/navigation.json',
    'UPDATE-MANIFEST.json', 'HOW_TO_APPLY.txt'
  ]);
  var ALLOWED_REVIEW_PATHS = new Set([
    'REVIEW-PAGE-DRAFT.json', 'REVIEW-RESOURCE-DRAFT.json',
    'REVIEW-MANIFEST.json', 'READ_ME_FIRST.txt'
  ]);
  function buildZip(entries,allowed) {
    if (!Array.isArray(entries) || !entries.length || entries.length > 100) throw new Error('Invalid ZIP file list.');
    var parts = [], central = [], offset = 0, seen = new Set();
    entries.forEach(function (item) {
      if (!item || !safePath(item.path) || !allowed.has(item.path) || seen.has(item.path.toLowerCase())) throw new Error('Unsafe, unapproved or duplicate ZIP path.');
      seen.add(item.path.toLowerCase());
      var filename = enc.encode(item.path);
      var data = bytes(item.content);
      if (!(data instanceof Uint8Array) || data.length > 64 * 1024 * 1024) throw new Error('File exceeds editor ZIP limit.');
      var crc = crc32(data);
      var local = new Uint8Array(30);
      var a = new DataView(local.buffer);
      u32(a, 0, 0x04034b50);
      u16(a, 4, 20); u16(a, 6, 0x0800); u16(a, 8, 0);
      u32(a, 14, crc); u32(a, 18, data.length); u32(a, 22, data.length);
      u16(a, 26, filename.length);
      parts.push(local, filename, data);

      var record = new Uint8Array(46);
      var b = new DataView(record.buffer);
      u32(b, 0, 0x02014b50);
      u16(b, 4, 20); u16(b, 6, 20); u16(b, 8, 0x0800);
      u32(b, 16, crc); u32(b, 20, data.length); u32(b, 24, data.length);
      u16(b, 28, filename.length);
      u32(b, 42, offset);
      central.push(record, filename);
      offset += local.length + filename.length + data.length;
      if (offset > 128 * 1024 * 1024) throw new Error('ZIP is too large; export a smaller batch.');
    });
    var centralSize = central.reduce(function (n, part) { return n + part.length; }, 0);
    var end = new Uint8Array(22);
    var v = new DataView(end.buffer);
    u32(v, 0, 0x06054b50);
    u16(v, 8, entries.length); u16(v, 10, entries.length);
    u32(v, 12, centralSize); u32(v, 16, offset);
    return new Blob(parts.concat(central, [end]), { type: 'application/zip' });
  }
  // Keep the GitHub-path changed-files writer STRICTLY separate from the
  // non-publishable review-package writer; never mix these path allowlists.
  function makeZip(entries) { return buildZip(entries, ALLOWED_EXPORT_PATHS); }
  function makeReviewZip(entries) {
    if(!Array.isArray(entries)||entries.length<3||entries.length>4)
      throw new Error('Review package needs a manifest, instructions and at least one draft.');
    var names=entries.map(function(e){return e.path;});
    if(!names.includes('REVIEW-MANIFEST.json')||!names.includes('READ_ME_FIRST.txt')||
       (!names.includes('REVIEW-PAGE-DRAFT.json')&&!names.includes('REVIEW-RESOURCE-DRAFT.json')))
      throw new Error('Review package is incomplete.');
    return buildZip(entries, ALLOWED_REVIEW_PATHS);
  }
  async function sha256(text) {
    if (!root.crypto || !root.crypto.subtle) throw new Error('This browser does not support secure SHA-256 hashing.');
    var buffer = await root.crypto.subtle.digest('SHA-256', bytes(text));
    return Array.from(new Uint8Array(buffer), function (n) { return n.toString(16).padStart(2, '0'); }).join('');
  }
  root.NaxxEditorZip = { makeZip: makeZip, makeReviewZip: makeReviewZip, sha256: sha256, safePath: safePath };
})(typeof window === 'undefined' ? globalThis : window);
