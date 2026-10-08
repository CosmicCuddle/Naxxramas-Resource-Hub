(function () {
  "use strict";
  var frame = document.getElementById("resource-site");
  var state = document.getElementById("trial-status");

  function inject(doc, tag, attrs, parent) {
    var node = doc.createElement(tag);
    Object.keys(attrs).forEach(function (key) { node.setAttribute(key, attrs[key]); });
    (parent || doc.head).appendChild(node);
    return node;
  }

  function addPreview() {
    try {
      var inner = frame.contentDocument;
      if (!inner || !inner.documentElement) throw Error("Page is not ready");
      if (inner.getElementById("naxx-trial-theme-link")) return;
      inner.documentElement.classList.add("naxx-trial-ui");
      var root = new URL("../", location.href);
      // Original site content is loaded directly, not modified or duplicated.
      inject(inner, "link", {
        id: "naxx-trial-countdown-core",
        rel: "stylesheet",
        href: new URL("assets/naxx-countdowns.css", root).href
      });
      inject(inner, "link", {
        id: "naxx-trial-theme-link",
        rel: "stylesheet",
        href: new URL("trial/theme.css?v=1", root).href
      });
      if (!inner.getElementById("naxx-countdowns")) {
        var runtime = inject(inner, "script", {
          id: "naxx-trial-countdown-runtime",
          src: new URL("assets/naxx-countdowns.js?v=3", root).href
        }, inner.body || inner.documentElement);
        runtime.onerror = function () {
          state.textContent = "Preview loaded (countdown script unavailable)";
        };
      }
      state.textContent = "Redesign trial — ready";
    } catch (err) {
      state.textContent = "Preview styling unavailable";
      if (window.console) console.warn("Naxxramas trial:",err);
    }
  }

  frame.addEventListener("load", addPreview);
  document.getElementById("refresh-preview").addEventListener("click", function () {
    state.textContent = "Refreshing trial…";
    try { frame.contentWindow.location.reload(); }
    catch (err) { frame.src = frame.src; }
  });
})();
