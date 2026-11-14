/* Original Naxxramas visual Admin -> protected local GitHub draft Save.
 * Activates ONLY on localhost/127.0.0.1. Public GitHub Pages keeps the
 * original exporter untouched.
 */
(function(){
  'use strict';
  if(location.hostname!=='127.0.0.1'&&location.hostname!=='localhost')return;

  var REPO='CosmicCuddle/Naxxramas-Resource-Hub';
  var BRANCH='editor-saves/original-admin';
  var originalExport=window.exportUpdatedHtml;
  var originalAdminMsg=window.adminMsg;

  function message(text,type){
    if(typeof originalAdminMsg==='function')originalAdminMsg(text,type||'ok');
    else if(window.console)console.log(text);
  }
  function stripLoaderAdditions(html){
    var count=0;
    var next=String(html).replace(
      /<link\b[^>]*\bdata-naxx-loader-injected=(["'])1\1[^>]*>/gi,
      function(){count++;return '';}
    ).replace(
      /<script\b[^>]*\bdata-naxx-loader-injected=(["'])1\1[^>]*>[\s\S]*?<\/script>/gi,
      function(){count++;return '';}
    );
    if(count!==19||next.indexOf('data-naxx-loader-injected="1"')!==-1||
       next.indexOf("data-naxx-loader-injected='1'")!==-1)
      throw Error('The local loader additions were not removed exactly.');
    return next;
  }
  function captureOriginalExporter(){
    if(typeof originalExport!=='function'||
       typeof window.naxxCreateZipArchive!=='function')
      throw Error('The original website exporter is unavailable.');

    var entries=null;
    var zip=window.naxxCreateZipArchive;
    var create=URL.createObjectURL;
    var revoke=URL.revokeObjectURL;
    var click=HTMLAnchorElement.prototype.click;
    var admin=window.adminMsg;
    try{
      window.naxxCreateZipArchive=function(input){
        entries=input;
        return new Blob(['local-save-capture'],{type:'application/zip'});
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
    var file=null;
    for(var i=0;i<entries.length;i++){
      if(entries[i]&&entries[i].name==='index.html'&&
         typeof entries[i].data==='string'){
        file=entries[i];break;
      }
    }
    if(!file||file.data.length<20*1024*1024||file.data.length>40*1024*1024)
      throw Error('The original edited website output was not captured safely.');
    var output=stripLoaderAdditions(file.data);
    if(!/^<!doctype html>/i.test(output.slice(0,80))||
       !/id=["']embedded-data["']/.test(output)||
       !/window\.NAXX_DATA\s*=/.test(output))
      throw Error('The captured original website did not pass validation.');
    return output;
  }
  async function status(){
    var r=await fetch('/api/original-admin/status',{
      method:'GET',cache:'no-store',credentials:'same-origin',redirect:'error'
    });
    var data=await r.json().catch(function(){return null;});
    if(!r.ok||!data||
       data.format!=='naxx-original-admin-local-save-capability-v1'||
       data.ready!==true||data.repository!==REPO||data.branch!==BRANCH||
       data.file!=='site-content.html'||data.liveMainWriteAllowed!==false||
       data.published!==false||!/^[a-f0-9]{40}$/.test(data.expectedHead||'')||
       !/^[a-f0-9]{64}$/.test(data.csrfToken||''))
      throw Error('The protected GitHub draft connection is not ready.');
    return data;
  }
  async function saveOriginalAdmin(){
    var button=document.querySelector('button[onclick*="exportUpdatedHtml"]');
    if(button)button.disabled=true;
    message('Preparing your website changes for the GitHub draft branch…','ok');
    try{
      var connection=await status();
      var output=captureOriginalExporter();
      var body=new Blob([output],{type:'text/html; charset=utf-8'});
      var response=await fetch('/api/original-admin/save',{
        method:'POST',cache:'no-store',credentials:'same-origin',redirect:'error',
        headers:{
          'X-Naxx-Editor-Protocol':'naxx-original-admin-save-v1',
          'X-Naxx-Expected-Head':connection.expectedHead,
          'X-Naxx-Csrf-Token':connection.csrfToken,
          'Content-Type':'text/html; charset=utf-8'
        },
        body:body
      });
      var result=await response.json().catch(function(){return null;});
      if(!response.ok||!result||
         result.format!=='naxx-original-admin-local-save-result-v1'||
         result.result!=='saved-to-github-draft'||
         result.repository!==REPO||result.branch!==BRANCH||
         result.file!=='site-content.html'||
         result.parentCommit!==connection.expectedHead||
         !/^[a-f0-9]{40}$/.test(result.commit||'')||
         result.liveMainWriteAllowed!==false||result.published!==false)
        throw Error(result&&result.error?result.error:
          'GitHub did not confirm the draft Save.');
      message(
        'Website changes saved to the GitHub draft branch. Your live website was NOT published. You can keep editing and save again.',
        'ok'
      );
    }catch(error){
      message(
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
    button.setAttribute('title','Save changes to the GitHub draft branch; does not publish main');
    button.setAttribute('aria-label','Save website changes to GitHub draft branch');
    window.exportUpdatedHtml=saveOriginalAdmin;
  }
  if(document.readyState==='loading')
    document.addEventListener('DOMContentLoaded',setup,{once:true});
  else setup();
})();