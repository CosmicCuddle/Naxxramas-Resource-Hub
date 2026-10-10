/* Hide only the redundant "Choose your class" panel on Home.
 * Class resources remain in the left navigation; original site data stays intact.
 */
(function () {
  "use strict";
  var selector = ".naxx-home-duplicate-class-selector";
  var labels = /^(warrior|paladin|hunter|rogue|priest|shaman|mage|warlock|druid|death\s*knight)$/i;

  function findPanel() {
    var headings = document.querySelectorAll("h1,h2,h3,h4,h5,h6");
    for (var i = 0; i < headings.length; i++) {
      var heading = headings[i];
      if (heading.textContent.replace(/\s+/g, " ").trim().toLowerCase() !== "choose your class") continue;
      if (heading.closest("aside,nav,[role='navigation'],#naxx-countdowns")) continue;
      for (var panel = heading.parentElement, depth = 0; panel && depth < 5; panel = panel.parentElement, depth++) {
        var text = panel.textContent || "";
        if (text.length > 2400) break;
        if (!/select a class to reveal every resource available for it/i.test(text)) continue;
        var options = Array.from(panel.querySelectorAll("button,a,[role='button']")).filter(function (node) {
          return labels.test((node.textContent || "").replace(/\s+/g, " ").trim());
        });
        if (options.length >= 8) return panel;
      }
    }
    return null;
  }

  function sync() {
    var panel = document.querySelector(selector) || findPanel();
    if (!panel) return;
    panel.classList.add("naxx-home-duplicate-class-selector");
    // The class-choice panel belongs to Home; never hide an unrelated panel
    // if other website sections happen to reuse the same heading later.
    panel.hidden = document.body.classList.contains("naxx-v3-home-active");
  }

  var scheduled = false;
  function queue() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(function () {
      scheduled = false;
      sync();
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", queue, { once: true });
  else queue();
  new MutationObserver(function (changes) {
    if (changes.every(function (change) {
      return change.target.closest && change.target.closest(selector);
    })) return;
    queue();
  }).observe(document.body, { subtree:true,childList:true,attributes:true,attributeFilter:["class","hidden"] });
  window.addEventListener("hashchange", queue);
  window.addEventListener("popstate", queue);
})();
