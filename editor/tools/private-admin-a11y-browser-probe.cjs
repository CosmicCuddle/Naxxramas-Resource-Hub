'use strict';
/*
 * PASSIVE ADMIN ENTRY ACCESSIBILITY INVENTORY — NO LOGIN OR KEY DISPATCH.
 *
 * Executed only after the previously vetted visitor Admin entry opens on an
 * isolated outbound-blocked, disposable website copy. Does not click, focus,
 * type, submit, access credentials, mutate DOM, or read source content.
 * Reports only booleans and bounded counts. Diagnostics are NOT WCAG approval
 * and NOT proof of authenticated administrator feature parity.
 */
function adminAccessibilityBrowserProbe(){
  return '('+function(){
    const d=document,w=window,body=d.body;
    const password=d.getElementById('adminPasswordInput');
    const hiddenEditor=d.querySelector('button.wh-pro-admin');
    function visible(el){
      if(!el||!el.isConnected||!el.getClientRects().length||el.hidden)return false;
      for(let a=el;a&&a.nodeType===1;a=a.parentElement){
        if(a.hidden)return false;
        const css=w.getComputedStyle(a);
        if(css.display==='none'||css.visibility==='hidden'||
           css.visibility==='collapse'||Number(css.opacity)===0)return false;
      }
      return true;
    }
    function named(el){
      if(!el)return false;
      // Only the presence of a name leaves Chrome; never return the value.
      const id=el.getAttribute('aria-labelledby');
      const labelled=!!id&&id.trim().split(/\s+/).some(x=>!!d.getElementById(x));
      return !!(el.labels&&el.labels.length)||
        !!String(el.getAttribute('aria-label')||'').trim()||
        labelled||!!String(el.getAttribute('title')||'').trim();
    }
    function focusable(el){
      return visible(el)&&el.disabled!==true&&
        typeof el.tabIndex==='number'&&el.tabIndex>=0;
    }
    function fitted(el){
      if(!visible(el))return false;
      const r=el.getBoundingClientRect();
      return Number.isFinite(r.left)&&Number.isFinite(r.right)&&
        Number.isFinite(r.top)&&Number.isFinite(r.bottom)&&
        r.width>0&&r.height>0&&r.left>=-1&&
        r.right<=w.innerWidth+1&&r.top>=-1&&r.bottom<=w.innerHeight+1;
    }
    const ancestor=password&&password.closest(
      'dialog,[role="dialog"],[aria-modal="true"]');
    // If the original UI does not use ARIA/dialog semantics, use a bounded
    // parent for inventory diagnostics only; never assume it is modal.
    const panel=ancestor||password&&password.parentElement;
    const candidates=panel&&panel.querySelectorAll?
      Array.from(panel.querySelectorAll(
        'button,a[href],input,select,textarea,[tabindex]')).slice(0,300):[];
    const reachable=candidates.filter(focusable);
    const closeControls=reachable.filter(el=>
      el.tagName==='BUTTON'&&/\b(?:close|cancel|back|dismiss)\b/i.test(
        String(el.getAttribute('aria-label')||
          el.getAttribute('title')||el.textContent||'').slice(0,80)));
    const noPasswordValueRead=password?password.value==='':false;
    const diagnostics={
      passwordPresent:!!password&&password.type==='password',
      passwordPanelVisible:visible(password),
      passwordHasProgrammaticName:named(password),
      passwordCanReceiveTab:focusable(password),
      passwordCurrentlyFocused:!!password&&d.activeElement===password,
      currentFocusVisible:visible(d.activeElement),
      passwordFitsViewport:fitted(password),
      passwordAtLeast44CssPx:visible(password)&&
        password.getBoundingClientRect().width>=44&&
        password.getBoundingClientRect().height>=44,
      semanticDialogPresent:!!ancestor,
      ariaModalDeclared:!!password&&!!password.closest('[aria-modal="true"]'),
      closeControlFocusable:closeControls.length>0,
      noHorizontalPageOverflow:!!d.documentElement&&
        d.documentElement.scrollWidth<=w.innerWidth+1,
      passwordFieldEmpty:noPasswordValueRead,
      protectedEditorHidden:!!hiddenEditor&&!visible(hiddenEditor),
      unauthenticatedVisitor:!!body&&
        !body.classList.contains('visual-admin-active')
    };
    return {
      format:'naxx-private-admin-a11y-diagnostics-v1',
      viewportClass:w.innerWidth<500?'mobile':'desktop',
      diagnostics,
      visibleTabStopsNearPassword:Math.min(reachable.length,300),
      visibleCloseControls:Math.min(closeControls.length,300),
      structuralSafety:diagnostics.passwordPresent&&
        diagnostics.passwordPanelVisible&&diagnostics.passwordFieldEmpty&&
        diagnostics.protectedEditorHidden&&
        diagnostics.unauthenticatedVisitor,
      keyboardNavigationActuallyDispatched:false,
      escapeDismissalActuallyTested:false,
      completeWCAGConformanceVerified:false,
      ownerAdminAcceptanceVerified:false,
      loginAttempted:false,credentialsCollected:false,
      formSubmitted:false,domModified:false,
      externalRequestsMade:false,publicationApproved:false
    };
  }.toString()+')()';
}
module.exports=Object.freeze({adminAccessibilityBrowserProbe});
