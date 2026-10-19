// Small UI helpers for the redesigned platform: icons, toast, modal/sheet with focus trap.
(function (root) {
  const PATHS = {"home":"M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z","design":"M12 3a9 9 0 1 0 0 18c1.1 0 1.6-.8 1.6-1.6 0-.5-.2-.8-.4-1.1-.3-.3-.4-.7-.4-1.1 0-.9.7-1.6 1.6-1.6H16a5 5 0 0 0 5-5c0-4.1-4-7.6-9-7.6zM7.5 11.5h.01M10 7.5h.01M15 7.5h.01","menu":"M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 21V5M8 7h7M8 11h7","orders":"M5 8h14l-1 12H6zM9 8V6a3 3 0 0 1 6 0v2","settings":"M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1M15 4v4M9 10v4M17 16v4","billing":"M3 6h18v12H3zM3 10h18M7 15h4","more":"M5 12h.01M12 12h.01M19 12h.01","logout":"M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10","external":"M14 4h6v6M20 4l-9 9M18 14v6H4V6h6","copy":"M8 8h12v12H8zM4 16V4h12","share":"M12 3v13M7 8l5-5 5 5M5 14v6h14v-6","eye":"M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z","eyeOff":"M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4M6.6 6.6C3.8 8.4 2 12 2 12s3.5 7 10 7c1.8 0 3.3-.5 4.6-1.2M9.9 9.9a3 3 0 0 0 4.2 4.2","edit":"M4 20h4L19 9l-4-4L4 16zM14 6l4 4","plus":"M12 5v14M5 12h14","minus":"M5 12h14","check":"M5 12.5l4.5 4.5L19 7","chevron":"M9 6l6 6-6 6","up":"M12 19V5M6 11l6-6 6 6","down":"M12 5v14M6 13l6 6 6-6","phone":"M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z","upload":"M12 16V4M7 9l5-5 5 5M4 16v4h16v-4","globe":"M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c2.5 2.5 3.8 5.5 3.8 9s-1.3 6.5-3.8 9c-2.5-2.5-3.8-5.5-3.8-9S9.5 5.5 12 3z","clock":"M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2","trash":"M4 7h16M10 7V4h4v3M6 7l1 13h10l1-13","x":"M6 6l12 12M18 6 6 18","chat":"M4 20l1.5-4A8 8 0 1 1 9 19.5z","pin":"M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12zM12 7a2 2 0 1 0 0 4 2 2 0 0 0 0-4z","bell":"M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 21h4","lock":"M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3","bag":"M5 8h14l-1 12H6zM9 8V6a3 3 0 0 1 6 0v2"};
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // 24x24, stroke 2, round caps. Directional icons get .nz-flip so they mirror in RTL.
  const FLIP = new Set(['chevron', 'logout', 'external']);
  function icon(name, size = 24) {
    const d = PATHS[name] || '';
    return `<svg class="nz-icon${FLIP.has(name) ? ' nz-flip' : ''}" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`;
  }

  let toastEl;
  function toast(msg) {
    if (toastEl) toastEl.remove();
    toastEl = document.createElement('div');
    toastEl.className = 'nz nz-toast'; toastEl.setAttribute('role', 'status');
    toastEl.innerHTML = `<span class="nz-toast__ok">${icon('check', 18).replace('<svg', '<svg style="color:#fff"')}</span><span>${esc(msg)}</span>`;
    document.body.append(toastEl);
    const el = toastEl; setTimeout(() => { if (el.isConnected) el.remove(); }, 2300);
  }

  const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
  // modal({ title, html, label }) -> { el, close }. Esc / backdrop click close; focus is trapped and restored.
  function modal({ title = '', html = '', label, onClose } = {}) {
    const trigger = document.activeElement;
    const back = document.createElement('div');
    back.className = 'nz nz-backdrop';
    const id = 'nzm' + Math.random().toString(36).slice(2, 7);
    back.innerHTML = `<div class="nz-modal" role="dialog" aria-modal="true" ${title ? `aria-labelledby="${id}"` : `aria-label="${esc(label || '')}"`}>
      ${title ? `<div class="nz-modal__head"><h2 class="nz-modal__title" id="${id}">${esc(title)}</h2><button type="button" class="nz-iconbtn" data-nz-close aria-label="${esc(label || 'Close')}">${icon('x')}</button></div>` : ''}${html}</div>`;
    document.body.append(back);
    document.body.style.overflow = 'hidden';
    const box = back.firstElementChild;
    const close = () => {
      document.removeEventListener('keydown', onKey, true); back.remove();
      if (!document.querySelector('.nz-backdrop')) document.body.style.overflow = '';
      if (trigger && trigger.focus) trigger.focus();
      if (onClose) onClose();
    };
    function onKey(e) {
      if (e.key === 'Escape') { e.stopPropagation(); close(); return; }
      if (e.key !== 'Tab') return;
      const f = [...box.querySelectorAll(FOCUSABLE)].filter((x) => x.offsetParent !== null);
      if (!f.length) { e.preventDefault(); return; }
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    document.addEventListener('keydown', onKey, true);
    back.addEventListener('mousedown', (e) => { if (e.target === back) close(); });
    back.addEventListener('click', (e) => { if (e.target.closest('[data-nz-close]')) close(); });
    const auto = box.querySelector('[autofocus]') || box.querySelector(FOCUSABLE);
    if (auto) auto.focus();
    return { el: box, close };
  }

  // Toggle helpers for aria-driven controls (switch / chip / seg). Return the new state.
  function toggle(el) {
    const attr = el.hasAttribute('aria-checked') ? 'aria-checked' : 'aria-pressed';
    const on = el.getAttribute(attr) !== 'true';
    el.setAttribute(attr, on); return on;
  }

  root.NZUI = { icon, toast, modal, toggle, esc, paths: PATHS };
})(window);
