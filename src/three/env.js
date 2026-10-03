import * as THREE from 'three';

/* =========================================================
   A hand-built lounge "studio": four coloured emissive
   panels baked into an environment map with PMREM.
   Cheaper than shipping an HDRI and tuned to the brand —
   amber key, violet fill, cool rim, warm floor bounce.
   ========================================================= */

const KEY_COLOR = 0xFFB068;
const FILL_COLOR = 0x7A46F0;
const RIM_COLOR = 0xC6DCFF;
const BOUNCE_COLOR = 0x3A1F12;

/** Soft elliptical falloff so a panel reads as a lamp, not a billboard. */
let softMap = null;
function softness() {
  if (softMap) return softMap;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.45, '#b4b4b4');
  g.addColorStop(0.78, '#2c2c2c');
  g.addColorStop(1, '#000000');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  softMap = new THREE.CanvasTexture(c);
  softMap.colorSpace = THREE.SRGBColorSpace;
  return softMap;
}

function panel(w, h, hex, intensity, pos, lookAt) {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({
      color: new THREE.Color(hex).multiplyScalar(intensity),
      map: softness(),
      side: THREE.DoubleSide,
    })
  );
  mesh.position.set(pos[0], pos[1], pos[2]);
  const target = lookAt || [0, 3, 0];
  mesh.lookAt(new THREE.Vector3(target[0], target[1], target[2]));
  return mesh;
}

export function buildEnvironment(renderer) {
  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color(0x05040A);

  envScene.add(panel(14, 14, KEY_COLOR, 5.2, [9, 9, 6]));
  envScene.add(panel(16, 18, FILL_COLOR, 2.6, [-11, 4, -3]));
  envScene.add(panel(18, 10, RIM_COLOR, 3.0, [0, 6, -12]));
  envScene.add(panel(22, 22, BOUNCE_COLOR, 1.4, [0, -6, 0], [0, 3, 0]));

  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const rt = pmrem.fromScene(envScene, 0.06, 0.1, 160);
  pmrem.dispose();

  envScene.traverse((o) => {
    if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); }
  });

  return rt.texture;
}

/* ---------------------------------------------------------
   Backdrop: a large inverted sphere with a vertical gradient
   plus a warm pool of light behind the model, so the scene
   never bottoms out into flat black.
   --------------------------------------------------------- */
const BG_TOP = 0x0A0713;
const BG_MID = 0x1B0E20;
const BG_BOTTOM = 0x040308;
const BG_GLOW = 0x51260E;

export function buildBackdrop() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uTop: { value: new THREE.Color(BG_TOP) },
      uMid: { value: new THREE.Color(BG_MID) },
      uBottom: { value: new THREE.Color(BG_BOTTOM) },
      uGlow: { value: new THREE.Color(BG_GLOW) },
      uTime: { value: 0 },
    },
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uTop, uMid, uBottom, uGlow;
      uniform float uTime;
      varying vec3 vDir;

      void main() {
        float h = vDir.y * 0.5 + 0.5;
        vec3 col = mix(uBottom, uMid, smoothstep(0.0, 0.52, h));
        col = mix(col, uTop, smoothstep(0.5, 1.0, h));

        // warm pool of light low and slightly to the right
        vec3 g = normalize(vec3(0.42, -0.12, -0.86));
        float pool = pow(max(dot(normalize(vDir), g), 0.0), 5.0);
        col += uGlow * pool * (0.85 + 0.15 * sin(uTime * 0.35));

        // faint banding break-up
        float n = fract(sin(dot(vDir.xy, vec2(12.9898, 78.233))) * 43758.5453);
        col += (n - 0.5) * 0.012;

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });

  const mesh = new THREE.Mesh(new THREE.SphereGeometry(60, 32, 24), mat);
  mesh.frustumCulled = false;
  return { mesh, material: mat };
}
