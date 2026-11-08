'use strict';
/* Exact original 31 MB source in a fully disposable synthetic Git repo.
 * The test creates fictional title/content edits and NEVER updates or
 * commits to the real repository, published site or original Admin.
 */
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const cp=require('node:child_process');
const crypto=require('node:crypto');
const {webcrypto}=crypto;
const {splitBase,makeManifest}=require('../tools/rehearse-versioned-resource-sessions.cjs');
const {restoreInMemory}=require('../tools/check-legacy-roundtrip.cjs');
const {recordPath,MANIFEST}=require('../tools/rehearse-resource-only-overlay.cjs');
const {replaceTitleInRecord}=require('../tools/rehearse-title-edit.cjs');
const {replaceContentInRecord}=require('../tools/rehearse-content-edit.cjs');
const {SOURCE_SHA}=require('../tools/audit-source-storage-budget.cjs');
const {verifyPinnedLocalRevisionChain}=require('../tools/verify-pinned-local-revision-chain.cjs');
const reader=require('../revision-source-reader.js');
const review=require('../revision-draft-review.js');

const original=fs.readFileSync(path.resolve(__dirname,'..','..','site-content.html'));
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
assert.equal(hash(original),SOURCE_SHA);
const split=splitBase(original);
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'naxx-private-pinned-chain-'));
fs.chmodSync(dir,0o700);
const git=(...args)=>cp.execFileSync('git',['-C',dir,...args],{
  encoding:'utf8',maxBuffer:1024*1024,stdio:['ignore','pipe','pipe'],
  env:{...process.env,GIT_CONFIG_NOSYSTEM:'1',GIT_OPTIONAL_LOCKS:'0'}
}).trim();
function write(relative,data){
  const file=path.join(dir,...relative.split('/'));
  fs.mkdirSync(path.dirname(file),{recursive:true,mode:0o700});
  fs.writeFileSync(file,data,{mode:0o600});
}
function commit(message){
  git('add','-A');
  git('commit','-q','-m',message);
  return git('rev-parse','HEAD');
}
function stage(records,revision,parent){
  const manifest=makeManifest(split,records,revision,parent);
  write(MANIFEST,JSON.stringify(manifest)+'\n');
  for(let i=0;i<414;i++)write(recordPath(i),records[i]);
  write('site-content.html',restoreInMemory(split,records));
  return manifest;
}
git('init','-q');git('config','user.name','Private Revision Test');
git('config','user.email','revision-test@invalid.example');
write('site-content.html',original);
const base=commit('Private exact-original baseline');
const firstRecords=split.records.slice();
firstRecords[0]=replaceTitleInRecord(firstRecords[0],
  'Fictional safe first Git resource revision').record;
const firstManifest=stage(firstRecords,1,SOURCE_SHA);
const c1=commit('Fictional resource revision one');
const secondRecords=firstRecords.slice();
secondRecords[413]=replaceContentInRecord(secondRecords[413],
  'Second fictional verified Git revision.\n\nA multiline paragraph.').record;
const secondManifest=stage(secondRecords,2,firstManifest.sourceSha256);
const c2=commit('Fictional resource revision two');

test.after(()=>fs.rmSync(dir,{recursive:true,force:true}));

