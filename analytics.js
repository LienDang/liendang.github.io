/* Visitor statistics: Umami Cloud, cookieless, with no consent prompt.
   Umami sets no cookies and stores nothing in the browser. Nothing loads unless WEBSITE_ID is set below and the page
   is on liendang.github.io, and nothing is sent for visitors who opt out on /privacy/ or whose browser sends Global
   Privacy Control or Do Not Track. Umami counts page views, Web Vitals and script errors; this file adds events for
   sections seen, scroll depth, time on page, link clicks, copying, printing and opening details, and forwards the
   Lab's "lab:track" events. No event carries what a visitor typed. */
(() => {
  // The Umami website ID (Umami Cloud → Websites → this site → Edit), e.g. "4fb7a7e0-1c2d-4e5f-8a9b-0c1d2e3f4a5b".
  // Empty keeps statistics off for every visitor.
  const WEBSITE_ID = "19662912-8af6-4b3f-80e3-f438a271ecac";
  const SITE_HOST = "liendang.github.io";
  // Umami's own opt-out flag: its tracker checks it before every send, so opting out applies at once and in every tab
  const OPT_OUT_KEY = "umami.disabled";
  const ON = "on";
  const OFF = "off";

  const configured = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(WEBSITE_ID) && location.hostname === SITE_HOST;
  document.querySelectorAll("[data-stats-off]").forEach((node) => (node.hidden = configured));
  if (!configured) return;

  // Global Privacy Control and Do Not Track count as an objection, with nothing to switch back on
  const signal = navigator.globalPrivacyControl === true || [navigator.doNotTrack, window.doNotTrack].includes("1");
  let stoppedHere = false;
  let loaded = false;
  const queue = [];

  function optedOut() {
    try {
      return Boolean(localStorage.getItem(OPT_OUT_KEY));
    } catch {
      return false;
    }
  }

  const counting = () => !signal && !stoppedHere && !optedOut();

  function setChoice(value) {
    try {
      if (value === OFF) localStorage.setItem(OPT_OUT_KEY, "1");
      else localStorage.removeItem(OPT_OUT_KEY);
      stoppedHere = false;
    } catch {
      // Storage blocked: opting out still holds until the page is closed
      stoppedHere = value === OFF;
    }
    if (value === ON) load();
    render();
  }

  // Keep utm_ campaign tags but drop other query parameters (ad click IDs and the like), and keep only the origin and
  // path of another site's address
  function cleanUrl(value) {
    try {
      const url = new URL(value, location.href);
      if (url.origin !== location.origin) return url.origin + url.pathname;
      for (const key of [...url.searchParams.keys()]) if (!key.startsWith("utm_")) url.searchParams.delete(key);
      return value.startsWith("/") ? url.pathname + url.search + url.hash : url.href;
    } catch {
      return value;
    }
  }

  // Umami calls this before every send; returning false cancels it
  window.portfolioBeforeSend = (type, payload) => {
    if (!counting()) return false;
    if (payload.url) payload.url = cleanUrl(payload.url);
    if (payload.referrer) payload.referrer = cleanUrl(payload.referrer);
    return payload;
  };

  // Events from before the tracker is ready wait for its page view, which it sends once the page has loaded
  function flush() {
    for (const [name, data] of queue.splice(0)) window.umami.track(name, data);
  }

  function load() {
    if (loaded || !counting()) return;
    loaded = true;
    const script = document.createElement("script");
    script.src = "https://cloud.umami.is/script.js";
    script.dataset.websiteId = WEBSITE_ID;
    script.dataset.beforeSend = "portfolioBeforeSend";
    script.dataset.performance = "true";
    script.dataset.errors = "true";
    script.onload = () => (document.readyState === "complete" ? flush() : addEventListener("load", flush, { once: true }));
    document.head.append(script);
  }

  function track(name, data) {
    if (!counting()) return;
    load();
    if (window.umami && !queue.length) window.umami.track(name, data);
    else if (queue.length < 50) queue.push([name, data]);
  }

  // Where on the page something happened: a section's id, or the header, footer or page
  function partOf(node) {
    const part = node?.closest?.("main > section, header, footer, main");
    if (!part) return "page";
    return part.id || (part.classList.contains("hero") ? "hero" : part.localName);
  }

  /* ---------- the opt-out on /privacy/ ---------- */

  const TEXT = {
    [ON]: "This browser's visits are counted, without cookies.",
    [OFF]: "You've opted out, so this browser's visits aren't counted.",
    signal: "Your browser sends a Global Privacy Control or Do Not Track signal, so this site doesn't count your visits.",
  };
  const panels = [...document.querySelectorAll("[data-stats-choice]")];
  const state = () => (signal ? "signal" : counting() ? ON : OFF);

  // Both buttons stay put and the current choice is pressed, so a double click can't flip it back
  function render() {
    for (const panel of panels) {
      panel.querySelector(".stats-choice-text").textContent = TEXT[state()];
      panel.querySelector(".stats-choice-actions").hidden = signal;
      for (const button of panel.querySelectorAll("[data-stats]")) {
        button.setAttribute("aria-pressed", String(button.dataset.stats === state()));
      }
    }
  }

  for (const panel of panels) {
    panel.setAttribute("role", "group");
    panel.setAttribute("aria-label", "Visitor statistics choice");
    panel.innerHTML = `
      <p class="stats-choice-text" aria-live="polite"></p>
      <div class="stats-choice-actions">
        <button type="button" class="button secondary" data-stats="${ON}">Count my visits</button>
        <button type="button" class="button secondary" data-stats="${OFF}">Don't count my visits</button>
      </div>`;
    panel.addEventListener("click", (e) => {
      const button = e.target.closest("[data-stats]");
      if (button && button.dataset.stats !== state()) setChoice(button.dataset.stats);
    });
    panel.hidden = false;
  }
  render();
  // A choice made in another tab, or before Back restored this page from the back/forward cache
  addEventListener("storage", (e) => (e.key === OPT_OUT_KEY || e.key === null) && render());
  addEventListener("pageshow", (e) => e.persisted && render());

  /* ---------- what's counted ---------- */

  load();

  // A section counts as seen once half of it is on screen, or it fills half the screen
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.intersectionRatio < 0.5 && entry.intersectionRect.height < innerHeight / 2) continue;
          observer.unobserve(entry.target);
          track("section_view", { section: partOf(entry.target) });
        }
      },
      { threshold: Array.from({ length: 11 }, (_, i) => i / 10) }
    );
    document.querySelectorAll("main > section, footer[id]").forEach((section) => observer.observe(section));
  }

  const depths = [25, 50, 75, 100];
  function onScroll() {
    const reached = ((scrollY + innerHeight) / document.documentElement.scrollHeight) * 100;
    while (depths.length && reached + 1 >= depths[0]) track("scroll_depth", { percent: depths.shift() });
    if (!depths.length) removeEventListener("scroll", onScroll);
  }
  addEventListener("scroll", onScroll, { passive: true });

  // Time the page has been on screen, counted in 5-second steps while the tab is visible
  const marks = [30, 60, 180, 600];
  let visible = 0;
  const timer = setInterval(() => {
    if (document.visibilityState !== "visible") return;
    visible += 5;
    if (visible >= marks[0]) track("time_on_page", { seconds: marks.shift() });
    if (!marks.length) clearInterval(timer);
  }, 5000);

  // The Lab's UniProt links carry protein IDs in their path (/uniprotkb/P02870/entry), which can name a food the visitor
  // typed, so for UniProt keep only the first segment
  const outboundPath = (link) => (/(^|\.)uniprot\.org$/.test(link.hostname) ? `/${link.pathname.split("/")[1] || ""}` : link.pathname);

  // Links: the address without its query, so the Lab's UniProt search links never carry what the visitor typed
  document.addEventListener(
    "click",
    (e) => {
      const link = e.target.closest?.("a[href]");
      if (!link) return;
      const from = partOf(link);
      if (link.protocol === "mailto:") track("email_click", { from });
      else if (link.origin !== location.origin) track("outbound_click", { url: link.hostname + outboundPath(link), from });
      else track("link_click", { to: link.pathname === location.pathname && link.hash ? link.hash : link.pathname + link.hash, from });
    },
    true
  );

  // That something was copied, and from where: never what
  document.addEventListener("copy", () => {
    const node = document.getSelection()?.anchorNode;
    track("text_copy", { from: partOf(node instanceof Element ? node : node?.parentElement) });
  });

  addEventListener("beforeprint", () => track("page_print"));

  // toggle doesn't bubble, so listen in the capture phase
  document.addEventListener(
    "toggle",
    (e) => {
      if (e.target.matches?.("details[open]")) track("details_open", { summary: e.target.querySelector("summary")?.textContent.trim() });
    },
    true
  );

  document.getElementById("lab")?.addEventListener("lab:track", (e) => track(e.detail.name, e.detail.params));
})();
