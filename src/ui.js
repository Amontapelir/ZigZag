/* =========================================================
   Chrome around the 3D: preloader, mobile menu, small bits.
   ========================================================= */

export function createLoader() {
  const el = document.getElementById('loader');
  const bar = document.getElementById('loaderBar');
  const pct = document.getElementById('loaderPct');
  let value = 0;

  return {
    set(v) {
      value = Math.max(value, Math.min(v, 1));
      if (bar) bar.style.width = `${(value * 100).toFixed(0)}%`;
      if (pct) pct.textContent = `${Math.round(value * 100)}%`;
    },
    async finish() {
      this.set(1);
      await new Promise((r) => setTimeout(r, 420));
      el?.classList.add('is-done');
      setTimeout(() => el?.remove(), 900);
    },
  };
}

export function initChrome() {
  /* mobile menu */
  const burger = document.getElementById('burger');
  const menu = document.getElementById('mobileMenu');

  function close() {
    if (!menu || menu.hidden) return;
    menu.hidden = true;
    burger?.setAttribute('aria-expanded', 'false');
    burger?.setAttribute('aria-label', 'Открыть меню');
    document.body.classList.remove('is-locked');
  }

  function open() {
    if (!menu) return;
    menu.hidden = false;
    burger?.setAttribute('aria-expanded', 'true');
    burger?.setAttribute('aria-label', 'Закрыть меню');
    document.body.classList.add('is-locked');
    menu.querySelectorAll('.mmenu__links a, .mmenu__call').forEach((el, i) => {
      el.style.animation = 'none';
      void el.offsetWidth;                       // restart the stagger
      el.style.animation = `mmenuIn 0.45s var(--ease) ${i * 0.05}s both`;
    });
  }

  burger?.addEventListener('click', () => (menu?.hidden ? open() : close()));
  document.addEventListener('zz:closemenu', close);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });

  /* footer year */
  const year = document.getElementById('year');
  if (year) year.textContent = String(new Date().getFullYear());
}

/** Hero entrance, played once the 3D scene is live. */
export function playIntro(reduced) {
  const targets = [...document.querySelectorAll('#hero [data-reveal]')];
  if (reduced) {
    targets.forEach((el) => el.classList.add('is-in'));
    return;
  }
  targets.forEach((el, i) => {
    setTimeout(() => el.classList.add('is-in'), 150 + i * 110);
  });
}
