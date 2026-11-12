(function(root){
  'use strict';
  if(!root||typeof document==='undefined')return;
  var API='/__naxx/original-editor/save';
  var saving=false;
  var original=typeof root.exportUpdatedHtml==='function'?root.exportUpdatedHtml:null;
  if(!original)return;

  function buttons(){
    return Array.from(document.querySelectorAll('button')).filter(function(btn){
      return (btn.getAttribute('onclick')||'').indexOf('exportUpdatedHtml()')>=0;
    });
  }
  function relabel(){
    buttons().forEach(function(btn){
      btn.textContent='💾 Save Website Update';
      btn.title='Save these edits to the protected GitHub editing branch';
    });
  }
  function message(text,type){
    if(typeof root.adminMsg==='function')root.adminMsg(text,type||'ok');
  }
  function captureExportedHtml(){
    var captured=null;
    var zip=root.naxxCreateZipArchive;
    var click=HTMLAnchorElement.prototype.click;
    var admin=root.adminMsg;
    if(typeof zip!=='function')throw Error('Original editor export engine is unavailable.');
    root.naxxCreateZipArchive=function(files){
      if(!Array.isArray(files))throw Error('Original editor export package was invalid.');
      var html=files.find(function(file){return file&&file.name==='index.html';});
      if(!html||typeof html.data!=='string'||html.data.length<1024)
        throw Error('Original editor did not produce a complete website file.');
      captured=html.data;
      return new Blob(['local-save-bridge'],{type:'application/zip'});
    };
    HTMLAnchorElement.prototype.click=function(){};
    root.adminMsg=function(){};
    try{
      original();
    }finally{
      root.naxxCreateZipArchive=zip;
      HTMLAnchorElement.prototype.click=click;
      root.adminMsg=admin;
    }
    if(typeof captured!=='string'||captured.length<1024)
      throw Error('Original editor output could not be captured.');
    return captured;
  }
  function embeddedDataFromExport(html){
    var match=/<script\b[^>]*\bid=(['"])embedded-data\1[^>]*>([\s\S]*?)<\/script\s*>/i.exec(html);
    if(!match||typeof match[2]!=='string'||match[2].length<100)
      throw Error('Updated website data was missing from the original editor output.');
    var script=match[2].trim();
    if(!/^window\.NAXX_DATA\s*=\s*/.test(script)||!/[;}]\s*$/.test(script)||
       /<\/script/i.test(script))
      throw Error('Updated website data failed the protected Save format check.');
    return script;
  }
  async function save(){
    if(saving)return;
    saving=true;
    var controls=buttons();
    controls.forEach(function(btn){btn.disabled=true;});
    message('Saving your website edits to the protected GitHub editing branch…','ok');
    try{
      var full=captureExportedHtml();
      var embedded=embeddedDataFromExport(full);
      var response=await fetch(API,{
        method:'POST',cache:'no-store',credentials:'same-origin',redirect:'error',
        headers:{
          'Content-Type':'text/plain;charset=utf-8',
          'X-Naxx-Original-Editor':'save-v1'
        },
        body:embedded
      });
      var result=await response.json().catch(function(){return null;});
      if(!response.ok||!result||result.result!=='saved-to-github-editing-branch'||
         result.published!==false||result.mainUnchanged!==true)
        throw Error(result&&result.error?result.error:'GitHub did not verify the Save.');
      message(
        'Saved to GitHub editing branch. Your live website was NOT published. '+
        'The update is ready for review before it is merged.',
        'ok'
      );
      root.NaxxOriginalEditorLastSave=Object.freeze({
        branch:result.branch,commit:result.commit,
        compareUrl:result.compareUrl,published:false
      });
    }catch(error){
      message(
        (error&&error.message?error.message:'Save failed.')+
        ' Your current edits are still open in this browser and were not published.',
        'error'
      );
    }finally{
      saving=false;
      controls.forEach(function(btn){btn.disabled=false;});
      relabel();
    }
  }

  root.exportUpdatedHtml=save;
  relabel();
  var observer=new MutationObserver(relabel);
  observer.observe(document.documentElement,{childList:true,subtree:true});
})(typeof window==='undefined'?globalThis:window);
