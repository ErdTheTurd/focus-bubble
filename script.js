/* Blurzo — icon countdown and a one-shot page crumble at 0:00. Plain JS. */
(function () {
  "use strict";

  var ring = document.querySelector(".icon-ring");
  var capStart = document.querySelector(".icon-cap-start");
  var capEnd = document.querySelector(".icon-cap-end");
  var stage = document.querySelector(".icon-stage");
  var site = document.getElementById("site");
  if (!ring || !stage || !site) return;

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var params = new URLSearchParams(window.location.search);
  var tParam = parseFloat(params.get("t") || "");
  var DURATION = (isFinite(tParam) && tParam > 0 ? tParam : 30) * 1000;
  var RING_R = 0.1465;
  var TOP_SLACK = 80;

  var startAt = 0;
  var raf = 0;
  var exploding = false;
  var pending = false;

  function placeCap(el, ang, color) {
    if (!el) return;
    var rect = stage.getBoundingClientRect();
    var rad = rect.width * RING_R;
    el.style.left = rect.width / 2 + Math.cos(ang) * rad + "px";
    el.style.top = rect.height / 2 + Math.sin(ang) * rad + "px";
    el.style.background = color;
    el.style.opacity = "1";
  }

  function setProgress(p) {
    p = Math.max(0, Math.min(1, p));
    ring.style.setProperty("--p", String(p));
    var deg = (p * 360).toFixed(2) + "deg";
    ring.style.background =
      "conic-gradient(from -90deg, #ffc27a 0deg, #f69046 28deg, #e87a32 " +
      deg +
      ", transparent " +
      deg +
      ")";
    if (p <= 0.001) {
      if (capStart) capStart.style.opacity = "0";
      if (capEnd) capEnd.style.opacity = "0";
      return;
    }
    placeCap(capStart, -Math.PI / 2, "#ffc27a");
    placeCap(capEnd, -Math.PI / 2 + p * Math.PI * 2, p < 0.14 ? "#e06828" : "#f7a054");
  }

  function atTop() {
    return (window.scrollY || document.documentElement.scrollTop || 0) < TOP_SLACK;
  }

  function tick(now) {
    if (exploding) return;
    var left = DURATION - (now - startAt);
    var p = Math.max(0, left / DURATION);
    setProgress(p);
    if (left <= 0) {
      setProgress(0);
      if (atTop()) explode();
      else pending = true;
      return;
    }
    raf = requestAnimationFrame(tick);
  }

  function startTimer() {
    if (raf) cancelAnimationFrame(raf);
    startAt = performance.now();
    setProgress(1);
    raf = requestAnimationFrame(tick);
  }

  window.addEventListener(
    "scroll",
    function () {
      if (pending && !exploding && atTop()) {
        pending = false;
        explode();
      }
    },
    { passive: true }
  );

  function lockPage(on) {
    document.documentElement.classList.toggle("is-exploding", on);
  }

  function explode() {
    if (exploding) return;
    exploding = true;
    pending = false;
    if (raf) cancelAnimationFrame(raf);
    lockPage(true);
    if (reduced) fadeCycle();
    else shatter();
  }

  function fadeCycle() {
    site.style.transition = "opacity 0.55s ease";
    site.style.opacity = "0";
    window.setTimeout(resetAndEnter, 900);
  }

  function roundedRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function shatter() {
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var origin = stage.getBoundingClientRect();
    var ox = origin.left + origin.width / 2;
    var oy = origin.top + origin.height / 2;

    var layer = document.createElement("div");
    layer.className = "shatter";
    layer.setAttribute("aria-hidden", "true");

    var shards = [];

    function addShard(el, x, y, w, h, force, wave) {
      el.className = (el.className ? el.className + " " : "") + "shard";
      el.style.left = x + "px";
      el.style.top = y + "px";
      el.style.width = w + "px";
      el.style.height = h + "px";
      layer.appendChild(el);
      var mx = x + w / 2;
      var my = y + h / 2;
      var dx = mx - ox;
      var dy = my - oy;
      var dist = Math.hypot(dx, dy) || 1;
      shards.push({
        el: el,
        x: 0,
        y: 0,
        vx: (dx / dist) * force + (Math.random() - 0.5) * 150,
        vy: (dy / dist) * force * 0.5 + (Math.random() - 0.5) * 110 - 180,
        rot: 0,
        vr: (Math.random() - 0.5) * 2.5,
        delay: dist / wave,
        opacity: 1
      });
    }

    function panel(sel, split) {
      var src = document.querySelector(sel);
      if (!src) return;
      var r = src.getBoundingClientRect();
      if (r.bottom < 0 || r.top > vh || r.width < 2 || r.height < 2) return;
      var n = split || 1;
      var i, h, y, wrap, clone, cut;
      for (i = 0; i < n; i++) {
        h = r.height / n;
        y = r.top + i * h;
        wrap = document.createElement("div");
        clone = src.cloneNode(true);
        clone.querySelectorAll("img, .icon-ring, .icon-track, .icon-cap, .hero-icon").forEach(function (node) {
          node.remove();
        });
        cut = document.createElement("div");
        cut.style.position = "absolute";
        cut.style.left = "0";
        cut.style.top = -i * h + "px";
        cut.style.width = r.width + "px";
        cut.appendChild(clone);
        wrap.style.overflow = "hidden";
        wrap.appendChild(cut);
        addShard(wrap, r.left, y, r.width, h + 1, 280 + Math.random() * 220, 1300);
      }
    }

    panel(".site-header", 1);
    panel(".hero-copy", 3);

    var img = stage.querySelector("img");
    var ir = stage.getBoundingClientRect();
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var srcCanvas = document.createElement("canvas");
    var size = Math.max(8, Math.round(ir.width * dpr));
    srcCanvas.width = size;
    srcCanvas.height = size;
    var sctx = srcCanvas.getContext("2d");
    roundedRect(sctx, 0, 0, size, size, size * 0.2237);
    sctx.clip();
    try {
      sctx.drawImage(img, 0, 0, size, size);
    } catch (err) {
      sctx.fillStyle = "#14101c";
      sctx.fill();
    }

    var cols = ir.width < 280 ? 5 : 6;
    var rows = cols;
    var tw = ir.width / cols;
    var th = ir.height / rows;
    var sw = size / cols;
    var sh = size / rows;
    var row, col, tile, tctx, hold;
    for (row = 0; row < rows; row++) {
      for (col = 0; col < cols; col++) {
        tile = document.createElement("canvas");
        tile.width = Math.ceil(sw);
        tile.height = Math.ceil(sh);
        tctx = tile.getContext("2d");
        tctx.drawImage(srcCanvas, col * sw, row * sh, sw, sh, 0, 0, tile.width, tile.height);
        var pix = tctx.getImageData(0, 0, tile.width, tile.height).data;
        var lit = 0;
        var pi;
        for (pi = 0; pi < pix.length; pi += 16) {
          if (pix[pi] + pix[pi + 1] + pix[pi + 2] > 80) lit++;
        }
        if (lit < 6) continue;
        tile.style.width = "100%";
        tile.style.height = "100%";
        tile.style.display = "block";
        hold = document.createElement("div");
        hold.appendChild(tile);
        addShard(
          hold,
          ir.left + col * tw,
          ir.top + row * th,
          tw + 0.6,
          th + 0.6,
          500 + Math.random() * 340,
          650
        );
      }
    }

    document.body.appendChild(layer);
    site.style.visibility = "hidden";

    var canvas = document.createElement("canvas");
    canvas.className = "shatter-dust";
    canvas.setAttribute("aria-hidden", "true");
    document.body.appendChild(canvas);
    var ctx = canvas.getContext("2d");
    canvas.width = Math.floor(vw * dpr);
    canvas.height = Math.floor(vh * dpr);
    canvas.style.width = vw + "px";
    canvas.style.height = vh + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    var dust = [];
    var DUST_CAP = 900;
    function spawn(n, x, y, spread, burst) {
      var i, a, sp, col, life, color;
      if (dust.length >= DUST_CAP) return;
      if (dust.length + n > DUST_CAP) n = DUST_CAP - dust.length;
      for (i = 0; i < n; i++) {
        a = Math.random() * Math.PI * 2;
        sp = (burst || 240) * (0.2 + Math.random());
        col = Math.random();
        life = 1.4 + Math.random() * 1.5;
        if (col < 0.22) color = "255,248,236";
        else if (col < 0.5) color = "236,226,210";
        else if (col < 0.78) color = "255,196,120";
        else color = "246,160,80";
        dust.push({
          x: x + (Math.random() - 0.5) * spread,
          y: y + (Math.random() - 0.5) * spread,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp * 0.55 - Math.random() * 160,
          g: 260 + Math.random() * 240,
          s: 1 + Math.random() * 3,
          life: life,
          age: 0,
          swirl: (Math.random() - 0.5) * 2.4,
          color: color
        });
      }
    }
    spawn(320, ox, oy, 42, 460);
    spawn(100, ox, oy, 110, 200);
    for (var si = 0; si < shards.length; si++) {
      var sl = shards[si].el.getBoundingClientRect();
      spawn(8, sl.left + sl.width / 2, sl.top + sl.height / 2, 18, 170);
    }

    var t0 = performance.now();
    var last = t0;
    var gravity = 2000;
    var DUST_END = 3000;
    var HOLD = 420;
    var done = false;

    function frame(now) {
      var dt = Math.min(0.032, (now - last) / 1000);
      last = now;
      var t = now - t0;
      var k, s, local, fade, p, alpha, sr;

      for (k = 0; k < shards.length; k++) {
        s = shards[k];
        local = t / 1000 - s.delay;
        if (local > 0) {
          s.vy += gravity * dt;
          s.x += s.vx * dt;
          s.y += s.vy * dt;
          s.rot += s.vr * dt;
          fade = 1 - Math.max(0, (local - 0.5) / 1.65);
          s.opacity = Math.max(0, fade);
          s.el.style.transform =
            "translate3d(" + s.x + "px," + s.y + "px,0) rotate(" + s.rot + "rad)";
          s.el.style.opacity = String(s.opacity);
          if (t < 1800 && s.opacity > 0.12 && Math.random() < 0.2) {
            sr = s.el.getBoundingClientRect();
            spawn(2, sr.left + sr.width / 2, sr.top + sr.height / 2, 12, 90);
          }
        }
      }

      ctx.clearRect(0, 0, vw, vh);
      for (k = 0; k < dust.length; k++) {
        p = dust[k];
        p.age += dt;
        if (p.age > p.life) continue;
        p.vx += Math.sin(t / 260 + p.swirl) * 50 * dt * p.swirl;
        p.vy += Math.cos(t / 300) * 16 * dt;
        p.vy += p.g * dt;
        p.vx *= 0.994;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.y > vh - 2) {
          p.y = vh - 2;
          p.vy *= -0.1;
          p.vx *= 0.6;
        }
        alpha = Math.min(1, (1 - p.age / p.life) * 1.15);
        if (alpha > 1) alpha = 1;
        ctx.fillStyle = "rgba(" + p.color + "," + alpha.toFixed(3) + ")";
        ctx.fillRect(p.x, p.y, p.s, p.s);
      }

      if (t < DUST_END) {
        requestAnimationFrame(frame);
      } else if (!done) {
        done = true;
        window.setTimeout(function () {
          layer.remove();
          canvas.remove();
          resetAndEnter();
        }, HOLD);
      }
    }

    requestAnimationFrame(frame);
  }

  function resetAndEnter() {
    window.scrollTo(0, 0);
    site.style.visibility = "";
    site.style.opacity = "";
    site.style.transition = "";
    site.classList.remove("enter");
    void site.offsetWidth;
    site.classList.add("enter");
    lockPage(false);
    exploding = false;
    pending = false;
    startTimer();
    var tidy = function () {
      site.classList.remove("enter");
      site.removeEventListener("animationend", tidy);
    };
    site.addEventListener("animationend", tidy);
  }

  startTimer();
})();
