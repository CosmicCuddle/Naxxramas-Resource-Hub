/* Frostbound Citadel: live-site navigation integration only.
 * No edits to the large Resource Hub content or its route logic. */
(function(){
  "use strict";
  var script=document.currentScript;
  if(!script||!script.src)return;
  var root=new URL("../",script.src);
  var homeURL=new URL("./",root).href;
  var talentsURL=new URL("talents/",root).href;
  var LINK_ID="naxx-frostbound-talents";
  function label(el) {
    return String(el.getAttribute("aria-label")||el.getAttribute("title")||el.textContent||"")
      .replace(/\s+/g," ").trim();
  }
  function visible(el) {
    return !!(el&&el.getClientRects&&el.getClientRects().length);
  }
  function tidy(value){
    return String(value||"").replace(/\s+/g," ").trim();
  }
  // The source site's sidebar already has all the correct icon, padding,
  // chevron, typography and hover styles. Reuse the actual Talent Sets row.
  function findTalentSets(){
    if(!document.body||!document.createTreeWalker)return null;
    var walker=document.createTreeWalker(document.body,4),node,seen=0;
    while((node=walker.nextNode())&&seen++<25000){
      if(tidy(node.nodeValue)!=="Talent Sets")continue;
      var el=node.parentElement;
      for(var depth=0;el&&depth<8;depth++,el=el.parentElement){
        if(el.matches("button,a,[role='button'],[role='link']")&&visible(el))return el;
      }
    }
    // Secondary lookup for navigation controls whose label includes arrow text.
    var controls=document.querySelectorAll("aside button,aside a,nav button,nav a,[class*='sidebar' i] button,[class*='sidebar' i] a");
    for(var i=0;i<controls.length&&i<1500;i++){
      if(tidy(controls[i].textContent).replace(/[›»>]+$/,"").trim()==="Talent Sets"&&visible(controls[i]))
        return controls[i];
    }
    return null;
  }
  function stripOldNavigationBehavior(root){
    var all=[root].concat(Array.prototype.slice.call(root.querySelectorAll("*")));
    all.forEach(function(node){
      if(!node.attributes)return;
      Array.from(node.attributes).forEach(function(attr){
        if(/^on/i.test(attr.name)||/^(id|href|aria-current|aria-selected|aria-controls|aria-expanded|data-page|data-route|data-view|data-section|data-tab|data-target|data-active|data-testid)$/i.test(attr.name))
          node.removeAttribute(attr.name);
      });
    });
  }
  function createNativeMenuEntry(example){
    var copy=example.cloneNode(true);
    stripOldNavigationBehavior(copy);
    copy.id=LINK_ID;
    copy.classList.add("naxx-frostbound-talent-link");
    copy.setAttribute("aria-label","Talent Calculator");
    copy.setAttribute("title","Open the Talent Calculator");
    var nodes=document.createTreeWalker(copy,4),node,renamed=false;
    while((node=nodes.nextNode())){
      if(node.nodeValue&&node.nodeValue.indexOf("Talent Sets")!==-1){
        node.nodeValue=node.nodeValue.replace("Talent Sets","Talent Calculator");
        renamed=true;
      }
    }
    if(!renamed)return null;
    if(copy.tagName==="A"){
      copy.href=talentsURL;
    }else{
      if(copy.tagName==="BUTTON")copy.type="button";
      else{copy.setAttribute("role","link");copy.tabIndex=0;}
    }
    copy.addEventListener("click",function(event){
      // React's original Talent Sets handler isn't cloned. Stop any delegated
      // sidebar navigation and open the correct permanent URL.
      if(event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
      event.preventDefault();event.stopPropagation();
      window.location.assign(talentsURL);
    });
    if(copy.tagName!=="A"&&copy.tagName!=="BUTTON"){
      copy.addEventListener("keydown",function(event){
        if(event.key==="Enter"||event.key===" "){
          event.preventDefault();event.stopPropagation();window.location.assign(talentsURL);
        }
      });
    }
    return copy;
  }
  function mountLink(){
    var old=document.getElementById(LINK_ID);
    if(old&&old.isConnected)return;
    var sets=findTalentSets();
    if(!sets)return; // No intrusive floating button; the sidebar is the only location.
    var item=createNativeMenuEntry(sets);
    if(!item)return;
    var li=sets.closest("li,[role='listitem']");
    if(li&&li.parentNode){
      var wrapper=li.cloneNode(false);
      stripOldNavigationBehavior(wrapper);
      wrapper.removeAttribute("aria-label");
      wrapper.classList.remove("active","selected","is-active");
      wrapper.appendChild(item);
      li.insertAdjacentElement("afterend",wrapper);
    }else{
      sets.insertAdjacentElement("afterend",item);
    }
  }
  function homeControl(){
    var selectors=["aside a","aside button","aside [role='button']",
      "[class*='sidebar' i] a","[class*='sidebar' i] button",
      "nav a","nav button","[role='navigation'] a"];
    var items=document.querySelectorAll(selectors.join(","));
    for(var i=0;i<items.length;i++){
      if(visible(items[i])&&label(items[i])==="Home")return items[i];
    }
    return null;
  }
  function brand(){
    if(!document.body||!document.createTreeWalker)return null;
    var walker=document.createTreeWalker(document.body,4),part,attempt=0;
    while((part=walker.nextNode())&&attempt++<12000){
      if(!part.textContent||part.textContent.toUpperCase().indexOf("AZEROTHCORE RESOURCE HUB")<0)continue;
      var candidate=part.parentElement,found=null;
      for(var n=0;candidate&&n<7;candidate=candidate.parentElement,n++){
        var s=String(candidate.textContent||"").replace(/\s+/g," ").trim().toUpperCase();
        if(s.indexOf("NAXXRAMAS")!==-1 && s.indexOf("AZEROTHCORE RESOURCE HUB")!==-1 && s.length<=160&&visible(candidate)){
          found=candidate;
        } else if(found)break;
      }
      if(found)return found;
    }
    return null;
  }
  function mountBrand(){
    var el=brand();
    if(!el||el.dataset.naxxLiveHome==="1")return;
    el.dataset.naxxLiveHome="1";
    el.classList.add("naxx-frostbound-home-brand");
    el.setAttribute("title","Return to the Resource Hub Home");
    el.setAttribute("aria-label","Naxxramas Resource Hub — Home");
    if(!el.matches("button,a[href],[role='button']")){
      el.setAttribute("role","button");el.setAttribute("tabindex","0");
    }
    function go(event){
      event.preventDefault();event.stopPropagation();
      if(location.pathname===root.pathname||location.pathname===root.pathname+"index.html"){
        var home=homeControl();
        if(home){home.click();return;}
      }
      location.assign(homeURL);
    }
    el.addEventListener("click",go,true);
    el.addEventListener("keydown",function(event){
      if(event.key==="Enter"||event.key===" "){go(event);}
    },true);
  }
  function setup(){mountLink();mountBrand();}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",setup,{once:true});
  else setup();
  // Existing resource pages use dynamic internal navigation; reattach after a
  // rerender without observing or mutating the enormous document subtree.
  window.setInterval(function(){if(document.body)mountLink();},4000);
})();