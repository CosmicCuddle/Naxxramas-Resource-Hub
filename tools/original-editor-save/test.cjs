'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {
  BRANCH,FILE,BASELINE_BLOB,gitBlobSha,splitEmbedded,
  validateCandidate,validateBaseline
}=require('./server.cjs');

const root=path.resolve(__dirname,'..','..');
const sourcePath=path.join(root,'site-content.html');
const helperPath=path.join(root,'assets','naxx-original-editor-save.js');
const indexPath=path.join(root,'index.html');
const launcherPath=path.join(root,'Start-Naxxramas-Editor.cmd');

function sha256(bytes){
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

test('original visual editor source remains the exact approved 31 MB baseline',()=>{
  const bytes=fs.readFileSync(sourcePath);
  assert.equal(bytes.length,30976969);
  assert.equal(gitBlobSha(bytes),BASELINE_BLOB);
  assert.equal(sha256(bytes),
    '34455f6d901c538e2491a8c16681692e4c02d918b1984d7d0ba081aacb1049e8');
  const baseline=validateBaseline();
  assert.ok(baseline.split.prefix.length>1000);
  assert.ok(baseline.split.suffix.length>1000);
});

test('Save candidate may change embedded DATA but no surrounding original editor bytes',()=>{
  const baseline=validateBaseline();
  const original=baseline.bytes.toString('utf8');
  const parts=splitEmbedded(original);
  const prefix='window.NAXX_DATA = ';
  assert.ok(parts.body.startsWith(prefix)&&parts.body.endsWith(';'));
  const data=JSON.parse(parts.body.slice(prefix.length,-1));
  assert.equal(data.resources.length,414);
  const previous=data.siteSubtitle;
  data.siteSubtitle=previous+' [private Save test]';
  const json=JSON.stringify(data).replace(/<\/script/gi,'<\\/script');
  const candidate=Buffer.from(parts.prefix+prefix+json+';'+parts.suffix,'utf8');
  const checked=validateCandidate(candidate,baseline);
  assert.equal(checked.resourceCount,414);
  assert.notEqual(checked.blobSha,BASELINE_BLOB);

  const tampered=Buffer.from(candidate);
  const marker=Buffer.from('<title>');
  const pos=tampered.indexOf(marker);
  assert.ok(pos>=0);
  tampered[pos]=0x58;
  assert.throws(()=>validateCandidate(tampered,baseline),
    /outside the editor data changed/);
});

test('GitHub Save target is one draft branch and site-content only',()=>{
  assert.equal(BRANCH,'editor-saves/original-ui');
  assert.equal(FILE,'site-content.html');
  const server=fs.readFileSync(__filename.replace(/test\.cjs$/,'server.cjs'),'utf8');
  assert.match(server,/\/git\/refs\/heads\/['"]?\+BRANCH/);
  assert.match(server,/path:FILE,mode:'100644',type:'blob'/);
  assert.doesNotMatch(server,/\/git\/refs\/heads\/main/);
  assert.doesNotMatch(server,/FILE\s*=\s*['"]index\.html/);
  assert.doesNotMatch(server,/git push/);
});

test('original editor Save bridge uses the current DATA and never exports replacement index.html',()=>{
  const helper=fs.readFileSync(helperPath,'utf8');
  assert.match(helper,/JSON\.stringify\(DATA\)/);
  assert.match(helper,/fetch\('\/site-content\.html'/);
  assert.match(helper,/\/api\/original-editor\/save/);
  assert.match(helper,/editor-saves\/original-ui/);
  assert.doesNotMatch(helper,/name\s*:\s*['"]index\.html/);
  assert.doesNotMatch(helper,/replace the existing index\.html/i);
});

test('root loader keeps the same visual site and loads Save bridge last',()=>{
  const index=fs.readFileSync(indexPath,'utf8');
  const game=index.indexOf("gameClientsURL + '");
  const save=index.indexOf("originalEditorSaveURL + '");
  assert.ok(game>=0&&save>game);
  assert.match(index,/assets\/naxx-original-editor-save\.js\?v=1/);
  assert.match(index,/site-content\.html/);
});

test('one-click Windows launcher needs Node and GitHub CLI, not Git or GitHub Desktop',()=>{
  const cmd=fs.readFileSync(launcherPath,'utf8');
  assert.match(cmd,/where node\.exe/i);
  assert.match(cmd,/where gh\.exe/i);
  assert.match(cmd,/tools\\original-editor-save\\server\.cjs/i);
  assert.doesNotMatch(cmd,/where git\.exe/i);
  assert.doesNotMatch(cmd,/GitHub Desktop/i);
});
