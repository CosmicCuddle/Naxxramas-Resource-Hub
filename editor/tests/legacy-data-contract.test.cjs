'use strict';
/*
 * Read-only baseline contract for original Resource Hub DATA.
 * Tests counts only. Never outputs titles, URLs, IDs or embedded images.
 * These are syntax/field checks; browser/runtime behaviour remains unverified.
 */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {inspectJsonInitializer}=require('../tools/audit-legacy-json.cjs');
const source=path.resolve(__dirname,'..','..','site-content.html');

test('preserves original legacy DATA resource-structure baseline before migration',()=>{
  const report=inspectJsonInitializer(fs.readFileSync(source));
  assert.equal(report.sourceVerified,true);
  assert.equal(report.nestedIsWindowProperty,true);
  assert.equal(report.nestedAssignmentsBeforeData,1);
  const structures=report.nestedStaticLiteralSummaries.filter(x=>x.kind==='objectLiteral'&&x.beforeDataAssignment);
  assert.equal(structures.length,1);
  const root=structures[0];
  assert.equal(root.directMembers,27);
  assert.equal(root.recognizedKeyTypes.resources,'array');
  const resources=root.directArrays.find(x=>x.memberIndex===4);
  assert.ok(resources);
  assert.equal(resources.itemCount,414);
  assert.equal(resources.objectItems,414);
  assert.equal(resources.recordShape.withIdField,414);
  assert.equal(resources.recordShape.missingIdField,0);
  assert.equal(resources.recordShape.lexicallyRepeatedIdLiterals,0);
  for(const name of ['id','title','section','classes','content'])
    assert.equal(resources.recordShape.knownFieldOccurrences[name],414);
  assert.equal(resources.recordShape.unknownFieldOccurrences,13821);
  const other=root.directArrays.find(x=>x.memberIndex===17);
  assert.equal(other.itemCount,29);
  assert.equal(other.recordShape.missingIdField,29);
  // Do not mistake a syntax inventory for an approved runtime source count.
  assert.equal(report.resourceRecordsVerified,false);
});
