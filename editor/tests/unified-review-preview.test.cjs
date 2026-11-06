'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const core=require('../unified-review-core.js');
const sample=require('../unified-review-examples.js');
const parent=path.resolve(__dirname,'..');
const clone=o=>JSON.parse(JSON.stringify(o));
const valid=()=>sample.generate().current;

test('fictional six-file receipt groups two pages and two candidate fragments without approval',()=>{
  const out=core.inspect(valid());
  assert.equal(out.code,'preview');
  assert.equal(out.existingFileChanges,2);
  assert.equal(out.resourceChanges,2);
  assert.equal(out.totalProposedPaths,6);
  assert.equal(out.files.filter(x=>x.trackedInCurrentGit).length,3);
  assert.equal(out.files.filter(x=>!x.trackedInCurrentGit).length,3);
  assert.equal(out.files[2].label,'Resource 0001');
  assert.equal(out.files[3].label,'Resource 0414');
  assert.equal(out.canonicalLayoutApproved,false);
  assert.equal(out.sourceAuthenticatedInBrowser,false);
  assert.equal(out.remoteHeadVerifiedInBrowser,false);
  assert.equal(out.canApply,false);
  assert.equal(out.canMerge,false);
  assert.equal(out.canPublish,false);
  assert.ok(Object.isFrozen(out.files));
  assert.ok(!JSON.stringify(out).includes(valid().oldResourceDraftSha256));
});
test('every unsafe, unapproved or HTML-injection path fails closed',()=>{
  const sample=valid();
  for(const p of ['../index.html','index.html','apply/index.html',
    'content/legacy/resources/0001.fragment',
    'content/resource-overlays/resources/0000.fragment',
    'content/resource-overlays/resources/0415.fragment',
    '<img src=x onerror=alert(1)>','/etc/passwd']){
    const candidate=clone(sample);
    candidate.proposedFiles[2].path=p;
    assert.equal(core.inspect(candidate).code,'invalid',p);
  }
});
test('duplicate paths, mismatched roles and counts are rejected',()=>{
  const v=valid();
  const variants=[];
  const dupe=clone(v);dupe.proposedFiles[2].path=dupe.proposedFiles[3].path;variants.push(dupe);
  const swapped=clone(v);swapped.proposedFiles[2].trackedInCurrentGit=true;variants.push(swapped);
  const role=clone(v);role.proposedFiles[4].domain='candidate-resource';variants.push(role);
  variants.push({...v,editedResources:3},{...v,editedPageAndNavigationFiles:3},
    {...v,unifiedProposedFileCount:7},{...v,proposedFiles:v.proposedFiles.slice(1)});
  for(const item of variants)assert.equal(core.inspect(item).code,'invalid');
});
test('forged release permission, missing protections and extra keys are rejected',()=>{
  const v=valid();
  for(const [key,value] of [
    ['canApply',true],['canMerge',true],['canPublish',true],
    ['sourceLayoutApproved',true],['sourcePackageAdopted',true],
    ['remoteGitHubHeadVerified',true],['independentBackupRestored',true],
    ['realAdminEditorVerified',true],['noRemoteUpdateLease',false],
    ['noDraftDeletion',false],['githubWrites',1],['repositoryFilesWritten',1],
    ['candidatePathsUntrackedAndUnapproved',false]
  ])assert.equal(core.inspect({...v,[key]:value}).code,'invalid',key);
  assert.equal(core.inspect({...v,extra:'secret'}).code,'invalid');
  const altered=clone(v);altered.proposedFiles[0].injected='html';
  assert.equal(core.inspect(altered).code,'invalid');
});
test('hashes, existing baseline and complete website digest must be structurally consistent',()=>{
  const v=valid();
  for(const item of [
    {...v,reviewedLocalGitCommit:'not-a-commit'},
    {...v,completeGeneratedSiteSha256:'00'},
    {...v,oldPageDraftSha256:'invalid'},
    {...v,completeGeneratedSiteSha256:core.BASE}
  ])assert.equal(core.inspect(item).code,'invalid');
  const changed=clone(v);changed.proposedFiles[5].newSha256='f'.repeat(64);
  assert.equal(core.inspect(changed).code,'invalid');
  changed.proposedFiles[5].newSha256=v.completeGeneratedSiteSha256;
  changed.proposedFiles[5].oldSha256='f'.repeat(64);
  assert.equal(core.inspect(changed).code,'invalid');
});
test('not-a-draft JSON, oversized text, malformed JSON and dismissal cannot save',()=>{
  assert.equal(core.inspectJSON('{').code,'invalid');
  assert.equal(core.inspectJSON(JSON.stringify({format:'naxx-local-draft-v3'})).code,'invalid');
  assert.equal(core.inspectJSON(JSON.stringify({format:'naxx-local-resource-draft-v2'})).code,'invalid');
  assert.equal(core.inspectJSON('x'.repeat(core.MAX_JSON_BYTES+1)).code,'limit');
  assert.equal(core.inspectJSON('').code,'limit');
  assert.equal(core.inspectJSON(JSON.stringify(valid())).code,'preview');
  assert.equal(core.dismissed().code,'dismissed');
  assert.match(core.dismissed().message,/not been deleted/);
  assert.equal(core.dismissed().files.length,0);
  assert.equal(core.dismissed().canPublish,false);
});
test('read-only preview is offline, accessible, and cannot alter browser data',()=>{
  const html=fs.readFileSync(path.join(parent,'unified-review-preview.html'),'utf8');
  const js=fs.readFileSync(path.join(parent,'unified-review.js'),'utf8');
  for(const id of ['sample-unified','sample-unsafe','sample-forged',
    'unified-receipt','review-unified','dismiss-unified','clear-unified',
    'unified-status','unified-list'])assert.match(html,new RegExp('id="'+id+'"'));
  assert.match(html,/aria-live="polite"/);
  assert.match(html,/connect-src 'none'/);
  assert.match(html,/READ ONLY/);
  assert.match(js,/path\.textContent=entry\.path/);
  for(const source of [js,html]){
    for(const forbidden of ['fetch(', 'sendBeacon(', 'localStorage.',
      'sessionStorage.', 'XMLHttpRequest','indexedDB', '.innerHTML=',
      '.download='])assert.equal(source.includes(forbidden),false,forbidden);
  }
  for(const forbidden of ['<form','<iframe','type="submit"'])
    assert.equal(html.includes(forbidden),false,forbidden);
  assert.doesNotThrow(()=>new Function(js));
});
