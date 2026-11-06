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
    // Avoid arbitrary buttons, hidden editor controls, submit buttons and
    // menu links. This is not a general automatic administrator login.
    const safeEntry=/^(?:admin(?:istrator)?(?: (?:access|mode|login|panel|sign in))?|log ?in|sign in|editor login)$/i;
    const candidates=Array.from(d.querySelectorAll('button')).filter(el=>
      el!==editorControl&&!el.disabled&&visible(el)&&
      el.type!=='submit'&&!el.closest('form')&&safeEntry.test(label(el)));
    const trigger=candidates.length===1?candidates[0]:null;
    if(trigger)trigger.click();
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
