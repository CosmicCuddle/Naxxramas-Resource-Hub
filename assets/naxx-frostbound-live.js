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
  function homeControl(){
    var selectors=[
      "aside a","aside button","aside [role='button']",
      "[class*='sidebar' i] a","[class*='sidebar' i] button",
      "[class*='sidebar' i] [role='button']",
      "nav a","nav button","[role='navigation'] a"
    ];
    var matches=document.querySelectorAll(selectors.join(","));
    for(var i=0;i<matches.length;i++){
      var item=matches[i];
      if(!visible(item)||item.closest(".naxx-frostbound-talent-link"))continue;
      if(label(item)==="Home")return item;
    }
    return null;
  }
  function makeLink(){
    var a=document.createElement("a");
    a.id=LINK_ID;
    a.className="naxx-frostbound-talent-link";
    a.href=talentsURL;
    a.textContent="Talent Calculator";
    a.setAttribute("aria-label","Open Naxxramas Talent Calculator");
    return a;
  }
  function mountLink(){
    var previous=document.getElementById(LINK_ID);
    // Avoid rescanning the enormous Resource Hub DOM every four seconds when
    // the Talent Calculator is already present in the real site navigation.
    if(previous&&previous.isConnected&&!previous.classList.contains("naxx-frostbound-talent-floating"))return;
    var home=homeControl();
    if(!home){
      if(!previous&&document.body){
        var floating=makeLink();
        floating.classList.add("naxx-frostbound-talent-floating");
        document.body.appendChild(floating);
      }
      return;
    }
    if(previous&&!previous.classList.contains("naxx-frostbound-talent-floating")&&previous.isConnected)return;
    if(previous)previous.remove();
    var anchor=makeLink();
    var li=home.closest("li");
    if(li&&li.parentElement){
      var node=document.createElement("li");
      node.className="naxx-frostbound-talent-li";
      node.appendChild(anchor);
      li.insertAdjacentElement("afterend",node);
    }else{
      home.insertAdjacentElement("afterend",anchor);
    }
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