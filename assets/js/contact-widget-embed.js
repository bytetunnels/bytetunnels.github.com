/**
 * ByteTunnels contact widget — embeddable JS widget.
 *
 * Usage:
 *   <div id="bt-contact-widget"></div>
 *   <script src="https://bytetunnels.com/assets/js/contact-widget-embed.js" async></script>
 *
 * If no target div is present, the widget is injected at the script tag's location.
 */
(function () {
  'use strict';

  var ENDPOINT = 'https://form.bytetunnels.com/contact';
  var CALENDLY_URL = 'https://calendly.com/armanfixing/30min';
  var IMG_URL = 'https://bytetunnels.com/assets/img/arman-banner-square.jpg';
  var TWITTER_URL = 'https://twitter.com/armanfixing';
  var LINKEDIN_URL = 'https://www.linkedin.com/in/armanhossain';
  var STYLE_ID = 'bt-embed-style';
  var TARGET_ID = 'bt-contact-widget';

  var currentScript = document.currentScript;

  var CSS = [
    '.bt-embed{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;color:#0f172a}',
    '.bt-embed *,.bt-embed *::before,.bt-embed *::after{box-sizing:border-box}',
    '.bt-embed__card{display:flex;flex-direction:row;max-width:820px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 12px 32px rgba(2,6,23,.12)}',
    '.bt-embed__media{flex:0 0 380px;background:#f8fafc;display:flex;align-items:center;justify-content:center}',
    '.bt-embed__media img{display:block;width:100%;height:auto}',
    '.bt-embed__body{flex:1 1 auto;padding:18px 22px 20px}',
    '.bt-embed__title{margin:0 0 4px;font-size:1.15rem;font-weight:700;line-height:1.25}',
    '.bt-embed__lede{margin:0 0 12px;color:#475569;font-size:.9rem}',
    '.bt-embed__form label{display:block;font-size:.78rem;font-weight:600;color:#334155;margin-bottom:3px}',
    '.bt-embed__field{margin-bottom:8px}',
    '.bt-embed__form input,.bt-embed__form textarea{width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:7px 11px;font-size:.92rem;background:#fff;color:#0f172a;font-family:inherit}',
    '.bt-embed__form input:focus,.bt-embed__form textarea:focus{outline:none;border-color:#2563eb;box-shadow:0 0 0 3px rgba(37,99,235,.18)}',
    '.bt-embed__form textarea{resize:vertical;min-height:56px}',
    '.bt-embed__submit{width:100%;background:#2563eb;color:#fff;border:none;border-radius:8px;padding:9px 14px;margin-top:4px;font-weight:600;font-size:.95rem;cursor:pointer;font-family:inherit}',
    '.bt-embed__submit:hover:not(:disabled){background:#1d4ed8}',
    '.bt-embed__submit:disabled{opacity:.65;cursor:not-allowed}',
    '.bt-embed__status{margin-top:8px;font-size:.85rem;min-height:1.2em}',
    '.bt-embed__status.is-error{color:#b91c1c}',
    '.bt-embed__status.is-success{color:#047857}',
    '.bt-embed__socials{margin-top:14px;padding-top:12px;border-top:1px solid #e2e8f0;display:flex;align-items:center;gap:10px;flex-wrap:wrap}',
    '.bt-embed__label{font-size:.85rem;color:#64748b}',
    '.bt-embed__socials a:not(.bt-embed__btn){display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:8px;background:#f1f5f9;color:#0f172a;transition:background .15s ease,transform .15s ease}',
    '.bt-embed__socials a:not(.bt-embed__btn):hover{background:#e2e8f0;transform:translateY(-1px)}',
    '.bt-embed__socials svg{width:16px;height:16px}',
    '.bt-embed__btn{display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 12px;border-radius:999px;background:#2563eb;color:#fff;font-size:.82rem;font-weight:600;text-decoration:none;white-space:nowrap;transition:background .15s ease,transform .15s ease}',
    '.bt-embed__btn:hover{background:#1d4ed8;transform:translateY(-1px)}',
    '.bt-embed__btn svg{width:14px;height:14px}',
    '@media (max-width:640px){.bt-embed__card{flex-direction:column;max-width:460px}.bt-embed__media{flex:0 0 auto}}'
  ].join('');

  var HTML = [
    '<div class="bt-embed">',
    '  <div class="bt-embed__card">',
    '    <div class="bt-embed__media">',
    '      <img src="' + IMG_URL + '" alt="Arman — available for freelance and contract scraping, data extraction, and ETL pipelines">',
    '    </div>',
    '    <div class="bt-embed__body">',
    '      <h3 class="bt-embed__title">Tell me about your project</h3>',
    '      <p class="bt-embed__lede">Drop a quick note and I\'ll get back to you by email.</p>',
    '      <form class="bt-embed__form" novalidate>',
    '        <div class="bt-embed__field">',
    '          <label>Name<input type="text" name="name" required autocomplete="name"></label>',
    '        </div>',
    '        <div class="bt-embed__field">',
    '          <label>Email<input type="email" name="email" required autocomplete="email"></label>',
    '        </div>',
    '        <div class="bt-embed__field">',
    '          <label>Project description<textarea name="description" required rows="4"></textarea></label>',
    '        </div>',
    '        <button type="submit" class="bt-embed__submit">Send message</button>',
    '        <div class="bt-embed__status" role="status" aria-live="polite"></div>',
    '      </form>',
    '      <div class="bt-embed__socials">',
    '        <a href="' + TWITTER_URL + '" target="_blank" rel="noopener" aria-label="X (Twitter)" title="X">',
    '          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>',
    '        </a>',
    '        <a href="' + LINKEDIN_URL + '" target="_blank" rel="noopener" aria-label="LinkedIn" title="LinkedIn">',
    '          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.36V9h3.41v1.56h.05c.47-.9 1.63-1.85 3.36-1.85 3.6 0 4.27 2.37 4.27 5.45zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.56V9h3.56zM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0z"/></svg>',
    '        </a>',
    '        <span class="bt-embed__label">or</span>',
    '        <a href="' + CALENDLY_URL + '" target="_blank" rel="noopener" class="bt-embed__btn">',
    '          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
    '          Book a 30-min call',
    '        </a>',
    '      </div>',
    '    </div>',
    '  </div>',
    '</div>'
  ].join('\n');

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.appendChild(document.createTextNode(CSS));
    document.head.appendChild(style);
  }

  function findOrCreateContainer() {
    var target = document.getElementById(TARGET_ID);
    if (target) return target;
    if (currentScript && currentScript.parentNode) {
      target = document.createElement('div');
      target.id = TARGET_ID;
      currentScript.parentNode.insertBefore(target, currentScript);
      return target;
    }
    target = document.createElement('div');
    target.id = TARGET_ID;
    document.body.appendChild(target);
    return target;
  }

  function attachSubmit(container) {
    var form = container.querySelector('.bt-embed__form');
    var submitBtn = container.querySelector('.bt-embed__submit');
    var status = container.querySelector('.bt-embed__status');

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      status.className = 'bt-embed__status';
      status.textContent = '';

      var name = form.name.value.trim();
      var email = form.email.value.trim();
      var description = form.description.value.trim();

      if (!name || !email || !description) {
        status.textContent = 'Please fill in all fields.';
        status.classList.add('is-error');
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        status.textContent = 'Please enter a valid email address.';
        status.classList.add('is-error');
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = 'Sending...';

      fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name, email: email, description: description })
      })
        .then(function (res) {
          return res.json().catch(function () { return {}; }).then(function (data) {
            if (!res.ok) throw new Error(data.error || 'submit failed');
            return data;
          });
        })
        .then(function () {
          status.textContent = 'Thanks — message sent. I\'ll reply by email shortly.';
          status.classList.add('is-success');
          form.reset();
        })
        .catch(function (err) {
          status.textContent = (err && err.message) ? err.message : 'Something went wrong. Please try again.';
          status.classList.add('is-error');
        })
        .finally(function () {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Send message';
        });
    });
  }

  function mount() {
    injectStyle();
    var container = findOrCreateContainer();
    container.innerHTML = HTML;
    attachSubmit(container);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();
