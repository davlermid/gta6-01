// MONSOON ISLES - People System
// Pedestrians walking on sidewalks, wandering, fleeing from danger

import * as THREE from 'three';
import { prng } from './prng.js';

const PEDESTRIAN_COLORS = [
  // Shirts
  0xcc2222, 0x2244cc, 0x22aa22, 0xccaa22, 0xcc44cc, 0xffffff, 0x886644, 0x4488cc,
  0xaa8866, 0x66aa88, 0xcc6622, 0x8844aa, 0x22cccc, 0xcc8844,
  // Pants
  0x1a1a2e, 0x2d2d2d, 0x1a2e1a, 0x2e1a1a, 0x2e2e1a, 0x1a1a1a,
];

export class Pedestrian {
  constructor(world, x, z) {
    this.world = world;
    this.mesh = new THREE.Group();
    this.mesh.userData.isPedestrian = true;
    this.mesh.userData.pedestrian = this;
    
    this.position = new THREE.Vector3(x, 0, z);
    this.velocity = new THREE.Vector3();
    this.rotation = prng.random() * Math.PI * 2;
    this.targetRotation = this.rotation;
    this.speed = 0;
    this.maxSpeed = prng.range(1.2, 2.5);
    this.walkCycle = prng.random() * Math.PI * 2;
    
    // AI state
    this.state = 'wander'; // wander, flee, idle
    this.wanderTarget = null;
    this.wanderTimer = 0;
    this.fleeTarget = null;
    this.fleeTimer = 0;
    this.idleTimer = 0;
    this.panicLevel = 0;
    
    // Appearance
    this.shirtColor = prng.choice(PEDESTRIAN_COLORS.slice(0, 14));
    this.pantsColor = prng.choice(PEDESTRIAN_COLORS.slice(14));
    this.skinColor = prng.choice([0xffdbac, 0xe8c5a0, 0xd4a574, 0x8b6b4a, 0x5d4037]);
    this.hairColor = prng.choice([0x1a1a1a, 0x3d2314, 0x8b6b4a, 0xccaa88, 0xffffff]);
    this.height = prng.range(1.6, 1.9);
    this.bodyScale = prng.range(0.9, 1.1);
    
    this.createMesh();
    this.mesh.position.copy(this.position);
    this.mesh.rotation.y = this.rotation;
    this.mesh.scale.setScalar(this.bodyScale);
    this.world.scene.add(this.mesh);
    
    // Pick initial wander target
    this.pickWanderTarget();
  }

