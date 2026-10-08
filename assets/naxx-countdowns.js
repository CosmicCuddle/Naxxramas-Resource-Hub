
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
    elementalInvasion: { at: null }
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
      '<p class="nc-footer">All dates and countdowns use configured server time (currently UTC+02:00).</p>';
    var grid = section.querySelector(".nc-grid");
    grid.appendChild(makeCard("honor", "H", "Fortnightly Cycle", "Honor Reset"));
    grid.appendChild(makeCard("raid", "R", "Vanilla Progression", "Next Raid Unlock"));
    grid.appendChild(makeCard("invasion", "E", "World Event", "Elemental Invasion"));
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
      raid ? raid.name + " unlocks" : "Vanilla raid unlock dates have not been announced.",
      "Schedule to be announced");
    var invasion = readDate(schedule.elementalInvasion.at);
    present(cards[2], invasion && invasion > now ? invasion : null,
      invasion && invasion > now ? "Elemental Invasion begins" : "The invasion start date has not been set.",
      "Date to be announced");
  }

  function start() {
    if (document.getElementById("naxx-countdowns")) return;
    var section = buildSection();
    var main = document.querySelector("main") ||
      document.querySelector("#main-content") ||
      document.querySelector(".main-content") ||
      document.querySelector("#content") ||
      document.querySelector("main-content");
    if (main) {
      var hero = main.querySelector(".hero, .hero-section, #hero");
      if (hero && hero.parentNode === main) hero.insertAdjacentElement("afterend", section);
      else main.insertBefore(section, main.firstChild);
    } else {
      var header = document.querySelector("body > header, body > nav");
      if (header) header.insertAdjacentElement("afterend", section);
      else document.body.insertBefore(section, document.body.firstChild);
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
