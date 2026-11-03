// Run: node assets/tests/no-public-connection-details.test.cjs
// Protect the publicly served game-client data from accidental disclosure.
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const crypto = require("node:crypto");
const source = fs.readFileSync("site-content.html","utf8");
const privateFilename = "realm" + "list.wtf"; // Constructed; no actual file/address is published.
const realmlistCommand = new RegExp("set\\s+realm" + "list\\s+","i");
assert.equal(source.toLowerCase().includes(privateFilename),false,
  "Public site must not contain the connection config filename");
assert.equal(realmlistCommand.test(source),false,
  "Public site must not contain any server connection-setting command");
const titleAt=source.indexOf('"title":"ChromieCraft"');
assert.ok(titleAt>=0,"Original Game Clients entry must remain available");
const setup=source.slice(titleAt).match(/"setupInstructions":"((?:\\.|[^"\\])*)"/);
assert.ok(setup,"Original client setup field must remain present");
const text=JSON.parse('"' + setup[1] + '"');
assert.ok(text.includes("acceptance email"),"Must explain private email delivery");
assert.ok(text.includes("patch-V"),"Main patch guide must be retained");
assert.ok(text.includes("patch-Z"),"Supporting patch guide must be retained");
assert.ok(!/\\b(?:\\d{1,3}\\.){3}\\d{1,3}\\b/.test(text),
 "Client setup must not contain an IPv4 address");
const bytes=Buffer.from(source,"utf8");
const blobSha=crypto.createHash("sha1").update(Buffer.concat([
  Buffer.from("blob "+bytes.length+"\\0"),bytes
])).digest("hex");
assert.equal(blobSha,"71ab9f2bf4cf12282fcbe135f7ec787805715b62",
 "Original website data changed outside the approved single-field edit");
console.log("PASS: no public client connection line/file; email-only delivery.");
console.log("PASS: existing client download and patch guidance preserved.");
console.log("PASS: source file exactly matches approved minimal redaction.");
