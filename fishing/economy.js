/**
 * Fishing Idle sell/look pricing. Live gear and event bonuses stay in script.js.
 */
(function (root) {
  const SOUL_TWIN_ID = "soultwin";
  const MYSTERY_FISH_ID = "mysteryfin";
  const VARIANT_PRIMARY = ["silver", "gold", "diamond", "rainbow"];
  const VARIANT_MULT = {
    silver: 1.5,
    gold: 2,
    diamond: 2.5,
    rainbow: 3
  };
  const SHINY_MULT = 3;
  const MUTATIONS = ["toxic", "lava", "neon"];
  const MUTATION_MULT = {
    toxic: 4,
    lava: 5,
    neon: 6
  };

  function normalizeMutation(raw) {
    const mutation = String(raw || "").toLowerCase();
    return MUTATIONS.includes(mutation) ? mutation : "";
  }

  function normalizeVariant(raw) {
    const variant = String(raw || "").toLowerCase();
    return VARIANT_PRIMARY.includes(variant) ? variant : "";
  }

  function normalizeVariants(raw) {
    if (!raw || typeof raw !== "object") return { variant: "", shiny: false, mutation: "" };
    return {
      variant: normalizeVariant(raw.variant),
      shiny: !!raw.shiny,
      mutation: normalizeMutation(raw.mutation)
    };
  }

  function resolveFish(fishOrId, resolve) {
    if (!fishOrId) return null;
    if (typeof fishOrId === "object") return fishOrId;
    return typeof resolve === "function" ? resolve(fishOrId) : null;
  }

  function isExclusiveFish(fishOrId, resolve) {
    if (!fishOrId) return false;
    if (typeof fishOrId === "string") {
      const fish = resolveFish(fishOrId, resolve);
      return (
        fishOrId === SOUL_TWIN_ID ||
        fishOrId === MYSTERY_FISH_ID ||
        !!fish?.exclusive ||
        fish?.rarity === "exclusive" ||
        fish?.rarity === "mystery"
      );
    }
    return !!(
      fishOrId.exclusive ||
      fishOrId.rarity === "exclusive" ||
      fishOrId.rarity === "mystery" ||
      fishOrId.id === SOUL_TWIN_ID ||
      fishOrId.id === MYSTERY_FISH_ID
    );
  }

  function isEggOnlyFish(fishOrId, resolve) {
    if (!fishOrId) return false;
    const fish = resolveFish(fishOrId, resolve);
    if (typeof fishOrId === "string") return !!fish?.eggOnly;
    return !!fishOrId.eggOnly;
  }

  function isTreasureItem(fish) {
    return !!(
      fish?.rarity === "treasure" ||
      fish?.kind === "luckyblock" ||
      fish?.id === "coin_chest" ||
      fish?.id === "luck_chest" ||
      fish?.id === "sunken_chest" ||
      String(fish?.id || "").startsWith("lucky_block_")
    );
  }

  function isUnsellableFish(fish, entry, resolve) {
    return isExclusiveFish(fish, resolve) || !!fish?.unsellable || !!entry?.unsellable;
  }

  function isUntradeableFish(fish, entry, resolve) {
    return isExclusiveFish(fish, resolve) || !!fish?.untradeable || !!entry?.untradeable;
  }

  function variantValueMult(variantOrEntry, shinyFlag) {
    let variant = "";
    let shiny = false;
    let mutation = "";
    if (variantOrEntry && typeof variantOrEntry === "object") {
      variant = normalizeVariant(variantOrEntry.variant);
      shiny = !!variantOrEntry.shiny;
      mutation = normalizeMutation(variantOrEntry.mutation);
    } else {
      variant = normalizeVariant(variantOrEntry);
      shiny = !!shinyFlag;
    }
    return (VARIANT_MULT[variant] || 1) * (shiny ? SHINY_MULT : 1) * (MUTATION_MULT[mutation] || 1);
  }

  function bookLookValue(fish, entry) {
    if (isExclusiveFish(fish)) {
      return Math.max(1, Math.floor(Number(entry?.lockedValue) || 2));
    }
    const base = Math.max(0, Number(fish?.value) || 0);
    const mult = entry ? variantValueMult(entry) : 1;
    return Math.max(1, Math.floor(base * mult));
  }

  function bonusesOf(raw) {
    const bonuses = raw && typeof raw === "object" ? raw : {};
    return {
      sellBonus: Number(bonuses.sellBonus) || 0,
      spotMastery: Number(bonuses.spotMastery) || 0,
      combo: Number(bonuses.combo) || 0,
      perfectBonus: Number(bonuses.perfectBonus) || 0,
      treasureMoney: Number(bonuses.treasureMoney) || 1
    };
  }

  function fishValue(fish, spot, perfectOrEntry, rawBonuses) {
    const entry = perfectOrEntry && typeof perfectOrEntry === "object" ? perfectOrEntry : null;
    const exclusiveBase = isExclusiveFish(fish)
      ? Math.max(1, Math.floor(Number(entry?.lockedValue) || 2))
      : 0;
    const base = Math.max(1, Math.floor((exclusiveBase || Number(fish?.value) || 0) * (spot?.valueMult || 1)));
    const perfect = perfectOrEntry === true || !!(entry && entry.perfect);
    const variantMult = entry && !isExclusiveFish(fish) ? variantValueMult(entry) : 1;
    const bonuses = bonusesOf(rawBonuses);
    const mult =
      (1 + bonuses.sellBonus + bonuses.spotMastery + bonuses.combo + (perfect ? bonuses.perfectBonus : 0)) *
      bonuses.treasureMoney *
      variantMult;
    return Math.max(1, Math.floor(base * mult));
  }

  function shouldAutoSellFish(fish, entry, opts, resolve) {
    const flags = opts && typeof opts === "object" ? opts : {};
    if (!fish || isUnsellableFish(fish, entry, resolve) || isExclusiveFish(fish, resolve) || isEggOnlyFish(fish, resolve)) {
      return false;
    }
    if (!flags.autoSellRarity) return false;
    if (normalizeMutation(entry?.mutation) && !flags.autoSellMutations) return false;
    return true;
  }

  function canSetBestCatch(fish, resolve) {
    const resolved = typeof fish === "string" ? resolveFish(fish, resolve) : fish;
    return !!(
      resolved &&
      !isExclusiveFish(resolved, resolve) &&
      !isTreasureItem(resolved) &&
      !isEggOnlyFish(resolved, resolve) &&
      resolved.rarity !== "easteregg"
    );
  }

  const api = {
    SOUL_TWIN_ID,
    MYSTERY_FISH_ID,
    VARIANT_PRIMARY,
    VARIANT_MULT,
    SHINY_MULT,
    MUTATIONS,
    MUTATION_MULT,
    normalizeMutation,
    normalizeVariant,
    normalizeVariants,
    isExclusiveFish,
    isEggOnlyFish,
    isTreasureItem,
    isUnsellableFish,
    isUntradeableFish,
    variantValueMult,
    bookLookValue,
    fishValue,
    shouldAutoSellFish,
    canSetBestCatch
  };
  if (root) root.FishingEconomy = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : typeof globalThis !== "undefined" ? globalThis : null);
