// MONSOON ISLES - Main Entry Point
// Boot: renderer, scene, camera, game loop, input, states

import * as THREE from 'three';
import { prng, getSeedFromURL } from './prng.js';
import { createWorld, WORLD_SIZE, WATER_LEVEL } from './world.js';
import { Player } from './player.js';
import { TrafficSystem } from './vehicles.js';
import { PedestrianSystem } from './people.js';

// Game state
const STATE = {
  TITLE: 'title',
  PLAYING: 'playing',
  PAUSED: 'paused',
};

let gameState = STATE.TITLE;
let currentSeed = getSeedFromURL();

// Three.js setup
let renderer, scene, camera;
let world, player, traffic, pedestrians;
let clock = new THREE.Clock();
let lastTime = 0;

// Input state
const input = {
  keys: {},
  prevKeys: {},
  mouseDelta: new THREE.Vector2(),
  pointerLocked: false,
};

// DOM elements
const canvas = document.getElementById('canvas');
const titleScreen = document.getElementById('title-screen');
const pauseScreen = document.getElementById('pause-screen');
const btnNew = document.getElementById('btn-new');
const btnContinue = document.getElementById('btn-continue');
const btnResume = document.getElementById('btn-resume');
const btnQuit = document.getElementById('btn-quit');
const healthFill = document.querySelector('#health-bar .bar-fill');
const staminaFill = document.querySelector('#stamina-bar .bar-fill');
const moneyEl = document.getElementById('money');
const stars = document.querySelectorAll('#stars .star');
const missionBanner = document.getElementById('mission-banner');
const minimap = document.getElementById('minimap');
const minimapCtx = minimap.getContext('2d');

// Initialize
async function init() {
  // Renderer
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  
  // Scene
  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x87ceeb, 0.002);
  
  // Camera
  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 5000);
  camera.position.set(0, 10, 20);
  
  // World
  world = createWorld(scene, currentSeed);
  
  // Player
  player = new Player(world, camera, input);
  world.player = player;
  
  // Traffic
  traffic = new TrafficSystem(world);
  traffic.init();
  world.vehicles = traffic.vehicles;
  world.boats = traffic.boats;
  world.roadNodes = world.roadNodes; // Already created in world
  
  // Pedestrians
  pedestrians = new PedestrianSystem(world);
  pedestrians.init();
  world.pedestrians = pedestrians.pedestrians;
  
  // Event listeners
  setupInput();
  setupUI();
  setupResize();
  
  // Start game loop
  animate();
}

function setupInput() {
  // Keyboard
  window.addEventListener('keydown', (e) => {
    input.keys[e.code] = true;
    
    // Global shortcuts
    if (e.code === 'Escape') {
      if (gameState === STATE.PLAYING) {
        pauseGame();
      } else if (gameState === STATE.PAUSED) {
        resumeGame();
      }
    }
    
    if (e.code === 'F11') {
      e.preventDefault();
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
      } else {
        document.exitFullscreen();
      }
    }
  });
  
  window.addEventListener('keyup', (e) => {
    input.keys[e.code] = false;
  });
  
  // Mouse
  canvas.addEventListener('mousedown', (e) => {
    if (gameState === STATE.PLAYING && !input.pointerLocked) {
      canvas.requestPointerLock();
    }
  });
  
  document.addEventListener('pointerlockchange', () => {
    input.pointerLocked = document.pointerLockElement === canvas;
  });
  
  document.addEventListener('mousemove', (e) => {
    if (input.pointerLocked) {
      input.mouseDelta.x += e.movementX;
      input.mouseDelta.y += e.movementY;
    }
  });
  
  // Prevent context menu
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
}

function setupUI() {
  btnNew.addEventListener('click', () => startGame(false));
  btnContinue.addEventListener('click', () => startGame(true));
  btnResume.addEventListener('click', resumeGame);
  btnQuit.addEventListener('click', quitToTitle);
}

