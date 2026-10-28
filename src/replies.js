/* Answering 待你确认 questions from the panel. Optional: without cfg.replies the office is read-only.
 * cfg.replies is a "reply provider", either your own object or {type:'http', ...} for the built-in one below.
 *   status(agent, task, confirm) -> null | {state:'answered'|'seen'|'handled'|'sending'|'failed', label?}
 *       answered/seen/handled: the question leaves 待你确认 and stops counting; sending/failed only shows a flag.
 *   box(agent, task, confirm)    -> HTML string drawn under the question (your reply UI)          [optional]
 *   sync()                       -> Promise, called on every data refresh (fetch the answer list)  [optional]
 *   busy()                       -> true while the user is typing, so the panel is not redrawn     [optional]
 *   onChange(fn)                 -> call fn() whenever answers change                              [optional]
 * Built-in HTTP provider:  cfg.replies = { type:'http', post:'/api/answers', list:'/api/answers', headers:{} }
 *   POST post  JSON {agentId, taskId, task, confirmId, question, text}  -> any 2xx
 *   GET  list  -> {items:[{confirmId, status:'answered'|'seen'|'handled', text?}]}   (server is authoritative) */
(function (PO) {
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  PO.replies = {
    http: function (o) {
      var srv = null, local = {}, subs = [], LK = 'gvo.replies';
      try { local = JSON.parse(localStorage.getItem(LK) || '{}'); } catch (e) {}
      var save = function () { try { localStorage.setItem(LK, JSON.stringify(local)); } catch (e) {} };
      var emit = function () { subs.forEach(function (f) { try { f(); } catch (e) {} }); };
      var cred = o.credentials || 'same-origin', H = Object.assign({ 'Content-Type': 'application/json' }, o.headers || {});
      async function post(x) {
        try { var r = await fetch(o.post, { method: 'POST', credentials: cred, headers: H, body: JSON.stringify(x.body) });
          x.state = r.ok ? 'answered' : r.status >= 400 && r.status < 500 ? 'failed' : 'sending'; } catch (e) { x.state = 'sending'; }
        save(); emit();
      }
      async function sync() {
        for (var k in local) if (local[k].state === 'sending') await post(local[k]);
        if (!o.list) return;
        try { var r = await fetch(o.list + (o.list.indexOf('?') < 0 ? '?' : '&') + 't=' + Date.now(), { credentials: cred, headers: o.headers || {}, cache: 'no-store' });
          if (!r.ok) return; var j = await r.json(), m = {};
          (j.items || []).forEach(function (s) { if (s && s.confirmId != null) m[s.confirmId] = { state: s.status === 'new' ? 'answered' : s.status || 'answered', text: s.text }; });
          srv = m; for (var k2 in local) if (local[k2].state !== 'sending' && local[k2].state !== 'failed') delete local[k2]; save(); emit();
        } catch (e) {}
      }
      document.addEventListener('click', function (ev) {
        var b = ev.target.closest && ev.target.closest('[data-rsend]'); if (!b) return; ev.preventDefault();
        var el = b.closest('.rbox'), ta = el.querySelector('textarea'), d = el.dataset, T = PO.i18n.t;
        var x = local[d.cid] = { state: 'sending', body: { agentId: d.ag, taskId: d.tid, task: d.tk, confirmId: d.cid, question: d.q, text: (ta.value || '').trim() || T('agree') } };
        ta.value = ''; b.disabled = true; save(); emit(); post(x);
      });
      return {
        sync: sync, onChange: function (f) { subs.push(f); },
        status: function (a, t, c) { var l = local[c.id]; if (l && (l.state === 'sending' || l.state === 'failed')) return { state: l.state }; return (srv && srv[c.id]) || (l ? { state: l.state } : null); },
        busy: function () { var e = document.activeElement; return !!(e && e.closest && e.closest('.rbox')) || [].some.call(document.querySelectorAll('.rbox textarea'), function (t) { return t.value.trim(); }); },
        box: function (a, t, c) { var T = PO.i18n.t;
          return '<div class="rbox" data-cid="' + esc(c.id) + '" data-ag="' + esc(a.id) + '" data-tid="' + esc(t.id) + '" data-tk="' + esc(t.title) + '" data-q="' + esc(c.question) + '"><textarea rows="1" placeholder="' + esc(T('replyPh')) + '"></textarea>' +
            '<div class="rr"><button data-rsend>' + esc(T('send')) + '</button></div></div>'; }
      };
    }
  };
})(window.VisualOffice = window.VisualOffice || {});
