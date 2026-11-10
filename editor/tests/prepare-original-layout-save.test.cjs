'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const cp=require('node:child_process'),vm=require('node:vm');
const crypto=require('node:crypto');
const {PAGES,NAV,runs}=require('../tools/plan-page-draft.cjs');
const {SOURCE_SHA}=require('../tools/audit-source-storage-budget.cjs');
const {gitBlobOid,gitTreeInventory,treeOid}=
  require('../tools/rehearse-browser-zip-git-tree-intent.cjs');
const {prepareOriginalLayoutSave,FORMAT}=
  require('../tools/prepare-original-layout-save.cjs');
const root=path.resolve(__dirname,'..','..'),editor=path.resolve(__dirname,'..');
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const git=(...args)=>cp.execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
async function sampleZip(){
  const original=fs.readFileSync(path.join(root,PAGES[0]),'utf8');
  const first=runs(original).find(x=>x.kind==='text');
  assert.ok(first);
  const navBytes=fs.readFileSync(path.join(root,NAV));
  const nav=JSON.parse(navBytes.toString('utf8'));
  nav.pages[0].title='Protected Save sample (not published)';
  const pages={format:'naxx-local-draft-v3',
    sourceBranchHint:'feature/multi-file-editor-export-2026-11-05',
    sourceCommitVerified:false,createdAt:'2026-11-10T10:00:00.000Z',
    files:PAGES.map(file=>({
      path:file,sourceSha256:sha(fs.readFileSync(path.join(root,file))),
      edits:file===PAGES[0]?{[first.id]:'One protected Save sample edit'}:{}
    })),
    navigation:{path:NAV,sourceSha256:sha(navBytes),document:nav}
  };
  const resources={format:'naxx-local-resource-draft-v2',
    baselineSha256:SOURCE_SHA,changes:[
      {index:0,title:'Example original-layout Save only'},
      {index:413,content:'Example first paragraph.\n\nExample second paragraph.'}
    ]
  };
  const context={TextEncoder,Blob,Uint8Array,Uint32Array,DataView,
    crypto:crypto.webcrypto,document:{getElementById(){return null;}}};
  for(const filename of ['export-zip.js','review-package.js'])
    vm.runInNewContext(fs.readFileSync(path.join(editor,filename),'utf8'),
      context,{filename,timeout:5000});
  const packed=await context.NaxxEditorReview.build(pages,resources,context.NaxxEditorZip);
  return Buffer.from(await packed.blob.arrayBuffer());
}
test('real browser ZIP saves only THREE changed original Git paths, not 415 new resource files',async()=>{
  const head=git('rev-parse','HEAD'),before=git('status','--porcelain=v1');
  const original=gitTreeInventory(root,head);
  const zip=await sampleZip();
  const prepared=await prepareOriginalLayoutSave(root,zip,head);
  assert.equal(prepared.format,FORMAT);
  assert.equal(prepared.expectedCommit,head);
  assert.equal(prepared.originalTreeOid,original.treeOid);
  assert.equal(prepared.originalWebsiteLayoutPreserved,true);
  assert.equal(prepared.noNewResourceSourceFiles,true);
  assert.equal(prepared.changedExistingFiles,3);
  assert.deepEqual(prepared.files.map(x=>x.path).sort(),
    [PAGES[0],NAV,'site-content.html'].sort());
  assert.equal(prepared.trackedFileCount,original.files.length);
  assert.equal(prepared.unchangedFilesPreserved,original.files.length-3);
  assert.equal(prepared.githubWrites,0);
  assert.equal(prepared.published,false);
  const byName=new Map(prepared.files.map(x=>[x.path,x]));
  for(const item of prepared.files){
    assert.ok(item.bytes.length>0);
    assert.equal(item.oid,gitBlobOid(item.bytes));
    assert.equal(item.sha256,sha(item.bytes));
    assert.notEqual(item.oid,item.oldOid);
    assert.equal(item.mode,original.files.find(x=>x.path===item.path).mode);
  }
  assert.ok(byName.get('site-content.html').bytes.length>29*1024*1024);
  assert.equal(prepared.fullSiteSha256,sha(byName.get('site-content.html').bytes));
  assert.notEqual(prepared.fullSiteSha256,SOURCE_SHA);
  const modified=new Map(prepared.files.map(x=>[x.path,x.oid]));
  const proposed=original.files.map(x=>({
    ...x,oid:modified.has(x.path)?modified.get(x.path):x.oid
  }));
  assert.equal(treeOid(proposed),prepared.nextTreeOid);
  assert.equal(git('status','--porcelain=v1'),before);
  assert.equal(sha(fs.readFileSync(path.join(root,'site-content.html'))),SOURCE_SHA);
  assert.equal(fs.existsSync(path.join(root,'content','resource-overlays')),false);
});
test('wrong source HEAD or malformed ZIP never yields a Save candidate',async()=>{
  const head=git('rev-parse','HEAD'),zip=await sampleZip();
  await assert.rejects(prepareOriginalLayoutSave(root,zip,'f'.repeat(40)),/Checkout commit changed/);
  await assert.rejects(prepareOriginalLayoutSave(root,Buffer.alloc(64),head));
  assert.equal(sha(fs.readFileSync(path.join(root,'site-content.html'))),SOURCE_SHA);
});
test('original-layout Save source has no GitHub client, token or writable original checkout',()=>{
  const source=fs.readFileSync(path.join(editor,'tools','prepare-original-layout-save.cjs'),'utf8');
  for(const forbidden of [
    'https.request','GITHUB_TOKEN','GH_TOKEN','updateRefs(', 'git push',
    'createCommit(', 'createTree(', 'fs.writeFileSync'
  ])assert.equal(source.includes(forbidden),false,forbidden);
});
