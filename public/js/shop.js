/* Shop estimate: fence runs (ft + in + quarter-inch fraction) + height + color -> estimate.
   Build my Topper checks the two confirmations, then opens the save sheet (name, email,
   one-time code). Lengths are stored as integer quarter-inches. Front-end math is a preview only. */
(function () {
  'use strict';
  var FT = window.FT;
  var form = document.getElementById('shop-form');
  if (!form || !FT) return;
  var runsEl = document.getElementById('runs');
  var summary = document.getElementById('summary');
  var strip = document.getElementById('strip');
  var runCount = 0;
  var heightCtl = FT.heightStepper(form.querySelector('[data-height-stepper]'), function () { update(); });
  var moveStatus = document.getElementById('move-status');

  var NAMES = { carbon: 'Carbon', black: 'Black', evergreen: 'Evergreen', brown: 'Brown' };
  var FRACTIONS = [['0', 'None'], ['1', '1/4'], ['2', '1/2'], ['3', '3/4']];
  var CONFIRMS = ['straight', 'extenders'];

  // 1945 (quarter-inches) -> "40 ft 6 1/4 in"
  function fmtQin(q) {
    q = Math.max(0, Math.round(q));
    var ft = Math.floor(q / 48), inch = Math.floor((q % 48) / 4), frac = q % 4;
    var inPart = (inch || frac) ? (inch ? inch : '') + (frac ? (inch ? ' ' : '') + FRACTIONS[frac][1] : '') + ' in' : '';
    if (!ft) return inPart || '0 in';
    return ft + ' ft' + (inPart ? ' ' + inPart : '');
  }

  function addRun(qin) {
    runCount++;
    var id = 'run-' + runCount;
    var ft = qin ? Math.floor(qin / 48) : '';
    var inch = qin ? Math.floor((qin % 48) / 4) : '';
    var frac = qin ? qin % 4 : 0;
    var row = document.createElement('div');
    row.className = 'run';
    row.innerHTML =
      '<fieldset class="measure-input" data-qin="' + (qin || 0) + '">' +
        '<legend>Run</legend>' +
        '<div class="measure-fields">' +
          '<div class="unit-input"><label class="sr-only" for="' + id + '-ft">feet</label><input id="' + id + '-ft" data-ft type="number" min="0" max="999" step="1" inputmode="numeric" placeholder="0" value="' + ft + '" /><span aria-hidden="true">ft</span></div>' +
          '<div class="unit-input"><label class="sr-only" for="' + id + '-in">inches</label><input id="' + id + '-in" data-in type="number" min="0" max="11" step="1" inputmode="numeric" placeholder="0" value="' + inch + '" /><span aria-hidden="true">in</span></div>' +
          '<div><label class="sr-only" for="' + id + '-fr">fraction of an inch</label><select id="' + id + '-fr" data-fr>' +
            FRACTIONS.map(function (f) { return '<option value="' + f[0] + '"' + (Number(f[0]) === frac ? ' selected' : '') + '>' + f[1] + '</option>'; }).join('') +
          '</select></div>' +
        '</div>' +
        '<span class="hint" id="' + id + '-hint" aria-live="polite" hidden></span>' +
      '</fieldset>' +
      '<div class="run-actions">' +
        '<button type="button" class="move" data-move="-1"><span aria-hidden="true">↑</span></button>' +
        '<button type="button" class="move" data-move="1"><span aria-hidden="true">↓</span></button>' +
        '<button type="button" class="remove">Remove</button>' +
      '</div>';
    row.querySelector('.remove').addEventListener('click', function () {
      if (runsEl.children.length > 1) { row.remove(); relabel(); update(); runsEl.querySelector('[data-ft]').focus(); }
    });
    row.querySelectorAll('[data-move]').forEach(function (b) {
      b.addEventListener('click', function () {
        var dir = Number(b.dataset.move);
        var other = dir < 0 ? row.previousElementSibling : row.nextElementSibling;
        if (!other) return;
        runsEl.insertBefore(row, dir < 0 ? other : other.nextElementSibling);
        relabel(); update();
        var n = Array.prototype.indexOf.call(runsEl.children, row) + 1;
        moveStatus.textContent = 'Moved to run ' + n + '.';
        (b.disabled ? row.querySelector('[data-move="' + -dir + '"]') : b).focus();
      });
    });
    row.querySelectorAll('input, select').forEach(function (i) { i.addEventListener('input', update); });
    // Typing 12 or more inches carries over to feet, and the hint says so.
    var inEl = row.querySelector('[data-in]'), ftEl = row.querySelector('[data-ft]'), hint = row.querySelector('.hint');
    inEl.addEventListener('blur', function () {
      var n = Math.floor(Number(inEl.value) || 0);
      if (n < 12) return;
      var extra = Math.floor(n / 12);
      ftEl.value = (Math.floor(Number(ftEl.value) || 0)) + extra;
      inEl.value = n % 12;
      hint.textContent = 'We moved ' + extra * 12 + ' in to feet.';
      hint.hidden = false;
      update();
    });
    inEl.addEventListener('focus', function () { hint.hidden = true; });
    runsEl.appendChild(row);
    relabel();
  }

  function relabel() {
    var count = runsEl.children.length, only = count === 1;
    Array.prototype.forEach.call(runsEl.children, function (r, i) {
      r.querySelector('legend').textContent = 'Run ' + (i + 1);
      var up = r.querySelector('[data-move="-1"]'), down = r.querySelector('[data-move="1"]');
      up.hidden = down.hidden = only;
      up.disabled = i === 0; down.disabled = i === count - 1;
      up.setAttribute('aria-label', 'Move run ' + (i + 1) + ' up');
      down.setAttribute('aria-label', 'Move run ' + (i + 1) + ' down');
      var rm = r.querySelector('.remove');
      rm.hidden = only;
      rm.setAttribute('aria-label', 'Remove run ' + (i + 1));
    });
  }
  function checked(name) { return form.querySelector('input[name="' + name + '"]:checked'); }

  // Each run as integer quarter-inches.
  function rowQin(r) {
    var ft = Math.max(0, Math.floor(Number(r.querySelector('[data-ft]').value) || 0));
    var inch = Math.max(0, Math.floor(Number(r.querySelector('[data-in]').value) || 0));
    var frac = Number(r.querySelector('[data-fr]').value) || 0;
    var q = ft * 48 + inch * 4 + frac;
    r.querySelector('.measure-input').dataset.qin = q;
    return q;
  }

  function config() {
    var qin = Array.prototype.map.call(runsEl.children, rowQin);
    return {
      runQin: qin,
      runs: qin.map(function (q) { return q / 48; }), // decimal feet, read by the chat and visualizer
      height: heightCtl.get(),
      color: checked('color').value,
      confirmed: CONFIRMS.filter(function (k) { return document.getElementById('confirm-' + k).checked; }),
    };
  }

  function drawStrip(hex, height) {
    var g = strip.getContext('2d'), w = strip.width, h = strip.height;
    g.clearRect(0, 0, w, h);
    var fenceTop = 70, th = height / 72 * 200; // 6 ft fence = 200px tall at this scale
    for (var x = 0; x < w; x += 22) { g.fillStyle = x % 44 ? '#b07a4a' : '#a56f40'; g.fillRect(x, fenceTop, 21, h - fenceTop); }
    g.fillStyle = hex; g.fillRect(0, fenceTop - th, w, th);
    g.fillStyle = 'rgba(255,255,255,.06)'; for (x = 0; x < w; x += 3) g.fillRect(x, fenceTop - th, 1, th);
    for (x = 40; x < w; x += 240) { g.fillStyle = '#111'; g.fillRect(x - 3, fenceTop - th - 4, 6, th + 4); }
  }

  function describe(cfg, q) {
    return fmtQin(q.totalQin) + ' across ' + q.panels + ' run' + (q.panels === 1 ? '' : 's') +
      ' · ' + cfg.height + ' in · ' + NAMES[cfg.color] + ' · estimate ' + FT.money(q.total);
  }

  function update() {
    var cfg = config();
    var q = FT.quote(cfg);
    var colorEl = checked('color');
    document.getElementById('color-note').textContent = colorEl.dataset.note;
    drawStrip(colorEl.dataset.hex, cfg.height);
    var has = q.totalQin > 0;
    var P = FT.PRICING, sq = Math.round(q.sqft * 100) / 100;
    var rows = [
      ['Total length', has ? fmtQin(q.totalQin) : '—'],
      ['Topper area', has ? sq + ' sq ft' : '—'],
      ['Panels', has ? q.panels : '—'],
      ['Height and color', cfg.height + ' in · ' + NAMES[cfg.color]],
      ['<span class="sum-line">Topper area <span class="muted">(' + sq + ' sq ft × ' + FT.money(P.perSqFt) + ')</span></span>', has ? FT.money(q.area) : '—', 'charge first'],
      ['Middle posts (estimated)', has ? FT.money(q.postCost) : '—', 'charge'],
      ['<span class="sum-line">Panels <span class="muted">(' + q.panels + ' × ' + FT.money(P.perPanel) + ')</span></span>', has ? FT.money(q.build) : '—', 'charge'],
      ['Shipping', has ? (q.total >= P.freeShippingOver ? 'Free' : 'With your design') : '—'],
    ];
    summary.innerHTML = rows.map(function (r) { var c = r[2] ? ' class="' + r[2] + '"' : ''; return '<dt' + c + '>' + r[0] + '</dt><dd' + c + '>' + r[1] + '</dd>'; }).join('') +
      '<dt class="total">Estimated total</dt><dd class="total">' + (has ? FT.money(q.total) : '$0') + '</dd>';
    FT.store.set('draft', { runs: cfg.runs, runQin: cfg.runQin, height: cfg.height, color: cfg.color, confirmed: cfg.confirmed });
    return { cfg: cfg, q: q };
  }

  // Restore the estimate (from an earlier visit, the chat or the visualizer).
  var draft = FT.store.get('draft', null);
  if (draft && draft.runQin && draft.runQin.length) {
    draft.runQin.forEach(function (q, i) { addRun(Number(q) || 0); });
  } else if (draft && draft.runs && draft.runs.length) {
    draft.runs.forEach(function (r, i) { addRun(Math.round(Number(r) * 48)); });
  } else {
    addRun(48 * 48);
  }
  if (draft) {
    if (draft.height) heightCtl.set(FT.clampHeight(draft.height));
    (draft.confirmed || []).forEach(function (k) { var el = document.getElementById('confirm-' + k); if (el) el.checked = true; });
  }
  var savedColor = (draft && draft.color) || FT.store.get('color', null);
  var c = savedColor && form.querySelector('input[name="color"][value="' + savedColor + '"]'); if (c) c.checked = true;

  document.getElementById('add-run').addEventListener('click', function () {
    addRun(0); update(); runsEl.lastChild.querySelector('[data-ft]').focus();
  });
  form.addEventListener('change', update);

  // "Why?" explanation under the straight-and-level confirmation
  var why = document.getElementById('why-toggle'), whyText = document.getElementById('why-text');
  why.addEventListener('click', function () {
    whyText.hidden = !whyText.hidden;
    why.setAttribute('aria-expanded', String(!whyText.hidden));
  });
  CONFIRMS.forEach(function (k) {
    var box = document.getElementById('confirm-' + k);
    box.addEventListener('change', function () {
      if (!box.checked) return;
      document.getElementById('confirm-' + k + '-error').hidden = true;
      box.closest('.confirm').classList.remove('error');
    });
  });

  // ---------- Build my Topper -> save sheet -> code -> saved ----------
  var sheet = document.getElementById('save-sheet');
  var project = null, resendTimer = null;
  function showStep(name) {
    sheet.querySelectorAll('[data-step]').forEach(function (s) { s.hidden = s.dataset.step !== name; });
  }
  function openSheet() {
    if (typeof sheet.showModal === 'function') { if (!sheet.open) sheet.showModal(); }
    else sheet.setAttribute('open', '');
  }
  function closeSheet() {
    if (typeof sheet.close === 'function') sheet.close(); else sheet.removeAttribute('open');
  }
  function fill() {
    sheet.querySelectorAll('[data-build-summary]').forEach(function (el) { el.textContent = project.label; });
    sheet.querySelectorAll('[data-dest]').forEach(function (el) { el.textContent = project.via === 'text' ? project.mobile : project.email; });
    sheet.querySelectorAll('[data-first]').forEach(function (el) { el.textContent = project.first; });
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var r = update();
    var rows = Array.prototype.slice.call(runsEl.children);
    rows.forEach(function (row) { row.querySelector('.measure-input').classList.remove('error'); });
    if (!r.q.totalQin) {
      rows[0].querySelector('.measure-input').classList.add('error');
      FT.toast('Enter at least one fence run in feet and inches.');
      rows[0].querySelector('[data-ft]').focus();
      return;
    }
    var firstMissing = null;
    CONFIRMS.forEach(function (k) {
      var box = document.getElementById('confirm-' + k);
      var missing = !box.checked;
      document.getElementById('confirm-' + k + '-error').hidden = !missing;
      box.closest('.confirm').classList.toggle('error', missing);
      if (missing && !firstMissing) firstMissing = box;
    });
    if (firstMissing) {
      firstMissing.focus();
      firstMissing.closest('.confirm').scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    var prior = FT.store.get('contact', {});
    project = {
      id: Date.now(),
      runQin: r.cfg.runQin.filter(Boolean),
      estimatedMiddlePosts: r.q.posts,
      sqft: r.q.sqft,
      totalQin: r.q.totalQin,
      height: r.cfg.height,
      color: r.cfg.color,
      confirmed: { straight: new Date().toISOString(), extenders: new Date().toISOString() },
      extender: FT.store.get('extender', null),
      estimate: r.q.total,
      label: describe(r.cfg, r.q),
      first: prior.first || '', last: prior.last || '', email: prior.email || '', mobile: prior.mobile || '', via: 'email',
    };
    document.getElementById('s-first').value = project.first;
    document.getElementById('s-last').value = project.last;
    document.getElementById('s-email').value = project.email;
    document.getElementById('s-mobile').value = project.mobile;
    detailsErr.hidden = true;
    fill();
    showStep('details');
    openSheet();
    setTimeout(function () { document.getElementById(project.first ? 's-email' : 's-first').focus(); }, 50);
  });

  // Launch mode (no Builder yet): send the estimate and contact details to the team.
  var BUILDER = !!(window.FT_FEATURES || {}).builder;
  function sendProject(v) {
    project.first = v('s-first'); project.last = v('s-last'); project.email = v('s-email'); project.mobile = v('s-mobile');
    project.notes = v('s-notes'); project.updates = document.getElementById('s-consent').checked; project.via = 'email';
    FT.store.set('contact', { first: project.first, last: project.last, email: project.email, mobile: project.mobile });
    var endpoint = (window.FT_FORMS || {}).endpoint;
    var payload = {
      _subject: 'FenceTopper project: ' + project.first + ' ' + project.last,
      name: project.first + ' ' + project.last, email: project.email, mobile: project.mobile,
      summary: project.label, runs: project.runQin.map(function (q) { var fr = ['', ' 1/4', ' 1/2', ' 3/4'][q % 4]; return Math.floor(q / 48) + ' ft ' + Math.floor((q % 48) / 4) + fr + ' in'; }).join(', '),
      height_in: project.height, color: project.color, estimate: FT.money(project.estimate),
      extender: project.extender ? project.extender.name : '', notes: project.notes, wants_updates: project.updates ? 'yes' : 'no',
    };
    var btn = detailsForm.querySelector('button[type=submit]');
    var done = function (sent) {
      btn.disabled = false; btn.textContent = 'Send my project';
      fill(); sheet.querySelector('[data-not-sent]').hidden = sent; showStep('sent');
      var projects = FT.store.get('projects', []) || []; project.state = sent ? 'sent' : 'not-sent'; projects.push(project); FT.store.set('projects', projects);
      sheet.querySelector('[data-step="sent"] [data-close-sheet]').focus();
    };
    if (!endpoint) { done(false); return; }
    btn.disabled = true; btn.textContent = 'Sending…';
    fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(payload) })
      .then(function (r) { if (!r.ok) throw new Error(r.status); done(true); })
      .catch(function () { btn.disabled = false; btn.textContent = 'Send my project'; detailsErr.textContent = 'We couldn’t send that. Check your connection and try again, or email us.'; detailsErr.hidden = false; });
  }

  function describeName(pr) { return (pr.last ? pr.last + ' fence' : 'My FenceTopper'); }

  // Step 1: details
  var detailsForm = document.getElementById('details-form');
  var detailsErr = document.getElementById('details-error');
  detailsForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var v = function (id) { return document.getElementById(id).value.trim(); };
    var viaEl = detailsForm.querySelector('input[name="via"]:checked'), via = viaEl ? viaEl.value : 'email';
    var err = null, focus = null;
    if (!v('s-first')) { err = 'Enter your first name.'; focus = 's-first'; }
    else if (!v('s-last')) { err = 'Enter your last name.'; focus = 's-last'; }
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v('s-email'))) { err = 'Enter a valid email address, like name@example.com.'; focus = 's-email'; }
    else if (via === 'text' && v('s-mobile').replace(/\D/g, '').length < 10) { err = 'Enter your mobile number to get your code by text, or choose Email.'; focus = 's-mobile'; }
    if (err) { detailsErr.textContent = err; detailsErr.hidden = false; document.getElementById(focus).focus(); return; }
    detailsErr.hidden = true;
    if (!BUILDER) { sendProject(v); return; }
    project.first = v('s-first'); project.last = v('s-last'); project.email = v('s-email'); project.mobile = v('s-mobile');
    project.via = via; project.reminders = document.getElementById('s-consent').checked;
    FT.store.set('contact', { first: project.first, last: project.last, email: project.email, mobile: project.mobile });
    // PLACEHOLDER: production posts the contact and project to the account service, which
    // sends a 6-digit code by email or text. No service is connected yet.
    fill();
    clearCode();
    showStep('code');
    startResend();
    boxes[0].focus();
  });

  // Steps 2 and 3 (code, saved) exist only while the Builder is on; stand-ins keep this code inert without them.
  // Step 2: six single-digit boxes
  var codeForm = document.getElementById('code-form') || document.createElement('form');
  var boxes = Array.prototype.slice.call(codeForm.querySelectorAll('.code-boxes input'));
  var codeErr = document.getElementById('code-error');
  function clearCode() { boxes.forEach(function (b) { b.value = ''; }); codeErr.hidden = true; }
  boxes.forEach(function (b, i) {
    b.addEventListener('input', function () {
      var digits = b.value.replace(/\D/g, '');
      if (digits.length > 1) { // pasted or autofilled code
        digits.split('').slice(0, 6 - i).forEach(function (d, j) { boxes[i + j].value = d; });
        boxes[Math.min(i + digits.length, 5)].focus();
        return;
      }
      b.value = digits;
      if (digits && i < 5) boxes[i + 1].focus();
      codeErr.hidden = true;
    });
    b.addEventListener('keydown', function (e) {
      if (e.key === 'Backspace' && !b.value && i > 0) boxes[i - 1].focus();
    });
  });
  codeForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var code = boxes.map(function (b) { return b.value; }).join('');
    if (!/^\d{6}$/.test(code)) { codeErr.hidden = false; boxes[Math.max(0, code.length)].focus(); return; }
    // Preview only: any 6 digits stand in for a verified code.
    var rates = FT.projects ? FT.projects.activeRates() : null;
    project.state = 'in-progress';
    project.name = project.name || describeName(project);
    if (rates) { project.rateVersion = rates.version; project.rates = { perSqFt: rates.perSqFt, perMiddlePost: rates.perMiddlePost, perPanel: rates.perPanel, maxPostSpacingFt: rates.maxPostSpacingFt, freeShippingOver: rates.freeShippingOver }; }
    if (FT.projects) { FT.projects.save(FT.projects.normalize(project)); FT.projects.signIn(project); }
    else { var projects = FT.store.get('projects', []); projects.push(project); FT.store.set('projects', projects); }
    var openLink = sheet.querySelector('[data-open-project]');
    if (openLink) openLink.href = FT.link('/project') + '#p=' + project.id;
    stopResend();
    fill();
    showStep('saved');
  });
  var resendBtn = sheet.querySelector('[data-resend]') || document.createElement('button');
  function startResend() {
    var left = 30;
    stopResend();
    resendBtn.disabled = true;
    resendBtn.textContent = 'Resend code in ' + left + 's';
    resendTimer = setInterval(function () {
      left--;
      if (left > 0) { resendBtn.textContent = 'Resend code in ' + left + 's'; return; }
      stopResend();
    }, 1000);
  }
  function stopResend() {
    clearInterval(resendTimer); resendTimer = null;
    resendBtn.disabled = false; resendBtn.textContent = 'Resend code';
  }
  resendBtn.addEventListener('click', function () {
    FT.toast('Code sending isn’t connected yet, so nothing was sent.');
    startResend();
  });
  (sheet.querySelector('[data-change]') || document.createElement('button')).addEventListener('click', function () {
    stopResend(); showStep('details');
    var el = document.getElementById('s-email'); el.focus(); el.select();
  });
  sheet.addEventListener('close', stopResend);
  sheet.querySelectorAll('[data-close-sheet]').forEach(function (b) { b.addEventListener('click', closeSheet); });
  sheet.addEventListener('click', function (e) { if (e.target === sheet) closeSheet(); });

  update();
})();
