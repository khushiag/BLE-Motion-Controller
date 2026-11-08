import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { TiltBoard } from './ble.js';

// ───────────────────────── Settings you can tweak ─────────────────────────
const CONFIG = {
  // Copy these three from the CONFIG in game.js if you changed them for the maze
  SWAP_AXES: true,
  INVERT_LR: true,
  INVERT_FB: true,

  MAX_INPUT_DEG: 25,     // real-board tilt that counts as "full"
  DEADZONE_DEG: 2,       // ignore tiny wobbles around level
  STEER_SPEED: 11,       // sideways metres/second at full tilt
  START_CRUISE: 38,      // starting cruise speed (m/s)
  MAX_CRUISE: 70,        // cruise speed ramps up to this
  TRAFFIC_SPEED: 22,     // other cars' speed (m/s)
};

const LANES = [-4, 0, 4];
const ROAD_HALF = 6;
const ROAD_LEN = 420;
const SPAWN_Z = -260;

// ───────────────────────── HUD ─────────────────────────
const $ = (id) => document.getElementById(id);
const hud = {
  connect: $('connectBtn'), calib: $('calibBtn'), status: $('status'), rate: $('rate'),
  score: $('score'), dist: $('dist'), orbs: $('orbs'), best: $('best'), speed: $('speed'),
  overlay: $('overlay'), title: $('overlayTitle'), sub: $('overlaySub'), debug: $('debug'), flash: $('flash'),
};

// ───────────────────────── Board + input ─────────────────────────
const board = new TiltBoard();
board.onStatus = (msg) => (hud.status.textContent = msg);
hud.connect.addEventListener('click', () => board.connect());
hud.calib.addEventListener('click', calibrate);
if (!board.supported) hud.status.textContent = 'No Web Bluetooth here: use arrow keys';

const calib = { lr: 0, fb: 0 };
function rawBoardAxes() {
  return {
    lr: CONFIG.SWAP_AXES ? board.pitch : board.roll,
    fb: CONFIG.SWAP_AXES ? board.roll : board.pitch,
  };
}
function calibrate() {
  const r = rawBoardAxes();
  calib.lr = r.lr;
  calib.fb = r.fb;
  hud.status.textContent = 'Calibrated: this is now "level"';
}
function shape(deg) {
  const dz = CONFIG.DEADZONE_DEG;
  const v = Math.abs(deg) < dz ? 0 : deg - Math.sign(deg) * dz;
  return THREE.MathUtils.clamp(v / (CONFIG.MAX_INPUT_DEG - dz), -1, 1);
}

const keys = new Set();
addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  keys.add(k);
  if (k === ' ') { e.preventDefault(); tryStart(); }
  if (k === 'c') calibrate();
  if (k === 'l') runLatencyTest();
  if (k.startsWith('arrow')) e.preventDefault();
});
addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));

// lr > 0 = tilt left (steer left), fb > 0 = tilt forward (speed up)
function readInput() {
  if (board.connected) {
    const r = rawBoardAxes();
    let lr = shape(r.lr - calib.lr);
    let fb = shape(r.fb - calib.fb);
    if (CONFIG.INVERT_LR) lr = -lr;
    if (CONFIG.INVERT_FB) fb = -fb;
    return { lr, fb };
  }
  const k = (...n) => n.some((x) => keys.has(x));
  return {
    lr: (k('arrowleft', 'a') ? 1 : 0) - (k('arrowright', 'd') ? 1 : 0),
    fb: (k('arrowup', 'w') ? 1 : 0) - (k('arrowdown', 's') ? 1 : 0),
  };
}

