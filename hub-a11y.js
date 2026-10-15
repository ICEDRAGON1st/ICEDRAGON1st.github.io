/**
 * Keyboard focus helpers for hub dialogs.
 * Tab stays inside an open modal; closing restores the previous control.
 */
(function (root) {
  const FOCUSABLE =
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  const DIALOG_IDS = [
    "whats-new-modal",
    "player-name-modal",
    "menu-modal",
    "player-profile-modal",
    "coins-panel",
    "admin-panel"
  ];

  function isVisible(el) {
    if (!el || el.hidden) return false;
    if (el.getAttribute("aria-hidden") === "true") return false;
    if (typeof el.closest === "function" && el.closest(".hidden")) return false;
    try {
      const style = root?.getComputedStyle?.(el);
      if (style && (style.display === "none" || style.visibility === "hidden")) return false;
    } catch {
      /* node tests have no layout */
    }
    return true;
  }

  function focusables(rootEl) {
    if (!rootEl || typeof rootEl.querySelectorAll !== "function") return [];
    return [...rootEl.querySelectorAll(FOCUSABLE)].filter(isVisible);
  }

  function nextFocus(items, current, shift) {
    const list = Array.isArray(items) ? items.filter(Boolean) : [];
    if (!list.length) return null;
    const index = list.indexOf(current);
    if (index < 0) return list[0];
    if (shift) return list[(index - 1 + list.length) % list.length];
    return list[(index + 1) % list.length];
  }

  function isDialogOpen(el) {
    return !!(el && !el.classList.contains("hidden"));
  }

  function trapFocus(rootEl) {
    if (!rootEl) return function release() {};
    const previous =
      typeof document !== "undefined" && document.activeElement instanceof root?.HTMLElement
        ? document.activeElement
        : null;
    const first = focusables(rootEl)[0];
    try {
      first?.focus?.({ preventScroll: true });
    } catch {
      try {
        first?.focus?.();
      } catch {
        /* ignore */
      }
    }

    function onKeydown(event) {
      if (event.key !== "Tab") return;
      const items = focusables(rootEl);
      if (!items.length) {
        event.preventDefault();
        return;
      }
      const active = typeof document !== "undefined" ? document.activeElement : null;
      if (!rootEl.contains(active) || active === (event.shiftKey ? items[0] : items[items.length - 1])) {
        event.preventDefault();
        const next = nextFocus(items, rootEl.contains(active) ? active : items[0], event.shiftKey);
        try {
          next?.focus?.();
        } catch {
          /* ignore */
        }
      }
    }

    rootEl.addEventListener("keydown", onKeydown);
    return function release() {
      rootEl.removeEventListener("keydown", onKeydown);
      if (!previous || typeof previous.focus !== "function") return;
      if (previous.closest?.(".hidden")) return;
      try {
        previous.focus({ preventScroll: true });
      } catch {
        try {
          previous.focus();
        } catch {
          /* ignore */
        }
      }
    };
  }

  function watchHiddenDialog(rootEl) {
    if (!rootEl || typeof MutationObserver !== "function") return function stop() {};
    let release = null;
    function sync() {
      const open = isDialogOpen(rootEl);
      if (open && !release) release = trapFocus(rootEl);
      else if (!open && release) {
        release();
        release = null;
      }
    }
    const observer = new MutationObserver(sync);
    observer.observe(rootEl, { attributes: true, attributeFilter: ["class"] });
    sync();
    return function stop() {
      observer.disconnect();
      if (release) release();
      release = null;
    };
  }

  function bindHubDialogs(doc) {
    const documentRef = doc || (typeof document !== "undefined" ? document : null);
    if (!documentRef) return [];
    return DIALOG_IDS.map((id) => documentRef.getElementById(id))
      .filter(Boolean)
      .map((el) => watchHiddenDialog(el));
  }

  const api = {
    FOCUSABLE,
    DIALOG_IDS,
    isVisible,
    focusables,
    nextFocus,
    trapFocus,
    watchHiddenDialog,
    bindHubDialogs
  };
  if (root) root.HubA11y = api;
  if (typeof module === "object" && module.exports) module.exports = api;

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", function () {
        bindHubDialogs(document);
      });
    } else {
      bindHubDialogs(document);
    }
  }
})(typeof window !== "undefined" ? window : typeof globalThis !== "undefined" ? globalThis : null);
