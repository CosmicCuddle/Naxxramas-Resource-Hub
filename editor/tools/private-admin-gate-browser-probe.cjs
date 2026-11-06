'use strict';
/*
 * NO-LOGIN ADMIN ACCESS DISCOVERY — isolated, disposable Chrome copy.
 * Original .wh-pro-admin may be an editing control hidden from visitors.
 * Never force-click it. Only click a visible, explicitly labelled entry
 * button outside forms. No credentials, submissions or website edits.
 * Only Boolean/count diagnostics leave the browser; no source values.
 */
function adminGateBrowserProbe(){
  return '('+async function(){
    const d=document,body=d.body,win=window;
    const editorControl=d.querySelector('button.wh-pro-admin');
    const password=d.getElementById('adminPasswordInput');
    function visible(el){
      if(!el||!el.isConnected||!el.getClientRects().length)return false;
      for(let node=el;node&&node.nodeType===1;node=node.parentElement){
        const style=win.getComputedStyle(node);
        if(style.display==='none'||style.visibility==='hidden'||
           style.visibility==='collapse'||Number(style.opacity)===0)
          return false;
      }
      return true;
    }
    function label(el){
      return String(el.getAttribute('aria-label')||el.getAttribute('title')||
        el.textContent||'').trim().replace(/\s+/g,' ').slice(0,80);
    }
    const beforeVisible=visible(password);
    const beforeAdmin=body.classList.contains('visual-admin-active');
    const beforeUrl=win.location.pathname+win.location.search;
    const beforePassword=password?password.value:null;
    // Never force-click the original hidden editing control.
    // Only a unique, visible, non-submitting, non-destructive entry
    // button is allowed in this disposable offline browser proof.
    const safeEntry=/^(?:admin(?:istrator)?(?: (?:access|mode|login|panel|sign in))?|log ?in|sign in|editor login)$/i;
    const adminTerm=/\badmin(?:istrator)?\b/i;
    const dangerous=/\b(?:delete|remove|reset|clear|save|publish|upload|merge|deploy|export|logout|log out|disable|shutdown)\b/i;
    const buttons=Array.from(d.querySelectorAll('button')).filter(el=>
      el!==editorControl&&!el.disabled&&visible(el)&&
      // An untyped HTML button defaults to .type='submit', even outside
      // any form. Reject explicit submit buttons and *all* form members.
      el.getAttribute('type')!=='submit'&&!el.closest('form'));
    const exact=buttons.filter(el=>safeEntry.test(label(el)));
    const expanded=buttons.filter(el=>{
      const text=label(el);
      return text.length>0&&text.length<=48&&adminTerm.test(text)&&
        !dangerous.test(text)&&el.hasAttribute('onclick');
    });
    const candidates=exact.length===1?exact:exact.length===0?expanded:[];
    const trigger=candidates.length===1?candidates[0]:null;
    if(trigger&&!beforeVisible&&!beforeAdmin)trigger.click();
    await new Promise(resolve=>setTimeout(resolve,120));
    const opened=!!trigger&&!beforeVisible&&visible(password);
    const checks={
      originalEditorButtonPreserved:!!editorControl&&editorControl.tagName==='BUTTON',
      originalPasswordFieldPreserved:!!password&&password.type==='password',
      visitorPrivilegeRemainsOff:!beforeAdmin&&
        !body.classList.contains('visual-admin-active'),
      noPasswordEntered:!!password&&beforePassword===''&&password.value==='',
      noUnexpectedNavigation:(win.location.pathname+win.location.search)===beforeUrl,
      originalSearchAndResourcesPresent:!!d.getElementById('searchInput')&&
        !!d.getElementById('resourceGrid'),
      originalPageShellPresent:!!d.getElementById('sectionHeading')
    };
    // A structurally safe result is NOT a successful authenticated/admin
    // feature test. If gateOpened=false it remains an explicit blocker.
    return {ready:Object.values(checks).every(Boolean),checks,
      editorControlVisibleToVisitor:visible(editorControl),
      unambiguousEntryFound:!!trigger,gateOpened:opened,
      actualAdminEditingVerified:false,loginAttempted:false};
  }.toString()+')()';
}
module.exports={adminGateBrowserProbe};
