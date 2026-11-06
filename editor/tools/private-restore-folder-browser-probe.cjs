'use strict';
/* Isolated Chrome test of read-only webkitdirectory input using ONLY synthetic
 * File objects. Never user data, remote connections, original source or writes.
 */
function folderBrowserProbe(){
  return '('+async function(){
    const d=document,api=window.NaxxFolderPreflight,pre=window.NaxxRestorePreflight;
    if(!api||!pre||!crypto||!crypto.subtle)
      return {ready:false,checks:{cryptoAndLibrariesPresent:false}};
    const folder=d.getElementById('source-folder');
    const draft=d.getElementById('versioned-draft');
    const check=d.getElementById('check-folder');
    const clear=d.getElementById('clear-folder');
    const result=d.getElementById('folder-result');
    const marker='FICTIONAL_PRIVATE_DRAFT_MARKER_619374';
    const encoder=new TextEncoder();
    const hash=async value=>{
      const digest=await crypto.subtle.digest('SHA-256',encoder.encode(value));
      return Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('');
    };
    const data=new DataTransfer();
    const resources=[];
    for(let i=0;i<api.COUNT;i++){
      const content='Fictional fragment '+i;
      const relative=api.expectedPath(i);
      const f=new File([content],'test-fragment',{type:'text/plain'});
      Object.defineProperty(f,'webkitRelativePath',{
        configurable:true,value:'fictional-source-root/'+relative
      });
      resources.push({index:i,path:relative,sha256:await hash(content)});
      data.items.add(f);
    }
    const manifest={format:pre.MANIFEST,privateOnly:true,publishable:false,
      deployable:false,originalSha256:pre.BASE,revision:0,parentSha256:null,
      sourceSha256:pre.BASE,sourceBytes:30976969,resources};
    function prepare(list,record){
      const dt=new DataTransfer();
      const mf=new File([JSON.stringify(record)],'manifest.json',{type:'application/json'});
      Object.defineProperty(mf,'webkitRelativePath',{
        configurable:true,value:'fictional-source-root/'+api.MANIFEST_PATH
      });
      dt.items.add(mf);
      for(const f of list)dt.items.add(f);
      folder.files=dt.files;
      folder.dispatchEvent(new Event('change',{bubbles:true}));
    }
    function supplyDraft(value){
      const dt=new DataTransfer();
      dt.items.add(new File([JSON.stringify(value)],'draft.json',{type:'application/json'}));
      draft.files=dt.files;
      draft.dispatchEvent(new Event('change',{bubbles:true}));
    }
    async function run(list,record,versionDraft){
      prepare(list,record);supplyDraft(versionDraft);
      check.click();
      for(let i=0;i<180;i++){
        if(!check.disabled&&result.dataset.decision!=='missing-files')
          return result.dataset.decision;
        await new Promise(resolve=>setTimeout(resolve,25));
      }
      return 'timeout';
    }
    const files=Array.from(data.files);
    const originalDraft={
      format:pre.DRAFT,sourceBaselineSha256:pre.BASE,revision:0,sourceSha256:pre.BASE,
      changes:[{index:0,expectedSha256:resources[0].sha256,title:marker}]
    };
    const matched=await run(files,manifest,originalDraft);
    const tampered=files.slice();
    const wrong=new File(['altered fictional fragment'],'test-fragment',{type:'text/plain'});
    Object.defineProperty(wrong,'webkitRelativePath',{
      configurable:true,value:files[4].webkitRelativePath
    });
    tampered[4]=wrong;
    const changed=await run(tampered,manifest,originalDraft);
    const missing=await run(files.slice(0,-1),manifest,originalDraft);
    const later={...manifest,revision:1,parentSha256:pre.BASE,
      sourceSha256:'a'.repeat(64)};
    const stale=await run(files,later,originalDraft);
    const oldV2={format:'naxx-local-resource-draft-v2',
      baselineSha256:pre.BASE,changes:[{index:0,title:marker}]};
    const unsupported=await run(files,manifest,oldV2);
    clear.click();
    const notice=d.querySelector('p.notice');
    const checks={
      acceptsDirectoryInput:!!folder&&folder.webkitdirectory===true&&
        folder.multiple===true,
      exactFileCountInSyntheticInput:files.length===414,
      relativeFolderPathsPreserved:files.every(f=>
        typeof f.webkitRelativePath==='string'&&f.webkitRelativePath.startsWith('fictional-source-root/')),
      validFolderIsReadOnly:matched==='fragments-checked',
      alteredPhysicalFileRejected:changed==='fragment-mismatch',
      missingPhysicalFileRejected:missing==='invalid-folder',
      staleDraftBlocked:stale==='stale',
      unsupportedOldDraftBlocked:unsupported==='invalid-draft',
      clearSelectedInputs:folder.value===''&&draft.value==='',
      clearResultIsBlocked:result.dataset.decision==='missing-files'&&result.dataset.blocked==='true',
      privateDraftTextNeverDisplayed:!d.body.textContent.includes(marker),
      noFormOrIframe:d.querySelectorAll('form,iframe').length===0,
      onlyReviewControls:Array.from(d.querySelectorAll('button')).every(b=>
        !/^(Apply|Save|Merge|Publish|Upload)/i.test(b.textContent)),
      statusAccessible:result.getAttribute('aria-live')==='polite',
      offlineCsp:!!d.querySelector('meta[http-equiv="Content-Security-Policy"]')&&
        d.querySelector('meta[http-equiv="Content-Security-Policy"]').content.includes("connect-src 'none'"),
      clearLimitationsExplained:d.body.textContent.includes('not')&&
        d.body.textContent.includes('reconstruct the full 31 MB website'),
      documentNoHorizontalOverflow:d.documentElement.scrollWidth<=window.innerWidth+3,
      syntheticAndPrivate:!!notice&&notice.textContent.includes('TEST ONLY')
    };
    return {ready:Object.values(checks).every(Boolean),checks};
  }.toString()+')()';
}
module.exports={folderBrowserProbe};
