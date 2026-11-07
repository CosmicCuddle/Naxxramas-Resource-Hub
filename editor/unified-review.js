/* Private combined source-path preview. No source uploads, writes or storage. */
(function(){
  'use strict';
  const core=window.NaxxUnifiedReviewCore;
  const examples=window.NaxxUnifiedReviewExamples;
  if(!core||!examples)throw Error('Private unified review dependencies missing.');
  const $=id=>document.getElementById(id);
  const file=$('unified-receipt'),review=$('review-unified'),
    dismiss=$('dismiss-unified'),clear=$('clear-unified'),
    sample=$('sample-unified'),unsafe=$('sample-unsafe'),
    forged=$('sample-forged'),status=$('unified-status'),
    message=$('unified-message'),details=$('unified-details'),
    fileSection=$('unified-files'),list=$('unified-list');
  const inputs=[file,review,dismiss,clear,sample,unsafe,forged];
  if([...inputs,status,message,details,fileSection,list].some(x=>!x))
    throw Error('Incomplete private combined review screen.');
  let busy=false,revision=0;
  function show(out){
    status.dataset.decision=out.code;
    status.dataset.blocked='true';
    message.textContent=out.message;
    details.textContent=out.code==='preview'?
      'Existing page/navigation files: '+out.existingFileChanges+
      '. Proposed resource fragments: '+out.resourceChanges+
      '. Total paths: '+out.totalProposedPaths+
      '. Actual source verified here: no. Publishing approved: no.':
      'No files reviewed or changed. Publishing approved: no.';
    list.replaceChildren();
    for(const entry of out.files){
      const li=document.createElement('li'),title=document.createElement('strong');
      const path=document.createElement('code'),note=document.createElement('span');
      title.textContent=entry.label;
      path.textContent=entry.path;
      note.textContent=entry.trackedInCurrentGit?
        'Already tracked at the original reviewed checkout (claimed)':'UNAPPROVED candidate file; not tracked in the original checkout';
      note.className='file-note';
      li.append(title,path,note);
      list.append(li);
    }
    fileSection.hidden=out.files.length===0;
  }
  function disable(value){busy=value;inputs.forEach(x=>{x.disabled=value;});}
  function reset(){revision++;if(!busy)show(core.missing());}
  file.addEventListener('change',reset);
  function fictional(kind){
    if(busy)return;
    revision++;file.value='';
    show(core.inspect(examples.generate()[kind]));
  }
  sample.addEventListener('click',()=>fictional('current'));
  unsafe.addEventListener('click',()=>fictional('unsafe'));
  forged.addEventListener('click',()=>fictional('forged'));
  review.addEventListener('click',async()=>{
    if(busy)return;
    const selected=file.files&&file.files[0];
    if(!selected){show(core.missing());return;}
    if(selected.size<1||selected.size>core.MAX_JSON_BYTES){show(core.limit());return;}
    const expected=++revision;
    disable(true);
    message.textContent='Reading the selected JSON locally. Nothing is uploaded.';
    try{
      const text=await selected.text();
      if(expected===revision)show(core.inspectJSON(text));
    }catch(_){if(expected===revision)show(core.failed());}
    finally{disable(false);}
  });
  dismiss.addEventListener('click',()=>{
    if(busy)return;
    revision++;show(core.dismissed());
  });
  clear.addEventListener('click',()=>{
    if(busy)return;
    file.value='';reset();
  });
  show(core.missing());
  document.documentElement.dataset.privateUnifiedReviewReady='true';
})();
