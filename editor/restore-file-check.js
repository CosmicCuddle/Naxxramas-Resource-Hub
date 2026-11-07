/* Private local JSON file preflight. No network, persistence, export or apply. */
(function(){
  'use strict';
  const core=window.NaxxLocalRestoreFiles;
  if(!core)throw Error('Local file inspection core is missing.');
  const id=name=>document.getElementById(name);
  const manifest=id('manifest-file'),draft=id('draft-file');
  const check=id('check-files'),clear=id('clear-files');
  const output=id('check-result'),message=id('decision-message'),detail=id('decision-detail');
  if(!manifest||!draft||!check||!clear||!output)
    throw Error('Local version-check controls are unavailable.');
  let generation=0,busy=false;
  function show(answer){
    output.dataset.decision=answer.code;
    output.dataset.blocked=String(answer.isBlocked);
    message.textContent=answer.message;
    detail.textContent='Resource records requested: '+answer.requestedResourceCount+
      '. Conflicting target checksums: '+answer.changedTargetCount+
      '. Current revision: '+(answer.latestRevision===null?'not verified':answer.latestRevision)+
      '. Nothing was saved, changed, uploaded or published.';
  }
  function resetSelection(){
    generation++;
    if(!busy)show(core.missing());
  }
  manifest.addEventListener('change',resetSelection);
  draft.addEventListener('change',resetSelection);
  function toggle(on){
    busy=on;
    check.disabled=on;
    clear.disabled=on;
    manifest.disabled=on;
    draft.disabled=on;
  }
  check.addEventListener('click',async function(){
    if(busy)return;
    const left=manifest.files&&manifest.files[0];
    const right=draft.files&&draft.files[0];
    if(!left||!right){show(core.missing());return;}
    if(!core.bounds(left.size,core.MAX_MANIFEST_BYTES)||
       !core.bounds(right.size,core.MAX_DRAFT_BYTES)){
      show(core.tooLarge());return;
    }
    const request=++generation;
    toggle(true);
    try{
      const values=await Promise.all([left.text(),right.text()]);
      if(request!==generation)return;
      show(core.inspect(values[0],values[1]));
    }catch(_){
      if(request===generation)show(core.readFailed());
    }finally{toggle(false);}
  });
  clear.addEventListener('click',function(){
    if(busy)return;
    manifest.value='';draft.value='';
    resetSelection();
  });
  show(core.missing());
  document.documentElement.dataset.localFileReviewReady='true';
})();
