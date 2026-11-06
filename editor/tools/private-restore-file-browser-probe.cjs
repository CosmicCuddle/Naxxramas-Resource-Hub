'use strict';
/* Browser-only, local synthetic File API test. No user files, source content,
 * screenshots, uploads, storage, form submits, or external requests. */
function fileReviewBrowserProbe(){
  return '('+async function(){
    const d=document,core=window.NaxxRestorePreflight,inspect=window.NaxxLocalRestoreFiles;
    if(!core||!inspect)return {ready:false,checks:{dependenciesLoaded:false}};
    const status=d.getElementById('check-result');
    const button=d.getElementById('check-files'),clear=d.getElementById('clear-files');
    const left=d.getElementById('manifest-file'),right=d.getElementById('draft-file');
    const blank=()=>String(1).padStart(64,'0');
    const hash=i=>String(i+1).padStart(64,'0');
    const resources=Array.from({length:core.COUNT},(_,i)=>({
      index:i,path:core.pathFor(i),sha256:hash(i)
    }));
    const original={format:core.MANIFEST,privateOnly:true,
      publishable:false,deployable:false,originalSha256:core.BASE,
      revision:0,parentSha256:null,sourceSha256:core.BASE,
      sourceBytes:30976969,resources};
    const marker='PRIVATE_TEST_RESOURCE_BODY_NOT_FOR_DISPLAY_84012';
    const draft={format:core.DRAFT,sourceBaselineSha256:core.BASE,
      revision:0,sourceSha256:core.BASE,
      changes:[{index:0,expectedSha256:blank(),title:marker}]};
    function fileFor(input,value){
      const bundle=new DataTransfer();
      bundle.items.add(new File([value],'private-test.json',{type:'application/json'}));
      input.files=bundle.files;
      input.dispatchEvent(new Event('change',{bubbles:true}));
    }
    async function action(m,draftText){
      fileFor(left,typeof m==='string'?m:JSON.stringify(m));
      fileFor(right,typeof draftText==='string'?draftText:JSON.stringify(draftText));
      button.click();
      for(let i=0;i<90;i++){
        if(!button.disabled&&status.dataset.decision!=='missing-files')
          return status.dataset.decision;
        await new Promise(resolve=>setTimeout(resolve,30));
      }
      return 'timeout';
    }
    // After each prior result, changing inputs must reset to missing-files
    // before any new result can be announced.
    const matched=await action(original,draft);
    const later={...original,revision:1,parentSha256:core.BASE,
      sourceSha256:'a'.repeat(64),
      resources:original.resources.map(x=>({...x}))};
    later.resources[413].sha256='c'.repeat(64);
    const stale=await action(later,draft);
    const changed={...original,
      resources:original.resources.map(x=>({...x}))};
    changed.resources[0].sha256='d'.repeat(64);
    const conflict=await action(changed,draft);
    const unsupported=await action(original,{
      format:'naxx-local-resource-draft-v2',
      baselineSha256:core.BASE,changes:[{index:0,title:marker}]
    });
    const corrupt=await action(original,'{');
    const tooLarge=await action('x'.repeat(inspect.MAX_MANIFEST_BYTES+1),draft);
    clear.click();
    const checks={
      twoFilesChosenWithoutNetwork:!!left&&!!right&&
        left.type==='file'&&right.type==='file'&&!left.multiple&&!right.multiple,
      matchingJsonReviewOnly:matched==='review-only',
      staleJsonBlocked:stale==='stale',
      changedTargetBlocked:conflict==='record-conflict',
      legacyV2DraftNotMisinterpreted:unsupported==='invalid-draft',
      corruptJsonRefused:corrupt==='invalid-draft',
      fileTooLargeRefused:tooLarge==='size-limit',
      clearRemovesInputs:left.value===''&&right.value==='',
      clearedResult:status.dataset.decision==='missing-files',
      noPrivateTitlePrinted:!d.body.textContent.includes(marker),
      noSavePublishMergeControls:!Array.from(d.querySelectorAll('button')).some(
        x=>/^(Save|Publish|Merge|Apply|Upload)/i.test(x.textContent)),
      noFormOrIframe:d.querySelectorAll('form,iframe').length===0,
      statusAccessible:status.getAttribute('aria-live')==='polite',
      mobileDesktopNoHorizontalOverflow:d.documentElement.scrollWidth<=window.innerWidth+3,
      offlineCsp:!!d.querySelector('meta[http-equiv="Content-Security-Policy"]')&&
        d.querySelector('meta[http-equiv="Content-Security-Policy"]').content.includes("connect-src 'none'"),
      sourceIsReviewOnly:status.dataset.blocked==='true',
      readyMarker:d.documentElement.dataset.localFileReviewReady==='true'
    };
    return {ready:Object.values(checks).every(Boolean),checks};
  }.toString()+')()';
}
module.exports={fileReviewBrowserProbe};
