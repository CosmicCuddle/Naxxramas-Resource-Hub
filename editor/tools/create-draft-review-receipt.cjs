'use strict';
/*
 * Optional owner-reviewed LOCAL receipt writer.
 * Exact files from a clean Git commit and pre-existing browser drafts are
 * cross-checked; a commit-bound *review* receipt is saved outside the repo.
 *
 * No draft source text is copied to this receipt. No Git writes, deployable
 * website files, remote uploads or implicit HEAD/commit guesses.
 */
const fs=require('node:fs'),path=require('node:path');
const crypto=require('node:crypto');
const {bindAtReview,verifyReviewBinding}=require('./bind-editor-drafts.cjs');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function sourceDraft(filename){
  if(typeof filename!=='string'||!path.isAbsolute(filename))
    throw Error('Select an absolute private draft filename.');
  const stat=fs.lstatSync(filename);
  if(!stat.isFile()||stat.isSymbolicLink()||stat.size<=0||stat.size>8*1024*1024)
    throw Error('Draft must be a safe, nonempty regular JSON file.');
  const bytes=fs.readFileSync(filename);
  if(!Buffer.from(bytes.toString('utf8'),'utf8').equals(bytes))
    throw Error('Draft must contain valid UTF-8.');
  return {value:JSON.parse(bytes.toString('utf8')),digest:hash(bytes)};
}
function destination(output,repo){
  if(typeof output!=='string'||!path.isAbsolute(output)||
     !/^[A-Za-z0-9][A-Za-z0-9._ -]{0,140}\.review\.json$/i.test(path.basename(output)))
    throw Error('Choose a new absolute private .review.json output.');
  const parent=fs.realpathSync(path.dirname(output));
  const root=fs.realpathSync(repo);
  const relative=path.relative(root,parent);
  if(relative===''||relative!=='..'&&
     !relative.startsWith('..'+path.sep)&&!path.isAbsolute(relative))
    throw Error('Review receipt must be saved outside the Git repository.');
  const file=path.join(parent,path.basename(output));
  try{
    fs.lstatSync(file);
    throw Error('Review receipt output already exists; never overwrite.');
  }catch(error){
    if(error.code!=='ENOENT')throw error;
  }
  return file;
}
async function saveReceipt(root,{commit,pagesFile=null,resourcesFile=null,output}={}){
  if(!pagesFile&&!resourcesFile)throw Error('Choose a page and/or resource draft.');
  const target=destination(output,root);
  const pages=pagesFile?sourceDraft(pagesFile):null;
  const resources=resourcesFile?sourceDraft(resourcesFile):null;
  const drafts={};
  if(pages)drafts.pages=pages.value;
  if(resources)drafts.resources=resources.value;
  const bound=await bindAtReview(root,drafts,commit);
  const confirmation=await verifyReviewBinding(root,drafts,bound);
  if(!confirmation.checkoutMatchesRequestedCommit||confirmation.reviewedChangeCount===0)
    throw Error('Reviewed source commitment was not verified.');
  // Detect drafts edited during the expensive source and resource checks.
  if(pages&&sourceDraft(pagesFile).digest!==pages.digest||
     resources&&sourceDraft(resourcesFile).digest!==resources.digest)
    throw Error('A draft file changed during source review. No receipt saved.');
  const encoded=Buffer.from(JSON.stringify(bound,null,2)+'\n','utf8');
  let created=false,fd=null;
  try{
    fd=fs.openSync(target,fs.constants.O_CREAT|fs.constants.O_EXCL|
      fs.constants.O_WRONLY,0o600);
    created=true;
    fs.writeFileSync(fd,encoded);fs.fsyncSync(fd);
    fs.closeSync(fd);fd=null;
    if(!fs.readFileSync(target).equals(encoded))
      throw Error('Saved review receipt did not match verified bytes.');
    return {
      format:bound.format,
      privateReceiptWritten:true,
      reviewedCommit:commit,
      changedExistingPageCount:bound.changedExistingPageCount,
      changedProposedResourceCount:bound.changedProposedResourceCount,
      receiptSha256:bound.receiptSha256,
      draftAuthoringCommitProven:false,
      githubReady:false,published:false,deployed:false,
      repositoryFilesChanged:false
    };
  }catch(err){
    if(fd!==null){try{fs.closeSync(fd);}catch(_){}}
    if(created)fs.rmSync(target,{force:true});
    throw err;
  }
}
function parseArgs(args){
  if(!Array.isArray(args)||!args.length||args.length%2!==0)
    throw Error('Required: --commit ID --output /private/name.review.json --pages /private/page.json and/or --resources /private/resource.json');
  const known=new Set(['--commit','--output','--pages','--resources']);
  const options={};
  for(let i=0;i<args.length;i+=2){
    const key=args[i],value=args[i+1];
    if(!known.has(key)||typeof value!=='string'||!value||Object.hasOwn(options,key))
      throw Error('Unrecognised or duplicate private review receipt argument.');
    options[key]=value;
  }
  if(!options['--commit']||!options['--output']||
     (!options['--pages']&&!options['--resources']))
    throw Error('Specify reviewed commit, output and at least one draft.');
  return {
    commit:options['--commit'],output:options['--output'],
    pagesFile:options['--pages']||null,resourcesFile:options['--resources']||null
  };
}
if(require.main===module){
  (async()=>{
    const args=parseArgs(process.argv.slice(2));
    return saveReceipt(path.resolve(__dirname,'..','..'),args);
  })().then(summary=>process.stdout.write(JSON.stringify(summary,null,2)+'\n'))
    .catch(_=>{
      process.stderr.write('Review receipt rejected: verify the private files and exact clean Git commit. No source data printed.\n');
      process.exitCode=1;
    });
}
module.exports={saveReceipt,sourceDraft,destination,parseArgs};
