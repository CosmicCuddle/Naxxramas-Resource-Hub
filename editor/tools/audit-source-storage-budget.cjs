'use strict';
/*
 * READ-ONLY, EXACT-BASELINE STORAGE-BUDGET AUDIT.
 *
 * Quantifies duplication BEFORE selecting an editor persistence strategy.
 * It never writes files, runs website scripts, prints source contents,
 * exports images, publishes artifacts or changes the existing website.
 *
 * Candidate A: 418 complete source-tree files beside site-content.html.
 * Candidate B: 414 original record fragments beside site-content.html;
 *              reconstruct only with the exact original compatibility shell.
 * Candidate C: one single-source build -> generated compatibility file only
 *              at publish time (not modeled as deployable / approved).
 */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {splitInMemory,restoreInMemory}=require('./check-legacy-roundtrip.cjs');
const {stateFromPlan,expectedPaths}=require('./rehearse-proposed-resource-tree.cjs');
const SOURCE_SHA='34455f6d901c538e2491a8c16681692e4c02d918b1984d7d0ba081aacb1049e8';
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const size=text=>Buffer.byteLength(text,'utf8');
function auditStorage(original){
  if(!Buffer.isBuffer(original)||hash(original)!==SOURCE_SHA)
    throw Error('Unexpected original source checksum. Refusing storage audit.');
  const split=splitInMemory(original);
  if(split.records.length!==414||split.separators.length!==415)
    throw Error('Unexpected legacy resource record or separator count.');
  const restored=restoreInMemory(split);
  if(!restored.equals(original))
    throw Error('Original compatibility HTML cannot be reconstructed exactly.');
  const prefixBytes=size(split.source.slice(0,split.arrayBegin));
  const suffixBytes=size(split.source.slice(split.arrayEnd));
  const recordBytes=split.records.reduce((sum,item)=>sum+size(item),0);
  const separatorRawBytes=split.separators.reduce((sum,item)=>sum+size(item),0);
  if(prefixBytes+suffixBytes+recordBytes+separatorRawBytes!==original.length)
    throw Error('Storage budget does not account for every original byte.');
  const serializedSeparators=size(JSON.stringify(split.separators));
  const originalManifest=stateFromPlan(split,null).metadata;
  const manifestBytes=size(JSON.stringify(originalManifest,null,2)+'\n');
  const completeTreeBytes=prefixBytes+suffixBytes+recordBytes+
    serializedSeparators+manifestBytes;
  const sourceLayoutBytes=prefixBytes+suffixBytes+serializedSeparators+manifestBytes;
  if(expectedPaths().size!==418)
    throw Error('Original resource-source tree path count changed.');
  const resourceFractionPpm=Math.round(recordBytes*1e6/original.length);
  const fullTreeOverheadPpm=Math.round(completeTreeBytes*1e6/original.length);
  return {
    format:'naxx-source-storage-budget-audit-v1',
    readOnly:true,baselineVerified:true,sourceEvaluated:false,
    sourceValuesOrIndividualHashesPrinted:false,
    baselineSha256:SOURCE_SHA,
    originalCompatibilityBytes:original.length,
    records:414,
    completeCandidateFiles:418,
    originalResourceFragmentBytes:recordBytes,
    originalNonResourceCompatibilityBytes:prefixBytes+suffixBytes+separatorRawBytes,
    originalSeparatorsBytes:separatorRawBytes,
    serializedSeparatorsBytes:serializedSeparators,
    originalPrefixBytes:prefixBytes,
    originalSuffixBytes:suffixBytes,
    completeCandidateManifestBytes:manifestBytes,
    completeCandidateTreeBytes:completeTreeBytes,
    completeCandidateLayoutAndManifestBytes:sourceLayoutBytes,
    completeTreePlusRuntimeBytes:original.length+completeTreeBytes,
    fragmentOnlyExtraBytesLowerBound:recordBytes,
    fragmentOnlyPlusRuntimeBytesLowerBound:original.length+recordBytes,
    resourceFractionPpm,
    completeTreeOverheadPpm,
    canRebuildOriginalByteExact:true,
    proofOnly:true,approvedStorageStrategy:false,
    fragmentOnlyRequiresOriginalShell:true,
    noReleaseBuilderOrPagesConfigurationChanges:true,
    actualGitCompressionOrDeploymentStorageNotMeasured:true,
    repositoryFilesWritten:0,exportFilesWritten:0
  };
}
if(require.main===module){
  try{
    const source=fs.readFileSync(path.resolve(__dirname,'..','..','site-content.html'));
    process.stdout.write(JSON.stringify(auditStorage(source),null,2)+'\n');
  }catch(_){
    process.stderr.write('Storage budget audit stopped safely; no source content emitted.\n');
    process.exitCode=1;
  }
}
module.exports={SOURCE_SHA,auditStorage};
