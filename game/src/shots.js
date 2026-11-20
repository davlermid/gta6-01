// MONSOON ISLES - Shot Mode System
// Automated screenshot capture for documentation/testing
// CRITICAL RULES:
// - NO unbounded loops (bound every loop to max 50 attempts)
// - Stage at FIXED coordinates with direct placement, staging under 1 second
// - renderer.setPixelRatio(1), renderer.shadowMap.enabled=false
// - No pointer lock, no audio, continuous render
// - Override camera every frame
// - window.__ready=true after 3 frames
// - window.__shotStats={frames}
// - window.__samplePixels() returns {nonBlackCount,totalSamples,nonBlackPercent,averageBrightness}

import * as THREE from 'three';
import { createWorld, WORLD_SIZE, WATER_LEVEL, ISLAND_CENTERS, ISLAND_RADIUS } from './world.js';
import { Player } from './player.js';
import { TrafficSystem, Vehicle, Boat } from './vehicles.js';
import { createPoliceSystem, PoliceVehicle } from './police.js';

let renderer, scene, camera, world, player, traffic, police;
let shotFrames = 0;
let shotMode = null;

const urlParams = new URLSearchParams(window.location.search);
shotMode = urlParams.get('shot');

function initShotsInternal() {
  if (!shotMode) return;

  // Renderer: pixelRatio=1, no shadows
  renderer = new THREE.WebGLRenderer({
    canvas: document.getElementById('canvas'),
    antialias: false,
    alpha: false,
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(1);
  renderer.shadowMap.enabled = false;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 5000);

  // Create world with fixed seed for consistency
  world = createWorld(scene, 12345);

  // Dummy input for player
  const dummyInput = { keys: {}, prevKeys: {}, mouseDelta: new THREE.Vector2(), pointerLocked: false, isMouseDown: false };
  player = new Player(world, camera, dummyInput);
  world.player = player;

  traffic = new TrafficSystem(world);
  traffic.init();
  world.vehicles = traffic.vehicles;
  world.boats = traffic.boats;

  police = createPoliceSystem(world);
  police.init();
  world.policeSystem = police;

  // Stage the scene based on shot mode
  stageShotScene();

  // Shot mode render loop
  function shotAnimate() {
    requestAnimationFrame(shotAnimate);

    const delta = 1/60;

    // Update world (day/night, water, etc)
    world.update(delta, camera);

    // Update traffic
    traffic.update(delta, player.position);

    // Update police
    police.update(delta, player);

    // Override camera every frame for shot
    updateShotCamera(delta);

    renderer.render(scene, camera);

    shotFrames++;
    window.__shotStats = { frames: shotFrames };

    if (shotFrames === 3) {
      window.__ready = true;
    }
  }

  // Pixel sampling function
  window.__samplePixels = function() {
    const gl = renderer.getContext();
    const width = renderer.domElement.width;
    const height = renderer.domElement.height;
    const pixels = new Uint8Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

    let nonBlackCount = 0;
    let totalBrightness = 0;
    const totalSamples = width * height;

    for (let i = 0; i < pixels.length; i += 4) {
      const r = pixels[i], g = pixels[i+1], b = pixels[i+2];
      const brightness = (r + g + b) / 3;
      totalBrightness += brightness;
      if (brightness > 10) nonBlackCount++;
    }

    return {
      nonBlackCount,
      totalSamples,
      nonBlackPercent: (nonBlackCount / totalSamples * 100).toFixed(2),
      averageBrightness: (totalBrightness / totalSamples).toFixed(2),
    };
  };

  shotAnimate();
}

function stageShotScene() {
  // All staging at FIXED coordinates, direct placement, under 1 second
  // Bound any loops to max 50 attempts

  switch (shotMode) {
    case 'title':
      // Title screen over slow orbit of harbor daylight
      world.timeOfDay = 0.3; // Late morning
      world.setWeather('clear');
      world.rainIntensity = 0;
      world.targetRainIntensity = 0;
      break;

    case 'drive':
      // Player IN sports car on main bridge deck golden hour ~17:30
      // Camera 8m behind 3m above looking forward, traffic nearby
      world.timeOfDay = 0.65; // ~17:30
      world.setWeather('clear');
      placePlayerInSportsCarOnBridge();
      break;

    case 'boat':
      // Player IN boat open water sunset ~18:15
      // Camera 10m behind 4m above, lighthouse island ahead
      world.timeOfDay = 0.68; // ~18:15
      world.setWeather('clear');
      placePlayerInBoatAtSea();
      break;

    case 'wanted':
      // Night ~22:00 rain, player in car on street
      // Camera behind two police cars flashing light bars 6-10m behind, wanted 3
      world.timeOfDay = 0.85; // ~22:00
      world.setWeather('rain');
      world.rainIntensity = 1;
      world.targetRainIntensity = 1;
      placePlayerInCarWithPolice();
      break;
  }
}

function placePlayerInSportsCarOnBridge() {
  // FIXED coordinates: Bridge 0-1 midpoint
  const bridgeX = (ISLAND_CENTERS[0].x + ISLAND_RADIUS * 0.88 + ISLAND_CENTERS[1].x - ISLAND_RADIUS * 0.88) / 2;
  const bridgeZ = 0;
  const bridgeY = 4.35; // Bridge deck height

  // Direct placement - find or create sports car at fixed position
  let sportsCar = null;
  // Bounded search: max 50 attempts
  for (let i = 0; i < Math.min(50, traffic.vehicles.length); i++) {
    if (traffic.vehicles[i].type === 'SPORTS') {
      sportsCar = traffic.vehicles[i];
      break;
    }
  }
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
  // FIXED coordinates: Open water south of west island, lighthouse north
  const boatX = -500;
  const boatZ = -200;
  const boatY = WATER_LEVEL + 0.5;

  let boat = null;
  for (let i = 0; i < Math.min(50, traffic.boats.length); i++) {
    if (traffic.boats[i].type === 'SPEEDBOAT') {
      boat = traffic.boats[i];
      break;
    }
  }
  if (!boat) {
    boat = new Boat(world, 'SPEEDBOAT', boatX, boatZ, -Math.PI/2);
    boat.isAI = false;
    traffic.boats.push(boat);
  }

  boat.mesh.position.set(boatX, boatY, boatZ);
  boat.rotation = -Math.PI/2;
  boat.speed = 15;

  player.enterVehicle(boat);
  player.isInVehicle = true;
  player.vehicle = boat;
  boat.driver = player;
  boat.isPlayer = true;
}

function placePlayerInCarWithPolice() {
  // FIXED coordinates: West island street
  const carX = -500 + 200;
  const carZ = 50;
  const carY = world.getGroundHeight(carX, carZ) + 0.35;

  let car = null;
  for (let i = 0; i < Math.min(50, traffic.vehicles.length); i++) {
    if (traffic.vehicles[i].type === 'SEDAN') {
      car = traffic.vehicles[i];
      break;
    }
  }
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

  // Spawn 2 police cars behind at fixed offsets
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
      camera.lookAt(
        vehicle.position.x + Math.sin(vehicle.rotation.y) * 20,
        vehicle.position.y + 1,
        vehicle.position.z + Math.cos(vehicle.rotation.y) * 20
      );
      break;

    case 'boat':
      // 10m behind, 4m above
      const boatBackOffset = new THREE.Vector3(0, 4, 10);
      boatBackOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), vehicle.rotation.y);
      camera.position.lerp(vehicle.position.clone().add(boatBackOffset), 0.1);
      camera.lookAt(
        vehicle.position.x + Math.sin(vehicle.rotation.y) * 30,
        vehicle.position.y + 2,
        vehicle.position.z + Math.cos(vehicle.rotation.y) * 30
      );
      break;

    case 'wanted':
      // Behind two police cars (6-10m behind)
      if (police.policeCars.length >= 2) {
        const p1 = police.policeCars[0].mesh;
        const p2 = police.policeCars[1].mesh;
        const midX = (p1.position.x + p2.position.x) / 2;
        const midZ = (p1.position.z + p2.position.z) / 2;
        const backOffset = new THREE.Vector3(0, 3, 12);
        backOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), p1.rotation.y);
        camera.position.lerp(
          new THREE.Vector3(midX, p1.position.y + 3, midZ).add(backOffset),
          0.1
        );
        camera.lookAt(vehicle.position.x, vehicle.position.y + 1, vehicle.position.z);
      }
      break;
  }
}

// Top-level exports (required by ES modules)
export function initShots() { initShotsInternal(); }
export function getShotStats() { return window.__shotStats || { frames: 0 }; }

// Initialize on load
if (typeof window !== 'undefined' && shotMode) {
  initShotsInternal();
}