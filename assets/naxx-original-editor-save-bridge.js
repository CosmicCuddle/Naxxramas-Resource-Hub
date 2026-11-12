/*
 * Naxxramas ORIGINAL visual-editor Save bridge.
 *
 * This does not replace the editor. It reuses the existing exportUpdatedHtml()
 * routine to build exactly the same sanitised edited document the owner already
 * uses, captures that document before the legacy ZIP is created, strips only
 * loader-injected runtime tags, and sends the result to the local one-file
 * GitHub Save service. On a non-localhost page it falls back to a safe ZIP
 * containing site-content.html (never index.html).
 */
(function(root){
  'use strict';
  var PROTOCOL='naxx-original-visual-editor-save-v1';
  var MAX_HTML=45*1024*1024;
  var originalExport=root.exportUpdatedHtml;
  var originalZip=root.naxxCreateZipArchive;
  if(typeof originalExport!=='function'||typeof originalZip!=='function')return;

  function localHost(){
    return root.location && root.location.protocol==='http:' &&
      (root.location.hostname==='127.0.0.1'||
       root.location.hostname==='localhost'||
       root.location.hostname==='[::1]');
  }
  function message(text,kind){
    if(typeof root.adminMsg==='function')root.adminMsg(text,kind||'ok');
    else if(root.console)root.console.log(text);
  }
  function stripLoaderTags(html){
    if(typeof html!=='string'||html.length<20*1024*1024||html.length>MAX_HTML)
      throw Error('The edited website output was outside the expected size.');
    html=html.replace(
      /<script\b[^>]*\bdata-naxx-loader-injected=(["'])1\1[^>]*><\/script>\s*/gi,''
    );
    html=html.replace(
      /<link\b[^>]*\bdata-naxx-loader-injected=(["'])1\1[^>]*>\s*/gi,''
    );
    if(/data-naxx-loader-injected/i.test(html))
      throw Error('A loader-only tag remained in the saved website.');
    if(!/<!doctype html>/i.test(html.slice(0,4096))||
       !/id=["']embedded-data["']/i.test(html)||
       !/window\.NAXX_DATA\s*=\s*/.test(html)||
       !/function\s+exportUpdatedHtml\s*\(/.test(html)||
       /Loading the Naxxramas Resource Hub…/.test(html))
      throw Error('The captured document did not match the original website editor output.');
    return html;
  }
  function captureOriginalOutput(){
    var captured=null;
    var sentinel={naxxCapture:true};
    root.naxxCreateZipArchive=function(entries){
      if(!Array.isArray(entries))throw Error('Legacy editor export package was invalid.');
      var found=entries.find(function(item){
        return item&&item.name==='index.html'&&typeof item.data==='string';
      });
      if(!found)throw Error('Legacy editor did not produce its expected complete document.');
      captured=found.data;
      throw sentinel;
    };
    try{
      originalExport();
      throw Error('Legacy editor export unexpectedly completed without capture.');
    }catch(error){
      if(error!==sentinel)throw error;
    }finally{
      root.naxxCreateZipArchive=originalZip;
    }
    return stripLoaderTags(captured);
  }
  function safeInstructions(){
    return [
      'NAXXRAMAS RESOURCE HUB — SAFE MANUAL UPDATE',
      '============================================',
      '',
      'This package contains site-content.html only.',
      '',
      'IMPORTANT: DO NOT replace index.html.',
      'The root index.html is the small Resource Hub loader and must stay intact.',
      '',
      'If the automatic Save connection is unavailable:',
      '1. Keep this ZIP private until you are ready to update GitHub.',
      '2. Replace ONLY site-content.html in the Naxxramas-Resource-Hub repository.',
      '3. Review the change on a branch before merging/publishing.',
      '',
      'The normal local Save button is preferred because it creates/updates',
      'editor-saves/cosmic-working without publishing main.',
      ''
    ].join('\r\n');
  }
  function downloadSafe(html){
    var blob=originalZip([
      {name:'site-content.html',data:html},
      {name:'HOW_TO_UPDATE_GITHUB.txt',data:safeInstructions()}
    ]);
    var url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download='Naxxramas_Resource_Hub_Safe_Update.zip';
    a.hidden=true;document.body.appendChild(a);
    try{a.click();}finally{
      a.remove();setTimeout(function(){URL.revokeObjectURL(url);},1500);
    }
    message('Safe update downloaded. It contains site-content.html only. Do NOT replace index.html.','ok');
  }
  async function status(){
    var response=await root.fetch('/api/naxx-editor/status',{
      method:'GET',cache:'no-store',credentials:'same-origin',redirect:'error'
    });
    if(!response.ok)throw Error('Local Save connection is unavailable.');
    var data=await response.json();
    if(!data||data.format!=='naxx-original-editor-status-v1'||
       data.repository!=='CosmicCuddle/Naxxramas-Resource-Hub'||
       data.branch!=='editor-saves/cosmic-working'||
       data.ready!==true||data.publishDisabled!==true||
       typeof data.csrfToken!=='string'||!/^[a-f0-9]{64}$/.test(data.csrfToken)||
       !(data.workingHead===null||/^[a-f0-9]{40}$/.test(data.workingHead)))
      throw Error('Local Save connection did not pass verification.');
    return data;
  }
  async function directSave(html){
    var state=await status();
    var headers={
      'Content-Type':'text/html; charset=utf-8',
      'X-Naxx-Editor-Protocol':PROTOCOL,
      'X-Naxx-Csrf-Token':state.csrfToken,
      'X-Naxx-Expected-Working-Head':state.workingHead||'none'
    };
    var response=await root.fetch('/api/naxx-editor/save',{
      method:'POST',cache:'no-store',credentials:'same-origin',
      redirect:'error',headers:headers,body:html
    });
    var result=null;
    try{result=await response.json();}catch(_){}
    if(!response.ok||!result||
       result.format!=='naxx-original-editor-save-v1'||
       result.repository!=='CosmicCuddle/Naxxramas-Resource-Hub'||
       result.branch!=='editor-saves/cosmic-working'||
       result.changedPath!=='site-content.html'||
       result.indexHtmlUnchanged!==true||
       result.published!==false||
       !/^[a-f0-9]{40}$/.test(result.commit||''))
      throw Error((result&&result.error)||
        'Save outcome is uncertain. Keep this editor open and do not retry automatically.');
    return result;
  }

  root.exportUpdatedHtml=async function(){
    var button=document.querySelector('button[onclick="exportUpdatedHtml()"]');
    if(button)button.disabled=true;
    message(localHost()?
      'Preparing your website update for GitHub…':
      'Preparing a safe website update download…','');
    try{
      var html=captureOriginalOutput();
      if(!localHost()){
        downloadSafe(html);
        return;
      }
      var saved=await directSave(html);
      message(
        'Saved to GitHub working branch '+saved.branch+
        '. Only site-content.html changed. Your live website was NOT published.',
        'ok'
      );
    }catch(error){
      message(
        (error&&error.message)||
        'Save was not verified. Your edits remain open in the editor.',
        'error'
      );
    }finally{
      if(button)button.disabled=false;
    }
  };

  var button=document.querySelector('button[onclick="exportUpdatedHtml()"]');
  if(button){
    button.textContent='💾 Save Website Update';
    button.title='Save edited website to the protected GitHub working branch';
  }
  root.NaxxOriginalEditorSaveBridge=Object.freeze({
    protocol:PROTOCOL,captureOriginalOutput:captureOriginalOutput,
    stripLoaderTags:stripLoaderTags,safeInstructions:safeInstructions
  });
})(typeof window==='undefined'?globalThis:window);
