/**
 * Shared confetti burst for wins and big moments.
 * window.HubConfetti.burst() / .stop()
 */
(function () {
  const COLORS = ["#538d4e", "#b59f3b", "#ffffff", "#6aaa64", "#c9b458", "#ff6b6b", "#60a5fa", "#f472b6", "#facc15"];
  let canvas = null;
  let ctx = null;
  let animId = 0;

  function ensureCanvas() {
    canvas = document.getElementById("hub-confetti") || document.getElementById("confetti");
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.id = "hub-confetti";
      canvas.setAttribute("aria-hidden", "true");
    }
    canvas.style.cssText = "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:10050;";
    document.body.appendChild(canvas);
    ctx = canvas.getContext("2d");
    resize();
  }

  function resize() {
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  function stop() {
    if (animId) {
      cancelAnimationFrame(animId);
      animId = 0;
    }
    if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  function burst(options) {
    ensureCanvas();
    stop();
    resize();
    const count = options?.count || 160;
    const duration = options?.duration || 2800;
    const particles = Array.from({ length: count }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height - canvas.height,
      size: Math.random() * 8 + 4,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      velocityX: (Math.random() - 0.5) * 3,
      velocityY: Math.random() * 3 + 2,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.25
    }));

    const startTime = performance.now();
    function animate(now) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of particles) {
        p.x += p.velocityX;
        p.y += p.velocityY;
        p.velocityY += 0.08;
        p.rotation += p.rotationSpeed;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      }
      if (now - startTime < duration) animId = requestAnimationFrame(animate);
      else stop();
    }
    animId = requestAnimationFrame(animate);
  }

  window.addEventListener("resize", resize);
  window.HubConfetti = { burst, stop };
})();
