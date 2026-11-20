//
// MONSOON ISLES - Police System
// Wanted levels 0-5, police vehicles, pursuit AI, bust/wasted mechanics
//

import * as THREE from 'three';
import { prng } from './prng.js';

const POLICE_CAR_COLOR = 0x1a1aff;
const POLICE_LIGHT_BLUE = 0x00aaff;
const POLICE_LIGHT_RED = 0xff2200;
const SIREN_CYCLE = 0.5;

export class PoliceVehicle {
  constructor(world, type, x, z, angle) {
    this.world = world;
    this.type = type; // 'car' or 'boat'
    this.mesh = new THREE.Group();
    this.mesh.userData.isPolice = true;
    this.mesh.userData.policeVehicle = this;

    this.position = new THREE.Vector3(x, 0, z);
    this.rotation = angle;
    this.velocity = new THREE.Vector3();
    this.speed = 0;
    this.maxSpeed = type === 'car' ? 45 : 20;
    this.acceleration = type === 'car' ? 30 : 12;
    this.brakeForce = 20;
    this.steerAngle = 0;
    this.maxSteerAngle = Math.PI / 3;
    this.steerSpeed = 4;
    this.drag = 0.02;

    this.isAI = true;
    this.aiState = 'patrol'; // patrol, pursue, ram
    this.target = null;
    this.targetPosition = null;
    this.patrolNodes = [];
    this.patrolIndex = 0;
    this.patrolTimer = 0;
    this.sirenTimer = 0;
    this.sirenOn = true;
    this.ramCooldown = 0;
    this.stuckTimer = 0;
    this.lastPosition = new THREE.Vector3();

    this.createMesh();
    this.mesh.position.copy(this.position);
    this.mesh.rotation.y = this.rotation;
    this.world.scene.add(this.mesh);

    // Assign patrol route
    this.assignPatrolRoute();
  }

