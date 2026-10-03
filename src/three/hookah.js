import * as THREE from 'three';
import { zigzagWrap, brushed } from './textures.js';

/* =========================================================
   Procedural hookah.
   Everything is a body of revolution (lathe) plus one swept
   tube for the hose — no external model files to download,
   and every proportion is tunable right here.
   Units: 1 unit ~ 8 cm. Overall height ~ 6.6 units.
   ========================================================= */

const V2 = (x, y) => new THREE.Vector2(x, y);

const GOLD = 0xDCA85C;
const GRAPHITE = 0x2C2B33;
const CLAY = 0x15121A;

/** Raw profile -> lathe (crisp edges: machined metal parts). */
function lathe(points, seg) {
  const g = new THREE.LatheGeometry(points.map(([x, y]) => V2(x, y)), seg);
  g.computeVertexNormals();
  return g;
}

/** Smoothed profile -> lathe (organic parts: glass, bowl). */
function latheSmooth(points, seg, samples = 130) {
  const curve = new THREE.CatmullRomCurve3(
    points.map(([x, y]) => new THREE.Vector3(x, y, 0)),
    false, 'catmullrom', 0.5
  );
  const pts = curve.getPoints(samples).map((p) => V2(Math.max(p.x, 0.0001), p.y));
  const g = new THREE.LatheGeometry(pts, seg);
  g.computeVertexNormals();
  return g;
}

function makeMaterials() {
  const brushMap = brushed();

  const glass = new THREE.MeshPhysicalMaterial({
    color: 0xFFFFFF, metalness: 0, roughness: 0.07,
    transmission: 1, thickness: 0.9, ior: 1.52,
    clearcoat: 1, clearcoatRoughness: 0.03,
    attenuationColor: new THREE.Color(0x9E86C4), attenuationDistance: 9,
    envMapIntensity: 2.4, side: THREE.DoubleSide,
    transparent: true, depthWrite: false,
  });

  const liquid = new THREE.MeshPhysicalMaterial({
    color: 0xFFFFFF, metalness: 0, roughness: 0.05,
    transmission: 1, thickness: 2.4, ior: 1.34,
    attenuationColor: new THREE.Color(0xE07B14), attenuationDistance: 0.85,
    emissive: new THREE.Color(0x2A0F02), emissiveIntensity: 1,
    envMapIntensity: 1.8, side: THREE.DoubleSide,
    transparent: true, depthWrite: false,
  });

  const steel = new THREE.MeshStandardMaterial({
    color: GRAPHITE, metalness: 1, roughness: 0.29,
    roughnessMap: brushMap, envMapIntensity: 1.6,
  });

  const gold = new THREE.MeshStandardMaterial({
    color: GOLD, metalness: 1, roughness: 0.17, envMapIntensity: 2.0,
  });

  const ceramic = new THREE.MeshPhysicalMaterial({
    color: CLAY, metalness: 0, roughness: 0.42,
    clearcoat: 0.9, clearcoatRoughness: 0.2, envMapIntensity: 1.1,
  });

  const rubber = new THREE.MeshStandardMaterial({
    color: 0x0E0D12, metalness: 0.15, roughness: 0.72, envMapIntensity: 0.7,
  });

  const coal = new THREE.MeshStandardMaterial({
    color: 0x140D0A, roughness: 0.95, metalness: 0,
    emissive: new THREE.Color(0xFF4A08), emissiveIntensity: 2.4,
  });

  return { glass, liquid, steel, gold, ceramic, rubber, coal, brushMap };
}

/* ---------------- profiles ---------------- */

// Glass base: wide belly, long tapered neck.
const P_VASE = [
  [0.02, 0.00], [0.50, 0.00], [0.72, 0.07], [0.87, 0.26],
  [0.96, 0.62], [0.94, 1.02], [0.80, 1.40], [0.56, 1.70],
  [0.365, 1.92], [0.300, 2.08], [0.318, 2.21], [0.318, 2.27],
];

// Liquid volume, closed with a flat surface.
const P_LIQUID = [
  [0.02, 0.03], [0.47, 0.03], [0.68, 0.10], [0.83, 0.28],
  [0.915, 0.62], [0.90, 0.98], [0.84, 1.20], [0.78, 1.28], [0.02, 1.29],
];