test('two pinned Git revisions reconstruct real 31MB source and yield read-only trust',async()=>{
  const out=verifyPinnedLocalRevisionChain(dir,[base,c1,c2]);
  const {evidence,snapshot,trust}=out;
  assert.equal(evidence.pinnedBaseCommit,base);
  assert.equal(evidence.pinnedTipCommit,c2);
  assert.equal(evidence.committedRevisionCount,2);
  assert.deepEqual(evidence.revisions.map(x=>x.revision),[1,2]);
  assert.deepEqual(evidence.revisions.map(x=>x.editedResources),[1,1]);
  assert.equal(evidence.revisions[0].parentSha256,SOURCE_SHA);
  assert.equal(evidence.revisions[1].parentSha256,firstManifest.sourceSha256);
  assert.equal(evidence.remoteGitHubHeadAuthenticated,false);
  assert.equal(evidence.remoteLockHeld,false);
  assert.equal(evidence.sourceLayoutApproved,false);
  assert.equal(evidence.readOnly,true);
  assert.equal(evidence.canApply,false);
  assert.equal(evidence.canPush,false);
  assert.equal(evidence.canPublish,false);
  assert.equal(evidence.filesWritten,0);
  assert.equal(evidence.gitHubWrites,0);
  assert.equal(snapshot.fragments.length,414);
  assert.equal(snapshot.fragments[0],firstRecords[0]);
  assert.equal(snapshot.fragments[413],secondRecords[413]);
  for(let i=1;i<413;i++)assert.equal(snapshot.fragments[i],split.records[i]);
  assert.equal(trust.expectedRevision,2);
  assert.equal(trust.expectedSourceSha256,secondManifest.sourceSha256);
  assert.equal(trust.expectedParentSha256,firstManifest.sourceSha256);
  const actual=await reader.inspect(snapshot,trust,webcrypto);
  assert.equal(actual.fullSourceMatched,true);
  assert.equal(actual.sourceSha256,secondManifest.sourceSha256);
  const secondDraft=await review.prepare(snapshot,trust,webcrypto,[
    {index:1,title:'Fictional third unsaved edit'}]);
  assert.equal(secondDraft.revision,2);
  assert.equal(secondDraft.sourceSha256,secondManifest.sourceSha256);
  assert.equal(secondDraft.changes[0].expectedSha256,
    snapshot.manifest.resources[1].sha256);
  assert.equal(fs.readFileSync(path.join(dir,'site-content.html')).equals(
    restoreInMemory(split,secondRecords)),true);
});

test('skipped parent, wrong tip, missing commit and dishonest commit chain are refused',()=>{
  assert.throws(()=>verifyPinnedLocalRevisionChain(dir,[base,c2]),
    /contiguous single-parent/i);
  assert.throws(()=>verifyPinnedLocalRevisionChain(dir,[base,c1]),
    /does not match the independently pinned tip/i);
  assert.throws(()=>verifyPinnedLocalRevisionChain(dir,[base,'0'.repeat(40)]),
    /does not match the independently pinned tip/i);
  assert.throws(()=>verifyPinnedLocalRevisionChain(dir,[base,c1,c1]),
    /distinct, independently pinned Git commits/i);
  assert.throws(()=>verifyPinnedLocalRevisionChain(dir,[]),
    /at least two distinct/i);
});

function badCommit(operation,message){
  assert.equal(git('rev-parse','HEAD'),c2);
  operation();
  const bad=commit(message);
  try{
    assert.throws(()=>verifyPinnedLocalRevisionChain(dir,[base,c1,c2,bad]));
  }finally{
    git('reset','--hard',c2);
    assert.equal(git('rev-parse','HEAD'),c2);
  }
}
test('extra or missing pinned overlay paths fail closed',()=>{
  badCommit(()=>{
    write('content/resource-overlays/unexpected.txt','forbidden source file');
  },'Invalid extra file in experimental overlay');
  badCommit(()=>{
    fs.unlinkSync(path.join(dir,...recordPath(4).split('/')));
  },'Invalid missing resource fragment');
});
test('changed protected bytes are refused even when manifest and runtime checksums agree',()=>{
  badCommit(()=>{
    const next=secondRecords.slice();
    next[0]=replaceTitleInRecord(next[0],
      'Fictional third revision title').record+' ';
    stage(next,3,secondManifest.sourceSha256);
  },'Invalid record formatting change');
});
test('candidate with an additional unrelated tracked page is rejected',()=>{
  badCommit(()=>{
    const next=secondRecords.slice();
    next[1]=replaceContentInRecord(next[1],
      'Fictional third revision on resource 2.').record;
    stage(next,3,secondManifest.sourceSha256);
    write('unrelated-private-note.txt','No other tracked page may change');
  },'Invalid unrelated file change');
});
test('candidate with manifest checksum claims but wrong Git runtime is refused',()=>{
  badCommit(()=>{
    const next=secondRecords.slice();
    next[3]=replaceTitleInRecord(next[3],
      'Fictional third revision resource 4').record;
    stage(next,3,secondManifest.sourceSha256);
    write('site-content.html',restoreInMemory(split,secondRecords));
  },'Invalid regenerated source mismatch');
});

