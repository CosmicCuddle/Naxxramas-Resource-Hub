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
  var TOKEN = /^[a-f0-9]{64}$/;

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
        !safeBranch(data.branch) || !SHA.test(data.expectedHead) ||
        !TOKEN.test(data.csrfToken)) {
      throw Error('The trusted Save service is not ready for a protected development-branch Save.');
    }
    return Object.freeze({branch: data.branch, expectedHead: data.expectedHead,
      csrfToken: data.csrfToken});
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
  async function readStatus(location, fetchFn) {
    if (!allowedHost(location))
      throw Error('Open the editor using the trusted local Save service. File downloads still work without it.');
    if (typeof fetchFn !== 'function') throw Error('Browser network support is unavailable.');
    var response = await fetchFn('/api/editor/status', {
      method: 'GET', cache: 'no-store', credentials: 'same-origin', redirect: 'error'
    });
    var data = await jsonReply(response);
    if (!data || data.format !== 'naxx-editor-local-save-capability-v1' ||
        data.repository !== EXPECTED_REPOSITORY ||
        data.publishDisabled !== true || !TOKEN.test(data.csrfToken))
      throw Error('The local editor connection did not match the protected protocol.');
    return data;
  }
  async function connect(location, fetchFn) {
    return validateCapability(await readStatus(location, fetchFn));
  }
  function editSignature(page, resource) {
    // Ignore page-draft creation timestamps: they change on each getDraft().
    return JSON.stringify({
      files: page ? page.files : null,
      navigation: page ? page.navigation : null,
      resources: resource ? resource.changes : null
    });
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
    var capturedSignature = editSignature(page, resource);
    var packageResult = await options.build(page, resource, options.zipTools);
    if (!packageResult || !(packageResult.blob instanceof Blob) ||
        packageResult.blob.size < 22 ||
        packageResult.blob.size > MAX_PACKAGE_BYTES ||
        !packageResult.manifest || packageResult.manifest.githubReady !== false ||
        packageResult.manifest.publishable !== false)
      throw Error('A safe, bounded private editing package could not be prepared.');
    var response, verified;
    try {
      response = await fetchFn('/api/editor/save', {
        method: 'POST', cache: 'no-store', credentials: 'same-origin',
        redirect: 'error', headers: {
          'Content-Type': 'application/zip',
          'X-Naxx-Editor-Protocol': 'naxx-local-save-v1',
          'X-Naxx-Expected-Head': capability.expectedHead,
          'X-Naxx-Csrf-Token': capability.csrfToken
        }, body: packageResult.blob
      });
      verified = validateReceipt(await jsonReply(response), capability);
    } catch (_) {
      // Any failed, malformed or lost response could follow an unseen write.
      // Never retry automatically, silently discard the draft or claim Saved.
      throw Error('Save result is uncertain or refused. Keep all local edits and do NOT retry automatically. Check the development branch before another Save.');
    }
    var changedDuringSave = true;
    try {
      changedDuringSave = editSignature(options.getPageDraft(),
        options.getResourceDraft()) !== capturedSignature;
    } catch (_) {
      // New unapplied text also means the owner has edits not in this Save.
    }
    return Object.freeze({...verified, changedDuringSave: changedDuringSave});
  }

  function validateReviewResult(data) {
    if (!data || data.format !== 'naxx-editor-local-review-result-v1' ||
        data.reviewOnly !== true || data.sourceChecked !== true ||
        data.gitHubWrite !== false || data.published !== false ||
        !SHA.test(data.expectedGitCommit) ||
        data.checkedResourceCount !== 414 ||
        !Number.isInteger(data.changedResources) ||
        !Number.isInteger(data.changedPageAndNavigationFiles) ||
        data.changedResources < 0 || data.changedResources > 414 ||
        data.changedPageAndNavigationFiles < 0 ||
        data.changedPageAndNavigationFiles > 5 ||
        data.changedResources + data.changedPageAndNavigationFiles < 1)
      throw Error('The source review response was not a verified, read-only result.');
    return Object.freeze({
      expectedGitCommit:data.expectedGitCommit,
      changedResources:data.changedResources,
      changedPageAndNavigationFiles:data.changedPageAndNavigationFiles,
      published:false,reviewOnly:true
    });
  }
  async function reviewChanges(options) {
    var location=options && options.location;
    if (!allowedHost(location) || typeof options.fetchFn !== 'function' ||
        typeof options.build !== 'function' ||
        typeof options.getPageDraft !== 'function' ||
        typeof options.getResourceDraft !== 'function')
      throw Error('Source review requires the protected local editor components.');
    var capability=await readStatus(location,options.fetchFn);
    if (capability.reviewReady !== true)
      throw Error('The local source-review service is not ready.');
    var pages=options.getPageDraft(), resources=options.getResourceDraft();
    var captured=editSignature(pages,resources);
    var prepared=await options.build(pages,resources,options.zipTools);
    if (!prepared || !(prepared.blob instanceof Blob) ||
        prepared.blob.size < 22 || prepared.blob.size > MAX_PACKAGE_BYTES ||
        !prepared.manifest || prepared.manifest.publishable !== false ||
        prepared.manifest.githubReady !== false)
      throw Error('The local review ZIP was not verified before sending.');
    var result;
    try {
      var response=await options.fetchFn('/api/editor/review',{
        method:'POST',cache:'no-store',credentials:'same-origin',
        redirect:'error',headers:{
          'Content-Type':'application/zip',
          'X-Naxx-Editor-Protocol':'naxx-local-review-v1',
          'X-Naxx-Csrf-Token':capability.csrfToken
        },body:prepared.blob
      });
      result=validateReviewResult(await jsonReply(response));
    }catch(_) {
      throw Error('Local source review failed. Nothing was saved. Keep your existing drafts.');
    }
    var changedDuringReview=true;
    try {
      changedDuringReview=editSignature(options.getPageDraft(),
        options.getResourceDraft())!==captured;
    }catch(_){/* Unapplied input may not be represented in the captured ZIP. */}
    return Object.freeze({...result,changedDuringReview:changedDuringReview});
  }
  var api = Object.freeze({allowedHost: allowedHost, safeBranch: safeBranch,
    validateCapability: validateCapability, validateReceipt: validateReceipt,
    readStatus:readStatus,connect: connect, save: save,
    validateReviewResult:validateReviewResult,reviewChanges:reviewChanges});
  root.NaxxGitHubSaveClient = api;
  if (typeof module !== 'undefined' && module.exports)module.exports = api;

  if (typeof document === 'undefined') return;
  var button = document.getElementById('github-save');
  var check = document.getElementById('github-check-connection');
  var reviewButton = document.getElementById('github-review');
  var status = document.getElementById('github-save-status');
  if (!button || !check || !reviewButton || !status) return;
  var busy = false, ready = false, canReview = false;
  function notice(message, error) {
    status.textContent = message;
    status.classList.toggle('error', !!error);
  }
  async function updateConnection() {
    ready = false;canReview = false;
    button.disabled = true;reviewButton.disabled = true;
    if (!allowedHost(root.location)) {
      notice('Direct GitHub Save requires a trusted local service, not an ordinary downloaded HTML file. Draft downloads remain available.', false);
      return;
    }
    try {
      var statusInfo = await readStatus(root.location, root.fetch.bind(root));
      canReview = statusInfo.reviewReady === true;
      reviewButton.disabled = !canReview;
      if (statusInfo.ready === true) {
        var capability = validateCapability(statusInfo);
        ready = true;button.disabled = false;
        notice('Development branch ' + capability.branch +
          ' is ready for a protected Save. Publishing remains separate.', false);
      } else if (canReview) {
        notice('Local source review is available. Save to GitHub is still disabled; you can check your edits without publishing.', false);
      } else {
        notice('No verified Save connection yet. Private local drafts are still available.', true);
      }
    } catch (_) {
      notice('No verified local editor connection yet. Existing drafts can still be downloaded.', true);
    }
  }
  check.addEventListener('click', function () { if (!busy)updateConnection(); });
  reviewButton.addEventListener('click',async function(){
    if (busy || !canReview) return;
    busy = true;
    reviewButton.disabled = true;check.disabled = true;button.disabled = true;
    notice('Reviewing your edits against the protected source files…',false);
    try {
      var pages=root.NaxxLocalPageReview,resources=root.NaxxLocalResourceReview;
      var draftReview=root.NaxxEditorReview;
      if (!pages || !resources || !draftReview || !root.NaxxEditorZip)
        throw Error('Original draft editors have not loaded.');
      var result=await reviewChanges({location:root.location,
        fetchFn:root.fetch.bind(root),getPageDraft:pages.getDraft,
        getResourceDraft:resources.getDraft,
        build:draftReview.build,zipTools:root.NaxxEditorZip});
      notice('Source review passed: ' + result.changedResources +
        ' resource(s), ' + result.changedPageAndNavigationFiles +
        ' page/navigation file(s). ' +
        (result.changedDuringReview ?
          'New edits made during review are NOT included. ' : '') +
        'This is NOT a GitHub Save or publication.', false);
    }catch(error){
      notice((error && error.message) || 'Source review refused. Local drafts were kept.',true);
    }finally{
      busy=false;check.disabled=false;
      button.disabled=!ready;reviewButton.disabled=!canReview;
    }
  });
  button.addEventListener('click', async function () {
    if (busy || !ready) return;
    busy = true;button.disabled = true;reviewButton.disabled = true;check.disabled = true;
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
      notice((result.changedDuringSave ?
        'An earlier draft was saved; edits made during Save are NOT stored. ' :
        'Saved and independently verified. ') +
        'Development branch: ' + result.branch +
        '. Your public website was NOT published. Keep your draft until you review this change.', false);
      ready = false; // Force a fresh remote check before another Save.
    } catch (error) {
      ready = false;
      notice((error && error.message) || 'Save unavailable. Local drafts were kept.', true);
    } finally {
      busy = false;check.disabled = false;button.disabled = true;
      reviewButton.disabled = !canReview;
    }
  });
  updateConnection();
})(typeof window === 'undefined' ? globalThis : window);
