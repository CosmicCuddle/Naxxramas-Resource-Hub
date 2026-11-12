/* Native Resource Hub bootloader for three proposed permanent subpages.
 * Mirrors the small root index loader; never modifies site-content.html.
 */
(function(){
  "use strict";
  var sourceScript=document.currentScript;
  var root=new URL("../",sourceScript.src);
  var backHome=new URL("./",root).href;
  var styles=[
    "assets/naxx-countdowns.css?v=4",
    "assets/naxx-theme-v2.css",
    "assets/naxx-theme-v3.css?v=2",
    "assets/naxx-countdowns-compact.css?v=4",
    "assets/naxx-home-class-selector.css?v=1",
    "assets/naxx-three-pages.css?v=3",
    "assets/naxx-game-clients-guide.css?v=1"
  ];
  var scripts=[
    "assets/naxx-countdowns.js?v=7",
    "assets/naxx-resource-navigation.js?v=2",
    "assets/naxx-handbook-progression-fix.js?v=2",
    "assets/naxx-resource-information.js?v=1",
    "assets/naxx-home-class-selector.js?v=1",
    "assets/naxx-talent-set-sync.js?v=2",
    "assets/naxx-talent-sets-full-sync.js?v=3",
    "assets/naxx-warrior-talent-sets.js?v=1",
    "assets/naxx-final-vanilla-talent-sets.js?v=1",
    "assets/naxx-three-pages.js?v=2",
    "assets/naxx-game-clients-guide.js?v=1",
    "assets/naxx-original-admin-save.js?v=1"
  ];
  fetch(new URL("site-content.html",root),{cache:"default"})
    .then(function(response){
      if(!response.ok)throw Error("Resource Hub unavailable ("+response.status+")");
      return response.text();
    })
    .then(function(html){
      if(!/<\/head>/i.test(html)||!/<\/body>/i.test(html))throw Error("Invalid Resource Hub page");
      var tags=styles.map(function(path){
        return '<link rel="stylesheet" href="'+new URL(path,root).href+'">';
      }).join("");
      html=html.replace(/<\/head>/i,tags+"</head>");
      var end=html.toLowerCase().lastIndexOf("</body>");
      var scriptTags=scripts.map(function(path){
        return "<scr"+"ipt src=\""+new URL(path,root).href+"\"></scr"+"ipt>";
      }).join("");
      html=html.slice(0,end)+scriptTags+html.slice(end);
      document.open();document.write(html);document.close();
    })
    .catch(function(error){
      document.body.innerHTML='<main class="naxx-loading" role="alert"><div>Unable to load the Resource Hub.<p><a href="'+backHome+'">Return Home</a></p></div></main>';
      if(window.console)console.error(error);
    });
})();
