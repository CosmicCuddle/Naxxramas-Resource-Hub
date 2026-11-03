/* Draft three-page Resource Hub integration. Native navigation and shell only.
 * Pages are proposed for owner review. No application receiver is configured.
 */
(function(){
  "use strict";
  var currentScript = document.currentScript;
  if (!currentScript || !currentScript.src) return;
  var root = new URL("../", currentScript.src);
  var pages = [
    {slug:"new-players",label:"New Players",title:"New Player Guide",group:"General",
     icon:"inv_misc_spyglass_03.jpg",intro:"Getting started with Individual Progression, the client, addons and group play."},
    {slug:"rules",label:"Server Rules",title:"Server Rules",group:"General",
     icon:"inv_misc_note_05.jpg",intro:"Community expectations, fair play, loot rules and enforcement."},
    {slug:"apply",label:"Apply to Join",title:"Apply to Join Naxxramas",group:"General",
     icon:"inv_inscription_scroll.jpg",intro:"The planned application process. Submissions are not currently open."}
  ];
  var path = location.pathname.replace(/\/+$/,"/"), active = pages.find(function(p){
    return path === new URL(p.slug+"/",root).pathname;
  });
  function pageUrl(p){return new URL(p.slug+"/",root).href;}
  function makeLink(example,p) {
    var button = example.cloneNode(true);
    button.type="button";
    button.classList.remove("active");
    button.removeAttribute("data-section");
    button.removeAttribute("onclick");
    button.removeAttribute("id");
    button.removeAttribute("title");
    button.querySelectorAll(".nav-label-edit").forEach(function(x){x.remove();});
    button.setAttribute("data-naxx-guide-link",p.slug);
    button.setAttribute("title",p.title);
    var label = button.querySelector(".nav-button-main > span:last-child");
    if (label) label.textContent = p.label;
    var icon=button.querySelector(".nav-icon");
    if(icon){
      icon.textContent="";
      var img=document.createElement("img");
      img.className="nav-icon-image";
      img.src="https://wow.zamimg.com/images/wow/icons/large/"+p.icon;
      img.alt="";
      img.setAttribute("aria-hidden","true");
      icon.appendChild(img);
    }
    if(active&&active.slug===p.slug){
      button.classList.add("active");
      button.setAttribute("aria-current","page");
    }else button.removeAttribute("aria-current");
    button.addEventListener("click",function(e){
      e.preventDefault();e.stopPropagation();
      if (location.href!==pageUrl(p)) location.assign(pageUrl(p));
    });
    return button;
  }
  function syncNavigation(){
    ["mainNav","mobileNav"].forEach(function(id){
      var nav=document.getElementById(id);
      if(!nav)return;
      var home=nav.querySelector('button[data-section="Home"]');
      if(!home)return;
      var last=home;
      pages.forEach(function(page){
        var item=nav.querySelector('button[data-naxx-guide-link="'+page.slug+'"]');
        if(!item){
          item=makeLink(home,page);
          last.insertAdjacentElement("afterend",item);
        } else if (item.previousElementSibling!==last) {
          last.insertAdjacentElement("afterend",item);
        }
        last=item;
      });
      // The original HTML snapshot may mark Change Notes active by default.
      // Only the current new-page link should be selected on a guide URL.
      if(active){
        nav.querySelectorAll("button.active").forEach(function(button){
          if(button.getAttribute("data-naxx-guide-link")!==active.slug)
            button.classList.remove("active");
        });
      }
    });
  }
  function mountContent(){
    if(!active)return;
    var grid=document.getElementById("resourceGrid");
    if(!grid || grid.dataset.naxxGuideMounted==="1")return;
    grid.dataset.naxxGuideMounted="1";
    document.body.classList.add("naxx-three-page-route");
    document.body.setAttribute("data-naxx-guide-page",active.slug);
    var heading=document.getElementById("sectionHeading");
    var sub=document.getElementById("sectionSubheading");
    if(heading)heading.textContent=active.title;
    if(sub)sub.textContent=active.intro;
    var breadcrumbGroup=document.getElementById("whProContextGroup");
    var breadcrumbTitle=document.getElementById("whProContextTitle");
    if(breadcrumbGroup)breadcrumbGroup.textContent="General";
    if(breadcrumbTitle)breadcrumbTitle.textContent=active.label;
    var kicker=document.getElementById("contextArtworkKicker");
    var title=document.getElementById("contextArtworkTitle");
    var description=document.getElementById("contextArtworkSummary");
    if(kicker)kicker.textContent="Naxxramas Resource Hub";
    if(title)title.textContent=active.title;
    if(description)description.textContent=active.intro;
    ["vanillaBuildTabs","specProgressionTabs","optionalPatchTabs","classHandbookChooser",
     "dungeonHandbookChooser","dungeonHandbookFilter","patchesGithubSection",
     "homeAddInformationButton","classPicker"].forEach(function(id){
       var el=document.getElementById(id);
       if(el)el.classList.add("hidden");
     });
    grid.innerHTML='<p class="naxx-guide-loading" role="status">Loading '+active.title+'…</p>';
    fetch(new URL(active.slug+"/content.html",root),{cache:"default"})
      .then(function(res){if(!res.ok)throw Error("Page content unavailable");return res.text();})
      .then(function(html){
        grid.innerHTML='<article class="naxx-guide-body">'+html+'</article>';
        if(active.slug==="apply"){
          var area=grid.querySelector("#naxx-application-demo");
          if(area)area.setAttribute("aria-disabled","true");
        }
      })
      .catch(function(err){
        grid.innerHTML='<p class="naxx-guide-error" role="alert">This guide could not be loaded. Please return to <a href="'+root.href+'">Home</a> and try again.</p>';
        console.error("Naxx three-page content:",err);
      });
  }
  function mount(){syncNavigation();mountContent();}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",mount,{once:true});
  else mount();
  // The native site can rebuild sidebar buttons when its state changes.
  // Only inspect small menu containers; never observe the giant document body.
  ["mainNav","mobileNav"].forEach(function(id){
    var nav=document.getElementById(id);
    if(nav){
      var observer=new MutationObserver(function(){syncNavigation();});
      observer.observe(nav,{childList:true});
    }
  });
  window.addEventListener("pageshow",mount);
})();
