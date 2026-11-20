// MONSOON ISLES - Combat System
// Pistol: draw/holster (key 1), raycast shooting, muzzle flash, tracer, peds flee, police return fire at 3+ stars
// Health/armor, weapon/armor pickups

import * as THREE from 'three';
import { prng } from './prng.js';
import { Pedestrian } from './people.js';
import { Vehicle } from './vehicles.js';
import { Boat } from './vehicles.js';

const WEAPON_STATS = {
  pistol: {
    damage: 25,
    range: 50,
    fireRate: 0.3, // seconds between shots
    spread: 0.02,
    muzzleFlashDuration: 0.05,
    tracerDuration: 0.1,
    ammoCapacity: 12,
    maxAmmo: 120,
  },
};

const PICKUP_TYPES = {
  health: { color: 0x00ff00, amount: 25, respawnTime: 30 },
  armor: { color: 0x0088ff, amount: 50, respawnTime: 60 },
  pistol_ammo: { color: 0xffaa00, amount: 24, respawnTime: 45 },
};

export class CombatSystem {
  constructor(world, player, input) {
    this.world = world;
    this.player = player;
    this.input = input;

    this.weapon = 'pistol';
    this.hasWeapon = true;
    this.isArmed = false; // Weapon drawn
    this.ammo = WEAPON_STATS.pistol.maxAmmo;
    this.ammoInClip = WEAPON_STATS.pistol.ammoCapacity;
    this.fireTimer = 0;
    this.reloadTimer = 0;
    this.isReloading = false;

    // Muzzle flash
    this.muzzleFlash = null;
    this.muzzleFlashTimer = 0;
    this.createMuzzleFlash();

    // Tracers
    this.tracers = [];
    this.tracerPool = [];
    this.createTracerPool(20);

    // Pickups
    this.pickups = [];
    this.pickupSpawns = [];
    this.createPickupSpawns();
    this.spawnInitialPickups();

    // Combat log for debugging
    this.lastHitTime = 0;
  }

  createMuzzleFlash() {
    const geo = new THREE.PlaneGeometry(0.5, 0.5);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffee88,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.muzzleFlash = new THREE.Mesh(geo, mat);
    this.world.scene.add(this.muzzleFlash);
  }

  createTracerPool(count) {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 2 * 3); // 2 vertices per tracer
    const colors = new Float32Array(count * 2 * 3);
    const life = new Float32Array(count);

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('life', new THREE.BufferAttribute(life, 1));

