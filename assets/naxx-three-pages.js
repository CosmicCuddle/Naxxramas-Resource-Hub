/* Draft three-page Resource Hub integration. Native navigation and shell only.
 * Pages are proposed for owner review. No application receiver is configured.
 */
(function(){
  "use strict";
  var currentScript = document.currentScript;
  if (!currentScript || !currentScript.src) return;
  var root = new URL("../", currentScript.src);
  // Use existing, proven Warcraft icon assets already used by the REAL hub's
  // Database, Updates and Admin controls. Same image element / class, native
  // 16-20px chip sizing; not the Unicode symbols from the offline mockup.
  var pages = [
    {slug:"new-players",label:"New Players",title:"New Player Guide",group:"General",
     icon:"inv_misc_book_09.jpg",intro:"Getting started with Individual Progression, the client, addons and group play."},
    {slug:"rules",label:"Server Rules",title:"Server Rules",group:"General",
     icon:"inv_misc_note_05.jpg",intro:"Community expectations, fair play, loot rules and enforcement."},
    {slug:"apply",label:"Apply to Join",title:"Apply to Join Naxxramas",group:"General",
     icon:"inv_misc_key_03.jpg",intro:"The planned application process. Submissions are not currently open."}
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
  // The original Resource Hub can re-render #resourceGrid after startup
  // (including delayed handbook/search hooks). Keep new route content mounted
  // even when a native refresh replaces the grid after this script loads.
  // Observe only the one content grid, never the 31 MB document body.
  var pageMarkup = null;
  var requestStarted = false;
  var requestFailed = false;
  var gridObserver = null;

  function refreshGuideChrome() {
    if (!active) return;
    document.body.classList.add("naxx-three-page-route");
    document.body.setAttribute("data-naxx-guide-page",active.slug);
    var heading=document.getElementById("sectionHeading");
    var sub=document.getElementById("sectionSubheading");
    if(heading) heading.textContent=active.title;
    if(sub) sub.textContent=active.intro;
    var group=document.getElementById("whProContextGroup");
    var breadcrumb=document.getElementById("whProContextTitle");
    if(group)group.textContent="General";
    if(breadcrumb)breadcrumb.textContent=active.label;
    var kicker=document.getElementById("contextArtworkKicker");
    var title=document.getElementById("contextArtworkTitle");
    var description=document.getElementById("contextArtworkSummary");
    if(kicker)kicker.textContent="Naxxramas Resource Hub";
    if(title)title.textContent=active.title;
    if(description)description.textContent=active.intro;
    ["vanillaBuildTabs","specProgressionTabs","optionalPatchTabs",
     "classHandbookChooser","dungeonHandbookChooser","dungeonHandbookFilter",
     "patchesGithubSection","homeAddInformationButton","classPicker"
    ].forEach(function(id){
      var el=document.getElementById(id);
      if(el)el.classList.add("hidden");
    });
  }

  function fillGuide(grid,markup){
    // Clear handbook-only geometry that an existing section may have left.
    grid.style.removeProperty("height");
    grid.classList.remove("handbook-fill-viewport","main-handbook-fit-grid",
      "extra-handbook-fit-grid","extra-handbook-resource-grid",
      "generic-handbook-resource-grid","temporary-banned-grid");
    grid.innerHTML='<article class="naxx-guide-body" data-naxx-guide-content="'+
      active.slug+'">'+markup+'</article>';
    if(active.slug==="apply"){
      var area=grid.querySelector("#naxx-application-demo");
      if(area) area.setAttribute("aria-disabled","true");
    }
  }

  function mountContent(){
    if(!active)return;
    var grid=document.getElementById("resourceGrid");
    if(!grid)return;
    refreshGuideChrome();
    if(!gridObserver && typeof MutationObserver==="function"){
      gridObserver=new MutationObserver(function(){
        // Native re-renders can remove the article while leaving data-* flags
        // behind. Remount cached content, without fetching or looping.
        if(!grid.querySelector("[data-naxx-guide-content]") &&
           !grid.querySelector(".naxx-guide-loading") &&
           !grid.querySelector(".naxx-guide-error")) mountContent();
      });
      gridObserver.observe(grid,{childList:true});
    }
    if(grid.querySelector('[data-naxx-guide-content="'+active.slug+'"]'))return;
    if(pageMarkup!==null){
      fillGuide(grid,pageMarkup);
      return;
    }
    if(requestFailed){
      grid.innerHTML='<p class="naxx-guide-error" role="alert">This guide could not be loaded. Please return to <a href="'+root.href+'">Home</a> and try again.</p>';
      return;
    }
    if(!grid.querySelector(".naxx-guide-loading"))
      grid.innerHTML='<p class="naxx-guide-loading" role="status">Loading '+active.title+'…</p>';
    if(requestStarted)return;
    requestStarted=true;
    fetch(new URL(active.slug+"/content.html",root),{cache:"default"})
      .then(function(res){if(!res.ok)throw Error("Page content unavailable");return res.text();})
      .then(function(html){
        pageMarkup=html;
        refreshGuideChrome();
        fillGuide(grid,html);
      })
      .catch(function(err){
        requestFailed=true;
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
