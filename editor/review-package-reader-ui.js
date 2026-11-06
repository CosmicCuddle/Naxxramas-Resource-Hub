/* Naxxramas private ZIP draft recovery interface.
 * Checks the saved review ZIP before offering its original JSON payloads.
 * Never uploads, applies edits or reads the live website repository.
 */
(function(root){
  'use strict';
  const $=id=>document.getElementById(id);
  const picker=$('open-review-zip'),status=$('open-review-status'),
    page=$('recover-page-draft'),resource=$('recover-resource-draft');
  const reader=root.NaxxReviewArchive;
  if(!picker||!status||!page||!resource||!reader)
    throw Error('Private review ZIP recovery controls are missing.');
  let inspected=null,revision=0,busy=false;
  function notice(message,error){
    status.textContent=message;
    status.classList.toggle('error',!!error);
  }
  function reset(){
    inspected=null;
    page.disabled=true;
    resource.disabled=true;
  }
  function saveText(text,name){
    if(typeof text!=='string'||!text.length)
      throw Error('Verified draft was not available.');
    const url=URL.createObjectURL(
      new Blob([text],{type:'application/json;charset=utf-8'}));
    const link=document.createElement('a');
    link.href=url;link.download=name;link.hidden=true;
    document.body.appendChild(link);
    try{link.click();}
    finally{
      link.remove();
      setTimeout(()=>URL.revokeObjectURL(url),15000);
    }
  }
  picker.addEventListener('change',async function(){
    const ticket=++revision,file=picker.files&&picker.files[0];
    reset();
    if(!file){notice('No saved review ZIP selected.',false);return;}
    if(busy){notice('Finish the current local review before opening another ZIP.',true);return;}
    if(!/\.zip$/i.test(file.name)||file.size<22||
       file.size>reader.MAX_ARCHIVE){
      notice('Choose a saved review ZIP within the private file-size limit.',true);
      picker.value='';
      return;
    }
    busy=true;picker.disabled=true;
    notice('Checking the archive, draft types and file hashes locally…',false);
    try{
      const bytes=new Uint8Array(await file.arrayBuffer());
      const result=await reader.inspect(bytes,root.NaxxEditorZip,
        root.NaxxEditorReview);
      if(ticket!==revision)return;
      inspected=result;
      page.disabled=!result.hasPageDraft;
      resource.disabled=!result.hasResourceDraft;
      notice('Review ZIP verified. '+(result.hasPageDraft?'Page draft ready. ':'')+
        (result.hasResourceDraft?'Resource draft ready. ':'')+
        'Download the included drafts below, then use their existing Load Draft buttons.'+
        ' The original website files have NOT been checked or changed.',false);
    }catch(_){
      if(ticket===revision){
        reset();
        notice('Review ZIP could not be verified. No draft was restored. '+
          'Keep your original ZIP and check it came from this editor.',true);
      }
    }finally{
      busy=false;picker.disabled=false;picker.value='';
    }
  });
  page.addEventListener('click',function(){
    if(!inspected||!inspected.hasPageDraft)return;
    saveText(inspected.pageDraftText,'REVIEW-PAGE-DRAFT.json');
    notice('Page draft downloaded. Use Load Saved Draft in section 5. '+
      'The website has not been updated.',false);
  });
  resource.addEventListener('click',function(){
    if(!inspected||!inspected.hasResourceDraft)return;
    saveText(inspected.resourceDraftText,'REVIEW-RESOURCE-DRAFT.json');
    notice('Resource draft downloaded. Use Load Resource Draft in section 4. '+
      'The website has not been updated.',false);
  });
  reset();
  notice('Choose a previously saved private review ZIP to inspect it locally.',false);
})(typeof window==='undefined'?globalThis:window);
