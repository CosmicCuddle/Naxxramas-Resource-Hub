// Run: node talents/tests/era-capstones.test.cjs
// Regression checks against the actual bundled custom server Talent.dbc snapshot.
// No dependencies outside standard Node.js; no files or game data are modified.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const zlib = require('node:zlib');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'calculator.js'), 'utf8');
const compressed = fs.readFileSync(
  path.join(root, 'data', 'server-talents-v1.gz.b64'), 'utf8'
).trim();
const db = JSON.parse(zlib.gunzipSync(Buffer.from(compressed, 'base64')).toString('utf8'));

function extract(regex, description) {
  const match = source.match(regex);
  assert.ok(match, 'Cannot locate live calculator ' + description);
  return match[0];
}

// Test the calculator's actual visibility function, not a copied approximation.
const eraDeclaration = extract(/^  const ERA=.*;$/m, 'ERA settings');
const capstoneDeclaration = extract(
  /^  const OFF_CENTRE_CAPSTONES=.*;$/m,
  'final-row overrides'
);
const visibilityFunction = extract(
  /^  function availableInEra\([\s\S]*?^  }/m,
  'availableInEra()'
);
const availableInEra = vm.runInNewContext(
  eraDeclaration + '\n' + capstoneDeclaration + '\n' +
  'const db = suppliedDb;\n' +
  "const model = {era:'vanilla',class:'shaman'};\n" +
  visibilityFunction + '\n availableInEra;',
  { suppliedDb: db }
);
function tree(cls, tab) {
  const result = (db.classes[cls] || []).find(item => item[0] === tab);
  assert.ok(result, cls + ' talent tree ' + tab + ' missing');
  return result;
}
function talent(cls, tab, id) {
  const result = tree(cls, tab)[3].find(item => item[0] === id);
  assert.ok(result, 'Talent ' + id + ' missing from ' + cls + ' tree ' + tab);
  return result;
}
function finalRow(cls, tab, era, zeroBasedRow) {
  return tree(cls, tab)[3]
    .filter(item => item[1] === zeroBasedRow && availableInEra(item, era, cls))
    .map(item => item[0]);
}

const dualWield = talent('shaman', 263, 1690);
const stormstrike = talent('shaman', 263, 901);
assert.equal(dualWield[4], 'Dual Wield');
assert.equal(stormstrike[4], 'Stormstrike');
assert.equal(dualWield[1], 6);
assert.equal(dualWield[2], 1);
assert.equal(stormstrike[1], 6);
assert.equal(stormstrike[2], 2);

// Vanilla: only the centre-column Dual Wield remains on Enhancement row 7.
assert.deepEqual(finalRow('shaman', 263, 'vanilla', 6), [1690]);
assert.equal(availableInEra(stormstrike, 'vanilla', 'shaman'), false);

// TBC: row 7 is no longer the final row, so both abilities are visible.
assert.equal(availableInEra(dualWield, 'tbc', 'shaman'), true);
assert.equal(availableInEra(stormstrike, 'tbc', 'shaman'), true);
assert.deepEqual(finalRow('shaman', 263, 'tbc', 8), [1693]);

// Wrath keeps the full Enhancement tree.
assert.equal(availableInEra(dualWield, 'wotlk', 'shaman'), true);
assert.equal(availableInEra(stormstrike, 'wotlk', 'shaman'), true);

// Affliction: Contagion is the centre-column row-7 choice in Vanilla.
// Dark Pact shares row 7 but is in the right column; it unlocks in TBC.
const contagion = talent('warlock', 302, 1669);
const darkPact = talent('warlock', 302, 1022);
assert.equal(contagion[4], 'Contagion');
assert.equal(darkPact[4], 'Dark Pact');
assert.equal(contagion[1], 6);
assert.equal(contagion[2], 1);
assert.equal(darkPact[1], 6);
assert.equal(darkPact[2], 2);
assert.deepEqual(finalRow('warlock', 302, 'vanilla', 6), [1669]);
assert.equal(availableInEra(darkPact, 'vanilla', 'warlock'), false);
assert.equal(availableInEra(contagion, 'tbc', 'warlock'), true);
assert.equal(availableInEra(darkPact, 'tbc', 'warlock'), true);
assert.equal(availableInEra(contagion, 'wotlk', 'warlock'), true);
assert.equal(availableInEra(darkPact, 'wotlk', 'warlock'), true);

// The remaining off-centre capstone exception must not regress.
assert.deepEqual(finalRow('paladin', 382, 'tbc', 8), [1747]);

console.log('PASS: Vanilla Enhancement ends with Dual Wield (1690), not Stormstrike (901).');
console.log('PASS: Stormstrike is visible from TBC; Wrath retains both talents.');
console.log('PASS: Vanilla Affliction ends with Contagion (1669), not Dark Pact (1022).');
console.log('PASS: Dark Pact unlocks in TBC; Wrath retains both Affliction talents.');
console.log('PASS: TBC Holy Paladin off-centre capstone remains unchanged.');