let latencyRunning = false;
async function runLatencyTest() {
  if (latencyRunning) return;
  if (!board.connected) { hud.status.textContent = 'Connect the board first, then press L'; return; }
  latencyRunning = true;
  hud.status.textContent = 'Measuring latency… (~3 s)';
  try {
    const r = await board.measureLatency(100);
    hud.status.textContent = `Radio round trip ${r.roundTrip.median} ms (p95 ${r.roundTrip.p95}) · one-way ≈ ${(r.roundTrip.median / 2).toFixed(1)} ms`;
    console.table({ 'Radio round trip (ms)': r.roundTrip, 'Time between updates (ms)': r.notifyInterval });
  } catch (err) {
    hud.status.textContent = `Latency test failed: ${err.message}`;
  }
  latencyRunning = false;
}

// ───────────────────────── Renderer & scene ─────────────────────────
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = makeSkyTexture();
scene.fog = new THREE.Fog(0x1a0830, 60, 300);

const camera = new THREE.PerspectiveCamera(65, innerWidth / innerHeight, 0.1, 1000);
camera.position.set(0, 3.2, 7.5);

scene.add(new THREE.HemisphereLight(0xb08cff, 0x200a30, 1.1));
const sunLight = new THREE.DirectionalLight(0xff9ad5, 0.6);
sunLight.position.set(0, 10, -20);
scene.add(sunLight);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.9, 0.5, 0.75));
composer.addPass(new OutputPass());

// ───────────────────────── World pieces ─────────────────────────
function makeSkyTexture() {
  const c = document.createElement('canvas');
  c.width = 2; c.height = 512;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, '#05010d');
  grad.addColorStop(0.45, '#1a0830');
  grad.addColorStop(0.62, '#5a1250');
  grad.addColorStop(0.7, '#1a0830');
  grad.addColorStop(1, '#0a0414');
  g.fillStyle = grad;
  g.fillRect(0, 0, 2, 512);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Road surface with lane dashes (texture scrolls to fake motion)
const roadTex = (() => {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#120a1e';
  g.fillRect(0, 0, 256, 256);
  g.fillStyle = '#ffffff';
  const laneLine = (x) => g.fillRect(x - 3, 0, 6, 128); // dashed: half on, half off
  laneLine(256 * (4 / 12));  // between lane 1 and 2
  laneLine(256 * (8 / 12));  // between lane 2 and 3
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1, ROAD_LEN / 12);
  t.anisotropy = 8;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
})();
const road = new THREE.Mesh(
  new THREE.PlaneGeometry(ROAD_HALF * 2, ROAD_LEN),
  new THREE.MeshStandardMaterial({ map: roadTex, roughness: 0.6, metalness: 0.2 }),
);
road.rotation.x = -Math.PI / 2;
road.position.z = -ROAD_LEN / 2 + 20;
scene.add(road);

// Neon synthwave grid on the ground around the road
const gridTex = (() => {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#0a0414';
  g.fillRect(0, 0, 128, 128);
  g.strokeStyle = '#ff4fd8';
  g.lineWidth = 3;
  g.strokeRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(60, 60);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
})();
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(600, 600),
  new THREE.MeshBasicMaterial({ map: gridTex }),
);
ground.rotation.x = -Math.PI / 2;
ground.position.set(0, -0.05, -280);
scene.add(ground);

// Glowing road edges
const edgeMat = new THREE.MeshBasicMaterial({ color: 0x29d3ff });
for (const x of [-ROAD_HALF - 0.1, ROAD_HALF + 0.1]) {
  const edge = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, ROAD_LEN), edgeMat);
  edge.position.set(x, 0.06, -ROAD_LEN / 2 + 20);
  scene.add(edge);
}