  createMesh() {
    const skinMat = new THREE.MeshStandardMaterial({ color: this.skinColor, roughness: 0.8 });
    const shirtMat = new THREE.MeshStandardMaterial({ color: this.shirtColor, roughness: 0.9 });
    const pantsMat = new THREE.MeshStandardMaterial({ color: this.pantsColor, roughness: 0.95 });
    const shoeMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.7, metalness: 0.2 });
    const hairMat = new THREE.MeshStandardMaterial({ color: this.hairColor, roughness: 0.9 });
    
    const h = this.height;
    const scale = h / 1.75;
    
    // Torso
    this.torso = new THREE.Mesh(
      new THREE.BoxGeometry(0.4 * scale, 0.55 * scale, 0.2 * scale),
      shirtMat
    );
    this.torso.position.y = h * 0.58;
    this.torso.castShadow = true;
    this.mesh.add(this.torso);
    
    // Hips
    this.hips = new THREE.Mesh(
      new THREE.BoxGeometry(0.35 * scale, 0.25 * scale, 0.2 * scale),
      pantsMat
    );
    this.hips.position.y = h * 0.4;
    this.hips.castShadow = true;
    this.mesh.add(this.hips);
    
    // Head
    this.head = new THREE.Mesh(
      new THREE.BoxGeometry(0.2 * scale, 0.22 * scale, 0.2 * scale),
      skinMat
    );
    this.head.position.y = h * 0.88;
    this.head.castShadow = true;
    this.mesh.add(this.head);
    
    // Hair
    this.hair = new THREE.Mesh(
      new THREE.BoxGeometry(0.22 * scale, 0.1 * scale, 0.22 * scale),
      hairMat
    );
    this.hair.position.y = h * 0.96;
    this.mesh.add(this.hair);
    
    // Arms
    this.armL = this.createLimb(skinMat, shirtMat, true, scale, h);
    this.armR = this.createLimb(skinMat, shirtMat, false, scale, h);
    this.mesh.add(this.armL);
    this.mesh.add(this.armR);
    
    // Legs
    this.legL = this.createLeg(pantsMat, shoeMat, true, scale, h);
    this.legR = this.createLeg(pantsMat, shoeMat, false, scale, h);
    this.mesh.add(this.legL);
    this.mesh.add(this.legR);
    
    // Store base positions
    this.storeBasePositions();
  }

  createLimb(skinMat, shirtMat, isLeft, scale, h) {
    const group = new THREE.Group();
    const sign = isLeft ? 1 : -1;
    
    const upper = new THREE.Mesh(
      new THREE.BoxGeometry(0.12 * scale, 0.3 * scale, 0.12 * scale),
      shirtMat
    );
    upper.position.set(sign * 0.26 * scale, h * 0.58, 0);
    upper.castShadow = true;
    group.add(upper);
    group.userData.upper = upper;
    group.userData.upperBase = upper.position.clone();
    
    const lower = new THREE.Mesh(
      new THREE.BoxGeometry(0.1 * scale, 0.25 * scale, 0.1 * scale),
      skinMat
    );
    lower.position.set(sign * 0.26 * scale, h * 0.33, 0);
    lower.castShadow = true;
    group.add(lower);
    group.userData.lower = lower;
    group.userData.lowerBase = lower.position.clone();
    
    const hand = new THREE.Mesh(
      new THREE.BoxGeometry(0.11 * scale, 0.08 * scale, 0.11 * scale),
      skinMat
    );
    hand.position.set(sign * 0.26 * scale, h * 0.18, 0);
    hand.castShadow = true;
    group.add(hand);
    group.userData.hand = hand;
    
    return group;
  }

  createLeg(pantsMat, shoeMat, isLeft, scale, h) {
    const group = new THREE.Group();
    const sign = isLeft ? 1 : -1;
    
    const thigh = new THREE.Mesh(
      new THREE.BoxGeometry(0.15 * scale, 0.35 * scale, 0.15 * scale),
      pantsMat
    );
    thigh.position.set(sign * 0.12 * scale, h * 0.35, 0);
    thigh.castShadow = true;
    group.add(thigh);
    group.userData.thigh = thigh;
    group.userData.thighBase = thigh.position.clone();
    
    const calf = new THREE.Mesh(
      new THREE.BoxGeometry(0.12 * scale, 0.35 * scale, 0.12 * scale),
      pantsMat
    );
    calf.position.set(sign * 0.12 * scale, h * 0.1, 0);
    calf.castShadow = true;
    group.add(calf);
    group.userData.calf = calf;
    group.userData.calfBase = calf.position.clone();
    
    const foot = new THREE.Mesh(
      new THREE.BoxGeometry(0.16 * scale, 0.08 * scale, 0.28 * scale),
      shoeMat
    );
    foot.position.set(sign * 0.12 * scale, h * 0.03, 0.08 * scale);
    foot.castShadow = true;
    group.add(foot);
    group.userData.foot = foot;
    
    return group;
  }

  storeBasePositions() {
    this.armL.userData.upperBase = this.armL.userData.upper.position.clone();
    this.armL.userData.lowerBase = this.armL.userData.lower.position.clone();
    this.armR.userData.upperBase = this.armR.userData.upper.position.clone();
    this.armR.userData.lowerBase = this.armR.userData.lower.position.clone();
    this.legL.userData.thighBase = this.legL.userData.thigh.position.clone();
    this.legL.userData.calfBase = this.legL.userData.calf.position.clone();
    this.legR.userData.thighBase = this.legR.userData.thigh.position.clone();
    this.legR.userData.calfBase = this.legR.userData.calf.position.clone();
    this.torso.userData.basePos = this.torso.position.clone();
    this.hips.userData.basePos = this.hips.position.clone();
    this.head.userData.basePos = this.head.position.clone();
    this.hair.userData.basePos = this.hair.position.clone();
  }

  update(delta) {
    // Check for threats
    this.checkThreats(delta);
    
    // State machine
    switch (this.state) {
      case 'wander':
        this.updateWander(delta);
        break;
      case 'flee':
        this.updateFlee(delta);
        break;
      case 'idle':
        this.updateIdle(delta);
        break;
    }
    
    this.applyMovement(delta);
    this.updateAnimation(delta);
    this.updatePosition();
  }

  checkThreats(delta) {
    // Check for nearby fast vehicles, gunshots, explosions
    let maxThreat = 0;
    let threatPos = null;
    
    // Check vehicles
    this.world.vehicles.forEach(v => {
      if (v.speed > 10) {
        const dist = this.position.distanceTo(v.mesh.position);
        if (dist < 15) {
          const threat = (v.speed / 50) * (1 - dist / 15);
          if (threat > maxThreat) {
            maxThreat = threat;
            threatPos = v.mesh.position.clone();
          }
        }
      }
    });
    
    this.world.boats.forEach(b => {
      if (b.speed > 8) {
        const dist = this.position.distanceTo(b.mesh.position);
        if (dist < 20) {
          const threat = (b.speed / 30) * (1 - dist / 20);
          if (threat > maxThreat) {
            maxThreat = threat;
            threatPos = b.mesh.position.clone();
          }
        }
      }
    });
    
    // Check player
    if (this.world.player) {
      const dist = this.position.distanceTo(this.world.player.position);
      if (this.world.player.isInVehicle && this.world.player.vehicle && this.world.player.vehicle.speed > 10) {
        if (dist < 15) {
          const threat = (this.world.player.vehicle.speed / 50) * (1 - dist / 15);
          if (threat > maxThreat) {
            maxThreat = threat;
            threatPos = this.world.player.position.clone();
          }
        }
      }
      // Gunshots would be checked here
    }
    
    if (maxThreat > 0.3) {
      this.panicLevel = Math.min(1, this.panicLevel + maxThreat * 0.5);
      if (this.state !== 'flee' && threatPos) {
        this.state = 'flee';
        this.fleeTarget = this.calculateFleeTarget(threatPos);
        this.fleeTimer = prng.range(3, 6);
        this.maxSpeed = prng.range(3, 5); // Run speed
      }
    } else {
      this.panicLevel = Math.max(0, this.panicLevel - delta * 0.2);
      if (this.panicLevel < 0.1 && this.state === 'flee') {
        this.state = 'wander';
        this.maxSpeed = prng.range(1.2, 2.5);
        this.pickWanderTarget();
      }
    }
  }

  calculateFleeTarget(threatPos) {
    // Run away from threat
    const away = new THREE.Vector2(
      this.position.x - threatPos.x,
      this.position.z - threatPos.z
    ).normalize();
    
    const dist = prng.range(20, 40);
    const targetX = this.position.x + away.x * dist;
    const targetZ = this.position.z + away.y * dist;
    
    // Clamp to walkable area
    const groundY = this.world.getGroundHeight(targetX, targetZ);
    if (groundY > 0.5) { // On land
      return new THREE.Vector2(targetX, targetZ);
    }
    
    // Try perpendicular
    const perp = new THREE.Vector2(-away.y, away.x);
    for (let i = 0; i < 4; i++) {
      const tx = this.position.x + perp.x * dist * (i % 2 === 0 ? 1 : -1);
      const tz = this.position.z + perp.y * dist * (i % 2 === 0 ? 1 : -1);
      if (this.world.getGroundHeight(tx, tz) > 0.5) {
        return new THREE.Vector2(tx, tz);
      }
    }
    
    return new THREE.Vector2(this.position.x, this.position.z);
  }

  updateWander(delta) {
    this.wanderTimer -= delta;
    
    if (!this.wanderTarget || this.wanderTimer <= 0) {
      this.pickWanderTarget();
    }
    
    if (this.wanderTarget) {
      const toTarget = new THREE.Vector2(
        this.wanderTarget.x - this.position.x,
        this.wanderTarget.y - this.position.z
      );
      const dist = toTarget.length();
      
      if (dist < 2) {
        this.wanderTarget = null;
        this.wanderTimer = 0;
        return;
      }
      
      const targetAngle = Math.atan2(toTarget.x, toTarget.y);
      let diff = targetAngle - this.rotation;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      
      this.targetRotation = targetAngle;
      
      // Walk towards target
      this.speed = this.maxSpeed;
    }
  }

  updateFlee(delta) {
    this.fleeTimer -= delta;
    
    if (this.fleeTimer <= 0 || !this.fleeTarget) {
      this.state = 'wander';
      this.maxSpeed = prng.range(1.2, 2.5);
      this.pickWanderTarget();
      return;
    }
    
    const toTarget = new THREE.Vector2(
      this.fleeTarget.x - this.position.x,
      this.fleeTarget.y - this.position.z
    );
    const dist = toTarget.length();
    
    if (dist < 3) {
      this.fleeTarget = null;
      return;
    }
    
    const targetAngle = Math.atan2(toTarget.x, toTarget.y);
    let diff = targetAngle - this.rotation;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    
    this.targetRotation = targetAngle;
    this.speed = this.maxSpeed;
  }

  updateIdle(delta) {
    this.idleTimer -= delta;
    this.speed = 0;
    
    if (this.idleTimer <= 0) {
      this.state = 'wander';
      this.pickWanderTarget();
    }
  }

  pickWanderTarget() {
    // Pick a random point on sidewalk (near roads but not on them)
    const attempts = 10;
    for (let i = 0; i < attempts; i++) {
      const angle = prng.random() * Math.PI * 2;
      const dist = prng.range(10, 50);
      const x = this.position.x + Math.cos(angle) * dist;
      const z = this.position.z + Math.sin(angle) * dist;
      
      const groundY = this.world.getGroundHeight(x, z);
      if (groundY > 0.5 && !this.world.isOnRoad(x, z)) {
        this.wanderTarget = new THREE.Vector2(x, z);
        this.wanderTimer = prng.range(5, 15);
        return;
      }
    }
    
    // Fallback: just wait
    this.state = 'idle';
    this.idleTimer = prng.range(2, 5);
  }

  applyMovement(delta) {
    // Smooth rotation
    let diff = this.targetRotation - this.rotation;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.rotation += diff * Math.min(delta * 5, 1);
    
    // Apply velocity
    if (this.speed > 0) {
      this.velocity.x = Math.sin(this.rotation) * this.speed;
      this.velocity.z = Math.cos(this.rotation) * this.speed;
    } else {
      this.velocity.x = 0;
      this.velocity.z = 0;
    }
    
    this.position.addScaledVector(this.velocity, delta);
    
    // Ground height
    const groundY = this.world.getGroundHeight(this.position.x, this.position.z);
    this.position.y = groundY;
    
    // Avoid other pedestrians
    this.avoidPedestrians(delta);
    
    // Keep in bounds
    const limit = 1900;
    this.position.x = THREE.MathUtils.clamp(this.position.x, -limit, limit);
    this.position.z = THREE.MathUtils.clamp(this.position.z, -limit, limit);
  }

  avoidPedestrians(delta) {
    const avoidRadius = 1.5;
    const pushForce = 3;
    
    this.world.pedestrians.forEach(other => {
      if (other === this) return;
      
      const dx = this.position.x - other.position.x;
      const dz = this.position.z - other.position.z;
      const distSq = dx * dx + dz * dz;
      
      if (distSq > 0 && distSq < avoidRadius * avoidRadius) {
        const dist = Math.sqrt(distSq);
        const push = (avoidRadius - dist) / dist * pushForce * delta;
        this.position.x += dx * push;
        this.position.z += dz * push;
      }
    });
    
    // Avoid vehicles
    this.world.vehicles.forEach(v => {
      const dx = this.position.x - v.mesh.position.x;
      const dz = this.position.z - v.mesh.position.z;
      const distSq = dx * dx + dz * dz;
      const avoidR = v.specs.width / 2 + 2;
      
      if (distSq > 0 && distSq < avoidR * avoidR) {
        const dist = Math.sqrt(distSq);
        const push = (avoidR - dist) / dist * pushForce * delta;
        this.position.x += dx * push;
        this.position.z += dz * push;
      }
    });
  }

  updateAnimation(delta) {
    if (this.speed > 0.3) {
      this.walkCycle += delta * (this.state === 'flee' ? 14 : 8);
      
      const swing = Math.sin(this.walkCycle) * 0.8;
      const swing2 = Math.sin(this.walkCycle + Math.PI) * 0.8;
      const bob = Math.abs(Math.sin(this.walkCycle * 0.5)) * 0.03;
      
      // Arms
      if (this.armL.userData.upper) {
        this.armL.userData.upper.rotation.x = swing;
        this.armR.userData.upper.rotation.x = swing2;
      }
      if (this.armL.userData.lower) {
        this.armL.userData.lower.rotation.x = swing * 0.3;
        this.armR.userData.lower.rotation.x = swing2 * 0.3;
      }
      
      // Legs
      if (this.legL.userData.thigh) {
        this.legL.userData.thigh.rotation.x = swing2 * 0.8;
        this.legR.userData.thigh.rotation.x = swing * 0.8;
      }
      if (this.legL.userData.calf) {
        this.legL.userData.calf.rotation.x = Math.max(0, -swing2 * 0.6);
        this.legR.userData.calf.rotation.x = Math.max(0, -swing * 0.6);
      }
      
      // Body bob
      this.torso.position.y = this.torso.userData.basePos.y + bob;
      this.hips.position.y = this.hips.userData.basePos.y + bob * 0.5;
      this.head.position.y = this.head.userData.basePos.y + bob * 0.2;
      this.hair.position.y = this.hair.userData.basePos.y + bob * 0.2;
    } else {
      // Return to idle
      const lerp = delta * 8;
      this.lerpToBase(this.armL.userData.upper, 'x', lerp);
      this.lerpToBase(this.armR.userData.upper, 'x', lerp);
      this.lerpToBase(this.armL.userData.lower, 'x', lerp);
      this.lerpToBase(this.armR.userData.lower, 'x', lerp);
      this.lerpToBase(this.legL.userData.thigh, 'x', lerp);
      this.lerpToBase(this.legR.userData.thigh, 'x', lerp);
      this.lerpToBase(this.legL.userData.calf, 'x', lerp);
      this.lerpToBase(this.legR.userData.calf, 'x', lerp);
      
      this.torso.position.y = THREE.MathUtils.lerp(this.torso.position.y, this.torso.userData.basePos.y, lerp);
      this.hips.position.y = THREE.MathUtils.lerp(this.hips.position.y, this.hips.userData.basePos.y, lerp);
      this.head.position.y = THREE.MathUtils.lerp(this.head.position.y, this.head.userData.basePos.y, lerp);
      this.hair.position.y = THREE.MathUtils.lerp(this.hair.position.y, this.hair.userData.basePos.y, lerp);
    }
  }

  lerpToBase(obj, axis, speed) {
    if (!obj) return;
    obj.rotation[axis] = THREE.MathUtils.lerp(obj.rotation[axis], 0, speed);
  }

  updatePosition() {
    this.mesh.position.copy(this.position);
    this.mesh.rotation.y = this.rotation;
  }

  dispose() {
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

export class PedestrianSystem {
  constructor(world) {
    this.world = world;
    this.pedestrians = [];
    this.maxPedestrians = 40;
    this.spawnTimer = 0;
    this.spawnInterval = 2;
  }

  init() {
    // Spawn initial pedestrians on sidewalks
    for (let i = 0; i < this.maxPedestrians; i++) {
      this.spawnRandomPedestrian();
    }
  }

  update(delta) {
    this.spawnTimer += delta;
    
    this.pedestrians.forEach(ped => {
      ped.update(delta);
      
      // Remove dead/far pedestrians
      if (this.world.player) {
        const dist = ped.position.distanceTo(this.world.player.position);
        if (dist > 200) {
          this.removePedestrian(ped);
        }
      }
    });
    
    // Spawn new pedestrians
    if (this.pedestrians.length < this.maxPedestrians && this.spawnTimer > this.spawnInterval) {
      this.spawnRandomPedestrian();
      this.spawnTimer = 0;
    }
  }

  spawnRandomPedestrian() {
    if (!this.world.player) return;
    
    // Spawn near player but not too close
    const angle = prng.random() * Math.PI * 2;
    const dist = prng.range(30, 80);
    const x = this.world.player.position.x + Math.cos(angle) * dist;
    const z = this.world.player.position.z + Math.sin(angle) * dist;
    
    const groundY = this.world.getGroundHeight(x, z);
    if (groundY < 0.5) return; // Water
    if (this.world.isOnRoad(x, z)) return; // Road
    
    // Check not too close to other pedestrians
    const tooClose = this.pedestrians.some(p => p.position.distanceTo(new THREE.Vector3(x, 0, z)) < 5);
    if (tooClose) return;
    
    const ped = new Pedestrian(this.world, x, z);
    this.pedestrians.push(ped);
  }

  removePedestrian(ped) {
    ped.dispose();
    const idx = this.pedestrians.indexOf(ped);
    if (idx >= 0) this.pedestrians.splice(idx, 1);
  }

  dispose() {
    this.pedestrians.forEach(p => p.dispose());
    this.pedestrians = [];
  }
}