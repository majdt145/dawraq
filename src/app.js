/* דורק DAWRAQ — shared behavior: language toggle (He/Ar) + mobile nav + motion */
(function () {
  "use strict";

  function applyLang(l) {
    document.querySelectorAll(".lang button").forEach(function (b) {
      b.classList.toggle("on", b.dataset.lang === l);
      b.setAttribute("aria-pressed", b.dataset.lang === l ? "true" : "false");
    });
    document.documentElement.lang = l === "ar" ? "ar" : "he";
    document.documentElement.dir = "rtl"; /* both He & Ar are RTL */
    document.querySelectorAll("[data-" + l + "]").forEach(function (el) {
      // only swap the innermost translatable node, so decorative icons /
      // tel: links / nested spans in a container are never destroyed
      if (el.querySelector("[data-" + l + "]")) return;
      el.innerHTML = el.getAttribute("data-" + l);
    });
    document.querySelectorAll("[data-aria-" + l + "]").forEach(function (el) {
      el.setAttribute("aria-label", el.getAttribute("data-aria-" + l));
    });
    var md = document.querySelector('meta[name="description"]');
    if (md && md.getAttribute("data-desc-" + l)) md.setAttribute("content", md.getAttribute("data-desc-" + l));
    try { localStorage.setItem("dq_lang", l); } catch (e) {}
  }

  window.setLang = function (l) { applyLang(l); };

  document.addEventListener("DOMContentLoaded", function () {
    /* restore saved language */
    var saved = "he";
    try { saved = localStorage.getItem("dq_lang") || "he"; } catch (e) {}
    if (saved === "ar") applyLang("ar");

    /* mobile nav toggle */
    var hamb = document.querySelector(".hamb");
    var menu = document.getElementById("mainmenu");
    if (hamb && menu) {
      hamb.addEventListener("click", function () {
        var open = menu.classList.toggle("open");
        hamb.setAttribute("aria-expanded", open ? "true" : "false");
      });
      menu.addEventListener("click", function (e) {
        if (e.target.tagName === "A") {
          menu.classList.remove("open");
          hamb.setAttribute("aria-expanded", "false");
        }
      });
    }

    initMotion();
    initForms();
    initNav();
    initSplash();
  });

  /* ===== splash intro (home): CSS drives the timeline; JS marks it seen,
     lets the user skip (click / Esc), and removes the node when done ===== */
  function initSplash() {
    var sp = document.getElementById("splash");
    if (!sp) return;
    var root = document.documentElement;
    if (!root.classList.contains("anim") || !root.classList.contains("sp-live")) {
      sp.parentNode && sp.parentNode.removeChild(sp);
      return;
    }
    try { sessionStorage.setItem("dq_splash", "1"); } catch (e) {}
    var done = false;
    function finish() {
      if (done) return;
      done = true;
      /* dropping .sp-live kills both the overlay and the header animation
         rules — header lands in its normal resting state, no jump */
      root.classList.remove("sp-live");
      sp.parentNode && sp.parentNode.removeChild(sp);
      document.removeEventListener("keydown", onKey);
    }
    function onKey(e) { if (e.key === "Escape") finish(); }
    sp.addEventListener("click", finish);
    document.addEventListener("keydown", onKey);
    setTimeout(finish, 6100); /* just after the CSS fade-out completes */
  }

  /* ===== header: solid white always; gains a shadow once scrolled ===== */
  function initNav() {
    try {
      var root = document.documentElement;
      var header = document.querySelector("header.site");
      if (!header) return;
      function measure() { root.style.setProperty("--nav-h", header.offsetHeight + "px"); }
      measure();
      window.addEventListener("resize", measure, { passive: true });
      var solid = null;
      function onScroll() {
        var y = window.scrollY || root.scrollTop || document.body.scrollTop || 0;
        var next = y > 8;
        if (next !== solid) { solid = next; header.classList.toggle("scrolled", next); }
      }
      window.addEventListener("scroll", onScroll, { passive: true });
      onScroll();
    } catch (e) {}
  }

  /* ===== forms: real submission to /api/form (Vercel function → Resend) ===== */
  function initForms() {
    function currentLang() {
      try { return localStorage.getItem("dq_lang") === "ar" ? "ar" : "he"; } catch (e) { return "he"; }
    }
    function show(form, sel) {
      [].slice.call(form.querySelectorAll(".done,.err")).forEach(function (el) { el.hidden = true; });
      var el = sel && form.querySelector(sel);
      if (el) el.hidden = false;
    }
    function setBusy(form, busy) {
      var btn = form.querySelector('button[type="submit"]');
      if (!btn) return;
      btn.disabled = busy;
      btn.setAttribute("aria-busy", busy ? "true" : "false");
      var l = currentLang();
      btn.textContent = busy
        ? (l === "ar" ? "جارٍ الإرسال…" : "שולח…")
        : (btn.getAttribute("data-" + l) || btn.getAttribute("data-he"));
    }

    [].slice.call(document.querySelectorAll("form[data-form]")).forEach(function (form) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var fields = {};
        [].slice.call(form.elements).forEach(function (el) {
          if (el.name && el.name !== "website") fields[el.name] = el.value;
        });
        var body = {
          formType: form.getAttribute("data-form"),
          lang: currentLang(),
          fields: fields,
          website: (form.querySelector('input[name="website"]') || {}).value || "",
        };
        setBusy(form, true);
        show(form, null);
        fetch("/api/form", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
          .then(function (r) { return r.json().catch(function () { return { ok: false }; }); })
          .then(function (data) {
            if (data.ok) { show(form, ".done"); form.reset(); }
            else show(form, '.err[data-err="send"]');
          })
          .catch(function () { show(form, '.err[data-err="send"]'); })
          .then(function () { setBusy(form, false); });
      });
    });
  }

  /* ===== motion layer: scroll-reveal (.rv) + count-up stats ===== */
  function initMotion() {
    var root = document.documentElement;
    if (!root.classList.contains("anim")) return;
    try {
      var els = [].slice.call(document.querySelectorAll(".rv"));

      /* scroll-based reveal — fail-open: content visible by default, JS only animates */
      function reveal() {
        var vh = window.innerHeight || document.documentElement.clientHeight;
        els.forEach(function (el) {
          if (el.__shown) return;
          var r = el.getBoundingClientRect();
          if (r.top < vh * 0.92 && r.bottom > 0) {
            var sibs = el.parentNode ? [].slice.call(el.parentNode.children).filter(function (c) { return c.classList && c.classList.contains("rv") && !c.__shown; }) : [];
            el.style.animationDelay = Math.max(0, sibs.indexOf(el)) * 60 + "ms";
            el.classList.add("is-in");
            el.__shown = true;
          }
        });
      }

      var ticking = false;
      function frame() { reveal(); ticking = false; }
      function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(frame); } }
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", onScroll, { passive: true });
      window.addEventListener("load", frame);
      frame(); setTimeout(frame, 150); setTimeout(frame, 600);
      /* hard failsafe — never leave any section hidden */
      setTimeout(function () { els.forEach(function (el) { if (!el.__shown) { el.classList.add("is-in"); el.__shown = true; } }); }, 2800);
    } catch (err) {
      root.classList.remove("anim");
    }
  }
})();

