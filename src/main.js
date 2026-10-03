import './styles.css';
import { createWorld } from './three/world.js';
import { initScroll } from './scroll.js';
import { createLoader, initChrome, playIntro } from './ui.js';

const loader = createLoader();
initChrome();

function fallback(message) {
  document.getElementById('stage')?.classList.add('is-fallback');
  document.querySelectorAll('[data-reveal]').forEach((el) => el.classList.add('is-in'));
  loader.finish();
  if (message) console.warn('[zigzag]', message);
}

function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch {
    return false;
  }
}

async function boot() {
  const canvas = document.getElementById('scene');
  if (!canvas || !hasWebGL()) {
    fallback('WebGL unavailable — serving the flat layout.');
    return;
  }

  loader.set(0.12);

  let world;
  try {
    world = createWorld(canvas);
  } catch (err) {
    fallback(err?.message || 'scene failed');
    return;
  }

  loader.set(0.55);

  // Let the browser paint the loader before we compile shaders — but never
  // stall on it: rAF is throttled to a crawl in background tabs.
  await new Promise((resolve) => {
    const done = () => { clearTimeout(timer); resolve(); };
    const timer = setTimeout(resolve, 400);
    requestAnimationFrame(() => requestAnimationFrame(done));
  });

  try {
    const t0 = performance.now();
    world.prime();
    if (import.meta.env.DEV) console.info('[zigzag] first frame in', Math.round(performance.now() - t0), 'ms');
  } catch (err) {
    console.warn('[zigzag] prime failed', err);
  }

  loader.set(0.82);

  const scroll = initScroll(world);
  world.start();

  if (import.meta.env.DEV) window.__zz = { world, scroll };

  // Fonts change metrics, which moves the chapter anchors.
  if (document.fonts?.ready) {
    document.fonts.ready.then(() => scroll.refresh()).catch(() => {});
  }
  window.addEventListener('load', () => scroll.refresh(), { once: true });

  await loader.finish();
  playIntro(world.reduced);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
