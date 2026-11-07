/* Experimental read-only versioned resource source verifier.
 * No filesystem, network, GitHub, original Admin, or website writes.
 * NOT a source-of-truth choice; the trusted expectations MUST be supplied
 * separately from an independently verified Git checkout/source receipt.
 */
(function(root,factory){
  'use strict';
  var reader=factory();
  if(typeof module==='object'&&module.exports)module.exports=reader;
  else root.NaxxRevisionSourceReader=reader;
})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  var ANCHOR='34455f6d901c538e2491a8c16681692e4c02d918b1984d7d0ba081aacb1049e8';
  var FORMAT='naxx-private-versioned-resource-overlay-v1';
  var SHA=/^[a-f0-9]{64}$/;
  var COUNT=414,MAX_BYTES=64*1024*1024;
  var exact=function(o,keys){
    return !!o&&typeof o==='object'&&!Array.isArray(o)&&
      Object.keys(o).sort().join(',')===keys.slice().sort().join(',');
  };
  var validPath=function(s){
    return typeof s==='string'&&s.length<240&&
      /^[a-zA-Z0-9._/-]+$/.test(s)&&
      !/^(?:\/|\\)/.test(s)&&!/\/\//.test(s)&&
      !/(^|\/)\.{1,2}(\/|$)/.test(s)&&!s.endsWith('/');
  };
  function bytes(text){
    if(typeof text!=='string')throw Error('Invalid source text.');
    return new TextEncoder().encode(text);
  }
  async function sha(value,cryptoObj){
    if(!cryptoObj||!cryptoObj.subtle||typeof cryptoObj.subtle.digest!=='function')
      throw Error('Secure SHA-256 support is required for source verification.');
    var data=typeof value==='string'?bytes(value):value;
    if(!(data instanceof Uint8Array))
      throw Error('Unexpected source input for SHA-256.');
    var raw=new Uint8Array(await cryptoObj.subtle.digest('SHA-256',data));
    return Array.from(raw,function(n){return n.toString(16).padStart(2,'0');}).join('');
  }
  function validate(snapshot,trust){
    if(!exact(snapshot,['manifest','shell','fragments'])||
       !exact(trust,['expectedRevision','expectedSourceSha256',
         'expectedParentSha256','expectedShellSha256','expectedRecordPaths']))
      throw Error('A separate, complete trusted revision expectation is required.');
    var m=snapshot.manifest,shell=snapshot.shell,fragments=snapshot.fragments;
    if(!exact(m,['format','privateOnly','publishable','deployable',
       'originalSha256','revision','parentSha256','sourceSha256',
       'sourceBytes','resources'])||
       m.format!==FORMAT||m.privateOnly!==true||
       m.publishable!==false||m.deployable!==false||
       m.originalSha256!==ANCHOR||!Number.isSafeInteger(m.revision)||
       m.revision<0||!SHA.test(m.sourceSha256)||
       !Number.isSafeInteger(m.sourceBytes)||m.sourceBytes<1||
       m.sourceBytes>MAX_BYTES||
       (m.revision===0?m.parentSha256!==null:!SHA.test(m.parentSha256))||
       (m.revision===0&&m.sourceSha256!==ANCHOR)||
       !Array.isArray(m.resources)||m.resources.length!==COUNT)
      throw Error('Invalid or unsupported versioned source manifest.');
    if(!Number.isSafeInteger(trust.expectedRevision)||
       trust.expectedRevision<0||
       !SHA.test(trust.expectedSourceSha256)||
       !SHA.test(trust.expectedShellSha256)||
       (trust.expectedRevision===0?
         trust.expectedParentSha256!==null:
         !SHA.test(trust.expectedParentSha256))||
       !Array.isArray(trust.expectedRecordPaths)||
       trust.expectedRecordPaths.length!==COUNT||
       m.revision!==trust.expectedRevision||
       m.sourceSha256!==trust.expectedSourceSha256||
       m.parentSha256!==trust.expectedParentSha256)
      throw Error('Source revision is stale or does not match independently trusted expectations.');
    if(!exact(shell,['prefix','suffix','separators'])||
       typeof shell.prefix!=='string'||typeof shell.suffix!=='string'||
       !Array.isArray(shell.separators)||shell.separators.length!==COUNT+1||
       shell.separators.some(function(s){return typeof s!=='string';})||
       !Array.isArray(fragments)||fragments.length!==COUNT||
       fragments.some(function(s){return typeof s!=='string'||!s.length;}))
      throw Error('Incomplete or invalid immutable website shell / resource set.');
    var used=new Set();
    for(var i=0;i<COUNT;i++){
      var record=m.resources[i],expected=trust.expectedRecordPaths[i];
      if(!exact(record,['index','path','sha256'])||
         record.index!==i||!validPath(record.path)||
         record.path!==expected||used.has(record.path.toLowerCase())||
         !SHA.test(record.sha256))
        throw Error('Missing, reordered, duplicate or untrusted resource path.');
      used.add(record.path.toLowerCase());
    }
    return {m:m,shell:shell,fragments:fragments};
  }
  async function inspect(snapshot,trust,cryptoObj){
    var checked=validate(snapshot,trust),m=checked.m,shell=checked.shell;
    var seal=await sha(JSON.stringify([
      shell.prefix,shell.suffix,shell.separators
    ]),cryptoObj);
    if(seal!==trust.expectedShellSha256)
      throw Error('The non-resource website shell has changed.');
    for(var i=0;i<COUNT;i++){
      if(await sha(checked.fragments[i],cryptoObj)!==m.resources[i].sha256)
        throw Error('Resource checksum mismatch at a verified position.');
    }
    // Reconstruct every byte of compatible runtime from the exact verified
    // shell and all 414 fragments; never evaluate the old site's scripts.
    var text=shell.prefix+shell.separators[0];
    for(var j=0;j<COUNT;j++)
      text+=checked.fragments[j]+shell.separators[j+1];
    text+=shell.suffix;
    var full=bytes(text);
    if(full.length!==m.sourceBytes||
       full.length>MAX_BYTES||await sha(full,cryptoObj)!==m.sourceSha256)
      throw Error('Complete source length or SHA-256 does not match the trusted revision.');
    return Object.freeze({
      format:'naxx-private-read-only-resource-revision-v1',
      candidateOnly:true,readOnly:true,publishable:false,
      githubReady:false,deployable:false,
      revision:m.revision,sourceSha256:m.sourceSha256,
      sourceBytes:full.length,resourcesVerified:COUNT,
      originalSourceAnchorVerified:m.originalSha256===ANCHOR,
      shellMatched:true,allFragmentsMatched:true,fullSourceMatched:true,
      remoteCommitAuthenticated:false,filesWritten:0
    });
  }
  return Object.freeze({ANCHOR:ANCHOR,COUNT:COUNT,inspect:inspect});
});