test('Git revision verifier cannot connect, save, merge or deploy',()=>{
  const modulePath=path.join(__dirname,'..','tools',
    'verify-pinned-local-revision-chain.cjs');
  const contents=fs.readFileSync(modulePath,'utf8');
  for(const banned of ['fetch(', 'https.request(', 'XMLHttpRequest',
    'writeFileSync(', 'git push', 'git commit', 'git update-ref',
    'GITHUB_TOKEN','Authorization:','localStorage','createObjectURL('])
    assert.equal(contents.includes(banned),false,
      'Unexpected source writer or network path '+banned);
  assert.deepEqual(Object.keys(require(modulePath)),
    ['verifyPinnedLocalRevisionChain']);
  assert.equal(hash(original),SOURCE_SHA);
});


test('noncanonical or forged manifest data cannot become trusted revision evidence',()=>{
  badCommit(()=>{
    const next=secondRecords.slice();
    next[2]=replaceTitleInRecord(next[2],
      'Fictional next title for manifest trial').record;
    stage(next,3,secondManifest.sourceSha256);
    const file=path.join(dir,...MANIFEST.split('/'));
    const parsed=JSON.parse(fs.readFileSync(file,'utf8'));
    parsed.resources[2].sha256='e'.repeat(64);
    fs.writeFileSync(file,JSON.stringify(parsed)+'\n');
  },'Invalid claimed fragment checksum in canonical manifest');
  badCommit(()=>{
    const next=secondRecords.slice();
    next[2]=replaceTitleInRecord(next[2],
      'Fictional next title for duplicate-key trial').record;
    stage(next,3,secondManifest.sourceSha256);
    const file=path.join(dir,...MANIFEST.split('/'));
    const parsed=JSON.parse(fs.readFileSync(file,'utf8'));
    const body=JSON.stringify(parsed);
    fs.writeFileSync(file,
      body.slice(0,-1)+',"revision":3}\n');
  },'Invalid duplicate top-level key in manifest JSON');
});

test('incorrect parent fingerprint and no-op revision cannot pass Git chain review',()=>{
  badCommit(()=>{
    const next=secondRecords.slice();
    next[1]=replaceContentInRecord(next[1],
      'Fictional third revision with a false parent checksum').record;
    stage(next,3,'f'.repeat(64));
  },'Invalid chain parent checksum');
  badCommit(()=>{
    stage(secondRecords,3,secondManifest.sourceSha256);
  },'Invalid no-op revision with no edited resource');
});

test('symlink and malformed UTF-8 resource blobs fail closed',()=>{
  badCommit(()=>{
    const file=path.join(dir,...recordPath(9).split('/'));
    fs.unlinkSync(file);
    fs.symlinkSync('../manifest.json',file);
  },'Invalid Git symlink instead of resource file');
  badCommit(()=>{
    write(recordPath(12),Buffer.from([0xff,0xfe,0xfd]));
  },'Invalid resource blob encoding');
});


test('a new protected object member is rejected even alongside a valid title edit',()=>{
  badCommit(()=>{
    const next=secondRecords.slice();
    const updated=replaceTitleInRecord(next[6],
      'Fictional title plus forbidden metadata').record;
    const open=updated.indexOf('{');
    assert.ok(open>=0,'Original record must be a literal object');
    next[6]=updated.slice(0,open+1)+
      'unexpectedProtectedField: "must never be added",'+
      updated.slice(open+1);
    stage(next,3,secondManifest.sourceSha256);
  },'Invalid protected object member in resource');
});
