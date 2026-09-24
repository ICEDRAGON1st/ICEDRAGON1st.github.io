/**
 * Full-screen boot loader for hub games (same look as hub refresh).
 * Include as the first script in <head>:
 *   <script src="../hub-game-boot.js?v=…"></script>
 * Optional: data-boot-title / data-boot-sub on <html> or the script tag.
 */
(function () {
  if (window.__hubGameBoot) return;
  window.__hubGameBoot = true;

  var html = document.documentElement;
  html.classList.add("hub-booting");

  var script = document.currentScript;
  var title =
    (script && script.getAttribute("data-boot-title")) ||
    html.getAttribute("data-boot-title") ||
    document.title ||
    "My Games";
  var sub =
    (script && script.getAttribute("data-boot-sub")) ||
    html.getAttribute("data-boot-sub") ||
    "Loading game…";

  var css = document.createElement("style");
  css.id = "hub-game-boot-style";
  css.textContent =
    "html.hub-booting{" +
    "background:radial-gradient(ellipse at 50% 20%,#1a2750 0%,transparent 55%)," +
    "linear-gradient(180deg,#0c1224 0%,#070b16 100%)!important}" +
    "html.hub-booting,html.hub-booting body{overflow:hidden!important}" +
    "html.hub-booting body>*:not(#hub-boot-loader){visibility:hidden!important;pointer-events:none!important}" +
    "#hub-boot-loader{position:fixed;inset:0;z-index:100000;display:none;align-items:center;" +
    "justify-content:center;flex-direction:column;gap:1rem;margin:0;padding:1.5rem;" +
    "background:radial-gradient(ellipse at 50% 20%,#1a2750 0%,transparent 55%)," +
    "linear-gradient(180deg,#0c1224 0%,#070b16 100%);color:#e8eefc;" +
    'font-family:"Outfit","Segoe UI",system-ui,sans-serif;text-align:center;' +
    "pointer-events:all;user-select:none;visibility:visible!important}" +
    "html.hub-booting #hub-boot-loader{display:flex}" +
    "#hub-boot-loader .hub-boot-mark{font-size:clamp(1.6rem,5vw,2.2rem);font-weight:800;" +
    "letter-spacing:0.04em;margin:0}" +
    "#hub-boot-loader .hub-boot-sub{margin:0;color:#9aa8c7;font-size:0.95rem;font-weight:600}" +
    "#hub-boot-loader .hub-boot-spin{width:2.4rem;height:2.4rem;border-radius:50%;" +
    "border:3px solid rgba(124,156,255,0.22);border-top-color:#7c9cff;" +
    "animation:hub-boot-spin 0.75s linear infinite;margin-top:0.35rem}" +
    "@keyframes hub-boot-spin{to{transform:rotate(360deg)}}";
  (document.head || html).appendChild(css);

  function ensureLoader() {
    if (document.getElementById("hub-boot-loader")) return;
    var el = document.createElement("div");
    el.id = "hub-boot-loader";
    el.setAttribute("aria-live", "polite");
    el.setAttribute("aria-busy", "true");
    el.innerHTML =
      '<p class="hub-boot-mark"></p>' +
      '<p class="hub-boot-sub"></p>' +
      '<div class="hub-boot-spin" aria-hidden="true"></div>';
    el.querySelector(".hub-boot-mark").textContent = title;
    el.querySelector(".hub-boot-sub").textContent = sub;
    if (document.body) {
      document.body.insertBefore(el, document.body.firstChild);
    } else {
      // Cover before <body> exists (script runs in <head>)
      html.appendChild(el);
      document.addEventListener(
        "DOMContentLoaded",
        function () {
          if (el.parentNode === html && document.body) {
            document.body.insertBefore(el, document.body.firstChild);
          }
        },
        { once: true }
      );
    }
  }

  function dismissHubBootLoader() {
    try {
      html.classList.remove("hub-booting");
      var loader = document.getElementById("hub-boot-loader");
      if (loader) {
        loader.setAttribute("aria-busy", "false");
        loader.hidden = true;
        loader.style.display = "none";
      }
    } catch (e) {}
  }

  function refreshTitle() {
    var mark = document.querySelector("#hub-boot-loader .hub-boot-mark");
    if (!mark) return;
    var t =
      (script && script.getAttribute("data-boot-title")) ||
      html.getAttribute("data-boot-title") ||
      document.title;
    if (t) mark.textContent = t;
  }

  window.dismissHubBootLoader = dismissHubBootLoader;

  ensureLoader();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", refreshTitle, { once: true });
  } else {
    refreshTitle();
  }

  function finish() {
    // Let game scripts paint one frame, then drop the cover.
    setTimeout(dismissHubBootLoader, 50);
  }

  if (document.readyState === "complete") finish();
  else window.addEventListener("load", finish, { once: true });

  // Safety: never leave the loader stuck
  setTimeout(dismissHubBootLoader, 15000);
})();
