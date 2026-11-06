'use strict';
/*
 * NO-LOGIN ADMIN ENTRY PROBE — runs in an isolated local Chrome page.
 * Checks that the original admin entry can reveal its password control,
 * without typing passwords, submitting forms, elevating privileges, or
 * attempting to save/export/alter any website data.
 * Only Boolean outcomes leave the browser; do not expose private HTML.
 */
function adminGateBrowserProbe(){
  return '('+async function(){
    const d=document,body=d.body,win=window;
    const button=d.querySelector('button.wh-pro-admin');
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
    const beforePasswordVisible=visible(password);
    const beforeAdminState=body.classList.contains('visual-admin-active');
    const beforeLocation=win.location.pathname+win.location.search;
    const beforePasswordValue=password?password.value:null;
    const clickable=!!button&&!button.disabled&&visible(button);
    if(clickable)button.click();
    await new Promise(resolve=>setTimeout(resolve,120));
    const afterPasswordVisible=visible(password);
    const checks={
      originalButtonIsVisible:clickable,
      originalPasswordFieldExists:!!password&&password.type==='password',
      entryOpensPasswordGate:!!password&&afterPasswordVisible&&
        (!beforePasswordVisible||d.activeElement===password),
      noPasswordWasEntered:!!password&&beforePasswordValue===''&&password.value==='',
      noAdminPrivilegeWasGranted:body.classList.contains('visual-admin-active')===
        beforeAdminState&&!beforeAdminState,
      noNavigationOccurred:(win.location.pathname+win.location.search)===beforeLocation,
      originalSearchAndResourcesRemainPresent:!!d.getElementById('searchInput')&&
        !!d.getElementById('resourceGrid'),
      stillOnOriginalWebsite:!!d.getElementById('sectionHeading')
    };
    return {ready:Object.values(checks).every(Boolean),checks};
  }.toString()+')()';
}
module.exports={adminGateBrowserProbe};
