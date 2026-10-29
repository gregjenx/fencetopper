/* Sign in with a one-time code (preview: any 6 digits) and the My projects list. */
(function () {
  'use strict';
  var FT = window.FT, P = FT && FT.projects;
  if (!P) return;

  // ----- Sign in -----
  var signin = document.getElementById('signin-form');
  if (signin) {
    var contactEl = document.getElementById('a-contact'), err = document.getElementById('a-error');
    var steps = document.querySelectorAll('[data-step]');
    var show = function (n) { steps.forEach(function (s) { s.hidden = s.dataset.step !== n; }); };
    var contact = null;
    var prior = FT.store.get('contact', null);
    if (prior) contactEl.value = prior.email || prior.mobile || '';
    signin.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = contactEl.value.trim(), digits = v.replace(/\D/g, '');
      var isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
      if (!isEmail && digits.length < 10) { err.textContent = 'Enter your email, like name@example.com, or a 10-digit mobile number.'; err.hidden = false; contactEl.focus(); return; }
      err.hidden = true;
      contact = isEmail ? { email: v } : { mobile: v };
      document.querySelector('[data-dest]').textContent = v;
      show('code');
      boxes[0].focus();
    });
    var codeForm = document.getElementById('code-form');
    var boxes = Array.prototype.slice.call(codeForm.querySelectorAll('.code-boxes input'));
    boxes.forEach(function (b, i) {
      b.addEventListener('input', function () {
        var d = b.value.replace(/\D/g, '');
        if (d.length > 1) { d.split('').slice(0, 6 - i).forEach(function (x, j) { boxes[i + j].value = x; }); boxes[Math.min(i + d.length, 5)].focus(); return; }
        b.value = d; if (d && i < 5) boxes[i + 1].focus();
      });
      b.addEventListener('keydown', function (e) { if (e.key === 'Backspace' && !b.value && i > 0) boxes[i - 1].focus(); });
    });
    codeForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var code = boxes.map(function (b) { return b.value; }).join('');
      if (!/^\d{6}$/.test(code)) { document.getElementById('code-error').hidden = false; return; }
      var c = FT.store.get('contact', {}) || {};
      P.signIn({ email: contact.email || c.email || '', mobile: contact.mobile || '', first: c.first || '' });
      location.href = FT.link('/projects');
    });
    codeForm.querySelector('[data-change]').addEventListener('click', function () { show('contact'); contactEl.focus(); });
  }

  // ----- My projects -----
  var list = document.getElementById('project-list');
  if (list) {
    var s = P.session();
    var out = document.querySelector('[data-sign-out]');
    if (!s) {
      list.innerHTML = '<li class="panel empty-state"><h2>Sign in to see your projects</h2><p class="muted">Your projects are saved to your email or mobile number.</p><a class="btn btn-primary" href="' + FT.link('/account') + '">Sign in</a></li>';
      return;
    }
    document.querySelector('[data-signed-in-as]').textContent = 'Signed in as ' + (s.email || s.mobile);
    out.hidden = false;
    out.addEventListener('click', function () { P.signOut(); location.href = FT.link('/'); });
    var mine = P.mine().sort(function (a, b) { return a.updatedAt < b.updatedAt ? 1 : -1; });
    if (!mine.length) {
      list.innerHTML = '<li class="panel empty-state"><h2>No projects yet</h2><p class="muted">Enter your fence runs in Shop and choose Build my Topper to start one.</p><a class="btn btn-primary" href="' + FT.link('/shop') + '">Start a new project</a></li>';
      return;
    }
    list.innerHTML = mine.map(function (p) {
      var st = P.STATES[p.state], req = P.requirements(p);
      var next = st.next || (req.open ? req.open + ' item' + (req.open === 1 ? '' : 's') + ' left to finish' : 'Submit for review');
      var e = p.estimates[p.estimates.length - 1];
      return '<li class="panel project-card">' +
        '<div class="project-card-head"><h2>' + P.esc(p.name) + '</h2>' + P.badge(p.state) + '</div>' +
        '<p><strong>Next:</strong> ' + P.esc(next) + '</p>' +
        '<p class="muted">' + p.runs.length + ' run' + (p.runs.length === 1 ? '' : 's') + ' · ' + p.height + ' in · ' + (e ? 'Estimate ' + FT.money(e.total) : '') + ' · Updated ' + P.when(p.updatedAt) + '</p>' +
        '<a class="btn btn-primary" href="' + FT.link('/project') + '#p=' + encodeURIComponent(p.id) + '">Continue</a>' +
        '</li>';
    }).join('');
  }
})();
