// MONSOON ISLES - World System
// Archipelago: 3 islands, water, roads, buildings, harbor, lighthouse, day/night, rain

import * as THREE from 'three';
import { prng, createNoise2D, PRNG } from './prng.js';

export const WORLD_SIZE = 2000;
export const ISLAND_RADIUS = 350;
export const WATER_LEVEL = 0;
export const ROAD_WIDTH = 12;

export const ISLAND_CENTERS = [
  new THREE.Vector2(-500, 0),   // West island
  new THREE.Vector2(500, 0),    // East island
  new THREE.Vector2(0, -500),   // South island
];

const BRIDGE_WIDTH = 16;
const BUILDING_COUNT = 180;

export class World {
  constructor(scene, seed = 1) {
    this.scene = scene;
    this.prng = new PRNG(seed);
    this.noise = createNoise2D(seed + 1000);
    this.buildings = [];
    this.roads = [];
    this.roadGraph = new Map(); // For pathfinding
    this.streetlights = [];
    this.palmTrees = [];
    this.containers = [];
    this.cranes = [];
    this.lighthouse = null;
    this.timeOfDay = 0.25; // 0-1, 0.25 = noon
    this.daySpeed = 1 / (20 * 60); // 20 min day cycle
    this.weather = 'clear'; // clear, rain, storm
    this.rainIntensity = 0;
    this.targetRainIntensity = 0;
    this.rainParticles = null;
    this.waterMesh = null;
    this.waterMaterial = null;
    this.sunLight = null;
    this.ambientLight = null;
    this.hemiLight = null;
    this.moonLight = null;
    this.skyColor = new THREE.Color(0x87ceeb);
    this.fogColor = new THREE.Color(0x87ceeb);
    this.waveTime = 0;
    
    this.build();
  }

  build() {
    this.createWater();
    this.createIslands();
    this.createRoads();
    this.createBridges();
    this.createBuildings();
    this.createHarbor();
    this.createLighthouse();
    this.createPalmTrees();
    this.createStreetlights();
    this.createRainSystem();
    this.createLighting();
    this.createSky();
  }

