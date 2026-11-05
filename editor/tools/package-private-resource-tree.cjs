'use strict';
/*
 * LOCAL-ONLY, PRIVATE SOURCE-TREE REVIEW ARCHIVE.
 *
 * Never called by CI as a persistent upload. The archive contains all 414
 * original resource objects, related layout source, and the candidate manifest.
 * IT IS NOT SAFE TO PUBLISH. It is NOT a GitHub-ready update or full backup.
 *
 * A local operator must explicitly specify --output OUTSIDE the repository.
 * The output path is never overwritten. CI only exercises private OS-temp
 * buffers and directories, then deletes them.
 */
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const crypto=require('node:crypto');
const {withCandidateTree,verifyCandidate,rollbackCandidate,
  expectedPaths,MANIFEST}=require('./rehearse-proposed-resource-tree.cjs');
const {planChangeSet}=require('./rehearse-resource-change-set.cjs');
const {encode,decode}=require('./private-source-zip.cjs');
const BASE='34455f6d901c538e2491a8c16681692e4c02d918b1984d7d0ba081aacb1049e8';
const README='PRIVATE-REVIEW-ONLY-READ-ME-FIRST.txt';
const archivePaths=()=>new Set([...expectedPaths(),README]);
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function readableFile(root,relative){
  const file=path.join(root,...relative.split('/'));
  const stat=fs.lstatSync(file);
  if(!stat.isFile()||stat.isSymbolicLink())throw Error('Private source-tree file is not regular.');
  return fs.readFileSync(file);
}
function instructions(metadata){
  return [
    'NAXXRAMAS RESOURCE SOURCE-TREE — PRIVATE REVIEW ONLY',
    '',
    'WARNING: This archive contains the complete original resource source data.',
    'KEEP PRIVATE. DO NOT UPLOAD IT TO A PUBLIC GITHUB BRANCH, STATIC WEBSITE,',
    'FILE-SHARING SITE, OR UNREVIEWED SUPPORT TICKET.',
    '',
    'NOT A WEBSITE PATCH. NOT GITHUB-READY. NOT A COMPLETE REPOSITORY BACKUP.',
    'Do not copy these files into the live website or replace index.html.',
    'The complete current website still requires its generated site-content.html.',
    '',
    'Contains: 414 numeric resource fragments, three layout files, one source',
    'manifest with checksums, and this safety note.',
    'These are candidate paths, not approved production repository paths.',
    '',
    'Original site SHA-256: '+metadata.originalSourceSha256,
    'Candidate rebuilt site SHA-256: '+metadata.stagedSourceSha256,
    'Candidate source-tree files: 418 (plus this note)',
    'Changed resource positions: '+metadata.changedPaths.length,
    '',
    'Before any adoption: review owner approval, independently verify the',
    'complete repository backup and Git history, validate rollback, assess',
    'the additional ~31 MB source duplication, and run visitor/admin tests.',
    'Never remove custom fields, class links, images or side collections.',
    '',
    'This archive is generated locally, with no remote upload or commit.',
    ''
  ].join('\n');
}
async function createArchive(original,draft=null){
  const result=await withCandidateTree(original,draft,(root,plan)=>{
    const verified=verifyCandidate(root,original,plan);
    const saved=JSON.parse(readableFile(root,MANIFEST).toString('utf8'));
    const entries=[...expectedPaths()].map(name=>({
      name,bytes:readableFile(root,name)
    }));
    entries.push({name:README,bytes:Buffer.from(instructions(saved),'utf8')});
    const archive=encode(entries,archivePaths());
    const parsed=decode(archive,archivePaths());
    if(parsed.entryCount!==419)
      throw Error('Private source archive did not contain every expected file.');
    return {archive,checkedBeforeArchiving:verified};
  });
  const restored=await verifyArchive(result.archive,original,draft);
  return {
    bytes:result.archive,
    report:{
      format:'naxx-private-source-tree-review-archive-v1',
      privateOnly:true,githubReady:false,publishable:false,deployable:false,
      fullRepositoryBackup:false,archiveEntries:419,
      archiveBytes:result.archive.length,archiveSha256:sha(result.archive),
      originalSourceSha256:BASE,
      stagedSourceSha256:restored.staged.stagedSourceSha256,
      changedFragments:restored.staged.changedFragments,
      exactReconstruction:restored.staged.intendedSourceByteIdentical,
      exactRollback:restored.rollback.originalSourceByteIdentical,
      noWebsiteFilesModified:true,
      contentOrIdsEmitted:false,
      instruction:'This archive contains private source. Keep it offline; do not publish.'
    }
  };
}
async function verifyArchive(archive,original,draft=null){
  const parsed=decode(archive,archivePaths());
  const sourceCheck=crypto.createHash('sha256').update(original).digest('hex');
  if(!Buffer.isBuffer(original)||sourceCheck!==BASE)
    throw Error('Original source cannot verify private archive.');
  if(parsed.entryCount!==419)throw Error('Missing private review archive entries.');
  const notice=parsed.entries.find(item=>item.name===README);
  if(!notice||!notice.bytes.toString('utf8').includes('PRIVATE REVIEW ONLY'))
    throw Error('Missing private source confidentiality warning.');
  const plan=draft?await planChangeSet(original,draft):null;
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'naxx-private-archive-check-'));
  fs.chmodSync(temp,0o700);
  try{
    for(const item of parsed.entries){
      if(item.name===README)continue;
      const target=path.join(temp,...item.name.split('/'));
      fs.mkdirSync(path.dirname(target),{recursive:true,mode:0o700});
      fs.writeFileSync(target,item.bytes,{flag:'wx',mode:0o600});
    }
    const staged=verifyCandidate(temp,original,plan);
    const rollback=plan?rollbackCandidate(temp,original,plan):
      verifyCandidate(temp,original,null);
    if(!rollback.originalSourceByteIdentical)
      throw Error('Private archive did not roll back to original source.');
    return {
      archiveSha256:parsed.archiveSha256,
      entries:parsed.entryCount,
      staged,rollback,independentExtractionVerified:true,
      githubFilesWritten:0,published:false
    };
  }finally{
    fs.rmSync(temp,{recursive:true,force:true});
  }
}
function outputOutsideCheckout(output,checkout){
  if(typeof output!=='string'||!output.length||!path.isAbsolute(output))
    throw Error('Specify an absolute output filename outside the repository.');
  const parent=fs.realpathSync(path.dirname(output));
  const checkoutRoot=fs.realpathSync(checkout);
  const rel=path.relative(checkoutRoot,parent);
  if(rel===''||(!rel.startsWith('..'+path.sep)&&rel!=='..'&&!path.isAbsolute(rel)))
    throw Error('Private archive must be saved outside the repository.');
  const file=path.basename(output);
  if(!file.toLowerCase().endsWith('.zip')||file==='.'||file==='..')
    throw Error('Output must be a new .zip file.');
  if(fs.existsSync(output))throw Error('Output already exists; never overwrite a review archive.');
  return path.join(parent,file);
}
function saveLocalArchive(archive,filename,checkout){
  if(!Buffer.isBuffer(archive))throw Error('Only a verified private archive can be saved.');
  const destination=outputOutsideCheckout(filename,checkout);
  let opened=false;
  try{
    fs.writeFileSync(destination,archive,{flag:'wx',mode:0o600});
    opened=true;
    const bytes=fs.readFileSync(destination);
    if(!bytes.equals(archive)||sha(bytes)!==sha(archive))
      throw Error('Private archive was not saved accurately.');
    return {saved:true,byteCount:bytes.length,sha256:sha(bytes),outsideCheckout:true};
  }catch(error){
    // Do not leave a partial archive when disk writes or verification fail.
    // Only remove files that this invocation successfully created.
    if(opened)fs.rmSync(destination,{force:true});
    throw error;
  }
}
async function command(args,checkout){
  if(!Array.isArray(args)||args.length<2||args.length>4||args[0]!=='--output'||
     (args.length===4&&args[2]!=='--draft')||args.length===3)
    throw Error('Usage: node package-private-resource-tree.cjs --output /private/folder/name.zip [--draft /private/folder/draft.json]');
  const destination=outputOutsideCheckout(args[1],checkout);
  const original=fs.readFileSync(path.join(checkout,'site-content.html'));
  let draft=null;
  if(args.length===4){
    const name=args[3];
    const info=fs.lstatSync(name);
    if(!info.isFile()||info.isSymbolicLink()||info.size>16*1024*1024)
      throw Error('Resource draft is not a safe regular JSON file.');
    draft=JSON.parse(fs.readFileSync(name,'utf8'));
  }
  const packageData=await createArchive(original,draft);
  const saved=saveLocalArchive(packageData.bytes,destination,checkout);
  return {...packageData.report,
    localOutputCreated:saved.saved,
    outputBytesVerified:saved.byteCount===packageData.report.archiveBytes};
}
if(require.main===module){
  command(process.argv.slice(2),path.resolve(__dirname,'..','..'))
    .then(result=>process.stdout.write(JSON.stringify(result,null,2)+'\n'))
    .catch(_=>{
      process.stderr.write('Private archive not created. Verify output location, original source and draft. No private source data was printed.\n');
      process.exitCode=1;
    });
}
module.exports={createArchive,verifyArchive,outputOutsideCheckout,saveLocalArchive,
  archivePaths,README,command};
