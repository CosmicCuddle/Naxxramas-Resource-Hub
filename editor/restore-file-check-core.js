/* PRIVATE LOCAL RESTORE FILE PREFLIGHT — review only, no writes or export.
 * Strict size/format checks and generic messages. Matching metadata does NOT
 * prove file integrity: independent full-source verification remains essential.
 */
(function(root,factory){
  'use strict';
  const impl=factory(typeof module==='object'&&module.exports?
    require('./restore-preflight-core.js'):root.NaxxRestorePreflight);
  if(typeof module==='object'&&module.exports)module.exports=impl;
  else root.NaxxLocalRestoreFiles=impl;
})(typeof globalThis==='object'?globalThis:this,function(preflight){
  'use strict';
  if(!preflight||typeof preflight.assess!=='function')
    throw Error('Required read-only version checker is unavailable.');
  const MAX_MANIFEST_BYTES=262144;
  const MAX_DRAFT_BYTES=16777216;
  const MESSAGES=Object.freeze({
    'missing-files':'Select a version manifest and a saved resource draft to check.',
    'size-limit':'A selected JSON file is too large for this private review tool.',
    'read-failed':'The selected files could not be read or parsed. Nothing was changed.'
  });
  function error(code){
    return Object.freeze({
      code,message:MESSAGES[code],isBlocked:true,
      canApply:false,canPublish:false,canAutoMerge:false,
      readOnly:true,latestRevision:null,
      requestedResourceCount:0,changedTargetCount:0
    });
  }
  function bounds(size,maximum){
    return Number.isSafeInteger(size)&&size>0&&size<=maximum;
  }
  function inspect(manifestJson,draftJson){
    if(typeof manifestJson!=='string'||typeof draftJson!=='string')
      return error('read-failed');
    const sizeM=new TextEncoder().encode(manifestJson).length;
    const sizeD=new TextEncoder().encode(draftJson).length;
    if(!bounds(sizeM,MAX_MANIFEST_BYTES)||!bounds(sizeD,MAX_DRAFT_BYTES))
      return error('size-limit');
    let manifest,draft;
    try{manifest=JSON.parse(manifestJson);}
    catch(_){return preflight.assess(null,null);}
    try{draft=JSON.parse(draftJson);}
    catch(_){
      // Retain precise invalid-source precedence, even if both files are bad.
      return preflight.assess(manifest,null);
    }
    return preflight.assess(manifest,draft);
  }
  return Object.freeze({MAX_MANIFEST_BYTES,MAX_DRAFT_BYTES,inspect,
    bounds,missing:()=>error('missing-files'),readFailed:()=>error('read-failed'),
    tooLarge:()=>error('size-limit')});
});
