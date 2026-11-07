'use strict';
/*
 * Disposable rehearsal of ONE title edit applied to a separate on-disk
 * resource fragment. This module never emits a working website or export.
 * The source must be the exact existing original Git baseline.
 * All private fragment files are in a mode-0700 OS temp directory, removed
 * by withTemporaryPackage even when verification fails.
 */
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {splitInMemory,restoreInMemory}=require('./check-legacy-roundtrip.cjs');
const {withTemporaryPackage,reconstructTemporaryPackage,resourcePath}=require('./rehearse-resource-files.cjs');
const {replaceTitleInRecord}=require('./rehearse-title-edit.cjs');

const EXPECTED_SHA='34455f6d901c538e2491a8c16681692e4c02d918b1984d7d0ba081aacb1049e8';
function sha256(bytes){return crypto.createHash('sha256').update(bytes).digest('hex');}
function fixedFile(root,relative){
  const filename=path.join(root,relative);
  const stat=fs.lstatSync(filename);
  if(!stat.isFile()||stat.isSymbolicLink())throw new Error('Unexpected staged file type.');
  return filename;
}
function readOriginal(root,relative,expected){
  if(!/^[a-f0-9]{64}$/.test(expected))throw new Error('Invalid baseline fragment hash.');
  const value=fs.readFileSync(fixedFile(root,relative));
  if(sha256(value)!==expected)throw new Error('Unexpected change outside approved resource title.');
  return value;
}
function validateStagedEdit(root,manifest,original,index,expectedTitle){
  const split=splitInMemory(original);
  if(manifest.sourceSha256!==EXPECTED_SHA || manifest.sourceLength!==original.length ||
     manifest.recordCount!==414 || !Array.isArray(manifest.resources) ||
     manifest.resources.length!==414)
    throw new Error('Unapproved manifest or source baseline.');
  if(!Number.isInteger(index)||index<0||index>=414)throw new Error('Invalid resource position.');
  const expected=replaceTitleInRecord(split.records[index],expectedTitle).record;
  if(expected===split.records[index])throw new Error('Expected an actual title change.');
  const prefix=readOriginal(root,'layout/prefix.utf8',manifest.files.prefix);
  const suffix=readOriginal(root,'layout/suffix.utf8',manifest.files.suffix);
  const separators=JSON.parse(readOriginal(root,'layout/separators.json',manifest.files.separators).toString('utf8'));
  if(!Array.isArray(separators)||separators.length!==415||separators.some(s=>typeof s!=='string'))
    throw new Error('Staged separators are invalid.');
  const fragments=[];
  let unchanged=0;
  for(let n=0;n<414;n++){
    const relative=resourcePath(n);
    const bytes=n===index ? fs.readFileSync(fixedFile(root,relative))
      :readOriginal(root,relative,manifest.resources[n]);
    const actual=bytes.toString('utf8');
    if(!Buffer.from(actual,'utf8').equals(bytes))throw new Error('Invalid UTF-8 resource fragment.');
    if(n===index){
      if(actual!==expected)throw new Error('Unexpected edit to the selected resource.');
    }else{
      if(actual!==split.records[n])throw new Error('Unrelated resource content changed.');
      unchanged++;
    }
    fragments.push(actual);
  }
  let middle=separators[0];
  for(let n=0;n<414;n++) middle+=fragments[n]+separators[n+1];
  const rebuilt=Buffer.concat([prefix,Buffer.from(middle,'utf8'),suffix]);
  const planned=split.records.slice();
  planned[index]=expected;
  const inMemory=restoreInMemory(split,planned);
  if(!rebuilt.equals(inMemory))throw new Error('Edited separate-file builder differs from expected source.');
  if(!prefix.equals(Buffer.from(split.source.slice(0,split.arrayBegin),'utf8')) ||
     !suffix.equals(Buffer.from(split.source.slice(split.arrayEnd),'utf8')))
    throw new Error('Legacy scripts, media or side collection were changed.');
  if(rebuilt.equals(original))throw new Error('Staged edit did not modify the original title.');
  return {
    separateFragmentsRead:414,
    changedResourceFragments:1,
    unchangedResourceFragments:unchanged,
    exactCompatibilityOutput:true,
    originalNonResourceBytesPreserved:true,
    originalResourceCount:414,
    originalSha256:sha256(original),
    stagedSourceSha256:sha256(rebuilt),
    resultByteLength:rebuilt.length
  };
}
function rehearseEditedTitle(original,index,newTitle){
  // read-only baseline verification must occur BEFORE creating the temp folder
  const split=splitInMemory(original);
  if(sha256(original)!==EXPECTED_SHA)throw new Error('Unapproved original source hash.');
  if(!Number.isInteger(index)||index<0||index>=split.records.length)
    throw new Error('Invalid selected resource position.');
  const validated=replaceTitleInRecord(split.records[index],newTitle);
  if(validated.record===split.records[index])throw new Error('No title change requested.');
  let tempRoot;
  const result=withTemporaryPackage(original,(root,manifest)=>{
    tempRoot=root;
    // First confirm the unmodified on-disk package matches original exactly.
    if(!reconstructTemporaryPackage(root).equals(original))
      throw new Error('Initial stage did not reconstruct original bytes.');
    const filename=fixedFile(root,resourcePath(index));
    const old=readOriginal(root,resourcePath(index),manifest.resources[index]);
    if(old.toString('utf8')!==split.records[index])
      throw new Error('Initial selected resource mismatch.');
    fs.writeFileSync(filename,validated.record,{encoding:'utf8'});
    let oldManifestRejected=false;
    try{reconstructTemporaryPackage(root);}
    catch(_){oldManifestRejected=true;}
    if(!oldManifestRejected)throw new Error('Original manifest incorrectly accepted an edited resource.');
    return {
      format:'naxx-temporary-edited-compatibility-v1',
      editedOnlyInPrivateTemporaryFolder:true,
      originalManifestRejectedModifiedFragment:oldManifestRejected,
      ...validateStagedEdit(root,manifest,original,index,newTitle),
      published:false,repositoryFilesWritten:0,
      contentOrIdsEmitted:false
    };
  });
  if(!tempRoot||fs.existsSync(tempRoot))throw new Error('Temporary folder was not cleaned up.');
  result.temporaryFolderDeletedAfterTest=true;
  return result;
}
if(require.main===module){
  try{
    const original=fs.readFileSync(path.resolve(__dirname,'..','..','site-content.html'));
    process.stdout.write(JSON.stringify(rehearseEditedTitle(original,0,'Safe Temporary Rehearsal'),null,2)+'\n');
  }catch(_){
    process.stderr.write('Temporary edited-resource rehearsal stopped. No original content was printed.\n');
    process.exitCode=1;
  }
}
module.exports={rehearseEditedTitle,validateStagedEdit};
