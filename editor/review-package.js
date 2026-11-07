/* PRIVATE local review package (not GitHub-ready, no source HTML writes).
 * One ZIP contains separately named page/navigation and resource draft files.
 * Strict review-only names are enforced by NaxxEditorZip.makeReviewZip.
 */
(function(root){
  'use strict';
  var MANIFEST='REVIEW-MANIFEST.json',PAGES='REVIEW-PAGE-DRAFT.json';
  var RESOURCES='REVIEW-RESOURCE-DRAFT.json',INSTRUCTIONS='READ_ME_FIRST.txt';
  var EXPECTED_PATHS=[
    'new-players/content.html','rules/content.html',
    'apply/content.html','game-clients/content.html'
  ];
  var RESOURCE_BASELINE='34455f6d901c538e2491a8c16681692e4c02d918b1984d7d0ba081aacb1049e8';
  var shaPattern=/^[a-f0-9]{64}$/;
  // Mirror the existing page editor's three supported navigation entries.
  // This checks ZIP payload shape before accepting a review draft, but it
  // cannot authenticate a source checkout or authorise publication.
  function validNavigationDocument(doc){
    var slugs=['new-players','rules','apply'];
    if(!doc||typeof doc!=='object'||Array.isArray(doc)||
       Object.keys(doc).sort().join(',')!=='format,pages'||
       doc.format!=='naxx-navigation-v1'||!Array.isArray(doc.pages)||
       doc.pages.length!==slugs.length)return false;
    return doc.pages.every(function(p,i){
      if(!p||typeof p!=='object'||Array.isArray(p)||
         Object.keys(p).sort().join(',')!=='group,icon,intro,label,slug,title'||
         p.slug!==slugs[i]||p.group!=='General')return false;
      for(var field of ['label','title','intro']){
        var value=p[field];
        var max=field==='intro'?280:field==='title'?90:50;
        if(typeof value!=='string'||!value.trim()||value.length>max||
           /[\x00-\x1f\x7f]/.test(value))return false;
      }
      return typeof p.icon==='string'&&p.icon.length<=90&&
        /^[a-z0-9_]+\.jpg$/i.test(p.icon);
    });
  }
  function validatePageDraft(draft){
    if(draft==null)return null;
    if(!draft||draft.format!=='naxx-local-draft-v3'||
       draft.sourceCommitVerified!==false||!Array.isArray(draft.files)||
       draft.files.length!==4||!draft.navigation||
       draft.navigation.path!=='content/navigation.json'||
       !shaPattern.test(draft.navigation.sourceSha256)||
       !validNavigationDocument(draft.navigation.document))
      throw Error('Unrecognised page/navigation draft. Review package not saved.');
    EXPECTED_PATHS.forEach(function(path,index){
      var file=draft.files[index];
      if(!file||file.path!==path||!shaPattern.test(file.sourceSha256)||
         !file.edits||typeof file.edits!=='object'||Array.isArray(file.edits))
        throw Error('Page draft path or original SHA-256 is missing.');
      // A saved ZIP must not call malformed edit payloads "verified" just
      // because its transport CRC and SHA-256 happen to match. The actual
      // editor separately checks each edit against its source-bound token.
      Object.entries(file.edits).forEach(function(entry){
        if(!/^(?:T|H):(?:0|[1-9][0-9]*)$/.test(entry[0])||
           typeof entry[1]!=='string'||entry[1].length>30000)
          throw Error('Page draft contains an invalid edit token or value.');
      });
    });
    return draft;
  }
  function validateResourceDraft(draft){
    if(draft==null)return null;
    if(!draft||draft.format!=='naxx-local-resource-draft-v2'||
       draft.baselineSha256!==RESOURCE_BASELINE||
       !Array.isArray(draft.changes)||draft.changes.length===0||
       draft.changes.length>414)
      throw Error('Unrecognised or empty resource draft. Review package not saved.');
    var seen=new Set();
    draft.changes.forEach(function(edit){
      if(!edit||!Number.isInteger(edit.index)||edit.index<0||edit.index>=414||
         seen.has(edit.index))throw Error('A resource draft position is duplicated or invalid.');
      var keys=Object.keys(edit).sort().join(',');
      if(keys!=='index,title'&&keys!=='content,index'&&keys!=='content,index,title')
        throw Error('Unexpected resource draft field.');
      if(Object.prototype.hasOwnProperty.call(edit,'title')&&
         (typeof edit.title!=='string'||!edit.title.trim()||edit.title.length>160||
          /[<>\x00-\x1f\x7f]/.test(edit.title)))
        throw Error('Unsafe resource title in review draft.');
      if(Object.prototype.hasOwnProperty.call(edit,'content')&&
         (typeof edit.content!=='string'||edit.content.length>30000||
          /[<>\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(edit.content)))
        throw Error('Unsafe resource content in review draft.');
      seen.add(edit.index);
    });
    return draft;
  }
  function instructions(pages,resources){
    return [
      'NAXXRAMAS PRIVATE EDITING REVIEW PACKAGE',
      '',
      'This ZIP is for PRIVATE REVIEW and recovery of local editing drafts.',
      'IT IS NOT a GitHub-ready changed-files export or a full website backup.',
      'DO NOT copy any of these review files into the live website repository.',
      '',
      'Contents:',
      pages ? '- '+PAGES+' : existing 4-page/navigation local JSON draft' : '- No page/navigation draft (no page edits supplied)',
      resources ? '- '+RESOURCES+' : verified original 414-resource title/content JSON draft' : '- No resource draft (no resource edits supplied)',
      '- '+MANIFEST+' : expected files, SHA-256 checksums and verified source fingerprints',
      '- '+INSTRUCTIONS+' : this explanation',
      '',
      'HOW TO RESTORE THE PRIVATE DRAFTS',
      'You can open this ZIP directly using Open a saved combined review ZIP in editor/index.html.',
      'The editor checks the ZIP, then offers Restore Page Draft in Editor and Restore Resource Draft in Editor.',
      'Load the matching original page/navigation folder or original site-content.html FIRST.',
      'The original editor checks source hashes and asks before replacing unsaved edits.',
      'You can also download individual JSON drafts, or extract this ZIP manually.',
      '1. Extract this ZIP into a PRIVATE working folder on your computer if not using the ZIP control.',
      '2. Open editor/index.html from a disposable copy of the reviewed website branch.',
      '3. If included, load REVIEW-PAGE-DRAFT.json using Load Saved Draft in section 5.',
      '4. If included, load REVIEW-RESOURCE-DRAFT.json using Load Resource Draft in section 4.',
      '5. Both editors check their original source files and will stop on a mismatch.',
      '6. Review each edit and do not upload source files, drafts or this ZIP to the public website.',
      '',
      'For a true GitHub update, use a separately approved and reviewed exporter.',
      'For a complete backup, use an independently verified complete repository checkout.',
      'Never replace the small root index.html loader with an old monolithic website export.',
      ''
    ].join('\n');
  }
  async function build(pageDraft,resourceDraft,zipTools){
    if(!zipTools||typeof zipTools.makeReviewZip!=='function'||typeof zipTools.sha256!=='function')
      throw Error('Private review ZIP writer or secure SHA-256 support is unavailable.');
    var pages=validatePageDraft(pageDraft),resources=validateResourceDraft(resourceDraft);
    if(!pages&&!resources)throw Error('No applied page, navigation or resource edits to save.');
    var files=[];
    if(pages)files.push({path:PAGES,content:JSON.stringify(pages,null,2)+'\n'});
    if(resources)files.push({path:RESOURCES,content:JSON.stringify(resources,null,2)+'\n'});
    var descriptors=[];
    for(var i=0;i<files.length;i++){
      var item=files[i];
      descriptors.push({
        path:item.path,sha256:await zipTools.sha256(item.content),
        utf8Bytes:new TextEncoder().encode(item.content).byteLength
      });
    }
    var manifest={
      format:'naxx-private-review-package-v1',
      publishable:false,githubReady:false,fullRepositoryBackup:false,
      originalsVerifiedByGitCommit:false,
      generatedAt:new Date().toISOString(),
      originalResourceSha256:resources?RESOURCE_BASELINE:null,
      pageFilePaths:pages?EXPECTED_PATHS.slice():[],
      resourceEdits:resources?resources.changes.length:0,
      payloads:descriptors,
      note:'Private draft review only. Never copy this ZIP into a live website.'
    };
    var how=instructions(!!pages,!!resources);
    files.push({path:MANIFEST,content:JSON.stringify(manifest,null,2)+'\n'});
    files.push({path:INSTRUCTIONS,content:how});
    return {blob:zipTools.makeReviewZip(files),manifest:manifest,entryCount:files.length};
  }
  function saveBlob(blob,name){
    var url=URL.createObjectURL(blob);
    var anchor=document.createElement('a');
    anchor.href=url;anchor.download=name;anchor.hidden=true;
    document.body.appendChild(anchor);anchor.click();anchor.remove();
    setTimeout(function(){URL.revokeObjectURL(url);},15000);
  }
  var button=document.getElementById('save-review-package');
  var status=document.getElementById('review-package-status');
  if(button&&status){
    var busy=false;
    button.addEventListener('click',async function(){
      if(busy)return;
      busy=true;button.disabled=true;
      try{
        var pageSource=root.NaxxLocalPageReview,resourceSource=root.NaxxLocalResourceReview;
        if(!pageSource||!resourceSource)throw Error('Editor drafts are not ready.');
        var pages=pageSource.getDraft(),resources=resourceSource.getDraft();
        var result=await build(pages,resources,root.NaxxEditorZip);
        saveBlob(result.blob,'Naxxramas-Private-Editing-Review.zip');
        status.textContent='Private review package downloaded with '+result.entryCount+
          ' separate files. It is not a website update or full backup.';
        status.classList.toggle('error',false);
      }catch(err){
        status.textContent='Review package not saved: '+((err&&err.message)||'Unknown error.');
        status.classList.toggle('error',true);
      }finally{busy=false;button.disabled=false;}
    });
  }
  root.NaxxEditorReview={build:build,validatePageDraft:validatePageDraft,
    validateResourceDraft:validateResourceDraft};
})(typeof window==='undefined'?globalThis:window);
