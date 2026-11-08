import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { LEVELS } from './levels.js';
import { TiltBoard } from './ble.js';

// ───────────────────────── Settings you can tweak ─────────────────────────
const CONFIG = {
  SWAP_AXES: true,     // the board's "pitch" is your left/right (seen in Phase 2)
  INVERT_LR: true,    // flip if tilting left rolls the ball right
  INVERT_FB: true,    // flip if tilting forward rolls the ball toward you
  MAX_INPUT_DEG: 25,   // real-board tilt that counts as "full tilt"
  MAX_BOARD_DEG: 14,   // how far the on-screen maze tilts at full tilt
  DEADZONE_DEG: 1.5,   // ignore tiny wobbles around level
  GRAVITY: 150,         // higher = ball accelerates faster
};

const CELL = 1;
const WALL_H = 0.6;
const FLOOR_T = 0.3;
const BALL_R = 0.3;

// ───────────────────────── HUD ─────────────────────────
const $ = (id) => document.getElementById(id);
const hud = {
  connect: $('connectBtn'), calib: $('calibBtn'), status: $('status'),
  rate: $('rate'), level: $('level'), time: $('time'), falls: $('falls'),
  best: $('best'), overlay: $('overlay'), title: $('overlayTitle'),
  sub: $('overlaySub'), debug: $('debug'),
};

// ───────────────────────── Bluetooth board ─────────────────────────
const board = new TiltBoard();
board.onStatus = (msg) => (hud.status.textContent = msg);
hud.connect.addEventListener('click', () => board.connect());
hud.calib.addEventListener('click', calibrate);
if (!board.supported) hud.status.textContent = 'No Web Bluetooth here: use arrow keys';

const calib = { lr: 0, fb: 0 };
function rawBoardAxes() {
  let lr = CONFIG.SWAP_AXES ? board.pitch : board.roll;
  let fb = CONFIG.SWAP_AXES ? board.roll : board.pitch;
  return { lr, fb };
}
function calibrate() {
  const r = rawBoardAxes();
  calib.lr = r.lr;
  calib.fb = r.fb;
  hud.status.textContent = 'Calibrated: this is now "level"';
}

// ───────────────────────── Latency test (press L) ─────────────────────────
let latencyRunning = false;
async function runLatencyTest() {
  if (latencyRunning) return;
  if (!board.connected) { hud.status.textContent = 'Connect the board first, then press L'; return; }
  latencyRunning = true;
  hud.status.textContent = 'Measuring latency… keep the board still (~3 s)';
  try {
    const r = await board.measureLatency(100);
    const rt = r.roundTrip, ni = r.notifyInterval;
    const oneWay = (rt.median / 2).toFixed(1);
    hud.status.textContent = `Radio round trip ${rt.median} ms (p95 ${rt.p95}) · one-way ≈ ${oneWay} ms`;
    console.log('%cLatency results', 'font-weight:bold;font-size:14px');
    console.table({ 'Radio round trip (ms)': rt, 'Time between updates (ms)': ni });
    console.log(`Estimated one-way radio delay ≈ ${oneWay} ms (half the median round trip)`);
  } catch (err) {
    hud.status.textContent = `Latency test failed: ${err.message}`;
  }
  latencyRunning = false;
}

// ───────────────────────── Keyboard fallback ─────────────────────────
const keys = new Set();
addEventListener('keydown', (e) => {
  keys.add(e.key.toLowerCase());
  if (e.key === 'r' || e.key === 'R') loadLevel(levelIndex);
  if (e.key === 'c' || e.key === 'C') calibrate();
  if (e.key === 'n' || e.key === 'N') loadLevel((levelIndex + 1) % LEVELS.length);
  if (e.key === 'l' || e.key === 'L') runLatencyTest();
  if (e.key.startsWith('Arrow')) e.preventDefault();
});
addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));

function shape(deg) {
  const dz = CONFIG.DEADZONE_DEG;
  const v = Math.abs(deg) < dz ? 0 : deg - Math.sign(deg) * dz;
  return THREE.MathUtils.clamp(v / (CONFIG.MAX_INPUT_DEG - dz), -1, 1);
}

