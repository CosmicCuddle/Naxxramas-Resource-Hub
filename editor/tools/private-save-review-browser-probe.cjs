'use strict';
/* Chrome-only read-only proposed Save review: fictional metadata, local JSON
 * File objects and no real resource text, network, storage or publication. */
function saveReviewBrowserProbe(){
  return '('+async function(){
    const d=document,core=window.NaxxSaveReviewCore;
    const sample=window.NaxxSaveReviewExamples;
    if(!core||!sample)return {ready:false,checks:{dependenciesPresent:false}};
    const status=d.getElementById('review-status');
    const message=d.getElementById('review-message');
    const details=d.getElementById('review-details');
    const list=d.getElementById('file-list');
    const area=d.getElementById('changed-files');
    const manifest=d.getElementById('current-manifest');
    const receipt=d.getElementById('planned-receipt');
    const review=d.getElementById('review-selected');
    const clear=d.getElementById('clear-review');
    const reject=d.getElementById('reject-review');
    const current=d.getElementById('sample-current');
    const stale=d.getElementById('sample-stale');
    const conflict=d.getElementById('sample-conflict');
    const first=sample.generate();
    current.click();
    const match=status.dataset.decision;
    const matchedRows=list.children.length;
    const matchedText=list.textContent;
    stale.click();
    const oldStatus=status.dataset.decision;
    const oldText=message.textContent;
    conflict.click();
    const conflictCode=status.dataset.decision;
    const marker='REVIEW_PRIVATE_MARKER_DO_NOT_DISPLAY_4971';
    function choose(input,value){
      const selection=new DataTransfer();
      selection.items.add(new File([value],'fictional.json',{type:'application/json'}));
      input.files=selection.files;
      input.dispatchEvent(new Event('change',{bubbles:true}));
    }
    async function tryFiles(left,right){
      choose(manifest,typeof left==='string'?left:JSON.stringify(left));
      choose(receipt,typeof right==='string'?right:JSON.stringify(right));
      review.click();
      for(let i=0;i<100;i++){
        if(!review.disabled&&status.dataset.decision!=='missing')
          return status.dataset.decision;
        await new Promise(resolve=>setTimeout(resolve,25));
      }
      return 'timeout';
    }
    const local=await tryFiles(first.manifest,first.receipt);
    reject.click();
    const dismissed=status.dataset.decision;
    const dismissedHidden=area.hidden&&list.children.length===0;
    const retainedSelections=manifest.files.length===1&&receipt.files.length===1;
    review.click();
    let reReviewed='timeout';
    for(let i=0;i<100;i++){
      if(!review.disabled&&status.dataset.decision==='review-only'){
        reReviewed='review-only';break;
      }
      await new Promise(resolve=>setTimeout(resolve,25));
    }
    const forged={...first.receipt,
      proposedPaths:first.receipt.proposedPaths.map(x=>({...x}))};
    forged.proposedPaths[0].path=marker+'<img src=x onerror=alert(1)>';
    const rejected=await tryFiles(first.manifest,forged);
    const rejectedContent=d.body.textContent;
    const oldFormat=await tryFiles(first.manifest,{
      format:'naxx-local-resource-draft-v2',title:marker
    });
    const tooLarge=await tryFiles(first.manifest,
      'x'.repeat(core.MAX_RECEIPT_BYTES+1));
    clear.click();
    const checks={
      allControlsPresent:[status,details,area,list,manifest,receipt,
        review,reject,clear,current,stale,conflict].every(Boolean),
      explicitDismissOnlyClearsPreview:dismissed==='rejected'&&dismissedHidden,
      dismissRetainsLocalSelections:retainedSelections,
      dismissedProposalCanBeReReviewed:reReviewed==='review-only',
      fictionalCurrentShowsReviewOnly:match==='review-only',
      fictionalReviewListsThreePaths:matchedRows===3,
      exactResourceNameShown:matchedText.includes('Resource 0001'),
      manifestAndSiteLabels:matchedText.includes('Resource version manifest')&&
        matchedText.includes('Generated complete website'),
      olderDraftBlocked:oldStatus==='stale'&&
        oldText.includes('Keep the draft'),
      changedResourceBlocked:conflictCode==='resource-conflict',
      localJsonFileReviewOnly:local==='review-only',
      forgedMarkupBlocked:rejected==='invalid-receipt',
      forgedMarkerNotDisplayed:!rejectedContent.includes(marker),
      legacyDraftNeverAccepted:oldFormat==='invalid-receipt',
      oversizedReceiptBlocked:tooLarge==='file-limit',
      clearBothSelections:manifest.value===''&&receipt.value==='',
      clearHidesProposedFiles:status.dataset.decision==='missing'&&
        area.hidden===true&&list.children.length===0,
      noReleaseControl:Array.from(d.querySelectorAll('button')).every(b=>
        !/^(Save|Publish|Merge|Apply|Deploy|Upload)/i.test(b.textContent)),
      accessibleStatus:status.getAttribute('aria-live')==='polite',
      stillReadOnly:status.dataset.blocked==='true',
      noFormsOrFrames:d.querySelectorAll('form,iframe').length===0,
      strictOfflineCsp:!!d.querySelector('meta[http-equiv="Content-Security-Policy"]')&&
        d.querySelector('meta[http-equiv="Content-Security-Policy"]').content.includes("connect-src 'none'"),
      mobileDesktopNoOverflow:d.documentElement.scrollWidth<=window.innerWidth+3,
      privateReady:d.documentElement.dataset.privateSaveReviewReady==='true'
    };
    return {ready:Object.values(checks).every(Boolean),checks};
  }.toString()+')()';
}
module.exports={saveReviewBrowserProbe};
