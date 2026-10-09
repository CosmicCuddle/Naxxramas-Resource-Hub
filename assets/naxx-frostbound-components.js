/* Naxxramas — Frostbound Citadel component adapter, v1.
 * The original app is too large to rewrite safely. Mark real, visible cards,
 * buttons, dungeon guide contents and filter panels after each client route.
 * Never replace handlers, IDs, links, texts, data, or AzerothCore rules.
 */
(function(){
  "use strict";
  if(!document.documentElement.classList.contains("naxx-frostbound-ui"))return;
  var scheduled=false,observed=null,observer=null,tick=null;
  function txt(e){return String(e&&e.textContent||"").replace(/\s+/g," ").trim();}
  function rect(e){return e&&typeof e.getBoundingClientRect==="function"?e.getBoundingClientRect():null;}
  function visible(e){var r=rect(e);return !!r&&r.width>5&&r.height>4;}
  function contentRoot(){
    var header=document.getElementById("contextArtworkPanel");
    if(header){
      var parent=header.closest("main,[role='main']");
      if(parent)return parent;
    }
    var roots=document.querySelectorAll("main,[role='main']");
    var mainCandidate=null;
    for(var i=0;i<roots.length;i++){
      if(!visible(roots[i]))continue;
      if(header&&roots[i].contains(header))return roots[i];
      if(!mainCandidate||rect(roots[i]).width>rect(mainCandidate).width)mainCandidate=roots[i];
    }
    if(mainCandidate)return mainCandidate;
    // Some resource pages have a generic div in place of a semantic main.
    // Require BOTH of the app's known markers rather than selecting the body.
    var heading=document.getElementById("editablePageHeadingBlock");
    if(header&&heading){
      var p=header.parentElement;
      for(var level=0;p&&level<5;level++,p=p.parentElement){
        if(p.contains(heading)&&p.querySelectorAll("button,a,[role='button']").length>=3)
          return p;
      }
    }
    return null;
  }
  function skip(el){
    // Guide Contents often lives in an <aside> or <nav>. Do NOT exclude it.
    // This script already scopes itself to the main content area, not sidebar.
    return !!el.closest("#naxx-countdowns,#contextArtworkPanel,.naxx-frostbound-talent-link,.sidebar,#sidebar,[class*='side-nav']");
  }
  function boundedContainer(node,root,options){
    var rootSize=rect(root),maxWidth=(rootSize?rootSize.width:1400)*(options.full?1.04:.68);
    var candidate=null;
    for(var a=node.parentElement,i=0;a&&a!==root&&i<9;a=a.parentElement,i++){
      if(!["DIV","SECTION","ARTICLE","LI"].includes(a.tagName))continue;
      var r=rect(a);
      if(!r||r.width<180||r.width>maxWidth||r.height<options.minHeight||r.height>options.maxHeight)continue;
      var links=a.querySelectorAll("a,button,[role='button']").length;
      if(links<(options.minLinks||1))continue;
      candidate=a;
      if((a.tagName==="ARTICLE"||a.tagName==="SECTION")&&r.height<options.maxHeight*.8)break;
      if(options.first)break;
    }
    return candidate;
  }
  function markControls(root){
    var controls=root.querySelectorAll("button,a,[role='button'],[role='link']");
    for(var i=0;i<controls.length&&i<3500;i++){
      var e=controls[i];if(!visible(e)||skip(e))continue;
      var label=txt(e);
      if(label.length>130)continue;
      if(/(?:View Guide|Back to Dungeon Handbook|Back to Guide Contents)/i.test(label) ||
          /^(?:Generic Handbook|(?:Warrior|Paladin|Hunter|Rogue|Priest|Shaman|Mage|Warlock|Druid|Deathknight|Death Knight)\s+Handbook)$/i.test(label)){
        e.classList.add("naxx-fb-action");
      }
      if(/\bView Guide\b/i.test(label)){
        var dc=boundedContainer(e,root,{minHeight:95,maxHeight:600,minLinks:1,first:false});
        if(dc)dc.classList.add("naxx-fb-dungeon-card");
      }
      if(/Handbook/i.test(label)&&label.length<80){
        var hc=boundedContainer(e,root,{minHeight:90,maxHeight:730,minLinks:3,first:false});
        if(hc)hc.classList.add("naxx-fb-handbook-card");
      }
      if(/(?:Show Available Dungeons|Show All Dungeons|Reset)/i.test(label))
        e.classList.add("naxx-fb-filter-action");
    }
  }
  function markGuide(root){
    var heads=root.querySelectorAll("h1,h2,h3,h4,h5,[role='heading'],strong,b,[class*='toc-title'],[class*='contents-title']");
    for(var i=0;i<heads.length&&i<900;i++){
      var h=heads[i];if(!visible(h)||skip(h))continue;
      var name=txt(h).toLowerCase();if(name.length>100)continue;
      if(name==="guide contents"||name==="contents"){
        var toc=h.closest("aside,nav,[class*='toc' i],[class*='contents' i]");
        if(!toc||toc===root)toc=boundedContainer(h,root,{minHeight:130,maxHeight:3000,minLinks:0,first:false});
        if(toc&&toc!==root){toc.classList.add("naxx-fb-guide-toc");toc.setAttribute("data-naxx-fb-toc","1");}
      } else if(/^(?:quick overview|custom server entry requirement|recommended levels|before entering|dungeon guide \d+)/i.test(name)){
        var section=h.closest("article,section,[class*='guide-panel' i],[class*='guide-section' i]");
        if(!section||section===root)section=boundedContainer(h,root,{minHeight:90,maxHeight:2800,minLinks:0,full:true,first:false});
        if(section&&section!==root)section.classList.add("naxx-fb-guide-panel");
      }
    }
    var selector=root.querySelectorAll("select,[role='combobox'],input[type='number']");
    for(var j=0;j<selector.length&&j<80;j++){
      if(visible(selector[j])&&!skip(selector[j])){
        var f=boundedContainer(selector[j],root,{minHeight:75,maxHeight:550,minLinks:1,full:true,first:false});
        if(f)f.classList.add("naxx-fb-filter-panel");
      }
    }
  }
  function work(){
    scheduled=false;
    var root=contentRoot();
    if(!root)return;
    root.classList.add("naxx-fb-main");
    markControls(root);
    markGuide(root);
    // Only childList changes trigger a refresh, never our added classes.
    if(root!==observed&&window.MutationObserver){
      if(observer)observer.disconnect();
      observed=root;
      observer=new MutationObserver(function(mutations){
        for(var i=0;i<mutations.length;i++){
          var change=mutations[i],place=change.target;
          // Countdown clock updates every second and must not force a full
          // handbook-grid scan or interfere with the clock itself.
          if(place&&place.nodeType===1&&place.closest("#naxx-countdowns"))continue;
          if(change.addedNodes.length||change.removedNodes.length){schedule();return;}
        }
      });
      observer.observe(root,{subtree:true,childList:true});
    }
  }
  function schedule(){if(scheduled)return;scheduled=true;window.setTimeout(work,220);}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",schedule,{once:true});
  else schedule();
  ["hashchange","popstate","pageshow"].forEach(function(evt){window.addEventListener(evt,schedule);});
  document.addEventListener("click",function(){window.setTimeout(schedule,180);},true);
  // Reconnect if React replaces the main element or the route mutates outside it.
  tick=window.setInterval(function(){if(!observed||!observed.isConnected)schedule();},8500);
})();