/* Fiction-only repeated-edit preview. Separate from editor/index.html.
 * No real source picker, password, storage, downloads or publishing controls.
 */
(function(){
  'use strict';
  var core=window.NaxxRevisionDemo;
  var $=function(id){return document.getElementById(id);};
  var one=$('revision-one'),two=$('revision-two'),choice=$('resource-index');
  var title=$('edit-title'),content=$('edit-content'),review=$('prepare-draft');
  var check=$('check-draft'),clear=$('clear-draft'),status=$('demo-status');
  var label=$('revision-label'),summary=$('held-summary');
  if(!core||!one||!two||!choice||!title||!content||!review||
     !check||!clear||!status||!label||!summary)
    throw Error('The separate fictional revision preview is incomplete.');
  var examples=null,currentRevision=1,currentIndex=0,heldDraft=null;
  var reviewedValues=null;
  var revisionTicket=0,busy=false;
  function selected(){
    return currentRevision===1?examples.first:examples.second;
  }
  function announce(message,kind){
    status.textContent=message;
    status.dataset.kind=kind||'info';
  }
  function available(){
    var ready=!!examples;
    one.disabled=!ready;
    two.disabled=!ready;
    choice.disabled=!ready;
    title.disabled=!ready;
    content.disabled=!ready;
    review.disabled=!ready||busy;
    check.disabled=!ready||!heldDraft;
    clear.disabled=!ready||!heldDraft;
  }
  function shownRecord(){
    return core.resource(selected(),currentIndex);
  }
  function pendingInput(){
    if(!examples)return false;
    var original=shownRecord();
    if(title.value===original.title&&content.value===original.content)return false;
    // A draft already reviewed and retained in memory is not 'unreviewed'.
    // Further typing after that review still requires leave confirmation.
    if(heldDraft&&reviewedValues&&
       reviewedValues.revision===currentRevision&&
       reviewedValues.index===currentIndex&&
       reviewedValues.title===title.value&&
       reviewedValues.content===content.value)return false;
    return true;
  }
  function render(){
    var record=shownRecord();
    title.value=record.title;
    content.value=record.content;
    choice.value=String(currentIndex);
    label.textContent='Viewing fictional Version '+currentRevision+
      '. The example is NOT independently authenticated.';
    available();
  }
  function canLeave(){
    return !pendingInput()||window.confirm(
      'Discard the unreviewed fictional text on this screen? Any previously held example draft stays in memory.'
    );
  }
  function selectVersion(next){
    if(!examples||next===currentRevision)return;
    if(!canLeave()){
      announce('Version change cancelled; your typed example was kept.','info');
      return;
    }
    currentRevision=next;
    revisionTicket++;
    render();
    announce('Fictional Version '+next+' displayed. A held older draft is not automatically applied.','info');
  }
  one.addEventListener('click',function(){selectVersion(1);});
  two.addEventListener('click',function(){selectVersion(2);});
  choice.addEventListener('change',function(){
    var proposed=Number(choice.value);
    if(!Number.isInteger(proposed)||![0,413].includes(proposed)){
      choice.value=String(currentIndex);
      announce('Choose one of the two supported fictional resources.','invalid');
      return;
    }
    if(proposed!==currentIndex){
      // Choice is already visually updated, but original editable values are
      // still present; validate them against the previous resource.
      if(!canLeave()){
        choice.value=String(currentIndex);
        announce('Resource change cancelled; your typed example was kept.','info');
        return;
      }
      currentIndex=proposed;
      revisionTicket++;
      render();
      announce('Fictional resource '+(currentIndex+1)+' selected.','info');
    }
  });
  function markTyped(){
    revisionTicket++;
    if(busy)
      announce('Example text changed during checking. Review your latest text again.','info');
  }
  title.addEventListener('input',markTyped);
  content.addEventListener('input',markTyped);
  review.addEventListener('click',async function(){
    if(!examples||busy)return;
    var ticket=++revisionTicket;
    var chosen=selected(),index=currentIndex;
    var requestedTitle=title.value,requestedContent=content.value;
    busy=true;
    available();
    announce('Checking all 414 fictional resource records locally…','info');
    try{
      var draft=await core.prepare(chosen,window.crypto,index,
        requestedTitle,requestedContent);
      if(ticket!==revisionTicket){
        // Newer typing, a version switch or Clear owns the current status.
        // A late review must not replace either the draft or its message.
        return;
      }
      // A previously reviewed local example must never disappear silently.
      if(heldDraft&&!window.confirm(
        'Replace the fictional draft already held in memory? The previous example cannot be recovered after replacement.'
      )){
        announce('Replacement cancelled. Your previously held fictional draft was kept.','info');
        return;
      }
      heldDraft=draft;
      reviewedValues={revision:currentRevision,index:index,
        title:requestedTitle,content:requestedContent};
      summary.textContent='Held fictional draft: Version '+draft.revision+
        ', resource '+(index+1)+'. This is not a saved file.';
      announce('Example draft reviewed locally. Switch versions to check for an outdated draft. No website Save occurred.','info');
    }catch(error){
      if(ticket===revisionTicket)
        announce('Example not reviewed: '+((error&&error.message)||'Invalid data.'),'invalid');
    }finally{
      busy=false;
      available();
    }
  });
  check.addEventListener('click',function(){
    if(!examples||!heldDraft)return;
    var result=core.check(heldDraft,selected());
    announce(result.message,result.decision==='stale'?'stale':
      result.decision==='invalid'?'invalid':'info');
  });
  clear.addEventListener('click',function(){
    if(!heldDraft)return;
    // Clear also invalidates a review already awaiting its source hashes.
    revisionTicket++;
    heldDraft=null;
    reviewedValues=null;
    summary.textContent='No fictional draft is held.';
    announce('Held fictional example cleared from memory. Your typed sample text was not changed.','info');
    available();
  });
  available();
  (async function(){
    try{
      examples=await core.examples(window.crypto);
      currentRevision=1;
      currentIndex=0;
      render();
      announce('Ready: all 414 fictional records prepared. Type an example edit to try the review. Nothing was saved.','info');
    }catch(error){
      announce('Fictional preview unavailable: '+((error&&error.message)||'Local verification failed.'),'invalid');
      label.textContent='Examples could not be prepared securely.';
    }
  })();
})();
