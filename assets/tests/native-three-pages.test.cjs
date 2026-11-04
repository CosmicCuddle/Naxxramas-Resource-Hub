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
const faqs = [24,0,0];
assert.ok(index.length<6500,"Original root index loader must stay small");
assert.ok(index.includes("site-content.html"),"Existing site content must remain bootstrapped");
assert.ok(index.includes("naxx-three-pages.js?v=2"));
assert.ok(index.includes("naxx-three-pages.css?v=3"));
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
 if (slug === "new-players") {
   assert.ok(body.includes('id="faq"'),"New Player FAQ section must remain");
 } else {
   assert.ok(!body.includes('id="faq"'),slug+" duplicate FAQ must be removed");
 }
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
// The 35-question onboarding FAQ was intentionally removed: these topics
// remain in New Players and are not repeated on the Rules page.
assert.ok(!rules.includes('id="faq"'),"Rules must not duplicate the new-player FAQ");
assert.ok(rules.includes("How to Submit an In-Game Support Ticket"),
 "The original 3.3.5a support ticket guide must remain");
assert.ok(rules.includes("Rule Enforcement and Bans"),
 "Moderation details must remain");
assert.ok(rules.includes("Vanilla Group Etiquette"),
 "The approved short etiquette guide must remain");
assert.ok(rules.includes("Free for All loot is prohibited"),
 "Preserve the approved loot restrictions");

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
assert.ok(guide.includes("Vanilla Tier 0"),
 "Most fresh characters should be explained as starting at Tier 0");
for(const exception of ["Blood Elves","Draenei","Death Knights"]) {
 assert.ok(guide.includes(exception),
  "Starting progression exception must be explained in guide and FAQ: "+exception);
}
assert.ok(guide.includes("their exact starting stages depend on the server's effective configuration"),
 "Do not invent a blanket starting tier for special race/class cases");
assert.ok(guide.includes("no permanent server-wide level-60 cap"));
assert.ok(guide.includes("patch-V.mpq")&&guide.includes("patch-Z.mpq"));
assert.ok(guide.includes("buy and sell")&&guide.includes("supply and demand"));
const apply=read("apply/content.html");
assert.ok(apply.includes('type="file"')&&apply.includes("disabled"),"Hidden closed-state fallback must remain available for rollback");
assert.ok(apply.includes('<strong>Applications are open.</strong>'),"Application-open status must be clear");
assert.ok(!/<form\b/i.test(apply),"No live form endpoint");
assert.equal((apply.match(/<iframe\b/g)||[]).length,1,
 "Exactly one prepared Tally iframe may exist in the draft");
assert.ok(apply.includes('id="naxx-tally-live-application"')&&apply.includes('hidden aria-label='),
 "Safe initially hidden panel must be revealed by the approved native renderer");
assert.ok(apply.includes('data-tally-src="https://tally.so/embed/q5Lqr8?'),
 "Use only the exact owner-supplied Tally form ID");
assert.ok(!/<iframe\b[^>]*\ssrc=/i.test(apply),
 "Never fetch Tally from the static HTML while applications are closed");
assert.ok(apply.includes('href="https://tally.so/r/q5Lqr8"'),
 "Include a same-form direct fallback for when applications are later opened");
assert.ok(nav.includes("var APPLICATION_EMBED_APPROVED = true;"),
 "Owner-approved release candidate must enable Tally on the Apply page only");
assert.ok(nav.includes("if(!APPLICATION_EMBED_APPROVED)"),
 "Release toggle must retain the ability to close applications if authorised later");
assert.ok(css.includes(".naxx-tally-live-application[hidden] {display:none!important;}") &&
 css.includes(".naxx-guide-disabled[hidden] {display:none!important;}"),
 "The live panel and closed fallback must not be visible at the same time");
const tallyIframeRule=css.split("body.naxx-three-page-route .naxx-tally-live-application iframe {")[1]?.split("}")[0] || "";
assert.ok(tallyIframeRule.includes("background:#15110d;") &&
 !tallyIframeRule.includes("background:#fff;"),
 "Transparent embedded Tally form must use a dark backing so light text remains legible");
assert.ok(apply.includes("transparentBackground=1"),
 "Tally embed transparency must be preserved alongside its dark iframe backing");
assert.ok(apply.includes('accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"'),
 "Private test form must reflect the approved Word DOCX template, not a premature PDF offer");
assert.ok(apply.includes("third-party form service") &&
 apply.includes('href="https://tally.so/help/gdpr"') &&
 !/\bTally\b/i.test(apply.replace(/<!--[\s\S]*?-->/g,"").replace(/<[^>]*>/g," ")),
 "Visible text must omit the provider brand while privacy notice discloses external processing");
assert.ok(apply.includes("one .docx file, up to 10 MB") ||
 apply.includes("one .docx file (up to 10 MB)"),
 "Keep the approved single-DOCX 10-MB limit visible on the open page");
