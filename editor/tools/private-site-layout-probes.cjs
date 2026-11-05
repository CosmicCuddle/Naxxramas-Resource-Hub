'use strict';
/*
 * INERT PRIVATE-SITE LAYOUT AND ADMIN-PRESERVATION PROBES.
 * Boolean-only browser expressions; no screenshots, credentials, forms,
 * outbound actions or permanent edits. The Game Clients admin-state test
 * toggles a CSS class only in memory and restores it with finally.
 */
const PAGES=new Set(['home','new-players','rules','apply','clients']);
function layoutProbe(page){
  if(!PAGES.has(page))throw Error('Unknown protected browser layout route.');
  const chosen=JSON.stringify(page);
  const expression='('+function(){
    const d=document,w=window,b=d.body,grid=d.getElementById('resourceGrid'),
      nav=d.getElementById('mainNav'),mobile=d.getElementById('mobileNav'),
      admin=d.querySelector('button.wh-pro-admin'),
      password=d.getElementById('adminPasswordInput'),
      heading=d.getElementById('sectionHeading'),width=w.innerWidth,
      screen=d.documentElement;
    const checks={
      originalAdminButtonPreserved:!!admin&&admin.tagName==='BUTTON',
      originalPasswordControlPreserved:!!password&&password.type==='password',
      originalMenusPreserved:!!nav&&!!mobile,
      rootLoaderHeadingPreserved:!!heading,
      viewportWidthValid:width>=380&&width<=1500,
      noHorizontalDocumentOverflow:screen.scrollWidth<=width+3,
      gridInsideViewport:!!grid&&grid.getBoundingClientRect().width>0&&
        grid.getBoundingClientRect().width<=width+3
    };
    if(width<500){
      checks.mobileNavUsesNativeButtons=!!mobile&&
        !!mobile.querySelector('button[data-naxx-guide-link="rules"]');
      checks.mobileMenuControlPreserved=Array.from(
        d.querySelectorAll('.mobile-top button')).some(x=>/Menu/i.test(x.textContent));
    }
    if(PAGE==='home'){
      checks.originalSearchPreserved=!!d.querySelector('#searchInput[type="search"]')&&
        !!d.getElementById('globalSearchResults');
    }
    if(PAGE==='new-players'||PAGE==='rules'||PAGE==='apply'){
      const article=d.querySelector('[data-naxx-guide-content="'+PAGE+'"]');
      checks.guideContentInDocument=!!article&&article.getBoundingClientRect().width>0;
      checks.originalNavigationLinksKeyboardReady=!!nav&&
        !!nav.querySelector('button[data-naxx-guide-link="rules"]:not([disabled])');
    }
    if(PAGE==='clients'){
      const guide=d.getElementById('naxx-game-client-guide');
      const legacy=grid&&grid.querySelector('.game-client-card.naxx-legacy-client-card');
      const originalState=b.classList.contains('visual-admin-active');
      try{
        b.classList.remove('visual-admin-active');
        checks.visitorGuideVisible=!!guide&&w.getComputedStyle(guide).display!=='none';
        checks.visitorDuplicateCardHidden=!!legacy&&
          w.getComputedStyle(legacy).display==='none';
        b.classList.add('visual-admin-active');
        checks.adminOriginalCardVisible=!!legacy&&
          w.getComputedStyle(legacy).display!=='none';
        checks.adminNewGuideHidden=!!guide&&
          w.getComputedStyle(guide).display==='none';
        checks.adminGridLayoutPreserved=!!grid&&
          w.getComputedStyle(grid).display==='grid';
      }finally{
        b.classList.toggle('visual-admin-active',originalState);
      }
      checks.visitorStateRestored=b.classList.contains('visual-admin-active')===originalState;
    }
    if(PAGE==='apply'){
      const article=d.querySelector('[data-naxx-guide-content="apply"]');
      checks.applicationExternalActionNotTaken=!!article&&
        !!article.querySelector('iframe[data-tally-src]');
    }
    return {checks,ready:Object.values(checks).every(Boolean)};
  }.toString()+')()';
  return expression.replaceAll('PAGE',chosen);
}
module.exports={layoutProbe,PAGES};
