import Lenis from 'lenis';

/* =========================================================
   Scroll choreography.

   Six camera keyframes, one per chapter. Azimuth climbs from
   0.55 to 6.72 rad across the page — a full 354° lap around
   the hookah — while radius, height, fov and mood drift with
   the story.

   Two layers of smoothing, and both matter:
   a Catmull-Rom spline turns the keyframes into one continuous
   path (velocity carries *through* each chapter instead of
   dropping to zero at it), and a critically damped spring
   follows that path with weight, so the camera eases out of
   rest as well as into it.

   offX pushes the model off-centre so it never sits under
   the text column: positive = model to the left of screen.
   ========================================================= */

const KEYS = [
  { id: 'hero',    radius: 16.8, theta: 0.55, phi: 1.26, ty: 3.30, fov: 36, offX: -3.0, smoke: 0.34, bloom: 0.60, exposure: 1.06 },
  { id: 'about',   radius: 12.2, theta: 1.62, phi: 1.19, ty: 2.90, fov: 38, offX: -2.6, smoke: 0.46, bloom: 0.62, exposure: 1.10 },
  { id: 'flavors', radius:  6.0, theta: 3.05, phi: 0.95, ty: 5.35, fov: 40, offX:  1.6, smoke: 0.80, bloom: 0.98, exposure: 1.16 },
  { id: 'leisure', radius:  9.6, theta: 4.35, phi: 1.72, ty: 2.60, fov: 44, offX: -2.4, smoke: 0.40, bloom: 0.72, exposure: 1.04 },
  { id: 'bar',     radius:  5.2, theta: 5.35, phi: 1.46, ty: 1.05, fov: 34, offX:  1.5, smoke: 0.24, bloom: 0.56, exposure: 1.16 },
  { id: 'visit',   radius: 13.4, theta: 6.72, phi: 1.22, ty: 3.30, fov: 36, offX: -3.5, smoke: 0.58, bloom: 0.70, exposure: 1.06 },
];

const LERPED = ['radius', 'theta', 'phi', 'ty', 'fov', 'offX', 'smoke', 'bloom', 'exposure'];

// How long each property takes to catch up, in seconds. The camera glides;
// the grade follows a touch quicker so the mood lands with the copy.
const SMOOTH_TIME = {
  radius: 0.62, theta: 0.62, phi: 0.62, ty: 0.62,
  fov: 0.70, offX: 0.66,
  smoke: 0.90, bloom: 0.50, exposure: 0.50,
};

// Safety rails: a Catmull-Rom spline overshoots by design, which reads as
// natural anticipation — but it must never turn the camera inside out.
const LIMITS = {
  radius: [3.6, 26], phi: [0.30, 2.36], fov: [24, 58],
  smoke: [0, 1.1], bloom: [0, 1.5], exposure: [0.72, 1.4],
};

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * Catmull-Rom through the keyframe values.
 *
 * The old version eased each chapter separately, which meant velocity hit
 * zero at every anchor: the camera crawled, lurched, crawled again. A spline
 * is C1-continuous across the whole page, so one uninterrupted scroll reads
 * as one uninterrupted orbit.
 */
