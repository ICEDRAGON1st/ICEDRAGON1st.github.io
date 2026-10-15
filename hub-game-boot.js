/**
 * Full-screen boot loader for hub games (same look as hub refresh).
 * Include as the first script in <head>:
 *   <script src="../hub-game-boot.js?v=…"></script>
 * Optional: data-boot-title / data-boot-sub on <html> or the script tag.
 */
(function () {
  if (window.__hubGameBoot) return;
  window.__hubGameBoot = true;

  if (!window.HubLifecycle) {
    window.HubLifecycle = {
      _q: [],
      onHiddenPause: function (fn) {
        if (typeof fn === "function") this._q.push(fn);
        return function () {};
      },
      isHidden: function () {
        try {
          return !!document.hidden;
        } catch (e) {
          return false;
        }
      }
    };
  }

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
  var iconBase = "../";
  var bootVer = "1";
  var managedScriptPromises = {};
  var accountProfilePromise = null;

  function loadManagedScript(file, globalName) {
    if (globalName && window[globalName]) return Promise.resolve(window[globalName]);
    if (managedScriptPromises[file]) return managedScriptPromises[file];
    managedScriptPromises[file] = new Promise(function (resolve) {
      var managed = document.createElement("script");
      managed.src = iconBase + file + "?v=" + encodeURIComponent(bootVer);
      managed.async = true;
      managed.setAttribute("data-hub-game-managed", file);
      managed.onload = function () {
        resolve(globalName ? window[globalName] : true);
      };
      managed.onerror = function () {
        resolve(null);
      };
      (document.head || html).appendChild(managed);
    });
    return managedScriptPromises[file];
  }

  // Same My Games icon on every hub game tab
  try {
    var bootSrc = (script && script.src) || "";
    iconBase = bootSrc ? bootSrc.replace(/[^/]+$/, "") : "../";
    try {
      var qm = bootSrc.indexOf("?");
      if (qm >= 0) {
        var params = new URLSearchParams(bootSrc.slice(qm + 1));
        bootVer = params.get("v") || bootVer;
      }
    } catch (e) {}
    // Start shared game dependencies together. They are ready before window.load,
    // but no longer serialize five network round trips ahead of the game document.
    try {
      var shared = [
        ["hub-net.js", "HubNet"],
        ["hub-afk.js", "HubAfk"],
        ["hub-coins.js", "HubCoins"],
        ["hub-sound.js", "HubSound"],
        ["hub-audio.js", "HubAudio"]
      ];
      for (var sharedIndex = 0; sharedIndex < shared.length; sharedIndex++) {
        var file = shared[sharedIndex][0];
        var globalName = shared[sharedIndex][1];
        loadManagedScript(file, globalName);
      }
    } catch (e) {}
    // Offline shell for games visited once online.
    try {
      if ("serviceWorker" in navigator) {
        var swUrl = iconBase + "sw.js";
        var controlledAtBoot = !!navigator.serviceWorker.controller;
        var updateReloaded = false;
        navigator.serviceWorker.addEventListener("controllerchange", function () {
          if (!controlledAtBoot || updateReloaded) return;
          updateReloaded = true;
          window.location.reload();
        });
        navigator.serviceWorker.register(swUrl).catch(function () {});
      }
    } catch (e) {}
    if (!document.querySelector('link[rel="icon"][data-hub-icon]')) {
      var fav = document.createElement("link");
      fav.rel = "icon";
      fav.type = "image/png";
      fav.href = iconBase + "icon.png";
      fav.setAttribute("data-hub-icon", "1");
      (document.head || html).appendChild(fav);
    }
    if (!document.querySelector('link[rel="apple-touch-icon"][data-hub-icon]')) {
      var apple = document.createElement("link");
      apple.rel = "apple-touch-icon";
      apple.href = iconBase + "apple-touch-icon.png";
      apple.setAttribute("data-hub-icon", "1");
      (document.head || html).appendChild(apple);
    }
  } catch (e) {}

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
  window.ensureHubGameAccountProfile = function () {
    if (accountProfilePromise) return accountProfilePromise;
    accountProfilePromise = loadManagedScript("hub-supabase.js", "HubSupabase")
      .then(function () {
        return loadManagedScript("hub-account-bag.js", "HubAccountBag");
      })
      .then(function () {
        return loadManagedScript("hub-identity.js", "HubIdentity");
      })
      .then(function () {
        return loadManagedScript("hub-presence.js", "HubPresence");
      })
      .then(function () {
        return loadManagedScript("hub-plays.js", "HubPlays");
      })
      .then(function () {
        document.dispatchEvent(new CustomEvent("hub-game-profile-ready"));
        return window.HubPlays || null;
      });
    return accountProfilePromise;
  };

  ensureLoader();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", refreshTitle, { once: true });
  } else {
    refreshTitle();
  }

  function finish() {
    // Let game scripts paint one frame, then drop the cover.
    setTimeout(dismissHubBootLoader, 50);
    var loadAccountProfile = function () {
      window.ensureHubGameAccountProfile().catch(function () {});
    };
    if (typeof requestIdleCallback === "function") {
      requestIdleCallback(loadAccountProfile, { timeout: 1000 });
    } else {
      setTimeout(loadAccountProfile, 100);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", finish, { once: true });
  } else {
    finish();
  }

  // Safety: never leave the loader stuck
  setTimeout(dismissHubBootLoader, 15000);
})();