// Returns lr and fb in -1..1. lr > 0 = tilt left, fb > 0 = tilt forward (away from you)
function readInput() {
  if (board.connected) {
    const r = rawBoardAxes();
    let lr = shape(r.lr - calib.lr);
    let fb = shape(r.fb - calib.fb);
    if (CONFIG.INVERT_LR) lr = -lr;
    if (CONFIG.INVERT_FB) fb = -fb;
    return { lr, fb };
  }
  const k = (...names) => names.some((n) => keys.has(n));
  return {
    lr: (k('arrowleft', 'a') ? 1 : 0) - (k('arrowright', 'd') ? 1 : 0),
    fb: (k('arrowup', 'w') ? 1 : 0) - (k('arrowdown', 's') ? 1 : 0),
  };
}

// ───────────────────────── Three.js scene ─────────────────────────
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05070d);
scene.fog = new THREE.Fog(0x05070d, 18, 40);

const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 100);

scene.add(new THREE.HemisphereLight(0x8fa8ff, 0x10121a, 0.6));
const sun = new THREE.DirectionalLight(0xffffff, 1.6);
sun.position.set(-6, 14, 8);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10 });
scene.add(sun);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.7, 0.5, 0.82);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// The tilting maze lives in this group; physics runs in the group's local space
const mazeGroup = new THREE.Group();
scene.add(mazeGroup);

const mats = {
  floor: new THREE.MeshStandardMaterial({ color: 0x1a2133, roughness: 0.85, metalness: 0.1 }),
  wall: new THREE.MeshStandardMaterial({ color: 0x232c45, roughness: 0.5, metalness: 0.3 }),
  edge: new THREE.LineBasicMaterial({ color: 0x5b7cff }),
  holeRim: new THREE.LineBasicMaterial({ color: 0xff3b5c }),
  ball: new THREE.MeshStandardMaterial({ color: 0x9ff3ff, emissive: 0x29d3ff, emissiveIntensity: 1.4, roughness: 0.2 }),
  goal: new THREE.MeshBasicMaterial({ color: 0xff4fd8 }),
  beam: new THREE.MeshBasicMaterial({ color: 0xff4fd8, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false }),
};

// Ball (mesh + glow light), reused across levels
const ballMesh = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 32, 16), mats.ball);
ballMesh.castShadow = true;
const ballLight = new THREE.PointLight(0x29d3ff, 6, 4, 2);
ballMesh.add(ballLight);

// ───────────────────────── Physics world ─────────────────────────
const world = new CANNON.World();
const groundMat = new CANNON.Material('ground');
const ballMat = new CANNON.Material('ball');
world.addContactMaterial(new CANNON.ContactMaterial(groundMat, ballMat, { friction: 0.25, restitution: 0.25 }));

const ballBody = new CANNON.Body({
  mass: 1,
  shape: new CANNON.Sphere(BALL_R),
  material: ballMat,
  linearDamping: 0.15,
  angularDamping: 0.3,
});
ballBody.allowSleep = false;

// ───────────────────────── Level building ─────────────────────────
let levelIndex = 0;
let level = null;          // { startPos, goalPos, width, height }
let staticBodies = [];
let state = 'playing';
let levelTime = 0;
let falls = 0;

function cellToLocal(r, c, w, h) {
  return new THREE.Vector3((c - (w - 1) / 2) * CELL, 0, (r - (h - 1) / 2) * CELL);
}

function addBox(sx, sy, sz, pos, isWall) {
  // physics
  const body = new CANNON.Body({ mass: 0, material: groundMat });
  body.addShape(new CANNON.Box(new CANNON.Vec3(sx / 2, sy / 2, sz / 2)));
  body.position.set(pos.x, pos.y, pos.z);
  world.addBody(body);
  staticBodies.push(body);
  // visuals for walls (floor tiles are drawn separately)
  if (isWall) {
    const geo = new THREE.BoxGeometry(sx, sy, sz);
    const mesh = new THREE.Mesh(geo, mats.wall);
    mesh.position.copy(pos);
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), mats.edge));
    mazeGroup.add(mesh);
  }
}

