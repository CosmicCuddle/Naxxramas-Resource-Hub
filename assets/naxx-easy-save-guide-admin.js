/* Keep native Admin lifecycle on standalone guide routes without changing normal navigation. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.NaxxEasySaveGuideAdmin=api;
})(typeof window==='undefined'?globalThis:window,function(){
 'use strict';
 const ROUTES=new Set(['new-players','rules','apply']);
 function install(host,route,refresh){
  if(!ROUTES.has(route))return false;
  if(typeof refresh!=='function'||typeof host.showSection!=='function')throw Error('Guide Admin routing is unavailable.');
  const names=['enterVisualAdminMode','leaveVisualAdminMode','closeAdmin'];
  for(const name of names)if(typeof host[name]!=='function')throw Error('Missing native Admin action: '+name);
  for(const name of names){
   const native=host[name];
   host[name]=function(...args){
    const navigate=host.showSection;
    // The original lifecycle renders currentSection (Home on standalone guides).
    // Its route wrapper would navigate away. Suppress only this synchronous
    // internal refresh; genuine sidebar clicks still use the original router.
    host.showSection=function(){};
    let result;
    try{result=native.apply(this,args);}
    finally{host.showSection=navigate;}
    refresh();
    return result;
   };
  }
  return true;
 }
 return Object.freeze({install});
});
