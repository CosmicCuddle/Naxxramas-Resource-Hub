/* Naxxramas editor GitHub Save client — development transport only.
 * No GitHub credentials in the browser, no direct GitHub API calls, and no
 * publication. Requires an independently reviewed LOCAL server implementing
 * /api/editor/status and /api/editor/save before Save can be enabled.
 */
(function (root) {
  'use strict';
  var EXPECTED_REPOSITORY = 'CosmicCuddle/Naxxramas-Resource-Hub';
  var SHA = /^[0-9a-f]{40}(?:[0-9a-f]{24})?$/;
  var SHA256 = /^[0-9a-f]{64}$/;
  var BRANCH = /^editor-saves\/[a-z0-9][a-z0-9._/-]{0,100}$/;
  var MAX_PACKAGE_BYTES = 8 * 1024 * 1024;

  function allowedHost(location) {
    return !!location && location.protocol === 'http:' &&
      (location.hostname === '127.0.0.1' || location.hostname === 'localhost' ||
       location.hostname === '[::1]');
  }
  function safeBranch(branch) {
    return typeof branch === 'string' && BRANCH.test(branch) &&
      !branch.includes('..') && !branch.includes('//') &&
      !branch.endsWith('.') && !branch.endsWith('/') &&
      !branch.split('/').some(function (part) { return part.endsWith('.lock'); });
  }
  function validateCapability(data) {
    if (!data || data.format !== 'naxx-editor-local-save-capability-v1' ||
        data.ready !== true || data.authenticated !== true ||
        data.repository !== EXPECTED_REPOSITORY ||
        data.publishDisabled !== true || data.backupVerified !== true ||
        data.exactOldHeadEnforced !== true ||
        !safeBranch(data.branch) || !SHA.test(data.expectedHead)) {
      throw Error('The trusted Save service is not ready for a protected development-branch Save.');
    }
    return Object.freeze({branch: data.branch, expectedHead: data.expectedHead});
  }
  function validateReceipt(data, capability) {
    if (!data || data.format !== 'naxx-editor-local-save-result-v1' ||
        data.result !== 'saved-and-independently-verified' ||
        data.repository !== EXPECTED_REPOSITORY ||
        data.branch !== capability.branch ||
        data.parentCommit !== capability.expectedHead ||
        !SHA.test(data.commit) || data.commit === data.parentCommit ||
        !SHA256.test(data.fullSiteSha256) ||
        data.remoteRefVerified !== true || data.sourceFilesVerified !== true ||
        data.backupVerified !== true || data.published !== false) {
      throw Error('Save response was not independently verified. Retain your local drafts.');
    }
    return Object.freeze({branch: data.branch, commit: data.commit,
      fullSiteSha256: data.fullSiteSha256, published: false});
  }
  async function jsonReply(response) {
    if (!response || !response.ok || typeof response.json !== 'function')
      throw Error('The trusted Save service did not return an approved response.');
    return response.json();
  }
  async function connect(location, fetchFn) {
    if (!allowedHost(location))
      throw Error('Open the editor using the trusted local Save service. File downloads still work without it.');
    if (typeof fetchFn !== 'function') throw Error('Browser network support is unavailable.');
    var response = await fetchFn('/api/editor/status', {
      method: 'GET', cache: 'no-store', credentials: 'same-origin', redirect: 'error'
    });
    return validateCapability(await jsonReply(response));
  }
  async function save(options) {
    var location = options && options.location;
    if (!allowedHost(location))throw Error('Save needs the trusted local editor service.');
    var fetchFn = options.fetchFn;
    if (typeof fetchFn !== 'function' || typeof options.build !== 'function' ||
        typeof options.getPageDraft !== 'function' ||
        typeof options.getResourceDraft !== 'function')
      throw Error('The source-checked editor Save components are unavailable.');
    // Fetch a fresh capability immediately before building and sending a draft.
    var capability = await connect(location, fetchFn);
    var page = options.getPageDraft(), resource = options.getResourceDraft();
    var packageResult = await options.build(page, resource, options.zipTools);
    if (!packageResult || !(packageResult.blob instanceof Blob) ||
        packageResult.blob.size < 22 ||
        packageResult.blob.size > MAX_PACKAGE_BYTES ||
        !packageResult.manifest || packageResult.manifest.githubReady !== false ||
        packageResult.manifest.publishable !== false)
      throw Error('A safe, bounded private editing package could not be prepared.');
    var response;
    try {
      response = await fetchFn('/api/editor/save', {
        method: 'POST', cache: 'no-store', credentials: 'same-origin',
        redirect: 'error', headers: {
          'Content-Type': 'application/zip',
          'X-Naxx-Editor-Protocol': 'naxx-local-save-v1',
          'X-Naxx-Expected-Head': capability.expectedHead
        }, body: packageResult.blob
      });
      return validateReceipt(await jsonReply(response), capability);
    } catch (_) {
      // Any failed, malformed or lost response could follow an unseen write.
      // Never retry automatically, silently discard the draft or claim Saved.
      throw Error('Save result is uncertain or refused. Keep all local edits and do NOT retry automatically. Check the development branch before another Save.');
    }
  }

  var api = Object.freeze({allowedHost: allowedHost, safeBranch: safeBranch,
    validateCapability: validateCapability, validateReceipt: validateReceipt,
    connect: connect, save: save});
  root.NaxxGitHubSaveClient = api;
  if (typeof module !== 'undefined' && module.exports)module.exports = api;

  if (typeof document === 'undefined') return;
  var button = document.getElementById('github-save');
  var check = document.getElementById('github-check-connection');
  var status = document.getElementById('github-save-status');
  if (!button || !check || !status) return;
  var busy = false, ready = false;
  function notice(message, error) {
    status.textContent = message;
    status.classList.toggle('error', !!error);
  }
  async function updateConnection() {
    ready = false;
    button.disabled = true;
    if (!allowedHost(root.location)) {
      notice('Direct GitHub Save requires a trusted local service, not an ordinary downloaded HTML file. Draft downloads remain available.', false);
      return;
    }
    try {
      var capability = await connect(root.location, root.fetch.bind(root));
      ready = true;
      button.disabled = false;
      notice('Development branch ' + capability.branch + ' is ready for a protected Save. Publishing is separate.', false);
    } catch (_) {
      notice('No verified Save connection yet. Your existing local drafts are safe and can still be downloaded.', true);
    }
  }
  check.addEventListener('click', function () { if (!busy)updateConnection(); });
  button.addEventListener('click', async function () {
    if (busy || !ready) return;
    busy = true;button.disabled = true;check.disabled = true;
    notice('Checking your edits and protected Save connection…', false);
    try {
      var pages = root.NaxxLocalPageReview;
      var resources = root.NaxxLocalResourceReview;
      var review = root.NaxxEditorReview;
      if (!pages || !resources || !review || !root.NaxxEditorZip)
        throw Error('Original draft editors have not loaded.');
      var result = await save({location: root.location, fetchFn: root.fetch.bind(root),
        getPageDraft: pages.getDraft, getResourceDraft: resources.getDraft,
        build: review.build, zipTools: root.NaxxEditorZip});
      notice('Saved and independently verified on development branch ' + result.branch +
        '. Your public website was NOT published. Keep your draft until you review this change.', false);
      ready = false; // Force a fresh remote check before another Save.
    } catch (error) {
      ready = false;
      notice((error && error.message) || 'Save unavailable. Local drafts were kept.', true);
    } finally {
      busy = false;check.disabled = false;button.disabled = true;
    }
  });
  updateConnection();
})(typeof window === 'undefined' ? globalThis : window);
