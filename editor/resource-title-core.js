/* Private, browser-compatible resource title and multiline content draft engine.
 * No network requests, source execution, local file writes or publishing.
 * Input must match the exact preserved 30,976,969-byte original site.
 * This is not a runtime parser for arbitrary JavaScript.
 */
(function(root,factory){
  'use strict';
  var engine=factory();
  if(typeof module==='object'&&module.exports)module.exports=engine;
  else root.NaxxResourceTitles=engine;
})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  var BASE_SHA='34455f6d901c538e2491a8c16681692e4c02d918b1984d7d0ba081aacb1049e8';
  var BASE_LENGTH=30976969,COUNT=414;
  function space(s,i){while(i<s.length&&/\s/.test(s[i]))i++;return i;}
  function skipQuote(s,i){
    var q=s[i];i++;
    while(i<s.length){
      if(s[i]==='\\'){i+=2;continue;}
      if(s[i]===q)return i+1;
      i++;
    }
    throw Error('Unterminated source string.');
  }
  function parts(s,start){
    var opens={ '{':'}','[':']','(':')' },first=s[start];
    if(!opens[first])throw Error('Unrecognised source container.');
    var stack=[opens[first]],ranges=[],i=start+1,seg=i;
    while(i<s.length){
      var ch=s[i],next=s[i+1];
      if(ch==='"'||ch==="'"||ch===String.fromCharCode(96)){i=skipQuote(s,i);continue;}
      if(ch==='/'&&next==='/'){var ln=s.indexOf('\n',i+2);i=ln<0?s.length:ln+1;continue;}
      if(ch==='/'&&next==='*'){var end=s.indexOf('*/',i+2);if(end<0)throw Error('Unfinished source comment.');i=end+2;continue;}
      if(opens[ch])stack.push(opens[ch]);
      else if(ch===')'||ch===']'||ch==='}'){
        if(stack.pop()!==ch)throw Error('Source brackets do not match.');
        if(!stack.length){
          if(s.slice(seg,i).trim())ranges.push([seg,i]);
          return {close:i,ranges:ranges};
        }
      }else if(ch===','&&stack.length===1){
        if(s.slice(seg,i).trim())ranges.push([seg,i]);
        if(ranges.length>100000)throw Error('Excessive source items.');
        seg=i+1;
      }
      i++;
    }
    throw Error('Unfinished source structure.');
  }
  function property(s,range){
    var start=space(s,range[0]);
    var m=/^(?:(['"])([A-Za-z_$][\w$-]*)\1|([A-Za-z_$][\w$]*))\s*:/.exec(s.slice(start,Math.min(start+240,range[1])));
    if(!m)throw Error('Resource has an unrecognised property.');
    return {key:m[2]||m[3],begin:space(s,start+m[0].length),end:range[1]};
  }
  function literal(s,at,end){
    var q=s[at];if(q!=='"'&&q!=="'")throw Error('Expected a quoted field.');
    var close=skipQuote(s,at),tail=s.slice(close,end);
    if(tail.trim())throw Error('A resource field is not a static string.');
    var raw=s.slice(at,close);
    if(q==='"') {
      try{return {value:JSON.parse(raw),end:close};}
      catch(_){throw Error('Unsupported string escape.');}
    }
    var out='',i=1;
    while(i<raw.length-1){
      var c=raw[i++];
      if(c!=='\\'){out+=c;continue;}
      var esc=raw[i++];
      if(esc==='n')out+='\n';else if(esc==='r')out+='\r';
      else if(esc==='t')out+='\t';else if(esc==='b')out+='\b';
      else if(esc==='f')out+='\f';else if(esc==='v')out+='\v';
      else if(esc==='x'){
        var x=raw.slice(i,i+2);if(!/^[\da-fA-F]{2}$/.test(x))throw Error('Invalid hex escape.');
        out+=String.fromCharCode(parseInt(x,16));i+=2;
      }else if(esc==='u'){
        var h=raw.slice(i,i+4);if(!/^[\da-fA-F]{4}$/.test(h))throw Error('Invalid Unicode escape.');
        out+=String.fromCharCode(parseInt(h,16));i+=4;
      }else if(esc==='0')out+='\0';
      else if(/[1-9]/.test(esc)||esc===undefined)throw Error('Unsupported legacy escape.');
      else out+=esc;
    }
    return {value:out,end:close};
  }
  function fieldKind(s,at){
    var c=s[at];return c==='['?'array':c==='{'?'object':'other';
  }
  function locate(s){
    var pattern=/\b(?:const|let|var)\s+DATA\s*=\s*JSON\s*\.\s*parse\s*\(\s*JSON\s*\.\s*stringify\s*\(\s*(window\s*\.\s*[A-Za-z_$][\w$]*)\s*\)\s*\)/g;
    var clones=Array.from(s.matchAll(pattern));if(clones.length!==1)throw Error('Original DATA source is not unique.');
    var clone=clones[0],name=clone[1].replace(/\s/g,''),candidates=[];
    for(var i=s.indexOf(name);i>=0&&i<clone.index;i=s.indexOf(name,i+name.length)){
      var eq=space(s,i+name.length);
      if(s[eq]!=='='||s[eq+1]==='='||s[eq+1]==='>')continue;
      var value=space(s,eq+1);if(s[value]==='{')candidates.push(value);
    }
    if(candidates.length!==1)throw Error('Original object is ambiguous.');
    var root=parts(s,candidates[0]);if(root.ranges.length!==27)throw Error('Unexpected original record schema.');
    var found=[];
    root.ranges.forEach(function(range){
      var f=property(s,range);
      if(f.key==='resources'&&fieldKind(s,f.begin)==='array')found.push(f.begin);
    });
    if(found.length!==1)throw Error('Original resource array is missing or ambiguous.');
    var arr=parts(s,found[0]);if(arr.ranges.length!==COUNT)throw Error('Original 414-resource count changed.');
    return arr.ranges;
  }
  function records(s){
    var ranges=locate(s),result=[],ids=new Set();
    ranges.forEach(function(range,index){
      var begin=space(s,range[0]);
      if(s[begin]!=='{')throw Error('Unexpected resource expression.');
      var fields=parts(s,begin);
      if(s.slice(fields.close+1,range[1]).trim())throw Error('Unexpected resource expression suffix.');
      var important={};
      fields.ranges.forEach(function(segment){
        var f=property(s,segment);
        if(f.key==='id'||f.key==='title'||f.key==='section'||f.key==='content'){
          if(important[f.key])throw Error('Repeated resource field.');
          important[f.key]={...literal(s,f.begin,segment[1]),start:f.begin};
        }
      });
      if(!important.id||!important.title||!important.section||!important.content)throw Error('Missing resource identifier, title, content or section.');
      if(ids.has(important.id.value))throw Error('Repeated resource identifier.');
      ids.add(important.id.value);
      result.push({
        index:index,id:important.id.value,title:important.title.value,
        content:important.content.value,section:important.section.value,
        titleStart:important.title.start,titleEnd:important.title.end
      });
    });
    return result;
  }
  function titleValid(v){
    return typeof v==='string'&&v.trim().length>0&&v.length<=160&&!/[<>\x00-\x1f\x7f]/.test(v);
  }
  function contentValid(v){
    // Original content is plain text with intentional newlines and empty entries.
    // Markup insertion is excluded in this initial draft-only content workflow.
    return typeof v==='string'&&v.length<=30000&&
      !/[<>\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(v);
  }
  async function open(source,cryptoObj){
    if(typeof source!=='string'||source.length<1000000)throw Error('Choose the original site-content.html file.');
    var bytes=new TextEncoder().encode(source);
    if(bytes.length!==BASE_LENGTH)throw Error('Wrong website version or incomplete source file.');
    if(!cryptoObj||!cryptoObj.subtle)throw Error('Secure browser SHA-256 support is required.');
    var hash=new Uint8Array(await cryptoObj.subtle.digest('SHA-256',bytes));
    var hex=Array.from(hash,n=>n.toString(16).padStart(2,'0')).join('');
    if(hex!==BASE_SHA)throw Error('Website file does not match the protected original. No edits were loaded.');
    return {baselineSha256:hex,resources:records(source)};
  }
  function draft(changes,model){
    if(!model||model.baselineSha256!==BASE_SHA||!Array.isArray(model.resources)||model.resources.length!==COUNT)
      throw Error('No verified original website has been loaded.');
    var entries=[];
    changes.forEach(function(title,index){
      var r=model.resources[index];
      if(!r)throw Error('An edit targets an unknown resource.');
      if(!titleValid(title))throw Error('A resource title is invalid.');
      if(title!==r.title)entries.push({index:index,title:title});
    });
    entries.sort((a,b)=>a.index-b.index);
    return {format:'naxx-local-resource-title-draft-v1',baselineSha256:BASE_SHA,changes:entries};
  }
  function restore(data,model){
    if(!data||Object.keys(data).sort().join(',')!=='baselineSha256,changes,format'||
       data.format!=='naxx-local-resource-title-draft-v1'||data.baselineSha256!==BASE_SHA||
       !model||model.baselineSha256!==BASE_SHA||!Array.isArray(model.resources)||
       model.resources.length!==COUNT||!Array.isArray(data.changes)||data.changes.length>COUNT)
      throw Error('Draft does not match the protected original website.');
    var values=new Map();
    data.changes.forEach(function(edit){
      if(!edit||Object.keys(edit).sort().join(',')!=='index,title'||!Number.isInteger(edit.index)||
         edit.index<0||edit.index>=COUNT||!titleValid(edit.title)||values.has(edit.index)||
         edit.title===model.resources[edit.index].title)
        throw Error('Draft contains a duplicate, unsafe or unchanged title.');
      values.set(edit.index,edit.title);
    });
    return values;
  }
  function resourceDraft(titles,contents,model){
    if(!model||model.baselineSha256!==BASE_SHA||!Array.isArray(model.resources)||
       model.resources.length!==COUNT||!(titles instanceof Map)||!(contents instanceof Map))
      throw Error('Verified source and both edit collections are required.');
    var indices=new Set([...titles.keys(),...contents.keys()]);
    var edits=[];
    indices.forEach(function(index){
      if(!Number.isInteger(index)||index<0||index>=COUNT)
        throw Error('A resource draft targets an unknown position.');
      var original=model.resources[index],entry={index:index};
      if(typeof original.title!=='string'||typeof original.content!=='string')
        throw Error('A resource is missing verified editable fields.');
      if(titles.has(index)){
        var t=titles.get(index);
        if(!titleValid(t))throw Error('Invalid proposed title.');
        if(t!==original.title)entry.title=t;
      }
      if(contents.has(index)){
        var v=contents.get(index);
        if(!contentValid(v))throw Error('Content must be plain text with a 30,000-character limit.');
        if(v!==original.content)entry.content=v;
      }
      if(Object.keys(entry).length>1)edits.push(entry);
    });
    edits.sort((a,b)=>a.index-b.index);
    return {format:'naxx-local-resource-draft-v2',baselineSha256:BASE_SHA,changes:edits};
  }
  function restoreResourceDraft(data,model){
    if(!data||!model||model.baselineSha256!==BASE_SHA||
       !Array.isArray(model.resources)||model.resources.length!==COUNT)
      throw Error('A verified original website must be loaded first.');
    // Older title-only drafts remain importable, without modifying content.
    if(data.format==='naxx-local-resource-title-draft-v1')
      return {titles:restore(data,model),contents:new Map(),legacyTitleOnly:true};
    if(Object.keys(data).sort().join(',')!=='baselineSha256,changes,format'||
       data.format!=='naxx-local-resource-draft-v2'||data.baselineSha256!==BASE_SHA||
       !Array.isArray(data.changes)||data.changes.length>COUNT)
      throw Error('Unsupported or mismatched resource draft.');
    var titles=new Map(),contents=new Map(),seen=new Set();
    data.changes.forEach(function(item){
      if(!item||typeof item!=='object'||Array.isArray(item)||
         !Number.isInteger(item.index)||item.index<0||item.index>=COUNT||
         seen.has(item.index))throw Error('Invalid or duplicate resource position.');
      seen.add(item.index);
      var keys=Object.keys(item).sort().join(',');
      if(keys!=='index,title'&&keys!=='content,index'&&keys!=='content,index,title')
        throw Error('Unexpected draft field.');
      var original=model.resources[item.index];
      if(!original||typeof original.content!=='string')throw Error('Missing verified content.');
      if(Object.hasOwn(item,'title')){
        if(!titleValid(item.title)||item.title===original.title)
          throw Error('Invalid or unchanged draft title.');
        titles.set(item.index,item.title);
      }
      if(Object.hasOwn(item,'content')){
        if(!contentValid(item.content)||item.content===original.content)
          throw Error('Invalid or unchanged draft content.');
        contents.set(item.index,item.content);
      }
    });
    return {titles:titles,contents:contents,legacyTitleOnly:false};
  }
  return {BASE_SHA:BASE_SHA,BASE_LENGTH:BASE_LENGTH,COUNT:COUNT,open:open,
    titleValid:titleValid,contentValid:contentValid,draft:draft,restore:restore,
    resourceDraft:resourceDraft,restoreResourceDraft:restoreResourceDraft};
});
