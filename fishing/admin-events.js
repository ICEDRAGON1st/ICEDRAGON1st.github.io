/**
 * Fishing Idle admin-event parse, clamp, and command rules.
 * Fetch/storage stay in script.js.
 */
(function (root) {
  const TOKEN = "ice-fish-evt-9f3a";
  const DEFAULT_MINUTES = 5;
  const DEFAULT_MULT = 2;
  const MAX_MINUTES = 1440;
  const MIN_MULT = 1;
  const MAX_MULT = 1000;
  const EVENT_ACTIVE_MS = 5 * 60 * 1000;
  const VARIANT_PRIMARY = ["silver", "gold", "diamond", "rainbow"];
  const MUTATIONS = ["toxic", "lava", "neon"];

  function options(opts) {
    return {
      token: opts?.token || TOKEN,
      now: Number(opts?.now) || Date.now(),
      eventActiveMs: Number(opts?.eventActiveMs) || EVENT_ACTIVE_MS,
      defaultMult: Number(opts?.defaultMult) || DEFAULT_MULT,
      defaultMinutes: Number(opts?.defaultMinutes) || DEFAULT_MINUTES
    };
  }

  function clampAdminMult(n) {
    const v = Number(n);
    if (!Number.isFinite(v)) return DEFAULT_MULT;
    return Math.max(MIN_MULT, Math.min(MAX_MULT, Math.round(v * 100) / 100));
  }

  function clampAdminMinutes(n) {
    const v = Math.round(Number(n) * 2) / 2;
    if (!Number.isFinite(v)) return DEFAULT_MINUTES;
    return Math.max(1, Math.min(MAX_MINUTES, v));
  }

  function normalizeMutation(raw) {
    const m = String(raw || "").toLowerCase();
    return MUTATIONS.includes(m) ? m : "";
  }

  function normalizeAdminWeatherId(raw) {
    const s = String(raw || "")
      .trim()
      .toLowerCase();
    if (s === "storm" || s === "rain" || s === "thunder") return "storm";
    if (s === "calm" || s === "sea" || s === "seas") return "calm";
    if (s === "none" || s === "clear" || s === "off" || s === "sunny") return "none";
    return "";
  }

  function decodeVariantTarget(raw) {
    const parts = String(raw || "")
      .toLowerCase()
      .split(/[+&,/|\s]+/)
      .map((p) => p.trim())
      .filter(Boolean);
    let primary = "";
    let shiny = false;
    for (const p of parts) {
      if (p === "shiny") shiny = true;
      else if (VARIANT_PRIMARY.includes(p) || p === "any") primary = p;
    }
    return { primary, shiny };
  }

  function encodeVariantTarget(spec) {
    const bits = [];
    if (spec?.primary) bits.push(spec.primary);
    if (spec?.shiny) bits.push("shiny");
    return bits.join("+");
  }

  function normalizeAdminVariantTarget(raw) {
    const spec = decodeVariantTarget(raw);
    if (!spec.primary && !spec.shiny) return "";
    return encodeVariantTarget(spec);
  }

  function isVariantTargetSpec(raw) {
    const spec = decodeVariantTarget(raw);
    return !!(spec.primary || spec.shiny);
  }

  function emptyChannels() {
    return {
      boost: null,
      variant: null,
      chest: null,
      luckyblock: null,
      weather: null,
      mutation: null,
      speed: null
    };
  }

  function emptyMutationMap() {
    return { toxic: null, lava: null, neon: null };
  }

  function isBoostAdminPayload(e) {
    return !!e && (e.kind === "luck" || e.kind === "money");
  }

  function isVariantAdminPayload(e) {
    return !!e && e.kind === "variant";
  }

  function isMutationAdminPayload(e) {
    return !!e && e.kind === "mutation" && !!normalizeMutation(e.target);
  }

  function isChestAdminPayload(e) {
    return !!e && e.kind === "chest";
  }

  function isLuckyBlockAdminPayload(e) {
    return !!e && e.kind === "luckyblock";
  }

  function isWeatherAdminPayload(e) {
    return !!e && e.kind === "weather" && !!normalizeAdminWeatherId(e.target);
  }

  function isSpeedAdminPayload(e) {
    return !!e && e.kind === "speed";
  }

  function pickBetterAdminEvent(a, b) {
    if (!a) return b || null;
    if (!b) return a;
    if (a.until !== b.until) return a.until >= b.until ? a : b;
    return (a.mult || 0) >= (b.mult || 0) ? a : b;
  }

  function parseAdminEventPayload(data, requireToken = false, opts) {
    const cfg = options(opts);
    if (!data || typeof data !== "object") return null;
    if (requireToken && String(data.token || "") !== cfg.token) return null;
    let kind = String(data.kind || "").toLowerCase();
    let weatherId = normalizeAdminWeatherId(data.target || data.weather || "");
    if (kind === "storm" || kind === "calm" || kind === "weather-none") {
      weatherId = normalizeAdminWeatherId(kind === "weather-none" ? "none" : kind);
      kind = "weather";
    }
    let mutationTarget = normalizeMutation(data.target || data.mutation || "");
    if (kind === "toxic" || MUTATIONS.includes(kind)) {
      mutationTarget =
        normalizeMutation(kind === "mutation" ? mutationTarget || "toxic" : kind) || "toxic";
      kind = "mutation";
    }
    let target = normalizeAdminVariantTarget(
      data.target || data.variant || (isVariantTargetSpec(kind) ? kind : "")
    );
    if (kind !== "luck" && kind !== "money" && kind !== "variant" && isVariantTargetSpec(kind)) {
      target = normalizeAdminVariantTarget(kind);
      kind = "variant";
    }
    if (
      kind !== "luck" &&
      kind !== "money" &&
      kind !== "variant" &&
      kind !== "mutation" &&
      kind !== "chest" &&
      kind !== "luckyblock" &&
      kind !== "speed" &&
      kind !== "weather"
    ) {
      return null;
    }
    if (kind === "variant" && !target) target = "gold";
    if (kind === "mutation") {
      mutationTarget = mutationTarget || normalizeMutation(data.target) || "toxic";
      if (!mutationTarget) return null;
      target = mutationTarget;
    }
    if (kind === "weather") {
      weatherId = weatherId || normalizeAdminWeatherId(data.target) || "storm";
      if (!weatherId) return null;
      target = weatherId;
    }
    const until = Math.floor(Number(data.until) || 0);
    if (!Number.isFinite(until) || until <= cfg.now) return null;
    const startedAt = Math.floor(Number(data.startedAt) || until - cfg.eventActiveMs);
    return {
      kind,
      target: kind === "variant" || kind === "weather" || kind === "mutation" ? target : "",
      until,
      startedAt: Number.isFinite(startedAt) ? startedAt : cfg.now,
      mult: kind === "weather" ? 1 : clampAdminMult(data.mult ?? cfg.defaultMult),
      scope: String(data.scope || "") || ""
    };
  }

  function parseMutationMap(raw, requireToken = false, inherit = {}, opts) {
    const map = emptyMutationMap();
    if (!raw || typeof raw !== "object") return map;
    const keyed = MUTATIONS.some((m) => raw[m] && typeof raw[m] === "object");
    if (keyed) {
      MUTATIONS.forEach((m) => {
        const src = raw[m];
        if (!src || typeof src !== "object") return;
        const e = parseAdminEventPayload(
          { ...inherit, ...src, kind: "mutation", target: m },
          requireToken,
          opts
        );
        if (e && isMutationAdminPayload(e)) map[m] = { ...e, kind: "mutation", target: m };
      });
      return map;
    }
    const single = parseAdminEventPayload(
      { ...inherit, kind: raw.kind || "mutation", ...raw },
      requireToken,
      opts
    );
    if (single && isMutationAdminPayload(single)) {
      const t = normalizeMutation(single.target);
      if (t) map[t] = { ...single, kind: "mutation", target: t };
    }
    return map;
  }

  function parseAdminBundle(data, requireToken = false, opts) {
    if (!data || typeof data !== "object") return emptyChannels();
    const cfg = options(opts);
    if (requireToken && String(data.token || "") !== cfg.token) return emptyChannels();
    const inherit = { token: data.token || (requireToken ? cfg.token : undefined) };
    let boost = null;
    let variant = null;
    let chest = null;
    let luckyblock = null;
    let weather = null;
    let mutation = null;
    let speed = null;
    if (data.boost && typeof data.boost === "object") {
      boost = parseAdminEventPayload({ ...inherit, ...data.boost }, requireToken, opts);
      if (boost && !isBoostAdminPayload(boost)) boost = null;
    }
    if (data.variantEvt && typeof data.variantEvt === "object") {
      variant = parseAdminEventPayload(
        { ...inherit, kind: "variant", ...data.variantEvt },
        requireToken,
        opts
      );
      if (variant && !isVariantAdminPayload(variant)) variant = null;
    } else if (
      data.variant &&
      typeof data.variant === "object" &&
      (data.variant.until || data.variant.kind)
    ) {
      variant = parseAdminEventPayload(
        { ...inherit, kind: data.variant.kind || "variant", ...data.variant },
        requireToken,
        opts
      );
      if (variant && !isVariantAdminPayload(variant)) variant = null;
    }
    if (data.chest && typeof data.chest === "object") {
      chest = parseAdminEventPayload(
        { ...inherit, kind: data.chest.kind || "chest", ...data.chest },
        requireToken,
        opts
      );
      if (chest && !isChestAdminPayload(chest)) chest = null;
    }
    if (data.luckyblock && typeof data.luckyblock === "object") {
      luckyblock = parseAdminEventPayload(
        { ...inherit, kind: data.luckyblock.kind || "luckyblock", ...data.luckyblock },
        requireToken,
        opts
      );
      if (luckyblock && !isLuckyBlockAdminPayload(luckyblock)) luckyblock = null;
    }
    if (data.weather && typeof data.weather === "object") {
      weather = parseAdminEventPayload(
        { ...inherit, kind: data.weather.kind || "weather", ...data.weather },
        requireToken,
        opts
      );
      if (weather && !isWeatherAdminPayload(weather)) weather = null;
    }
    if (data.speed && typeof data.speed === "object") {
      speed = parseAdminEventPayload(
        { ...inherit, kind: data.speed.kind || "speed", ...data.speed },
        requireToken,
        opts
      );
      if (speed && !isSpeedAdminPayload(speed)) speed = null;
    }
    if (data.mutation && typeof data.mutation === "object") {
      mutation = parseMutationMap(data.mutation, requireToken, inherit, opts);
    } else {
      mutation = emptyMutationMap();
    }
    const single = parseAdminEventPayload(
      requireToken ? data : { ...data, token: data.token },
      requireToken,
      opts
    );
    if (single) {
      if (isBoostAdminPayload(single)) boost = pickBetterAdminEvent(boost, single);
      if (isVariantAdminPayload(single)) variant = pickBetterAdminEvent(variant, single);
      if (isChestAdminPayload(single)) chest = pickBetterAdminEvent(chest, single);
      if (isLuckyBlockAdminPayload(single)) luckyblock = pickBetterAdminEvent(luckyblock, single);
      if (isWeatherAdminPayload(single)) weather = pickBetterAdminEvent(weather, single);
      if (isSpeedAdminPayload(single)) speed = pickBetterAdminEvent(speed, single);
      if (isMutationAdminPayload(single)) {
        mutation = mergeMutationMaps(
          mutation,
          parseMutationMap(single, requireToken, inherit, opts)
        );
      }
    }
    return { boost, variant, chest, luckyblock, weather, mutation, speed };
  }

  function mergeMutationMaps(a, b) {
    const out = emptyMutationMap();
    MUTATIONS.forEach((m) => {
      out[m] = pickBetterAdminEvent(a?.[m] || null, b?.[m] || null);
    });
    return out;
  }

  function pruneMutationMap(map, now = Date.now()) {
    const out = emptyMutationMap();
    if (!map || typeof map !== "object") return out;
    MUTATIONS.forEach((m) => {
      const e = map[m];
      if (e && isMutationAdminPayload(e) && e.until > now) out[m] = e;
    });
    return out;
  }

  function mutationMapHasAny(map) {
    if (!map || typeof map !== "object") return false;
    return MUTATIONS.some((m) => isMutationAdminPayload(map[m]));
  }

  function parseAdminCommand(raw, defaults = {}) {
    let text = String(raw || "")
      .trim()
      .toLowerCase()
      .replace(/×/g, "x")
      .replace(/[+&|]/g, " ")
      .replace(/\b(plus|and)\b/g, " ")
      .replace(/\s+/g, " ");
    if (!text) return null;

    let scope = defaults.scope || "local";
    if (/\b(global|everyone|all)\b/.test(text)) {
      scope = "global";
      text = text
        .replace(/\b(global|everyone|all)\b/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    } else if (/\b(local|solo|me|only me)\b/.test(text)) {
      scope = "local";
      text = text
        .replace(/\b(local|solo|me|only me)\b/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    }

    if (/^(clear|off|stop|end)\b/.test(text)) {
      if (/\bweather\b/.test(text) || /\b(storm|calm|wx)\b/.test(text)) {
        return { kind: "clear-weather", minutes: 0, mult: DEFAULT_MULT, scope, target: "" };
      }
      if (/\b(variant|silver|gold|diamond|rainbow|shiny|any)\b/.test(text)) {
        return { kind: "clear-variant", minutes: 0, mult: DEFAULT_MULT, scope, target: "" };
      }
      if (/\btoxic\b/.test(text)) {
        return { kind: "clear-toxic", minutes: 0, mult: DEFAULT_MULT, scope, target: "toxic" };
      }
      if (/\blava\b/.test(text)) {
        return { kind: "clear-lava", minutes: 0, mult: DEFAULT_MULT, scope, target: "lava" };
      }
      if (/\bneon\b/.test(text)) {
        return { kind: "clear-neon", minutes: 0, mult: DEFAULT_MULT, scope, target: "neon" };
      }
      if (/\b(mutation|mutations)\b/.test(text)) {
        return { kind: "clear-mutation", minutes: 0, mult: DEFAULT_MULT, scope, target: "" };
      }
      if (/\blucky\s*-?\s*blocks?\b|\bluckyblock\b|\blb\b/.test(text)) {
        return { kind: "clear-luckyblock", minutes: 0, mult: DEFAULT_MULT, scope, target: "" };
      }
      if (/\bchests?\b/.test(text)) {
        return { kind: "clear-chest", minutes: 0, mult: DEFAULT_MULT, scope, target: "" };
      }
      if (/\b(say|announce|announcement|message|msg|broadcast)\b/.test(text)) {
        return { kind: "clear-announce", minutes: 0, mult: DEFAULT_MULT, scope, target: "" };
      }
      if (/\b(speed|cast|cooldown|wait|faster)\b/.test(text)) {
        return { kind: "clear-speed", minutes: 0, mult: DEFAULT_MULT, scope, target: "" };
      }
      if (/\b(luck|sell|money|coin|boost)\b/.test(text)) {
        return { kind: "clear-boost", minutes: 0, mult: DEFAULT_MULT, scope, target: "" };
      }
      if (/\b(skies|sky)\b/.test(text)) {
        text = text
          .replace(/^(clear|off|stop|end)\b/, "weather")
          .replace(/\s+/g, " ")
          .trim();
      } else {
        return { kind: "clear", minutes: 0, mult: DEFAULT_MULT, scope, target: "" };
      }
    }

    let mult = defaults.mult != null ? clampAdminMult(defaults.mult) : DEFAULT_MULT;
    let usedExplicitMult = false;
    const multMatch = text.match(/(\d+(?:\.\d+)?)\s*x\b/);
    if (multMatch) {
      mult = clampAdminMult(multMatch[1]);
      usedExplicitMult = true;
      text =
        `${text.slice(0, multMatch.index)} ${text.slice(multMatch.index + multMatch[0].length)}`
          .replace(/\s+/g, " ")
          .trim();
    }

    let minutes = defaults.minutes != null ? clampAdminMinutes(defaults.minutes) : DEFAULT_MINUTES;
    const hoursMatch = text.match(/\b(\d{1,3}(?:\.\d+)?)\s*(?:h|hrs?|hours?)\b/);
    if (hoursMatch) {
      minutes = clampAdminMinutes(Number(hoursMatch[1]) * 60);
      text = text.replace(hoursMatch[0], " ").replace(/\s+/g, " ").trim();
    } else {
      const minsMatch = text.match(/\b(\d{1,4})\s*(?:m|mins?|minutes?)\b/);
      if (minsMatch) {
        minutes = clampAdminMinutes(minsMatch[1]);
        text = text.replace(minsMatch[0], " ").replace(/\s+/g, " ").trim();
      } else {
        const bare = text.match(/\b(\d{1,4})$/);
        if (bare) {
          minutes = clampAdminMinutes(bare[1]);
          text = text.replace(bare[0], " ").replace(/\s+/g, " ").trim();
        }
      }
    }

    if (
      !usedExplicitMult &&
      /^(sell|money|coin|luck|speed|cast|cooldown|wait|faster|chest|chests|luckyblock|lucky\s*-?\s*blocks?|lb|silver|gold|diamond|rainbow|shiny|any|variant|storm|calm|sunny|weather)(\s+(silver|gold|diamond|rainbow|shiny|any|storm|calm|none|clear|sunny|skies|sky))*$/.test(
        text
      )
    ) {
      mult = defaults.mult != null ? clampAdminMult(defaults.mult) : DEFAULT_MULT;
    }

    if (/\bstorm\b/.test(text) || /\brain\b/.test(text) || /\bthunder\b/.test(text)) {
      return { kind: "weather", minutes, mult: 1, scope, target: "storm" };
    }
    if (/\bcalm\b/.test(text)) {
      return { kind: "weather", minutes, mult: 1, scope, target: "calm" };
    }
    if (
      /\bsunny\b/.test(text) ||
      /\b(skies|sky)\b/.test(text) ||
      /\bweather\s+(none|clear|off)\b/.test(text) ||
      /^(none|clear)$/.test(text) ||
      text === "weather"
    ) {
      return { kind: "weather", minutes, mult: 1, scope, target: "none" };
    }
    if (/\blucky\s*-?\s*blocks?\b/.test(text) || /\bluckyblock\b/.test(text) || text === "lb") {
      return { kind: "luckyblock", minutes, mult, scope, target: "" };
    }
    if (/\bchests?\b/.test(text)) {
      return { kind: "chest", minutes, mult, scope, target: "" };
    }
    if (/\bneon\b/.test(text)) {
      return { kind: "mutation", minutes, mult, scope, target: "neon" };
    }
    if (/\blava\b/.test(text)) {
      return { kind: "mutation", minutes, mult, scope, target: "lava" };
    }
    if (/\btoxic\b/.test(text) || /\bmutation\b/.test(text)) {
      return { kind: "mutation", minutes, mult, scope, target: "toxic" };
    }
    if (
      /\b(speed|cast|cooldown|wait|faster)\b/.test(text) ||
      /^(speed|cast|cooldown|wait|faster)$/.test(text)
    ) {
      return { kind: "speed", minutes, mult, scope, target: "" };
    }
    if (/\bluck\b/.test(text) || text === "luck") {
      return { kind: "luck", minutes, mult, scope, target: "" };
    }
    if (/\b(money|sell|coin)\b/.test(text) || /^(sell|money|coin)$/.test(text)) {
      return { kind: "money", minutes, mult, scope, target: "" };
    }
    const variantWords = [...text.matchAll(/\b(silver|gold|diamond|rainbow|shiny|any)\b/g)].map(
      (m) => m[1]
    );
    if (variantWords.length || /\bvariant\b/.test(text)) {
      const target = normalizeAdminVariantTarget(variantWords.join("+") || "gold") || "gold";
      return { kind: "variant", minutes, mult, scope, target };
    }
    return null;
  }

  const api = {
    TOKEN,
    DEFAULT_MINUTES,
    DEFAULT_MULT,
    MAX_MINUTES,
    MIN_MULT,
    MAX_MULT,
    VARIANT_PRIMARY,
    MUTATIONS,
    clampAdminMult,
    clampAdminMinutes,
    normalizeMutation,
    normalizeAdminWeatherId,
    decodeVariantTarget,
    encodeVariantTarget,
    normalizeAdminVariantTarget,
    isVariantTargetSpec,
    parseAdminEventPayload,
    parseAdminBundle,
    parseMutationMap,
    emptyMutationMap,
    emptyChannels,
    isBoostAdminPayload,
    isVariantAdminPayload,
    isMutationAdminPayload,
    isChestAdminPayload,
    isLuckyBlockAdminPayload,
    isWeatherAdminPayload,
    isSpeedAdminPayload,
    pickBetterAdminEvent,
    mergeMutationMaps,
    pruneMutationMap,
    mutationMapHasAny,
    parseAdminCommand
  };
  root.FishingAdminEvents = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