// Central column: downstem inside the glass, collar, shaft, two rings, bowl seat.
const P_STEM = [
  [0.000, 0.26], [0.090, 0.26], [0.090, 2.00], [0.130, 2.00],
  [0.130, 2.10], [0.345, 2.15], [0.345, 2.32], [0.300, 2.37],
  [0.140, 2.42], [0.128, 3.52], [0.205, 3.60], [0.205, 3.78],
  [0.132, 3.86], [0.126, 4.62], [0.180, 4.70], [0.180, 4.86],
  [0.124, 4.94], [0.118, 5.24], [0.160, 5.30], [0.100, 5.36],
];

// Wide tray that catches ash.
const P_PLATE = [
  [0.145, 2.60], [0.86, 2.56], [0.96, 2.66], [0.96, 2.80],
  [0.90, 2.78], [0.84, 2.66], [0.145, 2.70],
];

// Clay bowl.
const P_BOWL = [
  [0.100, 5.34], [0.270, 5.36], [0.305, 5.48], [0.325, 5.66],
  [0.360, 5.84], [0.394, 5.96], [0.400, 6.02],
];

// Heat manager cap sitting on the bowl.
const P_HMD = [
  [0.412, 5.99], [0.430, 6.07], [0.412, 6.22], [0.352, 6.33],
  [0.220, 6.40], [0.080, 6.42], [0.048, 6.47], [0.000, 6.48],
];

/* ---------------- gold accent rings ---------------- */
const RINGS = [
  { y: 2.335, r: 0.352, t: 0.026 },
  { y: 3.690, r: 0.213, t: 0.024 },
  { y: 4.780, r: 0.188, t: 0.022 },
  { y: 2.060, r: 0.330, t: 0.030 },
  { y: 6.010, r: 0.420, t: 0.022 },
];

/* ---------------- hose path ---------------- */
const HOSE_PATH = [
  [0.20, 3.70, 0.02], [0.72, 3.66, 0.42], [1.42, 3.16, 0.98],
  [2.00, 2.20, 1.34], [2.18, 1.12, 1.22], [1.92, 0.44, 0.62],
  [1.24, 0.22, -0.22], [0.52, 0.30, -1.02], [0.06, 0.72, -1.62],
  [0.14, 1.28, -2.04], [0.52, 1.62, -2.26],
];

