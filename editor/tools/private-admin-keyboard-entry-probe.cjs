'use strict';
/*
 * PRIVATE KEYBOARD-ONLY ENTRY DISCOVERY — NO PASSWORDS, NO SITE WRITES.
 *
 * Passive snapshots of the genuine public Admin button and password field
 * on a disposable, outbound-blocked site. The harness (not this probe)
 * sends Tab at most 80 times, and only sends Enter when focus is on the one
 * safe, visible, non-form Admin entry. No other activation is permitted.
 * Boolean-only results cannot reveal original labels, passwords or HTML.
 */
const FORMAT='naxx-private-admin-keyboard-entry-v1';
const KEYS=Object.freeze({
  tab:Object.freeze({key:'Tab',code:'Tab',windowsVirtualKeyCode:9,
    nativeVirtualKeyCode:9,modifiers:0}),
  // Match Chrome's standard keyboard.press('Enter') semantics: the
  // carriage-return CONTROL key is not user text or a password.
  enter:Object.freeze({key:'Enter',code:'Enter',windowsVirtualKeyCode:13,
    nativeVirtualKeyCode:13,modifiers:0,text:'\r',unmodifiedText:'\r'})
});
const MAX_TABS=80;
const FIELDS=Object.freeze([
  'unambiguousSafeEntry','entryVisible','entryEligibleForTab',
  'entryFocused','entryHasAriaExpanded','entryHasAriaControls',
  'passwordPresent','passwordVisible','passwordFocused','passwordEmpty',
  'protectedEditorHidden','visitorPrivilegeOff','routeUnchanged'
]);
function adminKeyboardEntrySnapshot(){
  return '('+function(){
    const d=document,w=window,body=d.body;
    const password=d.getElementById('adminPasswordInput');
    const editor=d.querySelector('button.wh-pro-admin');
    function visible(el){
      if(!el||!el.isConnected||!el.getClientRects().length||el.hidden)return false;
      for(let a=el;a&&a.nodeType===1;a=a.parentElement){
        const css=w.getComputedStyle(a);
        if(a.hidden||css.display==='none'||css.visibility==='hidden'||
           css.visibility==='collapse'||Number(css.opacity)===0)return false;
      }
      return true;
    }
    function label(el){
      return String(el.getAttribute('aria-label')||el.getAttribute('title')||
        el.textContent||'').trim().replace(/\s+/g,' ').slice(0,80);
    }
    const exact=/^(?:admin(?:istrator)?(?: (?:access|mode|login|panel|sign in))?|log ?in|sign in|editor login)$/i;
    const adminWord=/\badmin(?:istrator)?\b/i;
    const forbidden=/\b(?:delete|remove|reset|clear|save|publish|upload|merge|deploy|export|logout|log out|disable|shutdown)\b/i;
    const safe=Array.from(d.querySelectorAll('button')).filter(el=>
      el!==editor&&!el.disabled&&visible(el)&&
      el.getAttribute('type')!=='submit'&&!el.closest('form')&&
      !el.form&&!el.hasAttribute('form'));
    const direct=safe.filter(el=>exact.test(label(el)));
    const expand=safe.filter(el=>{
      const s=label(el);
      return s.length>0&&s.length<=48&&adminWord.test(s)&&
        !forbidden.test(s)&&el.hasAttribute('onclick');
    });
    const selected=direct.length===1?direct:
      direct.length===0&&expand.length===1?expand:[];
    const entry=selected.length===1?selected[0]:null;
    return {
      format:'naxx-private-admin-keyboard-entry-v1',
      unambiguousSafeEntry:!!entry,
      entryVisible:visible(entry),
      entryEligibleForTab:!!entry&&entry.tabIndex>=0,
      entryFocused:!!entry&&d.activeElement===entry,
      entryHasAriaExpanded:!!entry&&entry.hasAttribute('aria-expanded'),
      entryHasAriaControls:!!entry&&entry.hasAttribute('aria-controls'),
      passwordPresent:!!password&&password.type==='password',
      passwordVisible:visible(password),
      passwordFocused:!!password&&d.activeElement===password,
      passwordEmpty:!!password&&password.value==='',
      protectedEditorHidden:!!editor&&!visible(editor),
      visitorPrivilegeOff:!!body&&!body.classList.contains('visual-admin-active'),
      routeUnchanged:w.location.pathname==='/'&&w.location.search===''
    };
  }.toString()+')()';
}
function check(snapshot,{initial=false}={}){
  if(!snapshot||typeof snapshot!=='object'||Array.isArray(snapshot)||
     snapshot.format!==FORMAT||Object.keys(snapshot).length!==FIELDS.length+1||
     FIELDS.some(k=>typeof snapshot[k]!=='boolean')||
     !snapshot.passwordPresent||!snapshot.passwordEmpty||
     !snapshot.protectedEditorHidden||!snapshot.visitorPrivilegeOff||
     !snapshot.routeUnchanged||!snapshot.unambiguousSafeEntry||
     !snapshot.entryVisible||
     (initial&&snapshot.passwordVisible))
    throw Error('Keyboard-only Admin entry snapshot violated a visitor safety invariant.');
  return Object.freeze({...snapshot});
}
function summarize(width,pre,focused,after,tabs){
  if(![390,1440].includes(width)||!Number.isSafeInteger(tabs)||
     tabs<0||tabs>MAX_TABS)
    throw Error('Invalid keyboard entry viewport or Tab budget.');
  const p=check(pre,{initial:true}),f=check(focused),a=check(after);
  if(!f.entryFocused&&tabs!==MAX_TABS&&
     !(p.entryEligibleForTab===false&&tabs===0))
    throw Error('Enter must not be dispatched on any non-Admin control.');
  if(f.entryFocused&&(!f.entryEligibleForTab||tabs<1))
    throw Error('Only Tab-reached, safe Admin entry can receive Enter.');
  if(!f.entryFocused&&
     (a.passwordVisible!==f.passwordVisible||
      a.passwordFocused!==f.passwordFocused))
    throw Error('No Enter must be dispatched when the entry is not Tab reachable.');
  return Object.freeze({
    format:'naxx-private-admin-keyboard-entry-trail-v1',
    width,
    originalEntryUnambiguous:p.unambiguousSafeEntry,
    entryTabEligible:p.entryEligibleForTab,
    keyboardReachedEntry:f.entryFocused,
    boundedTabsDispatched:tabs,
    enterDispatchedOnlyAtSafeEntry:f.entryFocused,
    enterOpenedPasswordPanel:f.entryFocused&&a.passwordVisible,
    enterFocusedPassword:f.entryFocused&&a.passwordFocused,
    passwordStayedEmpty:p.passwordEmpty&&f.passwordEmpty&&a.passwordEmpty,
    protectedEditorAlwaysHidden:
      p.protectedEditorHidden&&f.protectedEditorHidden&&a.protectedEditorHidden,
    noVisitorPrivilegeGranted:
      p.visitorPrivilegeOff&&f.visitorPrivilegeOff&&a.visitorPrivilegeOff,
    originalRouteUnchanged:
      p.routeUnchanged&&f.routeUnchanged&&a.routeUnchanged,
    entryHasAriaExpanded:p.entryHasAriaExpanded,
    entryHasAriaControls:p.entryHasAriaControls,
    noFormSubmissionAllowed:true,
    noCredentialsEntered:true,
    noRemoteWrites:true,
    keyboardEntryObservedNotApproved:true,
    completeKeyboardAcceptanceVerified:false,
    authenticatedAdminEditingVerified:false,
    productionChangeApproved:false
  });
}
module.exports=Object.freeze({
  FORMAT,KEYS,MAX_TABS,adminKeyboardEntrySnapshot,check,summarize
});
