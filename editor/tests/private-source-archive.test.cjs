'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {createArchive,verifyArchive,outputOutsideCheckout,saveLocalArchive,
  archivePaths,README,command}=require('../tools/package-private-resource-tree.cjs');
const {decode,encode}=require('../tools/private-source-zip.cjs');
const {resourcePath,MANIFEST}=require('../tools/rehearse-proposed-resource-tree.cjs');
const checkout=path.resolve(__dirname,'..','..');
const original=fs.readFileSync(path.join(checkout,'site-content.html'));
const BASE='34455f6d901c538e2491a8c16681692e4c02d918b1984d7d0ba081aacb1049e8';
const draft={format:'naxx-local-resource-draft-v2',baselineSha256:BASE,changes:[
  {index:0,title:'Private reviewed title and content',content:'One line\n\nAnother line'},
  {index:213,content:'Review middle text'},
  {index:413,title:'Reviewed final title'}
]};
function temp(fn){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'naxx-local-export-test-'));
  fs.chmodSync(root,0o700);
  return Promise.resolve().then(()=>fn(root)).finally(()=>{
    fs.rmSync(root,{recursive:true,force:true});
  });
}
test('private source ZIP includes all 418 exact candidate files, readme and no deployable loader',async()=>{
  const packageData=await createArchive(original,draft);
  assert.equal(packageData.report.archiveEntries,419);
  assert.equal(packageData.report.githubReady,false);
  assert.equal(packageData.report.publishable,false);
  assert.equal(packageData.report.deployable,false);
  assert.equal(packageData.report.fullRepositoryBackup,false);
  assert.equal(packageData.report.exactReconstruction,true);
  assert.equal(packageData.report.exactRollback,true);
  assert.equal(packageData.report.changedFragments,3);
  assert.ok(packageData.report.archiveBytes>30_000_000);
  const parsed=decode(packageData.bytes,archivePaths());
  assert.equal(parsed.entryCount,419);
  assert.equal(new Set(parsed.entries.map(e=>e.name)).size,419);
  assert.ok(parsed.entries.some(e=>e.name===MANIFEST));
  assert.ok(parsed.entries.some(e=>e.name===resourcePath(0)));
  assert.ok(parsed.entries.some(e=>e.name===resourcePath(213)));
  assert.ok(parsed.entries.some(e=>e.name===resourcePath(413)));
  assert.ok(!parsed.entries.some(e=>e.name==='index.html'||e.name==='site-content.html'));
  const manifest=JSON.parse(parsed.entries.find(e=>e.name===MANIFEST).bytes.toString('utf8'));
  assert.deepEqual(manifest.changedPaths,
    [resourcePath(0),resourcePath(213),resourcePath(413)]);
  assert.equal(manifest.publishable,false);
  assert.equal(manifest.githubReady,false);
  assert.equal(manifest.resources.length,414);
  const readme=parsed.entries.find(e=>e.name===README).bytes.toString('utf8');
  assert.match(readme,/PRIVATE REVIEW ONLY/);
  assert.match(readme,/DO NOT UPLOAD/);
  assert.match(readme,/NOT A COMPLETE REPOSITORY BACKUP/);
  assert.ok(!JSON.stringify(manifest).includes('Review middle text'));
  assert.ok(!JSON.stringify(packageData.report).includes('Reviewed final title'));
});
test('unedited private archive reconstructs and independently verifies original SHA',async()=>{
  const result=await createArchive(original,null);
  const outcome=await verifyArchive(result.bytes,original,null);
  assert.equal(result.report.changedFragments,0);
  assert.equal(result.report.stagedSourceSha256,BASE);
  assert.equal(outcome.staged.originalSourceByteIdentical,true);
  assert.equal(outcome.rollback.originalSourceByteIdentical,true);
  assert.equal(outcome.independentExtractionVerified,true);
});
test('changed private archive rejects any altered content, filename or extra path',async()=>{
  const result=await createArchive(original,draft);
  const copy=Buffer.from(result.bytes);
  // A byte inside a fragment changes without changing stored header checksums.
  copy[500]^=0x1;
  assert.throws(()=>decode(copy,archivePaths()),/checksum|canonical|invalid|mismatch/i);
  await assert.rejects(verifyArchive(copy,original,draft),/checksum|canonical|invalid|mismatch/i);
  const parsed=decode(result.bytes,archivePaths());
  assert.throws(()=>encode([...parsed.entries,{name:'index.html',bytes:Buffer.from('loader')}],
    new Set([...archivePaths(),'index.html'])),/Invalid|Unapproved|unsafe|ZIP file list/i);
  const wrong=Buffer.from(result.bytes);
  const at=wrong.indexOf(Buffer.from('content/legacy/resources/0001.fragment'));
  assert.ok(at>=0);
  wrong.write('x',at,'utf8');
  assert.throws(()=>decode(wrong,archivePaths()),/path|offset|central|filename|checksum|canonical/i);
});
test('an otherwise valid ZIP with a rewritten privacy warning is rejected',async()=>{
  const originalArchive=await createArchive(original,null);
  const parsed=decode(originalArchive.bytes,archivePaths());
  const altered=parsed.entries.map(entry=>entry.name===README ?
    {name:entry.name,bytes:Buffer.from('PRIVATE REVIEW ONLY\nunsafe edited instructions\n','utf8')} :
    entry);
  // A new ZIP with recalculated CRCs must still fail exact notice validation.
  const recreated=encode(altered,archivePaths());
  assert.equal(decode(recreated,archivePaths()).entryCount,419);
  await assert.rejects(verifyArchive(recreated,original,null),/altered private source confidentiality warning/);
});
test('stale source and draft are rejected before any archive creation',async()=>{
  await assert.rejects(createArchive(Buffer.concat([original,Buffer.from('x')]),draft),
    /exact original|SHA/i);
  await assert.rejects(createArchive(original,{...draft,baselineSha256:'0'.repeat(64)}),
    /mismatched|Unsupported/i);
  await assert.rejects(createArchive(original,{...draft,changes:[{index:0,content:'<script>alert(1)</script>'}]}),
    /Invalid|unsafe|Unsupported/i);
});
test('locally saved private archive is outside the checkout and never overwritten',async()=>{
  await temp(async root=>{
    const result=await createArchive(original,null);
    const output=path.join(root,'Private-Resource-Review.zip');
    const saved=saveLocalArchive(result.bytes,output,checkout);
    assert.equal(saved.saved,true);
    assert.equal(saved.outsideCheckout,true);
    assert.equal(saved.byteCount,result.report.archiveBytes);
    assert.deepEqual(fs.readFileSync(output),result.bytes);
    if(process.platform!=='win32')
      assert.equal(fs.statSync(output).mode&0o077,0);
    assert.throws(()=>saveLocalArchive(result.bytes,output,checkout),/already exists/);
    assert.throws(()=>outputOutsideCheckout(path.join(checkout,'editor','danger.zip'),checkout),
      /outside the repository/);
    assert.throws(()=>outputOutsideCheckout('relative.zip',checkout),/absolute output/);
    if(process.platform!=='win32'){
      const alias=path.join(root,'alias');
      fs.symlinkSync(checkout,alias,'dir');
      assert.throws(()=>outputOutsideCheckout(path.join(alias,'danger.zip'),checkout),
        /outside the repository/);
    }
  });
});
test('private CLI only writes on explicit --output and never into repository',async()=>{
  await temp(async root=>{
    await assert.rejects(command([],checkout),/Usage/);
    await assert.rejects(command(['--output',path.join(checkout,'editor','unsafe.zip')],checkout),
      /outside the repository/);
    const filename=path.join(root,'Command-Test.zip');
    const data=await command(['--output',filename],checkout);
    assert.equal(data.localOutputCreated,true);
    assert.equal(data.outputBytesVerified,true);
    assert.equal(data.privateOnly,true);
    assert.equal(data.fullRepositoryBackup,false);
    assert.equal(fs.existsSync(filename),true);
    assert.equal(decode(fs.readFileSync(filename),archivePaths()).entryCount,419);
    await assert.rejects(command(['--output',filename],checkout),/already exists/);
  });
});
