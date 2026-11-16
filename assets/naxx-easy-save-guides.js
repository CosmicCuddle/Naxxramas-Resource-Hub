/* Standalone guide text editing. Preserve every byte outside the selected text spans. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.NaxxEasySaveGuides=api;})(typeof window==='undefined'?globalThis:window,function(){
 'use strict';
 const PATHS=Object.freeze({'new-players':'new-players/content.html',rules:'rules/content.html',apply:'apply/content.html'});
 const blocks=new Set(['p','h2','h3','h4']);
 const voids=new Set(['input','br','hr','img','wbr','meta','link','area','base','col','embed','param','source','track']);
 const forbidden=new Set(['nav','a','iframe','form','button','label','script','style','textarea','select']);
 const assert=(x,m)=>{if(!x)throw Error(m);};
 function attr(token,name){const m=new RegExp('\\b'+name+'\\s*=\\s*(?:"([^"]*)"|\\x27([^\\x27]*)\\x27)','i').exec(token);return m?(m[1]??m[2]):'';}
 function scan(route,html){
  assert(Object.prototype.hasOwnProperty.call(PATHS,route)&&typeof html==='string','Unsupported guide source.');
  const stack=[],out=[];let pos=0;
  const re=/<!--[\s\S]*?-->|<\/?[A-Za-z][A-Za-z0-9-]*(?:[^"'<>]|"[^"]*"|'[^']*')*>|[^<]+|</g;
  for(const m of html.matchAll(re)){
   const raw=m[0];assert(m.index===pos,'Unrecognized guide markup.');pos+=raw.length;
   if(raw.startsWith('<!--'))continue;
   if(raw.startsWith('<')){
    const tag=/^<(\/?)([A-Za-z][A-Za-z0-9-]*)/.exec(raw);assert(tag,'Unexpected guide markup.');
    const name=tag[2].toLowerCase();
    if(tag[1]){assert(stack.length&&stack.at(-1).name===name,'Unbalanced guide markup: '+name);stack.pop();continue;}
    const id=attr(raw,'id'),cls=attr(raw,'class');
    const protectedArea=forbidden.has(name)||(route==='apply'&&(id==='privacy'||id==='upload'||cls.split(/\s+/).some(x=>x==='naxx-guide-status'||x==='naxx-guide-download-row')));
    const frame={name,protected:protectedArea||stack.some(x=>x.protected),block:null};
    if(blocks.has(name)){frame.block={index:out.length,tag:name,segments:[]};out.push(frame.block);}
    if(!voids.has(name))stack.push(frame);
   }else{
    const block=[...stack].reverse().find(x=>x.block);
    if(block&&!stack.some(x=>x.protected)&&raw.trim()){
     const leading=raw.match(/^\s*/)[0],trailing=raw.match(/\s*$/)[0];
     const value=raw.slice(leading.length,raw.length-trailing.length);
     if(value)block.block.segments.push({start:m.index+leading.length,end:m.index+raw.length-trailing.length,raw:value});
    }
   }
  }
  assert(pos===html.length&&!stack.length,'Incomplete guide markup.');
  return out;
 }
 function escape(text){return text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
 function patch(route,html,edits){
  assert(Array.isArray(edits),'Invalid guide edits.');
  const model=scan(route,html),changes=[],seen=new Set();
  for(const e of edits){
   const s=model[e.block]?.segments[e.segment];assert(s&&s.raw===e.expected,'Guide text changed or is protected. Reopen the editor.');
   const key=e.block+':'+e.segment;assert(!seen.has(key),'Duplicate guide edit.');seen.add(key);
   assert(typeof e.text==='string'&&e.text.trim()&&e.text.length<=20000&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(e.text),'Enter nonempty ordinary guide text.');
   const replacement=escape(e.text);
   if(replacement!==s.raw)changes.push({...s,replacement});
  }
  let result=html;for(const s of changes.sort((a,b)=>b.start-a.start))result=result.slice(0,s.start)+s.replacement+result.slice(s.end);
  scan(route,result);return result;
 }
 return Object.freeze({PATHS,scan,patch,escape});
});
