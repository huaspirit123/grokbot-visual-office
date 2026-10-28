/* Isometric math + A* pathfinding on the tile grid.
 * Tiles are 2:1 diamonds, TW x TH pixels. Tile (x,y) has its top corner at world (ox+(x-y)*TW/2, oy+(x+y)*TH/2).
 * x grows to the lower-right of the screen, y to the lower-left. Depth (draw order) grows with x+y. */
(function (PO) {
  function Iso(tw, th, ox, oy) { this.tw = tw; this.th = th; this.hw = tw / 2; this.hh = th / 2; this.ox = ox; this.oy = oy; }
  /* tile coords (may be fractional; tile centre = x+0.5) -> world pixels */
  Iso.prototype.toWorld = function (x, y) { return { x: this.ox + (x - y) * this.hw, y: this.oy + (x + y) * this.hh }; };
  /* world pixels -> fractional tile coords */
  Iso.prototype.toTile = function (wx, wy) {
    var a = (wx - this.ox) / this.hw, b = (wy - this.oy) / this.hh;
    return { x: (a + b) / 2, y: (b - a) / 2 };
  };
  PO.Iso = Iso;

  /* Grid A*: 8 directions, no corner cutting. walk(x,y) -> bool. Returns [[x,y],...] excluding start, or null. */
  PO.findPath = function (cols, rows, walk, sx, sy, tx, ty) {
    if (sx === tx && sy === ty) return [];
    var N = cols * rows, g = new Float32Array(N).fill(Infinity), from = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
    var open = [], idx = function (x, y) { return y * cols + x; };
    var h = function (x, y) { var dx = Math.abs(x - tx), dy = Math.abs(y - ty); return Math.max(dx, dy) + 0.414 * Math.min(dx, dy); };
    var s = idx(sx, sy); g[s] = 0; open.push([h(sx, sy), s]);
    var D = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
    while (open.length) {
      var bi = 0; for (var i = 1; i < open.length; i++) if (open[i][0] < open[bi][0]) bi = i;
      var cur = open[bi][1]; open[bi] = open[open.length - 1]; open.pop();
      if (closed[cur]) continue; closed[cur] = 1;
      var cx = cur % cols, cy = (cur / cols) | 0;
      if (cx === tx && cy === ty) {
        var p = [], c = cur; while (c !== s) { p.push([c % cols, (c / cols) | 0]); c = from[c]; } return p.reverse();
      }
      for (var k = 0; k < 8; k++) {
        var nx = cx + D[k][0], ny = cy + D[k][1];
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
        var isGoal = nx === tx && ny === ty;
        if (!isGoal && !walk(nx, ny)) continue;
        if (D[k][2] > 1 && (!walk(cx + D[k][0], cy) || !walk(cx, cy + D[k][1]))) continue;
        var n = idx(nx, ny), ng = g[cur] + D[k][2];
        if (ng < g[n]) { g[n] = ng; from[n] = cur; open.push([ng + h(nx, ny), n]); }
      }
    }
    return null;
  };
})(window.VisualOffice = window.VisualOffice || {});
