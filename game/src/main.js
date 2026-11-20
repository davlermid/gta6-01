// MONSOON ISLES - Main Entry Point
// Boot: renderer, scene, camera, game loop, input, states
// Wires: world, player, traffic, pedestrians, police, combat, missions, HUD, audio, save

import * as THREE from 'three';
import { prng, getSeedFromURL } from './prng.js';
import { createWorld, WORLD_SIZE, WATER_LEVEL, ISLAND_CENTERS } from './world.js';
import { Player } from './player.js';
import { TrafficSystem, Vehicle, Boat } from './vehicles.js';
import { PedestrianSystem } from './people.js';
import { createPoliceSystem, PoliceVehicle } from './police.js';
import { createCombatSystem } from './combat.js';
import { createMissionSystem } from './missions.js';
import { createHUDSystem } from './hud.js';
import { createAudioSystem } from './audio.js';
import { createSaveSystem } from './save.js';
import { initShots } from './shots.js';

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
let world, player, traffic, pedestrians, police, combat, missions, hud, audio, save;
let clock = new THREE.Clock();
let lastTime = 0;

// Input state
const input = {
  keys: {},
  prevKeys: {},
  mouseDelta: new THREE.Vector2(),
  pointerLocked: false,
  isMouseDown: false,
};

// DOM elements
const canvas = document.getElementById('canvas');
const titleScreen = document.getElementById('title-screen');
const pauseScreen = document.getElementById('pause-screen');
const btnNew = document.getElementById('btn-new');
const btnContinue = document.getElementById('btn-continue');
const btnResume = document.getElementById('btn-resume');
const btnSave = document.getElementById('btn-save');
const btnLoad = document.getElementById('btn-load');
const btnControls = document.getElementById('btn-controls');
const btnQuality = document.getElementById('btn-quality');
const btnVolume = document.getElementById('btn-volume');
const btnQuit = document.getElementById('btn-quit');
const missionBanner = document.getElementById('mission-banner');
const minimap = document.getElementById('minimap');
const minimapCtx = minimap.getContext('2d');

// Graphics quality
let graphicsQuality = 'high';
const qualitySettings = {
  low: { pixelRatio: 1, shadows: false, shadowMapSize: 512, foam: false, rainParticles: 500 },
  medium: { pixelRatio: Math.min(window.devicePixelRatio, 1.5), shadows: true, shadowMapSize: 1024, foam: true, rainParticles: 1500 },
  high: { pixelRatio: Math.min(window.devicePixelRatio, 2), shadows: true, shadowMapSize: 2048, foam: true, rainParticles: 3000 },
};

// Shot mode detection
const urlParams = new URLSearchParams(window.location.search);
const shotMode = urlParams.get('shot');
let shotFrames = 0;
let shotStats = { frames: 0 };
window.__shotStats = shotStats;

// Initialize
async function init() {
  // Shot mode: delegate to shots.js
  if (shotMode) {
    return initShots();
  }

  // Renderer
  const q = qualitySettings[graphicsQuality];
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: graphicsQuality !== 'low',
    alpha: false,
    powerPreference: 'high-performance',
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(q.pixelRatio);
  renderer.shadowMap.enabled = q.shadows;
  if (q.shadows) {
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate = true;
  }
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
  world.roadNodes = world.roadNodes;

  // Pedestrians
  pedestrians = new PedestrianSystem(world);
  pedestrians.init();
  world.pedestrians = pedestrians.pedestrians;

  // Police
  police = createPoliceSystem(world);
  police.init();
  world.policeSystem = police;

  // Combat
  combat = createCombatSystem(world, player, input);
  player.combatSystem = combat;
  world.combatSystem = combat;

  // Missions
  missions = createMissionSystem(world, player, traffic, police);
  world.missionSystem = missions;

  // Audio
  audio = createAudioSystem();
  await audio.init();
  audio.setPlayer(player, null, world);

  // HUD
  hud = createHUDSystem(world, player, traffic, missions, input);

  // Save system
  save = createSaveSystem(player, world, missions, combat, audio, hud);

  // Update Continue button
  updateContinueButton();

  // Event listeners
  setupInput();
  setupUI();
  setupResize();

  // Setup pause menu callbacks
  hud.setupPauseMenu(
    resumeGame,
    () => save.save('manual'),
    () => save.load('manual'),
    quitToTitle,
    cycleQuality,
    cycleVolume
  );

  // Start game loop
  animate();
}

