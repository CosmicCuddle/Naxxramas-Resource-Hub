'use strict';
/*
 * PRIVATE ADMINISTRATOR ENTRY SURFACE INVENTORY — READ ONLY.
 * This is NOT login, authentication testing, an admin bypass, or a writer.
 * It returns only counters and booleans about DOM structure; no labels,
 * credentials, resource values, page text or DOM snapshots leave Chrome.
 * Run only against a disposable, outbound-blocked complete-site snapshot.
 */
function adminSurfaceBrowserProbe(){
  return '('+function(){
    const d=document,w=window;
    const password=d.getElementById('adminPasswordInput');
    const editorControl=d.querySelector('button.wh-pro-admin');
    const entryTerms=/\b(?:admin(?:istrator)?|log\s?in|sign\s?in|editor|manage|control panel)\b/i;
    function visible(el){
      if(!el||!el.isConnected||!el.getClientRects().length)return false;
      for(let n=el;n&&n.nodeType===1;n=n.parentElement){
        const css=w.getComputedStyle(n);
        if(css.display==='none'||css.visibility==='hidden'||
          css.visibility==='collapse'||Number(css.opacity)===0)
          return false;
        if(n.hidden)return false;
      }
      return true;
    }
    function name(el){
      // Do not expose the string returned here; classification only.
      return String(el.getAttribute('aria-label')||
        el.getAttribute('title')||el.textContent||'').trim().slice(0,150);
    }
    const candidates=[];
    const counters={visibleMatchingButtons:0,hiddenMatchingButtons:0,
      visibleMatchingLinks:0,hiddenMatchingLinks:0,
      visibleMatchingRoleButtons:0,hiddenMatchingRoleButtons:0,
      visibleMatchingSummaries:0,hiddenMatchingSummaries:0};
    for(const node of d.querySelectorAll('button,a,[role="button"],summary')){
      if(!entryTerms.test(name(node)))continue;
      const on=visible(node);
      if(node.tagName==='BUTTON'&&on)candidates.push(node);
      const group=node.tagName==='BUTTON'?'Buttons':
        node.tagName==='A'?'Links':
          node.tagName==='SUMMARY'?'Summaries':'RoleButtons';
      counters[(on?'visibleMatching':'hiddenMatching')+group]++;
    }
    const onlyButton=candidates.length===1?candidates[0]:null;
    const onlyName=onlyButton?name(onlyButton):'';
    // Never emit original labels, CSS selectors, IDs, event handlers or
    // website text. These structural booleans support manual classification.
    const visibleButtonProfile={
      uniqueCandidate:!!onlyButton,
      labelContainsAdmin:/\\badmin(?:istrator)?\\b/i.test(onlyName),
      labelContainsLogin:/\\blog\\s?in\\b/i.test(onlyName),
      labelContainsSignIn:/\\bsign\\s?in\\b/i.test(onlyName),
      labelContainsEditor:/\\beditor\\b/i.test(onlyName),
      labelContainsManage:/\\bmanage\\b/i.test(onlyName),
      shortLabel:!!onlyButton&&onlyName.length>0&&onlyName.length<=48,
      accessibleNameFromAria:!!onlyButton&&!!onlyButton.getAttribute('aria-label'),
      accessibleNameFromTitle:!!onlyButton&&!!onlyButton.getAttribute('title'),
      insideForm:!!onlyButton&&!!onlyButton.closest('form'),
      insideDialog:!!onlyButton&&!!onlyButton.closest('dialog,[role="dialog"]'),
      insideHeader:!!onlyButton&&!!onlyButton.closest('header'),
      insideNavigation:!!onlyButton&&!!onlyButton.closest('nav'),
      submitType:!!onlyButton&&onlyButton.getAttribute('type')==='submit',
      disabled:!!onlyButton&&onlyButton.disabled===true,
      hasExplicitClickAttribute:!!onlyButton&&onlyButton.hasAttribute('onclick'),
      adminLikeIdOrClass:!!onlyButton&&/admin/i.test(
        String(onlyButton.id||'')+' '+String(onlyButton.className||''))
    };
    const parent=password&&password.parentElement;
    const ancestors=[];
    for(let el=parent;el&&ancestors.length<12;el=el.parentElement)
      ancestors.push(el);
    const wrappers=ancestors.map(el=>String(el.className||'')+' '+
      String(el.id||'')+' '+String(el.getAttribute('role')||''));
    const source=document.querySelectorAll('script:not([src])');
    let passwordTokenScripts=0,editorTokenScripts=0;
    for(const script of source){
      const code=script.textContent||'';
      if(code.includes('adminPasswordInput'))passwordTokenScripts++;
      if(code.includes('wh-pro-admin'))editorTokenScripts++;
    }
    const result={
      format:'naxx-private-admin-surface-inventory-v1',
      pageReady:!!d.getElementById('resourceGrid')&&
        !!d.getElementById('sectionHeading'),
      passwordFieldPresent:!!password&&password.type==='password',
      passwordVisibleToVisitor:visible(password),
      passwordInsideForm:!!password&&!!password.closest('form'),
      passwordInsideDialog:!!password&&!!password.closest('dialog,[role="dialog"]'),
      passwordHasAdminNamedAncestor:wrappers.some(x=>/admin/i.test(x)),
      passwordHasModalNamedAncestor:wrappers.some(x=>/modal|dialog|overlay/i.test(x)),
      passwordDirectParentVisible:visible(parent),
      editorControlPresent:!!editorControl,
      editorControlVisibleToVisitor:visible(editorControl),
      visitorAdminVisualState:d.body.classList.contains('visual-admin-active'),
      candidateControls:counters,
      visibleButtonProfile,
      inlineScriptBlocks:source.length,
      inlineScriptsMentioningPassword:passwordTokenScripts,
      inlineScriptsMentioningEditorControl:editorTokenScripts,
      loginAttempted:false,formSubmitted:false,domModified:false,
      actualAdminEditingVerified:false,publicationApproved:false
    };
    return result;
  }.toString()+')()';
}
module.exports={adminSurfaceBrowserProbe};
