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

  function hash2(x, y, seed) {
    var n = Math.sin(x * 127.1 + y * 311.7 + (seed || 0) * 74.7) * 43758.5453;
    return n - Math.floor(n);
  }

  function smoothstep(t) {
    return t * t * (3 - 2 * t);
  }

  function vnoise(x, y, seed) {
    var x0 = Math.floor(x);
    var y0 = Math.floor(y);
    var fx = x - x0;
    var fy = y - y0;
    var sx = smoothstep(fx);
    var sy = smoothstep(fy);
    var a = hash2(x0, y0, seed);
    var b = hash2(x0 + 1, y0, seed);
    var c = hash2(x0, y0 + 1, seed);
    var d = hash2(x0 + 1, y0 + 1, seed);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  }

  function fbm(x, y, seed) {
    var amp = 1;
    var freq = 1;
    var sum = 0;
    var n = 0;
    var i;
    for (i = 0; i < 5; i++) {
      sum += amp * vnoise(x * freq, y * freq, seed + i * 19);
      n += amp;
      amp *= 0.5;
      freq *= 2.05;
    }
    return sum / n;
  }

  function makeSmokeSprite(size, seed) {
    var c = document.createElement("canvas");
    c.width = size;
    c.height = size;
    var cctx = c.getContext("2d");
    var img = cctx.createImageData(size, size);
    var data = img.data;
    var cx = (size - 1) * 0.5;
    var i, x, y, dx, dy, d, n, wisp, mask, a, r, g, b, warm, edge, dd;
    for (y = 0; y < size; y++) {
      for (x = 0; x < size; x++) {
        dx = (x - cx) / cx;
        dy = (y - cx) / cx;
        d = Math.sqrt(dx * dx + dy * dy);
        n = fbm(x / 16, y / 16, seed);
        wisp = fbm(x / 8 + 8, y / 10 - 3, seed + 5);
        edge = 0.72 + 0.5 * fbm(x / 12, y / 13, seed + 9);
        dd = d / Math.max(0.35, edge);
        mask = Math.max(0, 1 - dd);
        mask = mask * (0.25 + 1.05 * n);
        mask *= 0.35 + 1.05 * wisp;
        if (mask > 1) mask = 1;
        a = Math.pow(mask, 1.2) * 230;
        if (a < 1) {
          i = (y * size + x) * 4;
          data[i + 3] = 0;
          continue;
        }
        warm = 0.9 + n * 0.15;
        r = 162 * warm;
        g = 152 * warm;
        b = 140 * warm;
        i = (y * size + x) * 4;
        data[i] = r;
        data[i + 1] = g;
        data[i + 2] = b;
        data[i + 3] = a;
      }
    }
    cctx.putImageData(img, 0, 0);
    return c;
  }

  function centroid(poly) {
    var x = 0;
    var y = 0;
    var i;
    for (i = 0; i < poly.length; i++) {
      x += poly[i][0];
      y += poly[i][1];
    }
    return [x / poly.length, y / poly.length];
  }

  function intersectEdge(p, q, mx, my, nx, ny) {
    var dx = q[0] - p[0];
    var dy = q[1] - p[1];
    var den = dx * nx + dy * ny;
    if (Math.abs(den) < 1e-8) return [p[0], p[1]];
    var t = ((mx - p[0]) * nx + (my - p[1]) * ny) / den;
    if (t < 0) t = 0;
    if (t > 1) t = 1;
    return [p[0] + dx * t, p[1] + dy * t];
  }

  function clipByBisector(poly, a, b) {
    var mx = (a[0] + b[0]) * 0.5;
    var my = (a[1] + b[1]) * 0.5;
    var nx = b[0] - a[0];
    var ny = b[1] - a[1];
    var out = [];
    var n = poly.length;
    var i, p, q, pin, qin;
    for (i = 0; i < n; i++) {
      p = poly[i];
      q = poly[(i + 1) % n];
      pin = (p[0] - mx) * nx + (p[1] - my) * ny <= 0;
      qin = (q[0] - mx) * nx + (q[1] - my) * ny <= 0;
      if (pin) out.push(p);
      if (pin !== qin) out.push(intersectEdge(p, q, mx, my, nx, ny));
    }
    return out;
  }

  function voronoiCells(sites, w, h) {
    var bounds = [
      [0, 0],
      [w, 0],
      [w, h],
      [0, h]
    ];
    var cells = [];
    var i, j, poly;
    for (i = 0; i < sites.length; i++) {
      poly = bounds;
      for (j = 0; j < sites.length; j++) {
        if (i === j) continue;
        poly = clipByBisector(poly, sites[i], sites[j]);
        if (poly.length < 3) break;
      }
      if (poly.length >= 3) cells.push(poly);
    }
    return cells;
  }

  function jagPolygon(poly, amt) {
    var out = [];
    var i, p, q, mx, my, dx, dy, len, px, py, j;
    for (i = 0; i < poly.length; i++) {
      p = poly[i];
      q = poly[(i + 1) % poly.length];
      out.push(p);
      dx = q[0] - p[0];
      dy = q[1] - p[1];
      len = Math.hypot(dx, dy);
      if (len < 22) continue;
      j = (Math.random() - 0.5) * amt;
      mx = (p[0] + q[0]) * 0.5;
      my = (p[1] + q[1]) * 0.5;
      px = -dy / len;
      py = dx / len;
      // keep edges near the viewport frame almost straight
      if (p[0] < 1 && q[0] < 1) continue;
      if (p[1] < 1 && q[1] < 1) continue;
      if (p[0] > vwTmp - 1 && q[0] > vwTmp - 1) continue;
      if (p[1] > vhTmp - 1 && q[1] > vhTmp - 1) continue;
      out.push([mx + px * j, my + py * j]);
    }
    return out;
  }

  var vwTmp = 0;
  var vhTmp = 0;

  function inflate(poly, px) {
    var c = centroid(poly);
    return poly.map(function (p) {
      var dx = p[0] - c[0];
      var dy = p[1] - c[1];
      var d = Math.hypot(dx, dy) || 1;
      return [p[0] + (dx / d) * px, p[1] + (dy / d) * px];
    });
  }

  function placeSites(n, ox, oy, vw, vh) {
    var sites = [];
    var i, ang, r, x, y, ok, k, minD, tries;
    var near = Math.round(n * 0.62);
    minD = Math.min(vw, vh) * 0.04;
    function add(x, y) {
      if (x < 0) x = 0;
      if (y < 0) y = 0;
      if (x > vw) x = vw;
      if (y > vh) y = vh;
      ok = true;
      for (k = 0; k < sites.length; k++) {
        if (Math.hypot(sites[k][0] - x, sites[k][1] - y) < minD) {
          ok = false;
          break;
        }
      }
      if (ok) sites.push([x, y]);
      return ok;
    }
    for (i = 0; i < near; i++) {
      for (tries = 0; tries < 8; tries++) {
        ang = Math.random() * Math.PI * 2;
        r = Math.pow(Math.random(), 0.7) * Math.max(220, Math.min(vw, vh) * 0.38);
        if (add(ox + Math.cos(ang) * r, oy + Math.sin(ang) * r)) break;
      }
    }
    while (sites.length < n) {
      if (!add(Math.random() * vw, Math.random() * vh)) {
        minD *= 0.85;
        if (minD < 8) add(Math.random() * vw, Math.random() * vh);
      }
      if (sites.length > 80) break;
    }
    return sites;
  }

  function shatter() {
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    vwTmp = vw;
    vhTmp = vh;
    var origin = stage.getBoundingClientRect();
    var ox = origin.left + origin.width / 2;
    var oy = origin.top + origin.height / 2;
    var ir = stage.getBoundingClientRect();
    var dpr = Math.min(window.devicePixelRatio || 1, 2);

    var layer = document.createElement("div");
    layer.className = "shatter";
    layer.setAttribute("aria-hidden", "true");

    var shards = [];
    var nSites = vw < 700 ? 26 : 36;
    var sites = placeSites(nSites, ox, oy, vw, vh);
    var cells = voronoiCells(sites, vw, vh);
    var edges = [];

    function buildFilm() {
      var film = document.createElement("div");
      film.className = "shard-inner";
      film.style.width = vw + "px";
      film.style.height = vh + "px";
      function stamp(sel) {
        var src = document.querySelector(sel);
        if (!src) return;
        var r = src.getBoundingClientRect();
        var clone = src.cloneNode(true);
        clone.querySelectorAll("img, .icon-ring, .icon-track, .icon-cap, .hero-icon").forEach(function (node) {
          node.remove();
        });
        clone.style.position = "absolute";
        clone.style.left = r.left + "px";
        clone.style.top = r.top + "px";
        clone.style.width = r.width + "px";
        clone.style.margin = "0";
        film.appendChild(clone);
      }
      stamp(".site-header");
      stamp(".hero-copy");
      var icon = document.createElement("img");
      var srcImg = stage.querySelector("img");
      icon.src = srcImg ? srcImg.src : "images/icon-bare.png";
      icon.alt = "";
      icon.style.position = "absolute";
      icon.style.left = ir.left + "px";
      icon.style.top = ir.top + "px";
      icon.style.width = ir.width + "px";
      icon.style.height = ir.height + "px";
      icon.style.borderRadius = "22.37%";
      icon.style.display = "block";
      film.appendChild(icon);
      return film;
    }

    var ci, poly, bbox, minx, miny, maxx, maxy, p, el, film, cx, cy, dist, closeness, force, e, a, b, key, seen;
    seen = {};
    for (ci = 0; ci < cells.length; ci++) {
      poly = jagPolygon(inflate(cells[ci], 0.8), 7);
      if (poly.length < 3) continue;
      minx = miny = 1e9;
      maxx = maxy = -1e9;
      for (e = 0; e < poly.length; e++) {
        p = poly[e];
        if (p[0] < minx) minx = p[0];
        if (p[1] < miny) miny = p[1];
        if (p[0] > maxx) maxx = p[0];
        if (p[1] > maxy) maxy = p[1];
        a = poly[e];
        b = poly[(e + 1) % poly.length];
        key =
          Math.round(Math.min(a[0], b[0]) * 4) +
          "," +
          Math.round(Math.min(a[1], b[1]) * 4) +
          "," +
          Math.round(Math.max(a[0], b[0]) * 4) +
          "," +
          Math.round(Math.max(a[1], b[1]) * 4);
        if (!seen[key]) {
          seen[key] = true;
          edges.push([a, b]);
        }
      }
      if (maxx - minx < 8 || maxy - miny < 8) continue;
      el = document.createElement("div");
      el.className = "shard";
      el.style.left = minx + "px";
      el.style.top = miny + "px";
      el.style.width = maxx - minx + "px";
      el.style.height = maxy - miny + "px";
      el.style.clipPath =
        "polygon(" +
        poly
          .map(function (pt) {
            return (pt[0] - minx).toFixed(2) + "px " + (pt[1] - miny).toFixed(2) + "px";
          })
          .join(",") +
        ")";
      film = buildFilm();
      film.style.left = -minx + "px";
      film.style.top = -miny + "px";
      el.appendChild(film);
      var mid = centroid(poly);
      cx = mid[0];
      cy = mid[1];
      el.style.transformOrigin = cx - minx + "px " + (cy - miny) + "px";
      layer.appendChild(el);
      dist = Math.hypot(cx - ox, cy - oy) || 1;
      closeness = 1 - Math.min(1, dist / (Math.hypot(vw, vh) * 0.55));
      force = 120 + closeness * 520 + Math.random() * 110;
      shards.push({
        el: el,
        x: 0,
        y: 0,
        vx: ((cx - ox) / dist) * force + (Math.random() - 0.5) * 80,
        vy: ((cy - oy) / dist) * force * 0.5 + (Math.random() - 0.5) * 70 - 80,
        rot: 0,
        vr: (Math.random() - 0.5) * (0.5 + closeness * 3.4),
        delay: 0.2 + dist / 1700,
        opacity: 1,
        g: 1100 + Math.random() * 1500,
        large: maxx - minx + (maxy - miny) > 220
      });
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

    var sprites = [
      makeSmokeSprite(96, 11),
      makeSmokeSprite(96, 23),
      makeSmokeSprite(128, 31),
      makeSmokeSprite(128, 47),
      makeSmokeSprite(160, 59)
    ];
    var SMOKE_CAP = 52;
    var smoke = [];

    function spawnSmoke(x, y, spread, burst, layerIdx, scale) {
      if (smoke.length >= SMOKE_CAP) return;
      var a = Math.random() * Math.PI * 2;
      var sp = (burst || 28) * (0.3 + Math.random() * 0.7);
      smoke.push({
        x: x + (Math.random() - 0.5) * spread,
        y: y + (Math.random() - 0.5) * spread,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp * 0.3 - (18 + Math.random() * 36),
        g: 14 + Math.random() * 28,
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 0.35,
        w: (scale || 1) * (70 + Math.random() * 110),
        grow: 20 + Math.random() * 50,
        life: 2.3 + Math.random() * 1.3,
        age: 0,
        swirl: (Math.random() - 0.5) * 1.2,
        a0: 0.18 + Math.random() * 0.22,
        sprite: sprites[(layerIdx + Math.floor(Math.random() * 3)) % sprites.length],
        layer: layerIdx || 0
      });
    }

    var si;
    for (si = 0; si < 10; si++) spawnSmoke(ox, oy, 40, 36, 0, 1.5);
    for (si = 0; si < 12; si++) spawnSmoke(ox, oy, 70, 48, 1, 1);
    for (si = 0; si < 8; si++) spawnSmoke(ox, oy, 30, 22, 2, 0.7);
    for (si = 0; si < shards.length; si++) {
      if (!shards[si].large && Math.random() > 0.4) continue;
      var sl = shards[si].el.getBoundingClientRect();
      spawnSmoke(sl.left + sl.width / 2, sl.top + sl.height / 2, 18, 20, 1, 0.7);
    }

    var t0 = performance.now();
    var last = t0;
    var DUST_END = 3300;
    var HOLD = 560;
    var done = false;

    function frame(now) {
      var dt = Math.min(0.032, (now - last) / 1000);
      last = now;
      var t = now - t0;
      var k, s, local, fade, p, u, alpha, w, sr, crackA, e1, turb;

      for (k = 0; k < shards.length; k++) {
        s = shards[k];
        local = t / 1000 - s.delay;
        if (local > 0) {
          s.vy += s.g * dt;
          s.x += s.vx * dt;
          s.y += s.vy * dt;
          s.rot += s.vr * dt;
          fade = 1 - Math.max(0, (local - 0.7) / 1.7);
          s.opacity = Math.max(0, fade);
          s.el.style.transform =
            "translate3d(" + s.x + "px," + s.y + "px,0) rotate(" + s.rot + "rad)";
          s.el.style.opacity = String(s.opacity);
          if (t < 2100 && s.large && s.opacity > 0.2 && Math.random() < 0.08) {
            sr = s.el.getBoundingClientRect();
            spawnSmoke(sr.left + sr.width / 2, sr.top + sr.height / 2, 14, 16, 1, 0.65);
          }
        }
      }

      ctx.clearRect(0, 0, vw, vh);

      if (t < 420) {
        if (t < 90) crackA = t / 90;
        else if (t < 200) crackA = 1;
        else crackA = 1 - (t - 200) / 220;
        ctx.save();
        ctx.strokeStyle = "rgba(226,216,200," + (0.7 * crackA).toFixed(3) + ")";
        ctx.lineWidth = 1.25;
        ctx.lineJoin = "bevel";
        for (k = 0; k < edges.length; k++) {
          e1 = edges[k];
          ctx.beginPath();
          ctx.moveTo(e1[0][0], e1[0][1]);
          ctx.lineTo(e1[1][0], e1[1][1]);
          ctx.stroke();
        }
        ctx.restore();
      }

      smoke.sort(function (a, b) {
        return a.layer - b.layer;
      });
      for (k = 0; k < smoke.length; k++) {
        p = smoke[k];
        p.age += dt;
        if (p.age > p.life) continue;
        turb = Math.sin(t / 420 + p.swirl * 3);
        p.vx += turb * 18 * dt * p.swirl;
        p.vy += Math.cos(t / 380 + p.swirl) * 10 * dt;
        // rise first, then settle
        if (u = p.age / p.life, u < 0.4) p.vy -= 12 * dt;
        else p.vy += p.g * dt;
        p.vx *= 0.975;
        p.vy *= 0.98;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
        u = p.age / p.life;
        fade = u < 0.16 ? u / 0.16 : Math.pow(1 - (u - 0.16) / 0.84, 1.15);
        if (fade < 0) fade = 0;
        alpha = p.a0 * fade;
        w = p.w + p.grow * u;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = alpha;
        ctx.drawImage(p.sprite, -w * 0.5, -w * 0.55, w, w);
        ctx.restore();
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
