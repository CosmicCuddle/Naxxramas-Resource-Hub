/* Private resource title and multiline content draft screen for the development website editor.
 * All actions are local to the browser; no file writes, network requests or
 * website publishing. Resource drafts are intentionally separate from the
 * existing four-page editor until one verified save format is approved.
 */
(function(){
  'use strict';
  var core=window.NaxxResourceTitles;
  var model=null,changes=new Map(),contentChanges=new Map(),activeIndex=null,loading=false;
  var $=function(id){return document.getElementById(id);};
  var picker=$('resource-source-file'),draftPicker=$('resource-draft-file');
  var search=$('resource-search'),list=$('resource-choice'),title=$('resource-title-edit'),content=$('resource-content-edit');
  var controls=$('resource-controls'),status=$('resource-status');
  if(!core||!picker||!controls||!status)throw Error('Local resource editing controls are incomplete.');
  function notice(message,error){
    status.textContent=message;
    status.classList.toggle('error',!!error);
  }
  function count(){
    $('resource-count').textContent=model ?
      model.resources.length+' resources loaded. '+changes.size+' title edits and '+contentChanges.size+' content edits held in memory. Drafts are NOT published.' :
      'No original resources loaded.';
  }
  function originalValue(index){
    return model.resources[index].title;
  }
  function currentValue(index){
    return changes.has(index)?changes.get(index):originalValue(index);
  }
  function originalContent(index){return model.resources[index].content;}
  function currentContent(index){
    return contentChanges.has(index)?contentChanges.get(index):originalContent(index);
  }
  function hasAnyEdits(){return changes.size+contentChanges.size>0;}
  function updateButtons(){
    var ready=!!model&&!loading;
    $('resource-apply').disabled=!ready||activeIndex===null;
    $('resource-revert').disabled=!ready||activeIndex===null||(!changes.has(activeIndex)&&!contentChanges.has(activeIndex));
    $('resource-save-draft').disabled=!ready||!hasAnyEdits();
    $('resource-load-draft').disabled=!ready;
    $('resource-clear').disabled=!ready||!hasAnyEdits();
    title.disabled=!ready||activeIndex===null;
    content.disabled=!ready||activeIndex===null;
    search.disabled=!ready;
    list.disabled=!ready;
    count();
  }
  function showSelected(){
    if(!model||activeIndex===null){
      title.value='';content.value='';$('resource-selected-caption').textContent='Choose a resource above.';
    }else{
      var record=model.resources[activeIndex];
      title.value=currentValue(activeIndex);
      content.value=currentContent(activeIndex);
      $('resource-selected-caption').textContent='Resource '+(activeIndex+1)+' of '+model.resources.length+
        ' — '+record.section+(changes.has(activeIndex)||contentChanges.has(activeIndex)?' — CHANGED':'');
    }
    updateButtons();
  }
  function refreshList(preferred){
    if(!model)return;
    var phrase=search.value.trim().toLowerCase();
    var found=model.resources.filter(function(r){
      return (r.title+' '+r.section+' '+currentValue(r.index)+' '+(r.index+1)).toLowerCase().includes(phrase);
    });
    list.replaceChildren();
    found.forEach(function(r){
      var option=document.createElement('option');
      option.value=String(r.index);
      option.textContent=(r.index+1)+'. '+currentValue(r.index)+(changes.has(r.index)||contentChanges.has(r.index)?' • CHANGED':'')+
        ' ('+r.section+')';
      list.appendChild(option);
    });
    activeIndex=found.length?
      (found.some(r=>r.index===preferred)?preferred:found[0].index):null;
    if(activeIndex!==null)list.value=String(activeIndex);
    $('resource-result-count').textContent=found.length+' matching resources';
    showSelected();
  }
  function hasPendingInput(){
    return !!model&&activeIndex!==null&&(title.value!==currentValue(activeIndex)||content.value!==currentContent(activeIndex));
  }
  function applyTyped(){
    if(!model||activeIndex===null)throw Error('Choose a resource before editing.');
    var text=title.value,body=content.value;
    if(!core.titleValid(text))
      throw Error('Titles must be 1–160 characters, without HTML brackets or line breaks.');
    if(body!==originalContent(activeIndex)&&!core.contentValid(body))
      throw Error('Content must be plain text (up to 30,000 characters). Newlines are supported, but HTML brackets and control characters are not.');
    if(body===''&&originalContent(activeIndex)!==''&&
       !window.confirm('This will clear all original content for the selected resource in your draft. Continue?'))
      return false;
    if(text===originalValue(activeIndex))changes.delete(activeIndex);
    else changes.set(activeIndex,text);
    if(body===originalContent(activeIndex))contentChanges.delete(activeIndex);
    else contentChanges.set(activeIndex,body);
    refreshList(activeIndex);
    return true;
  }
  function saveDownload(value,filename){
    var blob=new Blob([value],{type:'application/json;charset=utf-8'});
    var url=URL.createObjectURL(blob);
    var anchor=document.createElement('a');
    anchor.href=url;anchor.download=filename;anchor.hidden=true;
    document.body.appendChild(anchor);anchor.click();anchor.remove();
    setTimeout(function(){URL.revokeObjectURL(url);},15000);
  }
  picker.addEventListener('change',async function(){
    var file=picker.files&&picker.files[0];
    if(!file)return;
    try{
      if(model&&(hasAnyEdits()||hasPendingInput())&&
         !window.confirm('Replace the loaded resource draft and discard your current title changes? Save your draft first if needed.'))
        return;
      if(file.name!=='site-content.html'||file.size!==core.BASE_LENGTH)
        throw Error('Select the original site-content.html from the correct website version.');
      loading=true;picker.disabled=true;updateButtons();
      notice('Reading and verifying the original website file locally…',false);
      var source=await file.text();
      var verified=await core.open(source,window.crypto);
      // No source HTML is stored or displayed, only verified resource summaries.
      model=verified;changes=new Map();contentChanges=new Map();activeIndex=null;
      search.value='';controls.hidden=false;
      refreshList(0);
      notice('Original website verified. You can edit titles and multiline content locally.',false);
    }catch(err){
      notice((err&&err.message)||'The original website could not be verified.',true);
      // Failed imports never discard an already verified draft.
    }finally{
      loading=false;picker.disabled=false;picker.value='';updateButtons();
    }
  });
  search.addEventListener('input',function(){
    if(!model)return;
    if(hasPendingInput()&&!window.confirm('Leave unapplied title or content edits? Select Apply Resource Edits first to keep them.')){
      return;
    }
    refreshList(activeIndex);
  });
  list.addEventListener('change',function(){
    if(!model)return;
    if(hasPendingInput()&&!window.confirm('Discard unapplied title or content edits? Select Apply Resource Edits first to keep them.')){
      if(activeIndex!==null)list.value=String(activeIndex);
      return;
    }
    var index=Number(list.value);
    if(!Number.isInteger(index)||index<0||index>=model.resources.length){
      notice('Unexpected resource selection.',true);return;
    }
    activeIndex=index;showSelected();
  });
  $('resource-apply').addEventListener('click',function(){
    try{if(applyTyped())notice('Resource edits kept in memory. Save Resource Draft to download them.',false);}
    catch(err){notice(err.message,true);}
  });
  $('resource-revert').addEventListener('click',function(){
    if(activeIndex===null||(!changes.has(activeIndex)&&!contentChanges.has(activeIndex)))return;
    if(!window.confirm('Revert both the selected resource title and content to their originals?'))return;
    changes.delete(activeIndex);contentChanges.delete(activeIndex);
    refreshList(activeIndex);
    notice('Selected title and content reverted in memory.',false);
  });
  $('resource-save-draft').addEventListener('click',function(){
    try{
      if(hasPendingInput()&&!applyTyped())return;
      if(!hasAnyEdits())throw Error('There are no resource changes to save.');
      var data=core.resourceDraft(changes,contentChanges,model);
      var output=JSON.stringify(data,null,2)+'\n';
      saveDownload(output,'naxxramas-resource-draft.json');
      notice('Resource title and content draft downloaded. It does not change the website or GitHub.',false);
    }catch(err){notice(err.message,true);}
  });
  $('resource-load-draft').addEventListener('click',function(){
    if(!model)return;
    draftPicker.click();
  });
  draftPicker.addEventListener('change',async function(){
    var file=draftPicker.files&&draftPicker.files[0];
    if(!file)return;
    try{
      if(file.size>16*1024*1024)throw Error('This resource draft is unexpectedly large.');
      var parsed=JSON.parse(await file.text());
      var imported=core.restoreResourceDraft(parsed,model);
      if((hasAnyEdits()||hasPendingInput())&&
         !window.confirm('Replace your current unsaved resource title and content edits with this saved draft?'))
        return;
      changes=imported.titles;contentChanges=imported.contents;
      refreshList(activeIndex);
      notice('Verified resource draft loaded: '+changes.size+' title edits and '+contentChanges.size+' content edits.'+(imported.legacyTitleOnly?' Imported older title-only draft.':''),false);
    }catch(err){notice('Resource draft rejected: '+((err&&err.message)||'Invalid draft.'),true);}
    finally{draftPicker.value='';}
  });
  $('resource-clear').addEventListener('click',function(){
    if(!hasAnyEdits()&&!hasPendingInput())return;
    if(!window.confirm('Discard ALL resource title and content edits held in memory? This does not alter website files.'))return;
    changes.clear();contentChanges.clear();
    refreshList(activeIndex);
    notice('All in-memory resource title and content edits discarded.',false);
  });
  title.addEventListener('input',function(){
    if(!model||activeIndex===null)return;
    $('resource-selected-caption').textContent='Resource '+(activeIndex+1)+' — '+
      (core.titleValid(title.value)?'Text not yet applied':'Invalid title: use plain text, up to 160 characters');
  });
  content.addEventListener('input',function(){
    if(!model||activeIndex===null)return;
    $('resource-selected-caption').textContent='Resource '+(activeIndex+1)+' — '+
      (core.contentValid(content.value)?'Content not yet applied':'Invalid content: use plain text, up to 30,000 characters');
  });
  window.NaxxLocalResourceReview = Object.freeze({
    getDraft: function () {
      if (!model||!hasAnyEdits()) {
        if (hasPendingInput())throw Error('Apply the resource text edits before saving the review package.');
        return null;
      }
      if (hasPendingInput())
        throw Error('Apply or revert the resource text edits before saving the review package.');
      return core.resourceDraft(changes,contentChanges,model);
    }
  });
  controls.hidden=true;
  updateButtons();
})();
