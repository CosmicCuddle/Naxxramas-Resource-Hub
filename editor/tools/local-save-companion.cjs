'use strict';
/*
 * Local editor companion — first integration boundary.
 *
 * Serves the development editor from 127.0.0.1, independently reviews the
 * browser's existing combined draft ZIP against a pinned clean checkout,
 * and ALWAYS refuses remote Save. No GitHub write API or credentials exist
 * in this process. Neither this service nor a reviewed ZIP is a backup.
 *
 * Live GitHub Save must NOT be enabled by changing a flag here: build and
 * separately approve a credential-isolated, backed-up, exact-old-ref writer.
 */
const http = require('node:http');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const {planFromReviewZip} = require('./review-private-combined-zip.cjs');
const {checkedSetup,checkedReceipt} = require('./protected-save-contract.cjs');

const REPO = 'CosmicCuddle/Naxxramas-Resource-Hub';
const PRIVATE_DRAFT_REPO='CosmicCuddle/Naxxramas-Editor-Save-Sandbox-01';
const MAX_ZIP = 20 * 1024 * 1024;
const COMMIT = /^[a-f0-9]{40}$/;
const ASSETS = new Map([
  ['index.html','text/html; charset=utf-8'],
  ['export-zip.js','text/javascript; charset=utf-8'],
  ['preview.js','text/javascript; charset=utf-8'],
  ['resource-title-core.js','text/javascript; charset=utf-8'],
  ['resource-title-ui.js','text/javascript; charset=utf-8'],
  ['editor.js','text/javascript; charset=utf-8'],
  ['review-package.js','text/javascript; charset=utf-8'],
  ['review-package-reader.js','text/javascript; charset=utf-8'],
  ['review-package-reader-ui.js','text/javascript; charset=utf-8'],
  ['github-save-client.js','text/javascript; charset=utf-8']
]);

