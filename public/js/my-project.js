/* My project (Phase 1): signs the customer in from their emailed link, then shows their saved projects.
   They can edit runs in Shop, see it on their fence, message us, and submit for review when ready.
   With the Builder on (features.builder), Continue opens the project in the Builder, which handles the runs and submit.
   Talks to functions/api/me, messages, submit and login through FT.api (public/js/site.js). */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var STATE_TEXT = {
    'in-progress': ['In progress', 'warn', 'The next step is yours. Submit it for review when it looks right.'],
    'needs-fix': ['Needs a fix', 'error', 'We left you a note below. Update your project, then submit it again.'],
    'submitted': ['Submitted', 'info', 'Nothing needed. We’re checking your measurements and will reply here and by email.'],
    'waiting': ['Question for you', 'warn', 'We asked a question below.'],
    'reply-received': ['Reply received', 'info', 'Nothing needed. We’re on it.'],
    'designing': ['Designing', 'info', 'Nothing needed. We’re preparing your design for you to approve.'],
    'awaiting-approval': ['Ready to approve', 'warn', 'Your design is ready. We’ll email you how to approve it.'],
  };
  function esc(t) { var d = document.createElement('div'); d.textContent = t == null ? '' : String(t); return d.innerHTML; }
  function show(id) { ['mp-loading', 'mp-signin', 'mp-off', 'mp-projects'].forEach(function (k) { $(k).hidden = k !== id; }); $('mp-account').hidden = id !== 'mp-projects'; }
  var BUILDER = !!(window.FT_FEATURES || {}).builder;
  function date(s) { return s ? new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''; }

  // 1. Arriving from the email link: Supabase puts the session (or an error) in the address hash.
  var hash = new URLSearchParams(location.hash.replace(/^#/, ''));
  var linkError = hash.get('error_description');
  if (hash.get('access_token')) {
    FT.session.set({ access_token: hash.get('access_token'), refresh_token: hash.get('refresh_token'), expires_in: hash.get('expires_in') });
  }
  if (location.hash) history.replaceState(null, '', location.pathname + location.search);

  function signIn(why) {
    var c = FT.store.get('contact', {}) || {};
    if (c.email) $('mp-email').value = c.email;
    if (why) $('mp-signin-why').textContent = why;
    $('mp-title').textContent = 'Your project';
    $('mp-lead').textContent = 'Pick up where you left off, on any device.';
    show('mp-signin');
  }

  $('mp-signin-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var email = $('mp-email').value.trim(), err = $('mp-signin-error'), btn = this.querySelector('button');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { err.textContent = 'Enter a valid email address, like name@example.com.'; err.hidden = false; $('mp-email').focus(); return; }
    err.hidden = true; btn.disabled = true; btn.textContent = 'Sending…';
    FT.api('/api/login', { body: { email: email } }).then(function (res) {
      btn.disabled = false; btn.textContent = 'Email me a link';
      if (res.ok) { $('mp-signin-sent').hidden = false; return; }
      err.textContent = (res.data && res.data.error) || 'We couldn’t send that. Try again in a minute.'; err.hidden = false;
    }, function () { btn.disabled = false; btn.textContent = 'Email me a link'; err.textContent = 'We couldn’t send that. Check your connection and try again.'; err.hidden = false; });
  });

  // 2. Load the projects.
  var data = null;
  function load() {
    if (!FT.session.get()) {
      // No session: either the backend is off (static preview) or they need a link.
      return fetch('/api/projects', { headers: { Accept: 'application/json' } })
        .then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; })
        .then(function (j) {
          if (!(j && j.configured)) { show('mp-off'); return; }
          signIn(linkError ? 'That link has expired or was already used. We’ll send you a new one.' : null);
        });
    }
    return FT.api('/api/me', { auth: true }).then(function (res) {
      if (res.ok && res.data && res.data.projects) { data = res.data; render(); return; }
      if (res.status === 503 || !res.data) { show('mp-off'); return; }
      FT.session.clear(); signIn('Your sign-in expired. We’ll send you a new link.');
    }, function () { show('mp-off'); });
  }

  function render() {
    var c = data.customer || {}, list = data.projects || [];
    if (c.email) FT.store.set('contact', { first: c.first, last: c.last, email: c.email, mobile: c.mobile || '' });
    $('mp-title').textContent = c.first ? 'Hi, ' + c.first + '.' : 'Your project';
    $('mp-lead').textContent = list.length ? 'Your project is saved. Work on it at your own pace.' : 'You don’t have a saved project yet.';
    $('mp-projects').innerHTML = list.length ? list.map(card).join('') : '<div class="panel"><p style="margin:0">Get your price in Shop and save it to see it here. <a class="link" href="/shop">Go to Shop</a></p></div>';
    $('mp-account').innerHTML = 'Signed in as ' + esc(c.email) + '. <button class="why-link" type="button" data-signout>Sign out</button>';
    show('mp-projects');
  }

  function card(p) {
    var st = STATE_TEXT[p.state] || [p.state, 'info', ''];
    var open = p.state === 'in-progress' || p.state === 'needs-fix';
    var msgs = (p.messages || []).map(function (m) {
      return '<li class="mp-msg ' + (m.author === 'staff' ? 'staff' : 'me') + '"><span class="mp-msg-who">' + (m.author === 'staff' ? 'FenceTopper' : 'You') + ' · ' + esc(date(m.created_at)) + '</span>' + esc(m.body).replace(/\n/g, '<br>') + '</li>';
    }).join('');
    return '<article class="panel mp-card" data-id="' + esc(p.id) + '">' +
      '<div class="mp-head"><h2>' + esc(p.name) + '</h2><span class="state-badge ' + st[1] + '">' + esc(st[0]) + '</span></div>' +
      '<p class="mp-next">' + esc(st[2]) + '</p>' +
      '<dl class="mp-facts"><dt>Runs</dt><dd>' + esc((p.runLabels || []).join(', ')) + '</dd>' +
      '<dt>Height and color</dt><dd>' + esc(p.height + ' in · ' + (p.summary.split(' · ')[2] || p.color)) + '</dd>' +
      (p.extender && p.extender.name ? '<dt>Extender</dt><dd>' + esc(p.extender.name) + '</dd>' : '') +
      '<dt>Estimate</dt><dd><strong>' + esc(p.estimate) + '</strong> <span class="muted">Your final price comes with your design.</span></dd>' +
      '<dt>Saved</dt><dd>' + esc(date(p.created_at)) + (p.updated_at && p.updated_at !== p.created_at ? ' · updated ' + esc(date(p.updated_at)) : '') + '</dd></dl>' +
      '<div class="mp-actions">' +
        (BUILDER ? '<a class="btn btn-primary" href="' + FT.link('/project') + '#p=' + encodeURIComponent(p.id) + '">' + (open ? 'Continue your project' : 'View your project') + '</a>' : '') +
        (open && !BUILDER ? '<button class="btn btn-outline" type="button" data-edit>Edit runs, height or color</button>' : '') +
        '<a class="btn btn-outline" href="/visualizer" data-viz>See it on your fence</a>' +
      '</div>' +
      '<h3 class="mp-sub">Photos</h3><p class="muted mp-photos">' + (BUILDER ? 'Add a photo of each run as you measure it in your project.' : 'Uploads are coming soon. For now, reply to our email with a photo of each run.') + '</p>' +
      '<h3 class="mp-sub">Messages</h3>' +
      (msgs ? '<ul class="mp-msgs">' + msgs + '</ul>' : '<p class="muted">No messages yet. Ask us anything about measuring, extensions or colors.</p>') +
      '<form class="mp-send" novalidate><label class="sr-only" for="msg-' + esc(p.id) + '">Message</label><textarea id="msg-' + esc(p.id) + '" placeholder="Write a message"></textarea>' +
        '<p class="field-error" role="alert" hidden></p><button class="btn btn-outline" type="submit">Send message</button></form>' +
      (open && BUILDER ? '<div class="mp-submit"><h3 class="mp-sub">Next: measure each run</h3><p>Continue your project to walk each run post by post, add photos, and submit it for review. Your progress saves as you go.</p></div>' : '') +
      (open && !BUILDER ? '<div class="mp-submit"><h3 class="mp-sub">Submit for review</h3><p>When your runs look right, submit your project. We check everything before anything is built, and you approve the final design. No payment now.</p>' +
        '<button class="btn btn-primary" type="button" data-submit>Submit for review</button></div>' : '') +
      '</article>';
  }

  function projectOf(el) { var id = el.closest('.mp-card').dataset.id; return (data.projects || []).filter(function (p) { return p.id === id; })[0]; }

  document.addEventListener('click', function (e) {
    var t = e.target;
    if (t.closest('[data-signout]')) { FT.session.clear(); signIn('You’re signed out. Use your email link, or we’ll send a new one.'); return; }
    var editBtn = t.closest('[data-edit]'), viz = t.closest('[data-viz]'), sub = t.closest('[data-submit]');
    if (editBtn || viz) {
      var p = projectOf(t);
      // Shop and the Visualizer read the same saved estimate.
      FT.store.set('draft', { runQin: p.runs, height: p.height, color: p.color, confirmed: ['straight', 'extenders'] });
      if (editBtn) { FT.store.set('editing', { projectId: p.id, name: p.name }); location.href = FT.link('/shop'); }
      return;
    }
    if (sub) {
      var sp = projectOf(t);
      if (sub.dataset.confirm !== '1') { sub.dataset.confirm = '1'; sub.textContent = 'Tap again to submit'; return; }
      sub.disabled = true; sub.textContent = 'Submitting…';
      FT.api('/api/submit', { auth: true, body: { project_id: sp.id } }).then(function (res) {
        if (res.ok) { sp.state = 'submitted'; render(); FT.toast('Submitted. We’ll check your measurements and reply here.'); return; }
        sub.disabled = false; sub.dataset.confirm = ''; sub.textContent = 'Submit for review';
        FT.toast((res.data && res.data.error) || 'We couldn’t submit that. Try again.');
      });
    }
  });

  document.addEventListener('submit', function (e) {
    var f = e.target.closest('.mp-send'); if (!f) return;
    e.preventDefault();
    var p = projectOf(f), box = f.querySelector('textarea'), err = f.querySelector('.field-error'), btn = f.querySelector('button');
    var body = box.value.trim();
    if (!body) { err.textContent = 'Write a message first.'; err.hidden = false; box.focus(); return; }
    err.hidden = true; btn.disabled = true; btn.textContent = 'Sending…';
    FT.api('/api/messages', { auth: true, body: { project_id: p.id, body: body } }).then(function (res) {
      btn.disabled = false; btn.textContent = 'Send message';
      if (res.ok) { (p.messages = p.messages || []).push({ author: 'customer', body: body, created_at: new Date().toISOString() }); render(); FT.toast('Message sent.'); return; }
      err.textContent = (res.data && res.data.error) || 'We couldn’t send that. Try again.'; err.hidden = false;
    });
  });

  load();
})();