// Merge each row's runs of matching cells into one long box (fewer seams = smoother rolling)
function addRuns(rows, test, height, y, isWall) {
  const h = rows.length, w = rows[0].length;
  for (let r = 0; r < h; r++) {
    let c = 0;
    while (c < w) {
      if (!test(rows[r][c])) { c++; continue; }
      const start = c;
      while (c < w && test(rows[r][c])) c++;
      const len = c - start;
      const a = cellToLocal(r, start, w, h);
      const b = cellToLocal(r, c - 1, w, h);
      addBox(len * CELL, height, CELL, new THREE.Vector3((a.x + b.x) / 2, y, a.z), isWall);
    }
  }
}

function clearLevel() {
  staticBodies.forEach((b) => world.removeBody(b));
  staticBodies = [];
  world.removeBody(ballBody);
  mazeGroup.traverse((o) => { if (o.geometry && o !== ballMesh) o.geometry.dispose(); });
  mazeGroup.clear();
}

function loadLevel(i) {
  clearLevel();
  levelIndex = i;
  const { rows, name } = LEVELS[i];
  const h = rows.length, w = rows[0].length;
  let startPos, goalPos;

  const isFloor = (ch) => ch === '.' || ch === 'S' || ch === 'G';
  addRuns(rows, isFloor, FLOOR_T, -FLOOR_T / 2, false);
  addRuns(rows, (ch) => ch === '#', WALL_H, WALL_H / 2, true);

  // Floor tiles drawn one per cell (with a tiny gap) for a tiled look
  const tileGeo = new THREE.BoxGeometry(CELL * 0.96, FLOOR_T, CELL * 0.96);
  const rimGeo = new THREE.EdgesGeometry(new THREE.PlaneGeometry(CELL * 0.9, CELL * 0.9).rotateX(-Math.PI / 2));
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      const ch = rows[r][c];
      const p = cellToLocal(r, c, w, h);
      if (isFloor(ch)) {
        const tile = new THREE.Mesh(tileGeo, mats.floor);
        tile.position.set(p.x, -FLOOR_T / 2, p.z);
        tile.receiveShadow = true;
        mazeGroup.add(tile);
      }
      if (ch === 'O') {
        const rim = new THREE.LineSegments(rimGeo, mats.holeRim);
        rim.position.set(p.x, -0.02, p.z);
        mazeGroup.add(rim);
      }
      if (ch === 'S') startPos = p.clone().setY(BALL_R + 0.05);
      if (ch === 'G') goalPos = p.clone();
    }
  }

  // Goal: glowing ring + light beam
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.05, 12, 48), mats.goal);
  ring.rotation.x = -Math.PI / 2;
  ring.position.copy(goalPos).setY(0.02);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 3, 32, 1, true), mats.beam);
  beam.position.copy(goalPos).setY(1.5);
  mazeGroup.add(ring, beam);
  level = { startPos, goalPos, ring, w, h, name };

  mazeGroup.add(ballMesh);
  world.addBody(ballBody);
  resetBall();

  levelTime = 0;
  falls = 0;
  state = 'playing';
  hud.overlay.classList.remove('show');
  hud.level.textContent = `${i + 1}/${LEVELS.length} · ${name}`;
  hud.best.textContent = formatBest(getBest(i));
  frameCamera();
}

function resetBall() {
  ballBody.position.set(level.startPos.x, level.startPos.y, level.startPos.z);
  ballBody.velocity.setZero();
  ballBody.angularVelocity.setZero();
}

function frameCamera() {
  const size = Math.max(level.w, level.h * 1.3);
  const dist = size * 1.15 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / Math.max(camera.aspect, 0.8) * 0.75;
  camera.position.set(0, dist * 0.9, dist * 0.55);
  camera.lookAt(0, 0, 0.3);
}

