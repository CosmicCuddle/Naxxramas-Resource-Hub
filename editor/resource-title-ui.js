/* Private resource title draft screen for the development website editor.
 * All actions are local to the browser; no file writes, network requests or
 * website publishing. Resource drafts are intentionally separate from the
 * existing four-page editor until one verified save format is approved.
 */
(function(){
  'use strict';
  var core=window.NaxxResourceTitles;
  var model=null,changes=new Map(),activeIndex=null,loading=false;
  var $=function(id){return document.getElementById(id);};
  var picker=$('resource-source-file'),draftPicker=$('resource-draft-file');
  var search=$('resource-search'),list=$('resource-choice'),title=$('resource-title-edit');
  var controls=$('resource-controls'),status=$('resource-status');
  if(!core||!picker||!controls||!status)throw Error('Local resource editing controls are incomplete.');
  function notice(message,error){
    status.textContent=message;
    status.classList.toggle('error',!!error);
  }
  function count(){
    $('resource-count').textContent=model ?
      model.resources.length+' resources loaded. '+changes.size+' title edits held in memory. Drafts are NOT published.' :
      'No original resources loaded.';
  }
  function originalValue(index){
    return model.resources[index].title;
  }
  function currentValue(index){
    return changes.has(index)?changes.get(index):originalValue(index);
  }
  function updateButtons(){
    var ready=!!model&&!loading;
    $('resource-apply').disabled=!ready||activeIndex===null;
    $('resource-revert').disabled=!ready||activeIndex===null||!changes.has(activeIndex);
    $('resource-save-draft').disabled=!ready||changes.size===0;
    $('resource-load-draft').disabled=!ready;
    $('resource-clear').disabled=!ready||changes.size===0;
    title.disabled=!ready||activeIndex===null;
    search.disabled=!ready;
    list.disabled=!ready;
    count();
  }
  function showSelected(){
    if(!model||activeIndex===null){
      title.value='';$('resource-selected-caption').textContent='Choose a resource above.';
    }else{
      var record=model.resources[activeIndex];
      title.value=currentValue(activeIndex);
      $('resource-selected-caption').textContent='Resource '+(activeIndex+1)+' of '+model.resources.length+
        ' — '+record.section+(changes.has(activeIndex)?' — CHANGED':'');
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
      option.textContent=(r.index+1)+'. '+currentValue(r.index)+(changes.has(r.index)?' • CHANGED':'')+
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
    return !!model&&activeIndex!==null&&title.value!==currentValue(activeIndex);
  }
  function applyTyped(){
    if(!model||activeIndex===null)throw Error('Choose a resource before editing.');
    var text=title.value;
    if(!core.titleValid(text))throw Error('Titles must be 1–160 characters, without HTML brackets or line breaks.');
    if(text===originalValue(activeIndex))changes.delete(activeIndex);
    else changes.set(activeIndex,text);
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
      if(model&&(changes.size||hasPendingInput())&&
         !window.confirm('Replace the loaded resource draft and discard your current title changes? Save your draft first if needed.'))
        return;
      if(file.name!=='site-content.html'||file.size!==core.BASE_LENGTH)
        throw Error('Select the original site-content.html from the correct website version.');
      loading=true;picker.disabled=true;updateButtons();
      notice('Reading and verifying the original website file locally…',false);
      var source=await file.text();
      var verified=await core.open(source,window.crypto);
      // No source HTML is stored or displayed, only verified resource summaries.
      model=verified;changes=new Map();activeIndex=null;
      search.value='';controls.hidden=false;
      refreshList(0);
      notice('Original website verified. You can now edit resource titles locally.',false);
    }catch(err){
      notice((err&&err.message)||'The original website could not be verified.',true);
      // Failed imports never discard an already verified draft.
    }finally{
      loading=false;picker.disabled=false;picker.value='';updateButtons();
    }
  });
  search.addEventListener('input',function(){
    if(!model)return;
    if(hasPendingInput()&&!window.confirm('Leave the unsaved title text? Select Apply Title Edit first to keep it.')){
      return;
    }
    refreshList(activeIndex);
  });
  list.addEventListener('change',function(){
    if(!model)return;
    if(hasPendingInput()&&!window.confirm('Discard the unsaved title text? Select Apply Title Edit first to keep it.')){
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
    try{applyTyped();notice('Title edit kept in memory. Use Save Resource Draft to download it.',false);}
    catch(err){notice(err.message,true);}
  });
  $('resource-revert').addEventListener('click',function(){
    if(activeIndex===null||!changes.has(activeIndex))return;
    if(!window.confirm('Revert the selected resource title to the original?'))return;
    changes.delete(activeIndex);
    refreshList(activeIndex);
    notice('Selected title reverted in memory.',false);
  });
  $('resource-save-draft').addEventListener('click',function(){
    try{
      if(hasPendingInput())applyTyped();
      if(!changes.size)throw Error('There are no resource title changes to save.');
      var data=core.draft(changes,model);
      var output=JSON.stringify(data,null,2)+'\n';
      saveDownload(output,'naxxramas-resource-title-draft.json');
      notice('Resource title draft downloaded. It does not change the website or GitHub.',false);
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
      if(file.size>512*1024)throw Error('This draft file is unexpectedly large.');
      var parsed=JSON.parse(await file.text());
      var imported=core.restore(parsed,model);
      if((changes.size||hasPendingInput())&&
         !window.confirm('Replace your current unsaved resource title edits with this saved draft?'))
        return;
      changes=imported;
      refreshList(activeIndex);
      notice('Verified resource draft loaded: '+changes.size+' title edits.',false);
    }catch(err){notice('Resource draft rejected: '+((err&&err.message)||'Invalid draft.'),true);}
    finally{draftPicker.value='';}
  });
  $('resource-clear').addEventListener('click',function(){
    if(!changes.size&&!hasPendingInput())return;
    if(!window.confirm('Discard ALL resource title edits held in memory? This does not alter website files.'))return;
    changes.clear();
    refreshList(activeIndex);
    notice('All in-memory resource title edits discarded.',false);
  });
  title.addEventListener('input',function(){
    if(!model||activeIndex===null)return;
    $('resource-selected-caption').textContent='Resource '+(activeIndex+1)+' — '+
      (core.titleValid(title.value)?'Text not yet applied':'Invalid title: use plain text, up to 160 characters');
  });
  controls.hidden=true;
  updateButtons();
})();
