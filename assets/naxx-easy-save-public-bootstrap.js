/* Public page loaders use ordinary sources unless Admin deliberately activates editing. */
(function(root,factory){
 const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.NaxxEasySavePublicBootstrap=api;
})(typeof window==='undefined'?globalThis:window,function(){
 'use strict';
 function setup(host,root,route){
  const editing=!!host.NaxxEasySaveConfig,session=host.NaxxEasySaveSession;
  const state=editing?Promise.resolve().then(()=>{if(!session||typeof session.load!=='function')throw Error('The editing draft service is unavailable.');return session.load();}):Promise.resolve(null);
  const rootUrl=new URL(root,host.location.href);
  const guide=['new-players','rules','apply'].includes(route);
  function source(path,cache='default'){
   if(editing)return state.then(s=>session.read(rootUrl,path,s));
   return host.fetch(new URL(path,rootUrl),{cache}).then(r=>{if(!r.ok)throw Error('Website content unavailable: '+path);return r.text();});
  }
  async function ready(guideMarkup){
   host.NaxxEasySavePublicPage=Object.freeze({route,root:rootUrl.href});
   if(editing){
    const draft=await state;
    host.NaxxEasySaveSource=Object.freeze({route,root:rootUrl.href,revision:draft.revision,...(guide?{guideMarkup}: {})});
   }
  }
  function scripts(){
   const names=['naxx-easy-save-headings.js?v=1'];
   if(editing){names.push('naxx-easy-save-routes.js?v=1');if(guide)names.push('naxx-easy-save-guides.js?v=1','naxx-easy-save-guide-editor.js?v=1');names.push('naxx-easy-save-zip.js?v=1','naxx-easy-save-multifile-bridge.js?v=2');}
   names.push('naxx-easy-save-public-entry.js?v=1');return names.map(p=>'<scr'+'ipt src="'+new URL('assets/'+p,rootUrl).href+'"></scr'+'ipt>').join('');
  }
  function recover(error){
   if(!editing)return false;
   host.NaxxEasySavePublicMode.clear(host);host.alert('Easy Save could not open the current website: '+error.message+'. Your saved draft is preserved.');host.location.reload();return true;
  }
  return Object.freeze({editing,source,ready,scripts,recover});
 }
 return Object.freeze({setup});
});
