/* Naxxramas local editor prototype: text + link editing in four existing HTML fragments.
 * Reads only user-selected local files, never writes to the working tree or uses network APIs.
 */
(function () {
  'use strict';
  var SOURCE_BRANCH = 'feature/multi-file-editor-export-2026-11-05';
  var PATHS = [
    'new-players/content.html',
    'rules/content.html',
    'apply/content.html',
    'game-clients/content.html'
  ];
  var TITLES = {
    'new-players/content.html': 'New Players',
    'rules/content.html': 'Server Rules',
    'apply/content.html': 'Apply to Join',
    'game-clients/content.html': 'Game Clients'
  };
  var NAV_PATH = 'content/navigation.json';
  var state = new Map();
  var navState = null;
  var activePath = PATHS[0];
  var $ = function (id) { return document.getElementById(id); };
  var status = $('status');
  var fields = $('fields');
  var filePicker = $('folder');
  var draftPicker = $('draft-file');

  function say(message, isError) {
    status.textContent = message;
    status.classList.toggle('error', !!isError);
  }
  function download(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 15000);
  }
  function decodeText(raw) {
    var el = document.createElement('textarea');
    el.innerHTML = raw;
    return el.value;
  }
  function escapeText(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function escapeAttr(s, quote) {
    return escapeText(s).replace(quote === '"' ? /"/g : /'/g, quote === '"' ? '&quot;' : '&#39;');
  }
  function validHref(value) {
    if (!value || value !== value.trim() || /[\x00-\x1f\x7f]/.test(value) || value.startsWith('//')) return false;
    if (/^(?:javascript|data|file|blob|vbscript):/i.test(value)) return false;
    try {
      var url = new URL(value, 'https://example.invalid/Naxxramas-Resource-Hub/');
      return ['http:', 'https:', 'mailto:'].includes(url.protocol);
    } catch (_) { return false; }
  }
  function tagEnd(source, start) {
    var quote = null;
    for (var i = start + 1; i < source.length; i++) {
      var c = source[i];
      if (quote) { if (c === quote) quote = null; }
      else if (c === '"' || c === "'") quote = c;
      else if (c === '>') return i + 1;
    }
    throw new Error('The page contains an unfinished HTML tag.');
  }
  function scan(source) {
    var out = [], stack = [], at = 0;
    while (at < source.length) {
      var lt = source.indexOf('<', at);
      if (lt < 0) lt = source.length;
      var ignored = stack.some(function (tag) { return /^(script|style|iframe|textarea|form|noscript)$/.test(tag); });
      if (lt > at && !ignored) {
        var raw = source.slice(at, lt);
        var first = raw.search(/\S/);
        if (first >= 0) {
          var last = raw.search(/\s*$/);
          var begin = at + first, end = at + last;
          if (end > begin) out.push({
            id: 'T:' + begin,
            kind: 'text',
            label: 'Text ' + (out.length + 1) + ' (' + (stack.slice(-2).join(' / ') || 'page') + ')',
            start: begin, end: end,
            original: source.slice(begin, end),
            value: decodeText(source.slice(begin, end))
          });
        }
      }
      if (lt === source.length) break;
      if (source.slice(lt, lt + 4) === '<!--') {
        var commentEnd = source.indexOf('-->', lt + 4);
        if (commentEnd < 0) throw new Error('The page contains an unfinished HTML comment.');
        at = commentEnd + 3;
        continue;
      }
      var next = tagEnd(source, lt);
      var tag = source.slice(lt, next);
      var match = /^<\s*(\/?)\s*([A-Za-z][\w:-]*)/.exec(tag);
      if (match) {
        var closing = !!match[1], name = match[2].toLowerCase();
        if (closing) {
          var pos = stack.lastIndexOf(name);
          if (pos >= 0) stack.length = pos;
        } else {
          if (name === 'a' && !ignored) {
            var href = /\bhref\s*=\s*(["'])(.*?)\1/i.exec(tag);
            if (href) {
              var offset = href.index + href[0].indexOf(href[1]) + 1;
              var beginHref = lt + offset, endHref = beginHref + href[2].length;
              out.push({
                id: 'H:' + beginHref, kind: 'href',
                label: 'Link address ' + (out.length + 1),
                start: beginHref, end: endHref,
                quote: href[1], original: href[2], value: decodeText(href[2])
              });
            }
          }
          if (!/\/\s*>$/.test(tag) &&
              !/^(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$/.test(name)) {
            stack.push(name);
          }
        }
      }
      at = next;
    }
    return out;
  }
  function editedFields(page) {
    return page.runs.filter(function (run) { return page.edits.has(run.id); });
  }
  function validateNavigation(doc) {
    var slugs = ['new-players', 'rules', 'apply'];
    if (!doc || doc.format !== 'naxx-navigation-v1' || !Array.isArray(doc.pages) ||
        doc.pages.length !== slugs.length) throw new Error('Unrecognised navigation data.');
    if (Object.keys(doc).sort().join(',') !== 'format,pages') throw new Error('Unexpected navigation metadata.');
    doc.pages.forEach(function (p, i) {
      if (!p || p.slug !== slugs[i] || p.group !== 'General') throw new Error('Navigation routes and group cannot change.');
      if (Object.keys(p).sort().join(',') !== 'group,icon,intro,label,slug,title') throw new Error('Unexpected navigation fields.');
      ['label', 'title', 'intro'].forEach(function (field) {
        var v = p[field], max = field === 'intro' ? 280 : field === 'title' ? 90 : 50;
        if (typeof v !== 'string' || !v.trim() || v.length > max || /[\x00-\x1f\x7f]/.test(v)) {
          throw new Error('Invalid ' + field + ' for ' + p.slug + '.');
        }
      });
      if (typeof p.icon !== 'string' || p.icon.length > 90 || !/^[a-z0-9_]+\.jpg$/i.test(p.icon)) {
        throw new Error('Icon must be an existing WoW icon JPG filename, not a URL.');
      }
    });
    return doc;
  }
  function navEditCount() {
    if (!navState) return 0;
    return navState.current.pages.reduce(function (total, p, i) {
      return total + ['label', 'title', 'intro', 'icon'].filter(function (field) {
        return p[field] !== navState.original.pages[i][field];
      }).length;
    }, 0);
  }
  function showNavigation() {
    var index = Number($('nav-page').value || 0), p = navState && navState.current.pages[index];
    ['label', 'title', 'intro', 'icon'].forEach(function (field) {
      var input = $('nav-' + field);
      input.disabled = !p;
      input.value = p ? p[field] : '';
    });
  }
  function hasChanges() {
    return navEditCount() > 0 ||
      Array.from(state.values()).some(function (page) { return editedFields(page).length > 0; });
  }
  function setButtons() {
    var ready = state.size === PATHS.length && !!navState;
    var changed = hasChanges();
    $('save-draft').disabled = !ready || !changed;
    $('export-changes').disabled = !ready || !changed;
    $('load-draft').disabled = !ready;
    $('preview-page').disabled = !ready;
    $('revert-page').disabled = !ready || !editedFields(state.get(activePath)).length;
    $('revert-nav').disabled = !ready || !navEditCount();
    $('revert-all').disabled = !ready || !changed;
    if (!$('preview-wrap').hidden) {
      $('preview-caption').textContent = 'Edits may have changed. Press Preview Current Page to refresh this offline snapshot.';
    }
    $('changed-count').textContent = (navEditCount() + Array.from(state.values()).reduce(function (total, page) {
      return total + editedFields(page).length;
    }, 0)) + ' edits not yet exported';
  }
  function showFields() {
    fields.replaceChildren();
    var page = state.get(activePath);
    $('page-title').textContent = TITLES[activePath] + (page ? ' — ' + page.runs.length + ' editable pieces' : '');
    if (!page) {
      var p = document.createElement('p');
      p.textContent = 'Choose your extracted Naxxramas-Resource-Hub folder to load the pages.';
      fields.appendChild(p);
      return;
    }
    var search = $('search').value.trim().toLowerCase();
    var changedOnly = $('show-changed-only').checked;
    var shown = 0;
    page.runs.forEach(function (run) {
      var current = page.edits.has(run.id) ? page.edits.get(run.id) : run.value;
      if (changedOnly && !page.edits.has(run.id)) return;
      if (search && !(run.value + ' ' + run.label + ' ' + current).toLowerCase().includes(search)) return;
      shown++;
      var holder = document.createElement('div');
      holder.className = 'field';
      var label = document.createElement('label');
      var id = 'edit-' + shown;
      var displayLabel = run.label + ' — ' + run.value.replace(/\s+/g, ' ').slice(0, 75);
      label.htmlFor = id;
      label.textContent = displayLabel + (page.edits.has(run.id) ? ' • CHANGED' : '');
      var input = document.createElement(run.kind === 'href' ? 'input' : 'textarea');
      input.id = id;
      input.value = current;
      if (run.kind === 'href') input.type = 'text';
      else input.rows = Math.min(5, Math.max(2, Math.ceil(run.value.length / 95)));
      input.spellcheck = true;
      input.addEventListener('input', function () {
        if (input.value === run.value) page.edits.delete(run.id);
        else page.edits.set(run.id, input.value);
        label.textContent = displayLabel + (page.edits.has(run.id) ? ' • CHANGED' : '');
        holder.classList.toggle('edited', page.edits.has(run.id));
        setButtons();
      });
      holder.classList.toggle('edited', page.edits.has(run.id));
      holder.append(label, input);
      fields.appendChild(holder);
    });
    if (!shown) {
      var empty = document.createElement('p');
      empty.textContent = changedOnly ? 'No changed fields match this view.' : 'Nothing matches that search. Try a different word.';
      fields.appendChild(empty);
    }
  }
  function applyPage(page) {
    var result = page.source;
    var changes = editedFields(page).sort(function (a, b) { return b.start - a.start; });
    changes.forEach(function (run) {
      if (result.slice(run.start, run.end) !== run.original) throw new Error('Page source no longer matches the imported file.');
      var value = page.edits.get(run.id);
      if (value.length > 30000) throw new Error('An edited field is too long.');
      if (run.kind === 'href' && !validHref(value)) throw new Error('Invalid or unsafe link: ' + value);
      var encoded = run.kind === 'href' ? escapeAttr(value, run.quote) : escapeText(value);
      result = result.slice(0, run.start) + encoded + result.slice(run.end);
    });
    return result;
  }
  async function importFolder(fileList) {
    var matches = new Map();
    for (var i = 0; i < fileList.length; i++) {
      var file = fileList[i];
      var relative = (file.webkitRelativePath || file.name).replace(/\\/g, '/');
      PATHS.forEach(function (path) {
        if (relative === path || relative.endsWith('/' + path)) {
          if (matches.has(path)) throw new Error('Found two copies of ' + path + '. Choose one repository folder.');
          matches.set(path, file);
        }
      });
      if (relative === NAV_PATH || relative.endsWith('/' + NAV_PATH)) {
        if (matches.has(NAV_PATH)) throw new Error('Found multiple navigation.json files.');
        matches.set(NAV_PATH, file);
      }
    }
    if (matches.size !== PATHS.length + 1) {
      throw new Error('The folder must include the four HTML pages AND content/navigation.json.');
    }
    var next = new Map();
    for (var j = 0; j < PATHS.length; j++) {
      var path = PATHS[j];
      var source = await matches.get(path).text();
      if (source.length > 2 * 1024 * 1024) throw new Error(path + ' is unexpectedly large.');
      var runs = scan(source);
      if (runs.length < 10) throw new Error(path + ' does not look like the expected HTML page.');
      next.set(path, { source: source, hash: await NaxxEditorZip.sha256(source), runs: runs, edits: new Map() });
    }
    var navSource = await matches.get(NAV_PATH).text();
    if (navSource.length > 64000) throw new Error('Navigation configuration is unexpectedly large.');
    var nav = validateNavigation(JSON.parse(navSource));
    navState = {
      source: navSource, hash: await NaxxEditorZip.sha256(navSource),
      original: nav, current: JSON.parse(JSON.stringify(nav))
    };
    state = next;
    $('preview-wrap').hidden = true;
    $('preview-frame').removeAttribute('srcdoc');
    showFields();
    showNavigation();
    setButtons();
    say('Four HTML pages and navigation loaded locally. Nothing has been published.');
  }
  function draftData() {
    return {
      format: 'naxx-local-draft-v3',
      sourceBranchHint: SOURCE_BRANCH,
      sourceCommitVerified: false,
      createdAt: new Date().toISOString(),
      files: PATHS.map(function (path) {
        var page = state.get(path);
        return { path: path, sourceSha256: page.hash, edits: Object.fromEntries(page.edits) };
      }),
      navigation: {
        path: NAV_PATH,
        sourceSha256: navState.hash,
        document: navState.current
      }
    };
  }
  async function exportChanged() {
    var files = [], manifest = {
      format: 'naxx-changed-files-v3',
      sourceBranchHint: SOURCE_BRANCH,
      sourceCommitVerified: false,
      generatedAt: new Date().toISOString(),
      files: []
    };
    for (var i = 0; i < PATHS.length; i++) {
      var path = PATHS[i], page = state.get(path);
      if (!editedFields(page).length) continue;
      var updated = applyPage(page);
      scan(updated); // Validate tokenisation; intentionally blank text fields are permitted.
      var originalHash = page.hash, updatedHash = await NaxxEditorZip.sha256(updated);
      files.push({ path: path, content: updated });
      manifest.files.push({ path: path, sourceSha256: originalHash, exportedSha256: updatedHash, editedPieces: editedFields(page).length });
    }
    if (navEditCount() > 0) {
      var validated = validateNavigation(navState.current);
      var updatedNav = JSON.stringify(validated, null, 2) + '\n';
      files.push({ path: NAV_PATH, content: updatedNav });
      manifest.files.push({
        path: NAV_PATH,
        sourceSha256: navState.hash,
        exportedSha256: await NaxxEditorZip.sha256(updatedNav),
        editedPieces: navEditCount()
      });
    }
    if (!files.length) throw new Error('No changed pages to export.');
    files.unshift({ path: 'UPDATE-MANIFEST.json', content: JSON.stringify(manifest, null, 2) + '\n' });
    files.push({ path: 'HOW_TO_APPLY.txt', content:
      'NAXXRAMAS EDITOR - REVIEW REQUIRED\n\n' +
      'This ZIP has NOT updated GitHub or the live website.\n' +
      '1. Open a disposable clone of the Naxxramas-Resource-Hub repository.\n' +
      '2. Create a NEW development branch, not main.\n' +
      '3. Compare the original file hashes in UPDATE-MANIFEST.json with your checkout.\n' +
      '4. If anything has changed since export, STOP and reconcile before copying.\n' +
      '5. Copy only included HTML/JSON files to their SAME relative paths.\n' +
      '6. Review the diff and site preview; run all website checks.\n' +
      '7. Open a pull request for approval. Do not overwrite root index.html.\n' +
      'Source branch hint for this prototype: ' + SOURCE_BRANCH + '\n' +
      'The selected folder is not cryptographically verified against any Git commit.\n'
    });
    download(NaxxEditorZip.makeZip(files), 'Naxxramas-Website-Changed-Files.zip');
    say('Changed-files ZIP created with ' + manifest.files.length + ' file(s). This is NOT published to GitHub.');
  }

  filePicker.addEventListener('change', async function () {
    if (hasChanges() && !window.confirm(
      'Load a different folder and discard your current local edits? Save Draft first if needed.'
    )) {
      filePicker.value = '';
      say('Folder change cancelled. Your current edits are still here.');
      return;
    }
    try {
      say('Reading the selected local folder…');
      await importFolder(filePicker.files);
    } catch (err) {
      // Import runs in a temporary map; a failed folder selection must not
      // discard an already loaded page collection or its unsaved edits.
      filePicker.value = '';
      setButtons();
      say('Folder not loaded: ' + err.message + ' Existing editor content was kept.', true);
    }
  });
  $('page').addEventListener('change', function () {
    activePath = this.value;
    $('preview-wrap').hidden = true;
    $('preview-frame').removeAttribute('srcdoc');
    showFields();
    setButtons();
  });
  $('search').addEventListener('input', showFields);
  $('show-changed-only').addEventListener('change', showFields);
  $('save-draft').addEventListener('click', function () {
    if (!hasChanges()) return;
    download(new Blob([JSON.stringify(draftData(), null, 2) + '\n'], { type: 'application/json' }), 'Naxxramas-Editor-Draft.json');
    say('Local draft downloaded. This is NOT a website update or GitHub backup.');
  });
  $('load-draft').addEventListener('click', function () { draftPicker.click(); });
  // The same source-bound import is used by the manual JSON picker and
  // the private ZIP recovery buttons. Validation finishes BEFORE any edits
  // are replaced; an owner cancellation preserves every existing edit.
  function restorePageDraftText(text) {
    if (typeof text !== 'string' || text.length === 0 || text.length > 16 * 1024 * 1024)
      throw new Error('The saved page draft is empty or too large.');
    if (state.size !== PATHS.length || !navState)
      throw new Error('Load the four original pages and navigation before restoring a draft.');
    var draft = JSON.parse(text);
    if (draft.format !== 'naxx-local-draft-v3' || !Array.isArray(draft.files) ||
        draft.files.length !== PATHS.length || draft.sourceCommitVerified !== false)
      throw new Error('Unrecognised draft format.');
    var replacements = new Map();
    draft.files.forEach(function (file) {
      var page = state.get(file.path);
      if (!page || replacements.has(file.path) || file.sourceSha256 !== page.hash ||
          !file.edits || typeof file.edits !== 'object' || Array.isArray(file.edits))
        throw new Error('Draft does not match the selected repository files. Nothing was loaded.');
      var edits = new Map();
      Object.entries(file.edits).forEach(function (entry) {
        var run = page.runs.find(function (candidate) { return candidate.id === entry[0]; });
        if (!run || typeof entry[1] !== 'string' || entry[1].length > 30000 ||
            (run.kind === 'href' && !validHref(entry[1])))
          throw new Error('Draft contains invalid or unsafe edit data.');
        if (entry[1] !== run.value) edits.set(run.id, entry[1]);
      });
      replacements.set(file.path, edits);
    });
    if (!draft.navigation || draft.navigation.path !== NAV_PATH ||
        draft.navigation.sourceSha256 !== navState.hash)
      throw new Error('The saved navigation draft does not match the selected folder.');
    var imported = validateNavigation(draft.navigation.document);
    var restoredNav = {
      format: 'naxx-navigation-v1',
      pages: navState.original.pages.map(function (p, i) {
        var saved = imported.pages[i];
        return {
          slug: p.slug, label: saved.label, title: saved.title,
          group: p.group, icon: saved.icon, intro: saved.intro
        };
      })
    };
    if (replacements.size !== PATHS.length)
      throw new Error('Draft has missing or duplicate page edits.');
    if (hasChanges() && !window.confirm(
      'Replace your current unsaved page and navigation edits with the saved draft? Download your current draft first if needed.'
    )) {
      say('Draft loading cancelled. Your current page and navigation edits were kept.');
      return false;
    }
    PATHS.forEach(function (path) { state.get(path).edits = replacements.get(path); });
    navState.current = restoredNav;
    $('preview-wrap').hidden = true;
    $('preview-frame').removeAttribute('srcdoc');
    showFields();
    showNavigation();
    setButtons();
    say('Draft restored locally after checking the original files. Nothing was published.');
    return true;
  }
  draftPicker.addEventListener('change', async function () {
    var file = draftPicker.files && draftPicker.files[0];
    if (!file) return;
    try {
      if (file.size > 16 * 1024 * 1024)
        throw new Error('The saved page draft is unexpectedly large.');
      restorePageDraftText(await file.text());
    } catch (err) { say('Page draft rejected: ' + err.message, true); }
    finally { draftPicker.value = ''; }
  });
  $('export-changes').addEventListener('click', async function () {
    try { await exportChanged(); }
    catch (err) { say(err.message, true); }
  });
  $('preview-page').addEventListener('click', function () {
    if (state.size !== PATHS.length || !navState) return;
    try {
      var page = state.get(activePath);
      var html = applyPage(page);
      var selected = navState.current.pages.find(function (item) {
        return activePath === item.slug + '/content.html';
      });
      var title = selected ? selected.title : TITLES[activePath];
      $('preview-frame').srcdoc = NaxxEditorPreview.render(html, title);
      $('preview-wrap').hidden = false;
      $('preview-caption').textContent =
        'Offline approximation of ' + TITLES[activePath] + '. Scripts, external images and form uploads are disabled.';
      say('Offline preview refreshed. Nothing was uploaded, published or saved.');
    } catch (err) { say(err.message, true); }
  });
  $('revert-page').addEventListener('click', function () {
    var page = state.get(activePath);
    if (!page || !editedFields(page).length) return;
    if (!window.confirm('Discard the current page edits for ' + TITLES[activePath] + '?')) return;
    page.edits.clear();
    showFields();
    setButtons();
    say('Current page edits reverted locally. Other pages and navigation are unchanged.');
  });
  $('revert-nav').addEventListener('click', function () {
    if (!navState || !navEditCount()) return;
    if (!window.confirm('Discard your navigation label and icon edits?')) return;
    navState.current = JSON.parse(JSON.stringify(navState.original));
    showNavigation();
    setButtons();
    say('Navigation edits reverted locally. HTML page edits are unchanged.');
  });
  $('revert-all').addEventListener('click', function () {
    if (!hasChanges()) return;
    if (!window.confirm('Discard ALL local edits to HTML pages and navigation? Download a draft first if you need them.')) return;
    state.forEach(function (page) { page.edits.clear(); });
    navState.current = JSON.parse(JSON.stringify(navState.original));
    showFields();
    showNavigation();
    $('preview-wrap').hidden = true;
    $('preview-frame').removeAttribute('srcdoc');
    setButtons();
    say('All local edits reverted to the selected folder. No website files were changed.');
  });
  PATHS.forEach(function (path) {
    var option = document.createElement('option');
    option.value = path;
    option.textContent = TITLES[path];
    $('page').appendChild(option);
  });
  ['new-players', 'rules', 'apply'].forEach(function (slug, i) {
    var option = document.createElement('option');
    option.value = String(i);
    option.textContent = { 'new-players': 'New Players', rules: 'Server Rules', apply: 'Apply to Join' }[slug];
    $('nav-page').appendChild(option);
  });
  $('nav-page').addEventListener('change', function () { showNavigation(); setButtons(); });
  ['label', 'title', 'intro', 'icon'].forEach(function (field) {
    $('nav-' + field).addEventListener('input', function () {
      if (!navState) return;
      var index = Number($('nav-page').value || 0);
      var page = navState.current.pages[index];
      if (!page) return;
      page[field] = this.value;
      setButtons();
    });
  });
  // Read-only bridge for a PRIVATE review package only. No file outputs or
  // GitHub publication; drafts retain exact original-page fingerprint checks.
  window.NaxxLocalPageReview = Object.freeze({
    getDraft: function () {
      if (state.size !== PATHS.length || !navState) return null;
      if (!hasChanges()) return null;
      return draftData();
    },
    restoreDraftText: restorePageDraftText
  });
  setButtons();
  showFields();
  showNavigation();
})();
