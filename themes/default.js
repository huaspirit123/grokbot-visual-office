/* Grokbot Visual Office · default theme "等距云端 / Cloud-top isometric".
 * Every pixel here is drawn procedurally by this file (no external images), Apache-2.0 licensed with the project.
 * To make a new theme, copy this file, keep the same exported functions, and change the drawing.
 * Coordinates: sprites are anchored at the TOP (north) ground corner of their tile footprint. */
(function (PO) {
  var TW = 32, TH = 16, HW = 16, HH = 8, WALL_H = 46, BASE_H = 18;
  var P = {
    skyTop: '#4aa8ff', skyBottom: '#d4f0ff', sun: '#fff6c8', sunCore: '#ffffff',
    cloud: '#ffffff', cloudShade: '#d9ecfb', cloudShade2: '#bcdaf3',
    wood: ['#d39d64', '#c98f58', '#dca972'], woodSeam: '#b37b47',
    stone: '#e8ebf0', stone2: '#eef1f5', stoneSeam: '#d3d9e2',
    meet: '#f1f4f8', meetSeam: '#dde3eb', rug: '#efe4d1', rugEdge: '#d8c4a2', boss: '#f6f8fb',
    wall: '#f8f9fb', wallL: '#eceff4', wallShade: '#dfe4eb', gold: '#e2b24c', goldDark: '#b8862b', goldLight: '#f6d98a',
    glass: '#a8dcff', glassTop: '#d9f1ff', base: '#eef1f6', baseL: '#dbe1ea', baseDark: '#c3ccd8',
    outline: '#5b6679', white: '#ffffff', shade: '#e3e8ef', shade2: '#c9d1dc', visor: '#1d2943',
    screen: '#20304f', glow: '#7fe3ff', red: '#ff3b47'
  };
  var theme = { id: 'default', name: 'Cloud-top isometric', tile: { w: TW, h: TH }, wallH: WALL_H, baseH: BASE_H, palette: P,
    css: { '--accent': '#3a8dde', '--gold': '#c9952d', '--bg': '#eaf6ff', '--panel': 'rgba(255,255,255,.96)', '--ink': '#25324a' } };

  /* ---------- helpers ---------- */
  function mk(w, h, rf) { var c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); var x = c.getContext('2d', rf ? { willReadFrequently: true } : undefined); x.imageSmoothingEnabled = false; return c; }
  function rng(seed) { var s = seed >>> 0 || 1; return function () { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 10000) / 10000; }; }
  function R(c, x, y, w, h, col) { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
  function line(c, x0, y0, x1, y1, col) { // pixel line, no anti-aliasing
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    var dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, e = dx + dy; c.fillStyle = col;
    for (var i = 0; i < 2000; i++) { c.fillRect(x0, y0, 1, 1); if (x0 === x1 && y0 === y1) break; var e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } }
  }
  function poly(c, pts, col) { c.fillStyle = col; c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (var i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]); c.closePath(); c.fill(); }
  /* crisp the edges: alpha -> 0/255, then a 1px outline around the opaque shape */
  function crisp(cv, outline) {
    var c = cv.getContext('2d'), im = c.getImageData(0, 0, cv.width, cv.height), d = im.data, w = cv.width, h = cv.height;
    for (var i = 3; i < d.length; i += 4) d[i] = d[i] < 120 ? 0 : 255;
    if (outline) {
      var o = hex(outline), src = new Uint8Array(w * h); for (var j = 0; j < w * h; j++) src[j] = d[j * 4 + 3] ? 1 : 0;
      for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) { var k = y * w + x; if (src[k]) continue;
        if ((x > 0 && src[k - 1]) || (x < w - 1 && src[k + 1]) || (y > 0 && src[k - w]) || (y < h - 1 && src[k + w])) { d[k * 4] = o[0]; d[k * 4 + 1] = o[1]; d[k * 4 + 2] = o[2]; d[k * 4 + 3] = 255; } }
    }
    c.putImageData(im, 0, 0); return cv;
  }
  function hex(h) { h = h.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
  function mix(a, b, t) { var A = hex(a), B = hex(b); return 'rgb(' + A.map(function (v, i) { return Math.round(v + (B[i] - v) * t); }).join(',') + ')'; }
  function diamond(c, cx, top, col) { c.fillStyle = col; for (var r = 0; r < TH; r++) { var hw = r < HH ? (r + 1) * 2 : (TH - r) * 2; c.fillRect(cx - hw, top + r, hw * 2, 1); } }
  /* iso point inside a sprite: footprint units (x,y), height z px */
  function ptr(ax, ay) { return function (x, y, z) { return [ax + (x - y) * HW, ay + (x + y) * HH - (z || 0)]; }; }
  function box(c, p, x0, y0, x1, y1, z0, z1, top, left, right) {
    poly(c, [p(x0, y1, z0), p(x1, y1, z0), p(x1, y1, z1), p(x0, y1, z1)], left);
    poly(c, [p(x1, y0, z0), p(x1, y1, z0), p(x1, y1, z1), p(x1, y0, z1)], right);
    poly(c, [p(x0, y0, z1), p(x1, y0, z1), p(x1, y1, z1), p(x0, y1, z1)], top);
  }
  function sprite(w, h, z, draw, opt) { // footprint w x h tiles, height z px
    opt = opt || {}; var pad = 3, cw = (w + h) * HW + pad * 2, ch = (w + h) * HH + z + pad * 2;
    var cv = mk(cw, ch, 1), ax = h * HW + pad, ay = z + pad; draw(cv.getContext('2d'), ptr(ax, ay), cv);
    if (!opt.soft) crisp(cv, opt.outline === false ? null : (opt.outline || P.outline));
    return { img: cv, ax: ax, ay: ay };
  }
  theme.helpers = { mk: mk, R: R, line: line, poly: poly, crisp: crisp, diamond: diamond, box: box, sprite: sprite, rng: rng, mix: mix };

  /* ---------- sky (screen/buffer space) ---------- */
  var skyCache = null, clouds = null, towers = null, sunSpr = null;
  function cloudSprite(seed, w) {
    var r = rng(seed), h = Math.round(w * 0.42), cv = mk(w, h, 1), c = cv.getContext('2d'), n = 5 + Math.floor(r() * 4);
    for (var i = 0; i < n; i++) { var bx = w * (0.15 + 0.7 * i / (n - 1)), rad = h * (0.28 + r() * 0.22); c.fillStyle = P.cloud; c.beginPath(); c.arc(bx, h - rad - 2, rad, 0, 7); c.fill(); }
    c.fillRect(w * 0.1, h * 0.62, w * 0.8, h * 0.3);
    crisp(cv);
    var im = c.getImageData(0, 0, w, h), d = im.data, s1 = hex(P.cloudShade), s2 = hex(P.cloudShade2);
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) { var k = (y * w + x) * 4; if (!d[k + 3]) continue;
      var below = y + 3 < h ? d[((y + 3) * w + x) * 4 + 3] : 0, t = y / h;
      var s = (!below || t > 0.82) ? s2 : t > 0.6 && ((x + y) % 2 === 0 || t > 0.7) ? s1 : null; if (s) { d[k] = s[0]; d[k + 1] = s[1]; d[k + 2] = s[2]; } }
    c.putImageData(im, 0, 0); return cv;
  }
  function towerSprite(seed, s) { // a small floating sky island with white spires
    var r = rng(seed), w = Math.round(46 * s), h = Math.round(90 * s), cv = mk(w, h, 1), c = cv.getContext('2d'), mid = w / 2, isl = h * 0.72;
    poly(c, [[w * 0.1, isl], [w * 0.9, isl], [mid + w * 0.12, h - 2], [mid - w * 0.08, h - 6]], '#c7d6e8');
    poly(c, [[w * 0.1, isl], [w * 0.9, isl], [w * 0.8, isl + 4 * s], [w * 0.2, isl + 4 * s]], '#e9f1fa');
    var spires = [[0, 1], [-0.24, 0.62], [0.24, 0.7], [-0.4, 0.38], [0.38, 0.42]];
    spires.forEach(function (sp, i) {
      var cx = mid + sp[0] * w, ht = (isl - 6) * sp[1] * (0.85 + r() * 0.15), bw = (i ? 5 : 7) * s;
      R(c, cx - bw, isl - ht, bw * 2, ht, i % 2 ? '#e4edf8' : '#f3f7fc'); R(c, cx + bw * 0.3, isl - ht, bw * 0.7, ht, '#d3e0ef');
      poly(c, [[cx - bw, isl - ht], [cx + bw, isl - ht], [cx, isl - ht - bw * 3]], '#f7fbff');
      R(c, cx - 0.5, isl - ht - bw * 3 - 3 * s, 1, 3 * s, P.gold);
      for (var y = isl - ht + 4; y < isl - 4; y += 6 * s) R(c, cx - bw * 0.4, y, Math.max(1, bw * 0.5), 2, '#9fcff5');
      R(c, cx - bw, isl - ht + 2, bw * 2, 1, P.goldLight);
    });
    return crisp(cv);
  }
  theme.drawSky = function (c, w, h, t, cam) {
    if (!skyCache || skyCache.width !== w || skyCache.height !== h) {
      skyCache = mk(w, h); var g = skyCache.getContext('2d'), bands = 14;
      for (var y = 0; y < h; y++) { var f = y / h * (bands - 1), b = Math.floor(f), fr = f - b;
        for (var x = 0; x < w; x += 1) { /* 2x2 ordered dither between bands */ }
        var col0 = mix(P.skyTop, P.skyBottom, b / (bands - 1)), col1 = mix(P.skyTop, P.skyBottom, Math.min(1, (b + 1) / (bands - 1)));
        R(g, 0, y, w, 1, col0);
        if (fr > 0.5) { g.fillStyle = col1; for (var xx = (y % 2) * 1; xx < w; xx += 2) g.fillRect(xx, y, 1, 1); }
      }
      if (!clouds) { clouds = []; var r = rng(7); for (var i = 0; i < 9; i++) clouds.push({ img: cloudSprite(11 + i * 7, 40 + Math.floor(r() * 50)), x: r(), y: r(), sp: 2 + r() * 4, par: 0.12 + r() * 0.1 }); }
      if (!towers) { towers = [{ img: towerSprite(3, 1), x: 0.06, y: 0.08 }, { img: towerSprite(5, 0.7), x: 0.2, y: 0.3 }, { img: towerSprite(9, 1.15), x: 0.78, y: 0.1 }, { img: towerSprite(13, 0.8), x: 0.9, y: 0.36 }, { img: towerSprite(17, 0.55), x: 0.62, y: 0.02 }]; }
    }
    c.drawImage(skyCache, 0, 0);
    // sun with pixel rays
    var sx = Math.round(w * 0.86 - cam.x * 0.03), sy = Math.round(Math.min(h * 0.14, 46) - cam.y * 0.03), pulse = Math.sin(t / 900) > 0 ? 1 : 0;
    c.globalAlpha = 0.25; c.fillStyle = P.sun; c.beginPath(); c.arc(sx, sy, 26 + pulse * 2, 0, 7); c.fill();
    c.globalAlpha = 0.45; c.beginPath(); c.arc(sx, sy, 19, 0, 7); c.fill(); c.globalAlpha = 1;
    c.fillStyle = P.sunCore; c.beginPath(); c.arc(sx, sy, 13, 0, 7); c.fill();
    for (var k = 0; k < 8; k++) { var a = k / 8 * Math.PI * 2 + t / 6000, r0 = 31, r1 = 37 + (k % 2) * 5; line(c, sx + Math.cos(a) * r0, sy + Math.sin(a) * r0, sx + Math.cos(a) * r1, sy + Math.sin(a) * r1, '#fffbe0'); }
    towers.forEach(function (tw) { c.drawImage(tw.img, Math.round(tw.x * w - tw.img.width / 2 - cam.x * 0.06), Math.round(tw.y * h + Math.sin(t / 3000 + tw.x * 9) * 2 - cam.y * 0.06)); });
    clouds.forEach(function (cl) { var span = w + cl.img.width * 2, x = ((cl.x * span + t / 1000 * cl.sp - cam.x * cl.par) % span + span) % span - cl.img.width;
      c.drawImage(cl.img, Math.round(x), Math.round(cl.y * h * 0.9 - cam.y * cl.par)); });
  };
  /* clouds drifting in front of the platform's underside */
  var fg = null;
  theme.drawForeground = function (c, t, world) {
    if (!fg) { fg = []; var r = rng(99); for (var i = 0; i < 6; i++) fg.push({ img: cloudSprite(200 + i * 13, 70 + Math.floor(r() * 60)), x: r(), y: 0.86 + r() * 0.1, sp: 1.5 + r() * 2 }); }
    fg.forEach(function (cl) { var span = world.w + cl.img.width, x = ((cl.x * span + t / 1000 * cl.sp) % span + span) % span - cl.img.width / 2;
      c.globalAlpha = 0.92; c.drawImage(cl.img, Math.round(x), Math.round(world.h * cl.y - cl.img.height / 2)); c.globalAlpha = 1; });
  };

  /* ---------- static layer: floor, walls, platform ---------- */
  theme.buildStatic = function (L, iso, W, H) {
    var cv = mk(W, H), c = cv.getContext('2d'), F = function (x, y) { return x < 0 || y < 0 || x >= L.cols || y >= L.rows ? '.' : L.floor[y][x]; };
    // support columns under the platform
    var front = iso.toWorld(L.cols, L.rows), left = iso.toWorld(0, L.rows), right = iso.toWorld(L.cols, 0);
    [[0.3, 0.5], [0.5, 0.5], [0.7, 0.5]].forEach(function (f, i) {
      var bx = Math.round(left.x + (right.x - left.x) * f[0]), by = Math.round(left.y + (front.y - left.y) * 0.5 + (i === 1 ? 46 : 26));
      var hgt = i === 1 ? 70 : 46, top = by - 60;
      R(c, bx - 9, top, 18, hgt + 40, P.base); R(c, bx + 3, top, 6, hgt + 40, P.baseL); R(c, bx - 9, top + hgt, 18, 2, P.gold); R(c, bx - 9, top + 14, 18, 1, P.goldLight);
    });
    // platform sides (front edges)
    for (var y = 0; y < L.rows; y++) for (var x = 0; x < L.cols; x++) {
      if (F(x, y) === '.') continue;
      if (F(x + 1, y) === '.') { var E = iso.toWorld(x + 1, y); for (var i = 0; i < HW; i++) { var px = E.x - i - 1, py = E.y + Math.floor(i / 2) + 1;
        R(c, px, py, 1, BASE_H, P.base); R(c, px, py, 1, 2, P.gold); R(c, px, py + BASE_H - 6, 1, 6, P.baseL); R(c, px, py + BASE_H - 1, 1, 1, P.baseDark); if ((x + i) % 8 === 0) R(c, px, py + 3, 1, BASE_H - 8, P.baseL); } }
      if (F(x, y + 1) === '.') { var Wp = iso.toWorld(x, y + 1); for (var j = 0; j < HW; j++) { var qx = Wp.x + j, qy = Wp.y + Math.floor(j / 2) + 1;
        R(c, qx, qy, 1, BASE_H, P.baseL); R(c, qx, qy, 1, 2, P.goldDark); R(c, qx, qy + BASE_H - 6, 1, 6, P.baseDark); R(c, qx, qy + BASE_H - 1, 1, 1, '#aab5c4'); if ((y + j) % 8 === 0) R(c, qx, qy + 3, 1, BASE_H - 8, P.base); } }
    }
    // floor tiles
    for (y = 0; y < L.rows; y++) for (x = 0; x < L.cols; x++) {
      var f = F(x, y); if (f === '.') continue; var N = iso.toWorld(x, y), top = N.y, cx = N.x;
      if (f === 'w') { diamond(c, cx, top, P.wood[(x * 7 + y * 3) % 3 === 0 ? 2 : 0]);
        for (var k = 1; k < 4; k++) { var a = iso.toWorld(x, y + k / 4), b = iso.toWorld(x + 1, y + k / 4); line(c, a.x + 1, a.y, b.x - 1, b.y, k === 2 ? P.woodSeam : P.wood[1]); }
        var s0 = iso.toWorld(x + ((x * 13 + y * 5) % 3 + 1) / 4, y); line(c, s0.x, s0.y + 1, s0.x - 3, s0.y + 2, P.woodSeam);
      } else if (f === 's' || f === 'b') { diamond(c, cx, top, f === 'b' ? P.boss : (x + y) % 2 ? P.stone : P.stone2);
        var n1 = iso.toWorld(x, y + 1), e1 = iso.toWorld(x + 1, y); line(c, n1.x, n1.y, cx, top, P.stoneSeam); line(c, cx, top, e1.x - 1, e1.y, P.stoneSeam);
      } else if (f === 'm') { diamond(c, cx, top, P.meet); var w1 = iso.toWorld(x, y + 1); line(c, w1.x, w1.y, cx, top, P.meetSeam); line(c, cx, top, cx + HW - 1, top + HH - 1, P.meetSeam);
      } else if (f === 'r') { diamond(c, cx, top, P.rug);
        var edge = function (dx, dy) { return F(x + dx, y + dy) !== 'r'; };
        if (edge(0, -1)) line(c, cx, top + 1, cx + HW - 2, top + HH, P.rugEdge); if (edge(-1, 0)) line(c, cx, top + 1, cx - HW + 2, top + HH, P.rugEdge);
        if (edge(1, 0)) line(c, cx + HW - 2, top + HH, cx, top + TH - 2, P.rugEdge); if (edge(0, 1)) line(c, cx - HW + 2, top + HH, cx, top + TH - 2, P.rugEdge);
        if ((x + y) % 2 === 0) R(c, cx - 1, top + HH - 1, 2, 2, P.rugEdge);
      }
      // gold rim on the platform edge
      if (F(x + 1, y) === '.') line(c, cx + HW - 1, top + HH - 1, cx, top + TH - 1, P.gold);
      if (F(x, y + 1) === '.') line(c, cx - HW, top + HH, cx - 1, top + TH - 1, P.gold);
    }
    // boss platform rings
    var bt = L.zones.boss.tiles, mx = 0, my = 0; bt.forEach(function (p) { mx += p[0] + 0.5; my += p[1] + 0.5; }); mx /= bt.length; my /= bt.length;
    var C = iso.toWorld(mx, my); theme._bossCenter = C;
    ring(c, C.x, C.y, 2.1, P.gold); ring(c, C.x, C.y, 1.95, P.goldLight); ring(c, C.x, C.y, 1.45, P.glow); ring(c, C.x, C.y, 1.38, '#c9f5ff');
    // back walls
    if (L.walls.back_y) for (x = 0; x < L.cols; x++) { if (F(x, 0) === '.') continue; wallSeg(c, iso, x, 'y', inRange(x, L.walls.windows_y0), x % 4 === 0); }
    if (L.walls.back_x) for (y = 0; y < L.rows; y++) { if (F(0, y) === '.') continue; wallSeg(c, iso, y, 'x', inRange(y, L.walls.windows_x0), y % 4 === 0, L.walls.painting_x0); }
    var O = iso.toWorld(0, 0); R(c, O.x - 3, O.y - WALL_H - 3, 6, WALL_H + 3, P.wall); R(c, O.x - 3, O.y - WALL_H - 4, 6, 3, P.gold); R(c, O.x + 1, O.y - WALL_H, 2, WALL_H, P.wallShade);
    return cv;
  };
  function inRange(v, rs) { return (rs || []).some(function (r) { return v >= r[0] && v <= r[1]; }); }
  function ring(c, x, y, rad, col) { c.fillStyle = col; for (var a = 0; a < 360; a += 1.2) { var r = a * Math.PI / 180; c.fillRect(Math.round(x + Math.cos(r) * rad * HW * 1.414 / 1.0), Math.round(y + Math.sin(r) * rad * HH * 1.414), 1, 1); } }
  function wallSeg(c, iso, i, axis, win, pillar, painting) {
    // axis 'y': wall on the y=0 edge (back-right); 'x': wall on the x=0 edge (back-left)
    var N = axis === 'y' ? iso.toWorld(i, 0) : iso.toWorld(0, i), dir = axis === 'y' ? 1 : -1, base = axis === 'y' ? P.wall : P.wallL;
    for (var k = 0; k < HW; k++) {
      var x = N.x + dir * k + (dir < 0 ? -1 : 0), yb = N.y + Math.floor(k / 2), yt = yb - WALL_H;
      R(c, x, yt, 1, WALL_H, base); R(c, x, yt - 3, 1, 3, P.white); R(c, x, yt - 1, 1, 2, P.gold); R(c, x, yb - 3, 1, 3, P.gold); R(c, x, yb - 4, 1, 1, P.goldLight);
      if (win && k > 1 && k < HW - 1) { // floor-to-ceiling glass with sky + highlights
        var gy = yt + 5, gh = WALL_H - 10;
        for (var r = 0; r < gh; r++) R(c, x, gy + r, 1, 1, r < gh * 0.35 ? P.glassTop : r < gh * 0.7 ? '#c2e7ff' : P.glass);
        if ((k + i * 3) % 11 < 2) R(c, x, gy + 3 + (k % 5), 1, gh - 14, '#f4fbff');
        if (k === 2 || k === HW - 2) R(c, x, gy, 1, gh, P.goldLight);
      }
      if (painting && axis === 'x' && i >= painting[0] && i <= painting[1] && k > 2 && k < HW - 2) {
        var py = yt + 12; R(c, x, py, 1, 16, P.gold); var mid = (i - painting[0]) * HW + k;
        if (mid > 3 && mid < (painting[1] - painting[0] + 1) * HW - 3) { R(c, x, py + 1, 1, 9, '#bfe4ff'); R(c, x, py + 10 - Math.round(3 + 2 * Math.sin(mid / 4)), 1, Math.round(3 + 2 * Math.sin(mid / 4)) + 4, '#8fcf7a'); R(c, x, py + 13, 1, 2, '#6fb565'); }
      }
      if (pillar && k < 3) { R(c, x, yt - 3, 1, WALL_H + 3, k === 1 ? P.white : P.shade); R(c, x, yt - 4, 1, 3, P.gold); }
      if (axis === 'x' && !win && !painting) {}
    }
  }

  /* ---------- furniture sprites ---------- */
  var SPR = {};
  theme.sprites = function (o) {
    var key = o.type + '|' + (o.w || 1) + 'x' + (o.h || 1) + '|' + (o.axis || '') + '|' + (o.v || 0) + '|' + (o.face ? o.face.join(',') : '');
    if (SPR[key]) return SPR[key];
    var f = MAKERS[o.type]; return (SPR[key] = f ? f(o) : []);
  };
  function backSide(face) { return face ? [-face[0], -face[1]] : [0, 0]; }
  var MAKERS = {
    desk: function () {
      var s = sprite(1, 1, 30, function (c, p) {
        box(c, p, 0.08, 0.06, 0.88, 0.94, 0, 12, P.white, P.shade, P.shade2);
        poly(c, [p(0.08, 0.94, 12), p(0.88, 0.94, 12), p(0.88, 0.94, 11), p(0.08, 0.94, 11)], P.gold);
        poly(c, [p(0.88, 0.06, 12), p(0.88, 0.94, 12), p(0.88, 0.94, 11), p(0.88, 0.06, 11)], P.gold);
        box(c, p, 0.12, 0.1, 0.4, 0.5, 2, 11, P.shade, '#d6dde7', '#c5cedb'); // drawer
        // monitor facing +x
        box(c, p, 0.28, 0.38, 0.36, 0.62, 12, 14, P.shade2, P.shade2, P.shade2);
        poly(c, [p(0.32, 0.12, 15), p(0.32, 0.88, 15), p(0.32, 0.88, 29), p(0.32, 0.12, 29)], P.white);
        poly(c, [p(0.34, 0.16, 16.5), p(0.34, 0.84, 16.5), p(0.34, 0.84, 27.5), p(0.34, 0.16, 27.5)], P.screen);
        for (var k = 0; k < 4; k++) { var a = p(0.35, 0.22, 25 - k * 2.6), b = p(0.35, 0.22 + 0.12 + ((k * 37) % 5) * 0.08, 25 - k * 2.6); line(theme._c = c, a[0], a[1], b[0], b[1], k % 2 ? '#8fe3ff' : '#ffd77a'); }
        poly(c, [p(0.52, 0.3, 12.5), p(0.7, 0.3, 12.5), p(0.7, 0.72, 12.5), p(0.52, 0.72, 12.5)], '#dfe5ee'); // keyboard
        poly(c, [p(0.6, 0.78, 12.5), p(0.7, 0.78, 12.5), p(0.7, 0.86, 12.5), p(0.6, 0.86, 12.5)], P.white);
      });
      s.screen = { x: 0.34, y: 0.5, z: 22 }; return [s];
    },
    chair: function (o) {
      var bk = backSide(o.face || [-1, 0]);
      var seat = sprite(1, 1, 22, function (c, p) {
        box(c, p, 0.46, 0.46, 0.54, 0.54, 0, 6, '#8a94a6', '#8a94a6', '#6f7a8c');
        poly(c, [p(0.3, 0.3, 1), p(0.7, 0.3, 1), p(0.7, 0.7, 1), p(0.3, 0.7, 1)], '#7d8798');
        box(c, p, 0.24, 0.24, 0.76, 0.76, 6, 9, '#5f6b80', '#4f5a6d', '#465063');
      });
      var x0 = 0.24, x1 = 0.76, y0 = 0.24, y1 = 0.76;
      if (bk[0] > 0) { x0 = 0.7; x1 = 0.8; } else if (bk[0] < 0) { x0 = 0.2; x1 = 0.3; } else if (bk[1] > 0) { y0 = 0.7; y1 = 0.8; } else { y0 = 0.2; y1 = 0.3; }
      var back = sprite(1, 1, 24, function (c, p) { box(c, p, x0, y0, x1, y1, 8, 21, '#6b778c', '#556075', '#4b5568'); poly(c, [p(x0, y1, 21), p(x1, y1, 21), p(x1, y1, 20), p(x0, y1, 20)], P.gold); });
      var front = bk[0] + bk[1] > 0; // backrest on the camera side -> drawn over the sitter
      seat.bias = -0.4; back.bias = front ? 0.35 : -0.35; return [seat, back];
    },
    boss_desk: function (o) {
      var s = sprite(o.w || 1, o.h || 3, 20, function (c, p) {
        box(c, p, 0.1, 0.05, 0.85, 2.95, 0, 14, P.white, P.shade, P.shade2);
        poly(c, [p(0.1, 2.95, 14), p(0.85, 2.95, 14), p(0.85, 2.95, 12), p(0.1, 2.95, 12)], P.gold);
        poly(c, [p(0.85, 0.05, 14), p(0.85, 2.95, 14), p(0.85, 2.95, 12), p(0.85, 0.05, 12)], P.gold);
        poly(c, [p(0.85, 0.05, 7), p(0.85, 2.95, 7), p(0.85, 2.95, 6), p(0.85, 0.05, 6)], P.glow);
        // low command console: a glowing glass slab tilted toward the boss (no tall monitors, so the boss stays visible)
        poly(c, [p(0.2, 0.4, 15), p(0.5, 0.4, 17), p(0.5, 2.6, 17), p(0.2, 2.6, 15)], '#bfeaff');
        poly(c, [p(0.24, 0.6, 15.5), p(0.46, 0.6, 16.6), p(0.46, 1.4, 16.6), p(0.24, 1.4, 15.5)], '#8fd8ff');
        poly(c, [p(0.24, 1.6, 15.5), p(0.46, 1.6, 16.6), p(0.46, 2.4, 16.6), p(0.24, 2.4, 15.5)], '#8fd8ff');
        var e = p(0.85, 1.5, 9); R(c, e[0] - 2, e[1] - 2, 4, 4, P.gold); R(c, e[0] - 1, e[1] - 1, 2, 2, P.goldLight);
      });
      return [s];
    },
    meeting_table: function (o) {
      return [sprite(o.w || 3, o.h || 2, 20, function (c, p) {
        box(c, p, 1.3, 0.8, 1.7, 1.2, 0, 9, P.shade2, P.shade2, '#b9c3d1');
        box(c, p, 0.15, 0.15, 2.85, 1.85, 9, 12, P.white, P.shade, P.shade2);
        poly(c, [p(0.15, 1.85, 12), p(2.85, 1.85, 12), p(2.85, 1.85, 11), p(0.15, 1.85, 11)], P.gold);
        poly(c, [p(2.85, 0.15, 12), p(2.85, 1.85, 12), p(2.85, 1.85, 11), p(2.85, 0.15, 11)], P.gold);
        poly(c, [p(1.1, 0.75, 12.5), p(1.9, 0.75, 12.5), p(1.9, 1.25, 12.5), p(1.1, 1.25, 12.5)], '#cfeefe');
        [[0.6, 0.5], [2.3, 1.4], [0.7, 1.4]].forEach(function (q) { var a = p(q[0], q[1], 13); R(c, a[0] - 2, a[1] - 1, 4, 2, '#dfe5ee'); });
      })];
    },
    bookshelf: function (o) {
      return [sprite(o.w || 2, o.h || 1, 44, function (c, p) {
        box(c, p, 0, 0.05, 2, 0.6, 0, 42, '#c98f58', '#b57a45', '#a36b3a');
        var r = rng(42), cols = ['#ff6a6a', '#4f9dff', '#ffd25a', '#46c49a', '#c08bff', '#ffffff', '#ff9f5a', '#2f4a7a'];
        for (var sh = 0; sh < 4; sh++) { var z0 = 3 + sh * 10; poly(c, [p(0.05, 0.6, z0), p(1.95, 0.6, z0), p(1.95, 0.6, z0 + 1), p(0.05, 0.6, z0 + 1)], P.goldDark);
          var x = 0.08; while (x < 1.9) { var bw = 0.06 + r() * 0.05, bh = 5 + Math.floor(r() * 4), col = cols[Math.floor(r() * cols.length)];
            if (r() < 0.12) { x += 0.12; continue; }
            poly(c, [p(x, 0.6, z0 + 1), p(x + bw, 0.6, z0 + 1), p(x + bw, 0.6, z0 + 1 + bh), p(x, 0.6, z0 + 1 + bh)], col); x += bw + 0.01; } }
        poly(c, [p(0, 0.6, 42), p(2, 0.6, 42), p(2, 0.6, 40), p(0, 0.6, 40)], P.gold);
      })];
    },
    coffee_bar: function (o) {
      return [sprite(o.w || 1, o.h || 3, 34, function (c, p) {
        box(c, p, 0.1, 0.05, 0.9, 2.95, 0, 15, P.white, '#c98f58', '#b57a45');
        for (var k = 1; k < 6; k++) { var a = p(0.9, k * 0.5, 2), b = p(0.9, k * 0.5, 13); line(c, a[0], a[1], b[0], b[1], '#a36b3a'); }
        poly(c, [p(0.1, 0.05, 15), p(0.9, 0.05, 15), p(0.9, 2.95, 15), p(0.1, 2.95, 15)], P.white);
        poly(c, [p(0.9, 0.05, 15), p(0.9, 2.95, 15), p(0.9, 2.95, 14), p(0.9, 0.05, 14)], P.gold);
        poly(c, [p(0.1, 2.95, 15), p(0.9, 2.95, 15), p(0.9, 2.95, 14), p(0.1, 2.95, 14)], P.gold);
        // espresso machine facing +y
        box(c, p, 0.2, 2.1, 0.8, 2.75, 15, 31, '#c3ccd8', '#9aa6b6', '#8794a6');
        poly(c, [p(0.3, 2.75, 27), p(0.7, 2.75, 27), p(0.7, 2.75, 22), p(0.3, 2.75, 22)], '#2a3448');
        var d = p(0.5, 2.75, 21); R(c, d[0] - 1, d[1], 3, 2, P.white); R(c, d[0] - 4, d[1] - 9, 2, 2, '#ff6a6a'); R(c, d[0] + 3, d[1] - 9, 2, 2, '#46c49a');
        // jars + cups
        [0.5, 0.9, 1.3].forEach(function (y, i) { box(c, p, 0.3, y, 0.5, y + 0.2, 15, 21 + i, '#f7e6c8', '#e3c79a', '#d3b383'); });
        box(c, p, 0.55, 1.6, 0.7, 1.75, 15, 19, P.white, P.shade, P.shade2);
      })];
    },
    stool: function () {
      return [sprite(1, 1, 16, function (c, p) { box(c, p, 0.46, 0.46, 0.54, 0.54, 0, 9, P.gold, P.gold, P.goldDark); poly(c, [p(0.3, 0.3, 1), p(0.7, 0.3, 1), p(0.7, 0.7, 1), p(0.3, 0.7, 1)], P.goldDark);
        box(c, p, 0.28, 0.28, 0.72, 0.72, 9, 12, P.white, P.shade, P.shade2); })].map(function (s) { s.bias = -0.4; return s; });
    },
    arcade: function () {
      var s = sprite(1, 1, 40, function (c, p) {
        box(c, p, 0.15, 0.15, 0.85, 0.75, 0, 38, P.white, '#efe9ff', '#d9cff7');
        poly(c, [p(0.2, 0.75, 34), p(0.8, 0.75, 34), p(0.8, 0.75, 22), p(0.2, 0.75, 22)], '#1c2240');
        for (var k = 0; k < 5; k++) { var a = p(0.26 + k * 0.1, 0.75, 31 - (k % 3) * 2); R(c, a[0], a[1], 2, 2, ['#ff6a6a', '#ffd25a', '#4f9dff', '#46c49a', '#c08bff'][k]); }
        box(c, p, 0.2, 0.75, 0.8, 0.95, 16, 20, '#e9e2ff', '#cdbff5', '#b9a8ee');
        var j = p(0.4, 0.85, 20); R(c, j[0], j[1] - 3, 1, 3, P.outline); R(c, j[0] - 1, j[1] - 4, 3, 2, '#ff3b47'); var b = p(0.65, 0.85, 20); R(c, b[0], b[1] - 1, 2, 1, '#4f9dff');
        poly(c, [p(0.15, 0.75, 38), p(0.85, 0.75, 38), p(0.85, 0.75, 35), p(0.15, 0.75, 35)], '#c08bff');
        poly(c, [p(0.85, 0.15, 38), p(0.85, 0.75, 38), p(0.85, 0.75, 37), p(0.85, 0.15, 37)], P.gold);
      });
      s.screen = { x: 0.5, y: 0.76, z: 28 }; return [s];
    },
    armchair: function (o) {
      var bk = backSide(o.face || [1, 0]);
      return [sprite(1, 1, 22, function (c, p) {
        box(c, p, 0.15, 0.15, 0.85, 0.85, 0, 8, '#fbf6ee', '#eadfcd', '#dccfb9');
        var x0 = 0.15, x1 = 0.85, y0 = 0.15, y1 = 0.85;
        if (bk[0] > 0) x0 = 0.68; else if (bk[0] < 0) x1 = 0.32; else if (bk[1] > 0) y0 = 0.68; else y1 = 0.32;
        box(c, p, x0, y0, x1, y1, 8, 18, '#fbf6ee', '#eadfcd', '#dccfb9');
        poly(c, [p(0.15, 0.85, 1), p(0.85, 0.85, 1), p(0.85, 0.85, 0), p(0.15, 0.85, 0)], P.gold);
      })].map(function (s) { s.bias = bk[0] + bk[1] > 0 ? 0.35 : -0.35; return s; });
    },
    side_table: function () {
      return [sprite(1, 1, 22, function (c, p) { box(c, p, 0.45, 0.45, 0.55, 0.55, 0, 8, P.gold, P.gold, P.goldDark); box(c, p, 0.25, 0.25, 0.75, 0.75, 8, 10, P.white, P.shade, P.gold);
        box(c, p, 0.42, 0.42, 0.58, 0.58, 10, 14, P.white, P.shade, P.shade2); var t = p(0.5, 0.5, 15); R(c, t[0] - 2, t[1] - 3, 4, 3, '#58b368'); R(c, t[0] - 1, t[1] - 5, 2, 2, '#7cd17e'); })];
    },
    pod: function () {
      var base = sprite(1, 1, 14, function (c, p) {
        box(c, p, 0.08, 0.08, 0.92, 0.92, 0, 6, P.white, P.shade, P.shade2);
        poly(c, [p(0.08, 0.92, 3), p(0.92, 0.92, 3), p(0.92, 0.92, 2), p(0.08, 0.92, 2)], P.glow);
        poly(c, [p(0.92, 0.08, 3), p(0.92, 0.92, 3), p(0.92, 0.92, 2), p(0.92, 0.08, 2)], P.glow);
        poly(c, [p(0.2, 0.2, 6.5), p(0.8, 0.2, 6.5), p(0.8, 0.8, 6.5), p(0.2, 0.8, 6.5)], '#dbeaff');
      });
      base.bias = -0.45;
      var dome = sprite(1, 1, 34, function (c, p) {
        var ctr = p(0.5, 0.5, 6), w = 13, h = 26;
        c.fillStyle = 'rgba(180,228,255,0.30)'; c.beginPath(); c.ellipse(ctr[0], ctr[1] - h * 0.48, w, h * 0.55, 0, Math.PI, 0); c.lineTo(ctr[0] + w, ctr[1]); c.lineTo(ctr[0] - w, ctr[1]); c.fill();
        c.fillStyle = 'rgba(255,255,255,0.75)'; c.fillRect(Math.round(ctr[0] - w + 4), Math.round(ctr[1] - h * 0.55), 2, 10); c.fillRect(Math.round(ctr[0] - w + 3), Math.round(ctr[1] - h * 0.55 + 12), 1, 4);
        line(c, ctr[0] - w, ctr[1], ctr[0] + w, ctr[1], P.gold); line(c, ctr[0] - w, ctr[1] - 1, ctr[0] + w, ctr[1] - 1, P.goldLight);
        c.fillStyle = 'rgba(120,150,190,0.55)'; c.beginPath(); c.ellipse(ctr[0], ctr[1] - h * 0.48, w, h * 0.55, 0, Math.PI, 0); c.lineWidth = 1; c.strokeStyle = 'rgba(110,140,180,0.7)'; c.stroke();
      }, { soft: true });
      dome.bias = 0.45; return [base, dome];
    },
    plant: function (o) {
      var v = o.v || 0;
      return [sprite(1, 1, 40, function (c, p) {
        box(c, p, 0.3, 0.3, 0.7, 0.7, 0, 9, P.white, P.shade, P.shade2); poly(c, [p(0.3, 0.7, 7), p(0.7, 0.7, 7), p(0.7, 0.7, 6), p(0.3, 0.7, 6)], P.gold);
        poly(c, [p(0.7, 0.3, 7), p(0.7, 0.7, 7), p(0.7, 0.7, 6), p(0.7, 0.3, 6)], P.gold);
        var t = p(0.5, 0.5, 9), r = rng(5 + v * 17), G = ['#3f9e57', '#58b86a', '#7fd27f', '#2f7f49'];
        if (v === 0) { for (var i = 0; i < 26; i++) { var a = r() * 6.28, d = r() * 9; R(c, t[0] + Math.cos(a) * d * 1.1 - 2, t[1] - 13 + Math.sin(a) * d - 2, 4, 3, G[i % 4]); } }
        else if (v === 1) { R(c, t[0], t[1] - 24, 1, 24, '#8a6a3c'); for (var j = 0; j < 7; j++) { var aa = -Math.PI / 2 + (j - 3) * 0.45; for (var s = 2; s < 12; s++) R(c, t[0] + Math.cos(aa) * s, t[1] - 24 + Math.sin(aa) * s * 0.7 + s * s * 0.05, 2, 2, G[(j + s) % 3]); } }
        else { for (var q = 0; q < 6; q++) { var b = -Math.PI / 2 + (q - 2.5) * 0.5, L = 9 + r() * 6, ex = t[0] + Math.cos(b) * L, ey = t[1] - 4 + Math.sin(b) * L; line(c, t[0], t[1] - 2, ex, ey, '#2f7f49'); c.fillStyle = G[q % 3]; c.beginPath(); c.ellipse(ex, ey, 4, 3, b, 0, 7); c.fill(); } }
      })];
    },
    glass: function (o) {
      var ax = o.axis || 'y';
      var s = sprite(1, 1, 40, function (c, p) {
        var A = ax === 'y' ? [p(0.5, 0, 0), p(0.5, 1, 0)] : [p(0, 0.5, 0), p(1, 0.5, 0)], Hh = 36;
        c.fillStyle = 'rgba(190,232,255,0.32)'; c.beginPath(); c.moveTo(A[0][0], A[0][1]); c.lineTo(A[1][0], A[1][1]); c.lineTo(A[1][0], A[1][1] - Hh); c.lineTo(A[0][0], A[0][1] - Hh); c.closePath(); c.fill();
        line(c, A[0][0], A[0][1] - Hh, A[1][0], A[1][1] - Hh, P.gold); line(c, A[0][0], A[0][1] - 1, A[1][0], A[1][1] - 1, P.goldDark);
        R(c, A[0][0], A[0][1] - Hh, 1, Hh, P.goldLight);
        c.fillStyle = 'rgba(255,255,255,0.7)'; var m = [(A[0][0] * 0.6 + A[1][0] * 0.4), (A[0][1] * 0.6 + A[1][1] * 0.4)]; for (var k = 0; k < 10; k++) c.fillRect(Math.round(m[0] + k * 0.5), Math.round(m[1] - 8 - k * 2), 1, 2);
      }, { soft: true });
      s.bias = 0.1; return [s];
    }
  };

  /* ---------- characters (drawn directly with rects; anchor = feet centre) ---------- */
  var HAIR = ['#3b2a20', '#6b4a2e', '#1f1f28', '#c98a3a', '#8c4a2f'];
  theme.drawCharacter = function (c, X, Y, s) {
    X = Math.round(X); Y = Math.round(Y);
    var fl = s.flip ? -1 : 1, A = s.color || '#4f9dff', O = P.outline;
    function r(x, y, w, h, col) { c.fillStyle = col; c.fillRect(fl > 0 ? X + x : X - x - w, Y + y, w, h); }
    var sit = s.pose === 'sit' || s.pose === 'sleep', bob = s.pose === 'walk' ? (s.frame % 2) : (s.act === 'cheer' ? -Math.abs(Math.round(Math.sin(s.t / 120) * 3)) : 0);
    var dy = (sit ? 4 : 0) + bob, back = s.back, human = s.kind === 'human';
    // shadow
    c.fillStyle = 'rgba(40,70,110,0.18)'; c.fillRect(X - 5, Y - 1, 10, 2); c.fillRect(X - 4, Y, 8, 1);
    // legs
    if (!sit) { var l1 = s.pose === 'walk' && s.frame % 2 ? 1 : 0, l2 = s.pose === 'walk' && !(s.frame % 2) ? 1 : 0;
      r(-4, -6 + dy, 3, 6 - l1, O); r(1, -6 + dy, 3, 6 - l2, O); r(-3, -6 + dy, 1, 5 - l1, human ? '#4a5368' : P.white); r(2, -6 + dy, 1, 5 - l2, human ? '#4a5368' : P.white); }
    else { r(-4, -6 + dy - 1, 8, 3, O); r(-3, -6 + dy - 1, 6, 2, human ? '#4a5368' : P.shade); }
    // body
    var body = human ? A : P.white;
    r(-5, -14 + dy, 10, 9, O); r(-4, -13 + dy, 8, 7, body); r(-4, -7 + dy, 8, 1, human ? mix(A, '#000000', 0.2) : P.shade);
    if (!human && !back) { r(-1, -11 + dy, 2, 2, A); if (s.boss) { r(-3, -13 + dy, 1, 3, P.gold); r(2, -13 + dy, 1, 3, P.gold); } }
    if (human && !back) r(-1, -13 + dy, 2, 2, P.white);
    if (back && !human) r(-2, -12 + dy, 4, 4, P.shade);
    // arms
    var t = s.t || 0, armL = 5, armR = 5, upR = false, upL = false;
    if (s.act === 'type') { armL = 3 + (Math.floor(t / 140) % 2); armR = 3 + (Math.floor(t / 140 + 1) % 2); }
    if (s.act === 'play') { armL = 3 + (Math.floor(t / 90) % 2); armR = 3 + (Math.floor(t / 110) % 2); }
    if (s.act === 'hand' && Math.floor(t / 1600) % 3 !== 2) upR = true;
    if (s.act === 'cheer') { upR = upL = true; }
    if (s.act === 'talk') armR = 4 + (Math.floor(t / 400) % 2);
    var skin = human ? '#f2c9a5' : P.shade;
    if (upL) { r(-7, -21 + dy, 3, 9, O); r(-6, -20 + dy, 1, 7, skin); } else { r(-7, -13 + dy, 3, armL + 1, O); r(-6, -12 + dy, 1, armL - 1, human ? A : P.shade); r(-6, -13 + dy + armL - 1, 1, 1, skin); }
    if (upR) { r(4, -21 + dy, 3, 9, O); r(5, -20 + dy, 1, 7, skin); } else { r(4, -13 + dy, 3, armR + 1, O); r(5, -12 + dy, 1, armR - 1, human ? A : P.shade); r(5, -13 + dy + armR - 1, 1, 1, skin); }
    if (s.act === 'cup') { r(-9, -10 + dy, 4, 4, O); r(-8, -9 + dy, 2, 2, P.white); r(-8, -10 + dy, 2, 1, '#8a5a35');
      if (Math.floor(t / 500) % 2) { r(-8, -13 + dy, 1, 1, '#ffffff'); r(-7, -15 + dy, 1, 1, '#ffffff'); } }
    if (s.act === 'read') { r(-4, -11 + dy, 8, 5, O); r(-3, -10 + dy, 3, 3, '#ffffff'); r(0, -10 + dy, 3, 3, '#f4f0e6'); }
    // head
    var hy = -24 + dy;
    if (human) {
      var hair = HAIR[s.hair % HAIR.length];
      r(-5, hy, 10, 10, O); r(-4, hy + 1, 8, 8, '#f2c9a5'); r(-5, hy - 1, 10, 4, hair); r(-5, hy + 2, 1, 4, hair); r(4, hy + 2, 1, 4, hair);
      if (back) r(-4, hy + 1, 8, 7, hair);
      else { var blink = Math.floor(t / 2900) % 7 === 0; r(-3, hy + 5, 1, blink ? 1 : 2, '#2a2230'); r(2, hy + 5, 1, blink ? 1 : 2, '#2a2230'); r(-1, hy + 8, 2, 1, '#d98f7a'); if (s.pose === 'sleep') { r(-3, hy + 5, 2, 1, '#2a2230'); r(2, hy + 5, 2, 1, '#2a2230'); } }
    } else {
      r(-7, hy, 14, 11, O); r(-6, hy + 1, 12, 9, P.white); r(-6, hy + 9, 12, 1, P.shade); r(-6, hy + 1, 2, 2, '#ffffff');
      if (!back) {
        r(-5, hy + 3, 10, 5, P.visor);
        var sleep = s.pose === 'sleep', bl = Math.floor(t / 3100) % 6 === 0;
        if (sleep) { r(-4, hy + 6, 3, 1, A); r(1, hy + 6, 3, 1, A); }
        else if (s.act === 'stuck') { r(-4, hy + 4, 1, 1, A); r(-2, hy + 6, 1, 1, A); r(-3, hy + 5, 1, 1, A); r(1, hy + 4, 1, 1, A); r(3, hy + 6, 1, 1, A); r(2, hy + 5, 1, 1, A); }
        else { r(-3, hy + 4, 2, bl ? 1 : 3, A); r(1, hy + 4, 2, bl ? 1 : 3, A); r(-3, hy + 4, 1, 1, '#ffffff'); r(1, hy + 4, 1, 1, '#ffffff'); }
      } else { r(0, hy + 2, 1, 7, P.shade); r(-2, hy + 5, 1, 2, A); }
      if (s.style % 2 === 0) { // headphones
        r(-6, hy - 2, 12, 2, O); r(-5, hy - 1, 10, 1, A); r(-9, hy + 3, 3, 6, O); r(-8, hy + 4, 1, 4, A); r(6, hy + 3, 3, 6, O); r(7, hy + 4, 1, 4, A);
      } else { // antenna + ear lights
        r(0, hy - 4, 1, 4, O); r(-1, hy - 6, 3, 3, O); r(0, hy - 5, 1, 1, A); r(-8, hy + 3, 2, 4, O); r(-8, hy + 4, 1, 2, A); r(6, hy + 3, 2, 4, O); r(7, hy + 4, 1, 2, A);
      }
    }
    if (s.boss) { r(-4, hy - 5, 9, 3, P.goldDark); r(-4, hy - 7, 1, 2, P.gold); r(0, hy - 8, 1, 3, P.gold); r(4, hy - 7, 1, 2, P.gold); r(-3, hy - 4, 7, 1, P.goldLight); }
    return { top: Y + hy - (s.boss ? 8 : 6) };
  };

  /* ---------- effects ---------- */
  var ZG = [[1, 1, 1], [0, 1, 0], [1, 1, 1]];
  theme.drawFx = function (c, kind, x, y, t, o) {
    x = Math.round(x); y = Math.round(y); o = o || {};
    if (kind === 'bang') { var b = Math.floor(t / 300) % 2, by = y - 12 - b;
      R(c, x - 4, by - 10, 9, 11, P.outline); R(c, x - 3, by - 9, 7, 9, P.red); R(c, x - 4, by - 9, 1, 9, P.outline); R(c, x + 4, by - 9, 1, 9, P.outline);
      R(c, x - 1, by + 1, 3, 2, P.outline); R(c, x, by + 1, 1, 1, P.red); R(c, x, by - 8, 1, 5, '#ffffff'); R(c, x, by - 2, 1, 1, '#ffffff'); R(c, x - 3, by - 9, 1, 1, '#ff8a92'); }
    else if (kind === 'zzz') { for (var i = 0; i < 3; i++) { var ph = ((t / 1400) + i / 3) % 1, zx = x + 4 + Math.round(ph * 8), zy = y - 4 - Math.round(ph * 16); c.globalAlpha = 1 - ph;
        for (var a = 0; a < 3; a++) for (var bb = 0; bb < 3; bb++) if (ZG[a][bb] || (a === 1 && bb === (2 - 1))) R(c, zx + bb, zy + a, 1, 1, '#4f8fe0'); } c.globalAlpha = 1; }
    else if (kind === 'sweat') { var ph2 = (t / 900) % 1; R(c, x + 7, y + 2 + Math.round(ph2 * 8), 2, 3, '#5ab8ff'); R(c, x + 7, y + 2 + Math.round(ph2 * 8), 1, 1, '#ffffff'); }
    else if (kind === 'swirl') { for (var k = 0; k < 6; k++) { var an = t / 260 + k * 1.047; R(c, x + Math.round(Math.cos(an) * 6), y - 6 + Math.round(Math.sin(an) * 2.5), 2, 2, k % 2 ? '#ff8a3d' : '#ffc23d'); } }
    else if (kind === 'talk') { R(c, x - 6, y - 12, 13, 8, P.outline); R(c, x - 5, y - 11, 11, 6, '#ffffff'); R(c, x - 3, y - 4, 2, 2, P.outline);
      for (var d = 0; d < 3; d++) R(c, x - 3 + d * 3, y - 9, 2, 2, Math.floor(t / 300) % 3 === d ? (o.color || '#4f9dff') : '#c9d1dc'); }
    else if (kind === 'holo') { var hx = x - 7, hy = y - 14 - (Math.floor(t / 600) % 2); c.globalAlpha = 0.55; R(c, hx, hy, 14, 9, '#8fe8ff'); c.globalAlpha = 1;
      R(c, hx, hy, 14, 1, '#d6faff'); for (var q = 0; q < 3; q++) { var len = 3 + ((Math.floor(t / 200) + q * 5) % 8); R(c, hx + 2, hy + 2 + q * 2, len, 1, q === 1 ? (o.color || '#ffffff') : '#ffffff'); } }
    else if (kind === 'glowpulse') { var pa = 0.35 + 0.25 * Math.sin(t / 500); c.globalAlpha = pa; ring(c, x, y, 1.42, '#ffffff'); ring(c, x, y, 1.5, P.glow); c.globalAlpha = 1; }
  };
  theme.fireworkColors = ['#ff6a6a', '#ffd25a', '#4f9dff', '#46c49a', '#c08bff', '#ffffff', '#ff9f5a'];

  PO.themes = PO.themes || {}; PO.themes['default'] = theme;
})(window.VisualOffice = window.VisualOffice || {});