// ───────────────────────── Best times (per browser) ─────────────────────────
function getBest(i) {
  try { return Number(localStorage.getItem(`tiltmaze-best-${i}`)) || null; } catch { return null; }
}
function setBest(i, t) {
  try { localStorage.setItem(`tiltmaze-best-${i}`, String(t)); } catch { /* ignore */ }
}
const formatBest = (t) => (t ? `${t.toFixed(2)}s` : '—');

// ───────────────────────── Win / fall checks ─────────────────────────
function checkGoal() {
  const dx = ballBody.position.x - level.goalPos.x;
  const dz = ballBody.position.z - level.goalPos.z;
  if (Math.hypot(dx, dz) < 0.32 && ballBody.position.y > 0) {
    state = 'won';
    const prev = getBest(levelIndex);
    const isRecord = !prev || levelTime < prev;
    if (isRecord) setBest(levelIndex, levelTime);
    const last = levelIndex === LEVELS.length - 1;
    hud.title.textContent = last ? 'You beat every level!' : 'Level complete';
    hud.sub.textContent = `${levelTime.toFixed(2)}s${isRecord ? ' · new best!' : ''} · falls: ${falls}` +
      (last ? ' · press R to replay' : '');
    hud.overlay.classList.add('show');
    if (!last) setTimeout(() => loadLevel(levelIndex + 1), 2500);
  }
  if (ballBody.position.y < -4) {
    falls++;
    resetBall();
  }
}

// ───────────────────────── Main loop ─────────────────────────
const tilt = { lr: 0, fb: 0 };
const euler = new THREE.Euler();
const quat = new THREE.Quaternion();
const gLocal = new THREE.Vector3();
const clock = new THREE.Clock();
const maxRad = THREE.MathUtils.degToRad(CONFIG.MAX_BOARD_DEG);

function tick() {
  const dt = Math.min(clock.getDelta(), 1 / 20);
  const t = clock.elapsedTime;

  // 1. Input -> smoothed board tilt
  const input = state === 'playing' ? readInput() : { lr: 0, fb: 0 };
  const k = 1 - Math.exp(-dt * 12);
  tilt.lr += (input.lr - tilt.lr) * k;
  tilt.fb += (input.fb - tilt.fb) * k;
  mazeGroup.rotation.set(-tilt.fb * maxRad, 0, tilt.lr * maxRad);

  // 2. Gravity expressed in the maze's own frame
  euler.copy(mazeGroup.rotation);
  quat.setFromEuler(euler).invert();
  gLocal.set(0, -CONFIG.GRAVITY, 0).applyQuaternion(quat);
  world.gravity.set(gLocal.x, gLocal.y, gLocal.z);

  // 3. Physics
  if (state === 'playing') {
    world.step(1 / 120, dt, 8);
    levelTime += dt;
    checkGoal();
  }
  ballMesh.position.copy(ballBody.position);
  ballMesh.quaternion.copy(ballBody.quaternion);

  // 4. Little animations
  level.ring.scale.setScalar(1 + Math.sin(t * 4) * 0.08);
  ballLight.intensity = 5 + Math.sin(t * 6) * 1;

  // 5. HUD
  hud.time.textContent = `${levelTime.toFixed(1)}s`;
  hud.falls.textContent = falls;
  hud.rate.textContent = board.connected ? `${board.updatesPerSec} updates/s` : 'keyboard mode';
  hud.debug.textContent = board.connected
    ? `raw roll ${board.roll.toFixed(1)}°  pitch ${board.pitch.toFixed(1)}°  →  L/R ${input.lr.toFixed(2)}  F/B ${input.fb.toFixed(2)}`
    : `L/R ${input.lr.toFixed(2)}  F/B ${input.fb.toFixed(2)}`;

  composer.render();
  requestAnimationFrame(tick);
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
  frameCamera();
});

camera.aspect = innerWidth / innerHeight;
camera.updateProjectionMatrix();
loadLevel(0);
tick();