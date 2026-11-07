'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const original=fs.readFileSync(path.resolve(__dirname,'..','..','site-content.html'));
const {FORMAT,demonstrate}=
  require('../tools/rehearse-private-generation-switch.cjs');

test('real 414-fragment offline generations reject torn saves and recover original site',async()=>{
  const result=await demonstrate(original);
  assert.equal(result.format,FORMAT);
  assert.equal(result.baselineResourceCount,414);
  assert.equal(result.stagedFilesVerified,3);
  assert.equal(result.unrelatedResourceFilesUnchanged,413);
  for(const flag of [
    'interruptedIncompleteGenerationRejected',
    'damagedPreparedRuntimeRefused',
    'damagedBackupRecoveryRefused',
    'originalRemainedActiveBeforeSwitch',
    'afterSwitchUncertainResultReconciled',
    'secondStaleSessionRefused',
    'explicitOriginalRecoveryVerified',
    'activeOriginalHashRestored',
    'temporaryGenerationDeleted'
  ])assert.equal(result[flag],true,flag);
  for(const flag of [
    'realCrossProcessCASProven','powerLossDurabilityProven',
    'realGitHubSavePerformed','canonicalSourceLayoutApproved',
    'ownerApproved','canApply','canPush','canMerge','canPublish'
  ])assert.equal(result[flag],false,flag);
  assert.equal(result.githubWrites,0);
  assert.equal(result.productionFilesWritten,0);
  assert.equal(Object.isFrozen(result),true);
});
test('private generation proof never calls external network or production writers',()=>{
  const source=fs.readFileSync(path.join(__dirname,
    '../tools/rehearse-private-generation-switch.cjs'),'utf8');
  for(const forbidden of [
    'https.request(', 'http.request(', 'fetch(', 'create_commit(',
    'update_ref(', 'GITHUB_TOKEN', 'process.env.', 'node:https',
    'child_process','fs.rmSync(process.cwd('
  ])assert.equal(source.includes(forbidden),false,forbidden);
  assert.match(source,/fs\.mkdtempSync\(path\.join\(os\.tmpdir\(\)/);
  assert.match(source,/fs\.rmSync\(root,\{recursive:true,force:true\}\)/);
  assert.match(source,/realCrossProcessCASProven:false/);
  assert.match(source,/powerLossDurabilityProven:false/);
});