  createMesh() {
    const isCar = this.type === 'car';
    const { width, length, height } = isCar
      ? { width: 1.8, length: 4.5, height: 1.4 }
      : { width: 2.5, length: 7.0, height: 1.8 };

    const bodyMat = new THREE.MeshStandardMaterial({ color: POLICE_CAR_COLOR, roughness: 0.4, metalness: 0.6 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x0a0a33, roughness: 0.5, metalness: 0.4 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x223344, roughness: 0.1, metalness: 0.9, transparent: true, opacity: 0.5 });
    const lightBlueMat = new THREE.MeshBasicMaterial({ color: POLICE_LIGHT_BLUE, transparent: true, opacity: 1 });
    const lightRedMat = new THREE.MeshBasicMaterial({ color: POLICE_LIGHT_RED, transparent: true, opacity: 1 });
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
    const rimMat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.3, metalness: 0.7 });

    if (isCar) {
      // Chassis
      const chassisGeo = new THREE.BoxGeometry(width * 0.9, 0.3, length * 0.9);
      const chassis = new THREE.Mesh(chassisGeo, darkMat);
      chassis.position.y = 0.35;
      chassis.castShadow = true;
      this.mesh.add(chassis);

      // Body
      const bodyGeo = new THREE.BoxGeometry(width, height * 0.7, length * 0.65);
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.position.y = 0.35 + height * 0.35;
      body.castShadow = true;
      this.mesh.add(body);

      // Cabin
      const cabinGeo = new THREE.BoxGeometry(width * 0.85, height * 0.6, length * 0.3);
      const cabin = new THREE.Mesh(cabinGeo, bodyMat);
      cabin.position.y = 0.35 + height * 0.7 + cabinGeo.parameters.height / 2;
      cabin.castShadow = true;
      this.mesh.add(cabin);

      // Windows
      const windowGeo = new THREE.BoxGeometry(width * 0.82, height * 0.5, length * 0.28);
      const windows = new THREE.Mesh(windowGeo, glassMat);
      windows.position.y = cabin.position.y;
      windows.castShadow = true;
      this.mesh.add(windows);

      // Light bar
      const barGeo = new THREE.BoxGeometry(width * 0.9, 0.25, 0.8);
      const lightBar = new THREE.Mesh(barGeo, darkMat);
      lightBar.position.y = 0.35 + height * 0.7 + 0.3;
      lightBar.castShadow = true;
      this.mesh.add(lightBar);
      this.lightBar = lightBar;

      // Blue/red lights
      this.sirenLights = [];
      for (let i = 0; i < 4; i++) {
        const sign = i < 2 ? 1 : -1;
        const isBlue = i % 2 === 0;
        const lightGeo = new THREE.BoxGeometry(0.25, 0.15, 0.3);
        const light = new THREE.Mesh(lightGeo, isBlue ? lightBlueMat : lightRedMat);
        light.position.set(sign * (width/2 - 0.2), lightBar.position.y + 0.15, (i < 2 ? 1 : -1) * 0.3);
        this.mesh.add(light);
        light.userData.isBlue = isBlue;
        this.sirenLights.push(light);

        // Point light
        const pl = new THREE.PointLight(isBlue ? POLICE_LIGHT_BLUE : POLICE_LIGHT_RED, 0, 25, 2);
        pl.position.copy(light.position);
        pl.position.y += 0.2;
        this.mesh.add(pl);
        light.userData.pointLight = pl;
      }

      // Wheels
      this.wheels = [];
      const wheelPositions = [
        { x: width/2 + 0.1, z: length/2 - 0.5 },
        { x: -width/2 - 0.1, z: length/2 - 0.5 },
        { x: width/2 + 0.1, z: -length/2 + 0.5 },
        { x: -width/2 - 0.1, z: -length/2 + 0.5 },
      ];
      wheelPositions.forEach((pos, i) => {
        const wheel = new THREE.Group();
        const tireGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.2, 16);
        const tire = new THREE.Mesh(tireGeo, tireMat);
        tire.rotation.z = Math.PI / 2;
        tire.castShadow = true;
        wheel.add(tire);

        const rimGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.22, 10);
        const rim = new THREE.Mesh(rimGeo, rimMat);
        rim.rotation.z = Math.PI / 2;
        rim.castShadow = true;
        wheel.add(rim);

        wheel.position.set(pos.x, 0.35, pos.z);
        wheel.userData.isFront = i < 2;
        wheel.userData.tire = tire;
        wheel.userData.rim = rim;
        wheel.userData.rotation = 0;
        wheel.userData.steerAngle = 0;

        this.mesh.add(wheel);
        this.wheels.push(wheel);
      });

      // Headlights
      this.headlights = [];
      for (let i = 0; i < 2; i++) {
        const sign = i === 0 ? 1 : -1;
        const hlGeo = new THREE.BoxGeometry(0.3, 0.15, 0.1);
        const hl = new THREE.Mesh(hlGeo, new THREE.MeshBasicMaterial({ color: 0xffffee, transparent: true, opacity: 1 }));
        hl.position.set(sign * (width/2 - 0.15), 0.65, length/2);
        this.mesh.add(hl);
        const pl = new THREE.PointLight(0xffffee, 0, 30, 2);
        pl.position.copy(hl.position);
        pl.position.z += 0.5;
        this.mesh.add(pl);
        hl.userData.pointLight = pl;
        this.headlights.push(hl);
      }

      // Brake lights
      this.brakeLights = [];
      for (let i = 0; i < 2; i++) {
        const sign = i === 0 ? 1 : -1;
        const blGeo = new THREE.BoxGeometry(0.2, 0.15, 0.1);
        const bl = new THREE.Mesh(blGeo, new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 1 }));
        bl.position.set(sign * (width/2 - 0.15), 0.6, -length/2);
        this.mesh.add(bl);
        this.brakeLights.push(bl);
      }
    } else {
      // Police boat
      const hullGeo = new THREE.BoxGeometry(width, height * 0.6, length);
      const hull = new THREE.Mesh(hullGeo, bodyMat);
      hull.position.y = height * 0.3;
      hull.castShadow = true;
      this.mesh.add(hull);

      const deckGeo = new THREE.BoxGeometry(width * 0.9, 0.2, length * 0.7);
      const deck = new THREE.Mesh(deckGeo, darkMat);
      deck.position.y = height * 0.6 + 0.1;
      deck.castShadow = true;
      this.mesh.add(deck);

      const cabinGeo = new THREE.BoxGeometry(width * 0.7, height * 0.7, length * 0.3);
      const cabin = new THREE.Mesh(cabinGeo, bodyMat);
      cabin.position.y = height * 0.6 + 0.1 + cabinGeo.parameters.height / 2;
      cabin.position.z = -length * 0.1;
      cabin.castShadow = true;
      this.mesh.add(cabin);

      // Light bar on boat
      const barGeo = new THREE.BoxGeometry(width * 0.8, 0.2, 0.6);
      const lightBar = new THREE.Mesh(barGeo, darkMat);
      lightBar.position.set(0, cabin.position.y + cabinGeo.parameters.height / 2 + 0.2, cabin.position.z + length * 0.1);
      lightBar.castShadow = true;
      this.mesh.add(lightBar);
      this.lightBar = lightBar;

      this.sirenLights = [];
      for (let i = 0; i < 2; i++) {
        const sign = i === 0 ? 1 : -1;
        const lightGeo = new THREE.BoxGeometry(0.3, 0.15, 0.3);
        const light = new THREE.Mesh(lightGeo, i === 0 ? lightBlueMat : lightRedMat);
        light.position.set(sign * width/2 * 0.7, lightBar.position.y + 0.15, lightBar.position.z);
        this.mesh.add(light);
        light.userData.isBlue = i === 0;
        this.sirenLights.push(light);

        const pl = new THREE.PointLight(i === 0 ? POLICE_LIGHT_BLUE : POLICE_LIGHT_RED, 0, 30, 2);
        pl.position.copy(light.position);
        pl.position.y += 0.2;
        this.mesh.add(pl);
        light.userData.pointLight = pl;
      }

      // Nav lights
      const navColors = [0xff0000, 0x00ff00, 0xffffff];
      const navPositions = [
        { x: width/2, y: height * 0.6 + 0.3, z: length/3 },
        { x: -width/2, y: height * 0.6 + 0.3, z: length/3 },
        { x: 0, y: height * 0.6 + 0.3, z: -length/2 + 0.2 },
      ];
      this.navLights = [];
      navPositions.forEach((pos, i) => {
        const geo = new THREE.SphereGeometry(0.15, 8, 8);
        const mat = new THREE.MeshBasicMaterial({ color: navColors[i], transparent: true, opacity: 1 });
        const light = new THREE.Mesh(geo, mat);
        light.position.set(pos.x, pos.y, pos.z);
        this.mesh.add(light);
        const pl = new THREE.PointLight(navColors[i], 1, 20, 2);
        pl.position.copy(light.position);
        this.mesh.add(pl);
        this.navLights.push({ mesh: light, pointLight: pl });
      });

      // Engine/propeller
      const engineGeo = new THREE.BoxGeometry(0.5, 0.8, 0.6);
      const engine = new THREE.Mesh(engineGeo, new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.5, metalness: 0.5 }));
      engine.position.set(0, height * 0.6 + 0.5, -length/2 + 0.3);
      engine.castShadow = true;
      this.mesh.add(engine);

      const propGeo = new THREE.CylinderGeometry(0.6, 0.6, 0.1, 3);
      const propMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.5, metalness: 0.5 });
      this.propeller = new THREE.Mesh(propGeo, propMat);
      this.propeller.position.set(0, height * 0.3, -length/2 + 0.6);
      this.propeller.rotation.x = Math.PI / 2;
      this.mesh.add(this.propeller);
    }
  }

  assignPatrolRoute() {
    // Pick random road nodes for patrol
    const nodes = this.world.roadNodes;
    if (nodes.length === 0) return;

    const count = prng.int(3, 6);
    const startIdx = prng.int(0, nodes.length - 1);
    for (let i = 0; i < count; i++) {
      const idx = (startIdx + i * prng.int(1, 3)) % nodes.length;
      this.patrolNodes.push(nodes[idx]);
    }
    if (this.patrolNodes.length > 0) {
      this.targetPosition = this.patrolNodes[0].pos.clone();
    }
  }

  update(delta, player) {
    this.sirenTimer += delta;
    if (this.sirenTimer > SIREN_CYCLE) {
      this.sirenTimer = 0;
      this.sirenOn = !this.sirenOn;
      this.updateSirenLights();
    }

    // Check if stuck
    const moved = this.mesh.position.distanceTo(this.lastPosition);
    if (moved < 0.1 && this.speed > 5) {
      this.stuckTimer += delta;
    } else {
      this.stuckTimer = 0;
    }
    this.lastPosition.copy(this.mesh.position);

    // AI state machine
    const playerPos = player.position;
    const distToPlayer = this.mesh.position.distanceTo(playerPos);

    if (player.wantedLevel > 0) {
      // Can see player?
      const canSeePlayer = this.canSeePlayer(playerPos);

      if (canSeePlayer || distToPlayer < 50) {
        this.aiState = distToPlayer < 20 ? 'ram' : 'pursue';
        this.target = player;
        this.targetPosition = playerPos.clone();
      } else if (this.aiState === 'pursue' || this.aiState === 'ram') {
        // Lost sight, go to last known position
        this.aiState = 'pursue';
        // targetPosition already set to last known
      }
    } else {
      this.aiState = 'patrol';
      this.target = null;
    }

    // Execute AI behavior
    switch (this.aiState) {
      case 'patrol':
        this.updatePatrol(delta);
        break;
      case 'pursue':
        this.updatePursue(delta);
        break;
      case 'ram':
        this.updateRam(delta);
        break;
    }

    this.applyPhysics(delta);
    this.updateWheels(delta);
    this.updateLights();
    this.updatePropeller(delta);
    this.ramCooldown = Math.max(0, this.ramCooldown - delta);
  }

  canSeePlayer(playerPos) {
    const toPlayer = new THREE.Vector3().subVectors(playerPos, this.mesh.position);
    const dist = toPlayer.length();
    if (dist > 80) return false;

    const forward = new THREE.Vector3(Math.sin(this.rotation), 0, Math.cos(this.rotation));
    const dot = forward.dot(toPlayer.normalize());
    if (dot < 0.5) return false; // Not in front cone

    // Raycast for occlusion
    const ray = new THREE.Raycaster(this.mesh.position.clone().add(new THREE.Vector3(0, 1, 0)), toPlayer.normalize());
    ray.far = dist;
    const colliders = this.world.buildings.filter(b => b.userData.isBuilding);
    const hits = ray.intersectObjects(colliders, true);
    return hits.length === 0;
  }

  updatePatrol(delta) {
    if (!this.targetPosition || this.patrolNodes.length === 0) {
      this.assignPatrolRoute();
      return;
    }

    const toTarget = new THREE.Vector2(this.targetPosition.x - this.mesh.position.x, this.targetPosition.y - this.mesh.position.z);
    const dist = toTarget.length();

    if (dist < 8) {
      this.patrolIndex = (this.patrolIndex + 1) % this.patrolNodes.length;
      this.targetPosition = this.patrolNodes[this.patrolIndex].pos.clone();
    }

    this.driveToTarget(delta, this.targetPosition, this.maxSpeed * 0.6);
  }

  updatePursue(delta) {
    if (!this.targetPosition) return;

    // Predict player position
    let targetPos = this.targetPosition.clone();
    if (this.target && this.target.velocity) {
      targetPos.addScaledVector(new THREE.Vector3(this.target.velocity.x, 0, this.target.velocity.z), 1.5);
    }

    this.driveToTarget(delta, targetPos, this.maxSpeed * 0.9);

    // If close enough, switch to ram
    const dist = this.mesh.position.distanceTo(this.targetPosition);
    if (dist < 15) {
      this.aiState = 'ram';
    }
  }

  updateRam(delta) {
    if (!this.target) return;

    const targetPos = this.target.position.clone();
    this.driveToTarget(delta, targetPos, this.maxSpeed);

    // Attempt PIT maneuver / ram
    if (this.ramCooldown <= 0) {
      const toTarget = new THREE.Vector2(targetPos.x - this.mesh.position.x, targetPos.z - this.mesh.position.z);
      const dist = toTarget.length();
      if (dist < 8 && Math.abs(this.speed) > 15) {
        this.ramCooldown = 3;
        // Boost speed for ram
        this.speed = Math.min(this.maxSpeed, this.speed * 1.3);
      }
    }
  }

  driveToTarget(delta, targetPos, targetSpeed) {
    const toTarget = new THREE.Vector2(targetPos.x - this.mesh.position.x, targetPos.y - this.mesh.position.z);
    const dist = toTarget.length();
    if (dist < 1) return;

    const targetAngle = Math.atan2(toTarget.x, toTarget.y);
    let diff = targetAngle - this.rotation;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;

    // Steer
    const steer = THREE.MathUtils.clamp(diff * 3, -1, 1);
    const targetSteer = steer * this.maxSteerAngle;
    this.steerAngle = THREE.MathUtils.lerp(this.steerAngle, targetSteer, delta * this.steerSpeed);

    // Throttle
    if (this.speed < targetSpeed) {
      this.speed += this.acceleration * delta;
      if (this.speed > targetSpeed) this.speed = targetSpeed;
    } else if (this.speed > targetSpeed) {
      this.speed -= this.brakeForce * delta;
    }

    // If stuck, try to reverse and turn
    if (this.stuckTimer > 2) {
      this.speed = -this.maxSpeed * 0.5;
      this.steerAngle = (prng.random() - 0.5) * this.maxSteerAngle * 2;
      this.stuckTimer = 0;
    }
  }

  applyPhysics(delta) {
    const forward = new THREE.Vector3(Math.sin(this.rotation), 0, Math.cos(this.rotation));
    this.velocity.copy(forward).multiplyScalar(this.speed);

    if (Math.abs(this.speed) > 0.5) {
      const turnRate = this.steerAngle * (this.speed / this.maxSpeed) * 2.5;
      this.rotation += turnRate * delta;
    }

    this.mesh.position.addScaledVector(this.velocity, delta);
    this.mesh.rotation.y = this.rotation;

    if (this.type === 'car') {
      const groundY = this.world.getGroundHeight(this.mesh.position.x, this.mesh.position.z);
      this.mesh.position.y = groundY + 0.35;
    } else {
      const waterY = this.world.WATER_LEVEL;
      const waveHeight = this.getWaveHeight(this.mesh.position.x, this.mesh.position.z);
      this.mesh.position.y = waterY + waveHeight + 0.6;
      const waveSlopeX = this.getWaveSlope(this.mesh.position.x, this.mesh.position.z, true);
      const waveSlopeZ = this.getWaveSlope(this.mesh.position.x, this.mesh.position.z, false);
      this.mesh.rotation.x = waveSlopeX * 0.2;
      this.mesh.rotation.z = waveSlopeZ * 0.2;
    }

    // World bounds
    const limit = 1900;
    this.mesh.position.x = THREE.MathUtils.clamp(this.mesh.position.x, -limit, limit);
    this.mesh.position.z = THREE.MathUtils.clamp(this.mesh.position.z, -limit, limit);
  }

  getWaveHeight(x, z) {
    const t = this.world.waveTime;
    let y = 0;
    y += Math.sin(x * 0.02 + t * 2) * 0.3;
    y += Math.sin(z * 0.025 + t * 1.7) * 0.25;
    y += Math.sin((x + z) * 0.015 + t * 1.3) * 0.2;
    y += Math.sin((x - z) * 0.018 + t * 1.9) * 0.15;
    return y;
  }

  getWaveSlope(x, z, isX) {
    const eps = 1;
    if (isX) {
      return (this.getWaveHeight(x + eps, z) - this.getWaveHeight(x - eps, z)) / (2 * eps);
    } else {
      return (this.getWaveHeight(x, z + eps) - this.getWaveHeight(x, z - eps)) / (2 * eps);
    }
  }

  updateWheels(delta) {
    if (this.type !== 'car') return;
    this.wheels.forEach(wheel => {
      wheel.userData.rotation += this.speed * delta * 5;
      wheel.userData.tire.rotation.x = wheel.userData.rotation;
      wheel.userData.rim.rotation.x = wheel.userData.rotation;

      if (wheel.userData.isFront) {
        wheel.userData.steerAngle = THREE.MathUtils.lerp(wheel.userData.steerAngle, this.steerAngle, delta * 10);
        wheel.rotation.y = wheel.userData.steerAngle;
      }

      const groundY = this.world.getGroundHeight(
        this.mesh.position.x + Math.sin(this.rotation) * wheel.position.x + Math.cos(this.rotation) * wheel.position.z,
        this.mesh.position.z + Math.cos(this.rotation) * wheel.position.x - Math.sin(this.rotation) * wheel.position.z
      );
      const targetY = groundY + 0.35;
      wheel.position.y = THREE.MathUtils.lerp(wheel.position.y, targetY, delta * 15);
    });
  }

  updatePropeller(delta) {
    if (this.type === 'boat' && this.propeller) {
      this.propeller.rotation.z += this.speed * delta * 25;
    }
  }

  updateLights() {
    // Headlights (cars)
    if (this.headlights) {
      const isNight = this.world.isNight;
      this.headlights.forEach(hl => {
        hl.material.opacity = isNight ? 1 : 0;
        hl.userData.pointLight.intensity = isNight ? 2 : 0;
      });
    }

    // Brake lights
    if (this.brakeLights) {
      const braking = this.speed > 0 && this.aiState !== 'pursue';
      this.brakeLights.forEach(bl => {
        bl.material.opacity = braking ? 1 : 0.1;
      });
    }

    // Nav lights (boats)
    if (this.navLights) {
      const isNight = this.world.isNight;
      this.navLights.forEach(nl => {
        nl.mesh.visible = isNight;
        nl.pointLight.intensity = isNight ? 1 : 0;
      });
    }
  }

  updateSirenLights() {
    this.sirenLights.forEach(light => {
      const isActive = this.sirenOn === light.userData.isBlue;
      light.material.opacity = isActive ? 1 : 0.1;
      light.userData.pointLight.intensity = isActive ? 2 : 0;
    });
  }

  dispose() {
    if (this.type === 'boat' && this.propeller) {
      // nothing special
    }
    this.mesh.traverse(obj => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
        else obj.material.dispose();
      }
    });
    this.world.scene.remove(this.mesh);
  }
}

