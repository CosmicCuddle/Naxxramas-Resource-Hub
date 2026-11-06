/* Naxxramas private ZIP draft recovery interface.
 * Checks the saved review ZIP before offering its original JSON payloads.
 * Never uploads, applies edits or reads the live website repository.
 */
(function(root){
  'use strict';
  const $=id=>document.getElementById(id);
  const picker=$('open-review-zip'),status=$('open-review-status'),
    page=$('recover-page-draft'),resource=$('recover-resource-draft'),
    directPage=$('restore-zip-page'),directResource=$('restore-zip-resource');
  const reader=root.NaxxReviewArchive;
  if(!picker||!status||!page||!resource||!directPage||!directResource||!reader)
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
    directPage.disabled=true;
    directResource.disabled=true;
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
      directPage.disabled=!result.hasPageDraft;
      directResource.disabled=!result.hasResourceDraft;
      notice('Review ZIP verified. '+(result.hasPageDraft?'Page draft ready. ':'')+
        (result.hasResourceDraft?'Resource draft ready. ':'')+
        'Restore each draft into its matching source-checked editor, or download JSON files.'+
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
  function directLoad(name,text,source){
    if(!inspected||typeof text!=='string'||!source||
       typeof source.restoreDraftText!=='function'){
      notice('Load the original source files in the matching editor first. Your current drafts were kept.',true);
      return;
    }
    try{
      // Each original editor revalidates its own source fingerprint and
      // asks for consent before overwriting existing in-memory edits.
      const accepted=source.restoreDraftText(text);
      if(accepted===true)
        notice(name+' restored to its local editor. Review the edits before exporting. Nothing was published.',false);
      else
        notice(name+' restore cancelled. Your earlier edits were kept.',false);
    }catch(_){
      notice(name+' could not be restored to its source-checked editor. Load the matching original files and review your draft. Existing edits were kept.',true);
    }
  }
  directPage.addEventListener('click',function(){
    if(!inspected||!inspected.hasPageDraft)return;
    directLoad('Page draft',inspected.pageDraftText,root.NaxxLocalPageReview);
  });
  directResource.addEventListener('click',function(){
    if(!inspected||!inspected.hasResourceDraft)return;
    directLoad('Resource draft',inspected.resourceDraftText,root.NaxxLocalResourceReview);
  });
  reset();
  notice('Choose a previously saved private review ZIP to inspect it locally.',false);
})(typeof window==='undefined'?globalThis:window);
