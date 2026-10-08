(function () {
  "use strict";
  var THEMES = {
    frostbound: {title:"Frostbound Citadel", css:null},
    obsidian: {title:"Obsidian Forge", css:"trial/styles/obsidian.css"},
    emerald: {title:"Emerald Sanctuary", css:"trial/styles/emerald.css"},
    arcane: {title:"Arcane Observatory", css:"trial/styles/arcane.css"}
  };
  var frame=document.getElementById("resource-site");
  var state=document.getElementById("trial-status");
  var title=document.getElementById("trial-title");
  var picker=document.getElementById("theme-picker");
  var root=new URL("../",window.location.href);
  var asked=new URLSearchParams(window.location.search).get("style");
  var chosen=Object.prototype.hasOwnProperty.call(THEMES,asked)?asked:"frostbound";
  picker.value=chosen;

  function node(doc,tag,attrs,parent) {
    var el=doc.createElement(tag);
    Object.keys(attrs).forEach(function(key){el.setAttribute(key,attrs[key]);});
    (parent||doc.head).appendChild(el);
    return el;
  }
  function findById(doc,id) {return doc.getElementById(id);}
  function injectCss(doc,id,path) {
    var element=findById(doc,id);
    if (!element) element=node(doc,"link",{id:id,rel:"stylesheet"},doc.head);
    var address=new URL(path,root).href;
    if (element.href!==address) element.href=address;
    return element;
  }
  function selectedTheme(doc) {
    if (!doc || !doc.documentElement || !doc.head) return;
    doc.documentElement.classList.add("naxx-trial-ui");
    doc.documentElement.setAttribute("data-naxx-style",chosen);
    injectCss(doc,"naxx-trial-theme-link","trial/theme.css?v=4");
    var variant=findById(doc,"naxx-trial-variant-link");
    if (THEMES[chosen].css) {
      injectCss(doc,"naxx-trial-variant-link",THEMES[chosen].css+"?v=2");
    } else if (variant) {
      variant.remove();
    }
  }

  // Turn the in-site Naxxramas branding into a Home navigation control.
  // This is scoped to the trial's same-origin iframe; the live site is untouched.
  function normalizeLabel(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }
  function isVisible(el) {
    return !!(el && el.getClientRects && el.getClientRects().length);
  }
  function findBrand(doc) {
    if (!doc.body || !doc.createTreeWalker) return null;
    // Locate the unique subtitle in the left-hand Naxxramas brand, not the Home banner.
    // Stop after a bounded number of text nodes in case the enormous source varies.
    var walker = doc.createTreeWalker(doc.body, 4), textNode, checked = 0;
    while ((textNode=walker.nextNode()) && checked++<12000) {
      if (!normalizeLabel(textNode.textContent).toUpperCase().includes("AZEROTHCORE RESOURCE HUB")) continue;
      var candidate=textNode.parentElement, best=null;
      for(var depth=0;candidate && depth<7;candidate=candidate.parentElement,depth++){
        var content=normalizeLabel(candidate.textContent).toUpperCase();
        if (content.includes("NAXXRAMAS") &&
            content.includes("AZEROTHCORE RESOURCE HUB") &&
            content.length<=160 && isVisible(candidate)) {
          best=candidate;
        } else if (best) {
          break;
        }
      }
      if (best) return best;
    }
    return null;
  }
  function findHomeNavigation(doc) {
    var selector=[
      "aside a","aside button","aside [role='button']",
      "[class*='sidebar' i] a","[class*='sidebar' i] button",
      "[class*='sidebar' i] [role='button']",
      "nav a","nav button","[role='navigation'] a",
      "[data-page]","[data-route]"
    ].join(",");
    var elements=doc.querySelectorAll(selector);
    for(var i=0;i<elements.length;i++) {
      var item=elements[i];
      if (!isVisible(item) || item.closest(".naxx-trial-home-brand")) continue;
      var name=normalizeLabel(item.getAttribute("aria-label") ||
          item.getAttribute("title") || item.textContent);
      if (name==="Home") return item;
    }
    return null;
  }
  function goToHome(doc) {
    var existing=findHomeNavigation(doc);
    if (existing) {
      existing.click(); // Reuses the site's own internal page navigation.
      return;
    }
    // Safe fallback if a version of the source has no clickable Home navigation.
    frame.src = new URL("site-content.html",root).href;
  }
  function wireBrandHome(doc) {
    var brand=findBrand(doc);
    if (!brand || brand.getAttribute("data-naxx-home-wired")==="1") return;
    brand.setAttribute("data-naxx-home-wired","1");
    brand.classList.add("naxx-trial-home-brand");
    brand.setAttribute("title","Return to Home");
    if (!brand.matches("button,a[href],[role='button']")) {
      brand.setAttribute("role","button");
      brand.setAttribute("tabindex","0");
    }
    brand.setAttribute("aria-label","Naxxramas Resource Hub — return to Home");
    brand.addEventListener("click",function(event) {
      event.preventDefault();
      event.stopPropagation();
      goToHome(doc);
    },true);
    brand.addEventListener("keydown",function(event) {
      if (event.key!=="Enter" && event.key!==" ") return;
      event.preventDefault();
      event.stopPropagation();
      goToHome(doc);
    },true);
  }

  function updateLabels() {
    title.textContent="Naxxramas · "+THEMES[chosen].title;
    picker.value=chosen;
    state.textContent="Trial theme: "+THEMES[chosen].title;
  }
  function apply() {
    try {
      var doc=frame.contentDocument;
      if (!doc || !doc.documentElement || !doc.head) throw Error("Preview page unavailable");
      selectedTheme(doc);
      wireBrandHome(doc);
      injectCss(doc,"naxx-trial-countdown-core","assets/naxx-countdowns.css?v=3");
      if (!findById(doc,"naxx-trial-countdown-runtime") && !findById(doc,"naxx-countdowns")) {
        node(doc,"script",{
          id:"naxx-trial-countdown-runtime",
          src:new URL("assets/naxx-countdowns.js?v=3",root).href
        },doc.body||doc.documentElement);
      }
      updateLabels();
    } catch (error) {
      state.textContent="Could not apply theme to this page";
      if (window.console) console.warn("Naxxramas design preview:",error);
    }
  }
  frame.addEventListener("load",apply);
  // Cover a cached iframe which may finish loading before this script is evaluated.
  try {
    if (frame.contentDocument && frame.contentDocument.readyState==="complete") apply();
  } catch(error) {
    // Some external links may leave the same-origin preview; the load handler reports this.
  }
  picker.addEventListener("change",function(){
    chosen=Object.prototype.hasOwnProperty.call(THEMES,picker.value)?picker.value:"frostbound";
    window.history.replaceState(null,"",window.location.pathname+"?style="+encodeURIComponent(chosen));
    // Switch CSS in the existing frame — no 31MB reload needed.
    apply();
  });
  document.getElementById("refresh-preview").addEventListener("click",function(){
    state.textContent="Refreshing preview…";
    try {frame.contentWindow.location.reload();}
    catch(error){frame.src=frame.src;}
  });
  updateLabels();
})();