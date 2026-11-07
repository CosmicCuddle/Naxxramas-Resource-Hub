'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const vm=require('node:vm'),cp=require('node:child_process');
const {SOURCE_SHA}=require('../tools/audit-source-storage-budget.cjs');
const {PAGES,NAV,runs}=require('../tools/plan-page-draft.cjs');
const {recordPath,MANIFEST}=require('../tools/rehearse-resource-only-overlay.cjs');
const {RUNTIME}=require('../tools/plan-private-github-source-review.cjs');
const {FMT,read,withFullSiteRollback}=
  require('../tools/rehearse-browser-zip-full-site-rollback.cjs');
const root=path.resolve(__dirname,'..','..');
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const head=cp.execFileSync('git',['rev-parse','HEAD'],{
  cwd:root,encoding:'utf8'}).trim();
const gitStatus=()=>cp.execFileSync('git',['status','--porcelain=v1',
  '--untracked-files=all'],{cwd:root,encoding:'utf8'}).trim();
const at=(root,rel)=>path.join(root,...rel.split('/'));
function drafts(){
  const page=fs.readFileSync(at(root,PAGES[0]),'utf8');
  const token=runs(page).find(x=>x.kind==='text');
  if(!token)throw Error('Private test page needs an editable text field.');
  const navBytes=fs.readFileSync(at(root,NAV));
  const nav=JSON.parse(navBytes.toString('utf8'));
  nav.pages[1].intro='Private full-site copy and exact rollback proof';
  return {
    pages:{
      format:'naxx-local-draft-v3',
      sourceBranchHint:'feature/multi-file-editor-export-2026-11-05',
      sourceCommitVerified:false,createdAt:'2026-11-06T00:00:00.000Z',
      files:PAGES.map(rel=>({
        path:rel,sourceSha256:hash(fs.readFileSync(at(root,rel))),
        edits:rel===PAGES[0]?{[token.id]:'Private whole-site review page text'}:{}
      })),
      navigation:{path:NAV,sourceSha256:hash(navBytes),document:nav}
    },
    resources:{
      format:'naxx-local-resource-draft-v2',
      baselineSha256:SOURCE_SHA,
      changes:[{index:0,title:'Private full-site copied title'},
        {index:413,content:'Private copied paragraph.\n\nNext paragraph.'}]
    }
  };
}
async function browserZip(pages,resources){
  const browser={TextEncoder,Blob,Uint8Array,Uint32Array,DataView,
    crypto:crypto.webcrypto,document:{getElementById(){return null;}}};
  for(const file of ['export-zip.js','review-package.js']){
    vm.runInNewContext(fs.readFileSync(at(root,'editor/'+file),'utf8'),
      browser,{filename:file,timeout:5000});
  }
  const result=await browser.NaxxEditorReview.build(pages,resources,
    browser.NaxxEditorZip);
  return Buffer.from(await result.blob.arrayBuffer());
}
test('real browser ZIP preserves complete tracked site then restores every original file byte in private',async()=>{
  const initial=gitStatus(),d=drafts();
  const zip=await browserZip(d.pages,d.resources);
  const report=await withFullSiteRollback(root,zip,head);
  assert.equal(report.format,FMT);
  assert.ok(report.stagedTrackedFiles>10);
  assert.equal(report.stagedSourceFiles,415);
  assert.equal(report.revisedTrackedFiles,3);
  assert.equal(report.preservedUnchangedTrackedFiles,
    report.stagedTrackedFiles-report.revisedTrackedFiles);
  assert.equal(report.stagedTotalFiles,report.stagedTrackedFiles+415);
  assert.equal(report.rollbackTrackedFiles,report.stagedTrackedFiles);
  assert.equal(report.originalRootLoaderByteExact,true);
  assert.equal(report.customScriptsAssetsAndUnchangedPagesPreserved,true);
  assert.equal(report.completeSiteRuntimeHashMatched,true);
  assert.equal(report.privateRollbackExact,true);
  assert.equal(report.candidateResourceTreeDeleted,true);
  assert.equal(report.allTemporarySiteCopiesDeleted,true);
  assert.equal(report.originalRepositoryCheckoutUnchanged,true);
  assert.equal(report.completeGitHistoryBackupRetained,false);
  assert.equal(report.externalBackupCreated,false);
  assert.equal(report.canonicalLayoutApproved,false);
  assert.equal(report.realGitHubSaveReady,false);
  assert.equal(report.ownerApproved,false);
  assert.equal(report.canApply,false);
  assert.equal(report.canPublish,false);
  assert.equal(report.websiteFilesWritten,0);
  assert.equal(report.gitHubWrites,0);
  assert.equal(report.sourceValuesPrinted,false);
  assert.equal(hash(fs.readFileSync(at(root,RUNTIME))),SOURCE_SHA);
  assert.equal(gitStatus(),initial);
});
test('damage to protected loader, unrelated assets, changed page, overlay or rollback copy fails closed',async()=>{
  const d=drafts(),zip=await browserZip(d.pages,d.resources);
  let sitePath,backupPath;
  const result=await withFullSiteRollback(root,zip,head,async inspection=>{
    const {site,backup,verifyStaged,verifyBackup,trackedNames}=inspection;
    sitePath=site;backupPath=backup;
    const protectedAsset=trackedNames.find(name=>
      name!=='index.html'&&!PAGES.includes(name)&&name!==NAV&&
      name!==RUNTIME&&name!==recordPath(0)&&
      !name.startsWith('content/resource-overlays/'));
    assert.ok(protectedAsset,'Expected at least one original unchanged asset.');
    function tamper(folder,relative,data,verify,error){
      const file=at(folder,relative),old=fs.readFileSync(file);
      try{
        fs.writeFileSync(file,data);
        assert.throws(verify,error);
      }finally{fs.writeFileSync(file,old);}
    }
    tamper(site,'index.html',Buffer.from('incorrect loader'),
      verifyStaged,/untouched website asset/);
    tamper(site,protectedAsset,Buffer.from('incorrect private custom file'),
      verifyStaged,/untouched website asset/);
    tamper(site,PAGES[0],Buffer.from('changed page not reviewed'),
      verifyStaged,/reviewed tracked page/);
    tamper(site,recordPath(400),Buffer.from('damaged unchanged record'),
      verifyStaged,/overlay fragment/);
    tamper(site,MANIFEST,Buffer.from('damaged manifest'),
      verifyStaged,/overlay fragment/);
    tamper(site,RUNTIME,Buffer.from('damaged reconstructed website'),
      verifyStaged,/reviewed tracked page/);
    const unexpected=path.join(site,'unreviewed-extra.txt');
    fs.writeFileSync(unexpected,'not approved for source migration');
    try{assert.throws(verifyStaged,/missing or unexpected/);}
    finally{fs.rmSync(unexpected);}
    tamper(backup,'index.html',Buffer.from('damaged backup copy'),
      verifyBackup,/Independent original website copy is damaged/);
    assert.equal(verifyBackup(),true);
    assert.equal(verifyStaged().resourceSourceFiles,415);
    return {tamperingRejected:true};
  });
  assert.equal(result.privateRollbackExact,true);
  assert.equal(result.allTemporarySiteCopiesDeleted,true);
  assert.equal(result.originalRepositoryCheckoutUnchanged,true);
  assert.ok(!fs.existsSync(sitePath)&&!fs.existsSync(backupPath));
});
test('incomplete review ZIP and wrong reviewed Git commit cannot stage full tracked copy',async()=>{
  const d=drafts(),zip=await browserZip(d.pages,d.resources);
  await assert.rejects(withFullSiteRollback(root,zip,'f'.repeat(40)),
    /Checkout commit changed/);
  const onlyPages=await browserZip(d.pages,null);
  await assert.rejects(withFullSiteRollback(root,onlyPages,head),
    /Full mixed source package requires page and resource review drafts/);
});
test('whole-site rollback proof cannot push, publish, access network or claim a retained backup',()=>{
  const src=fs.readFileSync(at(root,
    'editor/tools/rehearse-browser-zip-full-site-rollback.cjs'),'utf8');
  for(const unsafe of ['fetch(', 'https.request(', 'update_ref(',
    'create_commit(', 'git push','git commit','GITHUB_TOKEN',
    'process.env.'])
    assert.equal(src.includes(unsafe),false,unsafe);
  assert.match(src,/externalBackupCreated:false/);
  assert.match(src,/completeGitHistoryBackupRetained:false/);
  assert.match(src,/canonicalLayoutApproved:false/);
  assert.match(src,/ownerApproved:false,canApply:false/);
});
