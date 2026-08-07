// -------------------------------------------------------
// Conway polyhedron engine, rendered to 2D canvas. No libraries.
//
// Seeds are the five Platonic solids, each with its own colour; operators
// are truncate (t), kis/stellate (k) and dual (d). Every seed runs exactly
// three operators before the next seed blooms in. Same machine as the catch
// generator, cut down to a wireframe.

(function () {
  "use strict";

  var canvas = document.getElementById("solid");
  if (!canvas) return;

  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }

  var ctx = canvas.getContext("2d");
  var w = 0, h = 0, dpr = 1;

  // -------------------------------------------------------
  // Vector helpers

  function centroidOf(verts, f) {
    var x = 0, y = 0, z = 0;
    for (var i = 0; i < f.length; i++) {
      x += verts[f[i]][0]; y += verts[f[i]][1]; z += verts[f[i]][2];
    }
    return [x / f.length, y / f.length, z / f.length];
  }

  // Newell's method: correct for any planar polygon, and stable on the
  // non-planar n-gons that deep operator chains produce.
  function newellNormal(verts, f) {
    var nx = 0, ny = 0, nz = 0;
    for (var i = 0; i < f.length; i++) {
      var a = verts[f[i]], b = verts[f[(i + 1) % f.length]];
      nx += (a[1] - b[1]) * (a[2] + b[2]);
      ny += (a[2] - b[2]) * (a[0] + b[0]);
      nz += (a[0] - b[0]) * (a[1] + b[1]);
    }
    return [nx, ny, nz];
  }

  // Every solid here is convex and origin-centred, so "outward" is just
  // agreement between the face normal and the face centroid.
  function fixWinding(poly) {
    for (var i = 0; i < poly.faces.length; i++) {
      var f = poly.faces[i];
      var n = newellNormal(poly.verts, f);
      var c = centroidOf(poly.verts, f);
      if (n[0] * c[0] + n[1] * c[1] + n[2] * c[2] < 0) poly.faces[i] = f.slice().reverse();
    }
    return poly;
  }

  // Cyclic order around an axis, used for vertex figures.
  function sortAround(axis, items) {
    var ax = axis[0], ay = axis[1], az = axis[2];
    var len = Math.sqrt(ax * ax + ay * ay + az * az) || 1;
    ax /= len; ay /= len; az /= len;

    var ref = Math.abs(ax) < 0.9 ? [1, 0, 0] : [0, 1, 0];
    var e1 = [ay * ref[2] - az * ref[1], az * ref[0] - ax * ref[2], ax * ref[1] - ay * ref[0]];
    var l1 = Math.sqrt(e1[0] * e1[0] + e1[1] * e1[1] + e1[2] * e1[2]) || 1;
    e1 = [e1[0] / l1, e1[1] / l1, e1[2] / l1];
    var e2 = [ay * e1[2] - az * e1[1], az * e1[0] - ax * e1[2], ax * e1[1] - ay * e1[0]];

    items.sort(function (p, q) {
      var pa = Math.atan2(p.pos[0] * e2[0] + p.pos[1] * e2[1] + p.pos[2] * e2[2],
                          p.pos[0] * e1[0] + p.pos[1] * e1[1] + p.pos[2] * e1[2]);
      var qa = Math.atan2(q.pos[0] * e2[0] + q.pos[1] * e2[1] + q.pos[2] * e2[2],
                          q.pos[0] * e1[0] + q.pos[1] * e1[1] + q.pos[2] * e1[2]);
      return pa - qa;
    });
    return items;
  }

  function edgesOf(poly) {
    var seen = {}, out = [];
    for (var i = 0; i < poly.faces.length; i++) {
      var f = poly.faces[i];
      for (var j = 0; j < f.length; j++) {
        var a = f[j], b = f[(j + 1) % f.length];
        var k = a < b ? a + "_" + b : b + "_" + a;
        if (!seen[k]) { seen[k] = 1; out.push([a, b]); }
      }
    }
    poly.edges = out;
    return poly;
  }

  function facesAtVertex(poly, v) {
    var out = [];
    for (var i = 0; i < poly.faces.length; i++) {
      if (poly.faces[i].indexOf(v) !== -1) out.push(i);
    }
    return out;
  }

  function neighboursOf(poly, v) {
    var out = [], seen = {};
    for (var i = 0; i < poly.edges.length; i++) {
      var e = poly.edges[i], u = -1;
      if (e[0] === v) u = e[1]; else if (e[1] === v) u = e[0];
      if (u >= 0 && !seen[u]) { seen[u] = 1; out.push(u); }
    }
    return out;
  }

  function finish(poly) {
    return edgesOf(fixWinding(poly));
  }

  // -------------------------------------------------------
  // Seeds
  //
  // For the triangle-faced solids a face is exactly a triple of mutually
  // adjacent vertices, so the face list is derived rather than typed out.

  function trianglesByAdjacency(verts, edgeLen2) {
    var faces = [];
    function near(i, j) {
      var dx = verts[i][0] - verts[j][0];
      var dy = verts[i][1] - verts[j][1];
      var dz = verts[i][2] - verts[j][2];
      return Math.abs(dx * dx + dy * dy + dz * dz - edgeLen2) < 0.001;
    }
    for (var i = 0; i < verts.length; i++)
      for (var j = i + 1; j < verts.length; j++)
        for (var k = j + 1; k < verts.length; k++)
          if (near(i, j) && near(j, k) && near(i, k)) faces.push([i, j, k]);
    return faces;
  }

  var PHI = (1 + Math.sqrt(5)) / 2;

  function tetrahedron() {
    var v = [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]];
    return finish({ verts: v, faces: trianglesByAdjacency(v, 8) });
  }

  function octahedron() {
    var v = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
    return finish({ verts: v, faces: trianglesByAdjacency(v, 2) });
  }

  function icosahedron() {
    var v = [
      [0, 1, PHI], [0, 1, -PHI], [0, -1, PHI], [0, -1, -PHI],
      [1, PHI, 0], [1, -PHI, 0], [-1, PHI, 0], [-1, -PHI, 0],
      [PHI, 0, 1], [-PHI, 0, 1], [PHI, 0, -1], [-PHI, 0, -1]
    ];
    return finish({ verts: v, faces: trianglesByAdjacency(v, 4) });
  }

  function cube() {
    var v = [
      [-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1],
      [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]
    ];
    var f = [[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4],
             [3, 2, 6, 7], [0, 3, 7, 4], [1, 2, 6, 5]];
    return finish({ verts: v, faces: f });
  }

  // -------------------------------------------------------
  // Operators
  //
  // Each returns a polyhedron plus two parallel arrays:
  //   birth - where a vertex sits at morph time 0, so the transition is the
  //           real continuous family rather than a crossfade
  //   fresh - whether this vertex is created by the operator, so its star
  //           can be held back until the edges have reached its position

  function dual(poly) {
    var verts = poly.faces.map(function (f) { return centroidOf(poly.verts, f); });
    var faces = [];
    for (var v = 0; v < poly.verts.length; v++) {
      var fs = facesAtVertex(poly, v).map(function (fi) {
        return { key: fi, pos: verts[fi] };
      });
      if (fs.length < 3) continue;
      faces.push(sortAround(poly.verts[v], fs).map(function (o) { return o.key; }));
    }
    var out = finish({ verts: verts, faces: faces });
    out.color = poly.color;
    return out;
  }

  // Apex over each face; every original vertex is carried through, so the
  // apexes are the only new geometry and can be animated on their own.
  function kis(poly, height) {
    var verts = poly.verts.slice();
    var birth = poly.verts.map(function (p) { return p.slice(); });
    var fresh = poly.verts.map(function () { return false; });
    var faces = [];

    for (var i = 0; i < poly.faces.length; i++) {
      var f = poly.faces[i];
      var c = centroidOf(poly.verts, f);
      var ai = verts.length;
      verts.push([c[0] * height, c[1] * height, c[2] * height]);
      birth.push([c[0], c[1], c[2]]);
      fresh.push(true);
      for (var j = 0; j < f.length; j++) {
        faces.push([f[j], f[(j + 1) % f.length], ai]);
      }
    }
    var out = finish({ verts: verts, faces: faces });
    out.birth = birth;
    out.fresh = fresh;
    out.morphKind = "kis";
    out.color = poly.color;
    return out;
  }

  // Cut every vertex. Each new vertex is born sitting on the parent vertex
  // it was cut from, so at t=0 the shape is exactly the original solid.
  function truncate(poly, amt) {
    var idx = {}, verts = [], birth = [];

    function point(a, b) {
      var key = a + "_" + b;
      if (idx[key] !== undefined) return idx[key];
      var A = poly.verts[a], B = poly.verts[b];
      idx[key] = verts.length;
      verts.push([A[0] + (B[0] - A[0]) * amt,
                  A[1] + (B[1] - A[1]) * amt,
                  A[2] + (B[2] - A[2]) * amt]);
      birth.push([A[0], A[1], A[2]]);
      return idx[key];
    }

    var faces = [];

    for (var i = 0; i < poly.faces.length; i++) {
      var f = poly.faces[i], nf = [];
      for (var j = 0; j < f.length; j++) {
        var prev = f[(j - 1 + f.length) % f.length];
        var cur = f[j];
        var next = f[(j + 1) % f.length];
        nf.push(point(cur, prev));
        nf.push(point(cur, next));
      }
      faces.push(nf);
    }

    for (var v = 0; v < poly.verts.length; v++) {
      var ring = neighboursOf(poly, v).map(function (u) {
        var pi = point(v, u);
        return { key: pi, pos: verts[pi] };
      });
      if (ring.length < 3) continue;
      faces.push(sortAround(poly.verts[v], ring).map(function (o) { return o.key; }));
    }

    var out = finish({ verts: verts, faces: faces });
    out.birth = birth;
    out.morphKind = "truncate";
    out.color = poly.color;
    return out;
  }

  // -------------------------------------------------------
  // Sequencing

  // Element hooks, one colour per seed.
  var SEEDS = [
    { make: tetrahedron, color: [255, 154,  92] },   // fire
    { make: cube,        color: [255, 198, 108] },   // earth
    { make: octahedron,  color: [138, 226, 236] },   // air
    { make: icosahedron, color: [124, 140, 255] },   // water
    { make: function () { return dual(icosahedron()); },
                         color: [196, 142, 255] }    // aether
  ];

  var MODS = 3;          // operators applied per seed, then a new seed
  var MAX_VERTS = 400;   // preferred complexity ceiling
  var HOLD = 5200;       // ms held on a finished shape
  var MORPH = 2300;      // ms of transition
  // Stellation runs in three phases across its morph: edges draw outward
  // from the existing points to the face centre, then the new star emerges
  // there, and only then does the spike rise.
  var KIS_DRAW = 0.45;   // edges have reached the face centre by here
  var KIS_STAR = 0.62;   // new star has fully emerged by here

  // On a reseed the outgoing solid expands outward as it fades, while the
  // incoming one still blooms up out of the core.
  var BLOOM_OUT = 0.85;  // how far past full size the old shape swells
  var BLOOM_IN = 0.65;   // how far below full size the new shape starts

  var seedIndex = 3;
  var current = SEEDS[seedIndex].make();
  current.color = SEEDS[seedIndex].color;

  var previous = null;
  var chain = 0;
  var mode = "hold";     // "hold" | "morph" | "bloom"
  var markAt = 0;

  function reseed() {
    previous = current;
    var i;
    do { i = Math.floor(Math.random() * SEEDS.length); }
    while (i === seedIndex && SEEDS.length > 1);
    seedIndex = i;
    current = SEEDS[i].make();
    current.color = SEEDS[i].color;
    current.birth = null;
    current.fresh = null;
    chain = 0;
    mode = "bloom";
  }

  function step() {
    if (chain >= MODS) return reseed();

    // Build all three candidates and prefer one that stays under the
    // ceiling, so the seed always gets its full run of operators instead
    // of being cut short by a complexity trip.
    var cands = [truncate(current, 1 / 3), kis(current, 1.45), dual(current)];
    var fits = cands.filter(function (c) { return c.verts.length <= MAX_VERTS; });

    var next;
    if (fits.length) {
      next = fits[Math.floor(Math.random() * fits.length)];
    } else {
      next = cands.reduce(function (a, b) {
        return a.verts.length <= b.verts.length ? a : b;
      });
    }

    previous = current;
    current = next;
    chain++;
    mode = current.birth ? "morph" : "bloom";
  }

  // -------------------------------------------------------
  // Render

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function easeInOut(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function smooth01(x) {
    x = x < 0 ? 0 : x > 1 ? 1 : x;
    return x * x * (3 - 2 * x);
  }

  // Glow is drawn from a pre-rendered sprite rather than a per-vertex
  // radial gradient, which is what makes rendering every star affordable
  // once a chain gets dense.
  var sprites = {};
  function glowSprite(color) {
    var key = color[0] + "_" + color[1] + "_" + color[2];
    if (sprites[key]) return sprites[key];

    var size = 64, mid = size / 2;
    var off = document.createElement("canvas");
    off.width = size; off.height = size;
    var g = off.getContext("2d");
    var grd = g.createRadialGradient(mid, mid, 0, mid, mid, mid);
    var rgb = color[0] + ", " + color[1] + ", " + color[2];
    grd.addColorStop(0, "rgba(" + rgb + ", 0.85)");
    grd.addColorStop(0.3, "rgba(" + rgb + ", 0.28)");
    grd.addColorStop(1, "rgba(" + rgb + ", 0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, size, size);

    sprites[key] = off;
    return off;
  }

  function drawSolid(verts, edges, color, ax, ay, alphaMul, scaleMul, fresh, gate, grow) {
    var maxR = 0;
    for (var i = 0; i < verts.length; i++) {
      var v = verts[i];
      var r = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
      if (r > maxR) maxR = r;
    }
    if (maxR <= 0) return;

    var fit = (Math.min(w, h) * 0.30 / maxR) * scaleMul;
    var cosY = Math.cos(ay), sinY = Math.sin(ay);
    var cosX = Math.cos(ax), sinX = Math.sin(ax);
    var rgb = color[0] + ", " + color[1] + ", " + color[2];

    var pts = [];
    for (var p = 0; p < verts.length; p++) {
      var q = verts[p];
      var x1 = q[0] * cosY - q[2] * sinY;
      var z1 = q[0] * sinY + q[2] * cosY;
      var y1 = q[1] * cosX - z1 * sinX;
      var z2 = q[1] * sinX + z1 * cosX;
      var persp = 4.6 / (4.6 + (z2 / maxR) * 1.6);
      pts.push({
        x: w * 0.5 + x1 * fit * persp,
        y: h * 0.5 + y1 * fit * persp,
        depth: persp
      });
    }

    ctx.lineCap = "round";
    for (var e = 0; e < edges.length; e++) {
      var i0 = edges[e][0], i1 = edges[e][1];
      var a = pts[i0], b = pts[i1];
      if (!a || !b) continue;
      var depth = (a.depth + b.depth) * 0.5;
      var alpha = Math.max(0, (depth - 0.72) * 1.5) * alphaMul;
      if (alpha <= 0.004) continue;

      var sx = a.x, sy = a.y, ex = b.x, ey = b.y;

      // An edge with exactly one fresh endpoint is new geometry, so it is
      // drawn outward from the existing point it grew from.
      if (grow < 1 && fresh) {
        var f0 = fresh[i0], f1 = fresh[i1];
        if (f0 !== f1) {
          if (grow <= 0.001) continue;
          var base = f0 ? b : a, tip = f0 ? a : b;
          sx = base.x; sy = base.y;
          ex = base.x + (tip.x - base.x) * grow;
          ey = base.y + (tip.y - base.y) * grow;
        }
      }

      ctx.strokeStyle = "rgba(" + rgb + ", " + (alpha * 0.5).toFixed(3) + ")";
      ctx.lineWidth = 0.6 + depth * 0.9;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.stroke();
    }

    var sprite = glowSprite(color);
    for (var s = 0; s < pts.length; s++) {
      var pt = pts[s];
      var star = alphaMul;
      if (fresh && fresh[s]) star *= gate;
      var g2 = Math.max(0, (pt.depth - 0.7) * 1.6) * star;
      if (g2 <= 0.004) continue;

      var rad = 1.4 + pt.depth * 2.2;
      var span = rad * 6;

      ctx.globalAlpha = Math.min(1, g2);
      ctx.drawImage(sprite, pt.x - span / 2, pt.y - span / 2, span, span);
      ctx.globalAlpha = 1;

      ctx.fillStyle = "rgba(240, 244, 255, " + Math.min(1, g2).toFixed(3) + ")";
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, rad * 0.55, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function frame(t) {
    if (!markAt) markAt = t;
    var ax = t * 0.00016;
    var ay = t * 0.00023;
    var since = t - markAt;

    // `since` must be re-zeroed alongside markAt. Reading the stale value
    // here made the first frame of every transition render at k=1, which
    // flashed the finished shape before it animated.
    if (mode === "hold") {
      if (since > HOLD) { markAt = t; since = 0; step(); }
    } else if (since > MORPH) {
      markAt = t; since = 0;
      mode = "hold";
      previous = null;
    }

    ctx.clearRect(0, 0, w, h);
    var k = mode === "hold" ? 1 : easeInOut(Math.min(1, since / MORPH));

    if (mode === "morph" && current.birth) {
      // Truncation moves everything on one clock. Stellation splits into
      // draw, then emerge, then rise.
      var staged = current.morphKind === "kis";
      var rise = staged ? smooth01((k - KIS_STAR) / (1 - KIS_STAR)) : k;
      var gate = staged ? smooth01((k - KIS_DRAW) / (KIS_STAR - KIS_DRAW)) : 1;
      var grow = staged ? smooth01(k / KIS_DRAW) : 1;

      var lerped = [];
      for (var i = 0; i < current.verts.length; i++) {
        var a = current.birth[i], b = current.verts[i];
        lerped.push([a[0] + (b[0] - a[0]) * rise,
                     a[1] + (b[1] - a[1]) * rise,
                     a[2] + (b[2] - a[2]) * rise]);
      }
      drawSolid(lerped, current.edges, current.color, ax, ay, 1, 1,
                staged ? current.fresh : null, gate, grow);
    } else if (mode === "bloom") {
      // Square-root crossfade. A plain linear pair dips to half brightness
      // on both solids at the midpoint, which read as a blank beat.
      if (previous) {
        drawSolid(previous.verts, previous.edges, previous.color,
                  ax, ay, Math.sqrt(1 - k), 1 + k * BLOOM_OUT, null, 1, 1);
      }
      drawSolid(current.verts, current.edges, current.color,
                ax, ay, Math.sqrt(k), (1 - BLOOM_IN) + k * BLOOM_IN, null, 1, 1);
    } else {
      drawSolid(current.verts, current.edges, current.color, ax, ay, 1, 1, null, 1, 1);
    }

    requestAnimationFrame(frame);
  }

  window.addEventListener("resize", resize);
  resize();
  requestAnimationFrame(frame);
})();
