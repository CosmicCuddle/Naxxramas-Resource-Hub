// Run: node assets/tests/native-three-pages-navigation.test.cjs
// The original sidebar is rebuilt dynamically. Verify our three native links
// survive a rebuild in desktop and mobile menus and remain keyboard buttons.
"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const source=fs.readFileSync(path.join(__dirname,"..","naxx-three-pages.js"),"utf8");
const origin="https://cosmiccuddle.github.io/Naxxramas-Resource-Hub/";
const desired=["Home","new-players","rules","apply","Resources"];

class Button {
  constructor(kind,attrs){
    this.kind=kind;
    this.attrs=Object.assign({},attrs);
    this.styles=new Set(kind==="Home"?["active"]:[]);
    const that=this;
    this.classList={
      add(value){that.styles.add(value);},
      remove(value){that.styles.delete(value);},
      contains(value){return that.styles.has(value);}
    };
    this.label={textContent:kind};
    this.icon={textContent:"",appendChild(img){this.img=img;}};
  }
  cloneNode(){return new Button("cloned",this.attrs);}
  removeAttribute(key){delete this.attrs[key];}
  setAttribute(key,value){this.attrs[key]=value;}
  getAttribute(key){return this.attrs[key]||null;}
  querySelectorAll(selector){return selector===".nav-label-edit"?[]:[];}
  querySelector(selector){
    if(selector===".nav-button-main > span:last-child")return this.label;
    if(selector===".nav-icon")return this.icon;
    return null;
  }
  addEventListener(name,handler){assert.equal(name,"click");this.handler=handler;}
  insertAdjacentElement(side,child){
    assert.equal(side,"afterend");
    const arr=this.parent.items;
    const i=arr.indexOf(this);
    if(child.parent)child.parent.items.splice(child.parent.items.indexOf(child),1);
    arr.splice(i+1,0,child);
    child.parent=this.parent;
  }
  get previousElementSibling(){
    if(!this.parent)return null;
    return this.parent.items[this.parent.items.indexOf(this)-1]||null;
  }
}
class Sidebar {
  constructor(){this.reset();}
  reset(){
    this.items=[new Button("Home",{"data-section":"Home"}),new Button("Resources",{})];
    this.items.forEach(item=>item.parent=this);
  }
  querySelector(selector){
    if(selector==='button[data-section="Home"]')
      return this.items.find(item=>item.getAttribute("data-section")==="Home");
    const match=selector.match(/data-naxx-guide-link="([^"]+)"/);
    if(match)return this.items.find(item=>item.getAttribute("data-naxx-guide-link")===match[1])||null;
    return null;
  }
  querySelectorAll(selector){
    return selector==="button.active"?this.items.filter(item=>item.classList.contains("active")):[];
  }
  labels(){return this.items.map(item=>item.getAttribute("data-naxx-guide-link")||item.kind);}
}
function run(pathname){
  const desktop=new Sidebar(),mobile=new Sidebar(),observers=new Map(),assigned=[];
  const document={
    currentScript:{src:origin+"assets/naxx-three-pages.js?v=3"},
    readyState:"complete",body:{classList:{add(){}},setAttribute(){}},
    getElementById(id){return id==="mainNav"?desktop:id==="mobileNav"?mobile:null;},
    createElement(tag){assert.equal(tag,"img");return {setAttribute(){}};}
  };
  class MutationObserver{
    constructor(cb){this.cb=cb;}
    observe(target,options){
      assert.equal(options.childList,true);
      observers.set(target,this.cb);
    }
  }
  const url=new URL(pathname,origin);
  const location={pathname:url.pathname,href:url.href,assign(next){assigned.push(next);}};
  vm.runInNewContext(source,{
    document,MutationObserver,URL,location,window:{addEventListener(){}},
    console:{error(){throw Error("Unexpected error")}}
  });
  for(const nav of [desktop,mobile]){
    assert.deepEqual(nav.labels(),desired);
    assert.equal(nav.items.length,5,"All original entries must remain");
    const active=nav.items.filter(item=>item.classList.contains("active"))
      .map(item=>item.getAttribute("data-naxx-guide-link")||"Home");
    assert.deepEqual(active,[pathname==="./"?"Home":"rules"]);
    for(const button of nav.items.slice(1,4)){
      assert.equal(button.type,"button");
      assert.equal(button.getAttribute("data-section"),null);
      assert.ok(button.icon.img,"Warcraft image must be attached");
      assert.equal(button.icon.img.className,"nav-icon-image");
      assert.ok(button.handler,"Native buttons must be keyboard-clickable");
    }
    nav.reset(); // Native buildSideNav() can erase custom entries later.
    observers.get(nav)();
    assert.deepEqual(nav.labels(),desired,"Sidebar entries must be restored after rebuild");
    observers.get(nav)();
    assert.deepEqual(nav.labels(),desired,"Reinspection must never duplicate links");
  }
  const rules=desktop.items.find(item=>item.getAttribute("data-naxx-guide-link")==="rules");
  rules.handler({preventDefault(){},stopPropagation(){}});
  if(pathname==="./")assert.equal(assigned[0],origin+"rules/");
  else assert.equal(assigned.length,0,"Do not navigate again when already on this page");
}
run("./");
run("rules/");
console.log("PASS: original desktop/mobile navigation, placement, icons and active state.");
console.log("PASS: links recover after native sidebar rebuild without duplicates.");
console.log("PASS: native button navigation on Home and no redundant same-page navigation.");
