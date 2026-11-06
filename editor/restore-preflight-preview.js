/* Fictional, read-only interaction; this is NOT the website editor. */
(function(){
  'use strict';
  var core=window.NaxxRestorePreflight;
  if(!core)throw Error('Private restore preflight engine is missing.');
  var base=core.BASE;
  var fakeHash=function(index){return String(index+1).padStart(64,'0');};
  var originalResources=Array.from({length:core.COUNT},function(_,i){
    return {index:i,path:core.pathFor(i),sha256:fakeHash(i)};
  });
  function manifest(){
    return {format:core.MANIFEST,privateOnly:true,publishable:false,deployable:false,
      originalSha256:base,revision:0,parentSha256:null,sourceSha256:base,
      sourceBytes:30976969,resources:originalResources.map(function(r){return {...r};})};
  }
  function draft(){
    return {format:core.DRAFT,sourceBaselineSha256:base,revision:0,
      sourceSha256:base,changes:[{index:0,expectedSha256:fakeHash(0),title:'Fictional example'}]};
  }
  var titles={
    'review-only':'Version metadata matches',
    'stale':'Draft is from an older version',
    'record-conflict':'Resource version conflict',
    'invalid-draft':'Draft cannot be reviewed',
    'invalid-source':'Current version cannot be reviewed'
  };
  function fixture(name){
    var m=manifest(),d=draft();
    if(name==='stale'){
      m.revision=1;m.parentSha256=base;m.sourceSha256='a'.repeat(64);
      m.resources[5].sha256='b'.repeat(64);
    }else if(name==='conflict'){
      m.resources[0].sha256='c'.repeat(64);
    }else if(name==='invalid'){
      d.changes[0].expectedSha256='incorrect';
    }else if(name!=='current')throw Error('Unknown demo case.');
    return {m:m,d:d};
  }
  function show(name){
    var f=fixture(name),answer=core.assess(f.m,f.d);
    document.getElementById('decision-title').textContent=titles[answer.code];
    document.getElementById('decision-message').textContent=answer.message;
    document.getElementById('decision-detail').textContent=
      'Example result: '+answer.code+'. '+answer.requestedResourceCount+
      ' fictional resource(s) listed. Latest example revision: '+
      (answer.latestRevision===null?'unverified':answer.latestRevision)+
      '. No save, merge, upload or publication is possible.';
    document.getElementById('result').dataset.blocked=String(answer.isBlocked);
    document.getElementById('result').dataset.decision=answer.code;
    document.querySelectorAll('button[data-case]').forEach(function(button){
      button.setAttribute('aria-pressed',String(button.dataset.case===name));
    });
  }
  document.querySelectorAll('button[data-case]').forEach(function(button){
    button.addEventListener('click',function(){show(button.dataset.case);});
  });
  show('current');
  document.documentElement.dataset.previewReady='true';
})();
