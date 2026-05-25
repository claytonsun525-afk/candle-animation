/* eslint-disable no-restricted-globals */
(() => {
  /** @type {HTMLCanvasElement} */
  const canvas = document.getElementById("c");
  /** @type {CanvasRenderingContext2D} */
  const ctx = canvas.getContext("2d", { alpha: true });

  const DPR = Math.min(2, window.devicePixelRatio || 1);
  function resize() {
    const cssW = Math.min(window.innerWidth, 1200);
    const cssH = Math.min(window.innerHeight, 700);
    const targetW = Math.max(900, cssW);
    const targetH = Math.max(520, cssH);

    canvas.style.width = `${targetW}px`;
    canvas.style.height = `${Math.round((targetW * 700) / 1200)}px`;

    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.round(rect.width * DPR);
    canvas.height = Math.round(rect.height * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  window.addEventListener("resize", resize);
  resize();

  const state = {
    t0: performance.now(),
    paused: false,
    pauseAt: 0,
    windX: 0,
    windY: 0,
    windTargetX: 0,
    windTargetY: 0,
    melt: 0,
    drips: [],
    lastDrip: 0,
    seed: 7,
  };

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  function mix(a, b, t) {
    return a + (b - a) * t;
  }

  function lerpColor(c1, c2, t) {
    const a = parseInt(c1.slice(1), 16);
    const b = parseInt(c2.slice(1), 16);
    const r1 = (a >> 16) & 255,
      g1 = (a >> 8) & 255,
      b1 = a & 255;
    const r2 = (b >> 16) & 255,
      g2 = (b >> 8) & 255,
      b2 = b & 255;
    const r = Math.round(mix(r1, r2, t));
    const g = Math.round(mix(g1, g2, t));
    const bl = Math.round(mix(b1, b2, t));
    return `rgb(${r} ${g} ${bl})`;
  }

  function rand01() {
    // deterministic-ish tiny PRNG so the scene feels stable
    state.seed = (state.seed * 1664525 + 1013904223) >>> 0;
    return state.seed / 2 ** 32;
  }

  function clear(w, h) {
    ctx.clearRect(0, 0, w, h);
  }

  function drawVignette(w, h) {
    const g = ctx.createRadialGradient(w * 0.5, h * 0.35, 0, w * 0.5, h * 0.55, w * 0.8);
    g.addColorStop(0, "rgba(20, 28, 60, 0.55)");
    g.addColorStop(0.35, "rgba(10, 14, 28, 0.45)");
    g.addColorStop(1, "rgba(5, 6, 11, 0.96)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  function drawStars(w, h, t) {
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha = 0.9;

    for (let i = 0; i < 90; i++) {
      const x = (i * 97) % w;
      const y = ((i * 173) % (h * 0.45)) | 0;
      const tw = 0.2 + 0.8 * (0.5 + 0.5 * Math.sin(t * 1.3 + x * 0.02 + y * 0.03));
      if (tw < 0.68) continue;
      ctx.fillStyle = lerpColor("#070a12", "#a9c6ff", (tw - 0.68) / 0.32);
      ctx.beginPath();
      ctx.arc(x, y, 1.2 + 0.9 * tw, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawGround(w, h, floorY) {
    const g = ctx.createLinearGradient(0, floorY, 0, h);
    g.addColorStop(0, "rgba(6, 8, 18, 0)");
    g.addColorStop(0.25, "rgba(6, 8, 18, 0.9)");
    g.addColorStop(1, "rgba(4, 5, 10, 1)");
    ctx.fillStyle = g;
    ctx.fillRect(0, floorY, w, h - floorY);

    ctx.globalAlpha = 0.85;
    ctx.fillStyle = "rgba(0,0,0,0.38)";
    ctx.beginPath();
    ctx.ellipse(w * 0.5, floorY + 10, 260, 32, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function drawCandle(w, floorY, t) {
    const cx = w * 0.5;
    const baseW = w * 0.18;
    const baseH0 = w * 0.30;
    const melt = state.melt;

    const h = Math.max(baseH0 * 0.58, baseH0 - melt);
    const x0 = cx - baseW / 2;
    const x1 = cx + baseW / 2;
    const y1 = floorY;
    const y0 = y1 - h;

    // body gradient
    const stripes = 42;
    for (let i = 0; i < stripes; i++) {
      const u = i / (stripes - 1);
      const centerBoost = 1.6 * (1 - Math.abs(2 * u - 1));
      let col = lerpColor("#f4ecdf", "#fffaf2", clamp(centerBoost, 0, 1));
      col = lerpColor(col, "#e6dccf", clamp((u - 0.62) / 0.38, 0, 1) * 0.55);
      const sx0 = x0 + (x1 - x0) * (i / stripes);
      const sx1 = x0 + (x1 - x0) * ((i + 1) / stripes);
      ctx.fillStyle = col;
      ctx.fillRect(sx0, y0, sx1 - sx0 + 0.6, y1 - y0);
    }

    // rounded top cap
    ctx.fillStyle = "#fbf4ea";
    ctx.beginPath();
    ctx.ellipse(cx, y0 + 6, baseW / 2, 44, 0, 0, Math.PI * 2);
    ctx.fill();

    // melt pool
    ctx.fillStyle = "#efe4d6";
    ctx.beginPath();
    ctx.ellipse(cx, y0 + 10, baseW * 0.34, 18, 0, 0, Math.PI * 2);
    ctx.fill();

    // lip highlight
    ctx.strokeStyle = "rgba(255,255,255,0.65)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(cx, y0 + 6, baseW * 0.38, 30, 0, Math.PI * 0.12, Math.PI * 0.88);
    ctx.stroke();

    // wick
    const wickBaseY = y0 + 8;
    const wickTipX = cx + 1 + 0.5 * Math.sin(t * 0.8);
    const wickTipY = wickBaseY - 28;
    ctx.lineCap = "round";
    ctx.lineWidth = 6;
    ctx.strokeStyle = "#2a1a12";
    ctx.beginPath();
    ctx.moveTo(cx, wickBaseY);
    ctx.quadraticCurveTo(cx + 3, wickBaseY - 14, wickTipX, wickTipY);
    ctx.stroke();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#3a261a";
    ctx.stroke();

    return { cx, y0, y1, wickTipX, wickTipY, candleW: baseW, candleH: h };
  }

  function flamePath(x, y, h, w, sway, squish) {
    const steps = 28;
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      const profile = Math.pow(1 - u, 0.55);
      const wob = Math.sin(u * Math.PI * 1.1 + sway) * (0.35 + 0.25 * (1 - u));
      let half = w * profile * (0.85 + 0.15 * Math.cos(u * Math.PI * 2.0 + sway));
      half *= 1.0 - 0.22 * u * squish;
      const px = x + wob * half + (sway * 0.6) * (1 - u);
      const py = y - h * u;
      const rx = px + half;
      if (i === 0) ctx.moveTo(rx, py);
      else ctx.lineTo(rx, py);
    }
    for (let i = steps; i >= 0; i--) {
      const u = i / steps;
      const profile = Math.pow(1 - u, 0.55);
      const wob = Math.sin(u * Math.PI * 1.1 + sway) * (0.35 + 0.25 * (1 - u));
      let half = w * profile * (0.85 + 0.15 * Math.cos(u * Math.PI * 2.0 + sway));
      half *= 1.0 - 0.22 * u * squish;
      const px = x + wob * half + (sway * 0.6) * (1 - u);
      const py = y - h * u;
      ctx.lineTo(px - half, py);
    }
    ctx.closePath();
  }

  function drawFlame(baseX, baseY, t) {
    const windX = state.windX;
    const windY = state.windY;
    const sway = Math.sin(t * 7.0) * 4.2 + Math.sin(t * 2.7) * 2.0 + windX * 22;
    const breathe = 0.5 + 0.5 * Math.sin(t * 3.2 + 1.1);
    const squish = 0.5 + 0.5 * Math.sin(t * 5.1 + 0.8) + Math.abs(windX) * 0.8;

    const x = baseX + sway * 0.32;
    const y = baseY - 7 + Math.sin(t * 6.6) * 1.6 + windY * 10;

    const outerH = 102 + 14 * breathe;
    const outerW = 38 + 7 * (1 - breathe);

    // glow
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    for (let i = 0; i < 10; i++) {
      const a = 1 - i / 10;
      const r = 18 + i * 10;
      ctx.fillStyle = `rgba(60, 120, 255, ${a * 0.08})`;
      ctx.beginPath();
      ctx.ellipse(x, y - 36, r, r * 1.2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // outer
    ctx.fillStyle = "#ff7a2f";
    flamePath(x, y, outerH, outerW, t * 2.4 + windX * 1.6, squish);
    ctx.fill();

    // mid
    ctx.fillStyle = "#ffb347";
    flamePath(x, y + 2, outerH * 0.86, outerW * 0.78, t * 2.7 + 1.2 + windX * 1.8, squish);
    ctx.fill();

    // inner
    ctx.fillStyle = "#ffe9a6";
    flamePath(x, y + 7, outerH * 0.68, outerW * 0.50, t * 3.0 + 2.1 + windX * 2.0, squish);
    ctx.fill();

    // tip sparkle
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    const tipX = x + Math.sin(t * 9.0) * 2.0 + windX * 10;
    const tipY = y - outerH + 12;
    ctx.fillStyle = "rgba(255, 250, 210, 0.95)";
    ctx.beginPath();
    ctx.arc(tipX, tipY, 4.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function spawnDrip(meta, t, floorY) {
    if (t - state.lastDrip < 0.9 + rand01() * 1.8) return;
    state.lastDrip = t;
    const x = meta.cx + (rand01() - 0.5) * meta.candleW * 0.55;
    const y = meta.y0 + 12 + rand01() * 22;
    state.drips.push({
      x,
      y,
      v: 26 + rand01() * 26,
      r: 2.8 + rand01() * 3.0,
      alive: 1,
      floorY,
    });
  }

  function stepDrips(dt) {
    const next = [];
    for (const d of state.drips) {
      d.y += d.v * dt;
      d.v += 60 * dt;
      if (d.y > d.floorY - 8) continue;
      next.push(d);
    }
    state.drips = next;
  }

  function drawDrips() {
    for (const d of state.drips) {
      ctx.fillStyle = "rgba(245, 235, 225, 0.88)";
      ctx.beginPath();
      ctx.ellipse(d.x, d.y, d.r, d.r * 1.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.75)";
      ctx.beginPath();
      ctx.ellipse(d.x + d.r * 0.12, d.y - d.r * 0.22, d.r * 0.35, d.r * 0.42, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  let last = performance.now();
  function frame(now) {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const dt = clamp((now - last) / 1000, 0, 1 / 20);
    last = now;

    let t = (now - state.t0) / 1000;
    if (state.paused) t = (state.pauseAt - state.t0) / 1000;

    // wind easing
    state.windX = mix(state.windX, state.windTargetX, 1 - Math.pow(0.001, dt));
    state.windY = mix(state.windY, state.windTargetY, 1 - Math.pow(0.001, dt));
    state.windTargetX *= Math.pow(0.2, dt);
    state.windTargetY *= Math.pow(0.2, dt);

    // slow melt
    state.melt = Math.min(w * 0.11, t * 1.0);

    clear(w, h);
    drawVignette(w, h);
    drawStars(w, h, t);

    const floorY = h - 85;

    // flame glow behind candle
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha = 0.6;
    const glow = ctx.createRadialGradient(w * 0.5, floorY - w * 0.28, 0, w * 0.5, floorY - w * 0.28, w * 0.35);
    glow.addColorStop(0, "rgba(255, 180, 70, 0.18)");
    glow.addColorStop(0.35, "rgba(255, 120, 30, 0.08)");
    glow.addColorStop(1, "rgba(255, 120, 30, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();

    const meta = drawCandle(w, floorY, t);
    if (!state.paused) {
      spawnDrip(meta, t, floorY);
      stepDrips(dt);
    }
    drawDrips();
    drawFlame(meta.wickTipX, meta.wickTipY, t);
    drawGround(w, h, floorY);

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // interaction: wind
  let dragging = false;
  function applyWindFromEvent(e) {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const dx = (x - 0.5) * 2;
    const dy = (y - 0.45) * 2;
    state.windTargetX += clamp(dx, -1, 1) * 0.12;
    state.windTargetY += clamp(dy, -1, 1) * 0.06;
  }

  canvas.addEventListener("pointerdown", (e) => {
    dragging = true;
    canvas.setPointerCapture(e.pointerId);
    applyWindFromEvent(e);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    applyWindFromEvent(e);
  });
  canvas.addEventListener("pointerup", () => {
    dragging = false;
  });

  window.addEventListener("keydown", (e) => {
    if (e.code === "Space") {
      e.preventDefault();
      state.paused = !state.paused;
      state.pauseAt = performance.now();
    }
    if (e.key === "r" || e.key === "R") {
      state.t0 = performance.now();
      state.paused = false;
      state.melt = 0;
      state.drips = [];
      state.lastDrip = 0;
      state.seed = 7;
      state.windX = state.windY = state.windTargetX = state.windTargetY = 0;
    }
  });
})();