export function buildHookah({ quality = 'high' } = {}) {
  const seg = quality === 'low' ? 56 : 128;
  const M = makeMaterials();

  const group = new THREE.Group();
  group.name = 'hookah';

  const solids = new THREE.Group();       // opaque, casts shadows
  const clears = new THREE.Group();       // transmissive, drawn last
  group.add(solids, clears);

  /* ---- glass + liquid ---- */
  const vase = new THREE.Mesh(latheSmooth(P_VASE, seg), M.glass);
  vase.renderOrder = 4;
  clears.add(vase);

  const liquid = new THREE.Mesh(latheSmooth(P_LIQUID, seg), M.liquid);
  liquid.renderOrder = 3;
  clears.add(liquid);

  /* ---- column ---- */
  const stem = new THREE.Mesh(lathe(P_STEM, seg), M.steel);
  stem.castShadow = true;
  solids.add(stem);

  const plate = new THREE.Mesh(lathe(P_PLATE, seg), M.steel.clone());
  plate.material.side = THREE.DoubleSide;
  plate.material.roughness = 0.3;
  plate.castShadow = true;
  plate.receiveShadow = true;
  solids.add(plate);

  for (const r of RINGS) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(r.r, r.t, 14, Math.max(seg / 2, 40)),
      M.gold
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = r.y;
    ring.castShadow = true;
    solids.add(ring);
  }

  /* ---- bowl + tobacco bed ---- */
  const bowlGeo = latheSmooth(P_BOWL, seg);
  const bowl = new THREE.Mesh(bowlGeo, M.ceramic);
  bowl.material.side = THREE.DoubleSide;
  bowl.castShadow = true;
  solids.add(bowl);

  const bed = new THREE.Mesh(
    new THREE.CircleGeometry(0.37, seg / 2),
    new THREE.MeshStandardMaterial({ color: 0x241009, roughness: 1 })
  );
  bed.rotation.x = -Math.PI / 2;
  bed.position.y = 5.97;
  solids.add(bed);

  /* ---- heat manager + coals ---- */
  const hmd = new THREE.Mesh(latheSmooth(P_HMD, seg), M.steel.clone());
  hmd.material.side = THREE.DoubleSide;
  hmd.material.color = new THREE.Color(0x3A3941);
  hmd.material.roughness = 0.46;
  hmd.castShadow = true;
  solids.add(hmd);

  // Coals live under the cap; their light leaks through the vents.
  const coals = new THREE.Group();
  coals.position.y = 6.05;
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    const c = new THREE.Mesh(new THREE.DodecahedronGeometry(0.12, 0), M.coal);
    c.position.set(Math.cos(a) * 0.17, Math.random() * 0.03, Math.sin(a) * 0.17);
    c.rotation.set(Math.random(), Math.random(), Math.random());
    c.scale.set(1, 0.72, 1);
    coals.add(c);
  }
  solids.add(coals);

  // Vent glow: additive quads hugging the cap silhouette.
  const ventGeo = new THREE.PlaneGeometry(0.05, 0.17);
  const ventMat = new THREE.MeshBasicMaterial({
    color: 0xFF6A18, transparent: true, opacity: 0.85,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  const vents = new THREE.InstancedMesh(ventGeo, ventMat, 16);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    dummy.position.set(Math.cos(a) * 0.428, 6.13, Math.sin(a) * 0.428);
    dummy.rotation.set(0, -a + Math.PI / 2, 0);
    dummy.updateMatrix();
    vents.setMatrixAt(i, dummy.matrix);
  }
  vents.instanceMatrix.needsUpdate = true;
  vents.renderOrder = 5;
  group.add(vents);

  /* ---- hose port + hose + mouthpiece ---- */
  const port = new THREE.Mesh(
    new THREE.CylinderGeometry(0.085, 0.105, 0.30, 32),
    M.gold
  );
  port.rotation.z = -Math.PI / 2 + 0.18;
  port.rotation.y = -0.1;
  port.position.set(0.19, 3.70, 0.02);
  port.castShadow = true;
  solids.add(port);

  const curve = new THREE.CatmullRomCurve3(
    HOSE_PATH.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
    false, 'catmullrom', 0.35
  );

  const wrap = zigzagWrap();
  wrap.repeat.set(26, 1);
  const hose = new THREE.Mesh(
    new THREE.TubeGeometry(curve, quality === 'low' ? 120 : 300, 0.078, quality === 'low' ? 10 : 18, false),
    new THREE.MeshStandardMaterial({
      map: wrap, color: 0xFFFFFF,
      metalness: 0.45, roughness: 0.52, envMapIntensity: 1.1,
    })
  );
  hose.castShadow = true;
  solids.add(hose);

  // Mouthpiece oriented along the end of the curve.
  const tipPos = curve.getPointAt(1);
  const tipDir = curve.getTangentAt(1);
  const mouth = new THREE.Mesh(
    lathe([
      [0.000, 0.00], [0.088, 0.00], [0.098, 0.05], [0.086, 0.30],
      [0.112, 0.34], [0.112, 0.40], [0.070, 0.46], [0.062, 0.62],
      [0.052, 0.66], [0.000, 0.66],
    ], 48),
    M.gold
  );
  mouth.position.copy(tipPos);
  mouth.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tipDir.clone().normalize());
  mouth.castShadow = true;
  solids.add(mouth);

  // Rubber grommet where the hose enters the port.
  const grommet = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.032, 12, 36), M.rubber);
  grommet.position.set(0.30, 3.69, 0.06);
  grommet.rotation.y = Math.PI / 2;
  grommet.rotation.x = 0.12;
  solids.add(grommet);

  /* ---- release valve on the far side ---- */
  const valve = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.18, 20), M.gold);
  valve.rotation.z = Math.PI / 2;
  valve.position.set(-0.17, 3.30, 0);
  solids.add(valve);

  /* =======================================================
     DETAIL PASS
     Everything below is small on purpose: it is what makes a
     lathe silhouette read as a machined, hand-finished object
     once the camera gets close (chapters 02 and 04).
     ======================================================= */

  const ringCache = new Map();
  /** Thin torus lying flat at height y: the workhorse of the detailing. */
  function addRing(y, radius, tube, material, parent = solids) {
    const key = radius + '|' + tube;
    let geo = ringCache.get(key);
    if (!geo) {
      geo = new THREE.TorusGeometry(radius, tube, 10, Math.max(seg / 2, 40));
      ringCache.set(key, geo);
    }
    const ring = new THREE.Mesh(geo, material);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = y;
    parent.add(ring);
    return ring;
  }

  /* ---- glass: foot, neck seal, brand zigzag, foam line ---- */
  addRing(0.045, 0.50, 0.050, M.rubber);               // rubber foot
  addRing(0.105, 0.735, 0.016, M.gold);                // gilded lip of the foot
  addRing(2.285, 0.335, 0.036, M.rubber);              // neck grommet

  // The logo, inlaid in gold around the belly of the flask.
  {
    const PEAKS = 26, TOP = 0.90, BOTTOM = 0.66, SUB = 6;
    const pts = [];
    for (let i = 0; i < PEAKS * 2; i++) {
      const y = i % 2 === 0 ? BOTTOM : TOP;
      const nextY = i % 2 === 0 ? TOP : BOTTOM;
      const a = (i / (PEAKS * 2)) * Math.PI * 2;
      const na = ((i + 1) / (PEAKS * 2)) * Math.PI * 2;
      for (let k = 0; k < SUB; k++) {
        const f = k / SUB;
        const ay = y + (nextY - y) * f;
        const aa = a + (na - a) * f;
        const r = 0.968 - (ay - 0.62) * 0.05;          // hugs the flask wall
        pts.push(new THREE.Vector3(Math.cos(aa) * r, ay, Math.sin(aa) * r));
      }
    }
    const zz = new THREE.CatmullRomCurve3(pts, true, 'centripetal');
    const inlay = new THREE.Mesh(
      new THREE.TubeGeometry(zz, PEAKS * 2 * SUB * 2, 0.0135, 8, true),
      M.gold
    );
    solids.add(inlay);
  }

  // Foam line riding on the liquid surface.
  const foam = new THREE.Mesh(
    new THREE.TorusGeometry(0.80, 0.014, 8, Math.max(seg / 2, 40)),
    new THREE.MeshStandardMaterial({
      color: 0xFFE9C8, roughness: 0.5, emissive: new THREE.Color(0x4A2A10),
      transparent: true, opacity: 0.55, depthWrite: false,
    })
  );
  foam.rotation.x = Math.PI / 2;
  foam.position.y = 1.285;
  foam.renderOrder = 5;
  group.add(foam);

  /* ---- downstem: diffuser + bubbles that actually rise ---- */
  const diffuser = new THREE.Mesh(
    lathe([
      [0.0, 0.26], [0.17, 0.27], [0.19, 0.31], [0.17, 0.40],
      [0.115, 0.46], [0.095, 0.50], [0.0, 0.50],
    ], seg),
    M.steel
  );
  solids.add(diffuser);
  const slotMat = new THREE.MeshBasicMaterial({ color: 0x030203 });
  const slotGeo = new THREE.BoxGeometry(0.012, 0.075, 0.03);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const slot = new THREE.Mesh(slotGeo, slotMat);
    slot.position.set(Math.cos(a) * 0.178, 0.34, Math.sin(a) * 0.178);
    slot.rotation.y = -a;
    solids.add(slot);
  }
  addRing(0.52, 0.098, 0.014, M.gold);

  const BUBBLES = quality === 'low' ? 22 : 46;
  const bubbleMat = new THREE.MeshStandardMaterial({
    color: 0xFFE6BC, roughness: 0.15, metalness: 0,
    emissive: new THREE.Color(0x8A4A12), emissiveIntensity: 0.9,
  });
  const bubbles = new THREE.InstancedMesh(new THREE.SphereGeometry(0.026, 10, 8), bubbleMat, BUBBLES);
  bubbles.frustumCulled = false;
  const bDummy = new THREE.Object3D();
  const bSeed = Float32Array.from({ length: BUBBLES }, () => Math.random());
  const bSpeed = Float32Array.from({ length: BUBBLES }, () => 0.16 + Math.random() * 0.22);
  const bAng = Float32Array.from({ length: BUBBLES }, () => Math.random() * Math.PI * 2);
  group.add(bubbles);

  /* ---- column: knurling, beads, collars ---- */
  addRing(2.40, 0.150, 0.016, M.gold);
  for (let i = 0; i < 6; i++) addRing(2.95 + i * 0.085, 0.134, 0.0105, i % 2 ? M.gold : M.steel);
  addRing(3.60, 0.208, 0.012, M.gold);
  addRing(3.78, 0.208, 0.012, M.gold);
  for (let i = 0; i < 9; i++) addRing(4.00 + i * 0.056, 0.1335, 0.0095, M.steel);
  addRing(4.00, 0.136, 0.014, M.gold);
  addRing(4.45, 0.136, 0.014, M.gold);
  for (let i = 0; i < 5; i++) addRing(4.97 + i * 0.058, 0.121, 0.009, i % 2 ? M.gold : M.steel);
  addRing(4.70, 0.182, 0.011, M.gold);
  addRing(4.86, 0.182, 0.011, M.gold);
  addRing(5.30, 0.163, 0.013, M.gold);

  // a faceted bead on the shaft, the one "jewel" detail
  const bead = new THREE.Mesh(new THREE.IcosahedronGeometry(0.19, 2), M.steel);
  bead.scale.set(1, 0.74, 1);
  bead.position.y = 3.22;
  solids.add(bead);
  addRing(3.22, 0.192, 0.012, M.gold);

  /* ---- ash tray: bead rim + gilded studs ---- */
  addRing(2.78, 0.945, 0.026, M.steel);
  addRing(2.62, 0.20, 0.016, M.gold);
  {
    const STUDS = 28;
    const studs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.026, 10, 8), M.gold, STUDS);
    const d = new THREE.Object3D();
    for (let i = 0; i < STUDS; i++) {
      const a = (i / STUDS) * Math.PI * 2;
      d.position.set(Math.cos(a) * 0.64, 2.688, Math.sin(a) * 0.64);
      d.updateMatrix();
      studs.setMatrixAt(i, d.matrix);
    }
    studs.instanceMatrix.needsUpdate = true;
    solids.add(studs);
  }

  /* ---- bowl: flutes, grommet, rim ---- */
  addRing(5.345, 0.172, 0.040, M.rubber);
  addRing(6.000, 0.400, 0.018, M.gold);
  {
    const FLUTES = 16;
    const flutes = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.0125, 0.0125, 0.46, 6), M.ceramic, FLUTES);
    const d = new THREE.Object3D();
    const tilt = Math.atan2(0.394 - 0.305, 0.48);
    for (let i = 0; i < FLUTES; i++) {
      const a = (i / FLUTES) * Math.PI * 2;
      d.position.set(Math.cos(a) * 0.338, 5.72, Math.sin(a) * 0.338);
      d.rotation.set(0, 0, 0);
      d.rotateY(-a);
      d.rotateZ(-tilt);
      d.updateMatrix();
      flutes.setMatrixAt(i, d.matrix);
    }
    flutes.instanceMatrix.needsUpdate = true;
    solids.add(flutes);
  }

  /* ---- heat manager: perforations that breathe with the coals ---- */
  const holeDark = new THREE.MeshBasicMaterial({ color: 0x040303 });
  const holeHot = new THREE.MeshBasicMaterial({
    color: 0xFF6414, transparent: true, opacity: 0.8,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const HOLE_RINGS = [[0.12, 6, 6.426], [0.205, 10, 6.410], [0.285, 14, 6.378]];
  const holeCount = HOLE_RINGS.reduce((n, r) => n + r[1], 0);
  const darkHoles = new THREE.InstancedMesh(new THREE.CircleGeometry(0.030, 12), holeDark, holeCount);
  const hotHoles = new THREE.InstancedMesh(new THREE.CircleGeometry(0.017, 10), holeHot, holeCount);
  hotHoles.renderOrder = 6;
  {
    const d = new THREE.Object3D();
    let n = 0;
    for (const [r, count, y] of HOLE_RINGS) {
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2 + r * 7;
        d.position.set(Math.cos(a) * r, y + 0.003, Math.sin(a) * r);
        d.rotation.set(-Math.PI / 2, 0, 0);
        d.updateMatrix();
        darkHoles.setMatrixAt(n, d.matrix);
        d.position.y += 0.002;
        d.updateMatrix();
        hotHoles.setMatrixAt(n, d.matrix);
        n++;
      }
    }
    darkHoles.instanceMatrix.needsUpdate = true;
    hotHoles.instanceMatrix.needsUpdate = true;
  }
  group.add(darkHoles, hotHoles);

  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.05, 20, 14), M.gold);
  knob.position.y = 6.50;
  solids.add(knob);

  /* ---- hose: ferrules, port nut, mouthpiece beads ---- */
  {
    const up = new THREE.Vector3(0, 1, 0);
    const ferrule = (u, h, r) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 28), M.gold);
      m.position.copy(curve.getPointAt(u));
      m.quaternion.setFromUnitVectors(up, curve.getTangentAt(u).normalize());
      solids.add(m);
      const lip = new THREE.Mesh(new THREE.TorusGeometry(r, 0.014, 8, 28), M.gold);
      lip.position.copy(m.position);
      lip.quaternion.copy(m.quaternion);
      lip.rotateX(Math.PI / 2);
      lip.translateZ(h / 2);
      solids.add(lip);
    };
    ferrule(0.035, 0.17, 0.099);
    ferrule(0.965, 0.15, 0.092);
    ferrule(0.50, 0.07, 0.088);          // mid-hose cuff, breaks up the long run
  }

  const portNut = new THREE.Mesh(new THREE.TorusGeometry(0.108, 0.026, 10, 28), M.gold);
  portNut.position.set(0.255, 3.695, 0.04);
  portNut.rotation.y = Math.PI / 2 + 0.12;
  solids.add(portNut);

  // two beads and a rubber tip on the mouthpiece (local space: y = along the pipe)
  for (const y of [0.17, 0.52]) {
    const b = new THREE.Mesh(new THREE.TorusGeometry(y < 0.3 ? 0.092 : 0.066, 0.017, 8, 24), M.gold);
    b.rotation.x = Math.PI / 2;
    b.position.y = y;
    mouth.add(b);
  }
  const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.058, 0.07, 20), M.rubber);
  tip.position.y = 0.64;
  mouth.add(tip);

  /* ---- release valve: knob and collar ---- */
  const valveKnob = new THREE.Mesh(new THREE.SphereGeometry(0.075, 18, 12), M.gold);
  valveKnob.position.set(-0.30, 3.30, 0);
  solids.add(valveKnob);
  const valveCollar = new THREE.Mesh(new THREE.TorusGeometry(0.058, 0.014, 8, 20), M.steel);
  valveCollar.rotation.y = Math.PI / 2;
  valveCollar.position.set(-0.235, 3.30, 0);
  solids.add(valveCollar);

  /* ---- light that lives with the coals ---- */
  const coalLight = new THREE.PointLight(0xFF5A12, 6, 5.5, 2);
  coalLight.position.set(0, 6.15, 0);
  group.add(coalLight);

  solids.traverse((o) => { if (o.isMesh) o.castShadow = true; });

  return {
    group,
    materials: M,
    parts: { vase, liquid, stem, plate, bowl, hmd, hose, mouth, coals, vents, coalLight },
    hoseCurve: curve,
    height: 6.6,

    /** Per-frame life: coal breathing + vent flicker. */
    update(t) {
      const breathe = 0.5 + 0.5 * Math.sin(t * 1.7) * Math.sin(t * 0.53 + 1.1);
      const flick = 0.85 + 0.15 * Math.sin(t * 9.1) * Math.sin(t * 3.7);
      M.coal.emissiveIntensity = 1.9 + breathe * 1.9;
      ventMat.opacity = 0.45 + breathe * 0.45 * flick;
      coalLight.intensity = (4.2 + breathe * 3.4) * flick;
      coals.rotation.y = t * 0.06;
      holeHot.opacity = 0.35 + breathe * 0.6 * flick;

      // Bubbles leave the diffuser, drift outward as they climb, and shrink
      // to nothing at the surface instead of popping out of existence.
      for (let i = 0; i < BUBBLES; i++) {
        const ph = (t * bSpeed[i] + bSeed[i]) % 1;
        const ang = bAng[i] + ph * 2.6 + Math.sin(t * 1.3 + i) * 0.15;
        const rad = 0.13 + ph * 0.26 + Math.sin(t * 2.1 + i * 3.1) * 0.02;
        const sc = (0.55 + ph * 0.75) * (1 - Math.pow(ph, 9));
        bDummy.position.set(Math.cos(ang) * rad, 0.46 + ph * 0.80, Math.sin(ang) * rad);
        bDummy.scale.setScalar(Math.max(sc, 0.001));
        bDummy.updateMatrix();
        bubbles.setMatrixAt(i, bDummy.matrix);
      }
      bubbles.instanceMatrix.needsUpdate = true;
    },
  };
}
