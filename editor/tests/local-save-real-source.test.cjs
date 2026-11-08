'use strict';
/*
 * End-to-end original-source browser draft -> same-origin loopback companion.
 * Uses original 31 MB website and a clean Git checkout, never a GitHub writer.
 * Both fictional edits are kept in memory and never committed/published.
 */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const crypto=require('node:crypto'),cp=require('node:child_process'),vm=require('node:vm');
const {createCompanion,buildReviewer}=require('../tools/local-save-companion.cjs');
const client=require('../github-save-client.js');
const {PAGES,NAV,runs}=require('../tools/plan-page-draft.cjs');
const {SOURCE_SHA}=require('../tools/audit-source-storage-budget.cjs');
const root=path.resolve(__dirname,'..','..'),editor=path.resolve(__dirname,'..');
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const head=cp.execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
const gitStatus=()=>cp.execFileSync('git',['status','--porcelain=v1','--untracked-files=all'],{
  cwd:root,encoding:'utf8'}).trim();
function drafts(){
  const pageOriginal=fs.readFileSync(path.join(root,PAGES[0]),'utf8');
  const first=runs(pageOriginal).find(x=>x.kind==='text');
  assert.ok(first);
  const originalNav=fs.readFileSync(path.join(root,NAV));
  const nav=JSON.parse(originalNav.toString('utf8'));
  nav.pages[0].label='Private read-only source review';
  const pages={format:'naxx-local-draft-v3',
    sourceBranchHint:'feature/multi-file-editor-export-2026-11-05',
    sourceCommitVerified:false,createdAt:'2026-11-08T00:00:00Z',
    files:PAGES.map(name=>({
      path:name,sourceSha256:sha(fs.readFileSync(path.join(root,name))),
      edits:name===PAGES[0]?{[first.id]:'Local review text only'}:{}
    })),
    navigation:{path:NAV,sourceSha256:sha(originalNav),document:nav}
  };
  const resources={format:'naxx-local-resource-draft-v2',
    baselineSha256:SOURCE_SHA,changes:[
      {index:0,title:'Fictional protected source review title'},
      {index:413,content:'Fictional multiline local content.\n\nSecond paragraph.'}
    ]
  };
  return {pages,resources};
}
function zipTools(){
  const box={TextEncoder,Blob,Uint8Array,Uint32Array,DataView,
    crypto:crypto.webcrypto,document:{getElementById(){return null;}}};
  for(const filename of ['export-zip.js','review-package.js']){
    vm.runInNewContext(fs.readFileSync(path.join(editor,filename),'utf8'),
      box,{filename,timeout:5000});
  }
  assert.ok(box.NaxxEditorZip && box.NaxxEditorReview);
  return box;
}
test('real original source: one browser review succeeds, no real Save, no Git or website modifications',async()=>{
  const before=gitStatus();
  const source=fs.readFileSync(path.join(root,'site-content.html'));
  assert.equal(source.length,30976969);
  assert.equal(sha(source),SOURCE_SHA);
  const {pages,resources}=drafts(),tools=zipTools();
  const server=createCompanion({editorDir:editor,review:buildReviewer(root,head)});
  await new Promise((ok,fail)=>server.once('error',fail).listen(0,'127.0.0.1',ok));
  const base='http://127.0.0.1:'+server.address().port;
  let posts=0;
  try{
    const result=await client.reviewChanges({
      location:{protocol:'http:',hostname:'127.0.0.1'},
      fetchFn:(url,opts)=>{
        if(opts && opts.method==='POST')posts++;
        return fetch(base+url,{
          ...opts,
          headers:{...(opts&&opts.headers),Origin:base,'Sec-Fetch-Site':'same-origin'}
        });
      },
      getPageDraft:()=>pages,getResourceDraft:()=>resources,
      build:tools.NaxxEditorReview.build,zipTools:tools.NaxxEditorZip
    });
    assert.equal(posts,1);
    assert.equal(result.reviewOnly,true);
    assert.equal(result.changedResources,2);
    assert.equal(result.changedPageAndNavigationFiles,2);
    assert.equal(result.expectedGitCommit,head);
    assert.equal(result.changedDuringReview,false);
    assert.equal(result.published,false);
    const status=await fetch(base+'/api/editor/status');
    const capability=await status.json();
    assert.equal(capability.ready,false);
    const zip=await tools.NaxxEditorReview.build(pages,resources,tools.NaxxEditorZip);
    const blocked=await fetch(base+'/api/editor/save',{
      method:'POST',body:zip.blob,
      headers:{Origin:base,'Content-Type':'application/zip',
        'X-Naxx-Csrf-Token':capability.csrfToken,
        'X-Naxx-Editor-Protocol':'naxx-local-review-v1'}
    });
    assert.equal(blocked.status,423);
    assert.equal(gitStatus(),before);
    assert.equal(sha(fs.readFileSync(path.join(root,'site-content.html'))),SOURCE_SHA);
  }finally{
    server.closeAllConnections();
    await new Promise(ok=>server.close(ok));
  }
});