function spline(values, u) {
  const n = values.length;
  const i = Math.min(Math.max(Math.floor(u), 0), n - 2);
  const t = clamp01(u - i);

  const p0 = values[Math.max(i - 1, 0)];
  const p1 = values[i];
  const p2 = values[i + 1];
  const p3 = values[Math.min(i + 2, n - 1)];

  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (
    2 * p1 +
    (p2 - p0) * t +
    (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
    (-p0 + 3 * p1 - 3 * p2 + p3) * t3
  );
}

/**
 * Critically damped follow (Unity's SmoothDamp). Unlike an exponential lerp
 * it carries velocity, so the camera eases *out of* rest as well as into it —
 * no instant jump on the first frame of a scroll. Stable at any frame rate.
 */
function smoothDamp(current, target, state, smoothTime, dt) {
  const omega = 2 / smoothTime;
  const x = omega * dt;
  const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const change = current - target;
  const temp = (state.v + omega * change) * dt;
  state.v = (state.v - omega * temp) * exp;
  return target + (change + temp) * exp;
}

export function initScroll(world) {
  const reduced = world.reduced;

  /* ---------------- smooth scrolling ---------------- */
  let lenis = null;
  if (!reduced) {
    lenis = new Lenis({
      duration: 1.35,
      easing: (t) => 1 - Math.pow(1 - t, 4),   // long, even glide-out
      smoothWheel: true,
      wheelMultiplier: 0.9,
      syncTouch: true,
      touchMultiplier: 1.4,
    });
    world.onFrame(() => lenis.raf(performance.now()));
  }

  /* ---------------- chapter anchors ---------------- */
  const sections = KEYS.map((k) => document.getElementById(k.id)).filter(Boolean);
  const anchors = [];
  let narrow = false;

  function measure() {
    narrow = window.innerWidth < 1080;
    anchors.length = 0;
    const vh = window.innerHeight;
    for (const el of sections) {
      const rect = el.getBoundingClientRect();
      const top = rect.top + window.scrollY;
      anchors.push(top + rect.height / 2 - vh / 2);
    }
  }

  /* ---------------- scroll → camera state ---------------- */
  // One flat array per animated property — the spline reads straight off these.
  const TRACKS = {};
  for (const k of LERPED) TRACKS[k] = KEYS.map((key) => key[k]);

  const desired = { ...KEYS[0] };
  let chapter = 0;
  let progress = 0;
  let locked = false;   // dev preview pins the camera to one chapter

  function sample(y) {
    if (locked || anchors.length < 2) return;

    let i = 0;
    while (i < anchors.length - 2 && y >= anchors[i + 1]) i++;

    const a = anchors[i];
    const b = anchors[i + 1];
    const raw = clamp01((y - a) / Math.max(b - a, 1));

    // Position along the whole choreography, in chapters. Feeding this to a
    // spline keeps velocity continuous *through* the anchors instead of
    // easing to a halt at each one.
    const u = i + raw;

    for (const k of LERPED) {
      let v = spline(TRACKS[k], u);
      const limit = LIMITS[k];
      if (limit) v = Math.min(Math.max(v, limit[0]), limit[1]);
      desired[k] = v;
    }

    // Narrow viewports centre the copy, so the model centres too
    // and steps back to stay inside a portrait frame.
    if (narrow) {
      desired.offX *= 0.16;
      desired.radius *= 1.34;
    }

    chapter = raw < 0.5 ? i : i + 1;
    progress = clamp01(u / (anchors.length - 1));
  }

  /* ---------------- damped follow ---------------- */
  const rig = world.rig;
  Object.assign(rig, KEYS[0]);

  // One velocity accumulator per property, so the follow is a spring rather
  // than a fraction-per-frame chase.
  const vel = {};
  for (const k of LERPED) vel[k] = { v: 0 };


  /* ---------------- wire it to the page ---------------- */
  const railFill = document.getElementById('railFill');
  const railItems = [...document.querySelectorAll('.rail__list li')];
  const rail = document.getElementById('rail');
  const nav = document.getElementById('nav');

  let lastChapter = -1;
  let lastProgress = -1;
  let lastY = -1;
  let lastStuck = null;
  let lastOn = null;

  function onScroll() {
    const y = window.scrollY || window.pageYOffset;
    if (y === lastY) return;
    lastY = y;

    sample(y);

    // Style writes force layout on the next scrollY read, so only write when
    // the bar actually moves a visible amount.
    if (railFill && Math.abs(progress - lastProgress) > 0.0015) {
      railFill.style.height = `${(progress * 100).toFixed(2)}%`;
      lastProgress = progress;
    }

    const on = y > window.innerHeight * 0.45;
    if (rail && on !== lastOn) { rail.classList.toggle('is-on', on); lastOn = on; }

    const stuck = y > 40;
    if (nav && stuck !== lastStuck) { nav.classList.toggle('is-stuck', stuck); lastStuck = stuck; }

    if (chapter !== lastChapter) {
      railItems.forEach((li, i) => li.classList.toggle('is-active', i === chapter));
      lastChapter = chapter;
    }
  }

  measure();
  onScroll();

  // One ticker drives everything: read the scroll position, then ease the rig
  // towards it. Polling beats listening here — `scroll` events are coalesced
  // (and throttled outright in background tabs), which would strand the camera
  // mid-move; reading scrollY once per frame is a single cheap layout read.
  world.onFrame((dt) => {
    onScroll();

    if (reduced) {
      for (const key of LERPED) { rig[key] = desired[key]; vel[key].v = 0; }
    } else {
      for (const key of LERPED) {
        rig[key] = smoothDamp(rig[key], desired[key], vel[key], SMOOTH_TIME[key], dt);
      }
    }
    rig.tx = 0;
    rig.tz = 0;
  });

  window.addEventListener('resize', () => { lastY = -1; measure(); onScroll(); }, { passive: true });

  /* ---------------- content reveals ---------------- */
  // The hero is handled by the intro timeline, everything else on scroll.
  // IntersectionObserver rather than a scroll library: it fires from the
  // compositor, so copy never stays invisible if the main thread is busy.
  const reveals = [...document.querySelectorAll('[data-reveal]')].filter(
    (el) => !el.closest('#hero')
  );

  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const el = entry.target;
      io.unobserve(el);
      const siblings = [...(el.parentElement?.querySelectorAll(':scope > [data-reveal]') || [])];
      const idx = Math.max(siblings.indexOf(el), 0);
      setTimeout(() => el.classList.add('is-in'), idx * 85);
    }
  }, { rootMargin: '0px 0px -12% 0px', threshold: 0.01 });

  reveals.forEach((el) => io.observe(el));

  /* ---------------- anchor navigation ---------------- */
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      if (!id || id === '#') return;
      const el = document.querySelector(id);
      if (!el) return;
      e.preventDefault();
      document.body.classList.remove('is-locked');
      document.dispatchEvent(new CustomEvent('zz:closemenu'));
      if (lenis) lenis.scrollTo(el, { offset: 0, duration: 1.5 });
      else el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
    });
  });

  return {
    lenis,
    keys: KEYS,
    /** Dev helper: preview a chapter's camera without scrolling there. */
    preview(i) {
      locked = true;
      const k = KEYS[Math.max(0, Math.min(i, KEYS.length - 1))];
      for (const key of LERPED) desired[key] = k[key];
      if (narrow) { desired.offX *= 0.16; desired.radius *= 1.34; }
      for (const key of LERPED) { rig[key] = desired[key]; vel[key].v = 0; }  // snap
    },
    unlock() { locked = false; lastY = -1; onScroll(); },
    refresh() { lastY = -1; measure(); onScroll(); },
    stop() { lenis?.stop(); },
    play() { lenis?.start(); },
  };
}