export class PoliceSystem {
  constructor(world) {
    this.world = world;
    this.policeCars = [];
    this.policeBoats = [];
    this.maxCars = 3;
    this.maxBoats = 2;
    this.spawnTimer = 0;
    this.spawnInterval = 15;
    this.policeStations = [];
    this.hospitals = [];

    this.findPoliceStations();
    this.findHospitals();
  }

  findPoliceStations() {
    // Police stations at island centers (simplified)
    const centers = [
      { x: -500, z: 0 },
      { x: 500, z: 0 },
      { x: 0, z: -500 },
    ];
    centers.forEach(c => {
      const groundY = this.world.getGroundHeight(c.x, c.z);
      if (groundY > 0.5) {
        this.policeStations.push(new THREE.Vector3(c.x, groundY + 1, c.z));
      }
    });
  }

  findHospitals() {
    // Hospitals near island centers
    const centers = [
      { x: -500, z: 200 },
      { x: 500, z: -200 },
      { x: 100, z: -500 },
    ];
    centers.forEach(c => {
      const groundY = this.world.getGroundHeight(c.x, c.z);
      if (groundY > 0.5) {
        this.hospitals.push(new THREE.Vector3(c.x, groundY + 1, c.z));
      }
    });
  }

  init() {
    // Spawn initial patrol cars
    for (let i = 0; i < this.maxCars; i++) {
      this.spawnPatrolCar();
    }
    for (let i = 0; i < this.maxBoats; i++) {
      this.spawnPatrolBoat();
    }
  }

