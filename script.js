// -------------------------------------------------------
// Wireframe icosahedron, rendered straight to 2D canvas.
// No libraries: the same seed solid the Conway engine starts from.

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
  // Geometry

  var phi = (1 + Math.sqrt(5)) / 2;

  var verts = [
    [0, 1, phi], [0, 1, -phi], [0, -1, phi], [0, -1, -phi],
    [1, phi, 0], [1, -phi, 0], [-1, phi, 0], [-1, -phi, 0],
    [phi, 0, 1], [-phi, 0, 1], [phi, 0, -1], [-phi, 0, -1]
  ];

  // Icosahedron edge length is 2, so edges are the vertex pairs at
  // squared distance 4. Derived rather than hardcoded.
  var edges = [];
  for (var i = 0; i < verts.length; i++) {
    for (var j = i + 1; j < verts.length; j++) {
      var dx = verts[i][0] - verts[j][0];
      var dy = verts[i][1] - verts[j][1];
      var dz = verts[i][2] - verts[j][2];
      var d2 = dx * dx + dy * dy + dz * dz;
      if (Math.abs(d2 - 4) < 0.001) edges.push([i, j]);
    }
  }

  // -------------------------------------------------------
  // Sizing

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // -------------------------------------------------------
  // Render

  function project(v, ax, ay) {
    var cosY = Math.cos(ay), sinY = Math.sin(ay);
    var x1 = v[0] * cosY - v[2] * sinY;
    var z1 = v[0] * sinY + v[2] * cosY;

    var cosX = Math.cos(ax), sinX = Math.sin(ax);
    var y1 = v[1] * cosX - z1 * sinX;
    var z2 = v[1] * sinX + z1 * cosX;

    var scale = Math.min(w, h) * 0.19;
    var persp = 4.6 / (4.6 + z2);

    return {
      x: w * 0.5 + x1 * scale * persp,
      y: h * 0.5 + y1 * scale * persp,
      depth: persp
    };
  }

  function frame(t) {
    var ax = t * 0.00016;
    var ay = t * 0.00023;

    ctx.clearRect(0, 0, w, h);

    var pts = [];
    for (var i = 0; i < verts.length; i++) pts.push(project(verts[i], ax, ay));

    // Edges, dimmed by depth so the far side reads as behind.
    ctx.lineCap = "round";
    for (var e = 0; e < edges.length; e++) {
      var a = pts[edges[e][0]];
      var b = pts[edges[e][1]];
      var depth = (a.depth + b.depth) * 0.5;
      var alpha = Math.max(0, (depth - 0.72) * 1.5);

      ctx.strokeStyle = "rgba(124, 140, 255, " + (alpha * 0.5).toFixed(3) + ")";
      ctx.lineWidth = 0.6 + depth * 0.9;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }

    // Vertex stars.
    for (var p = 0; p < pts.length; p++) {
      var pt = pts[p];
      var g = Math.max(0, (pt.depth - 0.7) * 1.6);
      var r = 1.4 + pt.depth * 2.2;

      var glow = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, r * 5);
      glow.addColorStop(0, "rgba(180, 195, 255, " + (g * 0.75).toFixed(3) + ")");
      glow.addColorStop(1, "rgba(124, 140, 255, 0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, r * 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "rgba(232, 238, 255, " + g.toFixed(3) + ")";
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    requestAnimationFrame(frame);
  }

  window.addEventListener("resize", resize);
  resize();
  requestAnimationFrame(frame);
})();
