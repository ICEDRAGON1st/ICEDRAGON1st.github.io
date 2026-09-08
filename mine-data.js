/**
 * Shared Mine Depth layer/ore catalog (1000 each).
 * Used by mine/script.js and hub-leaderboard.js.
 */
(function () {
  const LAYER_COUNT = 1000;
  const ORE_COUNT = 1000;

  const ROCKS = [
    "Soil", "Clay", "Peat", "Sand", "Silt", "Loam", "Chalk", "Flint", "Shale", "Slate",
    "Stone", "Granite", "Basalt", "Marble", "Quartz", "Gneiss", "Schist", "Pumice", "Tuff", "Obsidian",
    "Magma", "Mantle", "Core", "Abyss", "Rift", "Void", "Astral", "Cosmic", "Plasma", "Crystal",
    "Ice", "Ash", "Rust", "Orebed", "Geode", "Vein", "Fault", "Trench", "Cavern", "Hollow"
  ];

  const ADJECTIVES = [
    "Raw", "Deep", "Dark", "Bright", "Ancient", "Molten", "Frozen", "Silent", "Hidden", "Lost",
    "Prime", "False", "True", "Wild", "Pure", "Rough", "Fine", "Heavy", "Light", "Sharp",
    "Soft", "Hard", "Vivid", "Pale", "Rich", "Poor", "Rare", "Common", "Sacred", "Cursed",
    "Solar", "Lunar", "Storm", "Dusty", "Glassy", "Rusty", "Living", "Dead", "Echo", "Nova"
  ];

  const ORE_NOUNS = [
    "Ore", "Shard", "Crystal", "Nugget", "Dust", "Gem", "Stone", "Ingot", "Sliver", "Core",
    "Pearl", "Chunk", "Grain", "Spike", "Plate", "Fiber", "Spark", "Seed", "Fragment", "Node"
  ];

  const EMOJIS = [
    "🪨", "⚪", "🟤", "⬛", "🟡", "🪙", "◼️", "🟠", "🗿", "🩶",
    "⚙️", "🟨", "🔘", "🥈", "🧲", "🔵", "🟢", "🥇", "💍", "🌈",
    "💚", "💙", "💎", "💜", "❤️", "💠", "🔷", "🖤", "🛡️", "🔥",
    "🔶", "📜", "🌑", "🗡️", "🌀", "🐦", "✨", "☀️", "⏳", "🫧",
    "🕳️", "🌱", "🧬", "☁️", "⚫", "🔮", "👁️", "🌠", "🌌", "Ω", "❄️", "🧿"
  ];

  const COLORS = [
    "#8d6e4c", "#a67c52", "#5c4030", "#c4a574", "#d6d0c2", "#7a7f86", "#6b6358", "#9b8b7a",
    "#4b5563", "#9aa4b2", "#64748b", "#d8d0c4", "#e7e5e4", "#5ec8c0", "#a78bfa", "#3b3348",
    "#b45309", "#e85d3c", "#dc2626", "#c2410c", "#9a3412", "#4a5568", "#1e293b", "#7f1d1d",
    "#991b1b", "#f0c14b", "#fbbf24", "#86efac", "#4ade80", "#c084fc", "#67e8f9", "#111827",
    "#312e81", "#0f172a", "#e0e7ff", "#818cf8", "#f472b6", "#e2e8f0", "#fb923c", "#2dd4bf"
  ];

  function layerMin(i) {
    if (i <= 0) return 0;
    // Smooth early game, huge late game — ~layer 999 near 2e9 m scale compressed via pow.
    return Math.floor(6 * i + Math.pow(i, 2.05) * 0.12 + Math.pow(i, 1.35) * 2);
  }

  function layerName(i) {
    const rock = ROCKS[i % ROCKS.length];
    const tier = Math.floor(i / ROCKS.length) + 1;
    if (tier === 1) return rock;
    const adj = ADJECTIVES[(i * 3) % ADJECTIVES.length];
    return `${adj} ${rock} ${tier}`;
  }

  function oreValue(i) {
    // Strictly increasing unique sell values.
    let v = Math.round(Math.pow(1.042, i) * (1 + i * 0.015));
    return Math.max(i + 1, v);
  }

  function oreName(i) {
    const adj = ADJECTIVES[i % ADJECTIVES.length];
    const noun = ORE_NOUNS[(i * 5) % ORE_NOUNS.length];
    const rock = ROCKS[(i * 7) % ROCKS.length];
    if (i < 40) return `${adj} ${rock}`;
    return `${adj} ${rock} ${noun}`;
  }

  function buildLayers() {
    const layers = [];
    for (let i = 0; i < LAYER_COUNT; i += 1) {
      layers.push({
        id: `layer_${i}`,
        name: layerName(i),
        min: layerMin(i),
        color: COLORS[i % COLORS.length],
        index: i
      });
    }
    return layers;
  }

  function buildOres(layers) {
    const ores = [];
    let prev = 0;
    for (let i = 0; i < ORE_COUNT; i += 1) {
      let value = oreValue(i);
      if (value <= prev) value = prev + 1;
      prev = value;
      const layerIdx = Math.min(layers.length - 1, Math.floor((i / ORE_COUNT) * layers.length));
      const minDepth = Math.max(0, layers[layerIdx].min - Math.floor(layers[layerIdx].min * 0.02));
      ores.push({
        id: `ore_${i}`,
        name: oreName(i),
        emoji: EMOJIS[i % EMOJIS.length],
        value,
        weight: Math.max(0.0015, 22 / Math.pow(i + 1, 0.92)),
        minDepth,
        index: i
      });
    }
    return ores;
  }

  const LAYERS = buildLayers();
  const ORES = buildOres(LAYERS);

  function oreByValue(score) {
    const n = Math.floor(Number(score) || 0);
    if (n <= 0) return null;
    const exact = ORES.find((o) => o.value === n);
    if (exact) return exact;
    let best = null;
    for (let i = 0; i < ORES.length; i += 1) {
      if (ORES[i].value <= n) best = ORES[i];
      else break;
    }
    return best;
  }

  function formatOre(score) {
    const ore = oreByValue(score);
    if (!ore) return "—";
    return `${ore.emoji} ${ore.name}`;
  }

  window.MineData = {
    LAYER_COUNT,
    ORE_COUNT,
    LAYERS,
    ORES,
    oreByValue,
    formatOre,
    layerMin
  };
})();