// Retro sun with stripes cut out of the bottom half
const sun = new THREE.Mesh(
  new THREE.CircleGeometry(70, 64),
  new THREE.ShaderMaterial({
    fog: false,
    transparent: true,
    uniforms: { uTime: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `
      varying vec2 vUv; uniform float uTime;
      void main(){
        vec3 top = vec3(1.0, 0.85, 0.3), bottom = vec3(1.0, 0.18, 0.6);
        vec3 col = mix(bottom, top, vUv.y);
        float y = vUv.y;
        float stripes = step(0.5, fract(y * 14.0 - uTime * 0.25));
        float cut = (y < 0.5) ? stripes : 1.0;
        gl_FragColor = vec4(col * 0.8, cut);
      }`,
  }),
);
sun.position.set(0, 28, -420);
scene.add(sun);

// Wireframe mountains on both sides of the horizon
function makeRidge(xOffset) {
  const geo = new THREE.PlaneGeometry(260, 60, 26, 6);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const t = (y + 30) / 60;  // 0 at base, 1 at top row
    pos.setZ(i, t > 0.05 ? Math.random() * 28 * Math.sin(t * Math.PI) : 0);
  }
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x8a2be2, wireframe: true }));
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(xOffset, 0, -330);
  return mesh;
}
scene.add(makeRidge(-170), makeRidge(170));

// Light posts that rush past (recycled)
const postGeo = new THREE.BoxGeometry(0.2, 4, 0.2);
const postMat = new THREE.MeshStandardMaterial({ color: 0x2a1a40 });
const bulbGeo = new THREE.BoxGeometry(0.9, 0.15, 0.3);
const bulbMat = new THREE.MeshBasicMaterial({ color: 0xff4fd8 });
const posts = [];
for (let i = 0; i < 20; i++) {
  for (const side of [-1, 1]) {
    const g = new THREE.Group();
    const p = new THREE.Mesh(postGeo, postMat);
    p.position.y = 2;
    const b = new THREE.Mesh(bulbGeo, bulbMat);
    b.position.set(-side * 0.4, 4, 0);
    g.add(p, b);
    g.position.set(side * (ROAD_HALF + 1.2), 0, -i * 20);
    scene.add(g);
    posts.push(g);
  }
}

// ───────────────────────── Cars ─────────────────────────
const carGeo = {
  body: new THREE.BoxGeometry(1.8, 0.5, 3.8),
  cabin: new THREE.BoxGeometry(1.4, 0.45, 1.8),
  wheel: new THREE.CylinderGeometry(0.34, 0.34, 0.3, 16).rotateZ(Math.PI / 2),
  light: new THREE.BoxGeometry(0.45, 0.12, 0.06),
  strip: new THREE.BoxGeometry(1.84, 0.05, 3.84),
};
const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0b0b10, roughness: 0.9 });
const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2a3c });
const headMat = new THREE.MeshBasicMaterial({ color: 0xfff4d6 });
const glassMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.1, metalness: 0.8 });

function makeCar(bodyColor, glowColor) {
  const car = new THREE.Group();
  const body = new THREE.Mesh(carGeo.body, new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.35, metalness: 0.5 }));
  body.position.y = 0.55;
  const cabin = new THREE.Mesh(carGeo.cabin, glassMat);
  cabin.position.set(0, 1.02, 0.2);
  const strip = new THREE.Mesh(carGeo.strip, new THREE.MeshBasicMaterial({ color: glowColor }));
  strip.position.y = 0.32;
  car.add(body, cabin, strip);
  for (const [x, z] of [[-0.9, 1.25], [0.9, 1.25], [-0.9, -1.25], [0.9, -1.25]]) {
    const w = new THREE.Mesh(carGeo.wheel, wheelMat);
    w.position.set(x, 0.34, z);
    car.add(w);
  }
  for (const x of [-0.6, 0.6]) {
    const tail = new THREE.Mesh(carGeo.light, tailMat);
    tail.position.set(x, 0.65, 1.92);
    const head = new THREE.Mesh(carGeo.light, headMat);
    head.position.set(x, 0.65, -1.92);
    car.add(tail, head);
  }
  return car;
}

const player = makeCar(0x0e3a5a, 0x29d3ff);
scene.add(player);

const trafficColors = [[0x5a0e3a, 0xff4fd8], [0x3a2a0e, 0xffb020], [0x1e0e5a, 0x8a5cff], [0x0e5a3a, 0x3dffa8]];
const orbGeo = new THREE.IcosahedronGeometry(0.55, 1);
const orbMat = new THREE.MeshBasicMaterial({ color: 0xffe14f });

