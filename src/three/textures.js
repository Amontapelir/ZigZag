import * as THREE from 'three';

/** Small helper: create a 2D canvas of a given size. */
function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return { c, ctx: c.getContext('2d') };
}

/**
 * Braided hose wrap — the brand chevron running along the tube.
 * Used as colour map on the hose; the zigzag is the logo motif.
 */
export function zigzagWrap() {
  const { c, ctx } = canvas(256, 64);

  ctx.fillStyle = '#14121A';
  ctx.fillRect(0, 0, 256, 64);

  // soft braid shading across the tube cross-section (v axis)
  const shade = ctx.createLinearGradient(0, 0, 0, 64);
  shade.addColorStop(0, 'rgba(255,255,255,0.10)');
  shade.addColorStop(0.5, 'rgba(0,0,0,0.35)');
  shade.addColorStop(1, 'rgba(255,255,255,0.08)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, 256, 64);

  ctx.lineCap = 'square';
  ctx.lineJoin = 'miter';

  // gold chevrons
  ctx.strokeStyle = '#C8913C';
  ctx.lineWidth = 7;
  ctx.beginPath();
  for (let x = -32; x <= 288; x += 64) {
    ctx.moveTo(x, 52);
    ctx.lineTo(x + 32, 12);
    ctx.lineTo(x + 64, 52);
  }
  ctx.stroke();

  // thin highlight riding on top of the chevron
  ctx.strokeStyle = 'rgba(255, 214, 150, 0.55)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let x = -32; x <= 288; x += 64) {
    ctx.moveTo(x, 48);
    ctx.lineTo(x + 32, 8);
    ctx.lineTo(x + 64, 48);
  }
  ctx.stroke();

  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** Soft round puff used for smoke billboards. */
export function smokePuff() {
  const S = 128;
  const { c, ctx } = canvas(S, S);

  // layered blobs so the puff is not a perfect circle
  const blobs = 14;
  for (let i = 0; i < blobs; i++) {
    const a = (i / blobs) * Math.PI * 2 + Math.random();
    const d = 16 + Math.random() * 16;
    const x = S / 2 + Math.cos(a) * d;
    const y = S / 2 + Math.sin(a) * d;
    const r = 22 + Math.random() * 20;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,0.42)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // global falloff so edges never clip
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.55, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.globalCompositeOperation = 'destination-in';
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Tiny glowing dot for embers / dust motes. */
export function sparkDot() {
  const S = 64;
  const { c, ctx } = canvas(S, S);
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,208,140,0.85)');
  g.addColorStop(1, 'rgba(255,140,40,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Radial fade used to mask the mirror floor towards the horizon. */
export function floorFade() {
  const S = 256;
  const { c, ctx } = canvas(S, S);
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(0.08, 'rgba(0,0,0,0.22)');
  g.addColorStop(0.20, 'rgba(0,0,0,0.72)');
  g.addColorStop(0.34, 'rgba(0,0,0,0.96)');
  g.addColorStop(1, 'rgba(0,0,0,1)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Brushed-metal roughness variation for the stem and heat manager. */
export function brushed() {
  const W = 512, H = 32;
  const { c, ctx } = canvas(W, H);
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 2400; i++) {
    const y = Math.random() * H;
    const x = Math.random() * W;
    const l = 20 + Math.random() * 90;
    ctx.strokeStyle = `rgba(${Math.random() > 0.5 ? 255 : 0},${Math.random() > 0.5 ? 255 : 0},${Math.random() > 0.5 ? 255 : 0},0.05)`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + l, y);
    ctx.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(4, 2);
  return t;
}
