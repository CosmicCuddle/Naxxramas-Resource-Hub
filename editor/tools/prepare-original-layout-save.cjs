'use strict';
/*
 * ORIGINAL-LAYOUT WEBSITE SAVE SOURCE — NO RESOURCE MIGRATION.
 *
 * Reuse the complete protected browser ZIP / 31MB site rebuild, but select
 * ONLY the existing Git-tracked HTML, page and navigation files that changed.
 * The protected original website and all unchanged tracked files are checked
 * byte-for-byte; the temporary candidate and rollback are deleted.
 *
 * This returns bytes for a FUTURE reviewed development-branch writer.
 * It does not create a Git commit, change a ref, contact GitHub, publish,
 * authenticate, or claim an owner-retained backup.
 */
const path=require('node:path'),crypto=require('node:crypto');
const {verifyCheckout}=require('./plan-mixed-editor-update.cjs');
const {withFullSiteRollback,read}=
  require('./rehearse-browser-zip-full-site-rollback.cjs');
const {gitTreeInventory,gitBlobOid,treeOid}=
  require('./rehearse-browser-zip-git-tree-intent.cjs');
const {PAGES,NAV}=require('./plan-page-draft.cjs');
const RUNTIME='site-content.html';
const ALLOWED=new Set([...PAGES,NAV,RUNTIME]);
const SHA=/^[a-f0-9]{40}$/;
const sha256=b=>crypto.createHash('sha256').update(b).digest('hex');
const FORMAT='naxx-original-layout-byte-exact-save-source-v1';
async function prepareOriginalLayoutSave(checkout,zip,expectedCommit){
  if(typeof checkout!=='string'||!path.isAbsolute(checkout)||
     !Buffer.isBuffer(zip)||zip.length<22||zip.length>20*1024*1024||
     !SHA.test(expectedCommit||''))
    throw Error('Complete original Git source, reviewed ZIP and exact commit are required.');
  const first=verifyCheckout(checkout,expectedCommit);
  let candidate=null;
  const rollback=await withFullSiteRollback(checkout,zip,expectedCommit,async view=>{
    view.verifyBackup();view.verifyStaged();
    const original=gitTreeInventory(checkout,expectedCommit);
    const gitFiles=new Map(original.files.map(e=>[e.path,e]));
    if(view.trackedNames.length!==gitFiles.size||
       view.trackedNames.some(x=>!gitFiles.has(x))||
       !view.changeSet.has(RUNTIME)||
       [...view.changeSet].some(x=>!ALLOWED.has(x))||
       view.changeSet.size<2||view.changeSet.size>6)
      throw Error('Unexpected original website tracked-file change scope.');
    const proposed=[],changed=[];
    let unchanged=0;
    for(const entry of original.files){
      const old=read(checkout,entry.path),now=read(view.site,entry.path);
      if(gitBlobOid(old)!==entry.oid)
        throw Error('Original website file bytes changed from Git source.');
      const oid=gitBlobOid(now);
      if(view.changeSet.has(entry.path)){
        if(!now.equals(read(view.stage,entry.path))||oid===entry.oid)
          throw Error('An intended tracked website file did not match staging.');
        changed.push(Object.freeze({
          path:entry.path,mode:entry.mode,oldOid:entry.oid,
          oid,sha256:sha256(now),bytes:now
        }));
      }else{
        if(oid!==entry.oid||!now.equals(old))
          throw Error('An untouched site file or custom asset changed.');
        unchanged++;
      }
      proposed.push({path:entry.path,mode:entry.mode,oid});
    }
    const nextTree=treeOid(proposed);
    if(nextTree===original.treeOid||
       changed.length!==view.changeSet.size||
       unchanged!==original.files.length-changed.length||
       changed.length<2||changed.length>6||
       !changed.some(item=>item.path===RUNTIME)||
       proposed.length!==original.files.length)
      throw Error('Existing website source tree was incomplete or unchanged.');
    candidate=Object.freeze({
      format:FORMAT,expectedCommit,
      originalTreeOid:original.treeOid,nextTreeOid:nextTree,
      trackedFileCount:proposed.length,
      unchangedFilesPreserved:unchanged,
      changedExistingFiles:changed.length,
      files:Object.freeze(changed.sort((a,b)=>a.path.localeCompare(b.path))),
      fullSiteSha256:sha256(read(view.site,RUNTIME)),
      noNewResourceSourceFiles:true,
      originalWebsiteLayoutPreserved:true,
      githubWrites:0,published:false
    });
  });
  if(!candidate||rollback.privateRollbackExact!==true||
     rollback.originalRepositoryCheckoutUnchanged!==true||
     rollback.allTemporarySiteCopiesDeleted!==true||
     rollback.originalRootLoaderByteExact!==true||
     rollback.customScriptsAssetsAndUnchangedPagesPreserved!==true||
     rollback.completeSiteRuntimeHashMatched!==true)
    throw Error('Complete original website rollback/preservation was not verified.');
  const after=verifyCheckout(checkout,expectedCommit);
  if(first.fingerprintSha256!==after.fingerprintSha256)
    throw Error('Original checkout changed during protected Save preparation.');
  return candidate;
}
module.exports=Object.freeze({FORMAT,prepareOriginalLayoutSave});