function initShotMode() {
  // Minimal renderer for shots
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    alpha: false,
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(1);
  renderer.shadowMap.enabled = false;

  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 5000);

  // Create world with fixed seed for consistency
  world = createWorld(scene, 12345);

  // Player for shot modes
  player = new Player(world, camera, input);
  world.player = player;

  // Traffic for shot modes
  traffic = new TrafficSystem(world);
  traffic.init();
  world.vehicles = traffic.vehicles;
  world.boats = traffic.boats;

  // Pedestrians for shot modes
  pedestrians = new PedestrianSystem(world);
  pedestrians.init();
  world.pedestrians = pedestrians.pedestrians;

  // Police for shot modes
  police = createPoliceSystem(world);
  police.init();
  world.policeSystem = police;

  // Setup shot scene
  setupShotScene();

  // Shot mode render loop
  function shotAnimate() {
    requestAnimationFrame(shotAnimate);

    const delta = 1/60;

    // Update world
    world.update(delta, camera);

    // Update traffic
    traffic.update(delta, player.position);

    // Update pedestrians
    pedestrians.update(delta);

    // Update police
    police.update(delta, player);

    // Override camera for shot
    updateShotCamera(delta);

    renderer.render(scene, camera);

    shotFrames++;
    shotStats.frames = shotFrames;

    if (shotFrames === 3) {
      window.__ready = true;
    }
  }

  window.__samplePixels = function() {
    // Force a render first to ensure drawing buffer has content
    renderer.render(scene, camera);

    const gl = renderer.getContext();
    // Use drawingBufferWidth/Height for correct framebuffer size
    const width = renderer.domElement.width;
    const height = renderer.domElement.height;
    const pixels = new Uint8Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

    let nonBlackCount = 0;
    let totalBrightness = 0;

    for (let i = 0; i < pixels.length; i += 4) {
      const r = pixels[i], g = pixels[i+1], b = pixels[i+2];
      const brightness = (r + g + b) / 3;
      totalBrightness += brightness;
      if (brightness > 10) nonBlackCount++;
    }

    return {
      nonBlackCount,
      totalSamples: width * height,
      nonBlackPercent: (nonBlackCount / (width * height) * 100).toFixed(2),
      averageBrightness: (totalBrightness / (width * height)).toFixed(2),
    };
  };

  shotAnimate();
}

function setupShotScene() {
  switch (shotMode) {
    case 'title':
      // Title screen over slow orbit of harbor daylight
      world.timeOfDay = 0.3; // Late morning
      world.setWeather('clear');
      break;
    case 'drive':
      // Player IN sports car on main bridge deck golden hour ~17:30
      world.timeOfDay = 0.65; // ~17:30
      world.setWeather('clear');
      placePlayerInSportsCarOnBridge();
      break;
    case 'boat':
      // Player IN boat open water sunset ~18:15 camera 10m behind 4m above lighthouse island ahead
      world.timeOfDay = 0.68; // ~18:15
      world.setWeather('clear');
      placePlayerInBoatAtSea();
      break;
    case 'wanted':
      // Night ~22:00 rain player in car street camera behind two police cars flashing light bars 6-10m behind wanted 3
      world.timeOfDay = 0.85; // ~22:00
      world.setWeather('rain');
      world.rainIntensity = 1;
      world.targetRainIntensity = 1;
      placePlayerInCarWithPolice();
      break;
  }
}

function placePlayerInSportsCarOnBridge() {
  // Bridge 0-1 (west-east) midpoint
  const bridgeX = (ISLAND_CENTERS[0].x + ISLAND_RADIUS * 0.88 + ISLAND_CENTERS[1].x - ISLAND_RADIUS * 0.88) / 2;
  const bridgeZ = 0;
  const bridgeY = 4.35; // Bridge deck height

  // Find or create sports car
  let sportsCar = traffic.vehicles.find(v => v.type === 'SPORTS');
  if (!sportsCar) {
    sportsCar = new Vehicle(world, 'SPORTS', bridgeX, bridgeZ, 0);
    sportsCar.isAI = false;
    traffic.vehicles.push(sportsCar);
  }

  sportsCar.mesh.position.set(bridgeX, bridgeY, bridgeZ);
  sportsCar.rotation = 0;
  sportsCar.speed = 30;
  sportsCar.mesh.rotation.y = 0;

  player.enterVehicle(sportsCar);
  player.isInVehicle = true;
  player.vehicle = sportsCar;
  sportsCar.driver = player;
  sportsCar.isPlayer = true;
}

function placePlayerInBoatAtSea() {
  // Open water between islands, lighthouse island ahead (west island north)
  // West island center: (-500, 0), radius ~350. South = z < -350
  const boatX = -500;
  const boatZ = -600;  // Well south of west island (z=-350 is south edge)
  const boatY = WATER_LEVEL + 0.5;

  let boat = traffic.boats.find(b => b.type === 'SPEEDBOAT');
  if (!boat) {
    boat = new Boat(world, 'SPEEDBOAT', boatX, boatZ, 0);  // Face north towards lighthouse
    boat.isAI = false;
    traffic.boats.push(boat);
  }

  boat.mesh.position.set(boatX, boatY, boatZ);
  boat.rotation = 0;  // Face north towards lighthouse
  boat.speed = 15;

  player.enterVehicle(boat);
  player.isInVehicle = true;
  player.vehicle = boat;
  boat.driver = player;
  boat.isPlayer = true;
}

