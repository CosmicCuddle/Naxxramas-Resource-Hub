'use strict';
/*
 * ORIGINAL ADMIN BACK-TO-WEBSITE KEYBOARD EXIT — PRIVATE DIAGNOSTIC ONLY.
 * The probe returns Boolean flags only. No password is read except checking
 * emptiness; no source text, label, or credential leaves isolated Chrome.
 * The harness sends ONLY real Tab for now. A prior Enter test unexpectedly
 * navigated the isolated page, so activation is withheld pending diagnosis.
 */
const FORMAT='naxx-private-admin-return-keyboard-snapshot-v1';
const MAX_RETURN_TABS=16;
const RETURN_KEYS=Object.freeze({
  tab:Object.freeze({key:'Tab',code:'Tab',windowsVirtualKeyCode:9,
    nativeVirtualKeyCode:9,modifiers:0})
});
const FIELDS=Object.freeze([
  'safeReturnUnique','returnVisible','returnTabEligible','returnFocused',
  'returnInsideLink','returnAncestorInlineHandler','returnOwnKeyboardHandler',
  'passwordPresent','passwordEmpty','passwordVisible','adminAreaVisible',
  'publicSiteVisible','footerVisible','protectedEditorHidden',
  'visitorPrivilegeOff','routeUnchanged'
]);
function adminReturnSnapshot(){
  return '('+function(){
    const d=document,w=window,body=d.body;
    const area=d.getElementById('adminArea'),lock=d.getElementById('adminLock');
    const site=d.getElementById('publicSite'),footer=d.getElementById('siteFooter');
    const password=d.getElementById('adminPasswordInput');
    const editor=d.querySelector('button.wh-pro-admin');
    function visible(el){
      if(!el||!el.isConnected||el.hidden||!el.getClientRects().length)return false;
      for(let p=el;p&&p.nodeType===1;p=p.parentElement){
        const c=w.getComputedStyle(p);
        if(p.hidden||c.display==='none'||c.visibility==='hidden'||
           c.visibility==='collapse'||Number(c.opacity)===0)return false;
      }
      return true;
    }
    const matches=lock?Array.from(lock.querySelectorAll('button')).filter(el=>
      el!==editor&&!el.disabled&&
      el.getAttribute('onclick')?.trim()==='closeAdmin()'&&
      el.textContent.trim()==='Back to Website'&&
      el.getAttribute('type')!=='submit'&&!el.closest('form')&&
      !el.form&&!el.hasAttribute('form')):[];
    const btn=matches.length===1?matches[0]:null;
    // Read-only structure: a parent link or inline handler can potentially
    // affect Enter. Presence is diagnostic, not proof of navigation cause.
    let ancestorInline=false;
    for(let p=btn&&btn.parentElement;p;p=p.parentElement){
      if(['onclick','onkeydown','onkeyup','onkeypress'].some(k=>p.hasAttribute(k))){
        ancestorInline=true;break;
      }
    }
    return {
      format:'naxx-private-admin-return-keyboard-snapshot-v1',
      safeReturnUnique:!!btn,
      returnVisible:visible(btn),
      returnTabEligible:!!btn&&btn.tabIndex>=0,
      returnFocused:!!btn&&d.activeElement===btn,
      returnInsideLink:!!btn&&!!btn.closest('a[href],[role="link"]'),
      returnAncestorInlineHandler:ancestorInline,
      returnOwnKeyboardHandler:!!btn&&
        ['onkeydown','onkeyup','onkeypress'].some(k=>btn.hasAttribute(k)),
      passwordPresent:!!password&&password.type==='password',
      passwordEmpty:!!password&&password.value==='',
      passwordVisible:visible(password),
      adminAreaVisible:visible(area),
      publicSiteVisible:visible(site),
      footerVisible:visible(footer),
      protectedEditorHidden:!!editor&&!visible(editor),
      visitorPrivilegeOff:!!body&&!body.classList.contains('visual-admin-active'),
      routeUnchanged:w.location.pathname==='/'&&w.location.search===''
    };
  }.toString()+')()';
}
function checkReturnSnapshot(value,{closed=false}={}){
  if(!value||typeof value!=='object'||Array.isArray(value)||
     value.format!==FORMAT||Object.keys(value).length!==FIELDS.length+1||
     FIELDS.some(k=>typeof value[k]!=='boolean'))
    throw Error('Original Admin return snapshot violates isolation safeguards: shape.');
  const required=['passwordPresent','passwordEmpty','protectedEditorHidden',
    'visitorPrivilegeOff','routeUnchanged'];
  const failed=required.filter(k=>value[k]!==true);
  if(failed.length)
    throw Error('Original Admin return snapshot violates isolation safeguards: '+
      failed.join(','));
  if(closed){
    if(value.adminAreaVisible||value.passwordVisible||
       !value.publicSiteVisible||!value.footerVisible)
      throw Error('Original Admin return did not restore the visitor view.');
  }else if(!value.safeReturnUnique||!value.returnVisible||
      !value.returnTabEligible||!value.passwordVisible||
      !value.adminAreaVisible||value.publicSiteVisible)
    throw Error('Original Admin return control is not a safe open-panel target.');
  return Object.freeze({...value});
}
function summarizeAdminReturn(width,start,focused,after,tabs,{activated=false}={}){
  if(![390,1440].includes(width)||!Number.isSafeInteger(tabs)||
     tabs<0||tabs>MAX_RETURN_TABS)
    throw Error('Invalid private Admin return keyboard trail.');
  const a=checkReturnSnapshot(start);
  const b=checkReturnSnapshot(focused);
  if(a.returnFocused)
    throw Error('Return entry must be reached by real Tab, not pre-focused.');
  if(b.returnFocused&&tabs<1)
    throw Error('Original return control was not Tab reached.');
  if(typeof activated!=='boolean'||(activated&&!b.returnFocused))
    throw Error('Return activation requires verified keyboard focus.');
  const final=checkReturnSnapshot(after,{closed:activated&&b.returnFocused});
  if(!b.returnFocused&&(
    final.adminAreaVisible!==b.adminAreaVisible||
    final.passwordVisible!==b.passwordVisible))
    throw Error('Return must not activate without verified Tab focus.');
  return Object.freeze({
    format:'naxx-private-admin-return-keyboard-trail-v1',
    width,
    boundedTabsDispatched:tabs,
    originalSafeReturnFound:a.safeReturnUnique,
    actualTabReachedReturn:b.returnFocused,
    originalReturnInsideLink:a.returnInsideLink,
    originalReturnAncestorInlineHandler:a.returnAncestorInlineHandler,
    originalReturnOwnKeyboardHandler:a.returnOwnKeyboardHandler,
    navigationCauseVerified:false,
    enterOnlyOnVettedReturn:activated&&b.returnFocused,
    returnRestoredPublicSite:activated&&b.returnFocused&&final.publicSiteVisible,
    returnHidAdminArea:activated&&b.returnFocused&&!final.adminAreaVisible,
    activationWithheldForSafety:!activated,
    noPasswordEntered:a.passwordEmpty&&b.passwordEmpty&&final.passwordEmpty,
    visitorPrivilegeNeverEnabled:a.visitorPrivilegeOff&&b.visitorPrivilegeOff&&final.visitorPrivilegeOff,
    noLoginOrFormSubmission:true,
    realOriginalAdminEditingVerified:false,
    ownerApprovedForProduction:false
  });
}
module.exports={FORMAT,MAX_RETURN_TABS,RETURN_KEYS,adminReturnSnapshot,
  checkReturnSnapshot,summarizeAdminReturn};
