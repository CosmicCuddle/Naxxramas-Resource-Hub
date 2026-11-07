'use strict';
/*
 * Fictional restore-conflict UX browser QA. No original resource values,
 * file dialogs, forms, network requests or edit actions.
 */
function restoreBrowserProbe(){
  const expression='('+function(){
    const d=document,buttons=['current','stale','conflict','invalid'],
      result=d.getElementById('result'),outputs={};
    for(const name of buttons){
      const button=d.getElementById('case-'+name);
      if(!button)return {ready:false,checks:{exampleButtonPresent:false}};
      button.click();
      outputs[name]={
        code:result.dataset.decision,blocked:result.dataset.blocked,
        pressed:button.getAttribute('aria-pressed')
      };
    }
    const policy=d.querySelector('meta[http-equiv="Content-Security-Policy"]');
    const notice=d.querySelector('p.notice');
    const checks={
      onlySyntheticExamples:!!notice&&notice.textContent.includes('fictional'),
      noFormOrFileInput:d.querySelectorAll('form,input[type=file],iframe').length===0,
      noPublishOrSaveButton:Array.from(d.querySelectorAll('button')).every(
        x=>!/(Publish|Save|Apply|Merge|Upload)/i.test(x.textContent)),
      statusLiveRegion:result.getAttribute('aria-live')==='polite',
      noHorizontalOverflow:d.documentElement.scrollWidth<=window.innerWidth+3,
      buttonsKeyboardAccessible:Array.from(d.querySelectorAll('button')).every(
        x=>x.tagName==='BUTTON'&&x.type==='button'&&!x.disabled),
      cspForbidsConnections:!!policy&&policy.content.includes("connect-src 'none'"),
      matchingVersionReviewOnly:outputs.current.code==='review-only'&&
        outputs.current.blocked==='false',
      staleDraftRefused:outputs.stale.code==='stale'&&
        outputs.stale.blocked==='true',
      changedResourceRefused:outputs.conflict.code==='record-conflict'&&
        outputs.conflict.blocked==='true',
      invalidDraftRefused:outputs.invalid.code==='invalid-draft'&&
        outputs.invalid.blocked==='true',
      selectedButtonTracked:outputs.invalid.pressed==='true'
    };
    return {ready:Object.values(checks).every(Boolean),checks};
  }.toString()+')()';
  return expression;
}
module.exports={restoreBrowserProbe};
