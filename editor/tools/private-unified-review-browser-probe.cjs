'use strict';
/* Fictional-only local Chrome checks. No source content, network or Save. */
function unifiedBrowserProbe(){
  return '('+async function(){
    const d=document,core=window.NaxxUnifiedReviewCore;
    const cases=window.NaxxUnifiedReviewExamples;
    if(!core||!cases)return {ready:false,checks:{dependencies:false}};
    const $=id=>d.getElementById(id);
    const receipt=$('unified-receipt'),review=$('review-unified');
    const dismiss=$('dismiss-unified'),clear=$('clear-unified');
    const sample=$('sample-unified'),unsafe=$('sample-unsafe');
    const forged=$('sample-forged'),status=$('unified-status');
    const list=$('unified-list'),area=$('unified-files');
    const message=$('unified-message');
    sample.click();
    const current=status.dataset.decision;
    const sixRows=list.children.length;
    const currentMessage=message.textContent;
    const text=list.textContent;
    unsafe.click();
    const blockedPath=status.dataset.decision;
    forged.click();
    const blockedPermission=status.dataset.decision;
    const fixture=cases.generate();
    function select(content){
      const files=new DataTransfer();
      files.items.add(new File([content],'fictional.json',{type:'application/json'}));
      receipt.files=files.files;
      receipt.dispatchEvent(new Event('change',{bubbles:true}));
    }
    async function tryJson(value){
      select(typeof value==='string'?value:JSON.stringify(value));
      review.click();
      for(let i=0;i<100;i++){
        if(!review.disabled&&status.dataset.decision!=='missing')
          return status.dataset.decision;
        await new Promise(resolve=>setTimeout(resolve,25));
      }
      return 'timeout';
    }
    const actual=await tryJson(fixture.current);
    dismiss.click();
    const dismissed=status.dataset.decision;
    const hidden=area.hidden&&list.children.length===0;
    const selectionKept=receipt.files.length===1;
    review.click();
    let rerender='timeout';
    for(let i=0;i<100;i++){
      if(!review.disabled&&status.dataset.decision==='preview'){
        rerender='preview';break;
      }
      await new Promise(resolve=>setTimeout(resolve,25));
    }
    const markupMarker='UNSAFE_PRIVATE_MARKER_93817';
    const injected=cases.generate().current;
    injected.proposedFiles[0].path=markupMarker+'<img onerror=alert(1)>';
    const injection=await tryJson(injected);
    const noMarker=!d.body.textContent.includes(markupMarker);
    const oldFormat=await tryJson({format:'naxx-local-draft-v3'});
    const oversize=await tryJson('x'.repeat(core.MAX_JSON_BYTES+1));
    clear.click();
    const checks={
      controlsPresent:[receipt,review,dismiss,clear,sample,unsafe,forged,
        status,list,area,message].every(Boolean),
      exampleShowsClaimOnly:current==='preview'&&
        currentMessage.includes('CLAIMED file changes')&&sixRows===6,
      groupedPagesAndResources:text.includes('Resource 0001')&&
        text.includes('Resource 0414')&&text.includes('Navigation settings'),
      candidateFlaggedUnapproved:text.includes('UNAPPROVED candidate file'),
      unsafePathBlocked:blockedPath==='invalid',
      falseApprovalBlocked:blockedPermission==='invalid',
      localFileReview:actual==='preview',
      dismissOnlyHidesReview:dismissed==='dismissed'&&hidden,
      dismissPreservesSelection:selectionKept,
      canReviewDismissedAgain:rerender==='preview',
      injectedPathBlocked:injection==='invalid'&&noMarker,
      unsupportedPageDraftBlocked:oldFormat==='invalid',
      oversizedReceiptBlocked:oversize==='limit',
      clearResetsEverything:receipt.value===''&&list.children.length===0&&
        area.hidden&&status.dataset.decision==='missing',
      stillReadOnly:status.dataset.blocked==='true',
      noSaveControls:Array.from(d.querySelectorAll('button')).every(b=>
        !/^(Save|Publish|Upload|Deploy|Merge|Apply)/i.test(b.textContent)),
      noFormsOrFrames:d.querySelectorAll('form,iframe').length===0,
      ariaStatus:status.getAttribute('aria-live')==='polite',
      offlineCsp:!!d.querySelector('meta[http-equiv="Content-Security-Policy"]')&&
        d.querySelector('meta[http-equiv="Content-Security-Policy"]').content.includes("connect-src 'none'"),
      noHorizontalOverflow:d.documentElement.scrollWidth<=window.innerWidth+3,
      readyFlag:d.documentElement.dataset.privateUnifiedReviewReady==='true'
    };
    return {ready:Object.values(checks).every(Boolean),checks};
  }.toString()+')()';
}
module.exports={unifiedBrowserProbe};
