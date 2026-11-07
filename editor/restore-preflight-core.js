/* Naxxramas PRIVATE restore-preflight PROTOTYPE — metadata only.
 * Read-only. Never reads/executes site content, edits source files, auto-merges,
 * publishes to GitHub, or approves a deployment. For a real release the complete
 * source and source-bound draft MUST be independently reverified by the builder.
 */
(function(root,factory){
  'use strict';
  var core=factory();
  if(typeof module==='object'&&module.exports)module.exports=core;
  else root.NaxxRestorePreflight=core;
})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  var BASE='34455f6d901c538e2491a8c16681692e4c02d918b1984d7d0ba081aacb1049e8';
  var MANIFEST='naxx-private-versioned-resource-overlay-v1';
  var DRAFT='naxx-private-versioned-resource-draft-v1';
  var COUNT=414,HEX=/^[a-f0-9]{64}$/;
  function keys(o,names){
    return !!o&&typeof o==='object'&&!Array.isArray(o)&&
      Object.keys(o).sort().join(',')===names.slice().sort().join(',');
  }
  function validText(v,max,allowEmpty,allowNewlines){
    if(typeof v!=='string'||v.length>max||(!allowEmpty&&v.length===0))return false;
    return !(allowNewlines?
      /[<>\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/:
      /[<>\x00-\x1f\x7f]/).test(v);
  }
  function pathFor(i){
    return 'content/resource-overlays/resources/'+String(i+1).padStart(4,'0')+'.fragment';
  }
  function validManifest(m){
    if(!keys(m,['format','privateOnly','publishable','deployable',
      'originalSha256','revision','parentSha256','sourceSha256',
      'sourceBytes','resources'])||m.format!==MANIFEST||m.privateOnly!==true||
      m.publishable!==false||m.deployable!==false||m.originalSha256!==BASE||
      !Number.isSafeInteger(m.revision)||m.revision<0||
      (m.revision===0?m.parentSha256!==null:!HEX.test(m.parentSha256))||
      !HEX.test(m.sourceSha256)||!Number.isSafeInteger(m.sourceBytes)||
      m.sourceBytes<=0||!Array.isArray(m.resources)||m.resources.length!==COUNT)
      return false;
    for(var i=0;i<COUNT;i++){
      var r=m.resources[i];
      if(!keys(r,['index','path','sha256'])||r.index!==i||r.path!==pathFor(i)||
        !HEX.test(r.sha256))return false;
    }
    if(m.revision===0&&m.sourceSha256!==BASE)return false;
    return true;
  }
  function validDraft(d){
    if(!keys(d,['format','sourceBaselineSha256','revision','sourceSha256','changes'])||
      d.format!==DRAFT||d.sourceBaselineSha256!==BASE||
      !Number.isSafeInteger(d.revision)||d.revision<0||!HEX.test(d.sourceSha256)||
      !Array.isArray(d.changes)||d.changes.length<1||d.changes.length>COUNT)return false;
    var seen=new Set();
    for(var i=0;i<d.changes.length;i++){
      var c=d.changes[i];
      if(!c||!Number.isInteger(c.index)||c.index<0||c.index>=COUNT||
        seen.has(c.index)||!HEX.test(c.expectedSha256)||![
          'expectedSha256,index,title','content,expectedSha256,index',
          'content,expectedSha256,index,title'
        ].includes(Object.keys(c).sort().join(',')))return false;
      seen.add(c.index);
      if(Object.hasOwn(c,'title')&&!validText(c.title,160,false,false))return false;
      if(Object.hasOwn(c,'content')&&!validText(c.content,30000,true,true))return false;
    }
    return true;
  }
  function result(code,changed,requested,latestRevision){
    var messages={
      'invalid-source':'Cannot review: current version information is missing or invalid.',
      'invalid-draft':'Cannot review: the saved draft does not have a supported format.',
      'stale':'This draft was saved against an older or different website version. Nothing was overwritten. Reopen the latest version and review your edits before saving another draft.',
      'record-conflict':'The saved draft expects resource data that no longer matches the current version. Nothing was overwritten.',
      'review-only':'The draft matches the version metadata. Full source checks and your review are still required before any future save.'
    };
    return Object.freeze({
      code:code,message:messages[code],
      isBlocked:code!=='review-only',
      readOnly:true,canApply:false,canPublish:false,canAutoMerge:false,
      changedTargetCount:changed,requestedResourceCount:requested,
      latestRevision:Number.isSafeInteger(latestRevision)?latestRevision:null
    });
  }
  function assess(manifest,draft){
    if(!validManifest(manifest))return result('invalid-source',0,0,null);
    if(!validDraft(draft))return result('invalid-draft',0,0,manifest.revision);
    var changed=0;
    for(var i=0;i<draft.changes.length;i++){
      var c=draft.changes[i];
      if(manifest.resources[c.index].sha256!==c.expectedSha256)changed++;
    }
    if(draft.revision!==manifest.revision||
       draft.sourceSha256!==manifest.sourceSha256)
      return result('stale',changed,draft.changes.length,manifest.revision);
    if(changed)return result('record-conflict',changed,draft.changes.length,manifest.revision);
    return result('review-only',0,draft.changes.length,manifest.revision);
  }
  return Object.freeze({BASE:BASE,MANIFEST:MANIFEST,DRAFT:DRAFT,COUNT:COUNT,
    pathFor:pathFor,validManifest:validManifest,validDraft:validDraft,assess:assess});
});
