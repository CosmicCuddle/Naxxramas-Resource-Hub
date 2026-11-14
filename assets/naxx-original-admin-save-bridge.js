/* Original visual Admin -> protected local GitHub draft Save.
 * Localhost only. Public GitHub Pages keeps the original exporter unchanged.
 */
(function(){
  'use strict';
  if(location.hostname!=='127.0.0.1'&&location.hostname!=='localhost')return;

  var REPOSITORY='CosmicCuddle/Naxxramas-Resource-Hub';
  var BRANCH='editor-saves/original-admin';
  var originalExport=window.exportUpdatedHtml;
  var originalAdminMsg=window.adminMsg;

  function notify(text,type){
    if(typeof originalAdminMsg==='function')originalAdminMsg(text,type||'ok');
    else if(window.console)console.log(text);
  }
  function stripRuntimeLoader(html){
    var removed=0;
    var clean=String(html).replace(
      /<link\b[^>]*\bdata-naxx-loader-injected=(["'])1\1[^>]*>/gi,
      function(){removed++;return '';}
    ).replace(
      /<script\b[^>]*\bdata-naxx-loader-injected=(["'])1\1[^>]*>[\s\S]*?<\/script>/gi,
      function(){removed++;return '';}
    );
    if(removed!==19||
       clean.indexOf('data-naxx-loader-injected="1"')!==-1||
       clean.indexOf("data-naxx-loader-injected='1'")!==-1)
      throw Error('The temporary local loader additions were not removed exactly.');
    return clean;
  }
  function captureOriginalExport(){
    if(typeof originalExport!=='function'||
       typeof window.naxxCreateZipArchive!=='function')
      throw Error('The original website Save exporter is unavailable.');

    var entries=null;
    var zip=window.naxxCreateZipArchive;
    var create=URL.createObjectURL;
    var revoke=URL.revokeObjectURL;
    var click=HTMLAnchorElement.prototype.click;
    var admin=window.adminMsg;
    try{
      window.naxxCreateZipArchive=function(input){
        entries=input;
        return new Blob(['naxx-local-capture'],{type:'application/zip'});
      };
      URL.createObjectURL=function(){return 'blob:naxx-local-save-suppressed';};
      URL.revokeObjectURL=function(){};
      HTMLAnchorElement.prototype.click=function(){};
      window.adminMsg=function(){};
      originalExport();
    }finally{
      window.naxxCreateZipArchive=zip;
      URL.createObjectURL=create;
      URL.revokeObjectURL=revoke;
      HTMLAnchorElement.prototype.click=click;
      window.adminMsg=admin;
    }

    if(!Array.isArray(entries))
      throw Error('The original editor did not produce an update package.');
    var full=null;
    for(var i=0;i<entries.length;i++){
      if(entries[i]&&entries[i].name==='index.html'&&
         typeof entries[i].data==='string'){
        full=entries[i].data;break;
      }
    }
    if(!full||full.length<20*1024*1024||full.length>40*1024*1024)
      throw Error('The original edited website output was not captured safely.');

    var output=stripRuntimeLoader(full);
    if(!/^<!doctype html>/i.test(output.slice(0,80))||
       !/id=["']embedded-data["']/.test(output)||
       !/window\.NAXX_DATA\s*=/.test(output))
      throw Error('The captured original website did not pass validation.');
    return output;
  }
  async function connection(){
    var response=await fetch('/api/original-admin/status',{
      method:'GET',cache:'no-store',credentials:'same-origin',redirect:'error'
    });
    var data=await response.json().catch(function(){return null;});
    if(!response.ok||!data||
       data.format!=='naxx-original-admin-local-save-capability-v1'||
       data.ready!==true||data.repository!==REPOSITORY||
       data.branch!==BRANCH||data.file!=='site-content.html'||
       data.liveMainWriteAllowed!==false||data.published!==false||
       !/^[a-f0-9]{40}$/.test(data.expectedHead||'')||
       !/^[a-f0-9]{64}$/.test(data.csrfToken||''))
      throw Error('The protected GitHub draft connection is not ready.');
    return data;
  }
  async function save(){
    var button=document.querySelector('button[onclick*="exportUpdatedHtml"]');
    if(button)button.disabled=true;
    notify('Preparing your website changes for the GitHub draft branch…','ok');
    try{
      var state=await connection();
      var output=captureOriginalExport();
      var response=await fetch('/api/original-admin/save',{
        method:'POST',cache:'no-store',credentials:'same-origin',redirect:'error',
        headers:{
          'X-Naxx-Editor-Protocol':'naxx-original-admin-save-v1',
          'X-Naxx-Expected-Head':state.expectedHead,
          'X-Naxx-Csrf-Token':state.csrfToken,
          'Content-Type':'text/html; charset=utf-8'
        },
        body:new Blob([output],{type:'text/html; charset=utf-8'})
      });
      var result=await response.json().catch(function(){return null;});
      if(!response.ok||!result||
         result.format!=='naxx-original-admin-local-save-result-v1'||
         result.result!=='saved-to-github-draft'||
         result.repository!==REPOSITORY||result.branch!==BRANCH||
         result.file!=='site-content.html'||
         result.parentCommit!==state.expectedHead||
         !/^[a-f0-9]{40}$/.test(result.commit||'')||
         result.liveMainWriteAllowed!==false||result.published!==false)
        throw Error(result&&result.error?result.error:
          'GitHub did not confirm the website draft Save.');

      notify(
        'Website changes saved to the GitHub draft branch. Your live website was NOT published. You can keep editing and save again.',
        'ok'
      );
    }catch(error){
      notify(
        (error&&error.message?error.message:'Website Save failed.')+
        ' Keep this editor open; your live website was not changed.',
        'error'
      );
    }finally{
      if(button)button.disabled=false;
    }
  }
  function setup(){
    var button=document.querySelector('button[onclick*="exportUpdatedHtml"]');
    if(!button)return;
    button.textContent='💾 Save Website Changes';
    button.setAttribute('title',
      'Save changes to the GitHub draft branch; does not publish the live website');
    button.setAttribute('aria-label',
      'Save website changes to GitHub draft branch');
    window.exportUpdatedHtml=save;
  }
  if(document.readyState==='loading')
    document.addEventListener('DOMContentLoaded',setup,{once:true});
  else setup();

  window.NaxxOriginalAdminSaveBridge=Object.freeze({
    stripRuntimeLoader:stripRuntimeLoader
  });
})();