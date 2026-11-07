'use strict';
/*
 * Private, real-Chrome probe of a FICTIONAL repeated-resource-edit preview.
 * Runs only in the disposable, loopback-only full-site browser rehearsal.
 * Does NOT access actual resources, GitHub, Admin login or source file pickers.
 * A text-only expression is evaluated in Chrome's current local page.
 */
function revisionDemoBrowserProbe(){
  return '('+async function(){
    const d=document,$=id=>d.getElementById(id);
    const core=window.NaxxRevisionDemo;
    const one=$('revision-one'),two=$('revision-two');
    const select=$('resource-index'),title=$('edit-title'),content=$('edit-content');
    const prepare=$('prepare-draft'),check=$('check-draft'),clear=$('clear-draft');
    const status=$('demo-status'),summary=$('held-summary'),label=$('revision-label');
    const controls=[one,two,select,title,content,prepare,check,clear,status,summary,label];
    if(!controls.every(Boolean)||!core)return {ready:false,checks:{controls:false}};
    const originalConfirm=window.confirm;
    let asks=0,allow=false;
    // Only this local fictional page is allowed to have synthetic confirms.
    window.confirm=()=>{asks++;return allow};
    const update=(el,value)=>{el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}))};
    async function prepared(){
      for(let i=0;i<220;i++){
        if(!prepare.disabled&&status.textContent.includes('Ready:'))
          return true;
        await new Promise(r=>setTimeout(r,100));
      }
      return false;
    }
    async function waitReview(){
      for(let i=0;i<220;i++){
        if(!prepare.disabled)return true;
        await new Promise(r=>setTimeout(r,100));
      }
      return false;
    }
    try{
      if(!await prepared())return {ready:false,checks:{initialization:false}};
      const initialTitle=title.value,initialBody=content.value;
      const original14=select.options.length===2&&
        select.options[0].value==='0'&&select.options[1].value==='413';
      const initControls=!one.disabled&&!two.disabled&&!select.disabled&&
        !title.disabled&&!content.disabled&&!prepare.disabled&&
        check.disabled&&clear.disabled;
      const focused=(()=>{title.focus();return d.activeElement===title})();
      update(title,'Browser-fiction-only reviewed title');
      prepare.click();
      const finished=await waitReview();
      const draftHeld=finished&&!check.disabled&&!clear.disabled&&
        summary.textContent.includes('Version 1')&&
        status.textContent.includes('reviewed locally');
      two.click();
      const noUnexpectedConsent=asks===0&&label.textContent.includes('Version 2');
      check.click();
      const staleRefused=status.dataset.kind==='stale'&&
        status.textContent.includes('Older draft refused')&&
        summary.textContent.includes('Version 1');
      // Already-reviewed material may move freely. Fresh text requires consent.
      one.click();
      update(title,'Later unreviewed typing');
      two.click();
      const protectedUnreviewed=asks===1&&
        label.textContent.includes('Version 1')&&
        title.value==='Later unreviewed typing'&&
        summary.textContent.includes('Version 1');
      allow=true;two.click();
      const explicitConsent=asks===2&&label.textContent.includes('Version 2');
      clear.click();
      const cleared=check.disabled&&clear.disabled&&
        summary.textContent.includes('No fictional draft');
      select.value='413';select.dispatchEvent(new Event('change',{bubbles:true}));
      const last=select.value==='413'&&content.value.includes('independently newer fictional revision');
      const fixedSource=core.COUNT===414&&initialTitle.startsWith('Example Resource 1')&&
        initialBody.startsWith('Fictional resource description 1');
      const checks={
        controlsPresent:controls.every(Boolean),
        fictionalInitialization:fixedSource,
        firstLastResourceChoices:original14,
        controlsEnabledAfterVerification:initControls,
        keyboardFocus:focused,
        localReviewHeld:draftHeld,
        reviewedDraftSwitchRequiresNoDiscardPrompt:noUnexpectedConsent,
        staleDraftRefusedWithoutDeleting:staleRefused,
        newlyTypedTextNotDiscardedWithoutConsent:protectedUnreviewed,
        explicitDiscardConsentWorks:explicitConsent,
        clearingHeldDraftDisablesChecks:cleared,
        secondRevisionHasFictionalLastResourceChange:last,
        explicitlyUntrusted:!!d.querySelector('.warning')&&
          d.querySelector('.warning').textContent.includes('NOT A REAL SAVE')&&
          label.textContent.includes('NOT independently authenticated'),
        noUploadPublishOrAdminControls:
          !d.querySelector('input[type=file],form,iframe')&&
          !Array.from(d.querySelectorAll('button')).some(b=>
            /^(Save|Upload|Publish|Deploy|Merge|Commit)/i.test(b.textContent)),
        restrictedCsp:!!d.querySelector('meta[http-equiv="Content-Security-Policy"]')&&
          d.querySelector('meta[http-equiv="Content-Security-Policy"]').content.includes("connect-src 'none'"),
        ariaStatus:status.getAttribute('aria-live')==='polite',
        noHorizontalOverflow:d.documentElement.scrollWidth<=window.innerWidth+3
      };
      return {ready:Object.values(checks).every(Boolean),checks};
    }finally{
      window.confirm=originalConfirm;
    }
  }.toString()+')()';
}
module.exports={revisionDemoBrowserProbe};
