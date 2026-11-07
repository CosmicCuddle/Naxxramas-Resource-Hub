/* Additive Game Clients guide for the existing native Resource Hub section.
 * The original 31 MB content and its admin-editable resources are never modified.
 * External client archive contents and build numbers remain unverified.
 */
(function () {
  "use strict";
  var marker = "naxx-game-client-guide";
  var className = "naxx-game-client-guide-grid";
  // Game Clients content now lives in game-clients/content.html.
  // Only this new HTML fragment is fetched; the original site DATA is untouched.
  var guideHTML = null;
  var guideRequested = false;
  var guideFailed = false;
  var currentScript = document.currentScript;
  var siteRoot = currentScript && currentScript.src
    ? new URL("../", currentScript.src) : new URL("./", location.href);
  function requestGuide() {
    if (guideRequested || guideHTML !== null) return;
    guideRequested = true;
    fetch(new URL("game-clients/content.html", siteRoot), { cache: "default" })
      .then(function (response) {
        if (!response.ok) throw new Error("Game Clients page returned " + response.status);
        return response.text();
      })
      .then(function (html) {
        if (!/<article\b[^>]*\bid=["']naxx-game-client-guide["']/i.test(html) ||
            !/<\/article>\s*$/i.test(html) || /<\s*script\b/i.test(html)) {
          throw new Error("Game Clients HTML is incomplete or unsafe to display.");
        }
        guideHTML = html;
        sync();
      })
      .catch(function (error) {
        guideFailed = true;
        if (window.console) console.error("Unable to load Game Clients guide", error);
        sync();
      });
  }
  function isSelected() {
    try {
      if (typeof currentSection === "string") return currentSection === "Game Clients";
    } catch (_) {}
    var a = document.querySelector('#mainNav button[data-section="Game Clients"]');
    var b = document.querySelector('#mobileNav button[data-section="Game Clients"]');
    return !!((a && a.classList.contains("active")) || (b && b.classList.contains("active")));
  }
  function sync() {
    var grid = document.getElementById("resourceGrid");
    if (!grid) return;
    var selected = isSelected();
    grid.classList.toggle(className, selected);
    if (!selected) {
      // Do not leave the injected guide on a different native resource section.
      var previousGuide = document.getElementById(marker);
      if (previousGuide) previousGuide.remove();
      return;
    }
    // If the content file is unavailable, preserve the legacy client card and
    // display a readable warning instead of hiding the whole download section.
    if (guideHTML === null) {
      if (!guideFailed) requestGuide();
      else if (!document.getElementById(marker)) {
        var fallback = document.createElement("div");
        fallback.id = marker;
        fallback.className = "card naxx-client-guide";
        fallback.textContent = "The Game Clients installation guide could not be loaded. Please refresh the page or contact Naxxramas support.";
        grid.insertBefore(fallback, grid.firstChild);
      }
      return;
    }
    // The guide must still render if an administrator later removes every legacy card.
    // Keep future admin-created download cards visible to players.
    // Only the legacy ChromieCraft card repeats the new guide's information.
    grid.querySelectorAll(".game-client-card").forEach(function (card) {
      var heading = card.querySelector(".game-client-title");
      card.classList.toggle("naxx-legacy-client-card",
        !!heading && heading.textContent.trim() === "ChromieCraft");
    });
    if (!document.getElementById(marker)) {
      grid.insertAdjacentHTML("afterbegin", guideHTML);
    }
  }
  function start() {
    var grid = document.getElementById("resourceGrid");
    if (!grid) return;
    new MutationObserver(sync).observe(grid, { childList: true });
    sync();
    window.addEventListener("pageshow", sync);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();