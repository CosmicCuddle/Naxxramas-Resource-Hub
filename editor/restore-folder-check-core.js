/* PRIVATE RESOURCE FOLDER PREFLIGHT — read-only and unapproved.
 * Checks the *actual 414 selected resource files* against their manifest
 * with SHA-256. Unlike the Node.js physical verifier it DOES NOT reconstruct
 * the 31MB website HTML; no "source verified" or publish promise is made.
 */
(function(root,factory){
  'use strict';
  const node=typeof module==='object'&&module.exports;
  const api=factory(
    node?require('./restore-preflight-core.js'):root.NaxxRestorePreflight,
    node?require('node:crypto').webcrypto.subtle:root.crypto&&root.crypto.subtle
  );
  if(node)module.exports=api;
  else root.NaxxFolderPreflight=api;
})(typeof globalThis==='object'?globalThis:this,function(preflight,subtle){
  'use strict';
  if(!preflight||typeof preflight.assess!=='function')
    throw Error('Read-only resource version checker is unavailable.');
  const COUNT=414,FILE_COUNT=415;
  const BASE_PATH='content/resource-overlays/';
  const MANIFEST_PATH=BASE_PATH+'manifest.json';
  const MAX_MANIFEST_BYTES=262144,MAX_DRAFT_BYTES=16777216;
  const MAX_FRAGMENT_BYTES=1000000,MAX_TOTAL_FRAGMENT_BYTES=16777216;
  const MESSAGES=Object.freeze({
    'missing-files':'Select a resource source folder and a versioned resource draft.',
    'invalid-folder':'The selected folder must contain exactly the 414 expected resource files and one manifest. Nothing was changed.',
    'oversize':'One or more selected source files are empty or exceed the private review size limits.',
    'crypto-unavailable':'This browser cannot perform SHA-256 verification in the current context.',
    'invalid-source':'The source manifest is missing or invalid. No resource edits were accepted.',
    'fragment-mismatch':'At least one resource file does not match the manifest. No changes were made.',
    'read-failed':'The selected source files could not be safely read. Nothing was changed.',
    'invalid-draft':'The saved draft is not a supported versioned resource draft.',
    'stale':'This draft belongs to an older website revision. Keep it and review against the latest source.',
    'record-conflict':'A resource changed since this draft was made. Do not overwrite newer work.',
    'fragments-checked':'All 414 resource-file checksums match the selected manifest. Draft version metadata matches. The full website has NOT been reconstructed or authenticated; this is review only.'
  });
  function result(code,verified,revision){
    return Object.freeze({
      code,message:MESSAGES[code]||MESSAGES['read-failed'],
      filesVerified:verified?FILE_COUNT:0,
      resourceFilesVerified:verified?COUNT:0,
      latestRevision:Number.isSafeInteger(revision)?revision:null,
      folderSha256Checked:!!verified,
      fullHtmlReconstructed:false,
      authenticatedManifest:false,
      readyForPublication:false,readOnly:true,
      canApply:false,canAutoMerge:false,canPublish:false
    });
  }
  function validSize(n,max){
    return Number.isSafeInteger(n)&&n>0&&n<=max;
  }
  function expectedPath(i){
    return BASE_PATH+'resources/'+String(i+1).padStart(4,'0')+'.fragment';
  }
  function pathFromSelection(file,rootName){
    if(!file||typeof file.webkitRelativePath!=='string')return null;
    const raw=file.webkitRelativePath;
    if(raw.includes('\\')||raw.includes('\0')||raw.includes('//'))return null;
    const slash=raw.indexOf('/');
    if(slash<=0||raw.indexOf('/',slash+1)<0)return null;
    const base=raw.slice(0,slash);
    if(base==='.'||base==='..'||base!==rootName)return null;
    return raw.slice(slash+1);
  }
  function inventory(files){
    if(!files||typeof files.length!=='number'||files.length!==FILE_COUNT)
      return null;
    const entries=Array.from(files);
    if(entries.length!==FILE_COUNT)return null;
    const first=entries[0]&&entries[0].webkitRelativePath;
    if(typeof first!=='string'||!first.includes('/'))return null;
    const base=first.slice(0,first.indexOf('/'));
    if(!base||base==='.'||base==='..'||base.includes('\\'))return null;
    const permitted=new Set([MANIFEST_PATH,...Array.from({length:COUNT},(_,i)=>expectedPath(i))]);
    const lookup=new Map();
    let total=0;
    for(const file of entries){
      const relative=pathFromSelection(file,base);
      if(!permitted.has(relative)||lookup.has(relative))return null;
      const max=relative===MANIFEST_PATH?MAX_MANIFEST_BYTES:MAX_FRAGMENT_BYTES;
      if(!validSize(file.size,max))return {problem:'oversize'};
      if(relative!==MANIFEST_PATH){
        total+=file.size;
        if(total>MAX_TOTAL_FRAGMENT_BYTES)return {problem:'oversize'};
      }
      if(typeof file.arrayBuffer!=='function')return null;
      lookup.set(relative,file);
    }
    return lookup.size===FILE_COUNT?{lookup,total}:null;
  }
  async function hashBuffer(buffer){
    const digest=await subtle.digest('SHA-256',buffer);
    return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
  }
  function decodeJson(bytes){
    const decoder=new TextDecoder('utf-8',{fatal:true});
    return JSON.parse(decoder.decode(bytes));
  }
  async function verifySelectedFolder(files,draft){
    const scanned=inventory(files);
    if(!scanned)return result('invalid-folder',false,null);
    if(scanned.problem)return result(scanned.problem,false,null);
    if(!subtle||typeof subtle.digest!=='function')
      return result('crypto-unavailable',false,null);
    try{
      const raw=await scanned.lookup.get(MANIFEST_PATH).arrayBuffer();
      if(!validSize(raw.byteLength,MAX_MANIFEST_BYTES))
        return result('oversize',false,null);
      const manifest=decodeJson(raw);
      if(!preflight.validManifest(manifest))
        return result('invalid-source',false,null);
      for(let i=0;i<COUNT;i++){
        const f=scanned.lookup.get(expectedPath(i));
        const b=await f.arrayBuffer();
        if(!validSize(b.byteLength,MAX_FRAGMENT_BYTES))
          return result('oversize',false,null);
        if(await hashBuffer(b)!==manifest.resources[i].sha256)
          return result('fragment-mismatch',false,null);
      }
      // Complete file checks must pass before any draft can be reviewed.
      if(!preflight.validDraft(draft))
        return result('invalid-draft',true,manifest.revision);
      const review=preflight.assess(manifest,draft);
      const outcome=review.code==='review-only'?'fragments-checked':review.code;
      return result(outcome,true,manifest.revision);
    }catch(_){return result('read-failed',false,null);}
  }
  async function verifyWithDraftFile(files,draftFile){
    if(!draftFile||!validSize(draftFile.size,MAX_DRAFT_BYTES)||
       typeof draftFile.arrayBuffer!=='function')
      return result('invalid-draft',false,null);
    try{
      const bytes=await draftFile.arrayBuffer();
      if(!validSize(bytes.byteLength,MAX_DRAFT_BYTES))
        return result('invalid-draft',false,null);
      const draft=decodeJson(bytes);
      return await verifySelectedFolder(files,draft);
    }catch(_){return result('invalid-draft',false,null);}
  }
  return Object.freeze({
    COUNT,FILE_COUNT,MANIFEST_PATH,MAX_MANIFEST_BYTES,MAX_DRAFT_BYTES,
    MAX_FRAGMENT_BYTES,MAX_TOTAL_FRAGMENT_BYTES,
    expectedPath,inventory,validSize,verifySelectedFolder,verifyWithDraftFile,
    missing:()=>result('missing-files',false,null)
  });
});
