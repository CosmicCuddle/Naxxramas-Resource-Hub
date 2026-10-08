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