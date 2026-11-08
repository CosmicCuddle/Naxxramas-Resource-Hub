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

const REPO = 'CosmicCuddle/Naxxramas-Resource-Hub';
const MAX_ZIP = 8 * 1024 * 1024;
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
  const session=crypto.randomBytes(32).toString('hex');
  let reviewing=false;
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
      reply(200,{
        format:'naxx-editor-local-save-capability-v1',
        ready:false,authenticated:false,repository:REPO,
        publishDisabled:true,backupVerified:false,
        exactOldHeadEnforced:false,branch:null,expectedHead:null,
        reviewReady:!!review,csrfToken:session
      });
      return;
    }
    if(req.method==='POST' && (url==='/api/editor/save'||url==='/api/editor/review')){
      const origin='http://'+host;
      const csrf=req.headers['x-naxx-csrf-token'];
      const submitted=typeof csrf==='string' && /^[a-f0-9]{64}$/.test(csrf) ?
        Buffer.from(csrf,'hex') : Buffer.alloc(32);
      const match=crypto.timingSafeEqual(submitted,Buffer.from(session,'hex'));
      if(req.headers.origin!==origin ||
         (req.headers['sec-fetch-site'] && req.headers['sec-fetch-site']!=='same-origin') ||
         req.headers['x-naxx-editor-protocol']!=='naxx-local-review-v1' ||
         !match){
        reject(403,'Local editor session or origin was not verified.');return;
      }
      if(url==='/api/editor/save'){
        reject(423,'Real GitHub Save remains disabled. No repository files were written.');return;
      }
      if(!review){reject(503,'No pinned source review is configured.');return;}
      if(reviewing){reject(409,'Another review is already running.');return;}
      if(req.headers['content-type']!=='application/zip'){
        reject(415,'A protected editor review ZIP is required.');return;
      }
      const sizeHeader=Number(req.headers['content-length']);
      if(!Number.isSafeInteger(sizeHeader)||sizeHeader<22||sizeHeader>MAX_ZIP){
        reject(413,'Review ZIP size is missing or outside the limit.');return;
      }
      reviewing=true;
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
        const checked=await review(Buffer.concat(chunks));
        // Even an injected handler must not forge a production Save receipt.
        if(!checked||checked.format!=='naxx-editor-local-review-result-v1'||
           checked.reviewOnly!==true||checked.sourceChecked!==true||
           checked.gitHubWrite!==false||checked.published!==false||
           checked.checkedResourceCount!==414||
           !Number.isInteger(checked.changedResources)||
           !Number.isInteger(checked.changedPageAndNavigationFiles))
          throw Error('The source review did not return trustworthy read-only evidence.');
        reply(200,checked);
      } catch(_) {
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
module.exports={createCompanion,buildReviewer,makeReviewResult,parseArgs};
