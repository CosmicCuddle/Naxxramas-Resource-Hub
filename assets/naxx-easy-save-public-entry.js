/* Native login -> isolated editor session. No GitHub write access. */
(function(){
 'use strict';
 const mode=window.NaxxEasySavePublicMode,page=window.NaxxEasySavePublicPage;
 if(!mode||!page||!mode.supported(location))return;
 function setup(){
  const active=()=>typeof isVisualAdminMode==='function'&&isVisualAdminMode();
  const nativeUnlock=window.unlockAdmin,nativeEnter=window.enterVisualAdminMode,nativeLeave=window.leaveVisualAdminMode;
  if([nativeUnlock,nativeEnter,nativeLeave].some(x=>typeof x!=='function'))return;
  const config=window.NaxxEasySaveConfig,editing=config?.mode==='public-editor'&&!!window.NaxxEasySaveSource;
  let pending=false;
  function lock(){unlocked=false;}
  if(editing){
   window.leaveVisualAdminMode=function(...args){
    if(typeof window.NaxxEasySaveCanLeave!=='function'||!window.NaxxEasySaveCanLeave())return;
    mode.clear(window);try{return nativeLeave.apply(this,args);}finally{lock();location.reload();}
   };
   try{if(!window.NaxxEasySaveEditorReady)throw Error('Easy Save toolbar was not initialized.');nativeEnter.call(window);if(!active())throw Error('Native Admin entry did not activate.');
    mode.activate(window,{...config,expires:Date.now()+mode.TTL});
   }catch(e){mode.clear(window);lock();console.error('Easy Save Admin entry:',e);alert('Easy Save could not start: '+e.message+'. Your saved draft is preserved.');location.reload();}
   return;
  }
  function status(){
   const d=document.createElement('dialog');d.style.cssText='max-width:560px;background:#211a15;color:#ecd8b3;border:1px solid #8b7345;border-radius:8px;padding:20px';
   const p=document.createElement('p');p.textContent='Checking the current website version before opening Easy Save…';d.appendChild(p);
   d.addEventListener('cancel',e=>e.preventDefault());document.body.appendChild(d);d.showModal();return {d,p};
  }
  window.unlockAdmin=function(...args){
   if(pending)return;
   const result=nativeUnlock.apply(this,args);
   if(!active())return result;
   pending=true;const {d,p}=status();
   mode.current(fetch.bind(window),Date.now()).then(c=>{mode.activate(window,c);location.reload();}).catch(e=>{
    mode.clear(window);p.textContent='Easy Save could not open: '+e.message+'. Your live website has not changed.';
    const b=document.createElement('button');b.textContent='Return to the website';b.type='button';d.appendChild(b);
    b.addEventListener('click',()=>{d.close();d.remove();pending=false;nativeLeave.call(window);lock();});
   });
   return result;
  };
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});else setup();
})();
