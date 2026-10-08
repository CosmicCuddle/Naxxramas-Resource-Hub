
/* Naxxramas Resource Hub — editable event dates and countdown runtime. */
(function () {
  "use strict";

  // EVENT SETTINGS
  // Honor reset: Wednesday, 7 October 2026 at 06:00 SERVER time; repeats every 14 days.
  // Raid and invasion unlocks: add an ISO 8601 date with explicit offset, e.g. "2026-12-01T18:00:00+02:00".
  // Keep "at: null" until a date is confirmed. No date is fabricated.
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
    elementalInvasion: { at: null },
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

  function buildSection() {
    var section = document.createElement("section");
    section.id = "naxx-countdowns";
    section.setAttribute("aria-labelledby", "naxx-countdowns-title");
    section.innerHTML = '<span class="nc-kicker">Naxxramas Resource Hub</span>' +
      '<h2 class="nc-title" id="naxx-countdowns-title">Azerothian Event Countdowns</h2>' +
      '<div class="nc-heading-rule" aria-hidden="true"></div>' +
      '<div class="nc-grid"></div>' +
      '<p class="nc-footer">Countdowns use configured server time (UTC+02:00). Seasonal dates follow the standard WoW calendar; actual server activation may vary.</p>';
    var grid = section.querySelector(".nc-grid");
    grid.appendChild(makeCard("honor", "H", "Fortnightly Cycle", "Honor Reset"));
    grid.appendChild(makeCard("raid", "R", "Classic Raid Phases", "Next Raid Unlock"));
    grid.appendChild(makeCard("invasion", "E", "World Event", "Elemental Invasion"));
    grid.appendChild(makeCard("seasonal", "S", "World Holidays", "Next Seasonal Event"));
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

  function update(section) {
    var now = new Date();
    var cards = section.querySelectorAll(".nc-card");
    present(cards[0], nextHonor(now), "Next automatic honor reset", "");
    var raid = nextRaid(now);
    present(cards[1], raid ? raid.date : null,
      raid ? raid.name + " unlocks" : "Classic Phase 1: Molten Core / Onyxia; Phase 3: Blackwing Lair; Phase 4: Zul\u0027Gurub; Phase 5: Ahn\u0027Qiraj; Phase 6: Naxxramas.",
      "Schedule to be announced");
    var invasion = readDate(schedule.elementalInvasion.at);
    present(cards[2], invasion && invasion > now ? invasion : null,
      invasion && invasion > now ? "Elemental Invasion begins" : "The invasion start date has not been set.",
      "Date to be announced");
    var seasonal = nextSeasonal(now);
    present(cards[3], seasonal ? seasonal.date : null,
      seasonal ? (seasonal.name + (seasonal.isActive ? " ends" : " begins")) : "Standard WoW calendar",
      "Seasonal calendar unavailable");
  }

  function findHomeIntroduction() {
    // Place AFTER the Home section's descriptive heading, not above it or inside the banner.
    var descriptions = document.querySelectorAll("p, .page-description, .page-subtitle, .section-subtitle, .intro");
    for (var i = 0; i < descriptions.length; i++) {
      var el = descriptions[i];
      var text = (el.textContent || "").replace(/\s+/g, " ").trim();
      if (text.indexOf("Everything your Naxxramas character needs in one place") !== 0 || text.length > 500) continue;
      var target = el;
      var parent = el.parentElement;
      // A compact parent containing both Home heading and its description is the whole intro.
      if (parent && parent.children.length <= 8 && (parent.textContent || "").length < 1400) {
        var heading = parent.querySelector("h1, h2, h3, h4");
        if (heading && (heading.textContent || "").trim() === "Home") target = parent;
      }
      // Preserve the horizontal separator under the Home introduction.
      if (target.nextElementSibling && target.nextElementSibling.matches("hr")) {
        target = target.nextElementSibling;
      }
      return target;
    }
    return null;
  }

  function positionBelowHome(section) {
    var anchor = findHomeIntroduction();
    if (!anchor || !anchor.parentNode) return false;
    anchor.insertAdjacentElement("afterend", section);
    return true;
  }

  function start() {
    if (document.getElementById("naxx-countdowns")) return;
    var section = buildSection();
    var main = document.querySelector("main") ||
      document.querySelector("#main-content") ||
      document.querySelector(".main-content") ||
      document.querySelector("#content") ||
      document.querySelector("main-content");
    if (!positionBelowHome(section)) {
      // Fallback while a client-side homepage is still rendering.
      if (main) main.insertBefore(section, main.firstChild);
      else document.body.appendChild(section);
      // Move the section into its intended position when Home content becomes available.
      var observer = new MutationObserver(function () {
        if (positionBelowHome(section)) observer.disconnect();
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }
    update(section);
    window.setInterval(function () {
      if (!section.isConnected) return;
      update(section);
    }, 1000);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
