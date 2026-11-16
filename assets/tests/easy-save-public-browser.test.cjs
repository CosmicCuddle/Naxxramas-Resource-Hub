// Controlled browser QA: all requests intercepted; no submissions or live writes.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const {chromium}=require(process.env.NAXX_PLAYWRIGHT||'playwright');
const root=path.resolve(__dirname,'../..'),origin='https://cosmiccuddle.github.io',prefix='/Naxxramas-Resource-Hub/',url=origin+prefix;
const head=cp.execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
let remoteHead=head;
const files=['site-content.html','patches/content.html','change-notes/content.html','patches/update-1.0.6.8.4.json','change-notes/update-1.0.6.8.4.json','new-players/content.html','rules/content.html','apply/content.html'];
const tree=files.map(p=>({path:p,type:'blob',size:fs.statSync(path.join(root,p)).size,sha:cp.execFileSync('git',['rev-parse',head+':'+p],{cwd:root,encoding:'utf8'}).trim()}));
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.docx':'application/vnd.openxmlformats-officedocument.wordprocessingml.document','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.webp':'image/webp'};
let apiReads=0;
async function intercept(route){
 const u=new URL(route.request().url());
 if(u.hostname==='api.github.com'){
  apiReads++;
  if(u.pathname.endsWith('/git/ref/heads/main'))return route.fulfill({json:{object:{sha:remoteHead}},headers:{'access-control-allow-origin':'*'}});
  if(u.pathname.endsWith('/git/trees/'+head))return route.fulfill({json:{tree,truncated:false},headers:{'access-control-allow-origin':'*'}});
  return route.abort();
 }
 if(u.origin===origin&&u.pathname.startsWith(prefix)){
  let file=path.resolve(root,decodeURIComponent(u.pathname.slice(prefix.length)));
  if(file!==root&&!file.startsWith(root+path.sep))return route.abort();
  try{if(fs.statSync(file).isDirectory())file=path.join(file,'index.html');return route.fulfill({path:file,contentType:types[path.extname(file)]||'application/octet-stream'});}catch(_){return route.fulfill({status:404,body:'Not found'});}
 }
 if(u.hostname==='tally.so')return route.fulfill({status:200,contentType:u.pathname.endsWith('.js')?'text/javascript':'text/html',body:u.pathname.endsWith('.js')?'window.Tally={loadEmbeds(){}};':'<!doctype html><p>QA only</p>'});
 return route.abort();
}
async function ready(page,slug,editing){
 await page.waitForFunction(({slug,editing})=>location.pathname.endsWith(slug?'/'+slug+'/':'/Naxxramas-Resource-Hub/')&&!!document.getElementById('resourceGrid')&&!!document.body&&document.body.classList.contains('visual-admin-active')===editing&&(!editing||window.NaxxEasySaveEditorReady===true)&&(!['new-players','rules','apply'].includes(slug)||!!document.querySelector('[data-naxx-guide-content="'+slug+'"]')),{slug,editing},{timeout:90000});
}
async function run(){
 const browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'naxx-public-qa-'));
 try{
  const ctx=await browser.newContext({acceptDownloads:true,viewport:{width:1440,height:1000}});
  await ctx.route('**/*',intercept);
  const page=await ctx.newPage();page.setDefaultTimeout(90000);
  page.on('dialog',d=>d.accept());
  await page.goto(url+'new-players/',{waitUntil:'domcontentloaded'});await ready(page,'new-players',false);
  assert.equal(apiReads,0,'Visitor must not query GitHub');
  assert.equal(await page.locator('[data-naxx-guide-pencil]').count(),0);
  await page.evaluate(()=>openAdmin());
  await page.evaluate(()=>{document.getElementById('adminPasswordInput').value='__QA_WRONG_PASSWORD__';unlockAdmin();});
  assert.equal(apiReads,0,'Wrong password must not query GitHub');
  // Use the existing native check inside this isolated browser; no password is printed or exported.
  await page.evaluate(()=>{document.getElementById('adminPasswordInput').value=DATA.adminPassword;unlockAdmin();});
  await ready(page,'new-players',true);
  assert.ok(apiReads>=2,'Correct native password must verify revision');
  await page.locator('[data-naxx-guide-pencil]').first().click();
  const field=page.locator('dialog textarea').first();await field.waitFor();
  await field.fill((await field.inputValue())+' RELEASE-QA-TEXT');
  await page.getByRole('button',{name:'Apply text edit'}).click();
  await page.getByRole('button',{name:'Save Website Changes'}).click();
  await page.getByText('Your combined website update is ready!').waitFor();
  assert.ok(await page.locator('[data-naxx-easy-save-runtime]').innerText().then(t=>t.includes('new-players/content.html')));
  for(const slug of ['rules','apply','patches','change-notes','']){
   await page.goto(url+(slug?slug+'/':''),{waitUntil:'domcontentloaded'});await ready(page,slug,true);
   await page.getByText('Your combined website update is ready!').waitFor();
   if(slug==='apply'){
    assert.equal(await page.locator('#naxx-tally-live-application').evaluate(x=>x.hidden),true);
    assert.equal(await page.locator('#naxx-application-demo input').evaluate(x=>x.disabled),true);
   }
  }
  await page.goto(url+'new-players/',{waitUntil:'domcontentloaded'});await ready(page,'new-players',true);
  assert.ok((await page.locator('[data-naxx-guide-content]').innerText()).includes('RELEASE-QA-TEXT'));
  const download=page.waitForEvent('download',{timeout:90000});await page.getByRole('button',{name:'Download All Website Changes (.zip)'}).click();
  const zip=path.join(temp,'update.zip');await (await download).saveAs(zip);
  cp.execFileSync('unzip',['-t',zip],{stdio:'pipe'});
  const paths=cp.execFileSync('unzip',['-Z1',zip],{encoding:'utf8'}).trim().split('\n').sort();
  assert.deepEqual(paths,['COPY-INTO-REPOSITORY/new-players/content.html','UPLOAD-INSTRUCTIONS.txt']);
  const saved=cp.execFileSync('unzip',['-p',zip,paths[0]],{encoding:'utf8'});
  assert.equal(saved.replace(' RELEASE-QA-TEXT',''),fs.readFileSync(path.join(root,'new-players/content.html'),'utf8'));
  const visitor=await browser.newContext();await visitor.route('**/*',intercept);const v=await visitor.newPage();
  await v.goto(url+'new-players/',{waitUntil:'domcontentloaded'});await ready(v,'new-players',false);
  assert.ok(!(await v.locator('[data-naxx-guide-content]').innerText()).includes('RELEASE-QA-TEXT'));
  await v.goto(url+'apply/',{waitUntil:'domcontentloaded'});await ready(v,'apply',false);
  assert.equal(await v.locator('#naxx-tally-live-application').evaluate(x=>x.hidden),false);
  await visitor.close();
  remoteHead='f'.repeat(40);await page.getByRole('button',{name:'Save Website Changes'}).click();
  await page.getByText(/GitHub main has changed since this draft began/).waitFor();
  remoteHead=head;
  await page.evaluate(()=>leaveVisualAdminMode());await ready(page,'new-players',false);
  assert.ok(!(await page.locator('[data-naxx-guide-content]').innerText()).includes('RELEASE-QA-TEXT'));
  console.log('PASS: native login, six editor routes, preserved guide ZIP, isolated visitor, application state, stale-source rejection and Exit. No application submitted.');
 }finally{await browser.close();fs.rmSync(temp,{recursive:true,force:true});}
}
run().catch(e=>{console.error('Controlled Easy Save browser test failed:',e.message);process.exitCode=1;});
