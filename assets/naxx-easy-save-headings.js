/* Keep legacy descriptions and explicit module heading overrides. */
(function(root,factory){
 const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else api.install(root,()=>DATA,()=>currentSection);
})(typeof window==='undefined'?globalThis:window,function(){
 'use strict';
 const own=(x,k)=>x!==null&&typeof x==='object'&&Object.prototype.hasOwnProperty.call(x,k);
 function resolve(entry,key,fallback){
  if(key==='description'&&typeof entry==='string')return entry;
  if(own(entry,key)&&typeof entry[key]==='string')return entry[key];
  return fallback();
 }
 function editedRecord(before,oldTitle,oldDesc,title,desc){
  if(title===oldTitle.trim()&&desc===oldDesc.trim())return before;
  return {...(before&&typeof before==='object'?before:{}),heading:title===oldTitle.trim()?oldTitle:title,description:desc===oldDesc.trim()?oldDesc:desc};
 }
 function install(host,data,current){
  const oldHeading=host.getSectionHeading,oldDescription=host.sectionDescription;
  if(typeof oldHeading!=='function'||typeof oldDescription!=='function')throw Error('Original heading editor is unavailable.');
  host.getSectionHeading=function(sec){return resolve(data().sectionText?.[sec],'heading',()=>oldHeading.call(this,sec));};
  host.sectionDescription=function(sec){return resolve(data().sectionText?.[sec],'description',()=>oldDescription.call(this,sec));};
  const oldSave=host.savePageHeadingModal;
  if(typeof oldSave==='function')host.savePageHeadingModal=function(...args){
   const sec=current(),table=data().sectionText,before=table[sec];
   const title=host.document.getElementById('pageHeadingTitle').value.trim();
   const desc=host.document.getElementById('pageHeadingDescription').value.trim();
   const oldTitle=host.getSectionHeading(sec),oldDesc=host.sectionDescription(sec);
   const result=oldSave.apply(this,args);
   if(title&&table[sec]!==before){
    const next=editedRecord(before,oldTitle,oldDesc,title,desc);
    if(next===undefined)delete table[sec];else table[sec]=next;
    host.applyCurrentPageHeading?.();
   }
   return result;
  };
  if(typeof host.applyCurrentPageHeading==='function'&&!host.document.body.classList.contains('naxx-three-page-route'))host.applyCurrentPageHeading();
 }
 return Object.freeze({resolve,editedRecord,install});
});