  createWater() {
    const geometry = new THREE.PlaneGeometry(WORLD_SIZE * 2, WORLD_SIZE * 2, 128, 128);
    geometry.rotateX(-Math.PI / 2);
    
    this.waterMaterial = new THREE.MeshStandardMaterial({
      color: 0x001a33,
      metalness: 0.9,
      roughness: 0.1,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
    });
    
    this.waterMesh = new THREE.Mesh(geometry, this.waterMaterial);
    this.waterMesh.position.y = WATER_LEVEL;
    this.waterMesh.receiveShadow = true;
    this.scene.add(this.waterMesh);
    
    // Water caustics/foam plane
    const foamGeometry = new THREE.PlaneGeometry(WORLD_SIZE * 2, WORLD_SIZE * 2, 1, 1);
    foamGeometry.rotateX(-Math.PI / 2);
    const foamMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.05,
      depthWrite: false,
    });
    const foamMesh = new THREE.Mesh(foamGeometry, foamMaterial);
    foamMesh.position.y = WATER_LEVEL + 0.1;
    this.scene.add(foamMesh);
    this.foamMesh = foamMesh;
  }

  createIslands() {
    const islandMaterial = new THREE.MeshStandardMaterial({
      color: 0x2d5a27,
      roughness: 0.9,
      metalness: 0,
    });
    
    const sandMaterial = new THREE.MeshStandardMaterial({
      color: 0xe8d5b7,
      roughness: 0.95,
      metalness: 0,
    });
    
    const rockMaterial = new THREE.MeshStandardMaterial({
      color: 0x5a5a5a,
      roughness: 1,
      metalness: 0,
    });

    ISLAND_CENTERS.forEach((center, idx) => {
      const radius = ISLAND_RADIUS + this.prng.range(-30, 30);
      const segments = 64;
      const geometry = new THREE.CircleGeometry(radius, segments);
      geometry.rotateX(-Math.PI / 2);
      
      // Modify vertices for terrain variation
      const positions = geometry.attributes.position;
      const noise2d = createNoise2D(this.prng.seed + idx * 100);
      
      for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i);
        const z = positions.getY(i);
        const dist = Math.sqrt(x * x + z * z);
        
        // Beach area
        let height = 0;
        if (dist > radius * 0.85) {
          // Beach slope
          height = Math.max(0, (radius - dist) * 0.3);
        } else {
          // Inland terrain with noise
          const n = noise2d(x * 0.01, z * 0.01) * 15;
          const hill = Math.max(0, 1 - dist / (radius * 0.85)) * 20;
          height = n + hill;
        }
        
        positions.setY(i, height);
      }
      geometry.computeVertexNormals();
      
      // Create multi-material mesh using groups
      const mesh = new THREE.Mesh(geometry, [sandMaterial, islandMaterial, rockMaterial]);
      mesh.position.set(center.x, 0, center.y);
      mesh.receiveShadow = true;
      mesh.castShadow = true;
      this.scene.add(mesh);
      
      // Store island data for ground queries
      this[`island${idx}`] = { center, radius, mesh, noise2d };
    });
  }

  createRoads() {
    const roadMaterial = new THREE.MeshStandardMaterial({
      color: 0x333333,
      roughness: 0.9,
      metalness: 0,
    });
    
    const lineMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
    });

    ISLAND_CENTERS.forEach((center, idx) => {
      const radius = ISLAND_RADIUS + this.prng.range(-30, 30);
      const islandRoads = [];
      
      // Ring road around island
      const ringRadius = radius * 0.88;
      const ringSegments = 64;
      const ringGeometry = new THREE.RingGeometry(ringRadius - ROAD_WIDTH/2, ringRadius + ROAD_WIDTH/2, ringSegments);
      ringGeometry.rotateX(-Math.PI / 2);
      const ringMesh = new THREE.Mesh(ringGeometry, roadMaterial);
      ringMesh.position.set(center.x, 0.15, center.y);
      ringMesh.receiveShadow = true;
      this.scene.add(ringMesh);
      islandRoads.push({ type: 'ring', center, radius: ringRadius, mesh: ringMesh });
      
      // Radial roads (4 per island)
      for (let r = 0; r < 4; r++) {
        const angle = (r / 4) * Math.PI * 2;
        const length = ringRadius;
        const radGeo = new THREE.PlaneGeometry(ROAD_WIDTH, length);
        radGeo.rotateX(-Math.PI / 2);
        const radMesh = new THREE.Mesh(radGeo, roadMaterial);
        radMesh.position.set(center.x, 0.15, center.y);
        radMesh.rotation.y = angle;
        radMesh.translateZ(-length / 2);
        radMesh.receiveShadow = true;
        this.scene.add(radMesh);
        islandRoads.push({ type: 'radial', center, angle, length, mesh: radMesh });
      }
      
      // Center cross roads
      const crossGeo = new THREE.PlaneGeometry(ROAD_WIDTH * 2, ringRadius * 2);
      crossGeo.rotateX(-Math.PI / 2);
      const crossMesh1 = new THREE.Mesh(crossGeo, roadMaterial);
      crossMesh1.position.set(center.x, 0.15, center.y);
      crossMesh1.receiveShadow = true;
      this.scene.add(crossMesh1);
      
      const crossMesh2 = new THREE.Mesh(crossGeo, roadMaterial);
      crossMesh2.position.set(center.x, 0.15, center.y);
      crossMesh2.rotation.y = Math.PI / 2;
      crossMesh2.receiveShadow = true;
      this.scene.add(crossMesh2);
      
      islandRoads.push({ type: 'cross', center, mesh: crossMesh1 });
      islandRoads.push({ type: 'cross', center, mesh: crossMesh2 });
      
      // Road lines (dashed)
      this.addRoadLines(center, ringRadius);
      
      this.roads.push(...islandRoads);
    });
    
    // Build road graph for traffic AI
    this.buildRoadGraph();
  }

  addRoadLines(center, ringRadius) {
    const lineGeo = new THREE.PlaneGeometry(0.3, 4);
    lineGeo.rotateX(-Math.PI / 2);
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, side: THREE.DoubleSide });
    
    // Ring road dashes
    for (let i = 0; i < 64; i += 2) {
      const angle = (i / 64) * Math.PI * 2;
      const line = new THREE.Mesh(lineGeo, lineMat);
      line.position.set(
        center.x + Math.sin(angle) * ringRadius,
        0.16,
        center.y + Math.cos(angle) * ringRadius
      );
      line.rotation.y = angle;
      this.scene.add(line);
    }
  }

  createBridges() {
    const bridgeMaterial = new THREE.MeshStandardMaterial({
      color: 0x665544,
      roughness: 0.8,
      metalness: 0.1,
    });
    
    const railMaterial = new THREE.MeshStandardMaterial({
      color: 0x443322,
      roughness: 0.9,
      metalness: 0.2,
    });

    // Bridge West-East (island 0 to 1)
    const bridge1 = this.buildBridge(
      ISLAND_CENTERS[0].x + ISLAND_RADIUS * 0.88, 0,
      ISLAND_CENTERS[1].x - ISLAND_RADIUS * 0.88, 0,
      bridgeMaterial, railMaterial
    );
    
    // Bridge West-South (island 0 to 2)
    const bridge2 = this.buildBridge(
      ISLAND_CENTERS[0].x, ISLAND_CENTERS[0].y - ISLAND_RADIUS * 0.88,
      ISLAND_CENTERS[2].x, ISLAND_CENTERS[2].y + ISLAND_RADIUS * 0.88,
      bridgeMaterial, railMaterial
    );
    
    // Bridge East-South (island 1 to 2)
    const bridge3 = this.buildBridge(
      ISLAND_CENTERS[1].x, ISLAND_CENTERS[1].y - ISLAND_RADIUS * 0.88,
      ISLAND_CENTERS[2].x, ISLAND_CENTERS[2].y + ISLAND_RADIUS * 0.88,
      bridgeMaterial, railMaterial
    );
  }

  buildBridge(x1, z1, x2, z2, deckMat, railMat) {
    const dx = x2 - x1;
    const dz = z2 - z1;
    const length = Math.sqrt(dx * dx + dz * dz);
    const angle = Math.atan2(dx, dz);
    
    const deckGeo = new THREE.BoxGeometry(BRIDGE_WIDTH, 2, length);
    const deck = new THREE.Mesh(deckGeo, deckMat);
    deck.position.set((x1 + x2) / 2, 4, (z1 + z2) / 2);
    deck.rotation.y = angle;
    deck.castShadow = true;
    deck.receiveShadow = true;
    this.scene.add(deck);
    
    // Railings
    const railGeo = new THREE.BoxGeometry(0.5, 1.5, length);
    const rail1 = new THREE.Mesh(railGeo, railMat);
    rail1.position.set((x1 + x2) / 2 + Math.sin(angle) * (BRIDGE_WIDTH/2 + 0.25), 4.75, (z1 + z2) / 2 + Math.cos(angle) * (BRIDGE_WIDTH/2 + 0.25));
    rail1.rotation.y = angle;
    rail1.castShadow = true;
    this.scene.add(rail1);
    
    const rail2 = new THREE.Mesh(railGeo, railMat);
    rail2.position.set((x1 + x2) / 2 - Math.sin(angle) * (BRIDGE_WIDTH/2 + 0.25), 4.75, (z1 + z2) / 2 - Math.cos(angle) * (BRIDGE_WIDTH/2 + 0.25));
    rail2.rotation.y = angle;
    rail2.castShadow = true;
    this.scene.add(rail2);
    
    // Support pillars
    const pillarCount = Math.floor(length / 60);
    const pillarGeo = new THREE.CylinderGeometry(1.5, 2, 8, 8);
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x554433, roughness: 0.9 });
    for (let i = 1; i < pillarCount; i++) {
      const t = i / pillarCount;
      const px = x1 + dx * t;
      const pz = z1 + dz * t;
      const pillar = new THREE.Mesh(pillarGeo, pillarMat);
      pillar.position.set(px, 0, pz);
      pillar.castShadow = true;
      pillar.receiveShadow = true;
      this.scene.add(pillar);
    }
    
    return { start: new THREE.Vector2(x1, z1), end: new THREE.Vector2(x2, z2), length, angle };
  }

  createBuildings() {
    const buildingMaterials = [
      new THREE.MeshStandardMaterial({ color: 0x8b7355, roughness: 0.8 }),
      new THREE.MeshStandardMaterial({ color: 0x6b5b4a, roughness: 0.85 }),
      new THREE.MeshStandardMaterial({ color: 0x9a8472, roughness: 0.75 }),
      new THREE.MeshStandardMaterial({ color: 0x7d6d5a, roughness: 0.8 }),
      new THREE.MeshStandardMaterial({ color: 0xa6907a, roughness: 0.7 }),
      new THREE.MeshStandardMaterial({ color: 0x5c5448, roughness: 0.9 }),
    ];
    
    const windowMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffcc,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
    });
    
    const emissiveWindowMaterial = new THREE.MeshBasicMaterial({
      color: 0xffdd88,
      transparent: true,
      opacity: 1,
      side: THREE.DoubleSide,
    });
    
    this.windowMaterials = { day: windowMaterial, night: emissiveWindowMaterial };
    this.isNight = false;

    ISLAND_CENTERS.forEach((center, idx) => {
      const radius = ISLAND_RADIUS + this.prng.range(-30, 30);
      const buildingCount = Math.floor(BUILDING_COUNT / 3);
      
      for (let i = 0; i < buildingCount; i++) {
        // Random position on island (avoid roads)
        let x, z, attempts = 0;
        do {
          const angle = this.prng.random() * Math.PI * 2;
          const dist = this.prng.range(radius * 0.2, radius * 0.75);
          x = center.x + Math.cos(angle) * dist;
          z = center.y + Math.sin(angle) * dist;
          attempts++;
        } while (this.isOnRoad(x, z) && attempts < 20);
        
        if (attempts >= 20) continue;
        
        const width = this.prng.range(8, 20);
        const depth = this.prng.range(8, 20);
        const height = this.prng.range(6, 35);
        const floors = Math.floor(height / 3.5);
        
        const building = new THREE.Group();
        building.userData = { x, z, width, depth, height, floors, isBuilding: true };
        
        const mat = this.prng.choice(buildingMaterials);
        
        // Main building box
        const geo = new THREE.BoxGeometry(width, height, depth);
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.y = height / 2;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        building.add(mesh);
        
        // Windows
        this.addWindows(building, width, depth, height, floors);
        
        // Roof variation
        if (this.prng.chance(0.3)) {
          const roofGeo = new THREE.ConeGeometry(Math.max(width, depth) * 0.7, 4, 4);
          const roofMat = new THREE.MeshStandardMaterial({ color: 0x8b0000, roughness: 0.7 });
          const roof = new THREE.Mesh(roofGeo, roofMat);
          roof.position.y = height + 2;
          roof.rotation.y = Math.PI / 4;
          roof.castShadow = true;
          building.add(roof);
        }
        
        building.position.set(x, 0, z);
        building.rotation.y = this.prng.random() * Math.PI * 2;
        this.scene.add(building);
        this.buildings.push(building);
      }
    });
  }

  addWindows(building, width, depth, height, floors) {
    const windowSize = 1.2;
    const spacing = 3;
    const windowGeo = new THREE.PlaneGeometry(windowSize, windowSize);
    
    for (let f = 0; f < floors; f++) {
      const y = f * 3.5 + 1.5;
      
      // Four sides
      const sides = [
        { x: 0, z: depth/2 + 0.01, rot: 0 },      // front
        { x: 0, z: -depth/2 - 0.01, rot: Math.PI }, // back
        { x: width/2 + 0.01, z: 0, rot: -Math.PI/2 }, // right
        { x: -width/2 - 0.01, z: 0, rot: Math.PI/2 }, // left
      ];
      
      sides.forEach(side => {
        const countX = Math.floor(width / spacing);
        const countZ = Math.floor(depth / spacing);
        const count = side.rot === 0 || side.rot === Math.PI ? countX : countZ;
        
        for (let w = 0; w < count; w++) {
          const offset = (w - (count - 1) / 2) * spacing;
          if (this.prng.chance(0.7)) {
            const winMesh = new THREE.Mesh(windowGeo, this.windowMaterials.day);
            winMesh.position.set(side.x + (side.rot === 0 || side.rot === Math.PI ? offset : 0), y, side.z + (side.rot !== 0 && side.rot !== Math.PI ? offset : 0));
            winMesh.rotation.y = side.rot;
            winMesh.userData.isWindow = true;
            building.add(winMesh);
            building.userData.windows = building.userData.windows || [];
            building.userData.windows.push(winMesh);
          }
        }
      });
    }
  }

  createHarbor() {
    // Harbor on south island (index 2)
    const harborCenter = ISLAND_CENTERS[2].clone();
    harborCenter.y += ISLAND_RADIUS * 0.6;
    
    const containerMat = new THREE.MeshStandardMaterial({ 
      color: 0x444444, 
      roughness: 0.7,
      metalness: 0.3 
    });
    
    const containerColors = [0xcc2222, 0x2244cc, 0xccaa22, 0x22cc44, 0xcc44cc, 0x888888, 0xcc6622];
    
    // Container stacks
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 8; col++) {
        const stackHeight = this.prng.int(1, 4);
        for (let h = 0; h < stackHeight; h++) {
          const w = 6, d = 12, ht = 2.6;
          const geo = new THREE.BoxGeometry(w, ht, d);
          const mat = containerMat.clone();
          mat.color.setHex(this.prng.choice(containerColors));
          const container = new THREE.Mesh(geo, mat);
          container.position.set(
            harborCenter.x - 30 + col * 7,
            ht/2 + h * ht,
            harborCenter.y - 25 + row * 7
          );
          container.rotation.y = this.prng.chance(0.5) ? 0 : Math.PI/2;
          container.castShadow = true;
          container.receiveShadow = true;
          this.scene.add(container);
          this.containers.push(container);
        }
      }
    }
    
    // Cranes
    for (let i = 0; i < 3; i++) {
      const crane = this.buildCrane(
        harborCenter.x - 25 + i * 20,
        harborCenter.y - 35
      );
      this.cranes.push(crane);
    }
    
    // Warehouses
    for (let i = 0; i < 4; i++) {
      const wh = this.buildWarehouse(
        harborCenter.x - 40 + i * 25,
        harborCenter.y - 10
      );
      this.buildings.push(wh);
    }
  }

  buildCrane(x, z) {
    const crane = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0xf0c020, roughness: 0.6, metalness: 0.4 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x665522, roughness: 0.8 });
    
    // Base
    const baseGeo = new THREE.CylinderGeometry(3, 4, 6, 8);
    const base = new THREE.Mesh(baseGeo, darkMat);
    base.position.set(x, 3, z);
    base.castShadow = true;
    crane.add(base);
    
    // Tower
    const towerGeo = new THREE.BoxGeometry(2, 30, 2);
    const tower = new THREE.Mesh(towerGeo, mat);
    tower.position.set(x, 21, z);
    tower.castShadow = true;
    crane.add(tower);
    
    // Boom (horizontal arm)
    const boomGeo = new THREE.BoxGeometry(35, 1.5, 1.5);
    const boom = new THREE.Mesh(boomGeo, mat);
    boom.position.set(x + 17.5, 35, z);
    boom.castShadow = true;
    crane.add(boom);
    
    // Counter-weight arm
    const cwGeo = new THREE.BoxGeometry(12, 1.5, 1.5);
    const cw = new THREE.Mesh(cwGeo, mat);
    cw.position.set(x - 6, 35, z);
    cw.castShadow = true;
    crane.add(cw);
    
    // Counter-weight
    const weightGeo = new THREE.BoxGeometry(3, 3, 3);
    const weight = new THREE.Mesh(weightGeo, darkMat);
    weight.position.set(x - 12, 35, z);
    weight.castShadow = true;
    crane.add(weight);
    
    // Cable
    const cableGeo = new THREE.CylinderGeometry(0.08, 0.08, 30, 4);
    const cableMat = new THREE.MeshBasicMaterial({ color: 0x333333 });
    const cable = new THREE.Mesh(cableGeo, cableMat);
    cable.position.set(x + 30, 20, z);
    cable.castShadow = true;
    crane.add(cable);
    
    crane.position.set(0, 0, 0);
    this.scene.add(crane);
    return crane;
  }

  buildWarehouse(x, z) {
    const wh = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0x665544, roughness: 0.8 });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x8b0000, roughness: 0.7 });
    
    const w = 20, d = 40, h = 10;
    const geo = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = h/2;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    wh.add(mesh);
    
    // Roof
    const roofGeo = new THREE.BoxGeometry(w + 2, 1, d + 2);
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.y = h + 0.5;
    roof.castShadow = true;
    wh.add(roof);
    
    // Large doors
    const doorGeo = new THREE.PlaneGeometry(6, 8);
    const doorMat = new THREE.MeshStandardMaterial({ color: 0x443322, roughness: 0.9, side: THREE.DoubleSide });
    const door = new THREE.Mesh(doorGeo, doorMat);
    door.position.set(0, 4, d/2 + 0.1);
    wh.add(door);
    
    wh.position.set(x, 0, z);
    this.scene.add(wh);
    return wh;
  }

  createLighthouse() {
    // On north tip of west island
    const lx = ISLAND_CENTERS[0].x;
    const lz = ISLAND_CENTERS[0].y + ISLAND_RADIUS * 0.9;
    
    this.lighthouse = new THREE.Group();
    
    // Tower
    const towerMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
    const stripeMat = new THREE.MeshStandardMaterial({ color: 0xcc0000, roughness: 0.9 });
    
    for (let i = 0; i < 12; i++) {
      const h = 3;
      const r1 = 4 - i * 0.15;
      const r2 = 4 - (i + 1) * 0.15;
      const geo = new THREE.CylinderGeometry(r1, r2, h, 16);
      const mesh = new THREE.Mesh(geo, i % 2 === 0 ? towerMat : stripeMat);
      mesh.position.y = i * h + h/2;
      mesh.castShadow = true;
      this.lighthouse.add(mesh);
    }
    
    // Lantern room
    const lanternGeo = new THREE.CylinderGeometry(2.5, 2.5, 4, 16);
    const glassMat = new THREE.MeshStandardMaterial({ 
      color: 0xffffff, 
      roughness: 0.1, 
      metalness: 0.9,
      transparent: true,
      opacity: 0.3,
    });
    const lantern = new THREE.Mesh(lanternGeo, glassMat);
    lantern.position.y = 36 + 2;
    lantern.castShadow = true;
    this.lighthouse.add(lantern);
    
    // Roof
    const roofGeo = new THREE.ConeGeometry(3, 3, 16);
    const roofMat = new THREE.MeshStandardMaterial({ color: 0xcc0000, roughness: 0.7 });
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.y = 36 + 4 + 1.5;
    roof.castShadow = true;
    this.lighthouse.add(roof);
    
    // Light beam (will be animated)
    const beamGeo = new THREE.ConeGeometry(0.1, 500, 8, 1, true);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xffffee,
      transparent: true,
      opacity: 0.15,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.lighthouseBeam = new THREE.Mesh(beamGeo, beamMat);
    this.lighthouseBeam.position.y = 36 + 4;
    this.lighthouseBeam.rotation.x = Math.PI / 2;
    this.lighthouse.add(this.lighthouseBeam);
    
    // Point light at top
    this.lighthouseLight = new THREE.PointLight(0xffffee, 2, 600, 2);
    this.lighthouseLight.position.set(0, 36 + 4, 0);
    this.lighthouseLight.castShadow = true;
    this.lighthouse.add(this.lighthouseLight);
    
    this.lighthouse.position.set(lx, 0, lz);
    this.scene.add(this.lighthouse);
  }

  createPalmTrees() {
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8b6b4a, roughness: 0.9 });
    const leafMat = new THREE.MeshStandardMaterial({ 
      color: 0x2d5a27, 
      roughness: 0.8,
      side: THREE.DoubleSide,
      alphaTest: 0.5,
    });
    
    ISLAND_CENTERS.forEach((center, idx) => {
      const radius = ISLAND_RADIUS + this.prng.range(-30, 30);
      const treeCount = this.prng.int(30, 50);
      
      for (let i = 0; i < treeCount; i++) {
        const angle = this.prng.random() * Math.PI * 2;
        const dist = this.prng.range(radius * 0.88, radius * 1.1);
        const x = center.x + Math.cos(angle) * dist;
        const z = center.y + Math.sin(angle) * dist;
        
        // Only on sand/beach area
        const groundY = this.getGroundHeight(x, z);
        if (groundY < 1) continue;
        
        const tree = new THREE.Group();
        
        // Trunk (curved)
        const height = this.prng.range(8, 14);
        const segments = 8;
        const curve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(this.prng.range(-1, 1), height * 0.3, this.prng.range(-1, 1)),
          new THREE.Vector3(this.prng.range(-2, 2), height * 0.6, this.prng.range(-2, 2)),
          new THREE.Vector3(this.prng.range(-1, 1), height, this.prng.range(-1, 1)),
        ]);
        
        const trunkGeo = new THREE.TubeGeometry(curve, segments, 0.3, 8, false);
        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.castShadow = true;
        tree.add(trunk);
        
        // Fronds
        for (let f = 0; f < 6; f++) {
          const frondGeo = new THREE.PlaneGeometry(0.5, 4);
          const frond = new THREE.Mesh(frondGeo, leafMat);
          frond.position.y = height - f * 0.8;
          frond.rotation.y = (f / 6) * Math.PI * 2;
          frond.rotation.x = -Math.PI / 6;
          frond.castShadow = true;
          tree.add(frond);
        }
        
        tree.position.set(x, groundY, z);
        tree.rotation.y = this.prng.random() * Math.PI * 2;
        this.scene.add(tree);
        this.palmTrees.push(tree);
      }
    });
  }

  createStreetlights() {
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.7, metalness: 0.5 });
    const lightMat = new THREE.MeshBasicMaterial({ color: 0xffeecc, transparent: true, opacity: 1 });
    
    ISLAND_CENTERS.forEach(center => {
      const radius = ISLAND_RADIUS * 0.88;
      // Streetlights along ring road
      for (let i = 0; i < 32; i++) {
        const angle = (i / 32) * Math.PI * 2;
        const x = center.x + Math.sin(angle) * (radius + 3);
        const z = center.y + Math.cos(angle) * (radius + 3);
        
        const light = new THREE.Group();
        
        const poleGeo = new THREE.CylinderGeometry(0.15, 0.2, 8, 8);
        const pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.y = 4;
        pole.castShadow = true;
        light.add(pole);
        
        // Arm
        const armGeo = new THREE.CylinderGeometry(0.08, 0.08, 3, 4);
        const arm = new THREE.Mesh(armGeo, poleMat);
        arm.position.set(1.5, 7.5, 0);
        arm.rotation.z = -Math.PI / 2;
        light.add(arm);
        
        // Light fixture
        const fixtureGeo = new THREE.BoxGeometry(1, 0.3, 0.5);
        const fixture = new THREE.Mesh(fixtureGeo, lightMat);
        fixture.position.set(3, 7.5, 0);
        light.add(fixture);
        
        // Point light
        const pointLight = new THREE.PointLight(0xffeecc, 0, 20, 2);
        pointLight.position.set(3, 7.3, 0);
        light.add(pointLight);
        light.userData.pointLight = pointLight;
        light.userData.fixture = fixture;
        
        light.position.set(x, 0, z);
        light.rotation.y = angle;
        this.scene.add(light);
        this.streetlights.push(light);
      }
    });
  }

  createRainSystem() {
    const particleCount = 3000;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const velocities = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);
    
    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = this.prng.range(-WORLD_SIZE, WORLD_SIZE);
      positions[i * 3 + 1] = this.prng.range(10, 100);
      positions[i * 3 + 2] = this.prng.range(-WORLD_SIZE, WORLD_SIZE);
      velocities[i * 3] = 0;
      velocities[i * 3 + 1] = -this.prng.range(30, 50);
      velocities[i * 3 + 2] = this.prng.range(-5, 5); // wind drift
      sizes[i] = this.prng.range(0.05, 0.15);
    }
    
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    
    const material = new THREE.PointsMaterial({
      color: 0xaaccff,
      size: 0.1,
      transparent: true,
      opacity: 0.6,
      vertexColors: false,
      sizeAttenuation: true,
      depthWrite: false,
    });
    
    this.rainParticles = new THREE.Points(geometry, material);
    this.rainParticles.visible = false;
    this.scene.add(this.rainParticles);
    
    this.rainSplashGeometry = new THREE.BufferGeometry();
    const splashCount = 500;
    const splashPositions = new Float32Array(splashCount * 3);
    const splashLife = new Float32Array(splashCount);
    for (let i = 0; i < splashCount; i++) {
      splashPositions[i * 3] = 0;
      splashPositions[i * 3 + 1] = -100;
      splashPositions[i * 3 + 2] = 0;
      splashLife[i] = 0;
    }
    this.rainSplashGeometry.setAttribute('position', new THREE.BufferAttribute(splashPositions, 3));
    this.rainSplashGeometry.setAttribute('life', new THREE.BufferAttribute(splashLife, 1));
    
    const splashMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.2,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    });
    this.rainSplashes = new THREE.Points(this.rainSplashGeometry, splashMat);
    this.rainSplashes.visible = false;
    this.scene.add(this.rainSplashes);
  }

  createLighting() {
    // Sun
    this.sunLight = new THREE.DirectionalLight(0xffffee, 2.5);
    this.sunLight.position.set(100, 200, 50);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(2048, 2048);
    this.sunLight.shadow.camera.near = 1;
    this.sunLight.shadow.camera.far = 500;
    this.sunLight.shadow.camera.left = -250;
    this.sunLight.shadow.camera.right = 250;
    this.sunLight.shadow.camera.top = 250;
    this.sunLight.shadow.camera.bottom = -250;
    this.sunLight.shadow.bias = -0.0005;
    this.scene.add(this.sunLight);
    
    // Moon
    this.moonLight = new THREE.DirectionalLight(0x88aaff, 0);
    this.moonLight.position.set(-100, 200, -50);
    this.moonLight.castShadow = true;
    this.moonLight.shadow.mapSize.set(1024, 1024);
    this.moonLight.shadow.camera.near = 1;
    this.moonLight.shadow.camera.far = 500;
    this.moonLight.shadow.camera.left = -250;
    this.moonLight.shadow.camera.right = 250;
    this.moonLight.shadow.camera.top = 250;
    this.moonLight.shadow.camera.bottom = -250;
    this.scene.add(this.moonLight);
    
    // Ambient
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(this.ambientLight);
    
    // Hemisphere light for sky/ground bounce
    this.hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x2d5a27, 0.8);
    this.scene.add(this.hemiLight);
  }

  createSky() {
    // Sky dome
    const skyGeo = new THREE.SphereGeometry(WORLD_SIZE, 32, 16);
    skyGeo.scale(-1, 1, 1); // Inside out
    const skyMat = new THREE.MeshBasicMaterial({
      color: 0x87ceeb,
      fog: false,
    });
    this.skyMesh = new THREE.Mesh(skyGeo, skyMat);
    this.scene.add(this.skyMesh);
    
    // Sun disk
    const sunGeo = new THREE.SphereGeometry(50, 16, 16);
    const sunMat = new THREE.MeshBasicMaterial({
      color: 0xffee88,
      transparent: true,
      opacity: 1,
      depthWrite: false,
    });
    this.sunMesh = new THREE.Mesh(sunGeo, sunMat);
    this.scene.add(this.sunMesh);
    
    // Moon disk
    const moonGeo = new THREE.SphereGeometry(30, 16, 16);
    const moonMat = new THREE.MeshBasicMaterial({
      color: 0xeeeeff,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
    });
    this.moonMesh = new THREE.Mesh(moonGeo, moonMat);
    this.scene.add(this.moonMesh);
    
    // Stars
    const starGeo = new THREE.BufferGeometry();
    const starCount = 1000;
    const starPositions = new Float32Array(starCount * 3);
    const starSizes = new Float32Array(starCount);
    for (let i = 0; i < starCount; i++) {
      const theta = this.prng.random() * Math.PI * 2;
      const phi = Math.acos(2 * this.prng.random() - 1);
      const r = WORLD_SIZE * 0.9;
      starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPositions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      starPositions[i * 3 + 2] = r * Math.cos(phi);
      starSizes[i] = this.prng.range(0.5, 2);
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    starGeo.setAttribute('size', new THREE.BufferAttribute(starSizes, 1));
    
    const starMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 1,
      transparent: true,
      opacity: 0,
      sizeAttenuation: false,
      depthWrite: false,
    });
    this.starMesh = new THREE.Points(starGeo, starMat);
    this.scene.add(this.starMesh);
  }

  buildRoadGraph() {
    // Build navigation graph for traffic AI
    // Nodes: intersections, bridge ends, harbor entrance
    // Edges: road segments
    
    this.roadNodes = [];
    this.roadEdges = [];
    
    // Add island ring road nodes (8 per island)
    ISLAND_CENTERS.forEach((center, idx) => {
      const radius = ISLAND_RADIUS * 0.88;
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        const node = {
          id: `island${idx}_ring${i}`,
          pos: new THREE.Vector2(
            center.x + Math.sin(angle) * radius,
            center.y + Math.cos(angle) * radius
          ),
          type: 'ring',
          island: idx,
        };
        this.roadNodes.push(node);
      }
    });
    
    // Add bridge nodes
    // Bridge 0-1 (west-east)
    this.roadNodes.push({ id: 'bridge_01_w', pos: new THREE.Vector2(ISLAND_CENTERS[0].x + ISLAND_RADIUS * 0.88, 0), type: 'bridge' });
    this.roadNodes.push({ id: 'bridge_01_e', pos: new THREE.Vector2(ISLAND_CENTERS[1].x - ISLAND_RADIUS * 0.88, 0), type: 'bridge' });
    
    // Bridge 0-2 (west-south)
    this.roadNodes.push({ id: 'bridge_02_n', pos: new THREE.Vector2(ISLAND_CENTERS[0].x, ISLAND_CENTERS[0].y - ISLAND_RADIUS * 0.88), type: 'bridge' });
    this.roadNodes.push({ id: 'bridge_02_s', pos: new THREE.Vector2(ISLAND_CENTERS[2].x, ISLAND_CENTERS[2].y + ISLAND_RADIUS * 0.88), type: 'bridge' });
    
    // Bridge 1-2 (east-south)
    this.roadNodes.push({ id: 'bridge_12_n', pos: new THREE.Vector2(ISLAND_CENTERS[1].x, ISLAND_CENTERS[1].y - ISLAND_RADIUS * 0.88), type: 'bridge' });
    this.roadNodes.push({ id: 'bridge_12_s', pos: new THREE.Vector2(ISLAND_CENTERS[2].x, ISLAND_CENTERS[2].y + ISLAND_RADIUS * 0.88), type: 'bridge' });
    
    // Harbor entrance
    this.roadNodes.push({ id: 'harbor', pos: ISLAND_CENTERS[2].clone().add(new THREE.Vector2(0, ISLAND_RADIUS * 0.6)), type: 'harbor' });
    
    // Connect ring nodes sequentially
    for (let idx = 0; idx < 3; idx++) {
      for (let i = 0; i < 8; i++) {
        const a = `island${idx}_ring${i}`;
        const b = `island${idx}_ring${(i + 1) % 8}`;
        this.roadEdges.push({ a, b, length: 0, type: 'ring' });
      }
    }
    
    // Connect bridges to ring nodes (find closest)
    // Simplified: connect to nearest ring node on each island
    this.connectBridgeToRing('bridge_01_w', 0);
    this.connectBridgeToRing('bridge_01_e', 1);
    this.connectBridgeToRing('bridge_02_n', 0);
    this.connectBridgeToRing('bridge_02_s', 2);
    this.connectBridgeToRing('bridge_12_n', 1);
    this.connectBridgeToRing('bridge_12_s', 2);
    
    // Connect harbor to nearest ring node on island 2
    this.connectHarborToRing();
  }

  connectBridgeToRing(bridgeId, islandIdx) {
    const bridgeNode = this.roadNodes.find(n => n.id === bridgeId);
    if (!bridgeNode) return;
    
    let closest = null;
    let minDist = Infinity;
    this.roadNodes.forEach(node => {
      if (node.island === islandIdx && node.type === 'ring') {
        const d = node.pos.distanceTo(bridgeNode.pos);
        if (d < minDist) {
          minDist = d;
          closest = node.id;
        }
      }
    });
    if (closest) {
      this.roadEdges.push({ a: bridgeId, b: closest, length: minDist, type: 'connector' });
    }
  }

  connectHarborToRing() {
    const harborNode = this.roadNodes.find(n => n.id === 'harbor');
    if (!harborNode) return;
    
    let closest = null;
    let minDist = Infinity;
    this.roadNodes.forEach(node => {
      if (node.island === 2 && node.type === 'ring') {
        const d = node.pos.distanceTo(harborNode.pos);
        if (d < minDist) {
          minDist = d;
          closest = node.id;
        }
      }
    });
    if (closest) {
      this.roadEdges.push({ a: 'harbor', b: closest, length: minDist, type: 'connector' });
    }
  }

  // Get a random road position for spawning traffic
  getRandomRoadPosition() {
    const node = this.prng.choice(this.roadNodes);
    const angle = this.prng.random() * Math.PI * 2;
    return {
      x: node.pos.x + Math.cos(angle) * 5,
      z: node.pos.y + Math.sin(angle) * 5,
      angle: angle,
    };
  }

  // Get nearest road node to position
  getNearestRoadNode(x, z) {
    let nearest = null;
    let minDist = Infinity;
    this.roadNodes.forEach(node => {
      const d = Math.hypot(node.pos.x - x, node.pos.y - z);
      if (d < minDist) {
        minDist = d;
        nearest = node;
      }
    });
    return nearest;
  }

  // Pathfinding: simple A* on road graph
  findPath(startNodeId, endNodeId) {
    // Simplified: just return direct connection if exists, otherwise empty
    const edge = this.roadEdges.find(e => 
      (e.a === startNodeId && e.b === endNodeId) ||
      (e.a === endNodeId && e.b === startNodeId)
    );
    if (edge) return [startNodeId, endNodeId];
    
    // For now return empty - traffic will just drive on ring roads
    return [];
  }

  update(delta, camera) {
    this.waveTime += delta;
    this.updateDayNight(delta);
    this.updateWater(delta);
    this.updateRain(delta);
    this.updateLighthouse(delta);
    this.updateStreetlights();
    this.updateFog();
    
    // Update sky positions
    this.updateCelestialBodies();
  }

  updateDayNight(delta) {
    this.timeOfDay += this.daySpeed * delta;
    if (this.timeOfDay >= 1) this.timeOfDay -= 1;
    
    const dayPhase = this.timeOfDay;
    const isDay = dayPhase > 0.2 && dayPhase < 0.8;
    const wasNight = this.isNight;
    this.isNight = !isDay;
    
    if (wasNight !== this.isNight) {
      this.toggleWindows();
    }
    
    // Sun intensity
    let sunIntensity = 0;
    let moonIntensity = 0;
    let ambientIntensity = 0.3;
    let hemiIntensity = 0.5;
    let skyColor = new THREE.Color(0x000033);
    let fogColor = new THREE.Color(0x000033);
    let sunColor = new THREE.Color(0xffffee);
    let moonColor = new THREE.Color(0x88aaff);
    
    if (dayPhase < 0.25) {
      // Night to dawn (0-0.25)
      const t = dayPhase / 0.25;
      sunIntensity = t * 2.5;
      moonIntensity = (1 - t) * 0.5;
      ambientIntensity = 0.3 + t * 0.4;
      hemiIntensity = 0.5 + t * 0.3;
      skyColor.lerpColors(new THREE.Color(0x000033), new THREE.Color(0xff8844), t);
      fogColor.lerpColors(new THREE.Color(0x000033), new THREE.Color(0xff8844), t);
      sunColor.lerpColors(new THREE.Color(0xff4422), new THREE.Color(0xffffee), t);
    } else if (dayPhase < 0.5) {
      // Dawn to noon (0.25-0.5)
      const t = (dayPhase - 0.25) / 0.25;
      sunIntensity = 2.5;
      moonIntensity = 0;
      ambientIntensity = 0.7;
      hemiIntensity = 0.8;
      skyColor.lerpColors(new THREE.Color(0xff8844), new THREE.Color(0x87ceeb), t);
      fogColor.lerpColors(new THREE.Color(0xff8844), new THREE.Color(0x87ceeb), t);
    } else if (dayPhase < 0.75) {
      // Noon to dusk (0.5-0.75)
      const t = (dayPhase - 0.5) / 0.25;
      sunIntensity = 2.5;
      moonIntensity = 0;
      ambientIntensity = 0.7;
      hemiIntensity = 0.8;
      skyColor.lerpColors(new THREE.Color(0x87ceeb), new THREE.Color(0xff6622), t);
      fogColor.lerpColors(new THREE.Color(0x87ceeb), new THREE.Color(0xff6622), t);
    } else {
      // Dusk to night (0.75-1)
      const t = (dayPhase - 0.75) / 0.25;
      sunIntensity = (1 - t) * 2.5;
      moonIntensity = t * 0.5;
      ambientIntensity = 0.7 - t * 0.4;
      hemiIntensity = 0.8 - t * 0.3;
      skyColor.lerpColors(new THREE.Color(0xff6622), new THREE.Color(0x000033), t);
      fogColor.lerpColors(new THREE.Color(0xff6622), new THREE.Color(0x000033), t);
      sunColor.lerpColors(new THREE.Color(0xffffee), new THREE.Color(0xff4422), t);
    }
    
    // Weather modulation
    if (this.weather === 'rain') {
      sunIntensity *= 0.5;
      moonIntensity *= 0.5;
      ambientIntensity *= 0.7;
      skyColor.multiplyScalar(0.6);
      fogColor.multiplyScalar(0.6);
    } else if (this.weather === 'storm') {
      sunIntensity *= 0.2;
      moonIntensity *= 0.2;
      ambientIntensity *= 0.5;
      skyColor.multiplyScalar(0.3);
      fogColor.multiplyScalar(0.3);
    }
    
    this.sunLight.intensity = sunIntensity;
    this.sunLight.color.set(sunColor);
    this.moonLight.intensity = moonIntensity;
    this.moonLight.color.set(moonColor);
    this.ambientLight.intensity = ambientIntensity;
    this.hemiLight.intensity = hemiIntensity;
    this.skyMesh.material.color.set(skyColor);
    this.fogColor.set(fogColor);
    
    // Sun/moon position
    const sunAngle = (dayPhase - 0.25) * Math.PI * 2;
    this.sunLight.position.set(
      Math.sin(sunAngle) * 200,
      Math.cos(sunAngle) * 200 + 100,
      Math.cos(sunAngle) * 100
    );
    
    const moonAngle = sunAngle + Math.PI;
    this.moonLight.position.set(
      Math.sin(moonAngle) * 200,
      Math.cos(moonAngle) * 200 + 100,
      Math.cos(moonAngle) * 100
    );
  }

  toggleWindows() {
    this.buildings.forEach(building => {
      if (building.userData.windows) {
        building.userData.windows.forEach(win => {
          win.material = this.isNight ? this.windowMaterials.night : this.windowMaterials.day;
        });
      }
    });
    
    // Streetlights
    this.streetlights.forEach(light => {
      light.userData.pointLight.intensity = this.isNight ? 1.5 : 0;
      light.userData.fixture.material.opacity = this.isNight ? 1 : 0.1;
    });
    
    // Stars
    this.starMesh.material.opacity = this.isNight ? 0.8 : 0;
    
    // Lighthouse beam
    this.lighthouseBeam.visible = this.isNight;
    this.lighthouseLight.visible = this.isNight;
  }

  updateWater(delta) {
    if (!this.waterMaterial) return;
    
    // Animate water vertices
    const positions = this.waterMesh.geometry.attributes.position;
    const noise2d = createNoise2D(this.prng.seed + 5000);
    
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const z = positions.getY(i);
      
      // Gerstner-like waves
      let y = 0;
      y += Math.sin(x * 0.02 + this.waveTime * 2) * 0.3;
      y += Math.sin(z * 0.025 + this.waveTime * 1.7) * 0.25;
      y += Math.sin((x + z) * 0.015 + this.waveTime * 1.3) * 0.2;
      y += Math.sin((x - z) * 0.018 + this.waveTime * 1.9) * 0.15;
      
      // Rain ripples
      if (this.rainIntensity > 0.1) {
        y += noise2d(x * 0.1 + this.waveTime * 10, z * 0.1 + this.waveTime * 10) * this.rainIntensity * 0.1;
      }
      
      positions.setY(i, y);
    }
    positions.needsUpdate = true;
    this.waterMesh.geometry.computeVertexNormals();
    
    // Foam animation
    if (this.foamMesh) {
      this.foamMesh.material.opacity = 0.05 + Math.sin(this.waveTime * 3) * 0.02;
    }
    
    // Wet road look - handled by road material roughness/metalness
    this.roads.forEach(road => {
      if (road.mesh && road.mesh.material) {
        road.mesh.material.metalness = this.rainIntensity * 0.3;
        road.mesh.material.roughness = 0.9 - this.rainIntensity * 0.4;
      }
    });
  }

  updateRain(delta) {
    // Smooth rain intensity
    this.rainIntensity += (this.targetRainIntensity - this.rainIntensity) * delta * 2;
    
    if (this.rainParticles && this.rainIntensity > 0.01) {
      this.rainParticles.visible = true;
      this.rainSplashes.visible = true;
      
      const positions = this.rainParticles.geometry.attributes.position;
      const velocities = this.rainParticles.geometry.attributes.velocity;
      const cameraPos = new THREE.Vector3();
      // Get camera position from main loop
      
      // Update rain particles - follow camera
      for (let i = 0; i < positions.count; i++) {
        positions.array[i * 3] += velocities.array[i * 3] * delta;
        positions.array[i * 3 + 1] += velocities.array[i * 3 + 1] * delta;
        positions.array[i * 3 + 2] += velocities.array[i * 3 + 2] * delta;
        
        // Recycle particles that hit ground
        if (positions.array[i * 3 + 1] < 1) {
          // Create splash
          this.createSplash(positions.array[i * 3], positions.array[i * 3 + 2]);
          
          // Reset particle above camera
          positions.array[i * 3] = cameraPos.x + this.prng.range(-50, 50);
          positions.array[i * 3 + 1] = cameraPos.y + this.prng.range(30, 80);
          positions.array[i * 3 + 2] = cameraPos.z + this.prng.range(-50, 50);
        }
      }
      positions.needsUpdate = true;
      
      // Update splashes
      const splashPositions = this.rainSplashGeometry.attributes.position;
      const splashLife = this.rainSplashGeometry.attributes.life;
      for (let i = 0; i < splashLife.count; i++) {
        if (splashLife.array[i] > 0) {
          splashLife.array[i] -= delta * 10;
          splashPositions.array[i * 3 + 1] += delta * 2;
          if (splashLife.array[i] <= 0) {
            splashPositions.array[i * 3 + 1] = -100;
          }
        }
      }
      splashPositions.needsUpdate = true;
    } else if (this.rainParticles) {
      this.rainParticles.visible = false;
      this.rainSplashes.visible = false;
    }
  }

  createSplash(x, z) {
    const splashPositions = this.rainSplashGeometry.attributes.position;
    const splashLife = this.rainSplashGeometry.attributes.life;
    
    // Find dead splash particle
    for (let i = 0; i < splashLife.count; i++) {
      if (splashLife.array[i] <= 0) {
        splashPositions.array[i * 3] = x + this.prng.range(-0.5, 0.5);
        splashPositions.array[i * 3 + 1] = 0.5;
        splashPositions.array[i * 3 + 2] = z + this.prng.range(-0.5, 0.5);
        splashLife.array[i] = 1;
        break;
      }
    }
  }

  updateLighthouse(delta) {
    if (this.lighthouseBeam && this.isNight) {
      this.lighthouseBeam.rotation.y += delta * 0.5;
      this.lighthouseLight.intensity = 2 + Math.sin(this.waveTime * 4) * 0.5;
    }
  }

  updateStreetlights() {
    // Already handled in toggleWindows
  }

  updateFog() {
    if (this.scene.fog) {
      this.scene.fog.color.set(this.fogColor);
      const density = this.weather === 'storm' ? 0.008 : (this.weather === 'rain' ? 0.005 : 0.002);
      this.scene.fog.density = density;
    }
  }

  updateCelestialBodies() {
    const dayPhase = this.timeOfDay;
    const sunAngle = (dayPhase - 0.25) * Math.PI * 2;
    const moonAngle = sunAngle + Math.PI;
    
    const dist = WORLD_SIZE * 0.85;
    this.sunMesh.position.set(
      Math.sin(sunAngle) * dist,
      Math.cos(sunAngle) * dist + 50,
      Math.cos(sunAngle) * dist * 0.5
    );
    this.sunMesh.material.opacity = dayPhase > 0.15 && dayPhase < 0.85 ? 1 : 0;
    this.sunMesh.scale.setScalar(1 + Math.sin(this.waveTime * 2) * 0.1);
    
    this.moonMesh.position.set(
      Math.sin(moonAngle) * dist,
      Math.cos(moonAngle) * dist + 50,
      Math.cos(moonAngle) * dist * 0.5
    );
    this.moonMesh.material.opacity = (dayPhase < 0.2 || dayPhase > 0.8) ? 0.8 : 0;
    
    // Moon phases
    const phase = (dayPhase * 28) % 1;
    this.moonMesh.scale.setScalar(0.5 + Math.abs(phase - 0.5) * 1.5);
  }

  // Weather control
  setWeather(weather) {
    this.weather = weather;
    switch (weather) {
      case 'clear':
        this.targetRainIntensity = 0;
        break;
      case 'rain':
        this.targetRainIntensity = 1;
        break;
      case 'storm':
        this.targetRainIntensity = 1.5;
        break;
    }
  }

  // Ground height query for player/vehicle placement
  getGroundHeight(x, z) {
    // Check islands
    for (let idx = 0; idx < 3; idx++) {
      const island = this[`island${idx}`];
      if (!island) continue;
      const dx = x - island.center.x;
      const dz = z - island.center.y;
      const dist = Math.sqrt(dx * dx + dz * dz);
      
      if (dist < island.radius * 1.2) {
        // Base height from noise
        let height = island.noise2d(x * 0.01, z * 0.01) * 15;
        const hill = Math.max(0, 1 - dist / (island.radius * 0.85)) * 20;
        height += hill;
        
        // Beach
        if (dist > island.radius * 0.85) {
          height = Math.max(0, (island.radius - dist) * 0.3);
        }
        
        // Roads are at y=0.15
        if (this.isOnRoad(x, z)) {
          return 0.15;
        }
        
        // Bridges
        if (this.isOnBridge(x, z)) {
          return 4;
        }
        
        return Math.max(0, height);
      }
    }
    return WATER_LEVEL;
  }

  isOnRoad(x, z) {
    // Check ring roads
    for (const center of ISLAND_CENTERS) {
      const radius = ISLAND_RADIUS * 0.88;
      const dx = x - center.x;
      const dz = z - center.y;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (Math.abs(dist - radius) < ROAD_WIDTH / 2 + 1) return true;
      
      // Radial roads
      for (let r = 0; r < 4; r++) {
        const angle = (r / 4) * Math.PI * 2;
        const proj = dx * Math.sin(angle) + dz * Math.cos(angle);
        const perp = Math.abs(dx * Math.cos(angle) - dz * Math.sin(angle));
        if (proj > 0 && proj < radius && perp < ROAD_WIDTH / 2 + 1) return true;
      }
      
      // Cross roads
      if (Math.abs(dx) < ROAD_WIDTH && Math.abs(dz) < radius) return true;
      if (Math.abs(dz) < ROAD_WIDTH && Math.abs(dx) < radius) return true;
    }
    
    // Bridges
    return this.isOnBridge(x, z);
  }

  isOnBridge(x, z) {
    // Bridge 0-1 (west-east)
    if (Math.abs(z) < BRIDGE_WIDTH / 2) {
      const x1 = ISLAND_CENTERS[0].x + ISLAND_RADIUS * 0.88;
      const x2 = ISLAND_CENTERS[1].x - ISLAND_RADIUS * 0.88;
      if (x > x1 && x < x2) return true;
    }
    
    // Bridge 0-2 (west-south) - diagonal
    // Simplified check
    return false;
  }

  // Get spawn point for player
  getPlayerSpawn() {
    // Start on west island, near center
    return new THREE.Vector3(ISLAND_CENTERS[0].x, 5, ISLAND_CENTERS[0].y);
  }

  // Get vehicle spawn points
  getVehicleSpawns() {
    const spawns = [];
    ISLAND_CENTERS.forEach((center, idx) => {
      const radius = ISLAND_RADIUS * 0.6;
      for (let i = 0; i < 4; i++) {
        const angle = (i / 4) * Math.PI * 2 + Math.PI / 8;
        spawns.push({
          x: center.x + Math.cos(angle) * radius,
          z: center.y + Math.sin(angle) * radius,
          angle: angle + Math.PI,
          type: 'car',
        });
      }
    });
    
    // Boat spawns at harbors
    spawns.push({
      x: ISLAND_CENTERS[2].x - 30,
      z: ISLAND_CENTERS[2].y - 35,
      angle: -Math.PI / 2,
      type: 'boat',
    });
    spawns.push({
      x: ISLAND_CENTERS[0].x + ISLAND_RADIUS * 0.9,
      z: ISLAND_CENTERS[0].y,
      angle: 0,
      type: 'boat',
    });
    spawns.push({
      x: ISLAND_CENTERS[1].x - ISLAND_RADIUS * 0.9,
      z: ISLAND_CENTERS[1].y,
      angle: Math.PI,
      type: 'boat',
    });
    
    return spawns;
  }

  // Cleanup
  dispose() {
    // Dispose geometries, materials, etc.
    this.buildings.forEach(b => {
      b.traverse(obj => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
          else obj.material.dispose();
        }
      });
    });
    
    if (this.waterMesh) {
      this.waterMesh.geometry.dispose();
      this.waterMesh.material.dispose();
    }
    if (this.rainParticles) {
      this.rainParticles.geometry.dispose();
      this.rainParticles.material.dispose();
    }
    if (this.rainSplashes) {
      this.rainSplashes.geometry.dispose();
      this.rainSplashes.material.dispose();
    }
    if (this.skyMesh) {
      this.skyMesh.geometry.dispose();
      this.skyMesh.material.dispose();
    }
    if (this.sunMesh) {
      this.sunMesh.geometry.dispose();
      this.sunMesh.material.dispose();
    }
    if (this.moonMesh) {
      this.moonMesh.geometry.dispose();
      this.moonMesh.material.dispose();
    }
    if (this.starMesh) {
      this.starMesh.geometry.dispose();
      this.starMesh.material.dispose();
    }
  }
}

// Export helper to create world
export function createWorld(scene, seed) {
  return new World(scene, seed);
}