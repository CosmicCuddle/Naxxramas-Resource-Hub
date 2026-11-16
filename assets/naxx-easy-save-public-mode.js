/* Static Pages editor entry. Read-only GitHub metadata; no write credentials. */
(function(root,factory){
 const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.NaxxEasySavePublicMode=api;
})(typeof window==='undefined'?globalThis:window,function(){
 'use strict';
 const KEY='naxx-easy-save-public-editor-v1',TTL=30*60*1000,REPO='CosmicCuddle/Naxxramas-Resource-Hub';
 const PATHS=Object.freeze(['site-content.html','patches/content.html','change-notes/content.html','patches/update-1.0.6.8.4.json','change-notes/update-1.0.6.8.4.json','new-players/content.html','rules/content.html','apply/content.html']);
 const HEX=/^[0-9a-f]{40}$/;
 const assert=(v,m)=>{if(!v)throw Error(m);};
 function supported(location){return location.protocol==='https:'&&location.hostname==='cosmiccuddle.github.io'&&location.pathname.startsWith('/Naxxramas-Resource-Hub/');}
 function valid(config,now){
  return !!(config&&config.mode==='public-editor'&&config.repository===REPO&&config.branch==='main'&&HEX.test(config.sourceCommit)&&Number.isFinite(config.expires)&&config.expires>now&&config.expires<=now+TTL&&PATHS.every(p=>{const f=config.files?.[p];return f&&HEX.test(f.gitBlob)&&Number.isSafeInteger(f.size)&&f.size>0;}));
 }
 function fromTree(commit,tree,now){
  assert(HEX.test(commit)&&tree&&!tree.truncated&&Array.isArray(tree.tree),'GitHub source tree is unavailable or incomplete.');
  const files={};for(const p of PATHS){
   const rows=tree.tree.filter(x=>x.path===p&&x.type==='blob');assert(rows.length===1,'Missing or ambiguous website source: '+p);
   const f=rows[0];assert(HEX.test(f.sha)&&Number.isSafeInteger(f.size)&&f.size>0,'Invalid website source: '+p);
   files[p]={gitBlob:f.sha,size:f.size};
  }
  return {mode:'public-editor',repository:REPO,branch:'main',sourceCommit:commit,expires:now+TTL,files};
 }
 async function head(fetcher){
  const response=await fetcher('https://api.github.com/repos/'+REPO+'/git/ref/heads/main',{cache:'no-store',credentials:'omit',headers:{Accept:'application/vnd.github+json'}});
  assert(response.ok,'GitHub could not verify main ('+response.status+').');
  const ref=await response.json(),sha=ref?.object?.sha;assert(HEX.test(sha),'GitHub main revision is unavailable.');return sha;
 }
 async function current(fetcher,now){
  const base='https://api.github.com/repos/'+REPO;
  async function get(path){const response=await fetcher(base+path,{cache:'no-store',credentials:'omit',headers:{Accept:'application/vnd.github+json'}});assert(response.ok,'GitHub could not verify the current website ('+response.status+'). Try again later.');return response.json();}
  const ref=await get('/git/ref/heads/main'),sha=ref?.object?.sha;
  assert(HEX.test(sha),'GitHub main revision is unavailable.');
  return fromTree(sha,await get('/git/trees/'+sha+'?recursive=1'),now);
 }
 function load(host,now=Date.now()){
  if(!supported(host.location))return null;
  try{const c=JSON.parse(host.sessionStorage.getItem(KEY));if(valid(c,now))return c;host.sessionStorage.removeItem(KEY);}catch(_){}
  return null;
 }
 function activate(host,config,now=Date.now()){
  assert(supported(host.location)&&valid(config,now),'Invalid public editor session.');
  host.sessionStorage.setItem(KEY,JSON.stringify(config));
 }
 function clear(host){try{host.sessionStorage.removeItem(KEY);}catch(_){}}
 return Object.freeze({KEY,TTL,REPO,PATHS,supported,valid,fromTree,head,current,load,activate,clear});
});
