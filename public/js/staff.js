/* Staff pages: project queue (B23), project review and dated rates.
   PREVIEW ONLY: no staff sign-in, and data lives in this browser (see projects.js). */
(function () {
  'use strict';
  var FT = window.FT, P = FT && FT.projects;
  if (!P) return;
  P.seedDemo();
  var esc = P.esc, COLOR_NAMES = window.FT_COLOR_NAMES || {};
  var FRACTIONS = ['', '1/4', '1/2', '3/4'];
  function fmtQin(q) {
    q = Math.max(0, Math.round(q || 0));
    var ft = Math.floor(q / 48), inch = Math.floor((q % 48) / 4), frac = q % 4;
    var inPart = (inch || frac) ? (inch ? inch : '') + (frac ? (inch ? ' ' : '') + FRACTIONS[frac] : '') + ' in' : '';
    return ft ? ft + ' ft' + (inPart ? ' ' + inPart : '') : inPart || '0 in';
  }
  function customer(p) { return ((p.first || '') + ' ' + (p.last || '')).trim() || p.email || 'Customer'; }
  function lastChange(p) { return p.updatedAt || p.createdAt; }

  // ---------- Queue ----------
  var queueEl = document.getElementById('staff-queue');
  if (queueEl) {
    var QUEUES = [
      ['review', 'Needs review', ['submitted', 'reply-received']],
      ['waiting', 'Waiting on customer', ['waiting', 'needs-fix', 'awaiting-approval', 'deposit-due', 'balance-due']],
      ['design', 'Design', ['designing']],
      ['production', 'Production', ['scheduled', 'in-production', 'quality', 'ready-to-ship', 'shipped']],
      ['drafts', 'In progress', ['estimate', 'in-progress']],
      ['all', 'All', null],
    ];
    var q = (location.hash.match(/q=(\w+)/) || [])[1] || 'review';
    var renderQueue = function () {
      var list = P.all();
      document.querySelector('[data-queue-tabs]').innerHTML = QUEUES.map(function (x) {
        var n = x[2] ? list.filter(function (p) { return x[2].indexOf(p.state) >= 0; }).length : list.length;
        return '<button type="button" role="tab" data-q="' + x[0] + '" aria-selected="' + (x[0] === q) + '">' + x[1] + ' <span class="count">' + n + '</span></button>';
      }).join('');
      var cur = QUEUES.filter(function (x) { return x[0] === q; })[0];
      var rows = list.filter(function (p) { return !cur[2] || cur[2].indexOf(p.state) >= 0; })
        .sort(function (a, b) { return lastChange(a) < lastChange(b) ? -1 : 1; });
      if (!rows.length) { queueEl.innerHTML = '<div class="panel empty-state"><p class="muted">Nothing in this queue.</p></div>'; return; }
      queueEl.innerHTML = '<div class="table-wrap"><table class="queue-table"><thead><tr><th scope="col">Project</th><th scope="col">Customer</th><th scope="col">State</th><th scope="col">Next action</th><th scope="col">Owner</th><th scope="col">Age in state</th></tr></thead><tbody>' +
        rows.map(function (p) {
          var age = P.ageDays(lastChange(p)), st = P.STATES[p.state];
          var owner = st.tone === 'warn' || st.tone === 'error' ? 'Customer' : 'Build team';
          return '<tr><td><a href="' + FT.link('/staff-project') + '#p=' + encodeURIComponent(p.id) + '"><strong>' + esc(p.name) + '</strong></a><br><span class="muted">' + p.runs.length + ' run' + (p.runs.length === 1 ? '' : 's') + ' · ' + p.height + ' in</span></td>' +
            '<td>' + esc(customer(p)) + '</td><td>' + P.badge(p.state) + '</td><td>' + esc(st.staff) + '</td><td>' + owner + '</td>' +
            '<td class="' + (age >= 3 ? 'age-old' : '') + '">' + age + ' day' + (age === 1 ? '' : 's') + '</td></tr>';
        }).join('') + '</tbody></table></div>';
    };
    document.querySelector('[data-queue-tabs]').addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-q]'); if (!b) return;
      q = b.dataset.q; history.replaceState(null, '', '#q=' + q); renderQueue();
    });
    renderQueue();
  }

  // ---------- Project review ----------
  var projEl = document.getElementById('staff-project');
  if (projEl) {
    var pid = decodeURIComponent((location.hash.match(/p=([^&]+)/) || [])[1] || '');
    var p = P.get(pid);
    if (!p) { projEl.innerHTML = '<div class="panel empty-state"><h1>Project not found</h1><a class="btn btn-outline" href="' + FT.link('/staff') + '">Back to the queue</a></div>'; return; }
    p.verified = p.verified || {};
    var NEXT = { submitted: 'designing', 'reply-received': 'designing', designing: null, 'awaiting-approval': null, 'deposit-due': 'scheduled', scheduled: 'in-production', 'in-production': 'quality', quality: 'balance-due', 'balance-due': 'ready-to-ship', 'ready-to-ship': 'shipped', shipped: 'delivered', delivered: 'closed' };
    var vRow = function (key, label, value, check) {
      var ok = p.verified[key];
      return '<tr><th scope="row">' + label + '</th><td>' + (value ? esc(value) : '<span class="muted">Missing</span>') + (check ? ' ' + check : '') + '</td><td>' +
        (ok ? '<span class="state-badge ok"><span class="state-dot" aria-hidden="true">✓</span>Verified</span>' : '<button type="button" class="btn btn-outline btn-small" data-verify="' + key + '"' + (value ? '' : ' disabled') + '>Verify</button>') +
        ' <button type="button" class="why-link" data-ask="' + esc(label) + '">Ask</button></td></tr>';
    };
    var renderProject = function () {
      var e = P.estimate(p), st = P.STATES[p.state], next = NEXT[p.state];
      var S = p.setup, m = P.method(p), req = P.requirements(p);
      var fit = function (id) { var f = (P.EXT_FIT[id] || {}).fit; return f === 'proven' ? '<span class="tag-ok">Proven fit</span>' : f === 'planning' ? '<span class="tag-error">Needs planning</span>' : f ? '<span class="tag-error">Review</span>' : ''; };
      var base = (P.BASES.filter(function (x) { return x.id === S.base; })[0] || {}).name || '';
      var extTxt = S.extStatus === 'custom' ? 'Custom: ' + S.customDesc : S.extender ? P.extName(S.extender) : S.helpExt ? 'Customer asked for a recommendation' : '';
      var setupTable = '<section class="panel"><h3>Project overview</h3><table class="value-table"><tbody>' +
        vRow('ext', 'Extensions', [{ installed: 'Installed', planned: 'Planned', undecided: 'Undecided', custom: 'Custom design' }[S.extStatus], extTxt].filter(Boolean).join(' · '), fit(S.extender || (S.extStatus === 'custom' ? 'custom' : ''))) +
        vRow('base', 'Mounted on', base, S.base === 'square' || S.base === 'rail' ? '<span class="tag-error">Needs planning</span>' : '') +
        vRow('posts', 'Extension size', P.sizeLabel(S.post)) +
        vRow('topper', 'Topper', (COLOR_NAMES[p.color] || p.color) + ', ' + (S.sameHeight === 'no' ? 'height per run' : p.height + ' in')) +
        vRow('method', 'Measured as', m === 'gap' ? 'Gap between installed posts (edge to edge)' : 'Center to center, planned locations') +
        '</tbody></table>' +
        (req.items.length ? '<h4>Open items</h4><ul class="staff-open">' + req.items.map(function (x) { return '<li class="' + x.level + '">' + (x.level === 'needed' ? '<span class="tag-error">Needed</span> ' : '<span class="tag-ok">Review</span> ') + esc(x.label) + '</li>'; }).join('') + '</ul>' : '<p class="tag-ok">Nothing open</p>') +
        '</section>';
      var runs = setupTable + p.runs.map(function (r, i) {
        var len = P.runLength(p, r);
        var seq = r.posts.map(function (post, k) {
          var sp = P.postSpec(p, r, k), end = k === 0 || k === r.posts.length - 1;
          var name = k === 0 ? 'Left end' : end ? 'Right end' : 'Middle ' + k;
          var row = '<tr><th scope="row">' + name + '</th><td>' + esc(P.sizeLabel(sp) || '—') + (post.spec ? ' <span class="tag-ok">Override</span>' : '') + (end && post.kind && post.kind !== 'end' ? ' · ' + esc(post.kind) : '') + '</td></tr>';
          if (k < r.posts.length - 1) row += '<tr><th scope="row" class="muted">' + (m === 'gap' ? 'Gap' : 'C to C') + '</th><td>' + (r.spans[k] > 0 ? fmtQin(r.spans[k]) : r.unsure[k] ? '<span class="tag-error">Not sure</span>' : '<span class="tag-error">Missing</span>') + '</td></tr>';
          return row;
        }).join('');
        var photos = P.photoSlots(r).map(function (sl) {
          var ph = r.photos[sl.id];
          return '<li class="' + (ph ? 'has' : 'missing') + '">' + (ph && ph.thumb ? '<img src="' + ph.thumb + '" alt="" />' : '<span aria-hidden="true">' + (ph ? '✓' : '○') + '</span>') + esc(sl.name) + '</li>';
        }).join('');
        return '<section class="panel"><h3>' + esc(r.name) + ' · ' + (len ? fmtQin(len) + ' C to C' : 'estimate ' + fmtQin(r.qin)) + '</h3>' +
          '<p class="muted">' + r.posts.length + ' posts · ' + P.runHeight(p, r) + ' in · ' + esc(COLOR_NAMES[P.runColor(p, r)] || '') + (r.extender ? ' · ' + esc(P.extName(r.extender)) + ' ' + fit(r.extender) : '') + '</p>' +
          '<table class="value-table"><tbody>' + vRow(i + '-seq', 'Measurements', r.spans.every(function (x) { return x > 0; }) ? 'Complete' : '') + '</tbody></table>' +
          '<details><summary>Posts and measurements, left to right</summary><table class="value-table"><tbody>' + seq + '</tbody></table></details>' +
          '<h4>Photos</h4><ul class="staff-photos">' + photos + '</ul>' + (r.notes ? '<p><strong>Notes:</strong> ' + esc(r.notes) + '</p>' : '') + '</section>';
      }).join('');
      var s = p.shipping;
      var estRows = p.estimates.slice().reverse().map(function (x) {
        return '<tr><td>' + P.when(x.at) + '</td><td>' + esc(x.source) + '</td><td>v' + x.rateVersion + '</td><td>' + FT.money(x.total) + '</td></tr>';
      }).join('');
      projEl.innerHTML =
        '<a class="link" href="' + FT.link('/staff') + '">← Queue</a>' +
        '<header class="staff-proj-head"><div><h1>' + esc(p.name) + '</h1><p class="muted">' + esc(customer(p)) + ' · ' + esc(p.email || '') + ' · ' + p.height + ' in · ' + esc(COLOR_NAMES[p.color] || p.color) + '</p></div>' + P.badge(p.state) + '</header>' +
        '<div class="staff-grid">' +
          '<div class="staff-col">' + runs + '<section class="panel"><h3>Shipping</h3><p>' + (s.street ? esc([s.name, s.street, s.city + ', ' + s.state + ' ' + s.zip].join(', ')) : '<span class="muted">Not entered</span>') + '</p></section></div>' +
          '<div class="staff-col">' +
            '<section class="panel"><h3>Actions</h3><p class="muted">Now: ' + esc(st.staff) + '</p>' +
              '<div class="field"><label for="ask-text">Ask the customer</label><textarea id="ask-text" placeholder="What do you need from them?"></textarea></div>' +
              '<button class="btn btn-outline btn-block" type="button" data-ask-send>Send question</button>' +
              (P.stateAtLeast(p, 'submitted') && !P.stateAtLeast(p, 'awaiting-approval') ?
                '<hr><div class="field"><label for="final-price">Final price ($)</label><input id="final-price" type="number" step="0.01" inputmode="decimal" value="' + e.total + '" /><span class="hint">Estimate ' + FT.money(e.total) + ' at rates v' + e.rateVersion + '</span></div>' +
                '<div class="field"><label for="final-note">Note to customer <span class="muted">(optional)</span></label><textarea id="final-note"></textarea></div>' +
                '<button class="btn btn-primary btn-block" type="button" data-publish>Publish design and price</button>' : '') +
              (next ? '<hr><button class="btn btn-outline btn-block" type="button" data-advance="' + next + '">Move to: ' + esc(P.STATES[next].staff) + '</button>' : '') +
              '<a class="btn btn-outline btn-block" href="' + FT.link('/project') + '#p=' + encodeURIComponent(p.id) + '">Open customer view</a>' +
            '</section>' +
            '<section class="panel"><h3>Estimate versions</h3><div class="table-wrap"><table><thead><tr><th scope="col">When</th><th scope="col">From</th><th scope="col">Rates</th><th scope="col">Total</th></tr></thead><tbody>' + (estRows || '<tr><td colspan="4" class="muted">None</td></tr>') + '</tbody></table></div>' +
              '<p class="hint">Current rates (v' + e.rateVersion + ') give ' + FT.money(e.total) + '.</p></section>' +
          '</div>' +
          '<div class="staff-col">' +
            '<section class="panel"><h3>Messages</h3><ul class="thread">' + (p.questions.map(function (x) { return '<li class="msg mine"><span class="msg-who">FenceTopper · ' + P.when(x.at) + (x.answered ? ' · answered' : '') + '</span><p>' + esc(x.text) + '</p></li>'; }).join('') +
              p.messages.map(function (m) { return '<li class="msg"><span class="msg-who">' + esc(m.who) + ' · ' + P.when(m.at) + '</span><p>' + esc(m.text) + '</p></li>'; }).join('') || '<li class="muted">No messages.</li>') + '</ul></section>' +
            '<section class="panel"><h3>Activity</h3><ol class="activity">' + p.activity.slice().reverse().map(function (a) { return '<li><span class="muted">' + P.when(a.at) + '</span> ' + esc(a.who) + ': ' + esc(a.text) + '</li>'; }).join('') + '</ol></section>' +
          '</div>' +
        '</div>';
    };
    projEl.addEventListener('click', function (ev) {
      var b = ev.target.closest('button'); if (!b) return;
      if (b.dataset.verify) { p.verified[b.dataset.verify] = true; P.log(p, 'Staff', 'Verified ' + b.dataset.verify); }
      else if (b.dataset.ask) { var t = document.getElementById('ask-text'); t.value = b.dataset.ask + ': '; t.focus(); return; }
      else if (b.hasAttribute('data-ask-send')) {
        var txt = document.getElementById('ask-text').value.trim(); if (!txt) return;
        p.questions.push({ run: null, field: '', text: txt, at: new Date().toISOString() });
        p.state = 'waiting'; P.log(p, 'Staff', 'Asked the customer a question');
      } else if (b.hasAttribute('data-publish')) {
        var price = Math.round(Number(document.getElementById('final-price').value) * 100) / 100;
        if (!(price > 0)) { document.getElementById('final-price').focus(); return; }
        var v = (p.finalDesign ? p.finalDesign.version : 0) + 1;
        p.finalDesign = { version: v, date: P.today(), price: price, note: document.getElementById('final-note').value.trim() };
        P.recordEstimate(p, 'Final design v' + v);
        p.state = 'awaiting-approval'; P.log(p, 'Staff', 'Published design version ' + v + ' at ' + FT.money(price));
      } else if (b.dataset.advance) { p.state = b.dataset.advance; P.log(p, 'Staff', 'Moved to ' + P.STATES[p.state].staff); }
      else return;
      P.save(p); renderProject(); FT.toast('Saved');
    });
    renderProject();
  }

  // ---------- Rates ----------
  var ratesEl = document.getElementById('staff-rates');
  if (ratesEl) {
    var renderRates = function (msg) {
      var list = P.rateSchedule(), active = P.activeRates(), t = P.today();
      var counts = {};
      P.all().forEach(function (p) { p.estimates.forEach(function (x) { counts[x.rateVersion] = (counts[x.rateVersion] || 0) + 1; }); });
      var fmt = function (f, v) { return f[2] === '$' ? FT.money(v) : v + ' ' + f[2]; };
      ratesEl.innerHTML = (msg ? '<div class="note ok-note" role="status">' + esc(msg) + '</div>' : '') +
        '<section class="panel"><h2>Rate versions</h2><div class="table-wrap"><table class="rates-table"><thead><tr><th scope="col">Version</th><th scope="col">Status</th><th scope="col">Effective</th>' +
        P.RATE_FIELDS.map(function (f) { return '<th scope="col">' + esc(f[1]) + '</th>'; }).join('') + '<th scope="col">Estimates</th><th scope="col">Note</th></tr></thead><tbody>' +
        list.slice().reverse().map(function (r) {
          var status = r.id === active.id ? '<span class="state-badge ok"><span class="state-dot" aria-hidden="true">✓</span>Active</span>' : r.effective > t ? '<span class="state-badge info"><span class="state-dot" aria-hidden="true">i</span>Scheduled</span>' : '<span class="muted">Past</span>';
          return '<tr><td>v' + r.version + '</td><td>' + status + '</td><td>' + esc(r.effective) + '</td>' + P.RATE_FIELDS.map(function (f) { return '<td>' + fmt(f, r[f[0]]) + '</td>'; }).join('') +
            '<td>' + (counts[r.version] || 0) + '</td><td>' + esc(r.note) + '<br><span class="muted">' + esc(r.by) + ' · ' + P.when(r.createdAt) + '</span></td></tr>';
        }).join('') + '</tbody></table></div></section>' +
        '<section class="panel"><h2>Add a rate version</h2><p class="muted">Starts with the active rates. Saved versions can’t be edited, so estimates always show the rates they used.</p><form id="rate-form" class="rate-form" novalidate>' +
        P.RATE_FIELDS.map(function (f) { return '<div class="field"><label for="rate-' + f[0] + '">' + esc(f[1]) + ' (' + f[2] + ')</label><input id="rate-' + f[0] + '" name="' + f[0] + '" type="number" min="0" step="0.01" inputmode="decimal" required value="' + active[f[0]] + '" /></div>'; }).join('') +
        '<div class="field"><label for="rate-effective">Effective date</label><input id="rate-effective" name="effective" type="date" required value="' + t + '" /><span class="hint">Today or later. A future date schedules the change.</span></div>' +
        '<div class="field"><label for="rate-note">Reason</label><input id="rate-note" name="note" type="text" placeholder="For example, aluminum cost increase" /></div>' +
        '<p class="field-error" id="rate-error" role="alert" hidden></p>' +
        '<button class="btn btn-primary" type="submit">Save rate version</button></form></section>';
      document.getElementById('rate-form').addEventListener('submit', function (ev) {
        ev.preventDefault();
        var f = ev.target, vals = {}, bad = null;
        P.RATE_FIELDS.forEach(function (x) { var v = Number(f[x[0]].value); if (!(f[x[0]].value !== '' && v >= 0)) bad = bad || f[x[0]]; vals[x[0]] = v; });
        if (!(vals.maxPostSpacingFt > 0)) bad = bad || f.maxPostSpacingFt;
        var err = document.getElementById('rate-error');
        if (bad) { err.textContent = 'Enter a number for every rate.'; err.hidden = false; bad.focus(); return; }
        if (!f.effective.value || f.effective.value < t) { err.textContent = 'Choose today or a later date.'; err.hidden = false; f.effective.focus(); return; }
        var rec = P.addRateVersion(vals, f.effective.value, f.note.value.trim(), 'Staff');
        P.applyActiveRates();
        renderRates('Saved version ' + rec.version + (rec.effective > t ? ', starting ' + rec.effective : ', active now') + '.');
      });
    };
    renderRates();
  }
})();
