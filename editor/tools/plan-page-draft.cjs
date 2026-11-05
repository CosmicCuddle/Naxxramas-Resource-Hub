'use strict';
/*
 * Strict offline page/navigation draft preflight. Matches the static editor's
 * fragment positions and escape logic, but DOES NOT execute original HTML,
 * render it, write a file, modify Git or publish. All five source files
 * must match their pinned draft hashes before any result is accepted.
 *
 * The output is a non-deployable in-memory plan, not an export.
 */
const fs=require('node:fs'),path=require('node:path');
const crypto=require('node:crypto');
const PAGES=['new-players/content.html','rules/content.html',
  'apply/content.html','game-clients/content.html'];
const NAV='content/navigation.json',HEX=/^[a-f0-9]{64}$/;
const EXPECTED_BRANCH='feature/multi-file-editor-export-2026-11-05';
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
function normalPath(root,relative){
  if(![...PAGES,NAV].includes(relative))throw Error('Unapproved page update path.');
  const filename=path.join(root,...relative.split('/'));
  const stat=fs.lstatSync(filename);
  if(!stat.isFile()||stat.isSymbolicLink())throw Error('Page source is not a regular file.');
  return filename;
}
function tagEnd(source,start){
  let quote=null;
  for(let i=start+1;i<source.length;i++){
    const c=source[i];
    if(quote){if(c===quote)quote=null;}
    else if(c==='"'||c==="'")quote=c;
    else if(c==='>')return i+1;
  }
  throw Error('A page has an unfinished HTML tag.');
}
function runs(source){
  const out=[],stack=[];let at=0;
  while(at<source.length){
    let lt=source.indexOf('<',at);if(lt<0)lt=source.length;
    const ignored=stack.some(tag=>/^(script|style|iframe|textarea|form|noscript)$/.test(tag));
    if(lt>at&&!ignored){
      const raw=source.slice(at,lt);
      const first=raw.search(/\S/);
      if(first>=0){
        const last=raw.search(/\s*$/),begin=at+first,end=at+last;
        if(end>begin)out.push({id:'T:'+begin,kind:'text',
          start:begin,end,original:source.slice(begin,end)});
      }
    }
    if(lt===source.length)break;
    if(source.slice(lt,lt+4)==='<!--'){
      const end=source.indexOf('-->',lt+4);
      if(end<0)throw Error('A page has an unfinished HTML comment.');
      at=end+3;continue;
    }
    const next=tagEnd(source,lt),tag=source.slice(lt,next);
    const m=/^<\s*(\/?)\s*([A-Za-z][\w:-]*)/.exec(tag);
    if(m){
      const close=!!m[1],name=m[2].toLowerCase();
      if(close){
        const pos=stack.lastIndexOf(name);
        if(pos>=0)stack.length=pos;
      }else{
        if(name==='a'&&!ignored){
          const href=/\bhref\s*=\s*(["'])(.*?)\1/i.exec(tag);
          if(href){
            const delta=href.index+href[0].indexOf(href[1])+1;
            const start=lt+delta,stop=start+href[2].length;
            out.push({id:'H:'+start,kind:'href',start,end:stop,
              quote:href[1],original:href[2]});
          }
        }
        if(!/\/\s*>$/.test(tag)&&
          !/^(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$/.test(name))
          stack.push(name);
      }
    }
    at=next;
  }
  return out;
}
function escapeText(value){
  return value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function escapeAttr(value,quote){
  return escapeText(value).replace(quote==='"'?/"/g:/'/g,quote==='"'?'&quot;':'&#39;');
}
function validHref(v){
  if(!v||v!==v.trim()||/[\x00-\x1f\x7f]/.test(v)||v.startsWith('//'))
    return false;
  if(/^(?:javascript|data|file|blob|vbscript):/i.test(v))return false;
  try{
    return ['http:','https:','mailto:'].includes(
      new URL(v,'https://example.invalid/Naxxramas-Resource-Hub/').protocol
    );
  }catch(_){return false;}
}
function validateNav(value){
  const slugs=['new-players','rules','apply'];
  if(!value||value.format!=='naxx-navigation-v1'||
     Object.keys(value).sort().join(',')!=='format,pages'||
     !Array.isArray(value.pages)||value.pages.length!==3)
    throw Error('Unexpected navigation document.');
  for(let i=0;i<3;i++){
    const p=value.pages[i];
    if(!p||p.slug!==slugs[i]||p.group!=='General'||
       Object.keys(p).sort().join(',')!=='group,icon,intro,label,slug,title')
      throw Error('Unapproved navigation structure change.');
    for(const field of ['label','title','intro']){
      const v=p[field],limit=field==='intro'?280:field==='title'?90:50;
      if(typeof v!=='string'||!v.trim()||v.length>limit||
         /[\x00-\x1f\x7f]/.test(v))
        throw Error('Unsafe navigation text.');
    }
    if(typeof p.icon!=='string'||p.icon.length>90||
       !/^[a-z0-9_]+\.jpg$/i.test(p.icon))
      throw Error('Unsafe navigation image name.');
  }
  return value;
}
function plan(root,draft){
  if(typeof root!=='string'||!path.isAbsolute(root)||
     !draft||typeof draft!=='object'||Array.isArray(draft)||
     Object.keys(draft).sort().join(',')!==
       'createdAt,files,format,sourceBranchHint,sourceCommitVerified,navigation'.split(',').sort().join(',')||
     draft.format!=='naxx-local-draft-v3'||
     draft.sourceBranchHint!==EXPECTED_BRANCH||
     draft.sourceCommitVerified!==false||
     !Array.isArray(draft.files)||draft.files.length!==4)
    throw Error('Unrecognised or unverified page editor draft.');
  const changed=[],verified=[];
  for(let i=0;i<PAGES.length;i++){
    const relative=PAGES[i],entry=draft.files[i];
    if(!entry||Object.keys(entry).sort().join(',')!=='edits,path,sourceSha256'||
       entry.path!==relative||!HEX.test(entry.sourceSha256)||
       !entry.edits||typeof entry.edits!=='object'||Array.isArray(entry.edits))
      throw Error('Unapproved page path or source metadata.');
    const source=fs.readFileSync(normalPath(root,relative));
    if(source.length>2*1024*1024||sha(source)!==entry.sourceSha256)
      throw Error('Page source hash mismatch; stop and reconcile the draft.');
    const sourceText=source.toString('utf8');
    if(!Buffer.from(sourceText,'utf8').equals(source))
      throw Error('Page source is not valid UTF-8.');
    const scanned=runs(sourceText),byId=new Map(scanned.map(r=>[r.id,r]));
    if(scanned.length<10||byId.size!==scanned.length)
      throw Error('Original page has ambiguous editable positions.');
    const requested=[];
    for(const [id,value] of Object.entries(entry.edits)){
      const run=byId.get(id);
      if(!run||typeof value!=='string'||value.length>30000)
        throw Error('Draft contains an unrecognised or oversized page edit.');
      if(run.kind==='href'&&!validHref(value))
        throw Error('Draft contains an unsafe hyperlink.');
      requested.push({run,value});
    }
    requested.sort((a,b)=>b.run.start-a.run.start);
    let text=sourceText;
    for(const {run,value} of requested){
      if(text.slice(run.start,run.end)!==run.original)
        throw Error('Draft original text position changed unexpectedly.');
      const encoded=run.kind==='href'?escapeAttr(value,run.quote):escapeText(value);
      text=text.slice(0,run.start)+encoded+text.slice(run.end);
    }
    runs(text); // check edited HTML tokenises; never render or execute it.
    const next=Buffer.from(text,'utf8');
    verified.push({path:relative,sourceSha256:sha(source),editablePositions:scanned.length});
    if(!source.equals(next))changed.push({
      path:relative,kind:'page',sourceSha256:sha(source),
      nextSha256:sha(next),modifiedFields:requested.length,bytes:next
    });
  }
  const nav=draft.navigation;
  if(!nav||Object.keys(nav).sort().join(',')!=='document,path,sourceSha256'||
     nav.path!==NAV||!HEX.test(nav.sourceSha256))
    throw Error('Unapproved navigation draft metadata.');
  const navOriginalBytes=fs.readFileSync(normalPath(root,NAV));
  if(navOriginalBytes.length>64000||sha(navOriginalBytes)!==nav.sourceSha256)
    throw Error('Navigation source hash mismatch.');
  const navOriginal=validateNav(JSON.parse(navOriginalBytes.toString('utf8')));
  const nextNav=validateNav(nav.document);
  for(let i=0;i<3;i++){
    if(navOriginal.pages[i].slug!==nextNav.pages[i].slug||
       navOriginal.pages[i].group!==nextNav.pages[i].group)
      throw Error('Protected navigation routing cannot change.');
  }
  const navUpdatedBytes=Buffer.from(JSON.stringify(nextNav,null,2)+'\n','utf8');
  verified.push({path:NAV,sourceSha256:sha(navOriginalBytes),editablePositions:12});
  const oldEntries=JSON.stringify(navOriginal);
  if(oldEntries!==JSON.stringify(nextNav)){
    changed.push({
      path:NAV,kind:'navigation',sourceSha256:sha(navOriginalBytes),
      nextSha256:sha(navUpdatedBytes),
      modifiedFields:navOriginal.pages.reduce((n,p,i)=>
        n+['label','title','intro','icon'].filter(k=>p[k]!==nextNav.pages[i][k]).length,0),
      bytes:navUpdatedBytes
    });
  }
  return {
    format:'naxx-local-page-change-plan-v1',sourceVerified:true,
    branchHint:EXPECTED_BRANCH,sourceCommitVerified:false,
    verified,changed:changed.sort((a,b)=>a.path.localeCompare(b.path)),
    exportAllowedWithoutReview:false,published:false
  };
}
if(require.main===module){
  process.stderr.write('Private page draft preflight library; requires a verified supplied draft. No update written.\n');
}
module.exports={PAGES,NAV,runs,plan,validateNav,validHref};
