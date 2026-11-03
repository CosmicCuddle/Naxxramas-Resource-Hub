// Run: node assets/tests/native-three-pages-behavior.test.cjs
// Dependency-free DOM simulation for the real three-page mount script.
// Verifies a delayed native Resource Hub render cannot erase a guide.
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const source = fs.readFileSync(path.join(__dirname,"..","naxx-three-pages.js"),"utf8");
const origin = "https://cosmiccuddle.github.io/Naxxramas-Resource-Hub/";
const fixtures = {
  "new-players": '<section class="naxx-guide-card" id="progression">The guide remains visible.</section>',
  "rules": '<section class="naxx-guide-card" id="rule-12">All rules remain visible.</section>',
  "apply": '<div id="naxx-application-demo"><input type="file" disabled></div>'
};

function createHarness(slug,fail) {
  let currentHTML = "", gridObserver = null, fetchCount = 0, disabled = false;
  const fields = new Map();
  for (const id of ["sectionHeading","sectionSubheading","whProContextGroup",
    "whProContextTitle","contextArtworkKicker","contextArtworkTitle","contextArtworkSummary"]) {
    fields.set(id,{textContent:"Home"});
  }
  const classes = new Set();
  const attrs = Object.create(null);
  const grid = {
    style:{removeProperty(key){if(key!=="height")throw Error("Unexpected style change");}},
    classList:{remove(...names){if(!names.length)throw Error("Missing class");}},
    querySelector(selector){
      if(selector === ".naxx-guide-loading")
        return currentHTML.includes("naxx-guide-loading") ? {} : null;
      if(selector === ".naxx-guide-error")
        return currentHTML.includes("naxx-guide-error") ? {} : null;
      if(selector === "#naxx-application-demo")
        return currentHTML.includes('id="naxx-application-demo"')
          ? {setAttribute(key,value){if(key==="aria-disabled"&&value==="true")disabled=true;}} : null;
      if(selector.startsWith("[data-naxx-guide-content"))
        return currentHTML.includes('data-naxx-guide-content="'+slug+'"') ? {} : null;
      return null;
    },
    get innerHTML(){return currentHTML;},
    set innerHTML(text){
      currentHTML=text;
      if(gridObserver)queueMicrotask(()=>gridObserver());
    }
  };
  const rootURL = new URL(slug+"/",origin);
  const loc = {pathname:rootURL.pathname,href:rootURL.href,
    assign(url){throw Error("Unexpected navigation: "+url);}};
  const document = {
    currentScript:{src:origin+"assets/naxx-three-pages.js?v=3"},
    readyState:"complete",
    body:{classList:{add(x){classes.add(x);}},setAttribute(k,v){attrs[k]=v;}},
    getElementById(id){return id==="resourceGrid"?grid:fields.get(id)||null;},
    addEventListener(){throw Error("No DOMContentLoaded needed in ready state");}
  };
  class MutationObserver {
    constructor(cb){this.cb=cb;}
    observe(target,options) {
      assert.equal(options.childList,true);
      if(target===grid)gridObserver=this.cb;
      else throw Error("Unexpected observed container");
    }
  }
  const context = {
    document,location:loc,URL,MutationObserver,
    fetch(url){
      fetchCount++;
      assert.equal(url.href,origin+slug+"/content.html");
      if(fail)return Promise.resolve({ok:false});
      return Promise.resolve({ok:true,text(){return Promise.resolve(fixtures[slug]);}});
    },
    window:{addEventListener(event){assert.equal(event,"pageshow");}},
    console:{error(){}}
  };
  vm.runInNewContext(source,context,{filename:"naxx-three-pages.js"});
  return {grid,fields,classes,attrs,
    get fetchCount(){return fetchCount;},
    get disabled(){return disabled;},
    rerender(){grid.innerHTML="<div>Native Resource Hub content redraw</div>";}
  };
}
function flush(){return new Promise(resolve=>setImmediate(resolve));}
(async function(){
  for(const slug of ["new-players","rules","apply"]){
    const app=createHarness(slug,false);
    await flush();
    await flush();
    assert.ok(app.grid.innerHTML.includes('data-naxx-guide-content="'+slug+'"'),
      slug+": guide body must load in the native grid");
    assert.ok(app.grid.innerHTML.includes(fixtures[slug]));
    assert.equal(app.fetchCount,1,"Fetch the native page content just once");
    assert.ok(app.classes.has("naxx-three-page-route"));
    assert.equal(app.attrs["data-naxx-guide-page"],slug);
    assert.notEqual(app.fields.get("sectionHeading").textContent,"Home");
    if(slug==="apply")assert.equal(app.disabled,true,"Application must remain disabled");
    app.rerender();
    await flush();
    assert.ok(app.grid.innerHTML.includes(fixtures[slug]),
      slug+": late native render must not erase the guide");
    assert.equal(app.fetchCount,1,"Recover from native render without fetching again");
    await flush();
    assert.equal(app.fetchCount,1,"Mutation observer must not endlessly re-render");
  }
  const failed=createHarness("rules",true);
  await flush();
  assert.ok(failed.grid.innerHTML.includes("naxx-guide-error"),"Failed route has honest error");
  failed.rerender();
  await flush();
  assert.ok(failed.grid.innerHTML.includes("naxx-guide-error"),"Error persists after native render");
  assert.equal(failed.fetchCount,1,"No request storm on unavailable guide content");
  console.log("PASS: native guide routes survive later grid re-render with one fetch.");
  console.log("PASS: active metadata, disabled application and honest loading failure.");
})().catch(err=>{console.error(err);process.exitCode=1;});