  spawnPatrolCar() {
    const spawns = this.world.getVehicleSpawns().filter(s => s.type === 'car');
    if (spawns.length === 0) return;
    const spawn = prng.choice(spawns);
    const clear = !this.policeCars.some(v => v.mesh.position.distanceTo(new THREE.Vector3(spawn.x, 0, spawn.z)) < 20);
    if (!clear) return;
    const car = new PoliceVehicle(this.world, 'car', spawn.x, spawn.z, spawn.angle);
    this.policeCars.push(car);
  }

  spawnPatrolBoat() {
    const spawns = this.world.getVehicleSpawns().filter(s => s.type === 'boat');
    if (spawns.length === 0) return;
    const spawn = prng.choice(spawns);
    const clear = !this.policeBoats.some(b => b.mesh.position.distanceTo(new THREE.Vector3(spawn.x, 0, spawn.z)) < 30);
    if (!clear) return;
    const boat = new PoliceVehicle(this.world, 'boat', spawn.x, spawn.z, spawn.angle);
    this.policeBoats.push(boat);
  }

  update(delta, player) {
    // Spawn more police based on wanted level
    const desiredCars = Math.min(this.maxCars + player.wantedLevel, 8);
    const desiredBoats = Math.min(this.maxBoats + Math.floor(player.wantedLevel / 2), 4);

    this.spawnTimer += delta;
    if (this.policeCars.length < desiredCars && this.spawnTimer > this.spawnInterval / desiredCars) {
      this.spawnPatrolCar();
      this.spawnTimer = 0;
    }
    if (this.policeBoats.length < desiredBoats && this.spawnTimer > this.spawnInterval / desiredBoats) {
      this.spawnPatrolBoat();
      this.spawnTimer = 0;
    }

    // Update police vehicles
    this.policeCars.forEach(car => {
      car.update(delta, player);
      this.checkBust(car, player);
    });
    this.policeBoats.forEach(boat => {
      boat.update(delta, player);
      this.checkBust(boat, player);
    });

    // Despawn distant police when wanted level drops
    if (player.wantedLevel === 0) {
      this.despawnDistantPolice(player.position);
    }
  }

