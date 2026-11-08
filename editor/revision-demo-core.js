/* FICTIONAL REPEATED-EDIT INTERACTION TRIAL — NO REAL SOURCE OR TRUST.
 * All 414 resources and shell are invented on each session. No network,
 * upload, persistent storage, website code execution or publishing.
 * Never use this self-generated example trust with real resources.
 */
(function(root,factory){
  'use strict';
  var isNode=typeof module==='object'&&!!module.exports;
  var reader=isNode?require('./revision-source-reader.js'):root.NaxxRevisionSourceReader;
  var reviewer=isNode?require('./revision-draft-review.js'):root.NaxxRevisionDraftReview;
  var rules=isNode?require('./resource-title-core.js'):root.NaxxResourceTitles;
  var engine=factory(reader,reviewer,rules);
  if(isNode)module.exports=engine;else root.NaxxRevisionDemo=engine;
})(typeof globalThis==='object'?globalThis:this,function(reader,reviewer,rules){
  'use strict';
  var COUNT=414;
  var pathFor=function(i){
    return 'fictional-only/resources/'+String(i+1).padStart(4,'0')+'.fragment';
  };
  function bytes(text){return new TextEncoder().encode(text);}
  async function sha(value,cryptoObj){
    if(!cryptoObj||!cryptoObj.subtle)throw Error('Secure SHA-256 is required for this offline example.');
    var raw=await cryptoObj.subtle.digest('SHA-256',bytes(value));
    return Array.from(new Uint8Array(raw),function(n){
      return n.toString(16).padStart(2,'0');
    }).join('');
  }
  function shell(){
    return {prefix:'FICTIONAL PRIVATE REVISION DEMO\nBEGIN\n',
      suffix:'END FICTIONAL DEMO\n',separators:Array(COUNT+1).fill('\n')};
  }
  function fragmentsFor(revision){
    var fragments=Array.from({length:COUNT},function(_,i){
      return JSON.stringify({
        id:'fictional-'+String(i+1).padStart(4,'0'),
        title:'Example Resource '+(i+1),
        content:'Fictional resource description '+(i+1)+'.',
        section:'Sample section',
        protectedNote:'Example field never edited'
      });
    });
    if(revision===2){
      var last=JSON.parse(fragments[COUNT-1]);
      last.content='An independently newer fictional revision.\n\nSecond paragraph.';
      fragments[COUNT-1]=JSON.stringify(last);
    }
    return fragments;
  }
  function reconstruct(s,fragments){
    var text=s.prefix+s.separators[0];
    for(var i=0;i<COUNT;i++)text+=fragments[i]+s.separators[i+1];
    return text+s.suffix;
  }
  async function build(revision,parent,cryptoObj){
    var parts=shell(),fragments=fragmentsFor(revision);
    var full=reconstruct(parts,fragments),srcSha=await sha(full,cryptoObj);
    var resources=[];
    for(var i=0;i<COUNT;i++){
      resources.push({index:i,path:pathFor(i),
        sha256:await sha(fragments[i],cryptoObj)});
    }
    var manifest={
      format:'naxx-private-versioned-resource-overlay-v1',
      privateOnly:true,publishable:false,deployable:false,
      originalSha256:reader.ANCHOR,revision:revision,parentSha256:parent,
      sourceSha256:srcSha,sourceBytes:bytes(full).length,resources:resources
    };
    var trust={
      expectedRevision:revision,expectedSourceSha256:srcSha,
      expectedParentSha256:parent,
      expectedShellSha256:await sha(JSON.stringify([
        parts.prefix,parts.suffix,parts.separators
      ]),cryptoObj),
      expectedRecordPaths:resources.map(function(x){return x.path;})
    };
    return {snapshot:{manifest:manifest,shell:parts,fragments:fragments},
      trust:trust,fictional:true,independentlyAuthenticated:false};
  }
  async function examples(cryptoObj){
    if(!reader||!reviewer)throw Error('Private source and draft verification modules are required.');
    var first=await build(1,reader.ANCHOR,cryptoObj);
    var second=await build(2,first.snapshot.manifest.sourceSha256,cryptoObj);
    return Object.freeze({first:first,second:second,fictional:true,
      independentGitTrust:false});
  }
  function resource(example,index){
    if(!example||!example.fictional||
       !example.snapshot||!Array.isArray(example.snapshot.fragments)||
       !Number.isInteger(index)||index<0||index>=COUNT)
      throw Error('Choose a fictional resource from a supported revision.');
    return JSON.parse(example.snapshot.fragments[index]);
  }
  async function prepare(example,cryptoObj,index,title,content){
    var original=resource(example,index),change={index:index};
    if(title!==original.title)change.title=title;
    if(content!==original.content)change.content=content;
    if(Object.keys(change).length===1)
      throw Error('Nothing changed. Edit the sample title or description first.');
    return reviewer.prepare(example.snapshot,example.trust,cryptoObj,[change]);
  }
  function check(draft,example){
    var invalid=function(){
      return Object.freeze({decision:'invalid',message:
        'Invalid fictional draft refused. Keep your original example and review it again.'});
    };
    if(!draft||typeof draft!=='object'||Array.isArray(draft)||
       !example||!example.fictional||!example.snapshot||
       !example.snapshot.manifest||!reviewer||!rules||
       Object.keys(draft).sort().join(',')!==
         'changes,format,revision,sourceBaselineSha256,sourceSha256'||
       draft.format!==reviewer.FORMAT||
       draft.sourceBaselineSha256!==reader.ANCHOR||
       !Number.isSafeInteger(draft.revision)||draft.revision<0||
       typeof draft.sourceSha256!=='string'||!/^[a-f0-9]{64}$/.test(draft.sourceSha256))
      return invalid();
    var current=example.snapshot.manifest;
    if(draft.revision!==current.revision||draft.sourceSha256!==current.sourceSha256)
      return Object.freeze({decision:'stale',message:
        'Older draft refused. The saved example is retained. Review changes against the newer source manually.'});
    if(!Array.isArray(draft.changes)||draft.changes.length<1||
       draft.changes.length>COUNT||!Array.isArray(current.resources)||
       current.resources.length!==COUNT)return invalid();
    var seen=new Set(),last=-1;
    for(var i=0;i<draft.changes.length;i++){
      var edit=draft.changes[i];
      if(!edit||typeof edit!=='object'||Array.isArray(edit)||
         !Number.isInteger(edit.index)||edit.index<0||edit.index>=COUNT||
         edit.index<=last||seen.has(edit.index)||
         typeof edit.expectedSha256!=='string'||
         !/^[a-f0-9]{64}$/.test(edit.expectedSha256)||
         !current.resources[edit.index]||
         edit.expectedSha256!==current.resources[edit.index].sha256)
        return invalid();
      var keys=Object.keys(edit).sort().join(',');
      if(!['expectedSha256,index,title','content,expectedSha256,index',
            'content,expectedSha256,index,title'].includes(keys))
        return invalid();
      var existing;
      try{existing=resource(example,edit.index);}catch(_){return invalid();}
      var changed=false;
      if(Object.prototype.hasOwnProperty.call(edit,'title')){
        if(typeof rules.titleValid!=='function'||!rules.titleValid(edit.title)||
           edit.title===existing.title)
          return invalid();
        changed=changed||edit.title!==existing.title;
      }
      if(Object.prototype.hasOwnProperty.call(edit,'content')){
        if(typeof rules.contentValid!=='function'||!rules.contentValid(edit.content)||
           edit.content===existing.content)
          return invalid();
        changed=changed||edit.content!==existing.content;
      }
      if(!changed)return invalid();
      last=edit.index;
      seen.add(edit.index);
    }
    // This verifies only structure and SELF-GENERATED fictional metadata.
    // Real source trust and actual GitHub Save are strictly outside this page.
    return Object.freeze({decision:'matching',message:
      'Example version metadata matches. This does NOT authenticate GitHub or allow a Save.'});
  }
  return Object.freeze({COUNT:COUNT,examples:examples,resource:resource,
    prepare:prepare,check:check});
});