let traffic = []; // { mesh, x, z }
let orbList = []; // { mesh, x, z }

// ───────────────────────── Game state ─────────────────────────
let state = 'ready';   // 'ready' | 'playing' | 'crashed'
let carX = 0, speed = 0, distance = 0, orbs = 0, playTime = 0;
let spawnTimer = 0, crashTime = 0, forwardHold = 0;
const steer = { lr: 0, fb: 0 };

function getBest() { try { return Number(localStorage.getItem('tiltdrive-best')) || 0; } catch { return 0; } }
function setBest(v) { try { localStorage.setItem('tiltdrive-best', String(v)); } catch { /* ignore */ } }
hud.best.textContent = getBest();

const score = () => Math.floor(distance) + orbs * 100;

function clearObjects() {
  traffic.forEach((t) => scene.remove(t.mesh));
  orbList.forEach((o) => scene.remove(o.mesh));
  traffic = [];
  orbList = [];
}

function tryStart() {
  if (state === 'playing') return;
  if (state === 'crashed' && performance.now() - crashTime < 1200) return;
  clearObjects();
  carX = 0; speed = CONFIG.START_CRUISE; distance = 0; orbs = 0; playTime = 0; spawnTimer = 0.5;
  player.rotation.set(0, 0, 0);
  state = 'playing';
  hud.overlay.classList.remove('show');
}

function crash() {
  if (state !== 'playing') return;
  state = 'crashed';
  crashTime = performance.now();
  hud.flash.style.transition = 'none';
  hud.flash.style.opacity = 0.55;
  requestAnimationFrame(() => { hud.flash.style.transition = 'opacity 500ms'; hud.flash.style.opacity = 0; });
  const s = score();
  const best = getBest();
  if (s > best) setBest(s);
  hud.best.textContent = Math.max(s, best);
  hud.title.textContent = 'Crashed!';
  hud.sub.innerHTML = `Score <b>${s}</b>${s > best ? ' · new best!' : ''} · ${Math.floor(distance)} m · ${orbs} orbs<br>` +
    'Press Space, or tilt forward and hold, to drive again';
  hud.overlay.classList.add('show');
}

function spawnRow() {
  const difficulty = Math.min(playTime / 90, 1);
  const free = Math.floor(Math.random() * 3);
  let placed = 0;
  for (let i = 0; i < 3; i++) {
    if (i === free) continue;
    if (placed < 2 && Math.random() < 0.45 + difficulty * 0.4) {
      const [bc, gc] = trafficColors[Math.floor(Math.random() * trafficColors.length)];
      const mesh = makeCar(bc, gc);
      mesh.position.set(LANES[i], 0, SPAWN_Z);
      scene.add(mesh);
      traffic.push({ mesh, x: LANES[i], z: SPAWN_Z });
      placed++;
    }
  }
  if (Math.random() < 0.35) {
    const mesh = new THREE.Mesh(orbGeo, orbMat);
    mesh.position.set(LANES[free], 1, SPAWN_Z);
    scene.add(mesh);
    orbList.push({ mesh, x: LANES[free], z: SPAWN_Z });
  }
}