  checkBust(police, player) {
    if (player.wantedLevel === 0) return;
    if (player.isInVehicle && player.vehicle && player.vehicle.speed > 10) return; // Too fast to bust

    const dist = police.mesh.position.distanceTo(player.position);
    if (dist < 3) {
      // BUSTED!
      this.bustPlayer(player);
    }
  }

  bustPlayer(player) {
    // Fade out
    player.wantedLevel = 0;
    player.wantedTimer = 0;

    // Lose 10% money
    const loss = Math.floor(player.money * 0.1);
    player.money = Math.max(0, player.money - loss);

    // Respawn at nearest police station
    let nearest = this.policeStations[0];
    let minDist = Infinity;
    this.policeStations.forEach(station => {
      const d = station.distanceTo(player.position);
      if (d < minDist) {
        minDist = d;
        nearest = station;
      }
    });

    player.position.copy(nearest);
    player.velocity.set(0, 0, 0);
    player.mesh.position.copy(player.position);
    player.health = player.maxHealth;
    player.stamina = player.maxStamina;

    if (player.isInVehicle) {
      player.exitVehicle();
    }

    // Could trigger a "BUSTED" UI here
    console.log(`BUSTED! Lost $${loss}. Respawned at police station.`);
  }

  wastePlayer(player) {
    // WASTED - health reached 0
    player.wantedLevel = 0;
    player.wantedTimer = 0;

    // Lose money (more than bust)
    const loss = Math.floor(player.money * 0.2);
    player.money = Math.max(0, player.money - loss);

    // Respawn at nearest hospital
    let nearest = this.hospitals[0];
    let minDist = Infinity;
    this.hospitals.forEach(hospital => {
      const d = hospital.distanceTo(player.position);
      if (d < minDist) {
        minDist = d;
        nearest = hospital;
      }
    });

    player.position.copy(nearest);
    player.velocity.set(0, 0, 0);
    player.mesh.position.copy(player.position);
    player.health = player.maxHealth;
    player.stamina = player.maxStamina;

    if (player.isInVehicle) {
      player.exitVehicle();
    }

    console.log(`WASTED! Lost $${loss}. Respawned at hospital.`);
  }

