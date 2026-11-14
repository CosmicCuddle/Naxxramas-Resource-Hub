(function(root){
  'use strict';
  var saving=false;
  var STATUS='/__naxx_api/status';
  var SAVE='/__naxx_api/save';
  function message(text,kind){
    try{
      if(typeof root.adminMsg==='function')root.adminMsg(text,kind||'ok');
      else console.log(text);
    }catch(_){console.log(text);}
  }
  function relabel(){
    document.querySelectorAll('[onclick="exportUpdatedHtml()"]').forEach(function(button){
      if(button.dataset.naxxLocalSaveLabel==='1')return;
      button.dataset.naxxLocalSaveLabel='1';
      button.textContent='💾 Save Website Changes';
      button.setAttribute('title','Save these edits to the protected GitHub draft branch');
    });
  }
  async function json(response){
    var data;
    try{data=await response.json();}catch(_){data=null;}
    if(!response.ok||!data)throw Error(data&&data.error||'Local Save service refused the request.');
    return data;
  }
  root.naxxLocalSaveUpdatedSite=async function(output){
    if(saving){message('A Save is already running.','error');return;}
    if(typeof output!=='string'||output.length<1000000||output.length>40*1024*1024){
      message('Save refused because the generated website file was incomplete or too large.','error');
      return;
    }
    saving=true;
    relabel();
    message('Saving your website changes to the protected GitHub draft branch…','ok');
    try{
      var state=await json(await fetch(STATUS,{
        method:'GET',cache:'no-store',credentials:'same-origin',redirect:'error'
      }));
      if(state.format!=='naxx-original-editor-save-status-v1'||
         state.ready!==true||state.repository!=='CosmicCuddle/Naxxramas-Resource-Hub'||
         state.branch!=='editor-saves/visual-admin'||
         state.file!=='site-content.html'||state.published!==false||
         !/^[a-f0-9]{40}$/.test(state.expectedHead||'')||
         !/^[a-f0-9]{64}$/.test(state.csrfToken||''))
        throw Error('The protected GitHub Save connection was not verified.');
      var saved=await json(await fetch(SAVE,{
        method:'POST',cache:'no-store',credentials:'same-origin',redirect:'error',
        headers:{
          'Content-Type':'text/html; charset=utf-8',
          'X-Naxx-Csrf-Token':state.csrfToken,
          'X-Naxx-Expected-Head':state.expectedHead
        },
        body:output
      }));
      if(saved.format!=='naxx-original-editor-save-result-v1'||
         saved.repository!==state.repository||saved.branch!==state.branch||
         saved.file!=='site-content.html'||saved.parentCommit!==state.expectedHead||
         !/^[a-f0-9]{40}$/.test(saved.commit||'')||
         saved.published!==false||saved.mainUpdated!==false)
        throw Error('GitHub Save completed without a verifiable receipt.');
      message('Saved successfully to GitHub draft branch “editor-saves/visual-admin”. Your live website was NOT published. You can keep editing and press Save Website Changes again whenever you need.','ok');
    }catch(error){
      message((error&&error.message)||'Save failed. Your current editor changes are still open and were not published.','error');
    }finally{saving=false;relabel();}
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',relabel,{once:true});
  else relabel();
  root.setInterval(relabel,2000);
})(window);
