'use strict';
/*
 * ORIGINAL ADMIN KEYBOARD BEHAVIOUR — OBSERVATION ONLY.
 *
 * A read-only snapshot from an OUTBOUND-BLOCKED DISPOSABLE Chrome copy.
 * The already vetted visitor Admin entry must be open before the harness
 * sends Tab, Shift+Tab and Escape via Chrome's trusted DevTools key events.
 * NEVER type text, press Enter, submit forms, authenticate, or click the
 * hidden original editor control. No label, value, page/source text, URL
 * query or password may leave the isolated browser.
 */
function adminKeyboardStateProbe(){
  return '('+function(){
    const d=document,w=window,body=d.body;
    const password=d.getElementById('adminPasswordInput');
    const editor=d.querySelector('button.wh-pro-admin');
    const active=d.activeElement;
    function visible(el){
      if(!el||!el.isConnected||!el.getClientRects().length||el.hidden)return false;
      for(let node=el;node&&node.nodeType===1;node=node.parentElement){
        const css=w.getComputedStyle(node);
        if(node.hidden||css.display==='none'||css.visibility==='hidden'||
           css.visibility==='collapse'||Number(css.opacity)===0)return false;
      }
      return true;
    }
    function label(el){
      return String(el.getAttribute('aria-label')||
        el.getAttribute('title')||el.textContent||'')
        .trim().replace(/\s+/g,' ').slice(0,80);
    }
    // This is the SAME restricted visitor-entry identification used by the
    // vetted no-login gate. Never return the label, element or selector.
    const allowed=/^(?:admin(?:istrator)?(?: (?:access|mode|login|panel|sign in))?|log ?in|sign in|editor login)$/i;
    const entries=Array.from(d.querySelectorAll('button')).filter(el=>
      el!==editor&&visible(el)&&!el.disabled&&
      el.getAttribute('type')!=='submit'&&!el.closest('form')&&
      !el.form&&!el.hasAttribute('form')&&allowed.test(label(el)));
    const unique=entries.length===1?entries[0]:null;
    const panel=password&&password.closest(
      'dialog,[role="dialog"],[aria-modal="true"]')||
      password&&password.parentElement;
    return {
      format:'naxx-private-admin-keyboard-snapshot-v1',
      passwordPresent:!!password&&password.type==='password',
      passwordEmpty:!!password&&password.value==='',
      passwordVisible:visible(password),
      passwordFocused:!!password&&active===password,
      focusedElementVisible:visible(active),
      focusOnVisitorEntry:!!unique&&active===unique,
      focusOnBody:!!active&&(active===body||active===d.documentElement),
      focusWithinPasswordPanel:!!panel&&!!active&&
        (panel===active||panel.contains(active)),
      focusOnProtectedEditor:!!editor&&active===editor,
      protectedEditorHidden:!!editor&&!visible(editor),
      visitorPrivilegeOff:!!body&&!body.classList.contains('visual-admin-active'),
      pageRouteUnchanged:w.location.pathname==='/'&&w.location.search==='',
      // The harness never sends Enter or text. It independently checks the
      // loopback-only server's form-submission and external-response metrics.
      noInputTextDispatched:true,
      noSubmissionDispatched:true,
      noAuthenticationAttempted:true,
      originalAdminEditingVerified:false
    };
  }.toString()+')()';
}
const FORMAT='naxx-private-admin-keyboard-snapshot-v1';
const KEYS=Object.freeze([
  Object.freeze({name:'Tab',key:'Tab',code:'Tab',windowsVirtualKeyCode:9,
    nativeVirtualKeyCode:9,modifiers:0}),
  Object.freeze({name:'Shift+Tab',key:'Tab',code:'Tab',windowsVirtualKeyCode:9,
    nativeVirtualKeyCode:9,modifiers:8}),
  Object.freeze({name:'Escape',key:'Escape',code:'Escape',
    windowsVirtualKeyCode:27,nativeVirtualKeyCode:27,modifiers:0})
]);
const BOOLS=Object.freeze([
  'passwordPresent','passwordEmpty','passwordVisible','passwordFocused',
  'focusedElementVisible','focusOnVisitorEntry','focusOnBody',
  'focusWithinPasswordPanel','focusOnProtectedEditor',
  'protectedEditorHidden','visitorPrivilegeOff','pageRouteUnchanged',
  'noInputTextDispatched','noSubmissionDispatched',
  'noAuthenticationAttempted','originalAdminEditingVerified'
]);
function validateKeyboardSnapshot(value,{initial=false}={}){
  if(!value||typeof value!=='object'||Array.isArray(value)||
     value.format!==FORMAT||
     Object.keys(value).length!==BOOLS.length+1||
     BOOLS.some(name=>typeof value[name]!=='boolean')||
     value.passwordPresent!==true||
     value.passwordEmpty!==true||
     value.protectedEditorHidden!==true||
     value.visitorPrivilegeOff!==true||
     value.pageRouteUnchanged!==true||
     value.focusOnProtectedEditor!==false||
     value.noInputTextDispatched!==true||
     value.noSubmissionDispatched!==true||
     value.noAuthenticationAttempted!==true||
     value.originalAdminEditingVerified!==false||
     (initial&&(value.passwordFocused!==true||
       value.passwordVisible!==true||
       value.focusedElementVisible!==true)))
    throw Error('Private Admin keyboard observation violated a no-login safeguard.');
  return Object.freeze({...value});
}
function summarizeKeyboardTrail(width,before,afterTab,afterShiftTab,afterEscape){
  if(width!==1440&&width!==390)
    throw Error('Unknown private keyboard test viewport.');
  const first=validateKeyboardSnapshot(before,{initial:true});
  const tab=validateKeyboardSnapshot(afterTab);
  const shift=validateKeyboardSnapshot(afterShiftTab);
  const escape=validateKeyboardSnapshot(afterEscape);
  return Object.freeze({
    format:'naxx-private-admin-keyboard-trail-v1',
    width,
    startedOnEmptyVisiblePassword:first.passwordFocused,
    tabMovedFocusFromPassword:!tab.passwordFocused,
    tabFocusedVisibleElement:tab.focusedElementVisible,
    shiftTabReturnedToPassword:shift.passwordFocused,
    escapeClosedPasswordPanel:!escape.passwordVisible,
    escapeReturnedFocusToVisitorEntry:escape.focusOnVisitorEntry,
    escapeLeftFocusOnVisibleElement:escape.focusedElementVisible,
    escapeLeftPanelOpen:escape.passwordVisible,
    originalEditorStillHidden:escape.protectedEditorHidden,
    noPasswordEverEntered:
      [first,tab,shift,escape].every(x=>x.passwordEmpty),
    visitorPrivilegeNeverEnabled:
      [first,tab,shift,escape].every(x=>x.visitorPrivilegeOff),
    onlyNonSubmittingKeyboardKeysDispatched:true,
    noLoginAttempted:true,
    noFormSubmitted:true,
    noWebsiteFileWritten:true,
    noExternalRequestAllowed:true,
    keyboardBehaviourRecordedNotAutomaticallyApproved:true,
    completeKeyboardAcceptanceVerified:false,
    authenticatedAdminEditingVerified:false,
    ownerApprovalForProductionChanges:false
  });
}
module.exports=Object.freeze({
  FORMAT,KEYS,adminKeyboardStateProbe,
  validateKeyboardSnapshot,summarizeKeyboardTrail
});
