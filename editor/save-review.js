/* Read-only owner-facing review of file-change metadata. Never edits source. */
(function(){
  'use strict';
  const core=window.NaxxSaveReviewCore,examples=window.NaxxSaveReviewExamples;
  if(!core||!examples)throw Error('Private review components are unavailable.');
  const $=id=>document.getElementById(id);
  const manifest=$('current-manifest'),receipt=$('planned-receipt');
  const review=$('review-selected'),reject=$('reject-review'),clear=$('clear-review');
  const status=$('review-status'),message=$('review-message'),
    details=$('review-details'),area=$('changed-files'),list=$('file-list');
  const current=$('sample-current'),stale=$('sample-stale'),
    conflict=$('sample-conflict');
  if([manifest,receipt,review,reject,clear,status,message,details,area,list,current,
    stale,conflict].some(x=>!x))
    throw Error('Private review UI controls are unavailable.');
  let busy=false,generation=0;
  function update(out){
    status.dataset.decision=out.code;
    status.dataset.blocked='true'; // Never permission to apply or publish.
    message.textContent=out.message;
    const revision=out.latestRevision===null?'not checked':out.latestRevision;
    const future=out.proposedRevision===null?'not checked':out.proposedRevision;
    details.textContent='Current revision: '+revision+
      '. Proposed revision: '+future+
      '. Proposed files: '+out.proposedFileCount+
      '. Edited resources: '+out.editedResources+
      '. Unchanged resources: '+out.unchangedResources+
      '. Actual source verified here: no. Nothing was saved.';
    list.replaceChildren();
    if(out.files.length){
      for(const file of out.files){
        const item=document.createElement('li');
        const heading=document.createElement('strong');
        heading.textContent=file.label;
        const location=document.createElement('code');
        location.textContent=file.path;
        const sizes=document.createElement('span');
        sizes.className='file-note';
        sizes.textContent='Before: '+file.oldBytes.toLocaleString()+
          ' bytes · Proposed: '+file.newBytes.toLocaleString()+' bytes';
        item.append(heading,location,sizes);
        list.append(item);
      }
    }
    area.hidden=out.files.length===0;
  }
  function reset(){
    generation++;
    if(!busy)update(core.missing());
  }
  manifest.addEventListener('change',reset);
  receipt.addEventListener('change',reset);
  function toggle(on){
    busy=on;
    for(const input of [manifest,receipt,review,reject,clear,current,stale,conflict])
      input.disabled=on;
  }
  function example(kind){
    if(busy)return;
    generation++;
    manifest.value='';receipt.value='';
    const set=examples.generate();
    const source=kind==='stale'?set.stale:
      kind==='conflict'?set.changed:set.manifest;
    update(core.inspect(source,set.receipt));
  }
  current.addEventListener('click',()=>example('current'));
  stale.addEventListener('click',()=>example('stale'));
  conflict.addEventListener('click',()=>example('conflict'));
  review.addEventListener('click',async()=>{
    if(busy)return;
    const first=manifest.files&&manifest.files[0];
    const second=receipt.files&&receipt.files[0];
    if(!first||!second){update(core.missing());return;}
    if(!core.size(first.size,core.MAX_MANIFEST_BYTES)||
       !core.size(second.size,core.MAX_RECEIPT_BYTES)){
      update(core.tooLarge());return;
    }
    const request=++generation;
    toggle(true);
    message.textContent='Reading the two selected JSON documents locally…';
    details.textContent='Read only. No resource text is displayed or sent anywhere.';
    try{
      const data=await Promise.all([first.text(),second.text()]);
      if(request===generation)update(core.inspectJSON(data[0],data[1]));
    }catch(_){
      if(request===generation)update(core.failed());
    }finally{toggle(false);}
  });
  // Rejection affects only the visible preview: selected JSON files remain
  // available for a later read-only review, and no browser or disk save occurs.
  reject.addEventListener('click',()=>{
    if(busy)return;
    generation++;
    update(core.rejected());
  });
  clear.addEventListener('click',()=>{
    if(busy)return;
    manifest.value='';receipt.value='';reset();
  });
  update(core.missing());
  document.documentElement.dataset.privateSaveReviewReady='true';
})();
