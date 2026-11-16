/* Text-only pencils on original standalone guide blocks. Private preview. */
(function(){
 'use strict';
 const api=window.NaxxEasySaveGuides,source=window.NaxxEasySaveSource;
 if(!api||!source||!Object.prototype.hasOwnProperty.call(api.PATHS,source.route))return;
 const route=source.route,path=api.PATHS[route];let baseline=source.guideMarkup,pending=baseline,dialog=null,observer=null;
 const selector='p,h2,h3,h4';
 const admin=()=>document.body.classList.contains('visual-admin-active');
 const el=(tag,text,parent)=>{const x=document.createElement(tag);if(text!==undefined)x.textContent=text;if(parent)parent.appendChild(x);return x;};
 function template(html){const t=document.createElement('template');t.innerHTML=html;return t.content;}
 function decode(raw){const t=document.createElement('textarea');t.innerHTML=raw;return t.value;}
 function close(){if(dialog){dialog.close();dialog.remove();dialog=null;}}
 function edit(block){
  if(!admin())return;
  close();dialog=el('dialog',undefined,document.body);
  dialog.style.cssText='width:min(720px,90vw);max-height:85vh;overflow:auto;background:#211a15;color:#ecd8b3;border:1px solid #8b7345;border-radius:8px;padding:20px';
  el('h2','Edit guide text',dialog);el('p','Change the text below. Links and formatting stay in place.',dialog);
  const fields=block.segments.map((s,i)=>{
   const label=el('label','Text part '+(i+1),dialog);label.style.display='block';
   const field=el('textarea',undefined,label);field.value=decode(s.raw);field.rows=Math.min(8,Math.max(2,Math.ceil(field.value.length/75)));field.style.cssText='width:100%;box-sizing:border-box;margin:5px 0 10px;padding:8px;background:#15110f;color:#f0dfbd;border:1px solid #78684b';return {s,field,i,original:field.value};
  });
  const error=el('p','',dialog);error.setAttribute('role','alert');
  const apply=el('button','Apply text edit',dialog);apply.type='button';apply.className='primary';
  const cancel=el('button','Cancel',dialog);cancel.type='button';cancel.className='secondary';cancel.style.marginLeft='8px';cancel.addEventListener('click',close);
  apply.addEventListener('click',()=>{
   try{
    const edits=fields.filter(f=>f.field.value!==f.original).map(f=>({block:block.index,segment:f.i,expected:f.s.raw,text:f.field.value}));
    const next=api.patch(route,pending,edits);
    if(next!==pending){window.NaxxEasySaveRefreshGuide(next);pending=next;}
    close();mount();
   }catch(e){error.textContent=e.message;}
  });
  dialog.addEventListener('cancel',e=>{e.preventDefault();close();});dialog.showModal();fields[0]?.field.focus();
 }
 function mount(){
  const article=document.querySelector('[data-naxx-guide-content="'+route+'"]');
  if(!article)return;
  const pencils=article.querySelectorAll('[data-naxx-guide-pencil]');
  if(!admin()){pencils.forEach(x=>x.remove());return;}
  if(pencils.length)return;
  try{
   const model=api.scan(route,pending),expected=[...template(pending).querySelectorAll(selector)],actual=[...article.querySelectorAll(selector)];
   if(model.length!==expected.length||actual.length!==expected.length||actual.some((x,i)=>x.tagName!==expected[i].tagName||x.textContent!==expected[i].textContent))throw Error('Rendered guide does not match its original source.');
   for(const b of model){if(!b.segments.length)continue;const p=el('button','✎',actual[b.index]);p.type='button';p.setAttribute('data-naxx-guide-pencil','1');p.setAttribute('aria-label','Edit this guide text');p.title='Edit this guide text';p.style.cssText='margin-left:8px;padding:2px 7px;border:1px solid #8c7651;border-radius:4px;background:#231a14;color:#f0d5a0;font-size:14px';p.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();edit(b);});}
  }catch(e){console.error('Guide pencil setup:',e);}
 }
 function setup(){
  const grid=document.getElementById('resourceGrid');if(!grid)return;
  observer=new MutationObserver(mount);observer.observe(grid,{childList:true,subtree:true});
  new MutationObserver(()=>{if(!admin())close();mount();}).observe(document.body,{attributes:true,attributeFilter:['class']});mount();
 }
 window.NaxxEasySaveGuideEditor=Object.freeze({path,get:()=>pending,dirty:()=>pending!==baseline,markSaved:text=>{baseline=text;}});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});else setup();
})();