    const mat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 1,
      depthWrite: false,
    });

    this.tracerMesh = new THREE.LineSegments(geo, mat);
    this.tracerMesh.visible = false;
    this.world.scene.add(this.tracerMesh);

    for (let i = 0; i < count; i++) {
      this.tracerPool.push(i);
    }
  }

  createPickupSpawns() {
    // Health pickups
    const healthLocations = [
      { x: -500, z: 0 },      // West island center
      { x: 500, z: 0 },       // East island center
      { x: 0, z: -500 },      // South island center
      { x: -500, z: 300 },    // West island north
      { x: 500, z: -300 },    // East island south
      { x: -200, z: -500 },   // South island west
    ];

    // Armor pickups
    const armorLocations = [
      { x: -500, z: -200 },   // West island south
      { x: 500, z: 200 },     // East island north
      { x: 100, z: -500 },    // South island east
    ];

    // Ammo pickups
    const ammoLocations = [
      { x: -500, z: 200 },    // West island north
      { x: 500, z: -200 },    // East island south
      { x: -100, z: -500 },   // South island west
      { x: 0, z: 0 },         // Bridge center
    ];

    healthLocations.forEach(pos => {
      const groundY = this.world.getGroundHeight(pos.x, pos.z);
      if (groundY > 0.5) {
        this.pickupSpawns.push({ x: pos.x, y: groundY + 1, z: pos.z, type: 'health' });
      }
    });
    armorLocations.forEach(pos => {
      const groundY = this.world.getGroundHeight(pos.x, pos.z);
      if (groundY > 0.5) {
        this.pickupSpawns.push({ x: pos.x, y: groundY + 1, z: pos.z, type: 'armor' });
      }
    });
    ammoLocations.forEach(pos => {
      const groundY = this.world.getGroundHeight(pos.x, pos.z);
      if (groundY > 0.5) {
        this.pickupSpawns.push({ x: pos.x, y: groundY + 1, z: pos.z, type: 'pistol_ammo' });
      }
    });
  }

  spawnInitialPickups() {
    this.pickupSpawns.forEach(spawn => {
      this.spawnPickup(spawn);
    });
  }

  spawnPickup(spawnData) {
    const spec = PICKUP_TYPES[spawnData.type];
    const geo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    const mat = new THREE.MeshStandardMaterial({
      color: spec.color,
      emissive: spec.color,
      emissiveIntensity: 0.5,
      roughness: 0.3,
      metalness: 0.7,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(spawnData.x, spawnData.y, spawnData.z);
    mesh.castShadow = true;
    mesh.userData.isPickup = true;
    mesh.userData.pickupType = spawnData.type;
    mesh.userData.respawnData = spawnData;
    mesh.userData.bobOffset = prng.random() * Math.PI * 2;
    mesh.userData.spinSpeed = 1 + prng.random() * 2;
    this.world.scene.add(mesh);
    this.pickups.push(mesh);
  }

  update(delta) {
    this.handleInput(delta);
    this.updateFireTimer(delta);
    this.updateMuzzleFlash(delta);
    this.updateTracers(delta);
    this.updatePickups(delta);
    this.checkPoliceReturnFire(delta);
  }

  handleInput(delta) {
    // Toggle weapon with key 1
    if (this.input.keys.Digit1 && !this.input.prevKeys.Digit1) {
      this.isArmed = !this.isArmed;
      if (this.isArmed) {
        this.player.mesh.userData.isArmed = true;
      } else {
        this.player.mesh.userData.isArmed = false;
        this.muzzleFlashTimer = 0;
        this.muzzleFlash.material.opacity = 0;
      }
    }

    // Reload with R
    if (this.input.keys.KeyR && !this.input.prevKeys.KeyR && this.isArmed) {
      this.startReload();
    }

    // Fire with left click (mouse button 0)
    if (this.isArmed && this.input.mouseDelta !== undefined) {
      // Check for click - we'll use a custom property
      if (this.input.isMouseDown && this.fireTimer <= 0 && !this.isReloading && this.ammoInClip > 0) {
        this.fire();
      }
    }

    // Auto-reload when empty and trying to fire
    if (this.isArmed && this.ammoInClip === 0 && this.ammo > 0 && this.fireTimer <= 0 && this.input.isMouseDown) {
      this.startReload();
    }
  }

  updateFireTimer(delta) {
    if (this.fireTimer > 0) {
      this.fireTimer -= delta;
    }
    if (this.reloadTimer > 0) {
      this.reloadTimer -= delta;
      if (this.reloadTimer <= 0) {
        this.finishReload();
      }
    }
  }

  startReload() {
    if (this.isReloading || this.ammo === 0 || this.ammoInClip === WEAPON_STATS.pistol.ammoCapacity) return;
    this.isReloading = true;
    this.reloadTimer = 1.5; // Reload time
    // Could play reload sound/animation here
  }

  finishReload() {
    const needed = WEAPON_STATS.pistol.ammoCapacity - this.ammoInClip;
    const toLoad = Math.min(needed, this.ammo);
    this.ammoInClip += toLoad;
    this.ammo -= toLoad;
    this.isReloading = false;
  }

  fire() {
    const stats = WEAPON_STATS.pistol;

    // Consume ammo
    this.ammoInClip--;
    this.fireTimer = stats.fireRate;

    // Muzzle flash
    this.showMuzzleFlash();

    // Raycast
    const camera = this.world.player.camera;
    const origin = new THREE.Vector3();
    camera.getWorldPosition(origin);
    origin.y += 0.2; // Slightly above camera

    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);

    // Apply spread
    const spread = stats.spread;
    direction.x += (prng.random() - 0.5) * spread;
    direction.y += (prng.random() - 0.5) * spread;
    direction.z += (prng.random() - 0.5) * spread;
    direction.normalize();

    const ray = new THREE.Raycaster(origin, direction, 0, stats.range);

    // Collect all hittable objects
    const targets = [];
    this.world.buildings.forEach(b => { if (b.userData.isBuilding) targets.push(b); });
    this.world.pedestrians.forEach(p => { if (p.mesh) targets.push(p.mesh); });
    this.world.vehicles.forEach(v => { if (v.mesh) targets.push(v.mesh); });
    this.world.boats.forEach(b => { if (b.mesh) targets.push(b.mesh); });
    this.policeCars?.forEach(c => { if (c.mesh) targets.push(c.mesh); });
    this.policeBoats?.forEach(b => { if (b.mesh) targets.push(b.mesh); });

    const hits = ray.intersectObjects(targets, true);

    if (hits.length > 0) {
      const hit = hits[0];
      const hitPoint = hit.point.clone();
      const hitObject = hit.object;

      // Create tracer to hit point
      this.createTracer(origin, hitPoint);

      // Apply damage based on what was hit
      this.applyDamage(hitObject, hitPoint, direction, stats.damage);

      // Impact effect
      this.createImpactEffect(hitPoint, hit.face?.normal || new THREE.Vector3(0, 1, 0));
    } else {
      // Tracer to max range
      const endPoint = origin.clone().addScaledVector(direction, stats.range);
      this.createTracer(origin, endPoint);
    }

    // Alert police if player fires gun
    if (this.world.policeSystem) {
      this.world.policeSystem.reportCrime('fire_gun', this.player.position, this.player);
    }

    // Make nearby pedestrians flee
    this.alertPedestrians(origin, 30);
  }

  showMuzzleFlash() {
    // Position at camera + forward offset
    const camera = this.world.player.camera;
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0));
    const up = new THREE.Vector3(0, 1, 0);

    const flashPos = new THREE.Vector3();
    camera.getWorldPosition(flashPos);
    flashPos.addScaledVector(forward, 1.5);
    flashPos.addScaledVector(right, 0.3);
    flashPos.addScaledVector(up, -0.1);

    this.muzzleFlash.position.copy(flashPos);
    this.muzzleFlash.quaternion.copy(camera.quaternion);
    this.muzzleFlash.scale.setScalar(0.5 + prng.random() * 0.3);
    this.muzzleFlash.material.opacity = 1;
    this.muzzleFlashTimer = WEAPON_STATS.pistol.muzzleFlashDuration;
  }

  updateMuzzleFlash(delta) {
    if (this.muzzleFlashTimer > 0) {
      this.muzzleFlashTimer -= delta;
      this.muzzleFlash.material.opacity = THREE.MathUtils.lerp(0, 1, this.muzzleFlashTimer / WEAPON_STATS.pistol.muzzleFlashDuration);
      if (this.muzzleFlashTimer <= 0) {
        this.muzzleFlash.material.opacity = 0;
      }
    }
  }

  createTracer(start, end) {
    if (this.tracerPool.length === 0) return;

    const idx = this.tracerPool.pop();
    const positions = this.tracerMesh.geometry.attributes.position;
    const colors = this.tracerMesh.geometry.attributes.color;
    const life = this.tracerMesh.geometry.attributes.life;

    const baseIdx = idx * 6; // 2 vertices * 3 components

    // Start point
    positions.array[baseIdx] = start.x;
    positions.array[baseIdx + 1] = start.y;
    positions.array[baseIdx + 2] = start.z;
    // End point
    positions.array[baseIdx + 3] = end.x;
    positions.array[baseIdx + 4] = end.y;
    positions.array[baseIdx + 5] = end.z;

    // Color (yellow to orange)
    const c = new THREE.Color(0xffee44);
    colors.array[baseIdx] = c.r;
    colors.array[baseIdx + 1] = c.g;
    colors.array[baseIdx + 2] = c.b;
    colors.array[baseIdx + 3] = c.r * 0.5;
    colors.array[baseIdx + 4] = c.g * 0.5;
    colors.array[baseIdx + 5] = c.b * 0.5;

    life.array[idx] = WEAPON_STATS.pistol.tracerDuration;

    positions.needsUpdate = true;
    colors.needsUpdate = true;
    life.needsUpdate = true;

    this.tracers.push(idx);
    this.tracerMesh.visible = true;
  }

  updateTracers(delta) {
    const life = this.tracerMesh.geometry.attributes.life;
    const positions = this.tracerMesh.geometry.attributes.position;
    const colors = this.tracerMesh.geometry.attributes.color;

    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const idx = this.tracers[i];
      life.array[idx] -= delta;

      if (life.array[idx] <= 0) {
        // Fade out
        const baseIdx = idx * 6;
        const fade = Math.max(0, life.array[idx] / WEAPON_STATS.pistol.tracerDuration + 1);
        colors.array[baseIdx + 3] *= fade;
        colors.array[baseIdx + 4] *= fade;
        colors.array[baseIdx + 5] *= fade;
        colors.needsUpdate = true;

        if (life.array[idx] <= -0.1) {
          this.tracerPool.push(idx);
          this.tracers.splice(i, 1);
        }
      }
    }

    if (this.tracers.length === 0) {
      this.tracerMesh.visible = false;
    }
  }

  createImpactEffect(position, normal) {
    // Simple particle burst
    const count = 8;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    const life = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      positions[i * 3] = position.x;
      positions[i * 3 + 1] = position.y;
      positions[i * 3 + 2] = position.z;

      const dir = new THREE.Vector3(
        normal.x + (prng.random() - 0.5) * 0.5,
        normal.y + (prng.random() - 0.5) * 0.5 + 0.5,
        normal.z + (prng.random() - 0.5) * 0.5
      ).normalize();

      const speed = prng.range(2, 8);
      velocities[i * 3] = dir.x * speed;
      velocities[i * 3 + 1] = dir.y * speed;
      velocities[i * 3 + 2] = dir.z * speed;

      life[i] = prng.range(0.2, 0.5);
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));
    geo.setAttribute('life', new THREE.BufferAttribute(life, 1));

    const mat = new THREE.PointsMaterial({
      color: 0xffaa00,
      size: 0.15,
      transparent: true,
      opacity: 1,
      depthWrite: false,
      sizeAttenuation: true,
    });

    const particles = new THREE.Points(geo, mat);
    this.world.scene.add(particles);

    // Animate and remove
    const animate = (dt) => {
      const positions = particles.geometry.attributes.position;
      const velocities = particles.geometry.attributes.velocity;
      const life = particles.geometry.attributes.life;
      let alive = false;

      for (let i = 0; i < count; i++) {
        if (life.array[i] > 0) {
          alive = true;
          life.array[i] -= dt;
          positions.array[i * 3] += velocities.array[i * 3] * dt;
          positions.array[i * 3 + 1] += velocities.array[i * 3 + 1] * dt;
          positions.array[i * 3 + 2] += velocities.array[i * 3 + 2] * dt;
          velocities.array[i * 3 + 1] -= 20 * dt; // Gravity
        }
      }
      positions.needsUpdate = true;
      life.needsUpdate = true;

      if (alive) {
        requestAnimationFrame(animate);
      } else {
        particles.geometry.dispose();
        particles.material.dispose();
        this.world.scene.remove(particles);
      }
    };
    requestAnimationFrame(animate);
  }

  applyDamage(hitObject, hitPoint, direction, damage) {
    // Find the root object (pedestrian, vehicle, etc.)
    let root = hitObject;
    while (root.parent && !root.userData.isPedestrian && !root.userData.isVehicle && !root.userData.isBuilding) {
      root = root.parent;
    }

    if (root.userData.isPedestrian) {
      const ped = root.userData.pedestrian;
      if (ped) {
        ped.takeDamage(damage, hitPoint, direction);
        this.lastHitTime = performance.now();
      }
    } else if (root.userData.isVehicle) {
      const vehicle = root.userData.vehicle;
      if (vehicle) {
        vehicle.takeDamage(damage, hitPoint, direction);
        // If police vehicle, increase wanted
        if (vehicle.mesh.userData.isPolice && this.world.policeSystem) {
          this.world.policeSystem.reportCrime('hit_police_car', this.player.position, this.player);
        }
        this.lastHitTime = performance.now();
      }
    } else if (root.userData.isBuilding) {
      // Bullet hole decal could go here
      this.createBulletHole(hitPoint, direction);
    }
  }

  createBulletHole(position, normal) {
    const geo = new THREE.CircleGeometry(0.08, 8);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x111111,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const hole = new THREE.Mesh(geo, mat);
    hole.position.copy(position).addScaledVector(normal, 0.02);
    hole.lookAt(position.clone().add(normal));
    hole.rotation.x += Math.PI / 2;
    this.world.scene.add(hole);

    // Remove after some time
    setTimeout(() => {
      hole.geometry.dispose();
      hole.material.dispose();
      this.world.scene.remove(hole);
    }, 60000);
  }

  alertPedestrians(position, radius) {
    this.world.pedestrians.forEach(ped => {
      const dist = ped.position.distanceTo(position);
      if (dist < radius) {
        ped.panicLevel = 1;
        if (ped.state !== 'flee') {
          ped.state = 'flee';
          ped.fleeTarget = ped.calculateFleeTarget(position);
          ped.fleeTimer = prng.range(5, 10);
          ped.maxSpeed = prng.range(4, 6);
        }
      }
    });
  }

  updatePickups(delta) {
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const pickup = this.pickups[i];

      // Bob and spin animation
      pickup.userData.bobOffset += delta * 2;
      pickup.position.y = pickup.userData.respawnData.y + Math.sin(pickup.userData.bobOffset) * 0.3;
      pickup.rotation.y += delta * pickup.userData.spinSpeed;

      // Check player pickup
      if (this.player && !this.player.isInVehicle) {
        const dist = this.player.position.distanceTo(pickup.position);
        if (dist < 1.5) {
          this.collectPickup(pickup);
          this.pickups.splice(i, 1);
          continue;
        }
      }

      // Check if pickup has respawn timer (for collected ones)
      if (pickup.userData.respawnTimer !== undefined) {
        pickup.userData.respawnTimer -= delta;
        if (pickup.userData.respawnTimer <= 0) {
          this.respawnPickup(pickup);
        }
      }
    }
  }

  collectPickup(pickup) {
    const type = pickup.userData.pickupType;
    const spec = PICKUP_TYPES[type];

    switch (type) {
      case 'health':
        this.player.health = Math.min(this.player.maxHealth, this.player.health + spec.amount);
        break;
      case 'armor':
        // Add armor property to player if not exists
        this.player.armor = Math.min(100, (this.player.armor || 0) + spec.amount);
        break;
      case 'pistol_ammo':
        this.ammo = Math.min(WEAPON_STATS.pistol.maxAmmo, this.ammo + spec.amount);
        break;
    }

    // Remove pickup mesh
    this.world.scene.remove(pickup);
    pickup.geometry.dispose();
    pickup.material.dispose();

    // Schedule respawn
    const respawnData = pickup.userData.respawnData;
    setTimeout(() => {
      this.spawnPickup(respawnData);
    }, spec.respawnTime * 1000);
  }

  respawnPickup(oldPickup) {
    const respawnData = oldPickup.userData.respawnData;
    this.spawnPickup(respawnData);
  }

  checkPoliceReturnFire(delta) {
    if (!this.world.policeSystem) return;
    if (this.player.wantedLevel < 3) return;

    const police = [...this.world.policeSystem.policeCars, ...this.world.policeSystem.policeBoats];
    police.forEach(p => {
      if (!p.target || p.target !== this.player) return;

      const dist = p.mesh.position.distanceTo(this.player.position);
      if (dist > 40) return; // Out of range

      // Check line of sight
      const toPlayer = new THREE.Vector3().subVectors(this.player.position, p.mesh.position);
      const ray = new THREE.Raycaster(p.mesh.position.clone().add(new THREE.Vector3(0, 1.5, 0)), toPlayer.normalize());
      ray.far = dist;
      const colliders = this.world.buildings.filter(b => b.userData.isBuilding);
      const hits = ray.intersectObjects(colliders, true);
      if (hits.length > 0) return; // Blocked

      // Police fires at player (simplified - raycast from police)
      if (!p.fireTimer) p.fireTimer = 0;
      p.fireTimer -= delta;

      if (p.fireTimer <= 0) {
        p.fireTimer = 0.8 + prng.random() * 0.5; // Fire rate

        // Calculate hit chance based on distance and player speed
        const hitChance = Math.max(0.1, 0.8 - dist / 50 - (this.player.speed || 0) / 20);
        if (prng.random() < hitChance) {
          // Player takes damage
          const damage = 10 + Math.floor(this.player.wantedLevel * 2);
          this.player.takeDamage(damage);

          // Visual feedback - screen flash, hit marker
          this.showHitMarker();
        }

        // Muzzle flash on police
        this.showPoliceMuzzleFlash(p);
      }
    });
  }

  showPoliceMuzzleFlash(police) {
    // Simple flash at police vehicle front
    const forward = new THREE.Vector3(Math.sin(police.rotation), 0, Math.cos(police.rotation));
    const flashPos = police.mesh.position.clone().addScaledVector(forward, police.type === 'car' ? 2.5 : 4);
    flashPos.y += 1;

    const geo = new THREE.PlaneGeometry(0.4, 0.4);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffee88,
      transparent: true,
      opacity: 1,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const flash = new THREE.Mesh(geo, mat);
    flash.position.copy(flashPos);
    flash.lookAt(this.player.position);
    this.world.scene.add(flash);

    let timer = 0.05;
    const animate = (dt) => {
      timer -= dt;
      flash.material.opacity = timer / 0.05;
      if (timer > 0) {
        requestAnimationFrame(animate);
      } else {
        flash.geometry.dispose();
        flash.material.dispose();
        this.world.scene.remove(flash);
      }
    };
    requestAnimationFrame(animate);
  }

  showHitMarker() {
    // Screen space hit marker - would be rendered in UI
    // For now just log
    console.log('Player hit!');
  }

  // Public API for other systems
  addAmmo(amount) {
    this.ammo = Math.min(WEAPON_STATS.pistol.maxAmmo, this.ammo + amount);
  }

  setWeapon(weaponName) {
    if (WEAPON_STATS[weaponName]) {
      this.weapon = weaponName;
      this.ammoInClip = WEAPON_STATS[weaponName].ammoCapacity;
    }
  }

  getWeaponInfo() {
    return {
      name: this.weapon,
      ammoInClip: this.ammoInClip,
      ammo: this.ammo,
      maxAmmo: WEAPON_STATS.pistol.maxAmmo,
      isArmed: this.isArmed,
      isReloading: this.isReloading,
    };
  }

  dispose() {
    if (this.muzzleFlash) {
      this.muzzleFlash.geometry.dispose();
      this.muzzleFlash.material.dispose();
      this.world.scene.remove(this.muzzleFlash);
    }
    if (this.tracerMesh) {
      this.tracerMesh.geometry.dispose();
      this.tracerMesh.material.dispose();
      this.world.scene.remove(this.tracerMesh);
    }
    this.pickups.forEach(p => {
      p.geometry.dispose();
      p.material.dispose();
      this.world.scene.remove(p);
    });
    this.pickups = [];
  }
}

