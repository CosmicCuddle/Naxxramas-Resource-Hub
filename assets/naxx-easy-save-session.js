/* Private preview: tab-scoped draft, persisted across same-origin page navigation. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.NaxxEasySaveSession=api;})(typeof window==='undefined'?globalThis:window,function(){
 'use strict';
 const config=typeof window!=='undefined'&&window.NaxxEasySaveConfig;
 const release=!!(config&&config.mode==='release-local'&&config.repository==='CosmicCuddle/Naxxramas-Resource-Hub'&&config.branch==='main'&&/^[0-9a-f]{40}$/.test(config.sourceCommit)&&['127.0.0.1','localhost','[::1]'].includes(window.location.hostname));
 const publicEditor=!!(config&&config.mode==='public-editor'&&typeof window!=='undefined'&&window.NaxxEasySavePublicMode?.supported(window.location)&&window.NaxxEasySavePublicMode.valid(config,Date.now()));
 if(config&&((config.mode==='release-local'&&!release)||(config.mode==='public-editor'&&!publicEditor)))throw Error('Invalid editor configuration.');
 const scoped=release||publicEditor;
 const PIN=scoped?config.sourceCommit:'5064a9d3cadb7071caa1d0f67e43f87d4b591043';
 const PATHS=['site-content.html','patches/content.html','change-notes/content.html','patches/update-1.0.6.8.4.json','change-notes/update-1.0.6.8.4.json','new-players/content.html','rules/content.html','apply/content.html'];
 const empty=()=>({pin:PIN,revision:0,files:{}});
 const assert=(v,m)=>{if(!v)throw Error(m);};
 function advance(state,revision,updates,originals){
  assert(state.pin===PIN&&state.revision===revision,'Your draft changed in another page. Reload before saving.');
  const files={...state.files};
  for(const f of updates){
   assert(PATHS.includes(f.path)&&typeof f.text==='string'&&typeof originals[f.path]==='string','Unexpected draft file.');
   // Exact reversion removes an entry; semantic reversion is handled by the planner.
   if(f.text===originals[f.path])delete files[f.path];else files[f.path]=f.text;
  }
  return {pin:PIN,revision:revision+1,files};
 }
 let dbPromise,key;
 function db(){
  if(!dbPromise)dbPromise=new Promise((resolve,reject)=>{
   const req=indexedDB.open(publicEditor?'naxx-easy-save-public-v1':release?'naxx-easy-save-release-v1':'naxx-easy-save-preview-v1',1);
   req.onupgradeneeded=()=>req.result.createObjectStore('drafts');
   req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
   req.onblocked=()=>reject(Error('Close another Easy Save preview before continuing.'));
  });
  return dbPromise;
 }
 function id(){
  if(key)return key;
  const storageKey=publicEditor?'naxx-easy-save-public-id:'+PIN:release?'naxx-easy-save-release-id:'+PIN:'naxx-easy-save-preview-id';
  key=sessionStorage.getItem(storageKey);
  if(!key){key=crypto.randomUUID();sessionStorage.setItem(storageKey,key);}
  return key;
 }
 async function load(){
  const d=await db();return new Promise((resolve,reject)=>{
   const tx=d.transaction('drafts','readonly'),req=tx.objectStore('drafts').get(id());
   req.onsuccess=()=>{const value=req.result||empty();if(value.pin!==PIN)reject(Error('This draft is for a different website revision.'));else resolve(value);};
   req.onerror=()=>reject(req.error);
  });
 }
 async function commit(revision,updates,originals){
  const d=await db();return new Promise((resolve,reject)=>{
   const tx=d.transaction('drafts','readwrite'),store=tx.objectStore('drafts'),req=store.get(id());let next,problem;
   req.onsuccess=()=>{try{next=advance(req.result||empty(),revision,updates,originals);store.put(next,id());}catch(e){problem=e;tx.abort();}};
   tx.oncomplete=()=>resolve(next);tx.onerror=()=>reject(problem||tx.error);tx.onabort=()=>reject(problem||tx.error||Error('Draft was not saved.'));
  });
 }
 async function clear(revision){
  const d=await db();return new Promise((resolve,reject)=>{
   const tx=d.transaction('drafts','readwrite'),store=tx.objectStore('drafts'),req=store.get(id());let problem;
   req.onsuccess=()=>{const state=req.result||empty();if(state.revision!==revision){problem=Error('Your draft changed elsewhere. Reload before clearing.');tx.abort();return;}store.put({pin:PIN,revision:revision+1,files:{}},id());};
   tx.oncomplete=()=>resolve();tx.onerror=()=>reject(problem||tx.error);tx.onabort=()=>reject(problem||tx.error||Error('Draft was not cleared.'));
  });
 }
 async function original(root,path){
  assert(PATHS.includes(path),'Unknown website source.');
  const r=await fetch(new URL(path,root),{cache:'no-store'});if(!r.ok)throw Error('Cannot read '+path+' ('+r.status+').');
  const bytes=await r.arrayBuffer();
  if(scoped){
   const expected=config.files?.[path];
   assert(expected&&bytes.byteLength===expected.size,'Source size changed: '+path+'. Restart the editor.');
   let hash;
   if(publicEditor){
    const header=new TextEncoder().encode('blob '+bytes.byteLength+'\0'),joined=new Uint8Array(header.length+bytes.byteLength);
    joined.set(header);joined.set(new Uint8Array(bytes),header.length);
    hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-1',joined)),b=>b.toString(16).padStart(2,'0')).join('');
   }else hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
   assert(hash===(publicEditor?expected.gitBlob:expected.sha256),'Source fingerprint changed: '+path+'. GitHub Pages may still be updating. Reopen the editor after checking your repository.');
  }
  return new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);
 }
 async function read(root,path,state){return Object.prototype.hasOwnProperty.call(state.files,path)?state.files[path]:original(root,path);}
 async function sources(root,state){
  const values=await Promise.all(PATHS.map(p=>original(root,p)));const originals=Object.fromEntries(PATHS.map((p,i)=>[p,values[i]]));
  return {originals,files:{...originals,...state.files}};
 }
 return Object.freeze({PIN,PATHS,empty,advance,load,commit,clear,original,read,sources});
});
