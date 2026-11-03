// Run: node assets/tests/native-three-pages.test.cjs
// Draft-only acceptance checks for native Resource Hub pages.
// Does not call external services or open the application receiver.
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const root = path.resolve(__dirname,"../..");
function read(rel){return fs.readFileSync(path.join(root,rel),"utf8");}
const site = read("site-content.html");
const index = read("index.html");
const nav = read("assets/naxx-three-pages.js");
const bootstrap = read("assets/naxx-three-page-bootstrap.js");
const css = read("assets/naxx-three-pages.css");
const pages = ["new-players","rules","apply"];
const titles = ["New Player Guide","Server Rules","Apply to Join Naxxramas"];
const faqs = [14,9,10];
assert.ok(index.length<6500,"Original root index loader must stay small");
assert.ok(index.includes("site-content.html"),"Existing site content must remain bootstrapped");
assert.ok(index.includes("naxx-three-pages.js?v=2"));
assert.ok(index.includes("naxx-three-pages.css?v=2"));
assert.ok(index.includes("naxx-talent-sets-full-sync.js?v=3"),
  "Newest Talent Sets regression fix must be preserved");
assert.ok(nav.includes('["mainNav","mobileNav"]'),"Both native menus must be extended");
assert.ok(nav.includes('button[data-section="Home"]'),"Links are inserted under native Home");
assert.ok(nav.includes('insertAdjacentElement("afterend",item)'),"Preserve native menu order");
assert.ok(nav.includes('data-naxx-guide-link'),"New navigation needs unique identity");
assert.ok(nav.includes('aria-current'),"Current route should be identified accessibly");
assert.ok(bootstrap.includes("site-content.html")&&bootstrap.includes("naxx-three-pages.js"));
// All existing feature scripts/styles must load identically under nested URLs.
// A missing item here would silently break original addons, talent cards or
// countdowns on only the three new pages.
function assetRefs(text) {
  return [...new Set((text.match(/assets\/[a-zA-Z0-9_.-]+(?:\?v=\d+)?/g)||[]))].sort();
}
assert.deepEqual(assetRefs(bootstrap),assetRefs(index),
 "Nested page bootstrap must match root site asset versions and features");

assert.ok(css.includes("body.naxx-three-page-route"),"All style overrides must be route-scoped");
assert.ok(css.includes(".naxx-guide-qa")&&!css.includes("accordion"),"FAQs must be visible cards");
assert.ok(css.includes("grid-template-columns:minmax(0,1fr)!important"),
  "Blank 170px hero artwork column must be removed from new pages only");
assert.ok(css.includes('body.naxx-three-page-route #contextArtworkPanel .wh-context-media'),
  "Hide unused banner artwork container only on new guide routes");
for(const nativeIcon of ["inv_misc_book_09.jpg","inv_misc_note_05.jpg","inv_misc_key_03.jpg"]) {
  assert.ok(site.includes(nativeIcon),"New page icon must reuse proven original website artwork: "+nativeIcon);
  assert.ok(nav.includes(nativeIcon),"New sidebar link should use same native artwork style: "+nativeIcon);
}
assert.ok(nav.includes('img.className="nav-icon-image"'),"Native sidebar artwork sizing must be retained");
pages.forEach((slug,i)=>{
 const route=read(slug+"/index.html"),body=read(slug+"/content.html");
 assert.ok(route.includes(titles[i]),slug+" heading");
 assert.ok(route.includes("naxx-three-page-bootstrap.js"),slug+" must boot native site");
 assert.ok(body.includes('id="faq"'),slug+" FAQ section");
 assert.equal((body.match(/class="naxx-guide-qa"/g)||[]).length,faqs[i],slug+" full FAQ");
 assert.ok(!/<details\b|<summary\b/i.test(body),slug+" must not collapse content");
 assert.ok(body.includes('href="../')||body.includes("naxx-guide-steps"));
 const unsafeName=["real","mlist",".wtf"].join("");
 assert.ok(!body.toLowerCase().includes(unsafeName),slug+" must not contain private connection filename");
 assert.ok(!/\bset\s+real(?:m)?list\b/i.test(body),"No connection line may be embedded");
});
const rules=read("rules/content.html");
for(let i=1;i<=12;i++)assert.ok(rules.includes('id="rule-'+i+'"'),"Rule "+i+" must be visible");
assert.equal((rules.match(/class="naxx-guide-card naxx-guide-rule"/g)||[]).length,12);
assert.ok(rules.includes("Free for All loot is prohibited"));
assert.ok(rules.includes("ten-player dungeons"));
const guide=read("new-players/content.html");
assert.ok(guide.includes("tiers 1–7"));
assert.ok(guide.includes("no permanent server-wide level-60 cap"));
assert.ok(guide.includes("patch-V.mpq")&&guide.includes("patch-Z.mpq"));
assert.ok(guide.includes("buy and sell")&&guide.includes("supply and demand"));
const apply=read("apply/content.html");
assert.ok(apply.includes('type="file"')&&apply.includes("disabled"),"Upload must be inert");
assert.ok(apply.includes("Applications are not currently open"));
assert.ok(!/<form\b/i.test(apply),"No live form endpoint");
assert.ok(!/<iframe\b/i.test(apply),"No unapproved upload embed");
assert.ok(apply.includes("email")&&apply.includes("Discord"));
const blob=Buffer.from(site);
const hash=crypto.createHash("sha1").update(Buffer.concat([
 Buffer.from("blob "+blob.length+"\0"),blob])).digest("hex");
assert.equal(hash,"3c10ed4829ed02a357ed6dc423b6e59d8344d188",
 "Source site must remain bit-for-bit intact in this draft");
console.log("PASS: original site source, root loader, three native routes and sidebar safety");
console.log("PASS: all 12 visible rules, all 33 anticipated FAQ answers, closed application");
console.log("PASS: no private connection file or upload receiver in new page assets");
console.warn("RELEASE BLOCKER: pre-existing site-content.html contains old connection setup text; owner review/redaction required separately before merge.");
