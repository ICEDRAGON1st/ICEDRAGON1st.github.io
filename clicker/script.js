(function () {
  const SAVE_KEY = "clicker-save-v3";
  const HIGH_SCORE_KEY = "clicker-high-score-v3";
  const LOCAL_WIPE_ID = "hub-clicker-local-wipe-v2";
  const ICE_LOCAL_WIPE_ID = "hub-clicker-ice-dragon-wipe-v1";
  const TICK_MS = 100;
  const MIN_CLICK_MS = 50;
  const REBIRTH_BASE_COST = 3_000_000;

  // Force-clear every local Crystal Clicker key once (leaderboard wipe companion).
  try {
    if (localStorage.getItem(LOCAL_WIPE_ID) !== "done") {
      const doomed = [];
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (key && /^clicker/i.test(key)) doomed.push(key);
      }
      doomed.forEach((key) => localStorage.removeItem(key));
      localStorage.setItem(LOCAL_WIPE_ID, "done");
    }
  } catch {}

  // One-time: reset ICE_DRAGON's local Crystal Clicker progress only.
  try {
    const name = String(
      (typeof HubPlays !== "undefined" && HubPlays.getName && HubPlays.getName()) || ""
    )
      .trim()
      .toLowerCase();
    if (name === "ice_dragon" && localStorage.getItem(ICE_LOCAL_WIPE_ID) !== "done") {
      const doomed = [];
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (key && /^clicker/i.test(key)) doomed.push(key);
      }
      doomed.forEach((key) => localStorage.removeItem(key));
      try {
        const achKey = "hub-achievements-v1";
        const raw = localStorage.getItem(achKey);
        if (raw) {
          const data = JSON.parse(raw) || {};
          Object.keys(data).forEach((id) => {
            if (/^clicker_/i.test(id)) delete data[id];
          });
          localStorage.setItem(achKey, JSON.stringify(data));
        }
        const pendingKey = "hub-achievements-pending";
        const pendingRaw = localStorage.getItem(pendingKey);
        if (pendingRaw) {
          const list = JSON.parse(pendingRaw);
          if (Array.isArray(list)) {
            localStorage.setItem(
              pendingKey,
              JSON.stringify(list.filter((id) => !/^clicker_/i.test(String(id || ""))))
            );
          }
        }
      } catch {}
      localStorage.setItem(ICE_LOCAL_WIPE_ID, "done");
    }
  } catch {}

  const UPGRADES = [
    // Click power
    { id: "pickaxe", name: "Pickaxe", desc: "+1 per click", baseCost: 15, clickBonus: 1, cps: 0, group: "click" },
    { id: "knuckle", name: "Shard Knuckle", desc: "+2 per click", baseCost: 80, clickBonus: 2, cps: 0, group: "click" },
    { id: "gloves", name: "Crystal Gloves", desc: "+5 per click", baseCost: 250, clickBonus: 5, cps: 0, group: "click" },
    { id: "tongs", name: "Ore Tongs", desc: "+8 per click", baseCost: 600, clickBonus: 8, cps: 0, group: "click" },
    { id: "chisel", name: "Prism Chisel", desc: "+12 per click", baseCost: 1200, clickBonus: 12, cps: 0, group: "click" },
    { id: "prybar", name: "Gem Prybar", desc: "+18 per click", baseCost: 2800, clickBonus: 18, cps: 0, group: "click" },
    { id: "hammer", name: "Amber Hammer", desc: "+25 per click", baseCost: 5000, clickBonus: 25, cps: 0, group: "click" },
    { id: "claw", name: "Crystal Claw", desc: "+32 per click", baseCost: 10000, clickBonus: 32, cps: 0, group: "click" },
    { id: "spike", name: "Crystal Spike", desc: "+40 per click", baseCost: 18000, clickBonus: 40, cps: 0, group: "click" },
    { id: "flail", name: "Shard Flail", desc: "+50 per click", baseCost: 30000, clickBonus: 50, cps: 0, group: "click" },
    { id: "gauntlet", name: "Shard Gauntlet", desc: "+60 per click", baseCost: 45000, clickBonus: 60, cps: 0, group: "click" },
    { id: "whip", name: "Gem Whip", desc: "+70 per click", baseCost: 75000, clickBonus: 70, cps: 0, group: "click" },
    { id: "mace", name: "Ore Mace", desc: "+80 per click", baseCost: 120000, clickBonus: 80, cps: 0, group: "click" },
    { id: "saber", name: "Prism Saber", desc: "+90 per click", baseCost: 180000, clickBonus: 90, cps: 0, group: "click" },
    { id: "fist", name: "Titan Fist", desc: "+100 per click", baseCost: 250000, clickBonus: 100, cps: 0, group: "click" },
    { id: "spear", name: "Crystal Spear", desc: "+120 per click", baseCost: 350000, clickBonus: 120, cps: 0, group: "click" },
    { id: "blade", name: "Facet Blade", desc: "+150 per click", baseCost: 450000, clickBonus: 150, cps: 0, group: "click" },
    { id: "crossbow", name: "Shard Crossbow", desc: "+180 per click", baseCost: 650000, clickBonus: 180, cps: 0, group: "click" },
    { id: "lance", name: "Gem Lance", desc: "+220 per click", baseCost: 800000, clickBonus: 220, cps: 0, group: "click" },
    { id: "sling", name: "Ore Sling", desc: "+260 per click", baseCost: 1000000, clickBonus: 260, cps: 0, group: "click" },
    { id: "bow", name: "Crystal Bow", desc: "+300 per click", baseCost: 1300000, clickBonus: 300, cps: 0, group: "click" },
    { id: "ballista", name: "Amber Ballista", desc: "+350 per click", baseCost: 1600000, clickBonus: 350, cps: 0, group: "click" },
    { id: "cannon", name: "Crystal Cannon", desc: "+400 per click", baseCost: 2000000, clickBonus: 400, cps: 0, group: "click" },
    { id: "howitzer", name: "Gem Howitzer", desc: "+500 per click", baseCost: 3000000, clickBonus: 500, cps: 0, group: "click" },
    { id: "mortar", name: "Amber Mortar", desc: "+600 per click", baseCost: 4000000, clickBonus: 600, cps: 0, group: "click" },
    { id: "siege", name: "Siege Crystal", desc: "+750 per click", baseCost: 6000000, clickBonus: 750, cps: 0, group: "click" },
    { id: "railgun", name: "Amber Railgun", desc: "+900 per click", baseCost: 8000000, clickBonus: 900, cps: 0, group: "click" },
    { id: "pulse", name: "Pulse Driver", desc: "+1,100 per click", baseCost: 11000000, clickBonus: 1100, cps: 0, group: "click" },
    { id: "beam", name: "Prism Beam", desc: "+1,400 per click", baseCost: 15000000, clickBonus: 1400, cps: 0, group: "click" },
    { id: "flare", name: "Solar Flare", desc: "+1,700 per click", baseCost: 20000000, clickBonus: 1700, cps: 0, group: "click" },
    { id: "comet", name: "Comet Strike", desc: "+2,000 per click", baseCost: 25000000, clickBonus: 2000, cps: 0, group: "click" },
    { id: "plasma", name: "Plasma Needle", desc: "+2,800 per click", baseCost: 35000000, clickBonus: 2800, cps: 0, group: "click" },
    { id: "meteor", name: "Meteor Tap", desc: "+3,500 per click", baseCost: 45000000, clickBonus: 3500, cps: 0, group: "click" },
    { id: "lunar", name: "Lunar Crush", desc: "+4,500 per click", baseCost: 60000000, clickBonus: 4500, cps: 0, group: "click" },
    { id: "asteroid", name: "Asteroid Slam", desc: "+5,500 per click", baseCost: 75000000, clickBonus: 5500, cps: 0, group: "click" },
    { id: "photon", name: "Photon Fist", desc: "+6,500 per click", baseCost: 95000000, clickBonus: 6500, cps: 0, group: "click" },
    { id: "nova", name: "Nova Punch", desc: "+8,000 per click", baseCost: 120000000, clickBonus: 8000, cps: 0, group: "click" },
    { id: "antimatter", name: "Antimatter Tap", desc: "+12,000 per click", baseCost: 180000000, clickBonus: 12000, cps: 0, group: "click" },
    { id: "supernova", name: "Supernova Hit", desc: "+15,000 per click", baseCost: 250000000, clickBonus: 15000, cps: 0, group: "click" },
    { id: "hyper", name: "Hyper Jab", desc: "+20,000 per click", baseCost: 350000000, clickBonus: 20000, cps: 0, group: "click" },
    { id: "quasar", name: "Quasar Click", desc: "+25,000 per click", baseCost: 450000000, clickBonus: 25000, cps: 0, group: "click" },
    { id: "chrono", name: "Chrono Slap", desc: "+32,000 per click", baseCost: 600000000, clickBonus: 32000, cps: 0, group: "click" },
    { id: "bigbang", name: "Big Bang Tap", desc: "+40,000 per click", baseCost: 800000000, clickBonus: 40000, cps: 0, group: "click" },
    { id: "paradox", name: "Paradox Punch", desc: "+55,000 per click", baseCost: 1200000000, clickBonus: 55000, cps: 0, group: "click" },
    { id: "timeline", name: "Timeline Jab", desc: "+75,000 per click", baseCost: 1600000000, clickBonus: 75000, cps: 0, group: "click" },
    { id: "abyss", name: "Abyss Knuckle", desc: "+100,000 per click", baseCost: 2500000000, clickBonus: 100000, cps: 0, group: "click" },
    { id: "reality", name: "Reality Crack", desc: "+150,000 per click", baseCost: 3500000000, clickBonus: 150000, cps: 0, group: "click" },
    { id: "nexus", name: "Nexus Strike", desc: "+220,000 per click", baseCost: 5500000000, clickBonus: 220000, cps: 0, group: "click" },
    { id: "voidhand", name: "Void Hand", desc: "+300,000 per click", baseCost: 8000000000, clickBonus: 300000, cps: 0, group: "click" },
    { id: "rift", name: "Rift Tap", desc: "+500,000 per click", baseCost: 14000000000, clickBonus: 500000, cps: 0, group: "click" },
    { id: "omnitap", name: "Omni Tap", desc: "+750,000 per click", baseCost: 20000000000, clickBonus: 750000, cps: 0, group: "click" },
    { id: "genesis", name: "Genesis Flick", desc: "+1.2M per click", baseCost: 40000000000, clickBonus: 1200000, cps: 0, group: "click" },
    { id: "godfinger", name: "God Finger", desc: "+2M per click", baseCost: 60000000000, clickBonus: 2000000, cps: 0, group: "click" },
    { id: "apocalypse", name: "Apocalypse Tap", desc: "+4M per click", baseCost: 120000000000, clickBonus: 4000000, cps: 0, group: "click" },
    { id: "worldender", name: "World Ender", desc: "+8M per click", baseCost: 200000000000, clickBonus: 8000000, cps: 0, group: "click" },
    { id: "cataclysm", name: "Cataclysm Hit", desc: "+15M per click", baseCost: 500000000000, clickBonus: 15000000, cps: 0, group: "click" },
    { id: "extinction", name: "Extinction Blow", desc: "+30M per click", baseCost: 1200000000000, clickBonus: 30000000, cps: 0, group: "click" },
    { id: "omega", name: "Omega Click", desc: "+75M per click", baseCost: 3000000000000, clickBonus: 75000000, cps: 0, group: "click" },
    { id: "infinitytap", name: "Infinity Tap", desc: "+200M per click", baseCost: 8000000000000, clickBonus: 200000000, cps: 0, group: "click" },
    { id: "eternalfist", name: "Eternal Fist", desc: "+500M per click", baseCost: 20000000000000, clickBonus: 500000000, cps: 0, group: "click" },
    { id: "absolutetap", name: "Absolute Tap", desc: "+1.5B per click", baseCost: 50000000000000, clickBonus: 1500000000, cps: 0, group: "click" },
    { id: "creation", name: "Creation Click", desc: "+5B per click", baseCost: 150000000000000, clickBonus: 5000000000, cps: 0, group: "click" },
    { id: "source", name: "Source Strike", desc: "+20B per click", baseCost: 500000000000000, clickBonus: 20000000000, cps: 0, group: "click" },
    { id: "primordial", name: "Primordial Tap", desc: "+50B per click", baseCost: 1.2e15, clickBonus: 5e10, cps: 0, group: "click" },
    { id: "echo", name: "Echo Strike", desc: "+120B per click", baseCost: 3e15, clickBonus: 1.2e11, cps: 0, group: "click" },
    { id: "fractal", name: "Fractal Fist", desc: "+300B per click", baseCost: 8e15, clickBonus: 3e11, cps: 0, group: "click" },
    { id: "mythos", name: "Mythos Jab", desc: "+750B per click", baseCost: 2e16, clickBonus: 7.5e11, cps: 0, group: "click" },
    { id: "legendtap", name: "Legend Tap", desc: "+2T per click", baseCost: 5e16, clickBonus: 2e12, cps: 0, group: "click" },
    { id: "divine", name: "Divine Punch", desc: "+5T per click", baseCost: 1.2e17, clickBonus: 5e12, cps: 0, group: "click" },
    { id: "celestial", name: "Celestial Hit", desc: "+12T per click", baseCost: 3e17, clickBonus: 1.2e13, cps: 0, group: "click" },
    { id: "astral", name: "Astral Click", desc: "+30T per click", baseCost: 8e17, clickBonus: 3e13, cps: 0, group: "click" },
    { id: "dominion", name: "Dominion Blow", desc: "+75T per click", baseCost: 2e18, clickBonus: 7.5e13, cps: 0, group: "click" },
    { id: "empire", name: "Empire Tap", desc: "+200T per click", baseCost: 5e18, clickBonus: 2e14, cps: 0, group: "click" },
    { id: "pantheon", name: "Pantheon Strike", desc: "+500T per click", baseCost: 1.2e19, clickBonus: 5e14, cps: 0, group: "click" },
    { id: "monolith", name: "Monolith Fist", desc: "+1.5Qa per click", baseCost: 3e19, clickBonus: 1.5e15, cps: 0, group: "click" },
    { id: "alpha", name: "Alpha Click", desc: "+5Qa per click", baseCost: 8e19, clickBonus: 5e15, cps: 0, group: "click" },
    { id: "singularitytap", name: "Singularity Tap", desc: "+15Qa per click", baseCost: 2e20, clickBonus: 1.5e16, cps: 0, group: "click" },
    { id: "axiom", name: "Axiom Strike", desc: "+50Qa per click", baseCost: 5e20, clickBonus: 5e16, cps: 0, group: "click" },
    { id: "theorem", name: "Theorem Tap", desc: "+120Qa per click", baseCost: 1.2e21, clickBonus: 1.2e17, cps: 0, group: "click" },
    { id: "lemma", name: "Lemma Jab", desc: "+300Qa per click", baseCost: 3e21, clickBonus: 3e17, cps: 0, group: "click" },
    { id: "proof", name: "Proof Punch", desc: "+750Qa per click", baseCost: 8e21, clickBonus: 7.5e17, cps: 0, group: "click" },
    { id: "logic", name: "Logic Strike", desc: "+2Qi per click", baseCost: 2e22, clickBonus: 2e18, cps: 0, group: "click" },
    { id: "reason", name: "Reason Fist", desc: "+5Qi per click", baseCost: 5e22, clickBonus: 5e18, cps: 0, group: "click" },
    { id: "truth", name: "Truth Click", desc: "+12Qi per click", baseCost: 1.2e23, clickBonus: 1.2e19, cps: 0, group: "click" },
    { id: "verity", name: "Verity Blow", desc: "+30Qi per click", baseCost: 3e23, clickBonus: 3e19, cps: 0, group: "click" },
    { id: "clarity", name: "Clarity Tap", desc: "+75Qi per click", baseCost: 8e23, clickBonus: 7.5e19, cps: 0, group: "click" },
    { id: "insight", name: "Insight Hit", desc: "+200Qi per click", baseCost: 2e24, clickBonus: 2e20, cps: 0, group: "click" },
    { id: "wisdom", name: "Wisdom Strike", desc: "+500Qi per click", baseCost: 5e24, clickBonus: 5e20, cps: 0, group: "click" },
    { id: "enlighten", name: "Enlighten Tap", desc: "+1.2Sx per click", baseCost: 1.2e25, clickBonus: 1.2e21, cps: 0, group: "click" },
    { id: "nirvana", name: "Nirvana Punch", desc: "+3Sx per click", baseCost: 3e25, clickBonus: 3e21, cps: 0, group: "click" },
    { id: "ascendtap", name: "Ascend Click", desc: "+8Sx per click", baseCost: 8e25, clickBonus: 8e21, cps: 0, group: "click" },
    { id: "exalt", name: "Exalt Fist", desc: "+20Sx per click", baseCost: 2e26, clickBonus: 2e22, cps: 0, group: "click" },
    { id: "radiance", name: "Radiance Blow", desc: "+50Sx per click", baseCost: 5e26, clickBonus: 5e22, cps: 0, group: "click" },
    { id: "lumin", name: "Lumin Strike", desc: "+120Sx per click", baseCost: 1.2e27, clickBonus: 1.2e23, cps: 0, group: "click" },
    { id: "aurora", name: "Aurora Tap", desc: "+300Sx per click", baseCost: 3e27, clickBonus: 3e23, cps: 0, group: "click" },
    { id: "zenithtap", name: "Zenith Click", desc: "+750Sx per click", baseCost: 8e27, clickBonus: 7.5e23, cps: 0, group: "click" },
    { id: "apexstrike", name: "Apex Strike", desc: "+2Sp per click", baseCost: 2e28, clickBonus: 2e24, cps: 0, group: "click" },
    { id: "summit", name: "Summit Fist", desc: "+5Sp per click", baseCost: 5e28, clickBonus: 5e24, cps: 0, group: "click" },
    { id: "pinnacle", name: "Pinnacle Hit", desc: "+12Sp per click", baseCost: 1.2e29, clickBonus: 1.2e25, cps: 0, group: "click" },
    { id: "crest", name: "Crest Blow", desc: "+30Sp per click", baseCost: 3e29, clickBonus: 3e25, cps: 0, group: "click" },
    { id: "crown", name: "Crown Tap", desc: "+75Sp per click", baseCost: 8e29, clickBonus: 7.5e25, cps: 0, group: "click" },
    { id: "throne", name: "Throne Click", desc: "+200Sp per click", baseCost: 2e30, clickBonus: 2e26, cps: 0, group: "click" },
    { id: "sovereign", name: "Sovereign Strike", desc: "+500Sp per click", baseCost: 5e30, clickBonus: 5e26, cps: 0, group: "click" },
    { id: "imperium", name: "Imperium Punch", desc: "+1.2Oc per click", baseCost: 1.2e31, clickBonus: 1.2e27, cps: 0, group: "click" },
    { id: "dynasty", name: "Dynasty Tap", desc: "+3Oc per click", baseCost: 3e31, clickBonus: 3e27, cps: 0, group: "click" },
    { id: "legacy", name: "Legacy Fist", desc: "+8Oc per click", baseCost: 8e31, clickBonus: 8e27, cps: 0, group: "click" },
    { id: "heritage", name: "Heritage Blow", desc: "+20Oc per click", baseCost: 2e32, clickBonus: 2e28, cps: 0, group: "click" },
    { id: "ancestral", name: "Ancestral Hit", desc: "+50Oc per click", baseCost: 5e32, clickBonus: 5e28, cps: 0, group: "click" },
    { id: "mythic", name: "Mythic Click", desc: "+120Oc per click", baseCost: 1.2e33, clickBonus: 1.2e29, cps: 0, group: "click" },
    { id: "epic", name: "Epic Strike", desc: "+300Oc per click", baseCost: 3e33, clickBonus: 3e29, cps: 0, group: "click" },
    { id: "fabled", name: "Fabled Tap", desc: "+750Oc per click", baseCost: 8e33, clickBonus: 7.5e29, cps: 0, group: "click" },
    { id: "relic", name: "Relic Punch", desc: "+2No per click", baseCost: 2e34, clickBonus: 2e30, cps: 0, group: "click" },
    { id: "artifact", name: "Artifact Fist", desc: "+5No per click", baseCost: 5e34, clickBonus: 5e30, cps: 0, group: "click" },
    { id: "relicore", name: "Relic Core Tap", desc: "+12No per click", baseCost: 1.2e35, clickBonus: 1.2e31, cps: 0, group: "click" },
    { id: "archive", name: "Archive Strike", desc: "+30No per click", baseCost: 3e35, clickBonus: 3e31, cps: 0, group: "click" },
    { id: "codex", name: "Codex Click", desc: "+75No per click", baseCost: 8e35, clickBonus: 7.5e31, cps: 0, group: "click" },
    // Idle income
    { id: "miner", name: "Miner", desc: "+0.5 / sec", baseCost: 50, clickBonus: 0, cps: 0.5, group: "idle" },
    { id: "cart", name: "Mine Cart", desc: "+2 / sec", baseCost: 150, clickBonus: 0, cps: 2, group: "idle" },
    { id: "sieve", name: "Gem Sieve", desc: "+3 / sec", baseCost: 280, clickBonus: 0, cps: 3, group: "idle" },
    { id: "drill", name: "Crystal Drill", desc: "+4 / sec", baseCost: 400, clickBonus: 0, cps: 4, group: "idle" },
    { id: "pump", name: "Amber Pump", desc: "+7 / sec", baseCost: 750, clickBonus: 0, cps: 7, group: "idle" },
    { id: "tunnel", name: "Deep Tunnel", desc: "+10 / sec", baseCost: 1200, clickBonus: 0, cps: 10, group: "idle" },
    { id: "shaft", name: "Mine Shaft", desc: "+15 / sec", baseCost: 2000, clickBonus: 0, cps: 15, group: "idle" },
    { id: "quarry", name: "Quarry", desc: "+20 / sec", baseCost: 3000, clickBonus: 0, cps: 20, group: "idle" },
    { id: "crusher", name: "Ore Crusher", desc: "+35 / sec", baseCost: 5500, clickBonus: 0, cps: 35, group: "idle" },
    { id: "refinery", name: "Gem Refinery", desc: "+50 / sec", baseCost: 8000, clickBonus: 0, cps: 50, group: "idle" },
    { id: "kiln", name: "Crystal Kiln", desc: "+75 / sec", baseCost: 13000, clickBonus: 0, cps: 75, group: "idle" },
    { id: "factory", name: "Gem Factory", desc: "+100 / sec", baseCost: 20000, clickBonus: 0, cps: 100, group: "idle" },
    { id: "assembly", name: "Shard Assembly", desc: "+150 / sec", baseCost: 30000, clickBonus: 0, cps: 150, group: "idle" },
    { id: "pipeline", name: "Amber Pipeline", desc: "+200 / sec", baseCost: 40000, clickBonus: 0, cps: 200, group: "idle" },
    { id: "depot", name: "Crystal Depot", desc: "+275 / sec", baseCost: 55000, clickBonus: 0, cps: 275, group: "idle" },
    { id: "megamine", name: "Mega Mine", desc: "+350 / sec", baseCost: 75000, clickBonus: 0, cps: 350, group: "idle" },
    { id: "complex", name: "Mining Complex", desc: "+500 / sec", baseCost: 110000, clickBonus: 0, cps: 500, group: "idle" },
    { id: "reactor", name: "Amber Reactor", desc: "+750 / sec", baseCost: 150000, clickBonus: 0, cps: 750, group: "idle" },
    { id: "lab", name: "Crystal Lab", desc: "+1,100 / sec", baseCost: 220000, clickBonus: 0, cps: 1100, group: "idle" },
    { id: "foundry", name: "Crystal Foundry", desc: "+1,500 / sec", baseCost: 300000, clickBonus: 0, cps: 1500, group: "idle" },
    { id: "smelter", name: "Prism Smelter", desc: "+2,000 / sec", baseCost: 400000, clickBonus: 0, cps: 2000, group: "idle" },
    { id: "vault", name: "Crystal Vault", desc: "+2,500 / sec", baseCost: 500000, clickBonus: 0, cps: 2500, group: "idle" },
    { id: "bank", name: "Gem Bank", desc: "+4,000 / sec", baseCost: 800000, clickBonus: 0, cps: 4000, group: "idle" },
    { id: "city", name: "Gem City", desc: "+6,000 / sec", baseCost: 1200000, clickBonus: 0, cps: 6000, group: "idle" },
    { id: "metropolis", name: "Crystal Metropolis", desc: "+9,000 / sec", baseCost: 1800000, clickBonus: 0, cps: 9000, group: "idle" },
    { id: "fortress", name: "Ore Fortress", desc: "+12,000 / sec", baseCost: 2500000, clickBonus: 0, cps: 12000, group: "idle" },
    { id: "citadel", name: "Amber Citadel", desc: "+20,000 / sec", baseCost: 4200000, clickBonus: 0, cps: 20000, group: "idle" },
    { id: "orbital", name: "Orbital Laser", desc: "+35,000 / sec", baseCost: 7000000, clickBonus: 0, cps: 35000, group: "idle" },
    { id: "satnet", name: "Satellite Net", desc: "+50,000 / sec", baseCost: 10000000, clickBonus: 0, cps: 50000, group: "idle" },
    { id: "nebula", name: "Nebula Drill", desc: "+75,000 / sec", baseCost: 15000000, clickBonus: 0, cps: 75000, group: "idle" },
    { id: "galaxy", name: "Galaxy Bore", desc: "+120,000 / sec", baseCost: 25000000, clickBonus: 0, cps: 120000, group: "idle" },
    { id: "dyson", name: "Dyson Mine", desc: "+200,000 / sec", baseCost: 40000000, clickBonus: 0, cps: 200000, group: "idle" },
    { id: "cluster", name: "Star Cluster", desc: "+350,000 / sec", baseCost: 70000000, clickBonus: 0, cps: 350000, group: "idle" },
    { id: "singularity", name: "Singularity Core", desc: "+500,000 / sec", baseCost: 100000000, clickBonus: 0, cps: 500000, group: "idle" },
    { id: "blackhole", name: "Black Hole Siphon", desc: "+750,000 / sec", baseCost: 150000000, clickBonus: 0, cps: 750000, group: "idle" },
    { id: "wormhole", name: "Wormhole Quarry", desc: "+1M / sec", baseCost: 220000000, clickBonus: 0, cps: 1000000, group: "idle" },
    { id: "hyperspace", name: "Hyperspace Rig", desc: "+1.5M / sec", baseCost: 350000000, clickBonus: 0, cps: 1500000, group: "idle" },
    { id: "multiverse", name: "Multiverse Pick", desc: "+2M / sec", baseCost: 500000000, clickBonus: 0, cps: 2000000, group: "idle" },
    { id: "parallel", name: "Parallel Mines", desc: "+3.5M / sec", baseCost: 800000000, clickBonus: 0, cps: 3500000, group: "idle" },
    { id: "timeloop", name: "Time Loop Mine", desc: "+5M / sec", baseCost: 1200000000, clickBonus: 0, cps: 5000000, group: "idle" },
    { id: "chronos", name: "Chronos Drill", desc: "+7.5M / sec", baseCost: 1800000000, clickBonus: 0, cps: 7500000, group: "idle" },
    { id: "infinity", name: "Infinity Vein", desc: "+10M / sec", baseCost: 2500000000, clickBonus: 0, cps: 10000000, group: "idle" },
    { id: "eternity", name: "Eternity Shaft", desc: "+15M / sec", baseCost: 4000000000, clickBonus: 0, cps: 15000000, group: "idle" },
    { id: "omni", name: "Omni Extractor", desc: "+25M / sec", baseCost: 6000000000, clickBonus: 0, cps: 25000000, group: "idle" },
    { id: "cosmos", name: "Cosmos Harvester", desc: "+50M / sec", baseCost: 12000000000, clickBonus: 0, cps: 50000000, group: "idle" },
    { id: "absolute", name: "Absolute Crystal", desc: "+100M / sec", baseCost: 20000000000, clickBonus: 0, cps: 100000000, group: "idle" },
    { id: "prime", name: "Prime Reality", desc: "+250M / sec", baseCost: 50000000000, clickBonus: 0, cps: 250000000, group: "idle" },
    { id: "apex", name: "Apex Engine", desc: "+500M / sec", baseCost: 100000000000, clickBonus: 0, cps: 500000000, group: "idle" },
    { id: "zenith", name: "Zenith Forge", desc: "+1B / sec", baseCost: 220000000000, clickBonus: 0, cps: 1000000000, group: "idle" },
    { id: "ultimate", name: "Ultimate Vein", desc: "+2.5B / sec", baseCost: 500000000000, clickBonus: 0, cps: 2500000000, group: "idle" },
    { id: "finality", name: "Finality Core", desc: "+10B / sec", baseCost: 2000000000000, clickBonus: 0, cps: 10000000000, group: "idle" },
    { id: "transcend", name: "Transcend Mine", desc: "+25B / sec", baseCost: 5000000000000, clickBonus: 0, cps: 25000000000, group: "idle" },
    { id: "origin", name: "Origin Harvester", desc: "+75B / sec", baseCost: 15000000000000, clickBonus: 0, cps: 75000000000, group: "idle" },
    { id: "beyond", name: "Beyond Extractor", desc: "+250B / sec", baseCost: 50000000000000, clickBonus: 0, cps: 250000000000, group: "idle" },
    { id: "frontier", name: "Frontier Rig", desc: "+600B / sec", baseCost: 1.2e14, clickBonus: 0, cps: 6e11, group: "idle" },
    { id: "horizon", name: "Horizon Bore", desc: "+1.5T / sec", baseCost: 3e14, clickBonus: 0, cps: 1.5e12, group: "idle" },
    { id: "cascade", name: "Cascade Vein", desc: "+4T / sec", baseCost: 8e14, clickBonus: 0, cps: 4e12, group: "idle" },
    { id: "torrent", name: "Torrent Mine", desc: "+10T / sec", baseCost: 2e15, clickBonus: 0, cps: 1e13, group: "idle" },
    { id: "maelstrom", name: "Maelstrom Drill", desc: "+25T / sec", baseCost: 5e15, clickBonus: 0, cps: 2.5e13, group: "idle" },
    { id: "tempest", name: "Tempest Quarry", desc: "+60T / sec", baseCost: 1.2e16, clickBonus: 0, cps: 6e13, group: "idle" },
    { id: "catalyst", name: "Catalyst Forge", desc: "+150T / sec", baseCost: 3e16, clickBonus: 0, cps: 1.5e14, group: "idle" },
    { id: "alchemy", name: "Alchemy Engine", desc: "+400T / sec", baseCost: 8e16, clickBonus: 0, cps: 4e14, group: "idle" },
    { id: "arcane", name: "Arcane Siphon", desc: "+1Qa / sec", baseCost: 2e17, clickBonus: 0, cps: 1e15, group: "idle" },
    { id: "runeforge", name: "Rune Forge", desc: "+2.5Qa / sec", baseCost: 5e17, clickBonus: 0, cps: 2.5e15, group: "idle" },
    { id: "oracle", name: "Oracle Mine", desc: "+6Qa / sec", baseCost: 1.2e18, clickBonus: 0, cps: 6e15, group: "idle" },
    { id: "prophecy", name: "Prophecy Shaft", desc: "+15Qa / sec", baseCost: 3e18, clickBonus: 0, cps: 1.5e16, group: "idle" },
    { id: "fate", name: "Fate Extractor", desc: "+40Qa / sec", baseCost: 8e18, clickBonus: 0, cps: 4e16, group: "idle" },
    { id: "destiny", name: "Destiny Core", desc: "+100Qa / sec", baseCost: 2e19, clickBonus: 0, cps: 1e17, group: "idle" },
    { id: "eternum", name: "Eternum Harvester", desc: "+300Qa / sec", baseCost: 5e19, clickBonus: 0, cps: 3e17, group: "idle" },
    { id: "infinitum", name: "Infinitum Rig", desc: "+750Qa / sec", baseCost: 1.2e20, clickBonus: 0, cps: 7.5e17, group: "idle" },
    { id: "continuum", name: "Continuum Bore", desc: "+2Qi / sec", baseCost: 3e20, clickBonus: 0, cps: 2e18, group: "idle" },
    { id: "spectrum", name: "Spectrum Vein", desc: "+5Qi / sec", baseCost: 8e20, clickBonus: 0, cps: 5e18, group: "idle" },
    { id: "prismnet", name: "Prism Network", desc: "+12Qi / sec", baseCost: 2e21, clickBonus: 0, cps: 1.2e19, group: "idle" },
    { id: "lattice", name: "Lattice Mine", desc: "+30Qi / sec", baseCost: 5e21, clickBonus: 0, cps: 3e19, group: "idle" },
    { id: "matrix", name: "Matrix Drill", desc: "+75Qi / sec", baseCost: 1.2e22, clickBonus: 0, cps: 7.5e19, group: "idle" },
    { id: "grid", name: "Grid Quarry", desc: "+200Qi / sec", baseCost: 3e22, clickBonus: 0, cps: 2e20, group: "idle" },
    { id: "array", name: "Array Forge", desc: "+500Qi / sec", baseCost: 8e22, clickBonus: 0, cps: 5e20, group: "idle" },
    { id: "vector", name: "Vector Engine", desc: "+1.2Sx / sec", baseCost: 2e23, clickBonus: 0, cps: 1.2e21, group: "idle" },
    { id: "tensor", name: "Tensor Siphon", desc: "+3Sx / sec", baseCost: 5e23, clickBonus: 0, cps: 3e21, group: "idle" },
    { id: "quantum", name: "Quantum Forge", desc: "+8Sx / sec", baseCost: 1.2e24, clickBonus: 0, cps: 8e21, group: "idle" },
    { id: "qubit", name: "Qubit Mine", desc: "+20Sx / sec", baseCost: 3e24, clickBonus: 0, cps: 2e22, group: "idle" },
    { id: "entangle", name: "Entangle Shaft", desc: "+50Sx / sec", baseCost: 8e24, clickBonus: 0, cps: 5e22, group: "idle" },
    { id: "superpose", name: "Superpose Extractor", desc: "+120Sx / sec", baseCost: 2e25, clickBonus: 0, cps: 1.2e23, group: "idle" },
    { id: "collapse", name: "Collapse Core", desc: "+300Sx / sec", baseCost: 5e25, clickBonus: 0, cps: 3e23, group: "idle" },
    { id: "waveform", name: "Waveform Harvester", desc: "+750Sx / sec", baseCost: 1.2e26, clickBonus: 0, cps: 7.5e23, group: "idle" },
    { id: "field", name: "Field Rig", desc: "+2Sp / sec", baseCost: 3e26, clickBonus: 0, cps: 2e24, group: "idle" },
    { id: "manifold", name: "Manifold Bore", desc: "+5Sp / sec", baseCost: 8e26, clickBonus: 0, cps: 5e24, group: "idle" },
    { id: "topology", name: "Topology Vein", desc: "+12Sp / sec", baseCost: 2e27, clickBonus: 0, cps: 1.2e25, group: "idle" },
    { id: "geometry", name: "Geometry Mine", desc: "+30Sp / sec", baseCost: 5e27, clickBonus: 0, cps: 3e25, group: "idle" },
    { id: "dimension", name: "Dimension Drill", desc: "+75Sp / sec", baseCost: 1.2e28, clickBonus: 0, cps: 7.5e25, group: "idle" },
    { id: "hyperplane", name: "Hyperplane Quarry", desc: "+200Sp / sec", baseCost: 3e28, clickBonus: 0, cps: 2e26, group: "idle" },
    { id: "brane", name: "Brane Forge", desc: "+500Sp / sec", baseCost: 8e28, clickBonus: 0, cps: 5e26, group: "idle" },
    { id: "membrane", name: "Membrane Engine", desc: "+1.2Oc / sec", baseCost: 2e29, clickBonus: 0, cps: 1.2e27, group: "idle" },
    { id: "stringnet", name: "String Network", desc: "+3Oc / sec", baseCost: 5e29, clickBonus: 0, cps: 3e27, group: "idle" },
    { id: "loopspace", name: "Loopspace Siphon", desc: "+8Oc / sec", baseCost: 1.2e30, clickBonus: 0, cps: 8e27, group: "idle" },
    { id: "calabi", name: "Calabi Mine", desc: "+20Oc / sec", baseCost: 3e30, clickBonus: 0, cps: 2e28, group: "idle" },
    { id: "yau", name: "Yau Shaft", desc: "+50Oc / sec", baseCost: 8e30, clickBonus: 0, cps: 5e28, group: "idle" },
    { id: "flux", name: "Flux Extractor", desc: "+120Oc / sec", baseCost: 2e31, clickBonus: 0, cps: 1.2e29, group: "idle" },
    { id: "plasmawell", name: "Plasma Well", desc: "+300Oc / sec", baseCost: 5e31, clickBonus: 0, cps: 3e29, group: "idle" },
    { id: "ionstorm", name: "Ion Storm Rig", desc: "+750Oc / sec", baseCost: 1.2e32, clickBonus: 0, cps: 7.5e29, group: "idle" },
    { id: "magnetar", name: "Magnetar Bore", desc: "+2No / sec", baseCost: 3e32, clickBonus: 0, cps: 2e30, group: "idle" },
    { id: "pulsar", name: "Pulsar Vein", desc: "+5No / sec", baseCost: 8e32, clickBonus: 0, cps: 5e30, group: "idle" },
    { id: "neutron", name: "Neutron Forge", desc: "+12No / sec", baseCost: 2e33, clickBonus: 0, cps: 1.2e31, group: "idle" },
    { id: "quark", name: "Quark Mine", desc: "+30No / sec", baseCost: 5e33, clickBonus: 0, cps: 3e31, group: "idle" },
    { id: "gluon", name: "Gluon Drill", desc: "+75No / sec", baseCost: 1.2e34, clickBonus: 0, cps: 7.5e31, group: "idle" },
    { id: "hadron", name: "Hadron Quarry", desc: "+200No / sec", baseCost: 3e34, clickBonus: 0, cps: 2e32, group: "idle" },
    { id: "baryon", name: "Baryon Harvester", desc: "+500No / sec", baseCost: 8e34, clickBonus: 0, cps: 5e32, group: "idle" }
  ];

  const SHOP_GROUPS = [
    { id: "click", title: "Click power", blurb: "Stronger taps" },
    { id: "idle", title: "Idle income", blurb: "Crystals while AFK" }
  ];

  const crystalCountEl = document.getElementById("crystal-count");
  const cpsLabelEl = document.getElementById("cps-label");
  const hudCpsEl = document.getElementById("hud-cps");
  const hudBestEl = document.getElementById("hud-best");
  const hudMultEl = document.getElementById("hud-mult");
  const multLabelEl = document.getElementById("mult-label");
  const clickPowerEl = document.getElementById("click-power-label");
  const overlayBestEl = document.getElementById("overlay-best");
  const crystalBtn = document.getElementById("crystal-btn");
  const shopList = document.getElementById("shop-list");
  const overlay = document.getElementById("overlay");
  const startBtn = document.getElementById("start-btn");
  const gamesBtn = document.getElementById("games-btn");
  const menuBtn = document.getElementById("menu-btn");
  const rebirthBtn = document.getElementById("rebirth-btn");
  const rebirthDesc = document.getElementById("rebirth-desc");
  const rebirthMultEl = document.getElementById("rebirth-mult");
  const floatLayer = document.getElementById("float-layer");

  let state = defaultState();
  let sessionStarted = false;
  let lastSaveAt = 0;
  let lastSubmitAt = 0;
  let lastClickAt = 0;

  function defaultState() {
    const owned = {};
    UPGRADES.forEach((u) => {
      owned[u.id] = 0;
    });
    return {
      crystals: 0,
      lifetime: 0,
      clickPower: 1,
      rebirths: 0,
      owned
    };
  }

  function multiplier() {
    return Math.pow(2, Math.max(0, Math.floor(state.rebirths || 0)));
  }

  function loadState() {
    try {
      const raw = JSON.parse(localStorage.getItem(SAVE_KEY) || "null");
      if (!raw || typeof raw !== "object") return defaultState();
      const next = defaultState();
      next.crystals = Math.max(0, Number(raw.crystals) || 0);
      next.lifetime = Math.max(0, Number(raw.lifetime) || 0);
      next.rebirths = Math.max(0, Math.floor(Number(raw.rebirths) || 0));
      next.clickPower = Math.max(1, Number(raw.clickPower) || 1);
      UPGRADES.forEach((u) => {
        next.owned[u.id] = Math.max(0, Math.floor(Number(raw.owned?.[u.id]) || 0));
      });
      next.clickPower =
        1 +
        UPGRADES.reduce((sum, u) => sum + (u.clickBonus || 0) * (next.owned[u.id] || 0), 0);
      return next;
    } catch {
      return defaultState();
    }
  }

  function saveState() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(state));
      const best = Math.max(getStoredBest(), Math.floor(state.lifetime));
      localStorage.setItem(HIGH_SCORE_KEY, String(best));
    } catch {}
  }

  function getStoredBest() {
    return Math.max(0, Math.floor(Number(localStorage.getItem(HIGH_SCORE_KEY)) || 0));
  }

  const SUFFIXES = ["", "K", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No", "Dc"];

  function formatNum(n) {
    let v = Number(n) || 0;
    if (!Number.isFinite(v)) return "0";
    const neg = v < 0;
    v = Math.abs(v);
    if (v < 1000) {
      const plain = v >= 100 ? String(Math.floor(v)) : v % 1 === 0 ? String(Math.floor(v)) : v.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
      return neg ? `-${plain}` : plain;
    }
    let tier = 0;
    while (v >= 1000 && tier < SUFFIXES.length - 1) {
      v /= 1000;
      tier += 1;
    }
    let digits;
    if (v >= 100) digits = 0;
    else if (v >= 10) digits = 1;
    else digits = 2;
    let text = v.toFixed(digits);
    text = text.replace(/\.0+$/, "").replace(/(\.\d*[1-9])0+$/, "$1");
    return `${neg ? "-" : ""}${text}${SUFFIXES[tier]}`;
  }

  function formatCps(n) {
    const v = Number(n) || 0;
    if (v >= 1000) return formatNum(v);
    if (v >= 10) return v.toFixed(1).replace(/\.0$/, "");
    if (v >= 1) return v.toFixed(1);
    return v.toFixed(2).replace(/0+$/, "").replace(/\.$/, "") || "0";
  }

  function upgradeCost(upgrade, owned) {
    return Math.floor(upgrade.baseCost * Math.pow(1.15, owned));
  }

  function baseCps() {
    return UPGRADES.reduce((sum, u) => sum + (u.cps || 0) * (state.owned[u.id] || 0), 0);
  }

  function totalCps() {
    return baseCps() * multiplier();
  }

  function clickGain() {
    return state.clickPower * multiplier();
  }

  function addCrystals(amount) {
    if (amount <= 0) return;
    state.crystals += amount;
    state.lifetime += amount;
    maybeSubmitBest();
    checkAchievements();
  }

  function maybeSubmitBest(force = false) {
    const best = Math.floor(state.lifetime);
    if (best <= 0) return;
    const stored = getStoredBest();
    if (best > stored) {
      try {
        localStorage.setItem(HIGH_SCORE_KEY, String(best));
      } catch {}
    }
    const now = Date.now();
    if (!force && now - lastSubmitAt < 4000) return;
    if (best > 0 && window.HubLeaderboard) {
      lastSubmitAt = now;
      HubLeaderboard.submit("clicker", best).catch?.(() => {});
    }
  }

  function checkAchievements() {
    if (!window.HubAchievements) return;
    const life = state.lifetime;
    const cps = totalCps();
    if (life >= 100) HubAchievements.unlock("clicker_100");
    if (life >= 1000) HubAchievements.unlock("clicker_1k");
    if (life >= 100000) HubAchievements.unlock("clicker_100k");
    if (life >= 1000000) HubAchievements.unlock("clicker_1m");
    if (cps >= 10) HubAchievements.unlock("clicker_cps_10");
    if (cps >= 100) HubAchievements.unlock("clicker_cps_100");
    if (state.rebirths >= 1) HubAchievements.unlock("clicker_rebirth_1");
    if (state.rebirths >= 3) HubAchievements.unlock("clicker_rebirth_3");
  }

  function ensureSession() {
    if (sessionStarted) return;
    sessionStarted = true;
    if (window.HubStreak) HubStreak.recordPlay();
    if (window.HubPlays) HubPlays.record("clicker");
  }

  function spawnFloat(x, y, text) {
    if (!floatLayer) return;
    const el = document.createElement("span");
    el.className = "float-pop";
    el.textContent = text;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    floatLayer.appendChild(el);
    setTimeout(() => el.remove(), 700);
  }

  function clickCrystal(evt) {
    const now = Date.now();
    if (now - lastClickAt < MIN_CLICK_MS) return;
    lastClickAt = now;
    ensureSession();
    const gain = clickGain();
    addCrystals(gain);
    window.HubSound?.play?.("click");
    crystalBtn.classList.add("is-pulse");
    setTimeout(() => crystalBtn.classList.remove("is-pulse"), 90);
    const rect = crystalBtn.getBoundingClientRect();
    const x =
      (evt?.clientX ?? rect.left + rect.width / 2) + (Math.random() * 24 - 12);
    const y = (evt?.clientY ?? rect.top + rect.height / 2) - 8;
    spawnFloat(x, y, `+${formatNum(gain)}`);
    render(false);
    saveSoon();
  }

  function buyUpgrade(id) {
    const upgrade = UPGRADES.find((u) => u.id === id);
    if (!upgrade) return;
    const owned = state.owned[id] || 0;
    const cost = upgradeCost(upgrade, owned);
    if (state.crystals < cost) return;
    ensureSession();
    state.crystals -= cost;
    state.owned[id] = owned + 1;
    if (upgrade.clickBonus) state.clickPower += upgrade.clickBonus;
    window.HubSound?.play?.("click");
    if (state.owned[id] === 1 && upgrade.cps >= 20) {
      window.HubConfetti?.burst?.();
    }
    checkAchievements();
    render(false);
    saveSoon();
  }

  function rebirthCost() {
    // Early: 3M ×10^r (3M, 30M, … up to 3Qa at r=9).
    // From Qa onward: ×100 each rebirth instead of ×10.
    const r = Math.max(0, Math.floor(state.rebirths || 0));
    const qaAt = 9;
    if (r <= qaAt) {
      return Math.floor(REBIRTH_BASE_COST * Math.pow(10, r));
    }
    const qaBase = REBIRTH_BASE_COST * Math.pow(10, qaAt); // 3Qa
    return Math.floor(qaBase * Math.pow(100, r - qaAt));
  }

  function canRebirth() {
    return state.crystals >= rebirthCost();
  }

  function doRebirth() {
    const cost = rebirthCost();
    if (state.crystals < cost) return;
    const nextMult = multiplier() * 2;
    if (
      !confirm(
        `Rebirth for ${formatNum(cost)} crystals?\n\nBank and upgrades reset. Lifetime crystals stay. Earnings become ×${nextMult}.`
      )
    ) {
      return;
    }
    ensureSession();
    const lifetime = state.lifetime;
    const rebirths = (state.rebirths || 0) + 1;
    state = defaultState();
    state.lifetime = lifetime;
    state.rebirths = rebirths;
    window.HubSound?.play?.("win");
    window.HubConfetti?.burst?.();
    checkAchievements();
    maybeSubmitBest(true);
    saveState();
    render();
  }

  function shopItemHtml(u) {
    const owned = state.owned[u.id] || 0;
    const cost = upgradeCost(u, owned);
    const canBuy = state.crystals >= cost;
    return `<div class="shop-item" role="listitem" data-group="${u.group}">
      <div class="shop-item-main">
        <div class="shop-item-name">${u.name}</div>
        <p class="shop-item-desc">${u.desc}</p>
        <div class="shop-item-owned">Owned: ${owned}</div>
      </div>
      <button type="button" class="buy-btn" data-buy="${u.id}" ${canBuy ? "" : "disabled"}>
        ${formatNum(cost)}
      </button>
    </div>`;
  }

  function renderShop() {
    if (!shopList) return;
    shopList.innerHTML = SHOP_GROUPS.map((group) => {
      const items = UPGRADES.filter((u) => u.group === group.id).sort(
        (a, b) => a.baseCost - b.baseCost
      );
      return `<section class="shop-section" data-section="${group.id}">
        <header class="shop-section-head">
          <h3>${group.title}</h3>
          <span>${group.blurb}</span>
        </header>
        <div class="shop-section-items">${items.map(shopItemHtml).join("")}</div>
      </section>`;
    }).join("");
  }

  /** Update buy buttons without rebuilding DOM (ticks were wiping clicks). */
  function refreshShopButtons() {
    if (!shopList) return;
    shopList.querySelectorAll("[data-buy]").forEach((btn) => {
      const id = btn.dataset.buy;
      const upgrade = UPGRADES.find((u) => u.id === id);
      if (!upgrade) return;
      const owned = state.owned[id] || 0;
      const cost = upgradeCost(upgrade, owned);
      btn.textContent = formatNum(cost);
      btn.disabled = state.crystals < cost;
      const ownedEl = btn.closest(".shop-item")?.querySelector(".shop-item-owned");
      if (ownedEl) ownedEl.textContent = `Owned: ${owned}`;
    });
  }

  function renderRebirth() {
    const mult = multiplier();
    const nextMult = mult * 2;
    const cost = rebirthCost();
    const ready = state.crystals >= cost;
    if (rebirthMultEl) {
      const rebirthLabel =
        state.rebirths > 0 ? `Rebirths: ${state.rebirths} · ` : "";
      rebirthMultEl.textContent = `${rebirthLabel}Now ×${mult} → after ×${nextMult}`;
    }
    if (rebirthDesc) {
      rebirthDesc.textContent = ready
        ? `Ready! Reset bank & upgrades, keep lifetime. Multiplier becomes ×${nextMult}.`
        : `Need ${formatNum(cost)} crystals. Resets upgrades & bank, keeps lifetime. Next multi: ×${nextMult}.`;
    }
    if (rebirthBtn) {
      rebirthBtn.disabled = !ready;
      rebirthBtn.textContent = ready
        ? `Rebirth → ×${nextMult}`
        : `Rebirth to ×${nextMult} (${formatNum(state.crystals)} / ${formatNum(cost)})`;
    }
  }

  function renderStats() {
    const cps = totalCps();
    const mult = multiplier();
    const best = Math.max(getStoredBest(), Math.floor(state.lifetime));
    if (crystalCountEl) crystalCountEl.textContent = formatNum(state.crystals);
    if (cpsLabelEl) cpsLabelEl.textContent = formatCps(cps);
    if (hudCpsEl) hudCpsEl.textContent = formatCps(cps);
    if (hudBestEl) hudBestEl.textContent = formatNum(best);
    if (hudMultEl) hudMultEl.textContent = String(mult);
    if (multLabelEl) multLabelEl.textContent = `×${mult}`;
    if (clickPowerEl) clickPowerEl.textContent = `+${formatNum(clickGain())}`;
    if (overlayBestEl) overlayBestEl.textContent = formatNum(best);
    refreshShopButtons();
    renderRebirth();
  }

  function render(fullShop = true) {
    renderStats();
    if (fullShop) renderShop();
  }

  function saveSoon() {
    const now = Date.now();
    if (now - lastSaveAt < 800) return;
    lastSaveAt = now;
    saveState();
  }

  function tick() {
    const cps = totalCps();
    if (cps > 0) {
      addCrystals(cps * (TICK_MS / 1000));
      renderStats();
      saveSoon();
    }
  }

  function openMenu() {
    saveState();
    maybeSubmitBest(true);
    render();
    overlay?.classList.remove("hidden");
  }

  function closeMenu() {
    overlay?.classList.add("hidden");
    ensureSession();
  }

  function goToGames() {
    saveState();
    maybeSubmitBest(true);
    window.location.href = "../index.html#games";
  }

  crystalBtn?.addEventListener("click", clickCrystal);
  shopList?.addEventListener("pointerdown", (e) => {
    const btn = e.target.closest("[data-buy]");
    if (!btn || btn.disabled) return;
    e.preventDefault();
    buyUpgrade(btn.dataset.buy);
  });
  startBtn?.addEventListener("click", closeMenu);
  menuBtn?.addEventListener("click", openMenu);
  gamesBtn?.addEventListener("click", goToGames);
  rebirthBtn?.addEventListener("click", doRebirth);

  state = loadState();
  render();
  setInterval(tick, TICK_MS);
  setInterval(() => {
    saveState();
    maybeSubmitBest(true);
  }, 15000);

  window.addEventListener("beforeunload", () => {
    saveState();
    maybeSubmitBest(true);
  });
})();
