/**
 * Wing Hop coin theme packs — palettes + optional player/world drawers.
 * Loaded before script.js; merges into SKINS and hooks draw* via WingHopThemePacks.
 */
(function () {
  const packs = {
    plane: {
      label: "Paper",
      form: "plane",
      world: "doodle",
      locked: true,
      coinItem: "skin:wing-hop-plane",
      coinCost: 250,
      body: "#f1f3f5",
      wing: "#ced4da",
      beak: "#fa5252",
      belly: "#fff9db",
      eye: "#212529",
      pupil: "#212529",
      skyTop: "#e7f5ff",
      skyBottom: "#fff4e6",
      pipe: "#e9ecef",
      pipeDark: "#adb5bd",
      pipeStroke: "#495057",
      pipeLight: "#ffffff",
      ground: "#ffe8cc",
      grass: "#ffd8a8",
      dirt: "#fab005"
    },
    bee: {
      label: "Bee",
      form: "bee",
      world: "meadow",
      locked: true,
      coinItem: "skin:wing-hop-bee",
      coinCost: 250,
      body: "#fcc419",
      wing: "#fff9db",
      beak: "#212529",
      belly: "#ffec99",
      eye: "#ffffff",
      pupil: "#212529",
      skyTop: "#74c0fc",
      skyBottom: "#d0ebff",
      pipe: "#2f9e44",
      pipeDark: "#2b8a3e",
      pipeStroke: "#d9480f",
      pipeLight: "#8ce99a",
      ground: "#d8f5a2",
      grass: "#82c91e",
      dirt: "#e8590c"
    },
    sub: {
      label: "Sub",
      form: "sub",
      world: "ocean",
      locked: true,
      coinItem: "skin:wing-hop-sub",
      coinCost: 300,
      body: "#ff922b",
      wing: "#e8590c",
      beak: "#ffd43b",
      belly: "#ffe8cc",
      eye: "#e7f5ff",
      pupil: "#0b2948",
      skyTop: "#0b2948",
      skyBottom: "#1c7ed6",
      pipe: "#c2255c",
      pipeDark: "#a61e4d",
      pipeStroke: "#ffc9c9",
      pipeLight: "#ffa8a8",
      ground: "#1864ab",
      grass: "#4dabf7",
      dirt: "#0b2948"
    },
    balloon: {
      label: "Balloon",
      form: "balloon",
      world: "town",
      locked: true,
      coinItem: "skin:wing-hop-balloon",
      coinCost: 300,
      body: "#fa5252",
      wing: "#e03131",
      beak: "#ffd43b",
      belly: "#ffc9c9",
      eye: "#fff5f5",
      pupil: "#3b0018",
      skyTop: "#ff922b",
      skyBottom: "#ffe3e3",
      pipe: "#868e96",
      pipeDark: "#495057",
      pipeStroke: "#212529",
      pipeLight: "#adb5bd",
      ground: "#e9ecef",
      grass: "#40c057",
      dirt: "#868e96"
    },
    broom: {
      label: "Broom",
      form: "broom",
      world: "spooky",
      locked: true,
      coinItem: "skin:wing-hop-broom",
      coinCost: 350,
      body: "#5f3dc4",
      wing: "#364fc7",
      beak: "#ffd43b",
      belly: "#9775fa",
      eye: "#f3f0ff",
      pupil: "#1b1140",
      skyTop: "#1b1140",
      skyBottom: "#5f3dc4",
      pipe: "#343a40",
      pipeDark: "#212529",
      pipeStroke: "#9775fa",
      pipeLight: "#495057",
      ground: "#2b2d42",
      grass: "#845ef7",
      dirt: "#1a1b2e"
    },
    neon: {
      label: "Neon",
      form: "neon",
      world: "neon",
      locked: true,
      coinItem: "skin:wing-hop-neon",
      coinCost: 450,
      body: "#f06595",
      wing: "#cc5de8",
      beak: "#22b8cf",
      belly: "#212529",
      eye: "#e7f5ff",
      pupil: "#0b1020",
      skyTop: "#050510",
      skyBottom: "#1a0533",
      pipe: "#14141f",
      pipeDark: "#0a0a12",
      pipeStroke: "#22b8cf",
      pipeLight: "#f06595",
      ground: "#0d0d14",
      grass: "#cc5de8",
      dirt: "#050508"
    },
    steam: {
      label: "Steam",
      form: "steam",
      world: "steam",
      locked: true,
      coinItem: "skin:wing-hop-steam",
      coinCost: 450,
      body: "#b08968",
      wing: "#7f5539",
      beak: "#ffd43b",
      belly: "#ddb892",
      eye: "#fff9db",
      pupil: "#3d2000",
      skyTop: "#6c757d",
      skyBottom: "#adb5bd",
      pipe: "#8d99ae",
      pipeDark: "#2b2d42",
      pipeStroke: "#d4a373",
      pipeLight: "#edede9",
      ground: "#6c584c",
      grass: "#a98467",
      dirt: "#432818"
    },
    frost: {
      label: "Ice Fortress",
      form: "frost",
      world: "frost",
      locked: true,
      coinItem: "skin:wing-hop-frost",
      coinCost: 400,
      body: "#a5d8ff",
      wing: "#74c0fc",
      beak: "#e7f5ff",
      belly: "#d0ebff",
      eye: "#f8fbff",
      pupil: "#0b2948",
      skyTop: "#1b3a5c",
      skyBottom: "#4c6ef5",
      pipe: "#a5d8ff",
      pipeDark: "#4dabf7",
      pipeStroke: "#e7f5ff",
      pipeLight: "#d0ebff",
      ground: "#dee2e6",
      grass: "#99e9f2",
      dirt: "#adb5bd"
    },
    volcano: {
      label: "Volcano",
      form: "volcano",
      world: "lava",
      locked: true,
      coinItem: "skin:wing-hop-volcano",
      coinCost: 400,
      body: "#e03131",
      wing: "#862e2e",
      beak: "#ffd43b",
      belly: "#ffa94d",
      eye: "#fff4e6",
      pupil: "#2b1000",
      skyTop: "#212529",
      skyBottom: "#e8590c",
      pipe: "#343a40",
      pipeDark: "#212529",
      pipeStroke: "#fa5252",
      pipeLight: "#ff922b",
      ground: "#2b2d42",
      grass: "#e8590c",
      dirt: "#1a1a1a"
    },
    ghost: {
      label: "Ghost",
      form: "ghost",
      world: "haunt",
      locked: true,
      coinItem: "skin:wing-hop-ghost",
      coinCost: 450,
      body: "#e9ecef",
      wing: "#ced4da",
      beak: "#adb5bd",
      belly: "#f8f9fa",
      eye: "#212529",
      pupil: "#212529",
      skyTop: "#212529",
      skyBottom: "#495057",
      pipe: "#868e96",
      pipeDark: "#495057",
      pipeStroke: "#e9ecef",
      pipeLight: "#adb5bd",
      ground: "#343a40",
      grass: "#868e96",
      dirt: "#212529"
    },
    pixel: {
      label: "Pixel-8",
      form: "pixel",
      world: "pixel",
      locked: true,
      coinItem: "skin:wing-hop-pixel",
      coinCost: 500,
      body: "#51cf66",
      wing: "#2f9e44",
      beak: "#ffd43b",
      belly: "#8ce99a",
      eye: "#ffffff",
      pupil: "#212529",
      skyTop: "#1c7ed6",
      skyBottom: "#74c0fc",
      pipe: "#7950f2",
      pipeDark: "#5f3dc4",
      pipeStroke: "#ffffff",
      pipeLight: "#b197fc",
      ground: "#862e9c",
      grass: "#cc5de8",
      dirt: "#5f3dc4"
    },
    idol: {
      label: "Idol",
      form: "idol",
      world: "temple",
      locked: true,
      coinItem: "skin:wing-hop-idol",
      coinCost: 550,
      body: "#fcc419",
      wing: "#e67700",
      beak: "#fff3bf",
      belly: "#ffe066",
      eye: "#fff9db",
      pupil: "#3d2000",
      skyTop: "#ff922b",
      skyBottom: "#fff3bf",
      pipe: "#d9480f",
      pipeDark: "#9c2b0e",
      pipeStroke: "#ffd43b",
      pipeLight: "#ffa94d",
      ground: "#f59f00",
      grass: "#fab005",
      dirt: "#e67700"
    },
    shadow: {
      label: "Shadow",
      form: "shadow",
      world: "void",
      locked: true,
      coinItem: "skin:wing-hop-shadow",
      coinCost: 500,
      body: "#212529",
      wing: "#000000",
      beak: "#868e96",
      belly: "#343a40",
      eye: "#f06595",
      pupil: "#ffffff",
      skyTop: "#000000",
      skyBottom: "#1a0533",
      pipe: "#0a0a0a",
      pipeDark: "#000000",
      pipeStroke: "#be4bdb",
      pipeLight: "#343a40",
      ground: "#050508",
      grass: "#be4bdb",
      dirt: "#000000"
    },
    rainbow: {
      label: "Rainbow",
      form: "rainbow",
      world: "candy",
      locked: true,
      coinItem: "skin:wing-hop-rainbow",
      coinCost: 500,
      body: "#ff6b6b",
      wing: "#748ffc",
      beak: "#ffd43b",
      belly: "#ffc9c9",
      eye: "#ffffff",
      pupil: "#212529",
      skyTop: "#a5d8ff",
      skyBottom: "#ffc9c9",
      pipe: "#da77f2",
      pipeDark: "#be4bdb",
      pipeStroke: "#ffffff",
      pipeLight: "#e599f7",
      ground: "#ffd8a8",
      grass: "#8ce99a",
      dirt: "#ffa8a8"
    }
  };

  function mix(a, b, t) {
    const parse = (h) => {
      let n = String(h || "#000").replace("#", "");
      if (n.length === 3) n = n.split("").map((c) => c + c).join("");
      return [
        parseInt(n.slice(0, 2), 16) || 0,
        parseInt(n.slice(2, 4), 16) || 0,
        parseInt(n.slice(4, 6), 16) || 0
      ];
    };
    const [ar, ag, ab] = parse(a);
    const [br, bg, bb] = parse(b);
    const to = (n) =>
      Math.max(0, Math.min(255, Math.round(n)))
        .toString(16)
        .padStart(2, "0");
    return `#${to(ar + (br - ar) * t)}${to(ag + (bg - ag) * t)}${to(ab + (bb - ab) * t)}`;
  }

  function drawSimplePlayer(ctx, api, kind) {
    const { s, bird, wingPhase, wingBurst, BIRD_X, distance = 0 } = api;
    const beat = Math.sin(wingPhase);
    ctx.save();
    ctx.translate(BIRD_X, bird.y);
    ctx.rotate(bird.rot * 0.45);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    if (kind === "plane") {
      ctx.fillStyle = s.body;
      ctx.strokeStyle = s.pipeStroke;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(26, 0);
      ctx.lineTo(-18, -10);
      ctx.lineTo(-10, 0);
      ctx.lineTo(-18, 10);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = s.wing;
      ctx.beginPath();
      ctx.moveTo(2, 0);
      ctx.lineTo(-8, -18 - beat * 3);
      ctx.lineTo(-2, 0);
      ctx.lineTo(-8, 18 + beat * 3);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = s.beak;
      ctx.fillRect(-4, -2, 8, 4);
    } else if (kind === "bee") {
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.beginPath();
      ctx.ellipse(-4, -12 - beat * 4, 10, 6, -0.4, 0, Math.PI * 2);
      ctx.ellipse(-4, 12 + beat * 4, 10, 6, 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = s.body;
      ctx.beginPath();
      ctx.ellipse(0, 0, 18, 12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = s.beak;
      for (let i = -10; i <= 8; i += 8) ctx.fillRect(i, -11, 4, 22);
      ctx.fillStyle = s.eye;
      ctx.beginPath();
      ctx.arc(10, -3, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = s.pupil;
      ctx.beginPath();
      ctx.arc(11, -3, 1.6, 0, Math.PI * 2);
      ctx.fill();
    } else if (kind === "sub") {
      ctx.fillStyle = s.body;
      ctx.strokeStyle = mix(s.body, "#000", 0.4);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, 2, 26, 12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = s.belly;
      ctx.fillRect(-6, -14, 12, 10);
      ctx.fillStyle = s.eye;
      ctx.beginPath();
      ctx.arc(10, 0, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = s.beak;
      ctx.beginPath();
      ctx.moveTo(0, -14);
      ctx.lineTo(0, -22 - Math.abs(beat) * 2);
      ctx.stroke();
      ctx.fillStyle = s.wing;
      ctx.beginPath();
      ctx.moveTo(-24, 2);
      ctx.lineTo(-34, -6 + beat * 3);
      ctx.lineTo(-34, 10 + beat * 3);
      ctx.closePath();
      ctx.fill();
    } else if (kind === "balloon") {
      ctx.fillStyle = s.body;
      ctx.beginPath();
      ctx.ellipse(0, -8, 16, 18, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = s.wing;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-6, 8);
      ctx.lineTo(-8, 18);
      ctx.moveTo(6, 8);
      ctx.lineTo(8, 18);
      ctx.moveTo(0, 10);
      ctx.lineTo(0, 18);
      ctx.stroke();
      ctx.fillStyle = s.belly;
      ctx.fillRect(-8, 18, 16, 10);
      ctx.fillStyle = s.eye;
      ctx.beginPath();
      ctx.arc(-4, -10, 2.5, 0, Math.PI * 2);
      ctx.arc(4, -10, 2.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (kind === "broom") {
      ctx.strokeStyle = "#9775fa";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-28, 8);
      ctx.lineTo(18, -6);
      ctx.stroke();
      ctx.fillStyle = "#e67700";
      ctx.beginPath();
      ctx.moveTo(-28, 8);
      ctx.lineTo(-42, -2 + beat * 2);
      ctx.lineTo(-40, 16 + beat * 2);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = s.body;
      ctx.beginPath();
      ctx.ellipse(4, -4, 10, 8, -0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = s.eye;
      ctx.beginPath();
      ctx.arc(8, -6, 2.2, 0, Math.PI * 2);
      ctx.fill();
    } else if (kind === "pixel") {
      const cells = [
        [0, -2, s.body],
        [1, -2, s.body],
        [-1, -1, s.wing],
        [0, -1, s.body],
        [1, -1, s.body],
        [2, -1, s.beak],
        [-1, 0, s.wing],
        [0, 0, s.belly],
        [1, 0, s.body],
        [0, 1, s.body],
        [1, 1, s.body]
      ];
      const sz = 8;
      for (const [cx, cy, col] of cells) {
        ctx.fillStyle = col;
        ctx.fillRect(cx * sz - sz / 2, cy * sz - sz / 2 + beat, sz, sz);
      }
      ctx.fillStyle = s.pupil;
      ctx.fillRect(sz - 2, -sz - 2 + beat, 3, 3);
    } else if (kind === "neon") {
      // Hoverbike / neon speeder
      const glow = 0.45 + Math.abs(beat) * 0.35 + (wingBurst || 0) * 0.2;
      ctx.shadowColor = s.pipeStroke || "#22b8cf";
      ctx.shadowBlur = 14 * glow;
      ctx.fillStyle = s.belly;
      ctx.beginPath();
      ctx.moveTo(-22, 6);
      ctx.lineTo(24, 2);
      ctx.lineTo(18, 10);
      ctx.lineTo(-20, 12);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = s.body;
      ctx.beginPath();
      ctx.ellipse(2, -2, 16, 8, -0.15, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = s.wing;
      ctx.beginPath();
      ctx.moveTo(-4, 0);
      ctx.lineTo(-18, -14 - beat * 3);
      ctx.lineTo(6, -2);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = s.beak;
      ctx.fillRect(14, -4, 12, 4);
      ctx.shadowBlur = 0;
      ctx.fillStyle = s.eye;
      ctx.beginPath();
      ctx.arc(8, -4, 2.5, 0, Math.PI * 2);
      ctx.fill();
      // Exhaust neon streaks
      ctx.globalAlpha = 0.55 * glow;
      ctx.strokeStyle = s.pipeStroke;
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(-22, 4 + i * 3);
        ctx.lineTo(-34 - i * 4 - Math.abs(beat) * 2, 4 + i * 3);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    } else if (kind === "steam") {
      // Brass airship pod with propeller
      ctx.fillStyle = s.body;
      ctx.strokeStyle = mix(s.body, "#000", 0.35);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, 0, 22, 14, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = s.belly;
      ctx.beginPath();
      ctx.ellipse(0, 4, 14, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = s.wing;
      ctx.fillRect(-8, -18, 16, 8);
      ctx.strokeStyle = s.beak;
      ctx.beginPath();
      ctx.moveTo(0, -18);
      ctx.lineTo(0, -26);
      ctx.stroke();
      // Spinning prop
      const spin = distance * 0.25 + wingPhase * 2;
      ctx.save();
      ctx.translate(-24, 0);
      ctx.rotate(spin);
      ctx.fillStyle = s.pipeStroke;
      ctx.fillRect(-2, -12, 4, 24);
      ctx.fillRect(-12, -2, 24, 4);
      ctx.restore();
      ctx.fillStyle = s.eye;
      ctx.beginPath();
      ctx.arc(8, -2, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = s.pupil;
      ctx.beginPath();
      ctx.arc(9, -2, 1.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (kind === "frost") {
      // Crystal ice shard / ice phoenix shard
      ctx.fillStyle = "rgba(231,245,255,0.35)";
      ctx.beginPath();
      ctx.moveTo(0, -26);
      ctx.lineTo(16, 4);
      ctx.lineTo(0, 20);
      ctx.lineTo(-16, 4);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = s.body;
      ctx.strokeStyle = s.pipeStroke;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -22);
      ctx.lineTo(12, 2);
      ctx.lineTo(0, 16);
      ctx.lineTo(-12, 2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = s.belly;
      ctx.beginPath();
      ctx.moveTo(0, -10);
      ctx.lineTo(6, 2);
      ctx.lineTo(0, 10);
      ctx.lineTo(-6, 2);
      ctx.closePath();
      ctx.fill();
      // Ice wing flakes
      ctx.fillStyle = s.wing;
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.moveTo(-4, 0);
      ctx.lineTo(-22, -10 - beat * 4);
      ctx.lineTo(-10, 4);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-4, 4);
      ctx.lineTo(-20, 12 + beat * 4);
      ctx.lineTo(-8, 8);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = s.pupil;
      ctx.beginPath();
      ctx.arc(2, -2, 2, 0, Math.PI * 2);
      ctx.fill();
    } else if (kind === "volcano") {
      // Magma rock / lava blob with flame crown
      const pulse = 0.7 + Math.abs(beat) * 0.3;
      ctx.fillStyle = s.wing;
      ctx.beginPath();
      ctx.ellipse(0, 4, 20, 14, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = s.body;
      ctx.beginPath();
      ctx.ellipse(0, 2, 16, 11, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = s.belly;
      ctx.beginPath();
      ctx.ellipse(2, 6, 9, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      // Flames
      ctx.globalAlpha = pulse;
      ctx.fillStyle = s.beak;
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(i * 7, -6);
        ctx.lineTo(i * 7 - 4, -16 - Math.abs(beat) * 3 - (i === 0 ? 4 : 0));
        ctx.lineTo(i * 7 + 4, -6);
        ctx.closePath();
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = s.eye;
      ctx.beginPath();
      ctx.arc(6, 0, 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = s.pupil;
      ctx.beginPath();
      ctx.arc(7, 0, 1.4, 0, Math.PI * 2);
      ctx.fill();
    } else if (kind === "ghost") {
      // Classic sheet ghost
      ctx.globalAlpha = 0.88;
      ctx.fillStyle = s.body;
      ctx.beginPath();
      ctx.arc(0, -4, 14, Math.PI, 0);
      ctx.lineTo(14, 14);
      ctx.quadraticCurveTo(9, 8, 5, 14);
      ctx.quadraticCurveTo(0, 8, -5, 14);
      ctx.quadraticCurveTo(-9, 8, -14, 14);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = s.pupil;
      ctx.beginPath();
      ctx.ellipse(-5, -4, 2.8, 4, 0, 0, Math.PI * 2);
      ctx.ellipse(5, -4, 2.8, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.beginPath();
      ctx.arc(-6, -6, 1.1, 0, Math.PI * 2);
      ctx.arc(4, -6, 1.1, 0, Math.PI * 2);
      ctx.fill();
      // Wavy trail
      ctx.strokeStyle = "rgba(233,236,239,0.35)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-16, 6);
      ctx.quadraticCurveTo(-28, 6 + beat * 4, -36, 2);
      ctx.stroke();
    } else if (kind === "idol") {
      // Golden scarab / winged idol
      ctx.fillStyle = s.body;
      ctx.strokeStyle = mix(s.body, "#7a3b00", 0.35);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, 2, 14, 16, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = s.belly;
      ctx.beginPath();
      ctx.ellipse(0, 6, 8, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      // Scarab wings
      ctx.fillStyle = s.wing;
      ctx.beginPath();
      ctx.ellipse(-16, 0, 12, 7, -0.5 + beat * 0.15, 0, Math.PI * 2);
      ctx.ellipse(16, 0, 12, 7, 0.5 - beat * 0.15, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = s.beak;
      ctx.beginPath();
      ctx.moveTo(-4, -14);
      ctx.lineTo(0, -22);
      ctx.lineTo(4, -14);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = s.pupil;
      ctx.beginPath();
      ctx.arc(-4, -2, 2, 0, Math.PI * 2);
      ctx.arc(4, -2, 2, 0, Math.PI * 2);
      ctx.fill();
    } else if (kind === "shadow") {
      // Void wraith — hooded silhouette with pink eyes
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.beginPath();
      ctx.ellipse(0, 18, 16, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = s.body;
      ctx.beginPath();
      ctx.moveTo(-14, 16);
      ctx.quadraticCurveTo(-18, 0, -10, -12);
      ctx.quadraticCurveTo(0, -24, 10, -12);
      ctx.quadraticCurveTo(18, 0, 14, 16);
      ctx.quadraticCurveTo(6, 10, 0, 18);
      ctx.quadraticCurveTo(-6, 10, -14, 16);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = s.eye;
      ctx.shadowColor = s.eye;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.ellipse(-5, -6, 3, 2.2, 0, 0, Math.PI * 2);
      ctx.ellipse(5, -6, 3, 2.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = s.pupil;
      ctx.beginPath();
      ctx.arc(-5, -6, 1, 0, Math.PI * 2);
      ctx.arc(5, -6, 1, 0, Math.PI * 2);
      ctx.fill();
      // Smoke wisps
      ctx.strokeStyle = "rgba(190,75,219,0.35)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-12, 12);
      ctx.quadraticCurveTo(-24, 14 + beat * 3, -30, 8);
      ctx.stroke();
    } else if (kind === "rainbow") {
      // Prism butterfly / rainbow moth
      const cols = ["#ff6b6b", "#fcc419", "#51cf66", "#339af0", "#cc5de8"];
      for (let i = 0; i < cols.length; i++) {
        ctx.fillStyle = cols[i];
        ctx.globalAlpha = 0.4;
        ctx.beginPath();
        ctx.ellipse(-10 - i * 5, beat * 2, 8, 5, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      // Wings
      const flap = beat * 0.35;
      ctx.fillStyle = s.wing;
      ctx.beginPath();
      ctx.ellipse(-14, -4, 16, 11, -0.6 + flap, 0, Math.PI * 2);
      ctx.ellipse(14, -4, 16, 11, 0.6 - flap, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = s.body;
      ctx.beginPath();
      ctx.ellipse(0, 0, 7, 12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = s.beak;
      ctx.beginPath();
      ctx.arc(0, -10, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = s.body;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-3, -12);
      ctx.lineTo(-8, -20);
      ctx.moveTo(3, -12);
      ctx.lineTo(8, -20);
      ctx.stroke();
      ctx.fillStyle = s.pupil;
      ctx.beginPath();
      ctx.arc(-2, -10, 1.2, 0, Math.PI * 2);
      ctx.arc(2, -10, 1.2, 0, Math.PI * 2);
      ctx.fill();
      // Rainbow wing bands
      for (let i = 0; i < cols.length; i++) {
        ctx.strokeStyle = cols[i];
        ctx.globalAlpha = 0.7;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(-14, -4, 12 - i, 9 - i * 0.5, -0.6 + flap, 0.2, Math.PI - 0.2);
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(14, -4, 12 - i, 9 - i * 0.5, 0.6 - flap, 0.2, Math.PI - 0.2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    } else {
      ctx.restore();
      return false;
    }
    ctx.restore();
    return true;
  }

  function decorateSky(ctx, api) {
    const { s, W, H, distance } = api;
    const world = s.world;
    if (world === "ocean") {
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      for (let i = 0; i < 12; i++) {
        const x = ((i * 97 + distance * 0.2) % (W + 40)) - 20;
        const y = 80 + (i * 53) % (H * 0.55);
        ctx.beginPath();
        ctx.arc(x, y, 3 + (i % 3), 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (world === "neon") {
      ctx.strokeStyle = "rgba(34,184,207,0.25)";
      ctx.lineWidth = 2;
      for (let i = 0; i < 6; i++) {
        const y = 60 + i * 70;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y + 20);
        ctx.stroke();
      }
    } else if (world === "spooky" || world === "haunt" || world === "void") {
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      for (let i = 0; i < 20; i++) {
        ctx.beginPath();
        ctx.arc((i * 73) % W, (i * 41) % (H * 0.7), 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (world === "lava") {
      const g = ctx.createRadialGradient(W * 0.5, H * 0.2, 10, W * 0.5, H * 0.2, 180);
      g.addColorStop(0, "rgba(255,146,43,0.35)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H * 0.6);
    } else if (world === "frost") {
      ctx.strokeStyle = "rgba(231,245,255,0.35)";
      ctx.lineWidth = 1;
      for (let i = 0; i < 8; i++) {
        const x = 40 + i * 70;
        ctx.beginPath();
        ctx.moveTo(x, 40);
        ctx.lineTo(x + 10, 70);
        ctx.lineTo(x - 8, 70);
        ctx.closePath();
        ctx.stroke();
      }
    } else if (world === "doodle") {
      ctx.strokeStyle = "rgba(73,80,87,0.2)";
      ctx.setLineDash([6, 6]);
      ctx.strokeRect(30, 40, W - 60, H * 0.35);
      ctx.setLineDash([]);
    } else if (world === "candy") {
      const cols = ["#ff6b6b", "#fcc419", "#51cf66", "#339af0", "#cc5de8"];
      for (let i = 0; i < 5; i++) {
        ctx.fillStyle = cols[i] + "33";
        ctx.beginPath();
        ctx.arc(80 + i * 100, 90 + (i % 2) * 40, 28, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  /** Full replacement pipes/walls (like UFO alien pillars). Returns true if drawn. */
  function drawThemePipe(ctx, api, x, y, w, h, tipSide) {
    const { s, distance = 0 } = api;
    const world = s.world;
    if (!world || world === "alien") return false;
    if (h <= 0) return true;
    const mid = x + w / 2;
    const dark = s.pipeDark || "#333";
    const midCol = s.pipe || "#666";
    const light = s.pipeLight || "#aaa";
    const stroke = s.pipeStroke || "#111";
    const tipY = tipSide === "down" ? y + h : y;

    if (world === "doodle") {
      // Cardboard box stacks with tape
      ctx.fillStyle = midCol;
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 4]);
      ctx.fillRect(x + 6, y, w - 12, h);
      ctx.strokeRect(x + 6, y, w - 12, h);
      ctx.setLineDash([]);
      ctx.fillStyle = light;
      for (let yy = y + 18; yy < y + h - 10; yy += 36) {
        ctx.fillRect(x + 10, yy, w - 20, 8);
        ctx.strokeStyle = stroke;
        ctx.strokeRect(x + 10, yy, w - 20, 8);
      }
      ctx.fillStyle = stroke;
      ctx.fillRect(mid - 10, tipY - (tipSide === "down" ? 14 : 0), 20, 14);
      return true;
    }

    if (world === "meadow") {
      // Flower stalks / stems
      ctx.strokeStyle = midCol;
      ctx.lineWidth = 10;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(mid - 12, tipSide === "down" ? y : y + h);
      ctx.lineTo(mid - 12, tipSide === "down" ? y + h : y);
      ctx.moveTo(mid + 12, tipSide === "down" ? y : y + h);
      ctx.lineTo(mid + 12, tipSide === "down" ? y + h : y);
      ctx.stroke();
      ctx.lineWidth = 6;
      ctx.strokeStyle = light;
      ctx.beginPath();
      ctx.moveTo(mid, tipSide === "down" ? y : y + h);
      ctx.lineTo(mid, tipSide === "down" ? y + h : y);
      ctx.stroke();
      const flowerY = tipSide === "down" ? y + h - 6 : y + 6;
      for (const ox of [-12, 0, 12]) {
        ctx.fillStyle = stroke;
        ctx.beginPath();
        ctx.arc(mid + ox, flowerY, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#fff3bf";
        ctx.beginPath();
        ctx.arc(mid + ox, flowerY, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
      return true;
    }

    if (world === "ocean") {
      // Coral columns
      const steps = Math.max(6, Math.floor(h / 16));
      ctx.beginPath();
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const yy = y + t * h;
        const bulge = 8 + Math.sin(t * Math.PI * 2.5 + x * 0.1) * 10;
        const xx = mid - w * 0.22 - bulge * 0.4;
        if (i === 0) ctx.moveTo(xx, yy);
        else ctx.lineTo(xx, yy);
      }
      for (let i = steps; i >= 0; i--) {
        const t = i / steps;
        const yy = y + t * h;
        const bulge = 8 + Math.sin(t * Math.PI * 2.5 + x * 0.1 + 1) * 10;
        ctx.lineTo(mid + w * 0.22 + bulge * 0.4, yy);
      }
      ctx.closePath();
      const g = ctx.createLinearGradient(x, y, x + w, y);
      g.addColorStop(0, dark);
      g.addColorStop(0.5, midCol);
      g.addColorStop(1, light);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 2;
      ctx.stroke();
      // polyps
      ctx.fillStyle = light;
      for (let i = 1; i < steps; i += 2) {
        const yy = y + (i / steps) * h;
        ctx.beginPath();
        ctx.arc(mid + ((i % 2) * 2 - 1) * 16, yy, 4, 0, Math.PI * 2);
        ctx.fill();
      }
      return true;
    }

    if (world === "town") {
      // Brick chimneys
      ctx.fillStyle = midCol;
      ctx.fillRect(x + 10, y, w - 20, h);
      ctx.fillStyle = dark;
      for (let yy = y + 8; yy < y + h; yy += 14) {
        const odd = Math.floor((yy - y) / 14) % 2;
        for (let xx = x + 12 + odd * 8; xx < x + w - 14; xx += 16) {
          ctx.fillRect(xx, yy, 14, 10);
        }
      }
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 10, y, w - 20, h);
      ctx.fillStyle = dark;
      const capY = tipSide === "down" ? y + h - 16 : y;
      ctx.fillRect(x + 4, capY, w - 8, 16);
      ctx.fillStyle = "#343a40";
      ctx.fillRect(mid - 8, tipSide === "down" ? y + h - 28 : y + 16, 16, 12);
      return true;
    }

    if (world === "spooky" || world === "haunt") {
      // Crooked haunted posts
      ctx.fillStyle = midCol;
      ctx.beginPath();
      ctx.moveTo(x + 18, tipSide === "down" ? y : y + h);
      ctx.lineTo(x + 8, tipSide === "down" ? y + h * 0.4 : y + h * 0.6);
      ctx.lineTo(x + 20, tipSide === "down" ? y + h : y);
      ctx.lineTo(x + w - 20, tipSide === "down" ? y + h : y);
      ctx.lineTo(x + w - 8, tipSide === "down" ? y + h * 0.45 : y + h * 0.55);
      ctx.lineTo(x + w - 18, tipSide === "down" ? y : y + h);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 2;
      ctx.stroke();
      // lantern / skull near tip
      const ly = tipSide === "down" ? y + h - 20 : y + 20;
      ctx.fillStyle = light;
      ctx.beginPath();
      ctx.arc(mid, ly, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = dark;
      ctx.beginPath();
      ctx.arc(mid - 3, ly - 2, 2, 0, Math.PI * 2);
      ctx.arc(mid + 3, ly - 2, 2, 0, Math.PI * 2);
      ctx.fill();
      return true;
    }

    if (world === "neon") {
      // Neon skyscraper slabs
      ctx.fillStyle = dark;
      ctx.fillRect(x + 8, y, w - 16, h);
      ctx.shadowColor = stroke;
      ctx.shadowBlur = 16;
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 3;
      ctx.strokeRect(x + 8, y, w - 16, h);
      ctx.shadowBlur = 0;
      ctx.fillStyle = light;
      for (let yy = y + 12; yy < y + h - 12; yy += 22) {
        ctx.globalAlpha = 0.35 + ((Math.floor(yy + distance) / 22) % 2) * 0.35;
        ctx.fillRect(x + 14, yy, w - 28, 8);
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = stroke;
      ctx.fillRect(x + 4, tipSide === "down" ? y + h - 10 : y, w - 8, 10);
      return true;
    }

    if (world === "steam") {
      // Copper pipe towers with flanges + bolts
      ctx.fillStyle = midCol;
      ctx.fillRect(x + 14, y, w - 28, h);
      const g = ctx.createLinearGradient(x, y, x + w, y);
      g.addColorStop(0, dark);
      g.addColorStop(0.45, light);
      g.addColorStop(1, dark);
      ctx.fillStyle = g;
      ctx.fillRect(x + 14, y, w - 28, h);
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 2;
      for (let yy = y + 20; yy < y + h - 10; yy += 40) {
        ctx.fillStyle = dark;
        ctx.fillRect(x + 6, yy, w - 12, 12);
        ctx.strokeRect(x + 6, yy, w - 12, 12);
        ctx.fillStyle = stroke;
        ctx.beginPath();
        ctx.arc(x + 16, yy + 6, 2.5, 0, Math.PI * 2);
        ctx.arc(x + w - 16, yy + 6, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = dark;
      ctx.beginPath();
      ctx.arc(mid, tipY, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = stroke;
      ctx.stroke();
      return true;
    }

    if (world === "frost") {
      // Ice spires
      ctx.fillStyle = midCol;
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 2;
      ctx.beginPath();
      if (tipSide === "down") {
        ctx.moveTo(mid, y + h);
        ctx.lineTo(x + 8, y + h * 0.15);
        ctx.lineTo(x + w * 0.35, y);
        ctx.lineTo(x + w * 0.65, y);
        ctx.lineTo(x + w - 8, y + h * 0.15);
      } else {
        ctx.moveTo(mid, y);
        ctx.lineTo(x + 8, y + h * 0.85);
        ctx.lineTo(x + w * 0.35, y + h);
        ctx.lineTo(x + w * 0.65, y + h);
        ctx.lineTo(x + w - 8, y + h * 0.85);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = light;
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      ctx.moveTo(mid - 6, tipSide === "down" ? y + 10 : y + h - 10);
      ctx.lineTo(mid - 6, tipSide === "down" ? y + h - 20 : y + 20);
      ctx.stroke();
      ctx.globalAlpha = 1;
      return true;
    }

    if (world === "lava") {
      // Basalt pillars with magma cracks
      ctx.fillStyle = dark;
      ctx.fillRect(x + 8, y, w - 16, h);
      ctx.fillStyle = midCol;
      ctx.fillRect(x + 14, y, w - 28, h);
      ctx.fillStyle = light;
      ctx.globalAlpha = 0.75;
      for (let i = 0; i < 5; i++) {
        const yy = y + 16 + i * (h / 5);
        ctx.beginPath();
        ctx.moveTo(mid - 8 + (i % 2) * 6, yy);
        ctx.lineTo(mid + 10, yy + 18);
        ctx.lineTo(mid - 4, yy + 28);
        ctx.closePath();
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 3;
      ctx.strokeRect(x + 8, y, w - 16, h);
      ctx.fillStyle = stroke;
      ctx.globalAlpha = 0.85;
      ctx.fillRect(x + 4, tipSide === "down" ? y + h - 12 : y, w - 8, 12);
      ctx.globalAlpha = 1;
      return true;
    }

    if (world === "pixel") {
      // Chunky pixel wall
      const cell = 12;
      for (let yy = y; yy < y + h; yy += cell) {
        for (let xx = x + 4; xx < x + w - 4; xx += cell) {
          const on = ((xx / cell) + (yy / cell)) % 3 !== 0;
          ctx.fillStyle = on ? midCol : dark;
          ctx.fillRect(xx, yy, cell - 1, cell - 1);
        }
      }
      ctx.fillStyle = light;
      for (let yy = y + cell; yy < y + h - cell; yy += cell * 2) {
        ctx.fillRect(x + 8, yy, cell - 1, cell - 1);
        ctx.fillRect(x + w - 8 - cell, yy + cell, cell - 1, cell - 1);
      }
      ctx.fillStyle = stroke;
      ctx.fillRect(x, tipSide === "down" ? y + h - cell : y, w, cell);
      return true;
    }

    if (world === "temple") {
      // Sandstone columns with capital
      ctx.fillStyle = midCol;
      ctx.fillRect(x + 18, y, w - 36, h);
      const g = ctx.createLinearGradient(x, y, x + w, y);
      g.addColorStop(0, dark);
      g.addColorStop(0.5, light);
      g.addColorStop(1, dark);
      ctx.fillStyle = g;
      ctx.fillRect(x + 18, y, w - 36, h);
      ctx.fillStyle = dark;
      const capH = 22;
      const cy = tipSide === "down" ? y + h - capH : y;
      ctx.fillRect(x + 6, cy, w - 12, capH);
      ctx.fillStyle = stroke;
      ctx.fillRect(x + 10, cy + 6, w - 20, 4);
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        const xx = x + 26 + i * 14;
        ctx.beginPath();
        ctx.moveTo(xx, y + 8);
        ctx.lineTo(xx, y + h - 8);
        ctx.stroke();
      }
      return true;
    }

    if (world === "void") {
      // Black void pillars with purple rim
      ctx.fillStyle = dark;
      ctx.beginPath();
      ctx.moveTo(x + 20, y);
      ctx.lineTo(x + 10, y + h);
      ctx.lineTo(x + w - 10, y + h);
      ctx.lineTo(x + w - 20, y);
      ctx.closePath();
      ctx.fill();
      ctx.shadowColor = stroke;
      ctx.shadowBlur = 18;
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = stroke;
      ctx.globalAlpha = 0.5;
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.arc(mid, y + 24 + i * (h / 4), 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      return true;
    }

    if (world === "candy") {
      // Soft candy cane / striped tubes
      ctx.fillStyle = midCol;
      ctx.fillRect(x + 12, y, w - 24, h);
      const cols = ["#ff6b6b", "#ffffff", "#fcc419", "#ffffff", "#748ffc"];
      for (let i = 0; i < Math.ceil(h / 18); i++) {
        ctx.fillStyle = cols[i % cols.length];
        ctx.globalAlpha = 0.85;
        ctx.fillRect(x + 14, y + i * 18, w - 28, 14);
      }
      ctx.globalAlpha = 1;
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 3;
      ctx.strokeRect(x + 12, y, w - 24, h);
      ctx.fillStyle = light;
      ctx.beginPath();
      ctx.arc(mid, tipY, 14, 0, Math.PI * 2);
      ctx.fill();
      return true;
    }

    return false;
  }

  function decorateGround(ctx, api) {
    const { s, W, H, GROUND_H, groundOffset } = api;
    const gy = H - GROUND_H;
    const world = s.world;
    if (world === "ocean") {
      ctx.fillStyle = "rgba(255,255,255,0.2)";
      for (let x = -groundOffset; x < W + 40; x += 36) {
        ctx.beginPath();
        ctx.arc(x, gy + 18, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (world === "neon") {
      ctx.fillStyle = s.grass;
      ctx.globalAlpha = 0.5;
      ctx.fillRect(0, gy, W, 3);
      ctx.globalAlpha = 1;
    } else if (world === "meadow") {
      ctx.fillStyle = s.pipeStroke;
      for (let x = -groundOffset; x < W + 30; x += 28) {
        ctx.fillRect(x + 6, gy + 4, 3, 10);
        ctx.beginPath();
        ctx.arc(x + 7, gy + 2, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  /**
   * Collision box inset so skinny visuals (bee stalks, temple columns, …)
   * don't keep the full castle-width hitbox.
   * Returns { x, w } in canvas space for a pipe column at pipeX with draw width pipeW.
   */
  function pipeHitbox(s, pipeX, pipeW) {
    const world = s?.world || s?.form || "";
    // inset from each side of the draw rect (PIPE_WIDTH)
    const insetByWorld = {
      meadow: 28, // flower stalks — visually ~40px wide
      doodle: 8,
      ocean: 14,
      town: 12,
      spooky: 16,
      haunt: 16,
      neon: 10,
      steam: 14,
      frost: 20, // ice spire tip is narrow
      lava: 10,
      pixel: 6,
      temple: 18, // sandstone shaft
      void: 16,
      candy: 14,
      alien: 10 // UFO organic pillar (still a bit inset)
    };
    let inset = insetByWorld[world];
    if (inset == null && s?.form === "ufo") inset = 10;
    if (inset == null) inset = 0;
    inset = Math.max(0, Math.min(Math.floor(pipeW / 2) - 8, inset));
    return { x: pipeX + inset, w: Math.max(16, pipeW - inset * 2) };
  }

  window.WingHopThemePacks = {
    skins: packs,
    pipeHitbox,
    drawPlayer(ctx, api) {
      const form = api.s.form;
      if (!form || form === "ufo") return false;
      return drawSimplePlayer(ctx, api, form);
    },
    afterSky(ctx, api) {
      if (api.s.form === "ufo") return;
      decorateSky(ctx, api);
    },
    /** Draw themed pipes instead of castle towers. Returns true if handled. */
    drawPipe(ctx, api, x, y, w, h, tipSide) {
      if (api.s.form === "ufo") return false;
      return drawThemePipe(ctx, api, x, y, w, h, tipSide);
    },
    afterGround(ctx, api) {
      if (api.s.form === "ufo") return;
      decorateGround(ctx, api);
    }
  };
})();