// ───────────────────────── Main loop ─────────────────────────
let last = performance.now();
function tick(now) {
  const dt = Math.min((now - last) / 1000, 1 / 20);
  last = now;
  const t = now / 1000;

  const input = readInput();
  const k = 1 - Math.exp(-dt * 15);
  steer.lr += (input.lr - steer.lr) * k;
  steer.fb += (input.fb - steer.fb) * k;

  // Start / restart by holding the board tilted forward
  if (state !== 'playing') {
    forwardHold = input.fb > 0.6 ? forwardHold + dt : 0;
    if (forwardHold > 0.8) { forwardHold = 0; tryStart(); }
  }

  if (state === 'playing') {
    playTime += dt;
    const difficulty = Math.min(playTime / 90, 1);
    const cruise = THREE.MathUtils.lerp(CONFIG.START_CRUISE, CONFIG.MAX_CRUISE, difficulty);

    // Speed: forward tilt = boost, back tilt = brake, level = cruise
    const target = steer.fb >= 0 ? cruise + steer.fb * 25 : cruise * (1 + steer.fb * 0.6);
    speed += (target - speed) * dt * 1.6;

    // Steering: tilt left = move left. Sharper at higher speed.
    carX -= steer.lr * CONFIG.STEER_SPEED * (0.7 + 0.3 * speed / CONFIG.MAX_CRUISE) * dt;

    // Off the road edge: slow down and bump back
    const limit = ROAD_HALF - 1;
    if (Math.abs(carX) > limit) {
      carX = Math.sign(carX) * limit;
      speed *= 1 - dt * 1.2;
    }

    distance += speed * dt;

    // Spawn traffic rows; faster spawning as difficulty rises
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      spawnRow();
      spawnTimer = THREE.MathUtils.lerp(1.5, 0.7, difficulty);
    }

    // Move traffic toward the player (relative speed)
    const rel = speed - CONFIG.TRAFFIC_SPEED;
    for (const c of traffic) {
      c.z += rel * dt;
      c.mesh.position.z = c.z;
      if (Math.abs(c.x - carX) < 1.75 && Math.abs(c.z) < 3.6) crash();
    }
    traffic = traffic.filter((c) => (c.z > 20 ? (scene.remove(c.mesh), false) : true));

    for (const o of orbList) {
      o.z += speed * dt;
      o.mesh.position.z = o.z;
      o.mesh.rotation.y = t * 3;
      if (!o.taken && Math.abs(o.x - carX) < 1.6 && Math.abs(o.z) < 2.2) {
        o.taken = true;
        orbs++;
        speed += 6;
        scene.remove(o.mesh);
      }
    }
    orbList = orbList.filter((o) => (o.z > 20 || o.taken ? (scene.remove(o.mesh), false) : true));
  } else if (state === 'crashed') {
    speed *= 1 - dt * 2.5;
    player.rotation.y += dt * speed * 0.08;
  } else {
    speed += (12 - speed) * dt; // idle roll on the title screen
  }

  // Scroll the world
  roadTex.offset.y += (speed * dt) / 12;
  gridTex.offset.y += (speed * dt) / 10;
  for (const p of posts) {
    p.position.z += speed * dt;
    if (p.position.z > 15) p.position.z -= 400;
  }
  sun.material.uniforms.uTime.value = t;

  // Player car pose
  player.position.x = carX;
  if (state === 'playing') {
    player.rotation.y = steer.lr * 0.22;
    player.rotation.z = -steer.lr * 0.05;
  }

  // Camera follows, widens field of view with speed
  camera.position.x += (carX * 0.6 - camera.position.x) * Math.min(dt * 6, 1);
  const shake = state === 'playing' && Math.abs(carX) >= ROAD_HALF - 1.01 ? (Math.random() - 0.5) * 0.12 : 0;
  camera.position.y = 3.2 + shake;
  camera.fov = THREE.MathUtils.clamp(60 + (speed - 30) * 0.35, 60, 85);
  camera.updateProjectionMatrix();
  camera.lookAt(carX * 0.8, 1, -14);

  // HUD
  hud.speed.textContent = Math.round(speed * 3.6);
  hud.score.textContent = score();
  hud.dist.textContent = `${Math.floor(distance)} m`;
  hud.orbs.textContent = orbs;
  hud.rate.textContent = board.connected ? `${board.updatesPerSec} updates/s` : 'keyboard mode';
  hud.debug.textContent = board.connected
    ? `raw roll ${board.roll.toFixed(1)}°  pitch ${board.pitch.toFixed(1)}°  →  steer ${input.lr.toFixed(2)}  throttle ${input.fb.toFixed(2)}`
    : `steer ${input.lr.toFixed(2)}  throttle ${input.fb.toFixed(2)}`;

  composer.render();
  requestAnimationFrame(tick);
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
});

requestAnimationFrame(tick);