function makeReviewResult(plan, expectedCommit) {
  if (!plan || plan.format !== 'naxx-private-browser-zip-to-git-review-v1' ||
      plan.reviewOnly !== true || plan.gitHubReady !== false ||
      plan.expectedGitCommit !== expectedCommit ||
      plan.cleanGitCheckoutBeforeAndAfter !== true ||
      plan.checkedResourceCount !== 414 ||
      plan.compatibilityReconstructionVerified !== true ||
      plan.resourceCandidateRollbackVerified !== true ||
      plan.originalResourceRuntimeSha256 !== '34455f6d901c538e2491a8c16681692e4c02d918b1984d7d0ba081aacb1049e8' ||
      plan.sourceLayoutSelected !== false ||
      plan.completeRepositoryBackup !== false ||
      plan.canApply !== false || plan.canPush !== false ||
      plan.canPublish !== false || plan.repositoryFilesWritten !== 0 ||
      plan.gitHubWrites !== 0 ||
      !Number.isInteger(plan.existingPageAndNavigationChanges) ||
      !Number.isInteger(plan.proposedResourceChanges) ||
      plan.existingPageAndNavigationChanges < 0 ||
      plan.proposedResourceChanges < 0 ||
      plan.existingPageAndNavigationChanges + plan.proposedResourceChanges < 1) {
    throw Error('Source review did not confirm a safe read-only change plan.');
  }
  return Object.freeze({
    format:'naxx-editor-local-review-result-v1',
    reviewOnly:true,sourceChecked:true,gitHubWrite:false,published:false,
    expectedGitCommit:expectedCommit,checkedResourceCount:414,
    changedPageAndNavigationFiles:plan.existingPageAndNavigationChanges,
    changedResources:plan.proposedResourceChanges
  });
}
function makeDisposableCommitResult(proof) {
  if(!proof||proof.format!=='naxx-disposable-conditional-local-git-save-v1'||
     proof.onlyDisposableGitClone!==true||
     proof.candidateGitCommitCreatedAndVerified!==true||
     proof.independentTreeShaMatched!==true||
     proof.resourceSourceBlobs!==415||
     !Number.isInteger(proof.changedOriginalGitBlobs)||
     proof.changedOriginalGitBlobs<2||proof.changedOriginalGitBlobs>6||
     proof.stagedPathsVerified!==415+proof.changedOriginalGitBlobs||
     proof.exactOldLocalRefAdvanceVerified!==true||
     proof.staleSecondLocalSaveRejected!==true||
     proof.originalLocalRefRecovered!==true||
     proof.privateGitCloneDeleted!==true||
     proof.originalSiteRollbackVerified!==true||
     proof.originalSourceCommitUnchanged!==true||
     proof.temporaryCandidateDeleted!==true||
     proof.originalRepositoryWritten!==false||
     proof.githubWrites!==0||
     proof.githubSaveEnabled!==false||
     proof.githubRemoteCASProven!==false||
     proof.ownerHeldBackupRetained!==false||
     proof.sourceLayoutApproved!==false||
     proof.canPush!==false||proof.canPublish!==false)
    throw Error('Disposable commit proof did not meet the complete local rollback requirements.');
  return Object.freeze({
    format:'naxx-editor-local-test-commit-result-v1',
    testOnly:true,realGitHubSave:false,published:false,
    initialResourceSourceFiles:415,
    changedExistingGitFiles:proof.changedOriginalGitBlobs,
    totalCandidateFileChanges:proof.stagedPathsVerified,
    exactOldLocalRefVerified:true,staleSecondSaveRejected:true,
    originalSourceRestored:true,temporaryCloneDeleted:true,
    githubWrites:0
  });
}
function buildReviewer(checkout,expectedCommit) {
  if (typeof checkout !== 'string' || !path.isAbsolute(checkout) ||
      !COMMIT.test(expectedCommit || ''))
    throw Error('A local absolute checkout and an independently pinned commit are required.');
  return async function(zip) {
    const plan = await planFromReviewZip(checkout,zip,expectedCommit);
    return makeReviewResult(plan,expectedCommit);
  };
}
function createCompanion(options={}) {
  const editorDir=options.editorDir || path.resolve(__dirname,'..');
  const review=typeof options.review==='function' ? options.review : null;
  const testCommit=typeof options.testCommit==='function' ? options.testCommit : null;
  // The normal CLI never passes this. It takes an explicitly supplied,
  // independently audited owner-approved branch writer to enable real Save.
  const protectedSave=options.protectedSave ?
    checkedSetup(options.protectedSave) : null;
  const privateDraftStore=options.privateDraftStore||null;
  if(privateDraftStore && (protectedSave ||
     privateDraftStore.repository!==PRIVATE_DRAFT_REPO||
     typeof privateDraftStore.status!=='function'||
     typeof privateDraftStore.save!=='function'||
     typeof privateDraftStore.load!=='function'))
    throw Error('Only the separately reviewed private GitHub draft store may be attached.');
  const session=crypto.randomBytes(32).toString('hex');
  let reviewing=false,saveAttempted=false,privateDraftUncertain=false;
  const server=http.createServer(async(req,res)=>{
    // No proxy trust, permissive CORS, DNS rebinding, or non-loopback Host.
    const addr=server.address();
    const host='127.0.0.1:'+ (addr && addr.port);
    const actualHost=req.headers.host;
    function reply(status,data) {
      res.writeHead(status,{
        'Content-Type':'application/json; charset=utf-8',
        'Cache-Control':'no-store',
        'X-Content-Type-Options':'nosniff',
        'X-Frame-Options':'DENY',
        'Referrer-Policy':'no-referrer',
        'Cross-Origin-Resource-Policy':'same-origin'
      });
      res.end(JSON.stringify(data));
    }
    function reject(status,message){
      reply(status,{format:'naxx-editor-local-error-v1',error:message});
    }
    if(actualHost!==host){
      reject(403,'Only the local editor origin is allowed.');return;
    }
    const url=req.url;
    if(typeof url!=='string'||url.length>180||url.includes('?')||url.includes('#')){
      reject(404,'Unknown editor route.');return;
    }
    if(req.method==='OPTIONS'){
      reject(403,'Cross-origin requests are not permitted.');return;
    }
    if(req.method==='GET' && url==='/api/editor/status') {
      if(privateDraftStore){
        try {
          const state=await privateDraftStore.status();
          if(!state||state.repository!==PRIVATE_DRAFT_REPO||
             state.branch!=='main'||state.privateVerified!==true||
             !COMMIT.test(state.expectedHead||''))
            throw Error('Private draft identity was not verified.');
          reply(200,{
            format:'naxx-editor-local-save-capability-v1',
            ready:!privateDraftUncertain,authenticated:true,
            storageMode:'private-draft-zip',repository:PRIVATE_DRAFT_REPO,
            publishDisabled:true,backupVerified:false,
            exactOldHeadEnforced:true,branch:'main',
            expectedHead:state.expectedHead,draftExists:state.draftExists===true,
            csrfToken:session
          });
        } catch(_) {
          reject(503,'Private draft Save is not ready. The sandbox must be initialised and verified.');
        }
        return;
      }
      reply(200,{
        format:'naxx-editor-local-save-capability-v1',
        ready:!!protectedSave&&!saveAttempted,
        authenticated:!!protectedSave&&!saveAttempted,
        repository:REPO,
        publishDisabled:true,
        backupVerified:!!protectedSave&&!saveAttempted,
        exactOldHeadEnforced:!!protectedSave&&!saveAttempted,
        branch:protectedSave&&!saveAttempted?protectedSave.branch:null,
        expectedHead:protectedSave&&!saveAttempted?protectedSave.expectedHead:null,
        reviewReady:!!review,disposableCommitTrialReady:!!testCommit,
        csrfToken:session
      });
      return;
    }
    if(req.method==='POST' && (url==='/api/editor/save'||
       url==='/api/editor/review'||url==='/api/editor/test-commit'||
       url==='/api/editor/latest-draft')){
      const origin='http://'+host;
      const csrf=req.headers['x-naxx-csrf-token'];
      const submitted=typeof csrf==='string' && /^[a-f0-9]{64}$/.test(csrf) ?
        Buffer.from(csrf,'hex') : Buffer.alloc(32);
      const match=crypto.timingSafeEqual(submitted,Buffer.from(session,'hex'));
      const protocol=req.headers['x-naxx-editor-protocol'];
      const requiredProtocol=url==='/api/editor/test-commit' ?
        'naxx-local-test-commit-v1' :
        url==='/api/editor/save' ? 'naxx-local-save-v1' :
        url==='/api/editor/latest-draft' ? 'naxx-local-load-private-draft-v1' :
        'naxx-local-review-v1';
      // The old read-only companion sent a review protocol to the
      // disabled Save route. Keep its explicit 423 refusal rather than
      // changing it into an unrelated 403; both remain unwritable.
      const protocolAllowed=protocol===requiredProtocol ||
        (url==='/api/editor/save'&&!protectedSave&&!privateDraftStore &&
         protocol==='naxx-local-review-v1');
      if(req.headers.origin!==origin ||
         (req.headers['sec-fetch-site'] && req.headers['sec-fetch-site']!=='same-origin') ||
         !protocolAllowed || !match){
        reject(403,'Local editor session or origin was not verified.');return;
      }
      if(url==='/api/editor/latest-draft'){
        if(!privateDraftStore||privateDraftUncertain){
          reject(423,'Private draft loading is unavailable.');return;
        }
        try {
          const loaded=await privateDraftStore.load();
          if(!loaded||!Buffer.isBuffer(loaded.bytes)||!COMMIT.test(loaded.commit||''))
            throw Error('No verified private saved draft exists.');
          reply(200,{format:'naxx-editor-private-draft-load-v1',
            repository:PRIVATE_DRAFT_REPO,branch:'main',
            commit:loaded.commit,zipBase64:loaded.bytes.toString('base64'),
            published:false});
        }catch(_){reject(503,'Private draft could not be safely loaded.');}
        return;
      }
      if(url==='/api/editor/save'&&privateDraftStore&&privateDraftUncertain){
        reject(423,'Private draft Save has an uncertain earlier outcome. Inspect before retrying.');return;
      }
      if(url==='/api/editor/save'&&!privateDraftStore&&(!protectedSave||saveAttempted)){
        reject(423,'Real GitHub Save remains disabled. No repository files were written.');return;
      }
      if(url==='/api/editor/save'&&!privateDraftStore&&
         req.headers['x-naxx-expected-head']!==protectedSave.expectedHead){
        reject(409,'The reviewed development branch commit is stale. Refresh before saving.');return;
      }
      if(url==='/api/editor/save'&&privateDraftStore&&
         !COMMIT.test(req.headers['x-naxx-expected-head']||'')){
        reject(409,'The private draft branch head is missing or invalid.');return;
      }
      const handler=url==='/api/editor/save' ?
        (privateDraftStore ?
          async(bytes)=>privateDraftStore.save(bytes,req.headers['x-naxx-expected-head']) :
          protectedSave.writer) :
        url==='/api/editor/test-commit'?testCommit:review;
      if(!handler){reject(503,'No pinned source review or disposable commit trial is configured.');return;}
      if(reviewing){reject(409,'Another review is already running.');return;}
      if(req.headers['content-type']!=='application/zip'){
        reject(415,'A protected editor review ZIP is required.');return;
      }
      const sizeHeader=Number(req.headers['content-length']);
      if(!Number.isSafeInteger(sizeHeader)||sizeHeader<22||sizeHeader>MAX_ZIP){
        reject(413,'Review ZIP size is missing or outside the limit.');return;
      }
      reviewing=true;
      // A Save consumes this server session on any attempt that reaches the
      // body/writer. Unknown remote outcomes must never be retried blindly.
      if(url==='/api/editor/save'){
        if(privateDraftStore)privateDraftUncertain=true;
        else saveAttempted=true;
      }
      try{
        let total=0;
        const chunks=[];
        for await(const chunk of req){
          total+=chunk.length;
          if(total>MAX_ZIP||total>sizeHeader)
            throw Error('Review ZIP exceeded the declared size.');
          chunks.push(chunk);
        }
        if(total!==sizeHeader)throw Error('Review ZIP length did not match.');
        const checked=await handler(Buffer.concat(chunks),
          url==='/api/editor/save' && protectedSave ? Object.freeze({
            repository:protectedSave.repository,branch:protectedSave.branch,
            expectedHead:protectedSave.expectedHead,publishDisabled:true
          }) : undefined);
        if(url==='/api/editor/save'&&privateDraftStore){
          if(!checked||checked.repository!==PRIVATE_DRAFT_REPO||
             checked.branch!=='main'||
             checked.result!=='private-draft-saved-and-verified'||
             checked.privateVerified!==true||
             checked.websiteSourceUnchanged!==true||
             checked.published!==false||
             !COMMIT.test(checked.commit||'')||
             checked.parentCommit!==req.headers['x-naxx-expected-head'])
            throw Error('The private draft receipt is not independently verified.');
          privateDraftUncertain=false;
          reply(200,{format:'naxx-editor-private-draft-save-v1',
            result:'saved-private-draft',repository:PRIVATE_DRAFT_REPO,
            branch:'main',commit:checked.commit,
            parentCommit:checked.parentCommit,
            gitBlobSha:checked.gitBlobSha,published:false});
        } else if(url==='/api/editor/save'){
          reply(200,checkedReceipt(checked,protectedSave));
        } else if(url==='/api/editor/test-commit') {
          // This response describes only a local, deleted Git clone.
          // It is intentionally incompatible with the real GitHub Save receipt.
          reply(200,makeDisposableCommitResult(checked));
        } else {
          if(!checked||checked.format!=='naxx-editor-local-review-result-v1'||
             checked.reviewOnly!==true||checked.sourceChecked!==true||
             checked.gitHubWrite!==false||checked.published!==false||
             checked.checkedResourceCount!==414||
             !Number.isInteger(checked.changedResources)||
             !Number.isInteger(checked.changedPageAndNavigationFiles))
            throw Error('The source review did not return trustworthy read-only evidence.');
          reply(200,checked);
        }
      } catch(_) {
        if(url==='/api/editor/save')
          reject(503,'SAVE_OUTCOME_UNCERTAIN: retain edits and inspect the saved draft or protected branch. Do not retry automatically.');
        else
          reject(422,'Source review refused this package. No GitHub files were changed.');
      } finally{reviewing=false;}
      return;
    }
    if(req.method==='GET' && url.startsWith('/editor/')){
      const name=url.slice('/editor/'.length);
      const mime=ASSETS.get(name);
      if(!mime){reject(404,'Editor file is not available.');return;}
      try{
        const file=path.join(editorDir,name);
        const info=fs.lstatSync(file);
        if(!info.isFile()||info.isSymbolicLink()||info.size>300*1024)
          throw Error('Unsafe editor asset.');
        res.writeHead(200,{
          'Content-Type':mime,
          'Cache-Control':'no-store',
          'X-Content-Type-Options':'nosniff',
          'Referrer-Policy':'no-referrer',
          'X-Frame-Options':'DENY',
          'Cross-Origin-Resource-Policy':'same-origin'
        });
        res.end(fs.readFileSync(file));
      }catch(_){reject(404,'Editor asset unavailable.');}
      return;
    }
    reject(404,'Unknown editor route.');
  });
  server.requestTimeout=15000;
  server.headersTimeout=10000;
  server.timeout=30000;
  return server;
}
function parseArgs(argv) {
  const result={};
  if(argv.length!==4)throw Error('Use --checkout /absolute/path --commit PINNED_40_CHAR_SHA.');
  for(let i=0;i<argv.length;i+=2){
    if(!['--checkout','--commit'].includes(argv[i]) ||
       Object.hasOwn(result,argv[i])||!argv[i+1])
      throw Error('Unexpected or repeated option.');
    result[argv[i]]=argv[i+1];
  }
  if(!result['--checkout']||!result['--commit'])
    throw Error('An exact local checkout and reviewed Git commit are required.');
  return {checkout:result['--checkout'],commit:result['--commit']};
}
if(require.main===module){
  try{
    const args=parseArgs(process.argv.slice(2));
    const server=createCompanion({
      review:buildReviewer(args.checkout,args.commit)
    });
    server.listen(0,'127.0.0.1',()=>{
      process.stdout.write('PRIVATE READ-ONLY editor: http://127.0.0.1:'+
        server.address().port+'/editor/index.html\n'+
        'GitHub Save is DISABLED; this companion only reviews drafts.\n');
    });
  }catch(_){
    process.stderr.write('Read-only local editor could not start. Check pinned checkout arguments.\n');
    process.exitCode=1;
  }
}
module.exports={createCompanion,buildReviewer,makeReviewResult,
  makeDisposableCommitResult,parseArgs};
