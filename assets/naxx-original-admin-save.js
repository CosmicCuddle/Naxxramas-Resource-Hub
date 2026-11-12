/* Naxxramas original visual-admin Save bridge.
 * Keeps the existing editor and its export preparation exactly as-is.
 * On localhost, sends the cleaned full-site source to a protected GitHub
 * draft branch. Elsewhere, fixes the legacy download so it contains
 * site-content.html instead of replacing the lightweight index.html loader.
 */
(function(root){
  'use strict';
  var LINK_ASSETS=[
    'naxx-countdowns.css','naxx-theme-v2.css','naxx-theme-v3.css',
    'naxx-countdowns-compact.css','naxx-home-class-selector.css',
    'naxx-three-pages.css','naxx-game-clients-guide.css'
  ];
  var SCRIPT_ASSETS=[
    'naxx-countdowns.js','naxx-resource-navigation.js',
    'naxx-handbook-progression-fix.js','naxx-resource-information.js',
    'naxx-home-class-selector.js','naxx-talent-set-sync.js',
    'naxx-talent-sets-full-sync.js','naxx-warrior-talent-sets.js',
    'naxx-final-vanilla-talent-sets.js','naxx-three-pages.js',
    'naxx-game-clients-guide.js','naxx-original-admin-save.js'
  ];
  var MAX_HTML=40*1024*1024;
  var SHA=/^[0-9a-f]{40}$/;
  var TOKEN=/^[0-9a-f]{64}$/;
  function loopback(){
    return location.protocol==='http:' &&
      (location.hostname==='127.0.0.1'||location.hostname==='localhost'||
       location.hostname==='[::1]');
  }
  function esc(value){return value.replace(/[.*+?^$()|[\]\\{}]/g,'\\$&');}
  function stripInjected(html){
    if(typeof html!=='string'||html.length<1024||html.length>MAX_HTML)
      throw Error('The prepared website source was missing or unexpectedly sized.');
    var cleaned=html;
    LINK_ASSETS.forEach(function(name){
      cleaned=cleaned.replace(new RegExp(
        "<link\\b[^>]*\\bhref=([\"'])[^\"']*"+esc(name)+
        "(?:\\?[^\"']*)?\\1[^>]*>","gi"),'');
    });
    SCRIPT_ASSETS.forEach(function(name){
      cleaned=cleaned.replace(new RegExp(
        "<script\\b[^>]*\\bsrc=([\"'])[^\"']*"+esc(name)+
        "(?:\\?[^\"']*)?\\1[^>]*>\\s*<\\/script>","gi"),'');
    });
    if(!/^<!doctype html>/i.test(cleaned.trimStart())||
       cleaned.indexOf('id="embedded-data"')<0||
       cleaned.indexOf('window.NAXX_DATA')<0||
       cleaned.indexOf('function exportUpdatedHtml')<0)
      throw Error('The original editor did not produce a complete Resource Hub document.');
    return cleaned;
  }
  function captureOriginalExport(originalExport){
    var captured=null;
    var oldZip=root.naxxCreateZipArchive;
    var oldMsg=root.adminMsg;
    var oldClick=HTMLAnchorElement.prototype.click;
    try{
      root.naxxCreateZipArchive=function(entries){
        if(!Array.isArray(entries))throw Error('Unexpected original export package.');
        var site=entries.find(function(x){return x&&x.name==='index.html';});
        if(!site||typeof site.data!=='string')
          throw Error('Original editor export did not contain its website snapshot.');
        captured=site.data;
        return new Blob([''],{type:'application/zip'});
      };
      root.adminMsg=function(){};
      HTMLAnchorElement.prototype.click=function(){};
      originalExport();
    }finally{
      root.naxxCreateZipArchive=oldZip;
      root.adminMsg=oldMsg;
      HTMLAnchorElement.prototype.click=oldClick;
    }
    if(!captured)throw Error('Original editor export could not be captured safely.');
    return stripInjected(captured);
  }
  function instructions(){
    return [
      'NAXXRAMAS RESOURCE HUB - CORRECT WEBSITE UPDATE',
      '================================================',
      '',
      'This ZIP contains site-content.html.',
      '',
      'IMPORTANT: DO NOT replace index.html.',
      'index.html is the lightweight Resource Hub loader and must stay in place.',
      '',
      'If the direct local GitHub Save connection is unavailable:',
      '1. Open CosmicCuddle/Naxxramas-Resource-Hub on GitHub.',
      '2. Work on a non-main review branch.',
      '3. Replace ONLY site-content.html with the file in this ZIP.',
      '4. Review the branch before merging/publishing.',
      '',
      'The visual editor itself has not been redesigned by this Save fix.',
      ''
    ].join('\r\n');
  }
  function downloadCorrected(html,zip){
    var blob=zip([
      {name:'site-content.html',data:html},
      {name:'HOW_TO_UPDATE_GITHUB.txt',data:instructions()}
    ]);
    var url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download='Naxxramas_Resource_Hub_Update.zip';a.hidden=true;
    document.body.appendChild(a);
    try{a.click();}finally{
      a.remove();setTimeout(function(){URL.revokeObjectURL(url);},1500);
    }
  }
  async function status(){
    var r=await fetch('/api/original-editor/status',{
      method:'GET',cache:'no-store',credentials:'same-origin',redirect:'error'
    });
    if(!r.ok)throw Error('Local GitHub Save service is unavailable.');
    var x=await r.json();
    if(!x||x.format!=='naxx-original-editor-save-capability-v1'||
       x.ready!==true||x.repository!=='CosmicCuddle/Naxxramas-Resource-Hub'||
       x.branch!=='editor-saves/original-admin'||x.publishDisabled!==true||
       !SHA.test(x.expectedHead||'')||!TOKEN.test(x.csrfToken||''))
      throw Error('Local GitHub Save service is not safely connected.');
    return x;
  }
  async function saveRemote(html,cap){
    var response=await fetch('/api/original-editor/save',{
      method:'POST',cache:'no-store',credentials:'same-origin',redirect:'error',
      headers:{
        'Content-Type':'text/html; charset=utf-8',
        'X-Naxx-Editor-Protocol':'naxx-original-admin-save-v1',
        'X-Naxx-Expected-Head':cap.expectedHead,
        'X-Naxx-Csrf-Token':cap.csrfToken
      },body:html
    });
    var data=await response.json().catch(function(){return null;});
    if(!response.ok||!data||
       data.format!=='naxx-original-editor-save-result-v1'||
       data.result!=='saved-to-review-branch'||
       data.repository!=='CosmicCuddle/Naxxramas-Resource-Hub'||
       data.branch!=='editor-saves/original-admin'||
       data.parentCommit!==cap.expectedHead||
       !SHA.test(data.commit||'')||data.commit===data.parentCommit||
       data.mainUnchanged!==true||data.published!==false)
      throw Error((data&&data.error)||'GitHub did not independently confirm the Save.');
    return data;
  }
  function setButtonLabel(){
    var button=document.querySelector('button[onclick*="exportUpdatedHtml"]');
    if(button){
      button.textContent=loopback()?'💾 Save Website Update':'⬇ Export Website Update';
      button.title=loopback()?
        'Save this edited website to the protected GitHub review branch':
        'Download the corrected site-content.html update package';
    }
  }
  function install(){
    if(typeof root.exportUpdatedHtml!=='function'||
       typeof root.naxxCreateZipArchive!=='function')return false;
    if(root.exportUpdatedHtml.__naxxOriginalSaveBridge)return true;
    var originalExport=root.exportUpdatedHtml;
    var originalZip=root.naxxCreateZipArchive;
    var wrapped=async function(){
      try{
        var html=captureOriginalExport(originalExport);
        if(loopback()){
          var cap=await status();
          if(typeof root.adminMsg==='function')
            root.adminMsg('Saving your website changes to the GitHub review branch…','ok');
          var saved=await saveRemote(html,cap);
          if(typeof root.adminMsg==='function')
            root.adminMsg(
              'Saved to GitHub review branch '+saved.branch+
              '. Your live website was NOT published.','ok');
        }else{
          downloadCorrected(html,originalZip);
          if(typeof root.adminMsg==='function')
            root.adminMsg(
              'Website update downloaded correctly as site-content.html. Do NOT replace index.html.','ok');
        }
      }catch(error){
        if(typeof root.adminMsg==='function')
          root.adminMsg(
            'Save did not complete: '+((error&&error.message)||'unknown error')+
            '. Your current editor changes are still open.','bad');
        else if(root.console)console.error(error);
      }
    };
    wrapped.__naxxOriginalSaveBridge=true;
    root.exportUpdatedHtml=wrapped;
    setButtonLabel();
    return true;
  }
  if(!install()){
    var attempts=0,timer=setInterval(function(){
      attempts++;
      if(install()||attempts>100)clearInterval(timer);
    },100);
  }
  root.NaxxOriginalAdminSave=Object.freeze({
    stripInjected:stripInjected,instructions:instructions,
    installed:function(){
      return !!(root.exportUpdatedHtml&&root.exportUpdatedHtml.__naxxOriginalSaveBridge);
    }
  });
})(typeof window==='undefined'?globalThis:window);
