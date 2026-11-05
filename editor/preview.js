/* Offline, script-free Naxxramas content preview. No fetch, browser storage or GitHub access. */
(function (root) {
  'use strict';
  var ALLOWED = new Set([
    'ARTICLE', 'SECTION', 'ASIDE', 'HEADER', 'FOOTER', 'NAV', 'MAIN',
    'DIV', 'P', 'SPAN', 'STRONG', 'B', 'EM', 'I', 'U', 'SMALL',
    'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'LI', 'DL', 'DT', 'DD',
    'BLOCKQUOTE', 'A', 'CODE', 'PRE', 'HR', 'BR'
  ]);
  var OMIT = new Set([
    'SCRIPT', 'STYLE', 'LINK', 'META', 'BASE', 'FORM', 'OBJECT', 'EMBED',
    'SVG', 'MATH', 'TEMPLATE', 'NOSCRIPT', 'AUDIO', 'VIDEO', 'SOURCE',
    'PICTURE', 'CANVAS'
  ]);
  var CSS = [
    ':root{color-scheme:dark}',
    '*{box-sizing:border-box}',
    'body{margin:0;padding:18px;background:#100e0d;color:#eaddc6;font:16px/1.65 system-ui,Segoe UI,Arial,sans-serif}',
    'main{max-width:960px;margin:auto}',
    'h1,h2,h3,h4{line-height:1.3;color:#efc77f}',
    'h2{font-size:1.3rem}h3{font-size:1.14rem}h4{font-size:1.04rem}',
    'p{margin:.5rem 0 1rem}',
    'article,section{min-width:0}',
    '.naxx-guide-card,.naxx-client-section,.naxx-client-explainer,.naxx-client-head,.naxx-client-download-card,.naxx-guide-qa{border:1px solid #665035;border-radius:10px;background:#221c17;padding:14px;margin:12px 0}',
    '.naxx-guide-qa{background:#171512}',
    '.naxx-guide-nav,.naxx-guide-faq-jump,.naxx-client-jump{display:flex;flex-wrap:wrap;gap:7px;margin:12px 0}',
    '.naxx-guide-nav>span,.naxx-guide-faq-jump>span,.naxx-client-jump>span{padding:5px 9px;background:#342c22;border:1px solid #7a5c31;border-radius:6px}',
    '.naxx-client-downloads{display:grid;grid-template-columns:repeat(auto-fit,minmax(235px,1fr));gap:12px}',
    '.preview-link{color:#8dd6c8;text-decoration:underline;text-underline-offset:3px}',
    '.preview-placeholder{padding:10px;border:1px dashed #937b53;border-radius:8px;color:#ecd1a1;background:#32291f}',
    'code,pre{background:#29221b;padding:2px 5px;border-radius:4px}pre{white-space:pre-wrap}',
    '.preview-heading{border-bottom:1px solid #645035;padding-bottom:12px}',
    '@media(max-width:600px){body{padding:10px}.naxx-guide-card,.naxx-client-section{padding:10px}}'
  ].join('\n');

  function safeMarkup(html) {
    if (typeof html !== 'string' || html.length > 2 * 1024 * 1024) {
      throw new Error('Preview source is unexpectedly large.');
    }
    if (!document || !document.implementation || !document.createElement) {
      throw new Error('This browser cannot produce the offline preview.');
    }
    // Parsing inside an unmounted <template> keeps remote images/iframes inert.
    // DOMParser's detached HTML document may still load remote resources.
    var input = document.createElement('template');
    input.innerHTML = html;
    var output = document.implementation.createHTMLDocument('Naxxramas safe preview');
    var wrapper = output.createElement('main');
    var visited = 0;
    function placeholder(message, dest) {
      var p = output.createElement('p');
      p.className = 'preview-placeholder';
      p.textContent = message;
      dest.appendChild(p);
    }
    function traverse(node, dest) {
      if (++visited > 15000) throw new Error('Preview has too many elements.');
      if (node.nodeType === 3) {
        dest.appendChild(output.createTextNode(node.nodeValue));
        return;
      }
      if (node.nodeType !== 1) return;
      var name = node.tagName.toUpperCase();
      if (OMIT.has(name)) return;
      if (name === 'IFRAME') {
        placeholder('External application form deliberately hidden in offline preview.', dest);
        return;
      }
      if (name === 'IMG') {
        placeholder('External image hidden in offline preview.', dest);
        return;
      }
      if (name === 'INPUT' || name === 'BUTTON' || name === 'SELECT' || name === 'TEXTAREA') {
        placeholder('Interactive form control hidden in offline preview.', dest);
        return;
      }
      var allowed = ALLOWED.has(name);
      var target = allowed ? output.createElement(name.toLowerCase()) : dest;
      if (allowed) {
        if (name === 'A') {
          target.removeAttribute('href');
          target.className = 'preview-link';
          target.setAttribute('aria-label', 'Link shown as text, not clickable in offline preview');
        } else if (node.classList) {
          var classes = Array.from(node.classList).filter(function (item) {
            return item.length <= 80 && (/^naxx-[a-z0-9_-]+$/.test(item) || item === 'card');
          });
          if (classes.length) target.className = classes.join(' ');
        }
        // No source IDs, URL-bearing attributes, inline styles or event handlers are copied.
        dest.appendChild(target);
      }
      Array.from(node.childNodes).forEach(function (child) { traverse(child, target); });
    }
    Array.from(input.content.childNodes).forEach(function (node) { traverse(node, wrapper); });
    return wrapper.outerHTML;
  }
  function render(html, label) {
    var safe = safeMarkup(html);
    var cleanTitle = String(label || 'Page preview').replace(/&/g, '&amp;')
      .replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    // CSP plus sandboxed iframe: no scripts, remote assets, forms, navigation or network.
    return '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
      '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; connect-src \'none\'; img-src \'none\'; frame-src \'none\'; form-action \'none\'; style-src \'unsafe-inline\'; base-uri \'none\'">' +
      '<meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<title>' + cleanTitle + '</title><style>' + CSS + '</style></head><body>' +
      '<main><h1 class="preview-heading">' + cleanTitle + '</h1></main>' + safe +
      '</body></html>';
  }
  root.NaxxEditorPreview = { render: render, safeMarkup: safeMarkup };
})(typeof window === 'undefined' ? globalThis : window);