function placePlayerInCarWithPolice() {
  // Street on west island
  const carX = -500 + 200;
  const carZ = 50;
  const carY = world.getGroundHeight(carX, carZ) + 0.35;

  let car = traffic.vehicles.find(v => v.type === 'SEDAN');
  if (!car) {
    car = new Vehicle(world, 'SEDAN', carX, carZ, 0);
    car.isAI = false;
    traffic.vehicles.push(car);
  }

  car.mesh.position.set(carX, carY, carZ);
  car.rotation = 0;
  car.speed = 20;

  player.enterVehicle(car);
  player.isInVehicle = true;
  player.vehicle = car;
  car.driver = player;
  car.isPlayer = true;

  player.wantedLevel = 3;
  player.wantedTimer = 9999;

  // Spawn 2 police cars behind
  for (let i = 0; i < 2; i++) {
    const px = carX + Math.sin(Math.PI) * (8 + i * 4);
    const pz = carZ + Math.cos(Math.PI) * (8 + i * 4);
    const policeCar = new PoliceVehicle(world, 'car', px, pz, 0);
    policeCar.aiState = 'pursue';
    policeCar.target = player;
    policeCar.targetPosition = player.position.clone();
    police.policeCars.push(policeCar);
  }
}

function updateShotCamera(delta) {
  if (!player.vehicle) return;

  const vehicle = player.vehicle.mesh;

  switch (shotMode) {
    case 'title':
      // Slow orbit of harbor
      const t = performance.now() * 0.0001;
      camera.position.x = Math.sin(t) * 300;
      camera.position.z = Math.cos(t) * 300;
      camera.position.y = 100 + Math.sin(t * 0.7) * 20;
      camera.lookAt(0, 0, 0);
      break;
    case 'drive':
      // 8m behind, 3m above looking forward
      const backOffset = new THREE.Vector3(0, 3, 8);
      backOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), vehicle.rotation.y);
      camera.position.lerp(vehicle.position.clone().add(backOffset), 0.1);
      camera.lookAt(vehicle.position.x + Math.sin(vehicle.rotation.y) * 20, vehicle.position.y + 1, vehicle.position.z + Math.cos(vehicle.rotation.y) * 20);
      break;
    case 'boat':
      // 10m behind, 4m above
      const boatBackOffset = new THREE.Vector3(0, 4, 10);
      boatBackOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), vehicle.rotation.y);
      camera.position.lerp(vehicle.position.clone().add(boatBackOffset), 0.1);
      camera.lookAt(vehicle.position.x + Math.sin(vehicle.rotation.y) * 30, vehicle.position.y + 2, vehicle.position.z + Math.cos(vehicle.rotation.y) * 30);
      break;
    case 'wanted':
      // Behind two police cars
      if (police.policeCars.length >= 2) {
        const p1 = police.policeCars[0].mesh;
        const p2 = police.policeCars[1].mesh;
        const midX = (p1.position.x + p2.position.x) / 2;
        const midZ = (p1.position.z + p2.position.z) / 2;
        const backOffset = new THREE.Vector3(0, 3, 12);
        backOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), p1.rotation.y);
        camera.position.lerp(new THREE.Vector3(midX, p1.position.y + 3, midZ).add(backOffset), 0.1);
        camera.lookAt(vehicle.position.x, vehicle.position.y + 1, vehicle.position.z);
      }
      break;
  }
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

    // Quick save/load
    if (e.code === 'F5' && gameState === STATE.PLAYING) {
      e.preventDefault();
      save.quickSave();
    }
    if (e.code === 'F9' && gameState === STATE.PLAYING) {
      e.preventDefault();
      save.quickLoad();
    }
  });

  window.addEventListener('keyup', (e) => {
    input.keys[e.code] = false;
  });

  // Mouse
  canvas.addEventListener('mousedown', (e) => {
    input.isMouseDown = true;
    if (gameState === STATE.PLAYING && !input.pointerLocked) {
      canvas.requestPointerLock();
    }
  });

  canvas.addEventListener('mouseup', () => {
    input.isMouseDown = false;
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
  if (!continueSave) {
    currentSeed = getSeedFromURL();
    prng.seed = currentSeed;
    prng.state = currentSeed;
  }

  titleScreen.classList.add('hidden');

  if (!continueSave) {
    // Dispose old
    if (world) world.dispose();
    if (traffic) traffic.dispose();
    if (pedestrians) pedestrians.dispose();
    if (police) police.dispose();
    if (combat) combat.dispose();
    if (missions) missions.dispose();
    if (hud) hud.dispose();

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

    police = createPoliceSystem(world);
    police.init();
    world.policeSystem = police;

    combat = createCombatSystem(world, player, input);
    player.combatSystem = combat;
    world.combatSystem = combat;

    missions = createMissionSystem(world, player, traffic, police);
    world.missionSystem = missions;

    audio.setPlayer(player, null, world);

    hud = createHUDSystem(world, player, traffic, missions, input);
    hud.setupPauseMenu(resumeGame, () => save.save('manual'), () => save.load('manual'), quitToTitle, cycleQuality, cycleVolume);

    save = createSaveSystem(player, world, missions, combat, audio, hud);
  } else {
    // Load save
    const slot = save.getLatestSaveSlot();
    save.load(slot);
  }

  gameState = STATE.PLAYING;
  clock.start();
  lastTime = performance.now();

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

  updateContinueButton();
}

function updateContinueButton() {
  btnContinue.disabled = !save.hasSaveGame();
}

function cycleQuality() {
  const qualities = ['low', 'medium', 'high'];
  const idx = qualities.indexOf(graphicsQuality);
  graphicsQuality = qualities[(idx + 1) % qualities.length];
  btnQuality.textContent = `Quality: ${graphicsQuality.charAt(0).toUpperCase() + graphicsQuality.slice(1)}`;

  // Apply quality (requires renderer recreation for some settings)
  const q = qualitySettings[graphicsQuality];
  renderer.setPixelRatio(q.pixelRatio);
  renderer.shadowMap.enabled = q.shadows;

  save.saveSettings({ ...save.getSettings(), graphicsQuality });
}

function cycleVolume() {
  const volumes = [0, 0.25, 0.5, 0.75, 1.0];
  const idx = volumes.indexOf(audio.masterVolume);
  const newVol = volumes[(idx + 1) % volumes.length];
  audio.setMasterVolume(newVol);
  btnVolume.textContent = `Volume: ${Math.round(newVol * 100)}%`;

  save.saveSettings({ ...save.getSettings(), masterVolume: newVol });
}

function animate() {
  requestAnimationFrame(animate);

  const now = performance.now();
  const delta = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;

  // Update previous keys
  Object.keys(input.keys).forEach(key => {
    input.prevKeys[key] = input.keys[key];
  });
  input.mouseDelta.set(0, 0);

  switch (gameState) {
    case STATE.PLAYING:
      updateGame(delta);
      break;
    case STATE.PAUSED:
      break;
    case STATE.TITLE:
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

  // Update police
  police.update(delta, player);

  // Update combat
  combat.update(delta);

  // Update missions
  missions.update(delta, input);

  // Check for mission completion
  if (missions.activeMission && missions.missionProgress[missions.activeMission.id]?.state === 'completed') {
    save.onMissionComplete();
  }

  // Update HUD
  hud.update(delta);

  // Update audio
  audio.update(delta);

  // Update save system (autosave)
  save.update(delta);

  // Crime hooks
  checkCrimes();

  // Check vehicle enter
  if (input.keys.KeyE && !input.prevKeys.KeyE && !player.isInVehicle) {
    player.tryEnterVehicle();
  }

  // Update audio vehicle reference
  if (player.vehicle !== audio.playerVehicle) {
    audio.setPlayer(player, player.vehicle, world);
  }
}

function checkCrimes() {
  // Steal car
  if (input.keys.KeyE && !input.prevKeys.KeyE && !player.isInVehicle) {
    const nearby = traffic.getNearbyVehicles(player.position, 3);
    nearby.forEach(v => {
      if (v.type === 'car' && !v.driver && !v.mesh.userData.isMissionVehicle && !v.mesh.userData.isPolice) {
        police.reportCrime('steal_car', player.position, player);
      }
    });
  }

  // Hit pedestrian (checked in combat)
  // Fire gun (checked in combat)
}

function updateTitleScreen(delta) {
  // Slowly rotate camera around center for title screen
  const t = performance.now() * 0.0001;
  camera.position.x = Math.sin(t) * 300;
  camera.position.z = Math.cos(t) * 300;
  camera.position.y = 100 + Math.sin(t * 0.7) * 20;
  camera.lookAt(0, 0, 0);
}

function render() {
  renderer.render(scene, camera);
}

// Need ISLAND_RADIUS from world.js
const ISLAND_RADIUS = 350;

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
  get police() { return police; },
  get combat() { return combat; },
  get missions() { return missions; },
  get hud() { return hud; },
  get audio() { return audio; },
  get save() { return save; },
  setSeed: (seed) => {
    currentSeed = seed;
    prng.seed = seed;
    prng.state = seed;
  },
};