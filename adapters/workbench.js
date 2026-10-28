/* Grokbot Visual Office adapter: 工作台 任务合并.json  ->  Grokbot Visual Office schema (docs/SCHEMA.md)
 * Works in the browser (VisualOffice.adapters.workbench) and in Node (module.exports).
 * Source fields used: built, agents[].{id,name,main,gone,color}, projects[].{id,name},
 *   tasks[].{agent,name,type,status,start,end,note,project,subs[[title,status]],confirm[string],shelved}
 * Times in the source are Beijing time (UTC+8) written as "MM-DD HH:mm" or "YYYY-MM-DD HH:mm".
 * State rules are the same as the 工作台 AI办公室 page. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.VisualOffice = root.VisualOffice || {}; (root.VisualOffice.adapters = root.VisualOffice.adapters || {}).workbench = api; }
})(typeof self !== 'undefined' ? self : this, function () {
  var RULES = { workingHours: 12, offlineHours: 48, doneMinutes: 30 };
  var TZ = 8 * 36e5;
  function bjYear(ms) { return new Date(ms + TZ).getUTCFullYear(); }
  function tms(s, now) {
    var m = String(s || '').match(/^(?:(\d{4})-)?(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2}))?/);
    if (!m) return 0;
    var f = function (y) { return Date.UTC(y, +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0)) - TZ; };
    var y = m[1] ? +m[1] : bjYear(now), t = f(y);
    if (!m[1] && t > now + 2 * 864e5) t = f(y - 1); // "12-31" read in January belongs to last year
    return t;
  }
  function iso(ms) {
    if (!ms) return null;
    return new Date(ms + TZ).toISOString().slice(0, 19) + '+08:00';
  }
  function hash(s) { var h = 0x811c9dc5; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(36); }
  var TASK_ST = { running: 'running', done: 'done', queue: 'queued', stuck: 'stuck', cancel: 'cancelled' };

  function convert(raw, opts) {
    opts = opts || {};
    var now = opts.now || Date.now(), R = Object.assign({}, RULES, opts.rules || {});
    var noteT = function (t) { var m = String(t.note || '').match(/^(\d{1,2}-\d{1,2} \d{1,2}:\d{2})/); return m ? tms(m[1], now) : 0; };
    var lastT = function (t) { return Math.max(tms(t.start, now), noteT(t), tms(t.end, now)); };
    var projects = (raw.projects || []).map(function (p) { return { id: p.id, name: p.name || p.id }; });
    var pname = function (id) { var p = projects.find(function (p) { return p.id === id; }); return p ? p.name : (id || ''); };
    var tasks = raw.tasks || [];

    var agents = (raw.agents || []).map(function (a) {
      var my = tasks.filter(function (t) { return t.agent === a.id && !t.shelved; });
      var act = my.filter(function (t) { return t.status !== 'cancel'; });
      var last = act.reduce(function (m, t) { return Math.max(m, lastT(t)); }, 0);
      var byRecent = function (x, y) { return lastT(y) - lastT(x); };
      var run = my.filter(function (t) { return t.status === 'running'; }).sort(byRecent);
      var isStuck = function (t) { return t.status === 'stuck' || (t.status === 'running' && (t.subs || []).some(function (s) { return s && s[1] === 'stuck'; })); };
      var stuck = my.filter(isStuck).sort(byRecent);
      var recent = run.filter(function (t) { return now - lastT(t) <= R.workingHours * 36e5; });
      var pending = 0; my.forEach(function (t) { if (t.status !== 'done' && t.status !== 'cancel') pending += (t.confirm || []).length; });   // questions on finished tasks never count
      var done = my.filter(function (t) { return t.status === 'done'; }).sort(function (x, y) { return (tms(y.end, now) || lastT(y)) - (tms(x.end, now) || lastT(x)); });

      var status;
      if (a.gone) status = 'offline';
      else if (stuck.length) status = 'stuck';
      else if (recent.length) status = 'working';
      else if (!last || now - last > R.offlineHours * 36e5) status = 'offline';
      else if (pending) status = 'waiting_approval';
      else if (done[0] && tms(done[0].end, now) && now - tms(done[0].end, now) <= R.doneMinutes * 6e4) status = 'done';
      else status = 'idle';

      var cur = stuck[0] || recent[0] || run[0] || null;
      return {
        id: a.id, name: a.name, role: a.main ? 'lead' : 'assistant', color: a.color || null,
        kind: a.kind === 'human' ? 'human' : 'ai', isBoss: !!a.main,
        status: status, currentTask: cur ? cur.name : null,
        project: cur ? cur.project || null : null, projectName: cur ? pname(cur.project) : null,
        lastActive: iso(last),
        tasks: my.map(function (t) {
          var id = hash(a.id + '|' + t.name), subs = t.subs || [];
          var sd = subs.filter(function (s) { return s && s[1] === 'done'; }).length;
          return {
            id: id, title: t.name,
            status: isStuck(t) ? 'stuck' : (TASK_ST[t.status] || t.status),
            project: t.project || null, projectName: pname(t.project), type: t.type || null,
            startedAt: iso(tms(t.start, now)), updatedAt: iso(lastT(t)), doneAt: iso(tms(t.end, now)),
            progress: t.status === 'done' ? 1 : subs.length ? Math.round(sd / subs.length * 100) / 100 : null,
            note: t.note || null,
            subtasks: subs.map(function (s) { return { title: s[0], status: TASK_ST[s[1]] || s[1] }; }),
            confirms: (t.confirm || []).map(function (q, i) {
              return typeof q === 'string' ? { id: id + '-c' + i, question: q, status: 'pending' }
                : { id: q.id || id + '-c' + i, question: q.question || q.q || '', status: q.status || 'pending' };
            })
          };
        })
      };
    });
    return { schemaVersion: 1, office: { name: opts.name || 'AI 像素办公室', updatedAt: iso(tms(raw.built, now)) }, projects: projects, agents: agents };
  }
  convert.detect = function (raw) { return !!(raw && Array.isArray(raw.tasks) && Array.isArray(raw.agents) && !raw.office); };
  convert.RULES = RULES; convert.convert = convert;
  return convert;
});
