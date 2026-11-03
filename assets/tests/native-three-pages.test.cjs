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
const faqs = [38,35,8];
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
for (const question of [
 "How do I set up the game client?",
 "What does Individual Progression (IP) do?",
 "What do the Vanilla tiers mean?",
 "How do I know which tier my character is in?",
 "What are Playerbots, and how do they work?",
 "Do Playerbots accept and finish their own quests?"
]) assert.ok(rules.includes(question),"Missing owner-requested onboarding FAQ: "+question);
assert.ok(rules.includes("normal-player tier display or command has not yet been confirmed"),
 "Do not claim unverified player-facing IP tier commands exist");
assert.ok(rules.includes("precise Naxxramas setup is being verified"),
 "Do not claim unverified installed Playerbot quest automation");
assert.ok(!rules.includes("May an all-human group farm an easier dungeon?"),
 "Replace the repetitive rules FAQ with practical onboarding questions");

for(const topic of ["client","ip","bots","gameplay","help"]) {
  assert.ok(rules.includes('id="faq-'+topic+'"'),"FAQ topic anchor missing: "+topic);
}
assert.equal((rules.match(/class="naxx-guide-faq-topic"/g)||[]).length,5,
 "All five FAQ topic sections must be present");
assert.equal((rules.match(/class="naxx-guide-qa"/g)||[]).length,35,
 "All 35 onboarding FAQ questions must be present");
assert.ok(rules.includes('aria-label="Jump to FAQ topic"'),"Readers need quick topic navigation");
assert.ok(!/<details\b|<summary\b/i.test(rules),
 "All twelve rules and FAQ answers must remain visible without accordions");
assert.ok(rules.includes("Tier 0")&&rules.includes("Molten Core")&&rules.includes("Ahn'Qiraj"),
 "The tier FAQ should explain Vanilla milestones");
assert.ok(rules.includes("Will Playerbots finish my quests for me?")&&rules.includes("Will a new alt share my main character's tier?"),
 "FAQ must cover bot quests and independent character progression");


assert.ok(rules.includes("ten-player dungeons"));
const guide=read("new-players/content.html");
// New guide FAQ covers all three eras with manageable topical navigation.
for(const topic of ["client","ip","vanilla","tbc","wotlk","bots","help"])
 assert.ok(guide.includes('id="faq-'+topic+'"'),"Guide FAQ topic missing: "+topic);
assert.equal((guide.match(/class="naxx-guide-faq-topic"/g)||[]).length,7);
assert.ok(guide.includes("Vanilla — Tier 0 to Tier 7"));
assert.ok(guide.includes("The Burning Crusade — Outland & Tiers"));
assert.ok(guide.includes("Wrath of the Lich King — Northrend & Tiers"));
for(const question of [
 "What do Vanilla Tiers 4, 5, 6 and 7 represent?",
 "What do early TBC stages 8 and 9 represent?",
 "What do later TBC stages 10, 11 and 12 represent?",
 "What do Wrath stages 14, 15 and 16 represent?",
 "What do Wrath stages 17 and 18 represent?",
 "Why is the TBC-to-Wrath boundary sometimes called stage 13?",
 "Do roaming Playerbots accept and complete their own quests?"
]) assert.ok(guide.includes(question),"Guide FAQ missing: "+question);
assert.ok(guide.includes("still being developed")&&guide.includes("not yet verified"),
 "Future era purchase and installed tier/bot claims must not be treated as live");
assert.ok(guide.includes("Jump to New Player Guide FAQ topic"),
 "Long FAQ needs jump links");
assert.ok(!/<details\b|<summary\b/i.test(guide),"All guide FAQ answers remain visible");

assert.ok(guide.includes("tiers 1–7"));
assert.ok(guide.includes("Vanilla Tier 0") && rules.includes("Tier 0"),
 "Most fresh characters should be explained as starting at Tier 0");
for(const exception of ["Blood Elves","Draenei","Death Knights"]) {
 assert.ok(guide.includes(exception) && rules.includes(exception),
  "Starting progression exception must be explained in guide and FAQ: "+exception);
}
assert.ok(rules.includes("exact starting stage depends on the character type and server configuration"),
 "Do not invent a blanket starting tier for special race/class cases");
assert.ok(guide.includes("no permanent server-wide level-60 cap"));
assert.ok(guide.includes("patch-V.mpq")&&guide.includes("patch-Z.mpq"));
assert.ok(guide.includes("buy and sell")&&guide.includes("supply and demand"));
const apply=read("apply/content.html");
assert.ok(apply.includes('type="file"')&&apply.includes("disabled"),"Upload must be inert");
assert.ok(apply.includes("Applications are not currently open"));
assert.ok(!/<form\b/i.test(apply),"No live form endpoint");
assert.ok(!/<iframe\b/i.test(apply),"No unapproved upload embed");
assert.ok(apply.includes('accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"'),
 "Private test form must reflect the approved Word DOCX template, not a premature PDF offer");
assert.ok(apply.includes("private Tally upload")&&apply.includes("not connected or active"),
 "Tally setup is a plan, not a functional submission receiver");
assert.ok(apply.includes("one Word DOCX file, up to 10 MB"),
 "Keep planned Free-tier upload limit visible during review");
assert.ok(apply.includes("email")&&apply.includes("Discord"));
assert.ok(apply.includes("preferred account username"),"Website must match original owner Word application, not community nickname");
assert.ok(!apply.includes("community nickname"),"Outdated applicant identity wording must not reappear");
assert.ok(apply.includes("three-page editable Word (DOCX)")&&apply.includes("17 questions and fields"),
 "Working document and original application content must remain identified");
assert.ok(apply.includes("Accounts are arranged manually after acceptance."),
 "Application must not imply automatic account creation");
assert.ok(apply.includes("No live download is offered in this preview."),
 "Do not offer the private review copy as a published official form");

const blob=Buffer.from(site);
const hash=crypto.createHash("sha1").update(Buffer.concat([
 Buffer.from("blob "+blob.length+"\0"),blob])).digest("hex");
assert.equal(hash,"71ab9f2bf4cf12282fcbe135f7ec787805715b62",
 "Source must match the owner-approved sanitized main branch without further alterations");
console.log("PASS: original site source, root loader, three native routes and sidebar safety");
console.log("PASS: 12 visible rules, 81 FAQ answers across three pages, closed application");
console.log("PASS: no private connection file or upload receiver in new page assets");
console.log("PASS: approved public Game Clients privacy correction is incorporated from main.");
console.warn("REVIEW GATES: confirm final Rules wording, real-browser behavior and disabled application process before merge.");
