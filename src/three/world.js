import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { Reflector } from 'three/addons/objects/Reflector.js';

import { buildEnvironment, buildBackdrop } from './env.js';
import { buildHookah } from './hookah.js';
import { buildSmoke, buildEmbers } from './atmosphere.js';
import { GradeShader } from './grade.js';
import { floorFade } from './textures.js';

const clamp = (v, a, b) => Math.min(Math.max(v, a), b);

export function createWorld(canvas) {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isCoarse = window.matchMedia('(pointer: coarse)').matches;
  const isSmall = window.innerWidth < 860;
  const quality = isSmall || isCoarse ? 'low' : 'high';
  const maxDpr = quality === 'low' ? 1.7 : 1.9;

  /* ---------------- renderer ---------------- */
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    alpha: false,
    powerPreference: 'high-performance',
    stencil: false,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = quality === 'high';
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  // Lights and geometry never move, so the shadow map is baked in the first
  // frames and then left alone — that is a whole depth pass saved per frame.
  renderer.shadowMap.autoUpdate = false;

  canvas.setAttribute('role', 'img');
  canvas.setAttribute(
    'aria-label',
    'Трёхмерная сцена: кальян lounge bar ZigZag. Камера облетает модель по мере прокрутки страницы.'
  );

  /* ---------------- scene ---------------- */
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0A0710, 0.026);

  const camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.1, 200);
  camera.position.set(0, 4, 14);

  scene.environment = buildEnvironment(renderer);

  const backdrop = buildBackdrop();
  scene.add(backdrop.mesh);

  /* ---------------- model ---------------- */
  const hookah = buildHookah({ quality });
  scene.add(hookah.group);

  /* ---------------- floor ---------------- */
  let mirror = null;
  if (quality === 'high') {
    mirror = new Reflector(new THREE.CircleGeometry(70, 72), {
      textureWidth: 512,
      textureHeight: 512,
      color: 0x101018,
      clipBias: 0.003,
    });
    mirror.rotation.x = -Math.PI / 2;
    mirror.position.y = -0.002;
    scene.add(mirror);
  }

  const fade = new THREE.Mesh(
    new THREE.CircleGeometry(70, 72),
    new THREE.MeshBasicMaterial({
      map: floorFade(),
      transparent: true,
      color: 0x05040A,
      depthWrite: false,
      opacity: quality === 'high' ? 0.94 : 1,
    })
  );
  fade.rotation.x = -Math.PI / 2;
  fade.position.y = 0.006;
  fade.renderOrder = 1;
  scene.add(fade);

  // A soft warm pool right under the hookah, so it feels grounded.
  const pool = new THREE.Mesh(
    new THREE.CircleGeometry(3.4, 48),
    new THREE.MeshBasicMaterial({
      color: 0x3D1E0C,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  pool.rotation.x = -Math.PI / 2;
  pool.position.y = 0.012;
  pool.renderOrder = 2;
  scene.add(pool);

  /* ---------------- lights ---------------- */
  scene.add(new THREE.HemisphereLight(0x4A3768, 0x140B08, 0.55));

  const key = new THREE.SpotLight(0xFFC38C, 460, 44, 0.62, 0.85, 2);
  key.position.set(6.5, 12, 5.5);
  key.target.position.set(0, 3, 0);
  if (quality === 'high') {
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.bias = -0.0016;
    key.shadow.normalBias = 0.024;
    key.shadow.camera.near = 2;
    key.shadow.camera.far = 40;
  }
  scene.add(key, key.target);

  const fill = new THREE.SpotLight(0x7B49F5, 260, 40, 0.85, 1, 2);
  fill.position.set(-8.5, 5.5, -4.5);
  fill.target.position.set(0, 3, 0);
  scene.add(fill, fill.target);

  const rim = new THREE.DirectionalLight(0xC3D9FF, 1.5);
  rim.position.set(-3.5, 7, -10);
  scene.add(rim);

  // Travels with the camera: guarantees the model reads on the backlit
  // half of the orbit without flattening the key light.
  const travel = new THREE.PointLight(0xFFD6AC, 60, 30, 2);
  travel.position.set(1.6, 1.4, 1.2);
  camera.add(travel);
  scene.add(camera);

  /* ---------------- atmosphere ---------------- */
  const smoke = buildSmoke({ count: quality === 'high' ? 96 : 44 });
  const embers = buildEmbers({ count: quality === 'high' ? 280 : 120 });
  scene.add(smoke.object, embers.object);

  const dpr = renderer.getPixelRatio();
  smoke.setPixelRatio(dpr);
  embers.setPixelRatio(dpr);

  /* ---------------- post processing ---------------- */
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const target = new THREE.WebGLRenderTarget(size.x, size.y, {
    type: THREE.HalfFloatType,
    samples: quality === 'high' ? 2 : 0,
  });

  const composer = new EffectComposer(renderer, target);
  composer.addPass(new RenderPass(scene, camera));

  const bloom = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    quality === 'high' ? 0.62 : 0.5,
    0.85,
    0.72
  );
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  const grade = new ShaderPass(GradeShader);
  grade.uniforms.uGrain.value = reduced ? 0 : 0.055;
  composer.addPass(grade);

  /* ---------------- camera rig ---------------- */
  // Scroll writes into `rig`; the loop turns it into a camera transform.
  const rig = {
    radius: 15.5,
    theta: 0.55,     // azimuth, radians
    phi: 1.30,       // polar, radians (0 = straight above)
    tx: 0, ty: 3.1, tz: 0,
    fov: 38,
    roll: 0,
    offX: 0,         // lateral camera shift — pushes the model off-centre
    offY: 0,
    exposure: 1.08,
    smoke: 0.42,
    bloom: quality === 'high' ? 0.62 : 0.5,
  };

  const pointer = { x: 0, y: 0, mx: 0, my: 0, ex: 0, ey: 0 };
  if (!isCoarse && !reduced) {
    window.addEventListener('pointermove', (e) => {
      pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
    }, { passive: true });
  }

  const targetVec = new THREE.Vector3();
  const posVec = new THREE.Vector3();

  function applyRig(dt, time) {
    // Smoothing the pointer twice turns the response into an S-curve: the
    // parallax accelerates and settles instead of tracking the cursor 1:1.
    const ease = 1 - Math.pow(0.02, dt);
    pointer.mx += (pointer.x - pointer.mx) * ease;
    pointer.my += (pointer.y - pointer.my) * ease;
    pointer.ex += (pointer.mx - pointer.ex) * ease;
    pointer.ey += (pointer.my - pointer.ey) * ease;

    // A breath of drift so the frame is never perfectly frozen — two slow
    // sines of different periods, far too slow to read as movement.
    const driftT = reduced ? 0 : Math.sin(time * 0.107) * 0.016 + Math.sin(time * 0.041) * 0.009;
    const driftP = reduced ? 0 : Math.sin(time * 0.083 + 1.7) * 0.011;

    const theta = rig.theta + pointer.ex * 0.095 + driftT;
    const phi = clamp(rig.phi + pointer.ey * 0.055 + driftP, 0.18, 2.6);

    posVec.setFromSphericalCoords(rig.radius, phi, theta);
    targetVec.set(rig.tx, rig.ty, rig.tz);
    camera.position.copy(posVec).add(targetVec);
    camera.lookAt(targetVec);
    if (rig.offX || rig.offY) {
      camera.translateX(rig.offX);
      camera.translateY(rig.offY);
    }
    if (rig.roll) camera.rotateZ(rig.roll);

    if (camera.fov !== rig.fov) {
      camera.fov = rig.fov;
      camera.updateProjectionMatrix();
    }

    renderer.toneMappingExposure = rig.exposure;
    smoke.setOpacity(rig.smoke);
    bloom.strength = rig.bloom;
  }

  /* ---------------- loop ---------------- */
  // Everything that needs a heartbeat (scroll sampling, smooth scrolling,
  // the camera easing) hangs off this one rAF loop.
  const frameCallbacks = [];
  const clock = new THREE.Clock();
  let running = true;
  let raf = 0;
  let elapsed = 0;

  // Adaptive quality: if the first seconds are heavy, drop resolution once.
  let frames = 0, accum = 0, downgraded = false;
  let shadowWarmup = 4;

  let smoothDt = 1 / 60;

  function frame() {
    raf = requestAnimationFrame(frame);

    const raw = Math.min(clock.getDelta(), 0.05);
    // Frame times jitter even at a locked 60 Hz; feeding the raw value into a
    // spring shows up as micro-stutter, so the loop runs on a rolling delta.
    smoothDt += (raw - smoothDt) * 0.15;
    const dt = smoothDt;
    elapsed += raw;

    if (!downgraded) {
      frames++; accum += dt;
      if (accum > 2.5) {
        if (frames / accum < 40) {
          renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
          const p = renderer.getPixelRatio();
          smoke.setPixelRatio(p);
          embers.setPixelRatio(p);
          onResize();
          shadowWarmup = 2;
        }
        downgraded = true;
      }
    }

    for (let i = 0; i < frameCallbacks.length; i++) frameCallbacks[i](dt, elapsed);

    hookah.update(elapsed);
    smoke.update(elapsed);
    embers.update(elapsed);
    backdrop.material.uniforms.uTime.value = elapsed;
    grade.uniforms.uTime.value = elapsed;

    applyRig(dt, elapsed);

    // First frames: let the shadow map bake, then freeze it.
    if (shadowWarmup > 0 && renderer.shadowMap.enabled) {
      renderer.shadowMap.needsUpdate = true;
      shadowWarmup--;
    }

    composer.render();
  }

  function start() { if (!running) return; clock.start(); frame(); }
  function stop() { cancelAnimationFrame(raf); }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { running = false; stop(); }
    else { running = true; clock.getDelta(); start(); }
  });

  /* ---------------- resize ---------------- */
  function onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    bloom.setSize(w, h);
  }

  let resizeRaf = 0;
  window.addEventListener('resize', () => {
    cancelAnimationFrame(resizeRaf);
    resizeRaf = requestAnimationFrame(onResize);
  }, { passive: true });

  onResize();

  return {
    rig, scene, camera, renderer, hookah, quality, reduced,
    start, stop,
    /** Register a per-frame callback: fn(deltaSeconds, elapsedSeconds). */
    onFrame(fn) { frameCallbacks.push(fn); return () => {
      const i = frameCallbacks.indexOf(fn);
      if (i >= 0) frameCallbacks.splice(i, 1);
    }; },
    /** Render one frame so shaders are compiled before the reveal. */
    prime() {
      applyRig(0.016, 0);
      renderer.shadowMap.needsUpdate = true;
      composer.render();
    },
  };
}
