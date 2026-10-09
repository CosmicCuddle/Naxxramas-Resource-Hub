
/* Naxxramas Resource Hub — editable event dates and countdown runtime. */
(function () {
  "use strict";

  // EVENT SETTINGS
  // Honor reset: Wednesday, 7 October 2026 at 06:00 SERVER time; repeats every 14 days.
  // Raid unlocks: add an ISO 8601 date with explicit offset, e.g. "2026-12-01T18:00:00+02:00".
  // Elemental Invasions use the 1st through 5th of each server-local calendar month.
  var schedule = {
    honor: { anchorYear: 2026, anchorMonth: 10, anchorDay: 7, hour: 6, minute: 0, everyDays: 14 },
    raids: [
      { name: "Molten Core", at: null },
      { name: "Onyxia's Lair", at: null },
      { name: "Blackwing Lair", at: null },
      { name: "Zul'Gurub", at: null },
      { name: "Ruins of Ahn'Qiraj", at: null },
      { name: "Temple of Ahn'Qiraj", at: null },
      { name: "Naxxramas", at: null }
    ],
    elementalInvasion: { day: 1, hour: 0, minute: 0, durationDays: 5 },
    // Original AzerothCore game_event schedule. All times are server-local.
    // 'occurence' and 'length' are measured in MINUTES. End dates cap recurrence.
    callToArms: [
      { eventEntry:18, name:"Alterac Valley", first:"2010-05-07 18:00:00", until:"2030-12-31 16:00:00", occurence:60480, length:6240 },
      { eventEntry:19, name:"Warsong Gulch", first:"2010-04-02 18:00:00", until:"2030-12-31 16:00:00", occurence:60480, length:6240 },
      { eventEntry:20, name:"Arathi Basin", first:"2010-04-23 00:00:00", until:"2030-12-31 23:59:00", occurence:60480, length:4320 },
      { eventEntry:21, name:"Eye of the Storm", first:"2010-04-30 00:00:00", until:"2030-12-31 23:59:00", occurence:60480, length:4320 },
      { eventEntry:53, name:"Strand of the Ancients", first:"2010-04-09 18:00:00", until:"2030-12-31 16:00:00", occurence:60480, length:6240 },
      { eventEntry:54, name:"Isle of Conquest", first:"2010-04-16 18:00:00", until:"2030-12-31 16:00:00", occurence:60480, length:6240 }
    ],
    // Major annual WoW holidays with predictable calendar dates.
    // Each time defaults to 00:00 server time; exact game-world activation may vary.
    seasonalEvents: [
      { name: "Midsummer Fire Festival", start: [6, 21], end: [7, 5] },
      { name: "Brewfest", start: [9, 20], end: [10, 6] },
      { name: "Hallow's End", start: [10, 18], end: [11, 1] },
      { name: "Feast of Winter Veil", start: [12, 15], end: [1, 2] }
    ]
  };

  // Configured SERVER time zone — never infer this from the visitor’s browser.
  // The 7 October 2026 SQL record (06:00 local = 04:00 UTC) indicates UTC+02:00.
  // If your server observes daylight saving, replace this with its actual IANA
  // zone (e.g. "Europe/Berlin") to match its seasonal clock changes.
  // Note: IANA "Etc/GMT-2" deliberately means UTC+02:00 (reversed POSIX sign).
  var ZONE = "Etc/GMT-2";
  var partsFormatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: ZONE, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23"
  });
  var labelFormatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: ZONE, weekday: "long", day: "numeric", month: "long",
    year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23"
  });

  function serverParts(date) {
    var p = {};
    partsFormatter.formatToParts(date).forEach(function (item) {
      if (item.type !== "literal") p[item.type] = Number(item.value);
    });
    return p;
  }

  // Convert a SERVER wall-clock hour to a timestamp; browser timezone is irrelevant.
  function serverTimestamp(year, month, day, hour, minute) {
    var wanted = Date.UTC(year, month - 1, day, hour, minute, 0);
    var guess = wanted;
    for (var i = 0; i < 3; i++) {
      var seen = serverParts(new Date(guess));
      var actualWall = Date.UTC(seen.year, seen.month - 1, seen.day, seen.hour, seen.minute, seen.second);
      guess += wanted - actualWall;
    }
    return guess;
  }

  function nextHonor(now) {
    var h = schedule.honor, p = serverParts(now);
    var epoch = Date.UTC(h.anchorYear, h.anchorMonth - 1, h.anchorDay);
    var today = Date.UTC(p.year, p.month - 1, p.day);
    var span = h.everyDays * 86400000;
    var steps = Math.max(0, Math.floor((today - epoch) / span));
    var target;
    do {
      var day = new Date(epoch + steps * span);
      target = serverTimestamp(day.getUTCFullYear(), day.getUTCMonth() + 1,
        day.getUTCDate(), h.hour, h.minute);
      steps += 1;
    } while (target <= now.getTime());
    return new Date(target);
  }

  // Calendar-month schedule: 1st at configured time through the 6th at
  // the same time. The next start is the following month's 1st, not
  // a fixed count of 30 days.
  function nextElementalInvasion(now) {
    var event = schedule.elementalInvasion, p = serverParts(now);
    var begin = new Date(serverTimestamp(p.year, p.month, event.day, event.hour, event.minute));
    var end = new Date(serverTimestamp(p.year, p.month,
      event.day + event.durationDays, event.hour, event.minute));

    if (now < begin) return { date: begin, isActive: false };
    if (now < end) return { date: end, isActive: true };

    var next = new Date(Date.UTC(p.year, p.month, 1));
    return {
      date: new Date(serverTimestamp(next.getUTCFullYear(),
        next.getUTCMonth() + 1, event.day, event.hour, event.minute)),
      isActive: false
    };
  }

  function readDate(value) {
    if (typeof value !== "string" || !/[zZ]|[+-]\d\d:\d\d$/.test(value)) return null;
    var timestamp = Date.parse(value);
    return Number.isFinite(timestamp) ? new Date(timestamp) : null;
  }

  function nextRaid(now) {
    return schedule.raids
      .map(function (raid) { return { name: raid.name, date: readDate(raid.at) }; })
      .filter(function (raid) { return raid.date && raid.date.getTime() > now.getTime(); })
      .sort(function (a, b) { return a.date.getTime() - b.date.getTime(); })[0] || null;
  }

  function nextSeasonal(now) {
    var year = serverParts(now).year;
    var upcoming = [], active = [];
    schedule.seasonalEvents.forEach(function (event) {
      for (var y = year - 1; y <= year + 1; y++) {
        var endYear = y + (event.end[0] < event.start[0] ? 1 : 0);
        var start = new Date(serverTimestamp(y, event.start[0], event.start[1], 0, 0));
        var ending = new Date(serverTimestamp(endYear, event.end[0], event.end[1] + 1, 0, 0));
        if (start <= now && now < ending) {
          active.push({ name: event.name, date: ending, isActive: true });
        } else if (start > now) {
          upcoming.push({ name: event.name, date: start, isActive: false });
        }
      }
    });
    if (active.length) return active.sort(function (a, b) { return a.date - b.date; })[0];
    return upcoming.sort(function (a, b) { return a.date - b.date; })[0] || null;
  }

  // Wrath of the Lich King-style Darkmoon Faire: first Sunday through Saturday.
  // AzerothCore default location schedule: Jan Mulgore, Feb Terokkar, Mar Elwynn.
  // Faire is in Terokkar Forest, just south of Shattrath, not inside Shattrath City.
  function firstSunday(year, month) {
    var weekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
    return 1 + (7 - weekday) % 7;
  }

  function darkmoonVisit(year, month) {
    var day = firstSunday(year, month);
    var locations = [
      { name: "Mulgore", info: "Southwest of Thunder Bluff" },
      { name: "Terokkar Forest", info: "Near Shattrath City" },
      { name: "Elwynn Forest", info: "South of Goldshire" }
    ];
    var location = locations[(month - 1) % 3];
    return {
      location: location.name, locationInfo: location.info,
      begins: new Date(serverTimestamp(year, month, day, 0, 1)),
      ends: new Date(serverTimestamp(year, month, day + 7, 0, 0))
    };
  }

  function nextDarkmoon(now) {
    var year = serverParts(now).year, month = serverParts(now).month;
    var current = null, upcoming = null, nextAfter = null;
    for (var i = -1; i <= 14; i++) {
      var monthIndex = (year * 12 + month - 1) + i;
      var y = Math.floor(monthIndex / 12);
      var m = (monthIndex % 12) + 1;
      var visit = darkmoonVisit(y, m);
      if (visit.begins <= now && now < visit.ends) current = visit;
      if (visit.begins > now && (!upcoming || visit.begins < upcoming.begins)) upcoming = visit;
    }
    return { active: current, upcoming: upcoming };
  }

  // SQL DATETIME is server-local: parse without applying the website visitor's timezone.
  function parseEventWallTime(value) {
    var match = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(value || "");
    if (!match) return null;
    var y=+match[1],mo=+match[2],d=+match[3],h=+match[4],mi=+match[5],s=+match[6];
    var timestamp=Date.UTC(y,mo-1,d,h,mi,s), check=new Date(timestamp);
    if (check.getUTCFullYear()!==y || check.getUTCMonth()+1!==mo ||
        check.getUTCDate()!==d || check.getUTCHours()!==h ||
        check.getUTCMinutes()!==mi || check.getUTCSeconds()!==s) return null;
    return timestamp;
  }

  function wallTimeToDate(timestamp) {
    var wall=new Date(timestamp);
    return new Date(serverTimestamp(wall.getUTCFullYear(),wall.getUTCMonth()+1,
      wall.getUTCDate(),wall.getUTCHours(),wall.getUTCMinutes())+wall.getUTCSeconds()*1000);
  }

  function nextCallToArms(now) {
    var p=serverParts(now), nowWall=Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute,p.second);
    var active=[], upcoming=[];
    schedule.callToArms.forEach(function (event) {
      var first=parseEventWallTime(event.first), cutoff=parseEventWallTime(event.until);
      var interval=event.occurence*60000, duration=event.length*60000;
      if (first===null || cutoff===null || !(interval>0) || !(duration>0)) return;
      var closest=Math.max(0,Math.floor((nowWall-first)/interval));
      for (var shift=-1; shift<=1; shift++) {
        var iteration=closest+shift;
        if (iteration<0) continue;
        var wallStart=first+iteration*interval;
        if (wallStart>cutoff) continue;
        var wallEnd=Math.min(wallStart+duration,cutoff);
        if (wallEnd<=wallStart) continue;
        var one={ name:event.name,eventEntry:event.eventEntry,
          begins:wallTimeToDate(wallStart),ends:wallTimeToDate(wallEnd) };
        if (one.ends<=now) continue;
        if (one.begins<=now) active.push(one); else upcoming.push(one);
      }
    });
    active.sort(function (a,b) { return a.begins-b.begins; });
    upcoming.sort(function (a,b) { return a.begins-b.begins; });
    return { active:active[0] || null, upcoming:upcoming[0] || null };
  }

  function clockHTML() {
    return '<div class="nc-clock" role="timer" aria-live="off" data-clock hidden>' +
      ['days', 'hours', 'minutes', 'seconds'].map(function (part) {
        return '<div class="nc-clock-unit"><span class="nc-clock-number" data-part="' +
          part + '">--</span><span class="nc-clock-label">' + part + '</span></div>';
      }).join('') + '</div>';
  }

  function makeCard(type, symbol, label, title) {
    var card = document.createElement("article");
    card.className = "nc-card nc-card--" + type;
    card.innerHTML =
      '<div class="nc-card-head"><span class="nc-seal" aria-hidden="true">' + symbol + '</span>' +
      '<div><div class="nc-card-label">' + label + '</div>' +
      '<h3 class="nc-card-title">' + title + '</h3></div></div>' +
      clockHTML() +
      '<div class="nc-pending" data-pending>Awaiting a confirmed date</div>' +
      '<p class="nc-note" data-note></p>';
    return card;
  }

  function makeMiniCard(type, symbol, heading) {
    var card = document.createElement("article");
    card.className = "nc-mini nc-mini--" + type;
    card.innerHTML =
      '<div class="nc-mini-heading"><span class="nc-mini-seal" aria-hidden="true">' + symbol + '</span>' +
      '<h3>' + heading + '</h3></div>' +
      '<div class="nc-mini-current" data-mini-current></div>' +
      '<div class="nc-mini-location" data-mini-location></div>' +
      clockHTML() +
      '<div class="nc-pending" data-pending>Awaiting server schedule</div>' +
      '<p class="nc-note" data-note></p>';
    return card;
  }

  function buildSection() {
    var section = document.createElement("section");
    section.id = "naxx-countdowns";
    section.setAttribute("aria-labelledby", "naxx-countdowns-title");
    section.innerHTML = '<div class="nc-masthead" aria-hidden="true"><span class="nc-masthead-wing">✦ ━━━</span><span class="nc-masthead-crest">N</span><span class="nc-masthead-wing">━━━ ✦</span></div>' +
      '<span class="nc-kicker">The Naxxramas Realm Almanac</span>' +
      '<h2 class="nc-title" id="naxx-countdowns-title">Events Across Azeroth</h2>' +
      '<div class="nc-heading-rule" aria-hidden="true"></div>' +
      '<div class="nc-grid" aria-label="Major server events"></div>' +
      '<div class="nc-mini-grid" aria-label="Recurring realm events"></div>' +
      '<p class="nc-footer">Countdowns use configured server time (UTC+02:00). Elemental Invasions run from the 1st through the 5th of each month. Seasonal dates follow the standard WoW calendar; actual server activation may vary.</p>';
    var grid = section.querySelector(".nc-grid");
    grid.appendChild(makeCard("honor", "H", "Fortnightly Cycle", "Honor Reset"));
    grid.appendChild(makeCard("raid", "R", "Classic Raid Phases", "Next Raid Unlock"));
    grid.appendChild(makeCard("invasion", "E", "World Event", "Elemental Invasion"));
    grid.appendChild(makeCard("seasonal", "S", "World Holidays", "Next Seasonal Event"));
    var mini = section.querySelector(".nc-mini-grid");
    mini.appendChild(makeMiniCard("darkmoon", "D", "Darkmoon Faire"));
    mini.appendChild(makeMiniCard("cta", "P", "Battleground Call to Arms"));
    return section;
  }

  function pad(number) { return String(number).padStart(2, "0"); }

  function present(card, date, note, pending) {
    var clock = card.querySelector("[data-clock]");
    var pendingNode = card.querySelector("[data-pending]");
    var noteNode = card.querySelector("[data-note]");
    if (!date) {
      clock.hidden = true;
      pendingNode.hidden = false;
      pendingNode.textContent = pending;
      noteNode.textContent = note;
      return;
    }
    pendingNode.hidden = true;
    clock.hidden = false;
    var remaining = Math.max(0, Math.floor((date.getTime() - Date.now()) / 1000));
    var units = {
      days: Math.floor(remaining / 86400),
      hours: Math.floor((remaining % 86400) / 3600),
      minutes: Math.floor((remaining % 3600) / 60),
      seconds: remaining % 60
    };
    Object.keys(units).forEach(function (key) {
      card.querySelector('[data-part="' + key + '"]').textContent = pad(units[key]);
    });
    noteNode.textContent = note + " — " + labelFormatter.format(date) + " server time";
  }

  function updateMini(miniCards, now) {
    var darkmoon = nextDarkmoon(now);
    var active = darkmoon.active, upcoming = darkmoon.upcoming;
    var dm = miniCards[0];
    dm.querySelector("[data-mini-current]").textContent = active ? "Faire open now" : "Next visit";
    dm.querySelector("[data-mini-location]").textContent =
      (active || upcoming) ? ((active || upcoming).location + " — " + (active || upcoming).locationInfo) : "Location not available";
    var dmDate = active ? active.ends : (upcoming ? upcoming.begins : null);
    var nextText = active && upcoming ?
      (" Next: " + upcoming.location + " (" + upcoming.locationInfo + "), " +
       labelFormatter.format(upcoming.begins) + " server time.") : "";
    present(dm, dmDate, active ? "Faire closes" + nextText : "Faire opens", "Schedule unavailable");

    var cta = nextCallToArms(now);
    var bg = miniCards[1];
    bg.querySelector("[data-mini-current]").textContent =
      cta.active ? "Active: " + cta.active.name :
      cta.upcoming ? "Next: " + cta.upcoming.name : "No scheduled battleground";
    bg.querySelector("[data-mini-location]").textContent =
      cta.active && cta.upcoming ? "Coming next: " + cta.upcoming.name +
        " — " + labelFormatter.format(cta.upcoming.begins) + " server time" :
      cta.active ? "Bonus weekend is active now" :
      cta.upcoming ? "The next battleground bonus weekend" :
        "No remaining events within the server schedule";
    var featured = cta.active || cta.upcoming;
    present(bg, featured ? (cta.active ? featured.ends : featured.begins) : null,
      cta.active ? "Call to Arms ends" :
      cta.upcoming ? "Call to Arms begins" :
        "Contact the server administrator for new dates.",
      "No further events scheduled");
  }

  function update(section) {
    var now = new Date();
    var cards = section.querySelectorAll(".nc-card");
    present(cards[0], nextHonor(now), "Next automatic honor reset", "");
    var raid = nextRaid(now);
    present(cards[1], raid ? raid.date : null,
      raid ? raid.name + " unlocks" : "Classic Phase 1: Molten Core / Onyxia; Phase 3: Blackwing Lair; Phase 4: Zul\u0027Gurub; Phase 5: Ahn\u0027Qiraj; Phase 6: Naxxramas.",
      "Schedule to be announced");
    var invasion = nextElementalInvasion(now), invasionCard = cards[2];
    invasionCard.querySelector(".nc-card-label").textContent =
      invasion.isActive ? "Invasion Underway" : "Monthly World Event";
    present(invasionCard, invasion.date,
      invasion.isActive ? "Elemental Invasion ends" : "Next Elemental Invasion begins",
      "Schedule unavailable");
    var seasonal = nextSeasonal(now);
    present(cards[3], seasonal ? seasonal.date : null,
      seasonal ? (seasonal.name + (seasonal.isActive ? " ends" : " begins")) : "Standard WoW calendar",
      "Seasonal calendar unavailable");
    updateMini(section.querySelectorAll(".nc-mini"), now);
  }


  /* Route-safe Home-only board.
     The old implementation checked only whether its Home introduction still existed.
     It never verified the active breadcrumb, so the board leaked into other views. */
  var homeIntroCache = null, lastChecked = 0, lastAnchor = null;
  var BREADCRUMB_HINTS = [
    "[aria-label*='breadcrumb' i]", "[class*='breadcrumb' i]",
    "[class*='crumb' i]", "[id*='breadcrumb' i]",
    "nav", "[role='navigation']"
  ].join(",");
  function visible(el) {
    if (!el || !el.isConnected || !el.getClientRects || !el.getClientRects().length) return false;
    for (var p=el; p && p.nodeType===1; p=p.parentElement) {
      if (p.hidden || p.getAttribute("aria-hidden")==="true" || p.hasAttribute("inert")) return false;
      var style=window.getComputedStyle(p);
      if (style.display==="none" || style.visibility==="hidden" || style.visibility==="collapse") return false;
    }
    return true;
  }
  function normalize(text) {
    return (text || "").replace(/\s+/g," ").trim();
  }
  function breadcrumbCandidates() {
    var found = [];
    var nodes = document.querySelectorAll(BREADCRUMB_HINTS);
    for (var i=0; i<nodes.length; i++) {
      var el=nodes[i];
      if (!visible(el) || el.closest("#naxx-countdowns")) continue;
      var text=normalize(el.innerText || el.textContent);
      if (text.length<8 || text.length>230) continue;
      if (!/naxxramas/i.test(text) || !/database/i.test(text)) continue;
      found.push({element:el,text:text});
    }
    found.sort(function(a,b){return a.text.length-b.text.length;});
    return found;
  }
  function breadcrumbHome(text) {
    var t=normalize(text).toLowerCase();
    var pos=t.lastIndexOf("database");
    if (pos===-1) return false;
    var after=t.slice(pos+"database".length);
    after=after.replace(/^[\s›»>\/:|·•\-\u2192]+/g,"");
    // Strict: other pages may keep a Home breadcrumb as an ancestor.
    // Permit only the two badges shown next to the Home breadcrumb.
    var tail=after.replace(/[›»>\/:|·•\-\u2192]+/g," ").replace(/\s+/g," ").trim();
    return /^home(?:\s+(?:resource hub|wotlk\s*3[.]3[.]5a?))*$/.test(tail);
  }
  function selectedSidebarPage() {
    // Active sidebar selection beats a stale or shared breadcrumb.
    var nodes=document.querySelectorAll(
      "aside a,aside button,aside [role='button']," +
      "[class*='sidebar' i] a,[class*='sidebar' i] button," +
      "[class*='side-nav' i] a,[class*='side-nav' i] button");
    for (var i=0;i<nodes.length;i++) {
      var el=nodes[i],label=normalize(el.textContent);
      if (!label || label.length>55 || !visible(el)) continue;
      for(var p=el,depth=0;p&&depth<3;p=p.parentElement,depth++) {
        if (p.getAttribute("aria-current")==="page" ||
            p.getAttribute("aria-selected")==="true" ||
            p.classList.contains("active") || p.classList.contains("selected") ||
            p.classList.contains("is-active") || p.classList.contains("current")) return label;
      }
    }
    return null;
  }
  function isHomeRoute() {
    if (/\/(?:patches|change-notes)(?:\/|$)/i.test(window.location.pathname)) return false;
    var selected=selectedSidebarPage();
    if (selected && selected!=="Home") return false;
    var crumbs=breadcrumbCandidates();
    if (crumbs.length) return breadcrumbHome(crumbs[0].text);
    // If breadcrumbs cannot be read, require a positive selected Home link.
    return selected==="Home";
  }
  function findHomeIntroduction() {
    if (homeIntroCache && visible(homeIntroCache)) return homeIntroCache;
    var nodes=document.querySelectorAll("p, .page-description, .page-subtitle, .section-subtitle, .intro");
    for(var i=0;i<nodes.length;i++) {
      var el=nodes[i], text=normalize(el.textContent);
      if (!visible(el) || text.indexOf("Everything your Naxxramas character needs in one place")!==0 ||
          text.length>500) continue;
      var target=el, parent=el.parentElement;
      if (parent && parent.children.length<=8 && normalize(parent.textContent).length<1400) {
        var heading=parent.querySelector("h1,h2,h3,h4");
        if (heading && normalize(heading.textContent)==="Home" && visible(heading)) target=parent;
      }
      if (target.nextElementSibling && target.nextElementSibling.matches("hr")) {
        target=target.nextElementSibling;
      }
      homeIntroCache=target;
      return target;
    }
    return null;
  }
  function pickFullWidthMount(anchor) {
    // Climb out of narrow two-column wrappers; mount the board in a full-width row.
    var node=anchor, viewport=window.innerWidth || document.documentElement.clientWidth || 1280;
    for (var depth=0;depth<7 && node && node.parentElement;depth++) {
      var box=node.getBoundingClientRect(),outer=node.parentElement.getBoundingClientRect();
      if (outer.width>0 &&
          outer.width>box.width*1.36 &&
          outer.width>=Math.min(viewport*0.66,750)) {
        return {sibling:node,parent:node.parentElement};
      }
      node=node.parentElement;
    }
    return {sibling:anchor,parent:anchor.parentElement};
  }
  var bannerStyled=false;
  function markHomeBanner() {
    if (bannerStyled) return;
    // Match the existing Home banner's unique description (no hardcoded layout class).
    var nodes=document.querySelectorAll("p,small,span,.hero-description,.hero-subtitle");
    for(var i=0;i<nodes.length;i++) {
      var el=nodes[i],label=normalize(el.textContent);
      if (label.indexOf("Quick access to your latest guides, downloads and project resources")!==0 ||
          label.length>190 || !visible(el)) continue;
      var node=el;
      for(var j=0;j<6 && node.parentElement;j++){
        var parent=node.parentElement;
        if (parent.getBoundingClientRect().width>
            Math.min((window.innerWidth||1280)*.66,890)) {
          parent.classList.add("naxx-v3-home-banner");
          bannerStyled=true;
          return;
        }
        node=parent;
      }
      return;
    }
  }
  function syncHome(section) {
    var routeHome=isHomeRoute();
    var anchor=routeHome ? findHomeIntroduction() : null;
    var show=!!(anchor && visible(anchor));
    document.body.classList.toggle("naxx-v3-home-active",show);
    if (!show) {
      if(section.isConnected) section.remove();
      return;
    }
    var slot=pickFullWidthMount(anchor);
    if (!slot.parent) return;
    anchor.classList.add("naxx-v3-home-intro");
    slot.parent.classList.add("naxx-v3-home-layout");
    if (section.parentNode!==slot.parent || slot.sibling.nextElementSibling!==section) {
      slot.sibling.insertAdjacentElement("afterend",section);
    }
    markHomeBanner();
  }
  function start() {
    if (document.getElementById("naxx-countdowns")) return;
    var section=buildSection();
    update(section);
    // Never mount by default: only the selected Home route earns a visible board.
    syncHome(section);
    var queued=false;
    var observer=new MutationObserver(function(mutations) {
      if (queued) return;
      var relevant=mutations.some(function(m) {
        if (m.target.nodeType===1 && m.target.closest &&
            m.target.closest("#naxx-countdowns")) return false;
        return true;
      });
      if(!relevant) return;
      queued=true;
      window.requestAnimationFrame(function() {
        queued=false;
        syncHome(section);
      });
    });
    observer.observe(document.body,{
      childList:true,subtree:true,characterData:true,attributes:true,
      attributeFilter:["style","class","hidden","aria-hidden","aria-current","aria-selected"]
    });
    ["hashchange","popstate","pageshow"].forEach(function(eventName){
      window.addEventListener(eventName,function(){syncHome(section);});
    });
    window.setInterval(function(){
      syncHome(section);
      if(section.isConnected) update(section);
    },1000);
  }
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",start,{once:true});
  else start();
})();
