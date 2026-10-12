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
    const { s, bird, wingPhase, wingBurst, BIRD_X } = api;
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
    } else {
      // neon / steam / frost / volcano / ghost / idol / shadow / rainbow → tinted dragon handled in host
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

  function decoratePipe(ctx, api, x, y, w, h, tipSide) {
    const { s } = api;
    const world = s.world;
    if (!world || world === "alien") return;
    if (world === "meadow") {
      ctx.fillStyle = s.pipeStroke || "#d9480f";
      const flowerY = tipSide === "down" ? y + h - 18 : y + 18;
      ctx.beginPath();
      ctx.arc(x + w / 2, flowerY, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff3bf";
      ctx.beginPath();
      ctx.arc(x + w / 2, flowerY, 3, 0, Math.PI * 2);
      ctx.fill();
    } else if (world === "neon") {
      ctx.strokeStyle = s.pipeStroke;
      ctx.shadowColor = s.pipeStroke;
      ctx.shadowBlur = 12;
      ctx.lineWidth = 3;
      ctx.strokeRect(x + 4, y + 4, w - 8, Math.max(8, h - 8));
      ctx.shadowBlur = 0;
    } else if (world === "pixel") {
      ctx.fillStyle = s.pipeLight;
      for (let yy = y + 8; yy < y + h - 8; yy += 16) {
        ctx.fillRect(x + 8, yy, 10, 10);
        ctx.fillRect(x + w - 18, yy + 8, 10, 10);
      }
    } else if (world === "steam") {
      ctx.strokeStyle = s.pipeStroke;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x + w / 2, tipSide === "down" ? y + h - 24 : y + 24, 10, 0, Math.PI * 2);
      ctx.stroke();
    } else if (world === "lava") {
      ctx.fillStyle = s.pipeLight;
      ctx.globalAlpha = 0.55;
      for (let i = 0; i < 4; i++) {
        ctx.fillRect(x + 10 + (i % 2) * 20, y + 20 + i * 28, 6, 18);
      }
      ctx.globalAlpha = 1;
    }
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

  window.WingHopThemePacks = {
    skins: packs,
    drawPlayer(ctx, api) {
      const form = api.s.form;
      if (!form || form === "ufo") return false;
      if (form === "ghost") {
        ctx.save();
        ctx.globalAlpha = 0.62;
        const ok = false; // fall through to dragon with alpha — host draws dragon
        ctx.restore();
        api.ghostAlpha = 0.62;
        return false;
      }
      if (form === "rainbow") {
        api.drawRainbowTrail = true;
        return false;
      }
      if (form === "neon" || form === "steam" || form === "frost" || form === "volcano" || form === "idol" || form === "shadow") {
        return false; // dragon silhouette with pack colors
      }
      return drawSimplePlayer(ctx, api, form);
    },
    afterSky(ctx, api) {
      if (api.s.form === "ufo") return;
      decorateSky(ctx, api);
    },
    afterPipe(ctx, api, x, y, w, h, tipSide) {
      if (api.s.form === "ufo") return;
      decoratePipe(ctx, api, x, y, w, h, tipSide);
    },
    afterGround(ctx, api) {
      if (api.s.form === "ufo") return;
      decorateGround(ctx, api);
    }
  };
})();
