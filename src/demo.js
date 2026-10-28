/* Grokbot Visual Office demo tour (?demo=1, or ?demo=loop to repeat). Runs on the built-in sample data only:
 * a task finishes (firework), a fake cursor opens the agent who raised a hand, types an answer and sends it
 * (memory reply provider, nothing leaves the page), then the stuck agent gets going again. About 24 s. */
(function (PO) {
  PO.demo = {
    run: function (app, opt) {
      opt = opt || {};
      var zh = PO.i18n.lang === 'zh', hint = document.getElementById('hint'); if (hint) hint.classList.add('off');
      var st = document.createElement('style');
      st.textContent = '#demo-cur{position:fixed;z-index:20;left:0;top:0;width:26px;height:26px;pointer-events:none;transform:translate(-200px,-200px);filter:drop-shadow(0 3px 4px rgba(0,0,0,.35))}' +
        '#demo-cur svg{width:26px;height:26px}.demo-rip{position:fixed;z-index:19;width:14px;height:14px;margin:-7px 0 0 -7px;border-radius:50%;border:3px solid #ffb340;pointer-events:none;animation:demoRip .6s ease-out forwards}' +
        '@keyframes demoRip{to{transform:scale(4);opacity:0}}';
      document.head.appendChild(st);
      var cur = document.createElement('div'); cur.id = 'demo-cur';
      cur.innerHTML = '<svg viewBox="0 0 24 24"><path d="M3 2l17 9-7.5 1.6L9 20z" fill="#fff" stroke="#25324a" stroke-width="1.8" stroke-linejoin="round"/></svg>';
      document.body.appendChild(cur);
      var pos = { x: innerWidth + 40, y: innerHeight * 0.8 };
      var put = function () { cur.style.transform = 'translate(' + pos.x + 'px,' + pos.y + 'px)'; };
      var at = function (ms, f) { setTimeout(f, ms); };
      var ease = function (k) { return k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; };
      function move(to, dur, done) {
        var from = { x: pos.x, y: pos.y }, t0 = performance.now();
        (function step() { var k = Math.min(1, (performance.now() - t0) / dur), e = ease(k);
          pos.x = from.x + (to().x - from.x) * e; pos.y = from.y + (to().y - from.y) * e; put();
          if (k < 1) requestAnimationFrame(step); else if (done) done(); })();
      }
      function ripple() { var r = document.createElement('div'); r.className = 'demo-rip'; r.style.left = pos.x + 'px'; r.style.top = pos.y + 'px'; document.body.appendChild(r); setTimeout(function () { r.remove(); }, 700); }
      var agent = function (id) { return app.data.agents.find(function (a) { return a.id === id; }); };
      var charPt = function (id) { return function () { var p = app.engine.charScreen(id) || { x: innerWidth / 2, y: innerHeight / 2 }; return { x: p.x, y: p.y + 14 }; }; };
      var elPt = function (sel, fx, fy) { return function () { var e = document.querySelector(sel); if (!e) return pos; var r = e.getBoundingClientRect(); return { x: r.left + r.width * (fx || 0.5), y: r.top + r.height * (fy || 0.5) }; }; };
      var iso = function () { return new Date().toISOString(); };

      /* 8 s: Kite finishes the queued newsletter -> firework */
      at(8000, function () { var a = agent('kite'), t = a && a.tasks.find(function (x) { return x.id === 'k2'; }); if (!t) return;
        t.status = 'done'; t.doneAt = t.updatedAt = iso(); a.lastActive = iso(); app.reapply();
        app.engine.celebrate('kite'); setTimeout(function () { app.engine.celebrate('kite'); }, 1400); PO.ui.toast(PO.i18n.t('firework', { a: a.name, t: t.title })); });
      /* 12 s: cursor to Mochi (hand raised), click -> panel on the confirm tab */
      at(12000, function () { move(charPt('mochi'), 1300, function () { ripple();
        app.engine.select({ type: 'agent', id: 'mochi' }); PO.ui.open({ type: 'agent', id: 'mochi' }); }); });
      /* 15 s: type an answer into the first question and send it */
      at(15000, function () { move(elPt('#p-body .rbox textarea', 0.3, 0.5), 900, function () { ripple();
        var ta = document.querySelector('#p-body .rbox textarea'); if (!ta) return; var s = Array.from(zh ? '可以，全额退款' : 'Yes, refund in full'), i = 0;
        (function typ() { if (i < s.length) { ta.value += s[i++]; setTimeout(typ, zh ? 140 : 65); } })(); }); });
      at(17700, function () { move(elPt('#p-body .rbox [data-rsend]'), 700, function () { ripple();
        var b = document.querySelector('#p-body .rbox [data-rsend]'); if (b) b.click(); }); });
      /* 21 s: close the panel; Echo gets unstuck */
      at(21000, function () { move(elPt('#p-head .x'), 600, function () { ripple(); PO.ui.close(); }); });
      at(22000, function () { var a = agent('echo'); if (!a) return; a.status = a.baseStatus = 'working';
        a.tasks.forEach(function (t) { if (t.status === 'stuck') { t.status = 'running'; t.note = null; t.updatedAt = iso(); (t.subtasks || []).forEach(function (s) { if (s.status === 'stuck') s.status = 'running'; }); } });
        a.lastActive = iso(); app.reapply(); move(function () { return { x: innerWidth + 60, y: innerHeight * 0.85 }; }, 900); });
      at(25000, function () { window.__demoDone = true; if (opt.loop) location.reload(); });
    }
  };
})(window.VisualOffice = window.VisualOffice || {});
