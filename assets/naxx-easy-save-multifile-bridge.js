/* Private multi-file preview. Existing Admin Mode remains the editing surface. */
(function(){
 'use strict';
 const routes=window.NaxxEasySaveRoutes,session=window.NaxxEasySaveSession,source=window.NaxxEasySaveSource;
 const nativeExport=window.exportUpdatedHtml,zip=window.naxxCreateZipArchive;
 if(!routes||!session||!source||typeof nativeExport!=='function'||typeof zip!=='function')return;
 const config=window.NaxxEasySaveConfig,release=['release-local','public-editor'].includes(config?.mode);
 const route=source.route,root=source.root,guide=window.NaxxEasySaveGuideEditor;let revision=source.revision,baseline=null,busy=false,leaving=false,button,panel,originalAttrs,downloadBlob=null;
 const verifyCurrent=async()=>{if(config?.mode==='public-editor'){const head=await window.NaxxEasySavePublicMode.head(fetch.bind(window));if(head!==config.sourceCommit)throw Error('GitHub main has changed since this draft began. Keep your draft and reopen from the latest website; do not overwrite newer files.');}};
 const snapshot=()=>JSON.parse(JSON.stringify(DATA)); // same lexical DATA used by the native exporter
 const el=(tag,text,parent)=>{const x=document.createElement(tag);if(text)x.textContent=text;if(parent)parent.appendChild(x);return x;};
 function action(text,fn){const b=el('button',text,panel);b.type='button';b.style.cssText='margin:5px 8px 5px 0;padding:8px 12px;border:1px solid #a28c61;border-radius:5px;background:#342729;color:#f0d7a2';b.addEventListener('click',fn);return b;}
 function label(){button.textContent='💾 Save Website Changes';button.removeAttribute('onclick');button.title='Stage changes locally and prepare a combined GitHub Desktop download';}
 function message(text,error){panel.replaceChildren();const h=el('strong',text,panel);h.style.color=error?'#ffada4':'#ead19e';}
 function originalBackup(){
  if(busy)return;
  const p=panel.parentNode,n=panel.nextSibling;panel.remove();button.textContent=originalAttrs.text;
  for(const [k,v] of Object.entries(originalAttrs.attrs)){if(v===null)button.removeAttribute(k);else button.setAttribute(k,v);}
  try{nativeExport.call(window);}finally{label();p.insertBefore(panel,n&&n.parentNode===p?n:null);}
 }
 function backup(){if(guide){action('Download guide text backup',()=>{const url=URL.createObjectURL(new Blob([guide.get()],{type:'text/html;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=route+'-content-backup.html';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);});}else action('Original Export (backup only)',originalBackup);}
 function download(){
  if(!downloadBlob)return;
  const url=URL.createObjectURL(downloadBlob),a=document.createElement('a');a.href=url;a.download='Naxxramas-Website-Update.zip';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
 }
 function show(state){
  const files=Object.entries(state.files).sort(([a],[b])=>a.localeCompare(b)).map(([path,text])=>({path,text}));
  downloadBlob=null;
  if(!files.length){message('No staged website changes.');backup();return;}
  message('Your combined website update is ready!');
  el('p',files.length+' changed file(s), staged in this browser tab. Nothing has been uploaded.',panel);
  const list=el('ul','',panel);for(const f of files)el('li',f.path,list);
  const entries=routes.packageEntries({files},release?{repository:config.repository,branch:config.branch,baseCommit:config.sourceCommit,baseFiles:config.files}:{repository:'CosmicCuddle/Naxxramas-Editor-Save-Sandbox-01',branch:'easy-save/desktop-test'});
  const downloadButton=action('Download All Website Changes (.zip)',async()=>{
   if(busy)return;
   busy=true;button.disabled=true;downloadButton.disabled=true;downloadButton.textContent='Preparing ZIP…';
   try{
    await verifyCurrent();
    const compressor=window.NaxxEasySaveZip;
    if(!downloadBlob)downloadBlob=compressor?await compressor.archive(entries):zip(entries);
    downloadButton.textContent='Download All Website Changes (.zip)';
    el('p','ZIP ready — '+(downloadBlob.size/1000000).toFixed(1)+' MB. Click Download again if your browser blocked the first download.',panel);
    download();
   }catch(e){downloadButton.textContent='Retry ZIP download';el('p','Could not prepare ZIP: '+e.message+'. Your staged files are still saved.',panel);}
   finally{busy=false;button.disabled=false;downloadButton.disabled=false;}
  });
  action(release?'Discard saved draft':'Discard local test draft',discard);
  el('p','You can continue editing another page after saving here. This editor remembers Admin Mode in the same tab until you exit or the session expires. Save again on the next page to include its changes.',panel);
  el('p',release?'Extract the ZIP. Copy the contents of COPY-INTO-REPOSITORY into your Resource Hub checkout on main, after checking it still matches the source revision in UPLOAD-INSTRUCTIONS.txt. Review in GitHub Desktop before committing and pushing.':'PRIVATE TEST ONLY. Extract ZIP, copy the contents of COPY-INTO-REPOSITORY into the sandbox checkout, review changed files, commit and push. Never replace the live website from this preview.',panel);backup();
 }
 async function discard(){
  if(busy||!confirm('Discard ALL staged changes in this tab? Nothing on GitHub will be changed.'))return;
  busy=true;button.disabled=true;
  try{await session.clear(revision);baseline=null;if(guide)guide.markSaved(guide.get());busy=false;location.reload();}
  catch(e){busy=false;button.disabled=false;message(e.message||'Unable to clear the draft.',true);backup();}
 }
 async function save(){
  if(busy)return;busy=true;button.disabled=true;downloadBlob=null;message('Checking website sources and preparing your draft…');
  try{
   if(!guide&&!Object.prototype.hasOwnProperty.call(routes.ROUTES,route))throw Error('This separate guide is not yet supported by multi-file Save.');
   if(!baseline)throw Error('Enter Admin Mode before saving.');
   const after=snapshot();await verifyCurrent();const state=await session.load();
   if(state.revision!==revision)throw Error('Your draft changed elsewhere. Keep this page open and report the conflict.');
   if(guide){
    if(!routes.eq(baseline,after))throw Error('Main website settings must be edited on Home. Your guide edits are still available.');
    if(!guide.dirty()){show(state);return;}
    const text=guide.get(),original=await session.original(root,guide.path);
    const next=await session.commit(revision,[{path:guide.path,text}],{[guide.path]:original});
    revision=next.revision;guide.markSaved(text);show(next);if(guide.dirty())el('p','You made another guide edit while saving. Save again to include it.',panel);return;
   }
   if(routes.eq(baseline,after)){show(state);return;}
   const {originals,files}=await session.sources(root,state);
   const result=routes.plan({route,files,before:baseline,after});
   // Compare semantically to the untouched sources so reverted changes disappear.
   const updates=result.files.map(f=>{
    const original=originals[f.path];
    const same=f.path.endsWith('.json')?routes.eq(JSON.parse(f.text),JSON.parse(original)):routes.eq(routes.parse(f.text).data,routes.parse(original).data);
    return {path:f.path,text:same?original:f.text};
   });
   const next=await session.commit(revision,updates,originals);revision=next.revision;baseline=after;show(next);
  }catch(e){message(e.message||'Unable to prepare the draft.',true);el('p','Nothing new was uploaded. Keep the editor open; your earlier staged draft is preserved.',panel);backup();}
  finally{busy=false;button.disabled=false;}
 }
 function setup(){
  button=document.querySelector('button[onclick*="exportUpdatedHtml"]');if(!button)return;
  originalAttrs={text:button.textContent,attrs:{}};for(const k of ['onclick','title','aria-label'])originalAttrs.attrs[k]=button.getAttribute(k);
  panel=el('section','',null);panel.setAttribute('data-naxx-easy-save-runtime','1');panel.setAttribute('role','region');panel.setAttribute('aria-label','Website update downloads');
  panel.style.cssText='max-width:700px;padding:12px;margin:8px 0;color:#e8d6b6;background:#261e1d;border:1px solid #746046;border-radius:6px;line-height:1.5';
  button.insertAdjacentElement('afterend',panel);label();
  button.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();save();},true);
  // Capture after native initialization and Admin activation, before the first user edit.
  const enter=window.enterVisualAdminMode;
  if(typeof enter==='function')window.enterVisualAdminMode=function(...args){const value=enter.apply(this,args);if(!baseline)baseline=snapshot();return value;};
  if(document.body.classList.contains('visual-admin-active'))baseline=snapshot();
  const dirty=()=>!!((guide&&guide.dirty())||(baseline&&!routes.eq(baseline,DATA)));
  window.NaxxEasySaveCanLeave=()=>{if(busy){alert('Please finish preparing your save or download before leaving Admin Mode.');return false;}if(dirty()&&!confirm('Leave Admin Mode without saving your latest edits? Your previously saved draft will be kept.'))return false;leaving=true;return true;};
  window.addEventListener('beforeunload',e=>{if(!leaving&&(busy||dirty())){e.preventDefault();e.returnValue='';}});
  window.NaxxEasySaveEditorReady=true;
  message(guide?'Use the pencil beside guide text, then Save Website Changes. Shared settings belong on Home.':'Save each page before leaving it. Your local draft combines changes across supported pages.');backup();
  session.load().then(state=>{if(!busy&&state.revision===revision&&Object.keys(state.files).length)show(state);}).catch(e=>{if(!busy){message('Draft storage unavailable: '+e.message,true);backup();}});
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});else setup();
})();
