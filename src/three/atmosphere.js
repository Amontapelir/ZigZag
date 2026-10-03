import * as THREE from 'three';
import { smokePuff, sparkDot } from './textures.js';

/* =========================================================
   Two GPU particle systems that carry the mood:
   1) smoke — soft rotating billboards rising from the bowl
   2) embers — warm motes drifting through the whole room
   Both run entirely in the vertex shader: zero per-frame CPU.
   ========================================================= */

const SMOKE_VERT = `
  uniform float uTime;
  uniform float uSize;
  uniform float uPixelRatio;
  uniform float uOpacity;

  attribute float aSeed;
  attribute float aSpeed;
  attribute float aScale;
  attribute float aAngle;
  attribute float aRadius;

  varying float vAlpha;
  varying float vRot;
  varying float vLife;

  void main() {
    float life = fract(uTime * 0.055 * aSpeed + aSeed);

    // rise with an ease-out so puffs slow as they cool
    float rise = 1.0 - pow(1.0 - life, 1.9);
    float y = 6.55 + rise * 6.2;

    // spiral outward, wider the higher it goes
    float ang = aAngle + life * 2.1 * aSpeed;
    float rad = aRadius + rise * rise * 1.85 + sin(life * 9.0 + aSeed * 20.0) * 0.09;

    vec3 pos = vec3(cos(ang) * rad, y, sin(ang) * rad);
    pos.x += sin(uTime * 0.24 + aSeed * 12.0) * rise * 0.55;
    pos.z += cos(uTime * 0.19 + aSeed * 9.0) * rise * 0.45;

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;

    float dist = max(-mv.z, 0.001);
    float grow = 0.30 + rise * 2.35;
    gl_PointSize = min(aScale * grow * uSize * uPixelRatio / dist, 420.0);

    float fadeIn = smoothstep(0.0, 0.10, life);
    float fadeOut = 1.0 - smoothstep(0.42, 1.0, life);
    // puffs that drift into the lens would clip as hard squares
    float near = smoothstep(1.0, 3.4, dist);
    vAlpha = fadeIn * fadeOut * near * uOpacity;
    vRot = aSeed * 6.2831 + life * 1.4 * aSpeed;
    vLife = life;
  }
`;

const SMOKE_FRAG = `
  uniform sampler2D uMap;
  uniform vec3 uWarm;
  uniform vec3 uCool;

  varying float vAlpha;
  varying float vRot;
  varying float vLife;

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float s = sin(vRot), c = cos(vRot);
    uv = mat2(c, -s, s, c) * uv + 0.5;

    float a = texture2D(uMap, uv).a;
    if (a < 0.004) discard;

    vec3 col = mix(uWarm, uCool, smoothstep(0.0, 0.55, vLife));
    gl_FragColor = vec4(col, a * vAlpha);
  }
`;

const EMBER_VERT = `
  uniform float uTime;
  uniform float uSize;
  uniform float uPixelRatio;

  attribute float aSeed;
  attribute float aSpeed;
  attribute float aScale;
  attribute vec3 aOrigin;
  attribute float aKind;

  varying float vAlpha;
  varying float vKind;

  void main() {
    float life = fract(uTime * 0.035 * aSpeed + aSeed);

    vec3 pos = aOrigin;
    pos.y += life * 9.0;
    pos.x += sin(uTime * 0.4 * aSpeed + aSeed * 30.0) * 0.55;
    pos.z += cos(uTime * 0.31 * aSpeed + aSeed * 21.0) * 0.55;

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;
    float dist = max(-mv.z, 0.001);
    gl_PointSize = min(aScale * uSize * uPixelRatio / dist, 90.0);

    vAlpha = smoothstep(0.0, 0.08, life)
           * (1.0 - smoothstep(0.55, 1.0, life))
           * smoothstep(0.8, 2.6, dist);
    vKind = aKind;
  }
`;

