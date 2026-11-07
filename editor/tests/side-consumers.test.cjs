'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {audit,summarize,candidatesInScript}=require('../tools/audit-side-consumers.cjs');
const {findSideCollection}=require('../tools/audit-side-collection.cjs');
const {splitInMemory,restoreInMemory}=require('../tools/check-legacy-roundtrip.cjs');
const {replaceTitleInRecord}=require('../tools/rehearse-title-edit.cjs');

test('classifies simple direct writes, array mutators and member assignments',()=>{
  const js=[
    'DATA.side = []; DATA.side.push(item);',
    'DATA.side[0] = update; DATA.side[1].flag = true;',
    'let copy = DATA.side.map(x=>x);',
    '/* DATA.side.pop() */ const value = "DATA.side = bad";'
  ].join('\n');
  const c=candidatesInScript(js,'side');
  assert.deepEqual(c,{
    directReassignmentCandidates:1,
    directMutatorCallCandidates:1,
    memberAssignmentCandidates:2,
    otherAccessCandidates:1
  });
});
test('classifies string-bracket access, and refuses invalid key',()=>{
  const c=candidatesInScript('DATA["side"] = []; DATA[\'side\'].splice(0,1);','side');
  assert.equal(c.directReassignmentCandidates,1);
  assert.equal(c.directMutatorCallCandidates,1);
  assert.throws(()=>candidatesInScript('DATA.secret','secret.txt'),/identifier/);
});
test('scanner reports aggregates without printing underlying property name or source',()=>{
  const html='<script>DATA.secretSide = []; DATA.resources.push({});</script>';
  const report=summarize(html,'secretSide');
  assert.equal(report.scriptsWithBothCandidates,1);
  assert.equal(report.sideCollection.directReassignmentCandidates,1);
  assert.equal(report.mainResources.directMutatorCallCandidates,1);
  assert.equal(report.privateKeysOrValuesEmitted,false);
  assert.ok(!JSON.stringify(report).includes('secretSide'));
});
test('full verified baseline is classified without exposing names or source',()=>{
  const bytes=fs.readFileSync(path.resolve(__dirname,'..','..','site-content.html'));
  const report=audit(bytes);
  assert.equal(report.originalSourceVerified,true);
  assert.equal(report.sourceCodeExecuted,false);
  assert.equal(report.privateKeysOrValuesEmitted,false);
  assert.equal(Object.values(report.sideCollection).reduce((x,y)=>x+y,0),13);
  assert.equal(Object.values(report.mainResources).reduce((x,y)=>x+y,0),31);
});
test('refuses altered source before scanning',()=>{
  const bytes=fs.readFileSync(path.resolve(__dirname,'..','..','site-content.html'));
  assert.throws(()=>audit(Buffer.concat([bytes,Buffer.from('!')])),/fingerprint|Unexpected|Aborting/i);
});


for(const position of [0,413]){
  test('synthetic title edit keeps all original collection-access patterns at position '+position,()=>{
    const bytes=fs.readFileSync(path.resolve(__dirname,'..','..','site-content.html'));
    const original=findSideCollection(bytes);
    const expected=summarize(original.source,original.internalPropertyKey);
    const split=splitInMemory(bytes);
    const records=split.records.slice();
    records[position]=replaceTitleInRecord(records[position],'Read-only Consumer Compatibility Test').record;
    const rebuilt=restoreInMemory(split,records).toString('utf8');
    assert.notEqual(rebuilt,original.source);
    assert.equal(rebuilt.slice(0,split.arrayBegin),split.source.slice(0,split.arrayBegin));
    assert.equal(rebuilt.endsWith(split.source.slice(split.arrayEnd)),true);
    assert.deepEqual(summarize(rebuilt,original.internalPropertyKey),expected);
    const unchanged=records.filter((r,index)=>index!==position&&r===split.records[index]);
    assert.equal(unchanged.length,413);
  });
}
