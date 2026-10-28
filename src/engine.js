/* Grokbot Visual Office engine: isometric tile map, A* walking, per-agent state machine, depth sorting,
 * pixel-perfect camera (integer device-pixel scale), pan/zoom (mouse, wheel, touch) and hit-testing.
 * All drawing goes through the theme (themes/*.js). */
(function (PO) {
  var CFG = { walkSpeed: 2.6, idleDwell: [10, 22], deskDwell: [6, 12], cheerMs: 3600, maxScale: 10 };
  PO.ENGINE_CFG = CFG;
  var rnd = function (a, b) { return a + Math.random() * (b - a); };
  function hashN(s) { var h = 7; s = String(s); for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; }

  function Engine(canvas, layout, theme, hooks) {
    this.cv = canvas; this.ctx = canvas.getContext('2d'); this.L = layout; this.th = theme; this.hooks = hooks || {};
    var tw = theme.tile.w, th = theme.tile.h, M = 24;
    this.iso = new PO.Iso(tw, th, layout.rows * tw / 2 + M, theme.wallH + M);
    this.W = (layout.cols + layout.rows) * tw / 2 + M * 2;
    this.H = (layout.cols + layout.rows) * th / 2 + theme.wallH + theme.baseH + M * 2 + 40;
    this.buf = document.createElement('canvas'); this.bctx = this.buf.getContext('2d');
    this.cam = { x: 0, y: 0, P: 2 }; this.chars = {}; this.parts = []; this.sel = null; this.hover = null; this.meetingInfo = null;
    this.t0 = performance.now(); this.t = 0; this.particles = [];
    this._build(); this._bind(); this.resize(true);
    var self = this; (function loop() { self._frame(); requestAnimationFrame(loop); })();
  }
  var E = Engine.prototype;

  /* ---------- map ---------- */
  E._build = function () {
    var L = this.L, self = this;
    this.staticImg = this.th.buildStatic(L, this.iso, this.W, this.H);
    this.block = new Uint8Array(L.cols * L.rows);
    for (var y = 0; y < L.rows; y++) for (var x = 0; x < L.cols; x++) if (L.floor[y][x] === '.') this.block[y * L.cols + x] = 1;
    this.objects = L.objects.map(function (o) {
      var w = o.w || 1, h = o.h || 1;
      if (!o.seat) for (var yy = o.y; yy < o.y + h; yy++) for (var xx = o.x; xx < o.x + w; xx++) self.block[yy * L.cols + xx] = 1;
      var parts = self.th.sprites(o);
      var bx0 = o.x, bx1 = o.x + w, by0 = o.y, by1 = o.y + h;
      if (o.type === 'glass') { if (o.axis === 'y') { bx0 = o.x + 0.45; bx1 = o.x + 0.55; } else { by0 = o.y + 0.45; by1 = o.y + 0.55; } }
      parts.forEach(function (p) {
        var N = self.iso.toWorld(o.x, o.y);
        self.parts.push({ kind: 'obj', o: o, img: p.img, dx: Math.round(N.x - p.ax), dy: Math.round(N.y - p.ay), x0: bx0, x1: bx1, y0: by0, y1: by1,
          depth: (o.x + w - 0.5) + (o.y + h - 0.5) + (p.bias || 0), bias: p.bias || 0, screen: p.screen });
      });
      return o;
    });
    var Z = L.zones; this.deskAt = {};
    Z.desks.forEach(function (d) { self.deskAt[d.desk + ''] = d; self.deskAt[d.seat + ''] = d; });
    this.bossTiles = {}; (Z.boss.tiles || []).forEach(function (p) { self.bossTiles[p + ''] = 1; });
    L.objects.forEach(function (o) { if (o.type === 'boss_desk') for (var yy = o.y; yy < o.y + (o.h || 1); yy++) self.bossTiles[[o.x, yy] + ''] = 1; if (o.type === 'meeting_table') self.tableAt = o; });
  };
  E.walkable = function (x, y) { return x >= 0 && y >= 0 && x < this.L.cols && y < this.L.rows && !this.block[y * this.L.cols + x]; };

  /* ---------- data -> characters ---------- */
  E.setData = function (d, meeting) {
    var self = this, Z = this.L.zones, seen = {}, deskN = 0, used = {};
    this.meetingInfo = meeting;
    d.agents.forEach(function (a) { if (a.seat != null) used[a.seat] = 1; });
    var boss = d.agents.find(function (a) { return a.isBoss; });
    d.agents.forEach(function (a, i) {
      var c = self.chars[a.id];
      if (!c) {
        var home;
        if (boss && a.id === boss.id) home = { seat: Z.boss.seat, face: Z.boss.face, boss: true };
        else {
          var desk = a.seat != null ? Z.desks.find(function (x) { return x.id == a.seat; }) : null;
          if (!desk) { while (deskN < Z.desks.length && (used[Z.desks[deskN].id] || Object.values(self.chars).some(function (o) { return o.home.desk === Z.desks[deskN]; }))) deskN++; desk = Z.desks[deskN++]; }
          home = desk ? { seat: desk.seat, face: desk.face, desk: desk } : { seat: Z.idle_spots[i % Z.idle_spots.length].at, face: [1, 0] };
        }
        var h = hashN(a.id);
        c = self.chars[a.id] = { id: a.id, home: home, x: home.seat[0] + 0.5, y: home.seat[1] + 0.5, path: [], pose: 'sit', act: '', face: home.face, frame: 0, mode: null, style: h % 2, hair: h % 5, wait: 0 };
      }
      c.a = a; seen[a.id] = 1;
    });
    Object.keys(this.chars).forEach(function (id) { if (!seen[id]) delete self.chars[id]; });
    // modes
    var mi = 0, pi = 0, qi = 0;
    Object.values(this.chars).forEach(function (c) {
      var a = c.a, m;
      c.hand = a.pending > 0 && a.status !== 'offline';
      if (c.home.boss) m = a.status === 'offline' ? 'boss_sleep' : 'boss';
      else if (a.status === 'offline') m = 'sleep';
      else if (a.status === 'stuck') m = 'stuck';
      else if (a.status === 'working') m = meeting && meeting.ids.indexOf(a.id) >= 0 ? 'meet' : 'work';
      else if (a.status === 'waiting_approval' || c.hand) m = 'ask';
      else m = 'idle';
      var slot = m === 'meet' ? Z.meeting.seats[mi++ % Z.meeting.seats.length] : m === 'sleep' ? Z.pods[pi++ % Z.pods.length] : m === 'ask' ? Z.approval_queue[qi++ % Z.approval_queue.length] : null;
      if (m !== c.mode || (slot && c.slot + '' !== slot + '')) { c.mode = m; c.slot = slot; self._plan(c); }
    });
  };
  E._goto = function (c, tile, then) {
    var sx = Math.floor(c.x), sy = Math.floor(c.y), self = this;
    var p = PO.findPath(this.L.cols, this.L.rows, function (x, y) { return self.walkable(x, y); }, sx, sy, tile[0], tile[1]);
    if (p && p.length && p[0][0] === sx && p[0][1] === sy) p.shift();
    if (!p || !p.length) { c.x = tile[0] + 0.5; c.y = tile[1] + 0.5; c.path = []; c.pose = 'stand'; then && then(); return; }
    c.path = p; c.onArrive = then; c.pose = 'walk'; c.act = c.hand ? 'hand' : '';
  };
  E._plan = function (c) {
    var self = this, Z = this.L.zones, m = c.mode; clearTimeout(c.timer); c.fx = null;
    var sitHome = function (act, fx) { self._goto(c, c.home.seat, function () { c.pose = 'sit'; c.face = c.home.face; c.act = act; c.fx = fx; }); };
    if (m === 'boss') sitHome(c.a.currentTask ? 'type' : '', null);
    else if (m === 'boss_sleep') sitHome('', 'zzz');
    else if (m === 'work') sitHome('type', 'holo');
    else if (m === 'stuck') sitHome('stuck', 'stuck');
    else if (m === 'meet') this._goto(c, c.slot, function () { c.pose = 'sit'; c.face = [c.slot[2], c.slot[3]]; c.act = 'talk'; c.fx = 'talk'; });
    else if (m === 'sleep') this._goto(c, c.slot, function () { c.pose = 'sleep'; c.face = [1, 0]; c.act = ''; c.fx = 'zzz'; });
    else if (m === 'ask') this._goto(c, c.slot, function () { c.pose = 'stand'; c.face = [-1, 0]; c.act = 'hand'; });
    else this._idle(c);
  };
  E._idle = function (c) {
    var self = this, Z = this.L.zones;
    if (c.mode !== 'idle') return;
    var taken = Object.values(this.chars).filter(function (o) { return o !== c && o.spot; }).map(function (o) { return o.spot.at + ''; });
    var free = Z.idle_spots.filter(function (s) { return taken.indexOf(s.at + '') < 0; });
    if (c.home.desk && (Math.random() < 0.25 || !free.length)) {
      c.spot = null;
      this._goto(c, c.home.seat, function () { c.pose = 'sit'; c.face = c.home.face; c.act = ''; c.timer = setTimeout(function () { self._idle(c); }, rnd.apply(null, CFG.deskDwell) * 1000); });
      return;
    }
    var s = free[Math.floor(Math.random() * free.length)]; c.spot = s;
    this._goto(c, s.at, function () {
      c.face = s.face || [1, 0];
      var k = s.kind; c.pose = (k === 'stool' || k === 'sofa') ? 'sit' : 'stand';
      c.act = k === 'coffee' || k === 'stool' ? 'cup' : k === 'arcade' ? 'play' : k === 'books' ? 'read' : '';
      c.timer = setTimeout(function () { c.spot = null; self._idle(c); }, rnd.apply(null, CFG.idleDwell) * 1000);
    });
  };
  E.celebrate = function (id) {
    var c = this.chars[id]; if (!c) return; c.cheer = this.t + CFG.cheerMs;
    var p = this.iso.toWorld(c.x, c.y), cols = this.th.fireworkColors, self = this;
    [0, 450, 900].forEach(function (delay, k) { setTimeout(function () {
      var cx = p.x + (k - 1) * 14, cy = p.y - 52 - k * 6;
      for (var i = 0; i < 26; i++) { var a = i / 26 * Math.PI * 2, v = 34 + Math.random() * 26; self.particles.push({ x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1.3 + Math.random() * 0.5, age: 0, col: cols[(i + k) % cols.length] }); }
    }, delay); });
  };

  /* ---------- update + render ---------- */
  E._update = function (dt) {
    var self = this;
    Object.values(this.chars).forEach(function (c) {
      if (c.path.length) {
        var n = c.path[0], tx = n[0] + 0.5, ty = n[1] + 0.5, dx = tx - c.x, dy = ty - c.y, d = Math.hypot(dx, dy), step = CFG.walkSpeed * dt;
        if (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01) c.face = [Math.sign(Math.round(dx * 10)), Math.sign(Math.round(dy * 10))];
        if (d <= step) { c.x = tx; c.y = ty; c.path.shift(); if (!c.path.length) { var f = c.onArrive; c.onArrive = null; c.pose = 'stand'; f && f(); } }
        else { c.x += dx / d * step; c.y += dy / d * step; }
        c.frame = Math.floor(self.t / 160);
      }
    });
    this.particles = this.particles.filter(function (p) { p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 40 * dt; p.vx *= 0.985; return p.age < p.life; });
  };
  E._frame = function () {
    var now = performance.now(), dt = Math.min(0.05, (now - (this._last || now)) / 1000); this._last = now; this.t = now - this.t0;
    this._update(dt);
    var b = this.bctx, cam = this.cam, bw = this.buf.width, bh = this.buf.height, th = this.th, t = this.t, self = this;
    var cx = Math.round(cam.x), cy = Math.round(cam.y);
    b.setTransform(1, 0, 0, 1, 0, 0); b.imageSmoothingEnabled = false;
    th.drawSky(b, bw, bh, t, { x: cx, y: cy });
    b.setTransform(1, 0, 0, 1, -cx, -cy);
    b.drawImage(this.staticImg, 0, 0);
    if (th._bossCenter) th.drawFx(b, 'glowpulse', th._bossCenter.x, th._bossCenter.y, t);
    if (this.sel && this.sel.type === 'agent' && this.chars[this.sel.id]) { var sc = this.chars[this.sel.id], sp = this.iso.toWorld(Math.floor(sc.x), Math.floor(sc.y)); this._selDiamond(b, sp.x, sp.y); }
    // drawables: objects + characters, iso-sorted
    var list = this.parts.slice();
    Object.values(this.chars).forEach(function (c) { list.push({ kind: 'char', c: c, x0: c.x - 0.2, x1: c.x + 0.2, y0: c.y - 0.2, y1: c.y + 0.2, depth: c.x + c.y + (c.pose === 'sit' && !c.path.length ? 0.5 : 0.01) }); });
    list.sort(function (a, b2) {
      if (a.x1 <= b2.x0 + 1e-6 || a.y1 <= b2.y0 + 1e-6) { if (!(b2.x1 <= a.x0 + 1e-6 || b2.y1 <= a.y0 + 1e-6)) return -1; }
      else if (b2.x1 <= a.x0 + 1e-6 || b2.y1 <= a.y0 + 1e-6) return 1;
      return a.depth - b2.depth;
    });
    var fxq = [];
    list.forEach(function (it) {
      if (it.kind === 'obj') { b.drawImage(it.img, it.dx, it.dy); return; }
      var c = it.c, p = self.iso.toWorld(c.x, c.y), py = p.y + (c.pose === 'sit' ? -2 : 0) + (c.pose === 'sleep' ? -5 : 0);
      var back = c.face[0] + c.face[1] < 0, scrDx = c.face[0] - c.face[1];
      var act = c.cheer && c.cheer > t ? 'cheer' : c.act;
      if (c.hand && act !== 'cheer' && (c.mode === 'work' || c.mode === 'stuck' || c.mode === 'boss') && Math.floor(t / 4000) % 2 === 0) act = 'hand';
      if (c.hand && c.mode === 'meet') act = Math.floor(t / 4000) % 2 ? 'hand' : 'talk';
      var r = th.drawCharacter(b, p.x, py, { kind: c.a.kind, color: c.a.color, pose: c.pose, act: act, back: back, flip: scrDx < 0, frame: c.frame, t: t + hashN(c.id) % 997, style: c.style, hair: c.hair, boss: c.home.boss });
      c.wx = p.x; c.wy = py; c.top = r.top;
      fxq.push(c);
    });
    fxq.forEach(function (c) {
      if (c.home.boss && c.act === 'type' && c.pose === 'sit') { var bc = self.th._bossCenter; th.drawFx(b, 'holo', c.wx + 14, c.wy - 30, t, { color: '#e2b24c' }); }
      if (c.fx === 'holo' && c.home.desk && c.pose === 'sit') { var d = c.home.desk.desk, hp = self.iso.toWorld(d[0] + 0.4, d[1] + 0.5); th.drawFx(b, 'holo', hp.x, hp.y - 26, t, { color: c.a.color }); }
      if (c.fx === 'stuck') { th.drawFx(b, 'swirl', c.wx, c.top - 2, t); th.drawFx(b, 'sweat', c.wx, c.top, t); }
      if (c.fx === 'zzz') th.drawFx(b, 'zzz', c.wx, c.top, t);
      if (c.fx === 'talk' && Math.floor((t + hashN(c.id)) / 2200) % 2 === 0) th.drawFx(b, 'talk', c.wx + 6, c.top, t, { color: c.a.color });
      if (c.hand) th.drawFx(b, 'bang', c.wx + 1, c.top, t);
    });
    this.particles.forEach(function (p) { b.globalAlpha = Math.max(0, 1 - p.age / p.life); b.fillStyle = p.col; b.fillRect(Math.round(p.x), Math.round(p.y), 2, 2); });
    b.globalAlpha = 1;
    th.drawForeground(b, t, { w: this.W, h: this.H });
    // blit
    var x = this.ctx; x.setTransform(1, 0, 0, 1, 0, 0); x.imageSmoothingEnabled = false;
    x.drawImage(this.buf, 0, 0, bw * cam.P, bh * cam.P);
    this._labels(x, cx, cy);
  };
  E._selDiamond = function (b, x, y) { var col = '#ffcf4a', TWh = this.th.tile.w / 2, THh = this.th.tile.h / 2;
    var h = this.th.helpers; h.line(b, x, y - 1, x + TWh + 1, y + THh, col); h.line(b, x + TWh + 1, y + THh, x, y + 2 * THh + 1, col); h.line(b, x, y + 2 * THh + 1, x - TWh - 1, y + THh, col); h.line(b, x - TWh - 1, y + THh, x, y - 1, col); };

  /* name tags at full resolution, de-cluttered */
  E._labels = function (x, cx, cy) {
    var P = this.cam.P, dpr = this.dpr, scale = P / dpr, self = this, placed = [], i18n = PO.i18n;
    var fs = Math.round(11 * dpr), fs2 = Math.round(10 * dpr), showTask = scale >= 1.6;
    var cs = Object.values(this.chars).filter(function (c) { return c.wx != null; });
    var pri = function (c) { return (self.sel && self.sel.id === c.id ? 100 : 0) + (c.home.boss ? 50 : 0) + (c.hand ? 20 : 0) + (c.mode === 'work' || c.mode === 'stuck' ? 10 : 0); };
    cs.sort(function (a, b) { return pri(b) - pri(a); });
    x.textBaseline = 'middle';
    cs.forEach(function (c) {
      var a = c.a, selected = self.sel && self.sel.id === c.id;
      var lines = [a.name + (c.hand ? '  ❗' + a.pending : '')];
      var task = a.currentTask && (c.mode === 'work' || c.mode === 'stuck' || c.mode === 'meet' || c.mode === 'boss') ? a.currentTask : '';
      if (task && (showTask || selected)) { var ch = Array.from(task); lines.push((c.mode === 'stuck' ? '🌀 ' : '⌨ ') + (ch.length > 14 ? ch.slice(0, 14).join('') + '…' : task)); }
      x.font = '600 ' + fs + 'px system-ui,"PingFang SC","Noto Sans CJK SC","Microsoft YaHei",sans-serif';
      var w1 = x.measureText(lines[0]).width; x.font = fs2 + 'px system-ui,"PingFang SC","Noto Sans CJK SC",sans-serif'; var w2 = lines[1] ? x.measureText(lines[1]).width : 0;
      var pad = 5 * dpr, w = Math.max(w1 + 10 * dpr, w2) + pad * 2, h = (lines.length > 1 ? 30 : 17) * dpr;
      var sx = Math.round((c.wx - cx) * P - w / 2), sy = Math.round((c.top - cy - (c.hand ? 16 : 3)) * P - h);
      var tries = 0, ov = function () { return placed.some(function (r) { return sx < r[0] + r[2] && sx + w > r[0] && sy < r[1] + r[3] && sy + h > r[1]; }); };
      while (ov() && tries < 3) { sy -= h * 0.55; tries++; }
      if (ov() && !selected) { lines = [lines[0]]; }
      if (ov() && !selected && tries >= 3) return;
      placed.push([sx, sy, w, h]);
      x.globalAlpha = 0.95; x.fillStyle = selected ? '#fffaf0' : '#ffffff'; rr(x, sx, sy, w, h, 6 * dpr); x.fill();
      x.lineWidth = Math.max(1, dpr); x.strokeStyle = selected ? '#e2b24c' : c.hand ? '#ff8a92' : 'rgba(80,110,150,.35)'; x.stroke(); x.globalAlpha = 1;
      x.fillStyle = STATUS_COL[c.mode] || '#8aa'; x.beginPath(); x.arc(sx + pad + 3 * dpr, sy + 8.5 * dpr, 3.2 * dpr, 0, 7); x.fill();
      x.font = '600 ' + fs + 'px system-ui,"PingFang SC","Noto Sans CJK SC","Microsoft YaHei",sans-serif'; x.fillStyle = '#25324a'; x.fillText(lines[0], sx + pad + 10 * dpr, sy + 9 * dpr);
      if (lines[1]) { x.font = fs2 + 'px system-ui,"PingFang SC","Noto Sans CJK SC",sans-serif'; x.fillStyle = c.mode === 'stuck' ? '#c4521c' : '#3a6fb0'; x.fillText(lines[1], sx + pad, sy + 22 * dpr); }
    });
    var m = this.meetingInfo;
    if (m && this.tableAt) { var tp = this.iso.toWorld(this.tableAt.x + 1.5, this.tableAt.y + 1), txt = i18n.t('meetingOn', { p: m.name });
      x.font = '600 ' + fs + 'px system-ui,"PingFang SC",sans-serif'; var tw = x.measureText(txt).width + 14 * dpr, tx = Math.round((tp.x - cx) * P - tw / 2), ty = Math.round((tp.y - cy - 60) * P);
      if (!placed.some(function (r) { return tx < r[0] + r[2] && tx + tw > r[0] && ty < r[1] + r[3] && ty + 18 * dpr > r[1]; })) {
        x.fillStyle = 'rgba(247,242,255,.95)'; rr(x, tx, ty, tw, 18 * dpr, 9 * dpr); x.fill(); x.strokeStyle = '#c9b3f2'; x.stroke(); x.fillStyle = '#6a45b8'; x.fillText(txt, tx + 7 * dpr, ty + 9.5 * dpr); } }
  };
  var STATUS_COL = { work: '#2fb36b', boss: '#e2b24c', boss_sleep: '#9aa6b8', meet: '#8a5cf0', stuck: '#ff7a2f', ask: '#ff3b47', idle: '#4fa3ff', sleep: '#9aa6b8' };
  function rr(x, a, b, w, h, r) { x.beginPath(); x.moveTo(a + r, b); x.arcTo(a + w, b, a + w, b + h, r); x.arcTo(a + w, b + h, a, b + h, r); x.arcTo(a, b + h, a, b, r); x.arcTo(a, b, a + w, b, r); x.closePath(); }

  /* ---------- camera ---------- */
  E.resize = function (fit) {
    var r = this.cv.getBoundingClientRect(), dpr = this.dpr = Math.max(1, window.devicePixelRatio || 1);
    this.cv.width = Math.round(r.width * dpr); this.cv.height = Math.round(r.height * dpr);
    if (fit || !this._fitDone) this.fit(); else this._resizeBuf();
  };
  E._resizeBuf = function () { this.buf.width = Math.ceil(this.cv.width / this.cam.P) + 1; this.buf.height = Math.ceil(this.cv.height / this.cam.P) + 1; this.bctx.imageSmoothingEnabled = false; };
  E.fit = function () {
    var dw = this.cv.width, dh = this.cv.height, cw = this.W - 30, ch = this.H - 40;
    var fitP = Math.floor(Math.min(dw / cw, dh / ch)), minP = Math.max(1, Math.round(this.dpr * 0.9));
    this.cam.P = Math.min(CFG.maxScale * this.dpr, Math.max(fitP, minP)); this._resizeBuf(); this._fitDone = true;
    var bw = dw / this.cam.P, bh = dh / this.cam.P, ctr = this.th._bossCenter || { x: this.W / 2, y: this.H / 2 };
    var fitsW = bw >= cw; this.cam.x = fitsW ? (this.W - bw) / 2 : ctr.x - bw / 2; this.cam.y = bh >= ch ? (this.H - bh) / 2 - 4 : ctr.y - bh / 2;
  };
  E.zoomAt = function (dir, dx, dy) {
    var P0 = this.cam.P, minP = Math.max(1, Math.floor(this.dpr / 2)), P1 = Math.max(minP, Math.min(CFG.maxScale * this.dpr, P0 + dir));
    if (P1 === P0) return; var wx = this.cam.x + dx / P0, wy = this.cam.y + dy / P0;
    this.cam.P = P1; this.cam.x = wx - dx / P1; this.cam.y = wy - dy / P1; this._resizeBuf(); this._clamp();
  };
  E._clamp = function () { var bw = this.buf.width, bh = this.buf.height; this.cam.x = Math.max(-bw * 0.6, Math.min(this.W - bw * 0.4, this.cam.x)); this.cam.y = Math.max(-bh * 0.6, Math.min(this.H - bh * 0.4, this.cam.y)); };

  /* ---------- input ---------- */
  E._bind = function () {
    var self = this, cv = this.cv, ptrs = {}, start = null, pinch = null;
    var dev = function (e) { var r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * self.dpr, (e.clientY - r.top) * self.dpr]; };
    cv.addEventListener('pointerdown', function (e) { cv.setPointerCapture(e.pointerId); ptrs[e.pointerId] = dev(e);
      var ks = Object.keys(ptrs); if (ks.length === 1) start = { p: dev(e), cam: [self.cam.x, self.cam.y], moved: false };
      if (ks.length === 2) { var a = ptrs[ks[0]], b = ptrs[ks[1]]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]) }; start && (start.moved = true); } });
    cv.addEventListener('pointermove', function (e) {
      if (!ptrs[e.pointerId]) { var h = self.hit(dev(e)); cv.style.cursor = h ? 'pointer' : 'grab'; return; }
      ptrs[e.pointerId] = dev(e); var ks = Object.keys(ptrs);
      if (ks.length === 2 && pinch) { var a = ptrs[ks[0]], b = ptrs[ks[1]], d = Math.hypot(a[0] - b[0], a[1] - b[1]), mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
        if (d / pinch.d > 1.35) { self.zoomAt(1, mx, my); pinch.d = d; } else if (d / pinch.d < 0.74) { self.zoomAt(-1, mx, my); pinch.d = d; } return; }
      if (start && ks.length === 1) { var p = dev(e), dx = p[0] - start.p[0], dy = p[1] - start.p[1];
        if (Math.abs(dx) + Math.abs(dy) > 8 * self.dpr) start.moved = true;
        if (start.moved) { self.cam.x = start.cam[0] - dx / self.cam.P; self.cam.y = start.cam[1] - dy / self.cam.P; self._clamp(); cv.style.cursor = 'grabbing'; } }
    });
    var up = function (e) { var was = ptrs[e.pointerId]; delete ptrs[e.pointerId]; var ks = Object.keys(ptrs);
      if (ks.length < 2) pinch = null;
      if (!ks.length && start && !start.moved && was && e.type === 'pointerup') { var h = self.hit(dev(e)); self.select(h); self.hooks.onSelect && self.hooks.onSelect(h); }
      if (!ks.length) start = null; else start = { p: ptrs[ks[0]], cam: [self.cam.x, self.cam.y], moved: true }; };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    var wheelAcc = 0;
    cv.addEventListener('wheel', function (e) { e.preventDefault(); wheelAcc += e.deltaY; if (Math.abs(wheelAcc) < 60) return; var p = dev(e); self.zoomAt(wheelAcc < 0 ? 1 : -1, p[0], p[1]); wheelAcc = 0; }, { passive: false });
    window.addEventListener('resize', function () { self.resize(false); });
  };
  E.select = function (h) { this.sel = h && h.type === 'agent' ? h : null; };
  /* device px -> what is there: {type:'agent',id} | {type:'desk',desk} | {type:'team'} | null */
  E.hit = function (p) {
    var wx = this.cam.x + p[0] / this.cam.P, wy = this.cam.y + p[1] / this.cam.P, best = null;
    Object.values(this.chars).forEach(function (c) { if (c.wx == null) return;
      if (wx >= c.wx - 9 && wx <= c.wx + 9 && wy >= c.top - 4 && wy <= c.wy + 2) { var dep = c.x + c.y; if (!best || dep > best.d) best = { d: dep, id: c.id }; } });
    if (best) return { type: 'agent', id: best.id };
    var t = this.iso.toTile(wx, wy), tx = Math.floor(t.x), ty = Math.floor(t.y), key = [tx, ty] + '', self = this;
    // tall objects: also try the tile one step "behind" the pointer
    var keys = [key, [tx - 1, ty - 1] + ''];
    for (var i = 0; i < keys.length; i++) {
      var d = this.deskAt[keys[i]];
      if (d) { var owner = Object.values(this.chars).find(function (c) { return c.home.desk === d; }); return owner ? { type: 'agent', id: owner.id } : { type: 'desk', desk: d.id }; }
      if (this.bossTiles[keys[i]]) { var bo = Object.values(this.chars).find(function (c) { return c.home.boss; }); if (bo) return { type: 'agent', id: bo.id }; }
      var tb = this.tableAt, k = keys[i].split(',').map(Number);
      if (tb && k[0] >= tb.x && k[0] < tb.x + tb.w && k[1] >= tb.y && k[1] < tb.y + tb.h) return { type: 'team' };
    }
    return null;
  };
  E.charScreen = function (id) { var c = this.chars[id]; if (!c || c.wx == null) return null; return { x: (c.wx - this.cam.x) * this.cam.P / this.dpr, y: (c.top - this.cam.y) * this.cam.P / this.dpr }; };
  PO.Engine = Engine;
})(window.VisualOffice = window.VisualOffice || {});