  despawnDistantPolice(playerPos) {
    const despawnDist = 200;
    this.policeCars = this.policeCars.filter(car => {
      if (car.mesh.position.distanceTo(playerPos) > despawnDist && !car.target) {
        car.dispose();
        return false;
      }
      return true;
    });
    this.policeBoats = this.policeBoats.filter(boat => {
      if (boat.mesh.position.distanceTo(playerPos) > despawnDist && !boat.target) {
        boat.dispose();
        return false;
      }
      return true;
    });
  }

  // Crime reporting - called from other systems
  reportCrime(type, position, player) {
    const starIncrements = {
      'steal_car': 1,
      'hit_pedestrian': 1,
      'fire_gun': 1,
      'hit_police_car': 2,
      'hit_police_boat': 2,
      'kill_pedestrian': 2,
      'kill_police': 3,
    };
    const stars = starIncrements[type] || 0;
    if (stars > 0) {
      player.addWanted(stars);
      // Alert nearby police
      this.alertPolice(position, stars);
    }
  }

  alertPolice(position, severity) {
    // Make nearby police pursue
    const range = 100 + severity * 50;
    [...this.policeCars, ...this.policeBoats].forEach(police => {
      if (police.mesh.position.distanceTo(position) < range) {
        police.aiState = 'pursue';
        police.targetPosition = position.clone();
        police.target = null; // Will acquire player when seen
      }
    });
  }

  dispose() {
    this.policeCars.forEach(c => c.dispose());
    this.policeBoats.forEach(b => b.dispose());
    this.policeCars = [];
    this.policeBoats = [];
  }
}

export function createPoliceSystem(world) {
  return new PoliceSystem(world);
}