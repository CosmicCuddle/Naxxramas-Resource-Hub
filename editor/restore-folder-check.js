/* Read-only browser folder verification. No uploads, persistence or writes. */
(function(){
  'use strict';
  const core=window.NaxxFolderPreflight;
  if(!core)throw Error('Private source folder preflight is unavailable.');
  const $=id=>document.getElementById(id);
  const folder=$('source-folder'),draft=$('versioned-draft');
  const check=$('check-folder'),clear=$('clear-folder');
  const result=$('folder-result'),message=$('folder-message'),details=$('folder-details');
  if(!folder||!draft||!check||!clear||!result)
    throw Error('Private folder-check controls are missing.');
  let busy=false,revision=0;
  function show(answer){
    result.dataset.decision=answer.code;
    result.dataset.blocked=String(!answer.folderSha256Checked||answer.code!=='fragments-checked');
    message.textContent=answer.message;
    details.textContent='Actual resource files checked: '+answer.resourceFilesVerified+
      '. Full website reconstructed: no. Manifest authenticated: no. '+
      'Latest claimed revision: '+(answer.latestRevision===null?'not verified':answer.latestRevision)+
      '. No changes were saved or published.';
  }
  function onSelection(){
    revision++;
    show(core.missing());
  }
  folder.addEventListener('change',onSelection);
  draft.addEventListener('change',onSelection);
  function controls(disabled){
    busy=disabled;
    folder.disabled=disabled;draft.disabled=disabled;
    check.disabled=disabled;clear.disabled=disabled;
  }
  check.addEventListener('click',async()=>{
    if(busy)return;
    const selected=folder.files;
    const selectedDraft=draft.files&&draft.files[0];
    if(!selected||!selected.length||!selectedDraft){
      show(core.missing());return;
    }
    const pending=++revision;
    controls(true);
    message.textContent='Checking selected source files locally…';
    details.textContent='This is read-only. Resource contents will not be displayed.';
    try{
      const decision=await core.verifyWithDraftFile(selected,selectedDraft);
      if(revision===pending)show(decision);
    }catch(_){
      if(revision===pending)show(core.missing());
    }finally{controls(false);}
  });
  clear.addEventListener('click',()=>{
    if(busy)return;
    folder.value='';draft.value='';
    onSelection();
  });
  show(core.missing());
  document.documentElement.dataset.privateFolderReady='true';
})();