const EMBER_FRAG = `
  uniform sampler2D uMap;
  uniform vec3 uHot;
  uniform vec3 uDust;
  varying float vAlpha;
  varying float vKind;

  void main() {
    vec4 tex = texture2D(uMap, gl_PointCoord);
    if (tex.a < 0.01) discard;
    vec3 col = mix(uDust, uHot, vKind);
    gl_FragColor = vec4(col * tex.rgb, tex.a * vAlpha);
  }
`;

export function buildSmoke({ count = 90 } = {}) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const seed = new Float32Array(count);
  const speed = new Float32Array(count);
  const scale = new Float32Array(count);
  const angle = new Float32Array(count);
  const radius = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    seed[i] = Math.random();
    speed[i] = 0.62 + Math.random() * 0.85;
    scale[i] = 0.55 + Math.random() * 1.15;
    angle[i] = Math.random() * Math.PI * 2;
    radius[i] = Math.random() * 0.22;
  }

  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  geo.setAttribute('aSpeed', new THREE.BufferAttribute(speed, 1));
  geo.setAttribute('aScale', new THREE.BufferAttribute(scale, 1));
  geo.setAttribute('aAngle', new THREE.BufferAttribute(angle, 1));
  geo.setAttribute('aRadius', new THREE.BufferAttribute(radius, 1));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 9, 0), 14);

  const material = new THREE.ShaderMaterial({
    vertexShader: SMOKE_VERT,
    fragmentShader: SMOKE_FRAG,
    uniforms: {
      uTime: { value: 0 },
      uSize: { value: 320 },
      uPixelRatio: { value: 1 },
      uOpacity: { value: 0.42 },
      uMap: { value: smokePuff() },
      uWarm: { value: new THREE.Color(0xC98A4E) },
      uCool: { value: new THREE.Color(0x8E86A8) },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
  });

  const points = new THREE.Points(geo, material);
  points.frustumCulled = false;
  points.renderOrder = 8;

  return {
    object: points,
    material,
    update(t) { material.uniforms.uTime.value = t; },
    setOpacity(v) { material.uniforms.uOpacity.value = v; },
    setPixelRatio(v) { material.uniforms.uPixelRatio.value = v; },
  };
}

export function buildEmbers({ count = 260 } = {}) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const origin = new Float32Array(count * 3);
  const seed = new Float32Array(count);
  const speed = new Float32Array(count);
  const scale = new Float32Array(count);
  const kind = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 1.2 + Math.pow(Math.random(), 0.6) * 11;
    origin[i * 3] = Math.cos(a) * r;
    origin[i * 3 + 1] = -1.5 + Math.random() * 3.5;
    origin[i * 3 + 2] = Math.sin(a) * r;

    seed[i] = Math.random();
    speed[i] = 0.35 + Math.random() * 1.3;
    scale[i] = 1.1 + Math.random() * 3.4;
    kind[i] = Math.random() < 0.42 ? 1 : 0;
  }

  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aOrigin', new THREE.BufferAttribute(origin, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  geo.setAttribute('aSpeed', new THREE.BufferAttribute(speed, 1));
  geo.setAttribute('aScale', new THREE.BufferAttribute(scale, 1));
  geo.setAttribute('aKind', new THREE.BufferAttribute(kind, 1));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 4, 0), 22);

  const material = new THREE.ShaderMaterial({
    vertexShader: EMBER_VERT,
    fragmentShader: EMBER_FRAG,
    uniforms: {
      uTime: { value: 0 },
      uSize: { value: 26 },
      uPixelRatio: { value: 1 },
      uMap: { value: sparkDot() },
      uHot: { value: new THREE.Color(0xFF9A3C) },
      uDust: { value: new THREE.Color(0x9FB4D8) },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const points = new THREE.Points(geo, material);
  points.frustumCulled = false;
  points.renderOrder = 7;

  return {
    object: points,
    material,
    update(t) { material.uniforms.uTime.value = t; },
    setPixelRatio(v) { material.uniforms.uPixelRatio.value = v; },
  };
}
