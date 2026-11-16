/* Source-aware Easy Save planner. Pure data transforms; no network or writes. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.NaxxEasySaveRoutes=api;})(typeof window==='undefined'?globalThis:window,function(){
 'use strict';
 const ROUTES=Object.freeze({main:'site-content.html',patches:'patches/content.html','change-notes':'change-notes/content.html'});
 const NOTES=Object.freeze({patches:'patches/update-1.0.6.8.4.json','change-notes':'change-notes/update-1.0.6.8.4.json'});
 const SHARED=new Set(['siteTitle','siteSubtitle','sideFooterTitle','sideFooterSubtitle','mainFooterTitle','mainFooterSubtitle','navigationLabels','navigationIcons','navigationIconImages','customMenuPages']);
 const MAIN_ONLY=new Set(['classSuboptions','classHandbookTitles','deletedClassHandbooks','classHandbooksResetV1','genericDungeonHandbookTitle','classHandbookBackgrounds','dungeonHandbooks','dungeonHandbookDetails','dungeonHandbookBackgrounds','playerbotInformation','classIconImages','temporaryBans']);
 const bad=new Set(['__proto__','prototype','constructor']);
 const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
 const copy=x=>x===undefined?undefined:JSON.parse(JSON.stringify(x));
 const own=(x,k)=>Object.prototype.hasOwnProperty.call(x,k);
 const eq=(a,b)=>a===b||(Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((v,i)=>eq(v,b[i])))||(obj(a)&&obj(b)&&Object.keys(a).length===Object.keys(b).length&&Object.keys(a).every(k=>own(b,k)&&eq(a[k],b[k])));
 const assert=(x,m)=>{if(!x)throw Error(m);};
 function changes(a,b,path=[]){
  if(eq(a,b))return [];
  if(obj(a)&&obj(b)){const keys=new Set([...Object.keys(a),...Object.keys(b)]);return [...keys].flatMap(k=>{assert(!bad.has(k),'Unsafe data key.');return changes(a[k],b[k],[...path,k]);});}
  return [{path,old:copy(a),next:copy(b)}];
 }
 function apply(target,delta,label){
  assert(delta.path.length,'Whole-object replacement is not supported.');
  let cur=target;
  for(const k of delta.path.slice(0,-1)){assert(obj(cur)&&own(cur,k)&&obj(cur[k]),'Source shape changed: '+label+' / '+delta.path.join('.'));cur=cur[k];}
  const k=delta.path[delta.path.length-1];assert(obj(cur)&&eq(cur[k],delta.old),'Source conflict: '+label+' / '+delta.path.join('.'));
  if(delta.next===undefined)delete cur[k];else cur[k]=copy(delta.next);
 }
 function parse(html){
  assert(typeof html==='string','Missing original HTML.');
  const re=/(<script\b[^>]*\bid=(["'])embedded-data\2[^>]*>)([\s\S]*?)(<\/script\s*>)/gi;
  const m=[...html.matchAll(re)];assert(m.length===1,'Expected exactly one embedded DATA script.');
  const a=/^\s*window\.NAXX_DATA\s*=\s*([\s\S]*?)\s*;\s*$/.exec(m[0][3]);assert(a,'Unexpected embedded DATA assignment.');
  const data=JSON.parse(a[1]);assert(obj(data)&&Array.isArray(data.resources),'Missing resource data.');
  return {html,data,m:m[0]};
 }
 function serialize(source,data){
  const m=source.m;return source.html.slice(0,m.index)+m[1]+'window.NAXX_DATA = '+JSON.stringify(data).replace(/</g,'\\u003c')+';'+m[4]+source.html.slice(m.index+m[0].length);
 }
 function index(list,label){
  assert(Array.isArray(list),'Missing resources: '+label);
  const map=new Map();for(const r of list){assert(obj(r)&&typeof r.id==='string'&&r.id.length&&!map.has(r.id),'Invalid or duplicate resource ID: '+label);map.set(r.id,r);}return map;
 }
 function owner(section){return section==='Patches'?'patches':section==='Change Notes'?'change-notes':'main';}
 function plan({route,files,before,after}){
  assert(own(ROUTES,route),'Unknown editing route.');
  assert(obj(files)&&obj(before)&&obj(after),'Missing original or edited data.');
  const sources={},drafts={},originalNotes={},notes={},maps={};
  for(const [r,p] of Object.entries(ROUTES)){
   sources[r]=parse(files[p]);drafts[r]=copy(sources[r].data);maps[r]=index(drafts[r].resources,p);
  }
  for(const [r,p] of Object.entries(NOTES)){
   assert(typeof files[p]==='string','Missing external note: '+p);
   const n=JSON.parse(files[p]);assert(obj(n)&&typeof n.id==='string'&&owner(n.section)===r,'Invalid external note: '+p);
   assert(!maps[r].has(n.id),'External note is shadowed by embedded data: '+p);
   originalNotes[r]=n;notes[r]=copy(n);
  }
  const old=index(before.resources,'editor before'),edited=index(after.resources,'editor after');
  // Existing order stays intact; additions append to the owning embedded source.
  // Deletions and arbitrary reorder are separate acceptance gates.
  const oldIds=[...old.keys()],newIds=[...edited.keys()],survivors=oldIds.filter(id=>edited.has(id));
  assert(eq(survivors,newIds.filter(id=>old.has(id))),'Reordering records needs its own verified Save handler.');
  assert(eq(survivors,newIds.slice(0,survivors.length)),'New records must be appended by the original editor.');
  const touched=[];
  for(const id of oldIds.filter(id=>!edited.has(id))){
   const record=old.get(id),r=owner(record.section);
   assert(r===route,'Deleted record belongs to '+r+'; open that section to edit it.');
   assert(!Object.values(notes).some(n=>n.id===id),'Deleting an external release note requires a separate loader update.');
   assert(maps[r].has(id),'No original source for deleted record: '+id);
   for(const other of Object.keys(ROUTES)){
    if(!maps[other].has(id))continue;
    assert(eq(maps[other].get(id),record),'Cannot delete a differing mirrored record: '+id);
    drafts[other].resources=drafts[other].resources.filter(x=>x.id!==id);maps[other].delete(id);
   }
   touched.push({kind:'deleted-resource',id,owner:ROUTES[r]});
  }
  for(const id of newIds.slice(survivors.length)){
   const record=edited.get(id),r=owner(record.section);
   assert(r===route,'New record belongs to '+r+'; open that section to edit it.');
   assert(typeof record.title==='string'&&record.title.trim()&&typeof record.section==='string','Invalid new resource.');
   assert(!Object.values(maps).some(m=>m.has(id))&&!Object.values(notes).some(n=>n.id===id),'New resource ID already exists: '+id);
   // New notes use the existing embedded list; the current external release stays independent.
   drafts[r].resources.push(copy(record));maps[r].set(id,drafts[r].resources.at(-1));
   touched.push({kind:'new-resource',id,owner:ROUTES[r]});
  }
  for(const [id,a] of old){
   const b=edited.get(id);if(!b||eq(a,b))continue;
   assert(a.id===b.id&&a.section===b.section,'Moving or renaming a resource ID is not supported.');
   const r=owner(a.section);
   assert(r===route,'This record belongs to '+r+'; open that section to edit it.');
   const ds=changes(a,b);const external=notes[r]&&notes[r].id===id;
   const target=external?notes[r]:maps[r].get(id);
   assert(target,'No original source for edited record: '+id);
   assert(target.section===a.section,'Resource section conflict: '+id);
   for(const d of ds)apply(target,d,external?NOTES[r]:ROUTES[r]);
   // Existing mirrored copies must agree on the fields being edited, or Save stops.
   for(const other of Object.keys(ROUTES)){
    if(other===r||!maps[other].has(id))continue;
    const mirror=maps[other].get(id);assert(mirror.section===a.section,'Mirrored resource section conflict: '+id);
    for(const d of ds)apply(mirror,d,ROUTES[other]);
   }
   touched.push({kind:'resource',id,owner:external?NOTES[r]:ROUTES[r]});
  }
  for(const k of new Set([...Object.keys(before),...Object.keys(after)])){
   if(k==='resources'||eq(before[k],after[k]))continue;
   if(k==='sectionText'||k==='pageBackgrounds'){
    assert(obj(before[k])&&obj(after[k]),'Unexpected section metadata shape: '+k);
    for(const d of changes(before[k],after[k],[k])){
     const section=d.path[1];assert(typeof section==='string','Missing section name.');
     const r=owner(section);assert(r===route,'This section setting belongs to '+r+'.');
     apply(drafts[r],d,ROUTES[r]);
     // Update only existing mirrors of this section metadata, not unrelated page values.
     for(const other of Object.keys(ROUTES)){
      if(other===r||!obj(drafts[other][k])||!own(drafts[other][k],section))continue;
      apply(drafts[other],d,ROUTES[other]);
     }
    }
    touched.push({kind:'section-metadata',key:k});continue;
   }
   if(k==='patchesGithubSection'){
    assert(route==='patches','Patch download settings belong to Patch Notes.');
    for(const d of changes(before[k],after[k],[k]))apply(drafts.patches,d,ROUTES.patches);
    touched.push({kind:'patch-settings',key:k});continue;
   }
   assert(SHARED.has(k)||MAIN_ONLY.has(k),'Unmapped website data field: '+k);
   const destinations=SHARED.has(k)?Object.keys(ROUTES):['main'];
   assert(SHARED.has(k)||route==='main','This setting must be edited on the main website.');
   for(const d of changes(before[k],after[k],[k]))for(const r of destinations)apply(drafts[r],d,ROUTES[r]);
   touched.push({kind:SHARED.has(k)?'shared':'main',key:k});
  }
  const out=[];
  for(const [r,p] of Object.entries(ROUTES))if(!eq(sources[r].data,drafts[r]))out.push({path:p,text:serialize(sources[r],drafts[r])});
  for(const [r,p] of Object.entries(NOTES))if(!eq(originalNotes[r],notes[r])){
   const n=notes[r],old=originalNotes[r];
   assert(n.id===old.id&&n.section===old.section&&typeof n.title==='string'&&n.title.includes('1.0.6.8.4')&&typeof n.content==='string'&&n.content.length>0,'The existing release loader requires its original ID, section, version in the title and nonempty content: '+p);
   out.push({path:p,text:JSON.stringify(n,null,2)+'\n'});
  }
  return {files:out.sort((a,b)=>a.path.localeCompare(b.path)),touched,unchanged:out.length===0};
 }
 function combine({files,sessions}){
  assert(obj(files)&&Array.isArray(sessions)&&sessions.length>0,'No edit sessions to save.');
  let current={...files};const touched=[];
  // Work on temporary strings. Any conflict aborts the entire batch.
  for(const session of sessions){const result=plan({...session,files:current});for(const f of result.files)current[f.path]=f.text;touched.push(...result.touched);}
  const output=Object.keys(current).filter(p=>current[p]!==files[p]).sort().map(p=>({path:p,text:current[p]}));
  return {files:output,touched,unchanged:!output.length};
 }
 function packageEntries(result,{repository,branch,baseCommit,baseFiles}){
  assert(obj(result)&&Array.isArray(result.files)&&typeof repository==='string'&&typeof branch==='string','Missing package details.');
  const allowed=new Set([...Object.values(ROUTES),...Object.values(NOTES),'new-players/content.html','rules/content.html','apply/content.html']);
  const seen=new Set();
  const entries=result.files.map(f=>{
   assert(allowed.has(f.path)&&!seen.has(f.path)&&typeof f.text==='string','Unexpected update path.');seen.add(f.path);
   return {name:'COPY-INTO-REPOSITORY/'+f.path,data:f.text};
  });
  assert(entries.length>0,'No changed files to download.');
  const instructions=['NAXXRAMAS EASY SAVE — GITHUB DESKTOP','Repository: '+repository,'Branch: '+branch,'','1. Extract this ZIP.','2. In GitHub Desktop, choose Repository > Show in Explorer.','3. Copy the CONTENTS of COPY-INTO-REPOSITORY into that folder.','4. Merge folders and replace only the listed files.','5. Review the changed files, commit and push.','','Files: ',...result.files.map(f=>f.path),'','Do not copy this instructions file or the enclosing COPY-INTO-REPOSITORY folder.','Do not delete any other repository files.','Nothing has been published.'];
  if(baseCommit){
   assert(/^[0-9a-f]{40}$/.test(baseCommit)&&baseFiles,'Missing release source revision.');
   instructions.push('','SOURCE REVISION: '+baseCommit,'Before copying, Fetch origin in GitHub Desktop. If the repository has moved since this revision or contains uncommitted changes, do not overwrite files; reopen the editor from the current checkout.','Original file Git blobs:');
   for(const f of result.files){const meta=baseFiles[f.path];assert(meta&&/^[0-9a-f]{40}$/.test(meta.gitBlob),'Missing original fingerprint: '+f.path);instructions.push(f.path+'  '+meta.gitBlob);}
  }
  entries.push({name:'UPLOAD-INSTRUCTIONS.txt',data:instructions.join('\r\n')+'\r\n'});return entries;
 }
 return Object.freeze({ROUTES,NOTES,parse,plan,combine,packageEntries,changes,eq});
});
