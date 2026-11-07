'use strict';
/* This check has no Chrome dependency: the live Chrome job executes the
 * actual DOM scenario from this expression on its disposable loopback site.
 */
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {revisionDemoBrowserProbe}=
  require('../tools/private-revision-demo-browser-probe.cjs');
const expression=revisionDemoBrowserProbe();
const smoke=fs.readFileSync(path.join(__dirname,'..','tools',
  'browser-smoke-complete-site.cjs'),'utf8');
test('fictional real-Chrome probe compiles and is wired into disposable website checks',()=>{
  assert.ok(expression.startsWith('(async function('));
  assert.ok(expression.endsWith(')()'));
  const executable=new vm.Script(expression,{filename:'fictional-browser-expression.js'});
  assert.ok(executable);
  assert.match(smoke,/require\('\.\/private-revision-demo-browser-probe\.cjs'\)/);
  assert.match(smoke,/revisionDemoBrowserProbe\(\)/);
  assert.match(smoke,/\/editor\/revision-demo-preview\.html/);
  assert.match(smoke,/for\(const width of \[1440,390\]\)/);
  assert.match(smoke,/revisionDemoChecks\.length,2/);
});
test('probe only handles invented data and has no network, upload or source-reader endpoints',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','tools',
    'private-revision-demo-browser-probe.cjs'),'utf8');
  for(const dangerous of [
    'fetch(', 'XMLHttpRequest','sendBeacon(', 'localStorage',
    'writeFileSync(', 'readFileSync(', 'git push', 'window.location=',
    'navigator.clipboard', 'createObjectURL(', 'input[type=password]'
  ])assert.equal(source.includes(dangerous),false,
    'A private fictional Chrome probe must not use '+dangerous);
  assert.match(source,/window\.confirm=originalConfirm/);
  assert.match(expression,/Older draft refused/);
  assert.match(expression,/noHorizontalOverflow/);
  assert.match(expression,/aria-live/);
  assert.match(expression,/connect-src 'none'/);
  assert.match(expression,/window\.confirm=originalConfirm/);
});
test('probe does not claim real authenticated sources, deployment, or backups',()=>{
  assert.match(expression,/Fictional/);
  assert.match(expression,/NOT A REAL SAVE/);
  assert.doesNotMatch(expression,/canPublish\s*=\s*true/);
  assert.doesNotMatch(expression,/canApply\s*=\s*true/);
  assert.doesNotMatch(expression,/GitHub\.update|gh api|process\.env|credentials/i);
});