function setupResize() {
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

function startGame(continueSave) {
  // Reset seed if new game
  if (!continueSave) {
    currentSeed = getSeedFromURL();
    prng.seed = currentSeed;
    prng.state = currentSeed;
  }
  
  // Hide title screen
  titleScreen.classList.add('hidden');
  
  // Recreate world with seed
  if (!continueSave) {
    // Dispose old
    if (world) world.dispose();
    if (traffic) traffic.dispose();
    if (pedestrians) pedestrians.dispose();
    
    // Recreate
    world = createWorld(scene, currentSeed);
    player = new Player(world, camera, input);
    world.player = player;
    
    traffic = new TrafficSystem(world);
    traffic.init();
    world.vehicles = traffic.vehicles;
    world.boats = traffic.boats;
    
    pedestrians = new PedestrianSystem(world);
    pedestrians.init();
    world.pedestrians = pedestrians.pedestrians;
  }
  
  gameState = STATE.PLAYING;
  clock.start();
  lastTime = performance.now();
  
  // Lock pointer
  canvas.requestPointerLock();
}

function pauseGame() {
  gameState = STATE.PAUSED;
  pauseScreen.classList.remove('hidden');
  document.exitPointerLock();
  clock.stop();
}

function resumeGame() {
  gameState = STATE.PLAYING;
  pauseScreen.classList.add('hidden');
  canvas.requestPointerLock();
  clock.start();
  lastTime = performance.now();
}

function quitToTitle() {
  gameState = STATE.TITLE;
  pauseScreen.classList.add('hidden');
  titleScreen.classList.remove('hidden');
  document.exitPointerLock();
  clock.stop();
  
  // Reset player position
  if (player) {
    const spawn = world.getPlayerSpawn();
    player.position.copy(spawn);
    player.mesh.position.copy(spawn);
    player.velocity.set(0, 0, 0);
    player.health = player.maxHealth;
    player.stamina = player.maxStamina;
    player.money = 0;
    player.wantedLevel = 0;
  }
}

function animate() {
  requestAnimationFrame(animate);
  
  const now = performance.now();
  const delta = Math.min((now - lastTime) / 1000, 0.1); // Cap at 100ms
  lastTime = now;
  
  // Update previous keys
  Object.keys(input.keys).forEach(key => {
    input.prevKeys[key] = input.keys[key];
  });
  
  switch (gameState) {
    case STATE.PLAYING:
      updateGame(delta);
      break;
    case STATE.PAUSED:
      // Just render
      break;
    case STATE.TITLE:
      // Title screen animation
      updateTitleScreen(delta);
      break;
  }
  
  render();
}

function updateGame(delta) {
  // Update world (day/night, weather, water)
  world.update(delta, camera);
  
  // Update player
  player.update(delta);
  
  // Update traffic
  traffic.update(delta, player.position);
  
  // Update pedestrians
  pedestrians.update(delta);
  
  // Update HUD
  updateHUD();
  
  // Update minimap
  updateMinimap();
  
  // Check for vehicle enter
  if (input.keys.KeyE && !input.prevKeys.KeyE && !player.isInVehicle) {
    player.tryEnterVehicle();
  }
}

function updateTitleScreen(delta) {
  // Slowly rotate camera around center for title screen
  const t = performance.now() * 0.0001;
  camera.position.x = Math.sin(t) * 300;
  camera.position.z = Math.cos(t) * 300;
  camera.position.y = 100 + Math.sin(t * 0.7) * 20;
  camera.lookAt(0, 0, 0);
}

function updateHUD() {
  // Health
  healthFill.style.width = `${player.getHealthPercent() * 100}%`;
  
  // Stamina
  staminaFill.style.width = `${player.getStaminaPercent() * 100}%`;
  
  // Money
  moneyEl.textContent = `$${player.money.toLocaleString()}`;
  
  // Wanted stars
  stars.forEach((star, i) => {
    if (i < player.wantedLevel) {
      star.classList.add('active');
    } else {
      star.classList.remove('active');
    }
  });
}

function updateMinimap() {
  const ctx = minimapCtx;
  const size = 180;
  const scale = size / (WORLD_SIZE * 0.5); // Show 1km radius
  
  ctx.clearRect(0, 0, size, size);
  
  // Background
  ctx.fillStyle = 'rgba(0, 20, 40, 0.8)';
  ctx.fillRect(0, 0, size, size);
  
  // Water
  ctx.fillStyle = '#001a33';
  ctx.fillRect(0, 0, size, size);
  
  // Islands
  ctx.fillStyle = '#2d5a27';
  ISLAND_CENTERS.forEach(center => {
    const x = (center.x + WORLD_SIZE/2) * scale;
    const y = (center.y + WORLD_SIZE/2) * scale;
    const r = 350 * scale;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  });
  
  // Roads (ring roads)
  ctx.strokeStyle = '#444';
  ctx.lineWidth = 2 * scale;
  ISLAND_CENTERS.forEach(center => {
    const x = (center.x + WORLD_SIZE/2) * scale;
    const y = (center.y + WORLD_SIZE/2) * scale;
    const r = 350 * 0.88 * scale;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
  });
  
  // Bridges
  ctx.strokeStyle = '#665544';
  ctx.lineWidth = 3 * scale;
  // Bridge 0-1
  ctx.beginPath();
  ctx.moveTo((ISLAND_CENTERS[0].x + 350*0.88 + WORLD_SIZE/2) * scale, (WORLD_SIZE/2) * scale);
  ctx.lineTo((ISLAND_CENTERS[1].x - 350*0.88 + WORLD_SIZE/2) * scale, (WORLD_SIZE/2) * scale);
  ctx.stroke();
  
  // Player
  const px = (player.position.x + WORLD_SIZE/2) * scale;
  const py = (player.position.z + WORLD_SIZE/2) * scale;
  ctx.fillStyle = '#ff0';
  ctx.beginPath();
  ctx.arc(px, py, 3, 0, Math.PI * 2);
  ctx.fill();
  
  // Player direction
  ctx.strokeStyle = '#ff0';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.lineTo(
    px + Math.sin(player.rotation) * 8,
    py + Math.cos(player.rotation) * 8
  );
  ctx.stroke();
  
  // Vehicles
  ctx.fillStyle = '#fff';
  traffic.vehicles.forEach(v => {
    if (v === player.vehicle) return;
    const vx = (v.mesh.position.x + WORLD_SIZE/2) * scale;
    const vy = (v.mesh.position.z + WORLD_SIZE/2) * scale;
    const dist = Math.hypot(vx - px, vy - py);
    if (dist < size/2) {
      ctx.beginPath();
      ctx.arc(vx, vy, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  
  // Boats
  ctx.fillStyle = '#0ff';
  traffic.boats.forEach(b => {
    const bx = (b.mesh.position.x + WORLD_SIZE/2) * scale;
    const by = (b.mesh.position.z + WORLD_SIZE/2) * scale;
    const dist = Math.hypot(bx - px, by - py);
    if (dist < size/2) {
      ctx.beginPath();
      ctx.arc(bx, by, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

function render() {
  renderer.render(scene, camera);
}

// Need ISLAND_CENTERS for minimap
const ISLAND_CENTERS = [
  { x: -500, y: 0 },
  { x: 500, y: 0 },
  { x: 0, y: -500 },
];

// Start
init().catch(console.error);

// Export for debugging
window.game = {
  get scene() { return scene; },
  get camera() { return camera; },
  get renderer() { return renderer; },
  get world() { return world; },
  get player() { return player; },
  get traffic() { return traffic; },
  get pedestrians() { return pedestrians; },
  setSeed: (seed) => {
    currentSeed = seed;
    prng.seed = seed;
    prng.state = seed;
  },
};