/* =========================================================================
   Accessibility widget (aw-) + Cookie banner (ck-)
   Self-contained IIFE; fail-open — a failure here never breaks the site.
   ========================================================================= */
(function () {
  "use strict";
  try {
    var KEY = "dq-a11y", CKEY = "dq-consent";
    var DEFAULTS = { fs: 0, dark: false, gray: false, links: false, spacing: false, stopmotion: false };
    var FS_PCT = ["100%", "112%", "125%"];

    function read() {
      try {
        var s = JSON.parse(localStorage.getItem(KEY) || "{}");
        var out = {}; for (var k in DEFAULTS) out[k] = (k in s) ? s[k] : DEFAULTS[k];
        out.fs = Math.max(0, Math.min(2, out.fs | 0));
        return out;
      } catch (e) { var d = {}; for (var j in DEFAULTS) d[j] = DEFAULTS[j]; return d; }
    }
    function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} }

    function apply(s) {
      var h = document.documentElement;
      h.classList.remove("aw-fs1", "aw-fs2", "aw-dark", "aw-gray", "aw-links", "aw-spacing", "aw-stopmotion");
      if (s.fs === 1) h.classList.add("aw-fs1");
      if (s.fs === 2) h.classList.add("aw-fs2");
      if (s.dark) h.classList.add("aw-dark");
      if (s.gray) h.classList.add("aw-gray");
      if (s.links) h.classList.add("aw-links");
      if (s.spacing) h.classList.add("aw-spacing");
      if (s.stopmotion) {
        h.classList.add("aw-stopmotion");
        h.classList.remove("anim");
      }
    }

    document.addEventListener("DOMContentLoaded", function () {
      try {
        initWidget();
        initCookie();
      } catch (e) {}
    });

    function initWidget() {
      var btn = document.getElementById("aw-btn");
      var panel = document.getElementById("aw-panel");
      if (!btn || !panel) return;
      var title = document.getElementById("aw-title");
      var closeBtn = document.getElementById("aw-close");
      var state = read();

      apply(state);
      renderControls();

      function renderControls() {
        var val = document.getElementById("aw-fs-val");
        if (val) val.textContent = FS_PCT[state.fs];
        var dn = document.getElementById("aw-fs-dn"), up = document.getElementById("aw-fs-up");
        if (dn) dn.disabled = state.fs <= 0;
        if (up) up.disabled = state.fs >= 2;
        [].slice.call(panel.querySelectorAll(".aw-switch")).forEach(function (sw) {
          var k = sw.getAttribute("data-set");
          sw.setAttribute("aria-checked", state[k] ? "true" : "false");
        });
      }

      function commit() { save(state); apply(state); renderControls(); }

      var open = false;
      function openPanel() {
        panel.hidden = false;
        btn.setAttribute("aria-expanded", "true");
        open = true;
        if (title) title.focus();
        document.addEventListener("keydown", onKey);
        document.addEventListener("mousedown", onOutside);
      }
      function closePanel(returnFocus) {
        panel.hidden = true;
        btn.setAttribute("aria-expanded", "false");
        open = false;
        document.removeEventListener("keydown", onKey);
        document.removeEventListener("mousedown", onOutside);
        if (returnFocus !== false) btn.focus();
      }
      function onKey(e) {
        if (e.key === "Escape") { e.preventDefault(); closePanel(true); }
      }
      function onOutside(e) {
        if (!open) return;
        if (panel.contains(e.target) || btn.contains(e.target)) return;
        closePanel(false);
      }

      btn.addEventListener("click", function () { open ? closePanel(true) : openPanel(); });
      if (closeBtn) closeBtn.addEventListener("click", function () { closePanel(true); });

      var dn = document.getElementById("aw-fs-dn"), up = document.getElementById("aw-fs-up");
      if (dn) dn.addEventListener("click", function () { if (state.fs > 0) { state.fs--; commit(); } });
      if (up) up.addEventListener("click", function () { if (state.fs < 2) { state.fs++; commit(); } });

      [].slice.call(panel.querySelectorAll(".aw-switch")).forEach(function (sw) {
        sw.addEventListener("click", function () {
          var k = sw.getAttribute("data-set");
          state[k] = !state[k];
          commit();
        });
      });

      var reset = document.getElementById("aw-reset");
      if (reset) reset.addEventListener("click", function () {
        state = {}; for (var k in DEFAULTS) state[k] = DEFAULTS[k];
        try { localStorage.removeItem(KEY); } catch (e) {}
        try {
          if (window.matchMedia && !matchMedia("(prefers-reduced-motion:reduce)").matches) {
            document.documentElement.classList.add("anim");
          }
        } catch (e) {}
        apply(state); renderControls();
      });

      /* refresh dynamic bits after a language flip */
      if (typeof window.setLang === "function" && !window.__awLangWrapped) {
        var _setLang = window.setLang;
        window.setLang = function (l) { _setLang(l); try { renderControls(); } catch (e) {} };
        window.__awLangWrapped = true;
      }
    }

    function initCookie() {
      var banner = document.getElementById("ck-banner");
      if (!banner) return;
      var seen = false;
      try { seen = !!localStorage.getItem(CKEY); } catch (e) { seen = true; }
      if (seen) return;
      banner.hidden = false;
      var accept = document.getElementById("ck-accept");
      if (accept) accept.addEventListener("click", function () {
        try { localStorage.setItem(CKEY, "1"); } catch (e) {}
        banner.hidden = true;
      });
    }
  } catch (e) {}
})();
