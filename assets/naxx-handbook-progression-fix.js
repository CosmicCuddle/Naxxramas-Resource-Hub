/* Main Class Handbook expansion selection repair.
 * The site already has selectSpecProgressionView() and the correct native
 * filterRichProgressionSections(). Its apply function does NOT target the
 * actual main handbook selector .main-class-template-item > .card .rich.
 * Extend that filter rather than replacing the original era controls.
 */
(function(){
  "use strict";
  // Works in the restored original UI as well as any future theme.
  function filterMainHandbooks(){
    var grid=document.getElementById("resourceGrid");
    if(!grid||!grid.classList.contains("main-handbook-fit-grid"))return;
    var active=document.querySelector("#specProgressionTabs [data-spec-progression-view].active");
    var view=active&&active.dataset.specProgressionView;
    if(!["Overview","Vanilla","TBC","WotLK"].includes(view))return;
    if(typeof window.filterRichProgressionSections!=="function")return;
    grid.querySelectorAll(".main-class-template-item > .card .rich").forEach(function(rich){
      window.filterRichProgressionSections(rich,view);
    });
  }
  if(typeof window.applySpecProgressionView==="function"){
    var originalApply=window.applySpecProgressionView;
    window.applySpecProgressionView=function(){
      var result=originalApply.apply(this,arguments);
      filterMainHandbooks();
      return result;
    };
  }
  if(typeof window.renderPublic==="function"){
    var originalRender=window.renderPublic;
    window.renderPublic=function(){
      var result=originalRender.apply(this,arguments);
      requestAnimationFrame(function(){
        if(typeof window.applySpecProgressionView==="function")
          window.applySpecProgressionView();
      });
      return result;
    };
  }
  function refresh(){
    if(typeof window.applySpecProgressionView==="function")
      window.applySpecProgressionView();
  }
  if(document.readyState==="loading")
    document.addEventListener("DOMContentLoaded",function(){requestAnimationFrame(refresh);},{once:true});
  else requestAnimationFrame(refresh);
})();
