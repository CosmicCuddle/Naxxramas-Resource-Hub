/* Original Naxxramas visual editor — GitHub Save bridge.
 * Keeps the existing Admin Mode/editor UI and changes ONLY export/save.
 * On localhost it writes the updated embedded DATA to a protected GitHub
 * draft branch through the local companion. It never publishes main.
 */
(function(root){
  'use strict';
  var LOOPBACK = root.location &&
    root.location.protocol === 'http:' &&
    (root.location.hostname === '127.0.0.1' ||
     root.location.hostname === 'localhost');
  var MARKER = '<script id="embedded-data">';
  var saving = false;

  function message(text,error){
    try {
      if(typeof adminMsg === 'function') {
        adminMsg(text,error ? 'error' : 'ok');
        return;
      }
    } catch(_){}
    root.alert(text);
  }
  function setButtons(){
    document.querySelectorAll('[onclick="exportUpdatedHtml()"]').forEach(function(button){
      button.textContent = LOOPBACK ? '💾 Save Changes' : '💾 Save Changes';
      button.title = LOOPBACK ?
        'Save your editor changes to the protected GitHub draft branch' :
        'Open this website with the local Naxxramas editor launcher to save';
    });
  }
  function parseEmbedded(source){
    var start=source.indexOf(MARKER);
    if(start<0)throw Error('Original embedded data marker is missing.');
    var bodyStart=start+MARKER.length;
    var end=source.indexOf('</script>',bodyStart);
    if(end<0||source.indexOf(MARKER,bodyStart)>=0)
      throw Error('Original embedded data boundary is invalid.');
    return {prefix:source.slice(0,bodyStart),suffix:source.slice(end)};
  }
  async function buildUpdatedSource(){
    var response=await root.fetch('/site-content.html?raw=1',{cache:'no-store',credentials:'same-origin'});
    if(!response.ok)throw Error('The original editor source could not be loaded.');
    var source=await response.text();
    var parts=parseEmbedded(source);
    var json;
    try{ json=JSON.stringify(DATA).replace(/<\/script/gi,'<\\/script'); }
    catch(_){ throw Error('Your current editor data could not be prepared safely.'); }
    if(!json||json.length<1000)throw Error('The editor data looks incomplete.');
    return parts.prefix+'window.NAXX_DATA = '+json+';'+parts.suffix;
  }
  async function status(){
    var response=await root.fetch('/api/original-editor/status',{
      method:'GET',cache:'no-store',credentials:'same-origin',redirect:'error'
    });
    if(!response.ok)throw Error('The GitHub Save connection is not ready.');
    var data=await response.json();
    if(!data||data.format!=='naxx-original-editor-save-capability-v1'||
       data.ready!==true||data.repository!=='CosmicCuddle/Naxxramas-Resource-Hub'||
       data.branch!=='editor-saves/original-ui'||
       data.publishDisabled!==true||
       !/^[a-f0-9]{40}$/.test(data.expectedHead||'')||
       !/^[a-f0-9]{64}$/.test(data.csrfToken||''))
      throw Error('The GitHub Save connection failed its safety check.');
    return data;
  }

  root.exportUpdatedHtml = async function(){
    if(saving)return;
    if(!LOOPBACK){
      message('For the new one-click Save, open the website using Start-Naxxramas-Editor.cmd from your extracted folder. Nothing was changed.',true);
      return;
    }
    saving=true;
    setButtons();
    var buttons=[].slice.call(document.querySelectorAll('[onclick="exportUpdatedHtml()"]'));
    buttons.forEach(function(b){b.disabled=true;});
    message('Saving your changes to the GitHub draft branch…',false);
    try{
      var capability=await status();
      var output=await buildUpdatedSource();
      var response=await root.fetch('/api/original-editor/save',{
        method:'POST',cache:'no-store',credentials:'same-origin',redirect:'error',
        headers:{
          'Content-Type':'text/html; charset=utf-8',
          'X-Naxx-Editor-Protocol':'naxx-original-editor-save-v1',
          'X-Naxx-Expected-Head':capability.expectedHead,
          'X-Naxx-Csrf-Token':capability.csrfToken
        },
        body:output
      });
      var result=await response.json().catch(function(){return null;});
      if(!response.ok||!result||
         result.format!=='naxx-original-editor-save-result-v1'||
         result.result!=='saved-and-verified'||
         result.branch!=='editor-saves/original-ui'||
         result.published!==false||
         !/^[a-f0-9]{40}$/.test(result.commit||''))
        throw Error(result&&result.error ? result.error : 'GitHub did not verify the Save.');
      message('Saved to GitHub successfully. Your live website is unchanged until this draft is reviewed and published.',false);
    }catch(error){
      message((error&&error.message)||
        'Save did not complete. Your edits are still open in this browser.',true);
    }finally{
      saving=false;
      buttons.forEach(function(b){b.disabled=false;});
      setButtons();
    }
  };

  setButtons();
})(window);