export function createCombatSystem(world, player, input) {
  return new CombatSystem(world, player, input);
}

// Add takeDamage to Pedestrian prototype (will be called from people.js)
Pedestrian.prototype.takeDamage = function(amount, hitPoint, direction) {
  this.health = (this.health || 100) - amount;
  if (this.health <= 0) {
    this.die();
  } else {
    // Flinch / stagger
    this.velocity.addScaledVector(direction, 5);
  }
};

Pedestrian.prototype.die = function() {
  // Ragdoll would go here - for now just remove
  this.world.pedestrianSystem.removePedestrian(this);
};

// Add takeDamage to Vehicle prototype
Vehicle.prototype.takeDamage = function(amount, hitPoint, direction) {
  this.health = (this.health || 100) - amount;
  if (this.health <= 0) {
    this.explode();
  }
};

Vehicle.prototype.explode = function() {
  // Explosion effect
  const geo = new THREE.SphereGeometry(5, 16, 16);
  const mat = new THREE.MeshBasicMaterial({
    color: 0xff4400,
    transparent: true,
    opacity: 0.8,
    depthWrite: false,
  });
  const explosion = new THREE.Mesh(geo, mat);
  explosion.position.copy(this.mesh.position);
  this.world.scene.add(explosion);

  let scale = 1;
  let opacity = 0.8;
  const animate = (dt) => {
    scale += dt * 10;
    opacity -= dt * 2;
    explosion.scale.setScalar(scale);
    explosion.material.opacity = opacity;
    if (opacity > 0) {
      requestAnimationFrame(animate);
    } else {
      explosion.geometry.dispose();
      explosion.material.dispose();
      this.world.scene.remove(explosion);
    }
  };
  requestAnimationFrame(animate);

  // Remove vehicle
  if (this.world.traffic) {
    if (this.type === 'car') {
      this.world.traffic.removeCar(this);
    } else {
      this.world.traffic.removeBoat(this);
    }
  }
};

// Boat uses same explode logic
Boat.prototype.takeDamage = Vehicle.prototype.takeDamage;
Boat.prototype.explode = Vehicle.prototype.explode;