assert.ok(apply.includes("email")&&apply.includes("Discord"));
assert.ok(apply.includes("general <strong>Naxxramas contact email</strong>") &&
 apply.includes("application questions, other enquiries, player support") &&
 guide.includes('mailto:naxxapplicationteam@gmail.com') &&
 rules.includes('mailto:naxxapplicationteam@gmail.com'),
 "Owner-created email must also be displayed for general enquiries and player support");
assert.ok(apply.includes('href="#privacy"') &&
 apply.includes('id="privacy" class="naxx-guide-card"') &&
 apply.includes('aria-labelledby="application-privacy-heading"') &&
 apply.includes("What we collect and why") &&
 apply.includes("How long we keep it") &&
 apply.includes("We rely on the owner's") &&
 apply.includes("legitimate interests") &&
 apply.includes("90 days of submission") &&
 apply.includes("30 days of the decision") &&
 apply.includes("form provider's deleted-submissions area") &&
 apply.includes("UK Information Commissioner's Office") &&
 apply.includes('href="https://tally.so/help/gdpr"'),
 "Privacy notice must be visible, linked and preserve retention/contact and legal review boundaries");
const applicationPrivacy=apply.split('<section id="privacy"')[1]?.split('<section id="upload"')[0] || "";
assert.ok(apply.includes("Application withdrawal or privacy requests:") &&
 apply.includes('href="mailto:naxxapplicationteam@gmail.com"') &&
 applicationPrivacy.includes("For privacy requests, please email") &&
 applicationPrivacy.includes("optional Discord username") &&
 !applicationPrivacy.includes("privately message the owner on Discord") &&
 !apply.includes("or by private Discord message to the owner if you can reach them there") &&
 !apply.includes("Either method is acceptable") &&
 /do not email completed applications/i.test(apply),
 "Privacy and withdrawal contact must be email-only; retain honest disclosure of optional Discord field and no document email rule");
assert.ok(apply.includes("preferred account username"),"Website must match original owner Word application, not community nickname");
assert.ok(!apply.includes("community nickname"),"Outdated applicant identity wording must not reappear");
const officialForm=path.join(root,"apply/naxxramas-application.docx");
assert.ok(fs.existsSync(officialForm),"Owner-approved blank application must be included");
const formBytes=fs.readFileSync(officialForm);
assert.ok(formBytes.length>10000&&formBytes.length<10*1024*1024,"DOCX must be a plausible, under-10-MB file");
assert.equal(formBytes.subarray(0,2).toString("ascii"),"PK","DOCX must be a ZIP container");
assert.equal(crypto.createHash("sha256").update(formBytes).digest("hex"),
 "f6617c8a4da6e9b75b56b020361f8aab57a8cca47921a9225685b0c0cddfa695",
 "Public file must match owner-approved blank DOCX, with website-upload closing instruction");
assert.ok(apply.includes('href="naxxramas-application.docx"')&&apply.includes('download="Naxxramas-Application.docx"'),"Apply page must have direct native download link");
assert.ok(apply.includes('href="naxxramas-application.docx"') &&
 apply.includes("naxx-guide-step"),
 "Approved application download and short step-by-step instructions must remain");
assert.ok(apply.includes("Accounts are arranged manually after acceptance."),
 "Application must not imply automatic account creation");
assert.ok(apply.includes("<strong>one calendar month</strong>") &&
 apply.includes("treated as withdrawn") && apply.includes("not a ban or a rejection"),
 "Accepted nonresponders must have a non-punitive one-month onboarding deadline");
for (const channel of [
 "reply to your acceptance email",
 "send the owner a Discord message",
 "join the Naxxramas Discord server",
 "log in to the WoW server"
]) assert.ok(apply.includes(channel),"Missing accepted joining channel: "+channel);
assert.ok(apply.includes("Any one of these is enough") &&
 apply.includes("the owner can identify you as the accepted applicant"),
 "A single recognisable channel must count; avoid treating anonymous activity as proof");
assert.ok(apply.includes("Any one of these is enough") &&
 apply.includes("treated as withdrawn"),
 "A recognised joining channel must be sufficient and nonresponse non-punitive");
assert.ok(apply.includes("Applications are open.") &&
 apply.includes("submit it securely through the private upload area"),
 "Opened website must give truthful, actionable submission instructions");

const blob=Buffer.from(site);
const hash=crypto.createHash("sha1").update(Buffer.concat([
 Buffer.from("blob "+blob.length+"\0"),blob])).digest("hex");
assert.equal(hash,"71ab9f2bf4cf12282fcbe135f7ec787805715b62",
 "Source must match the owner-approved sanitized main branch without further alterations");
console.log("PASS: original site source, root loader, three native routes and sidebar safety");
console.log("PASS: 12 visible rules, 24 focused New Player FAQ answers and approved open application integration");
console.log("PASS: no private connection file or upload receiver in new page assets");
console.log("PASS: approved public Game Clients privacy correction is incorporated from main.");
console.warn("RELEASE GATE: verify the form provider privacy disclosure and owner-approved email-only contact before release.");
