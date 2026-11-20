// MONSOON ISLES - Player System
// Third-person character with articulated low-poly figure, WASD movement, camera, collision
import * as THREE from 'three';
import { prng } from './prng.js';
export class Player {
  constructor(world, camera, input) {
    this.world = world;
    this.camera = camera;
    this.input = input;
    
    // State
    this.position = new THREE.Vector3();
    this.velocity = new THREE.Vector3();
    this.rotation = 0; // Y rotation (facing direction)
    this.targetRotation = 0;
    this.speed = 0;
    this.isSprinting = false;
    this.isJumping = false;
    this.isInVehicle = false;
    this.vehicle = null;
    this.health = 100;
    this.maxHealth = 100;
    this.stamina = 100;
    this.maxStamina = 100;
    this.money = 0;
    this.wantedLevel = 0;
    this.wantedTimer = 0;
    
    // Movement constants
    this.walkSpeed = 5;
    this.runSpeed = 12;
    this.jumpForce = 14;
    this.gravity = 30;
    this.turnSpeed = 8;
    this.cameraDistance = 5;
    this.cameraHeight = 3;
    this.cameraTargetHeight = 1.5;
    
    // Camera orbit
    this.cameraAngleH = 0; // Horizontal orbit
    this.cameraAngleV = 0.3; // Vertical orbit
    this.cameraMinV = -0.5;
    this.cameraMaxV = 1.2;
    
    // Animation
    this.walkCycle = 0;
    this.armSwing = 0;
    this.legSwing = 0;
    this.bodyBob = 0;
    
    // Collision
    this.capsuleRadius = 0.4;
    this.capsuleHeight = 1.8;
    this.capsuleHalfHeight = this.capsuleHeight / 2;
    
    // Create character mesh
    this.createCharacter();
    
    // Initialize position
    const spawn = world.getPlayerSpawn();
    this.position.copy(spawn);
    this.mesh.position.copy(this.position);
  }
  
  createCharacter() {
    this.mesh = new THREE.Group();
    this.mesh.userData.isPlayer = true;
    
    // Materials
    const skinMat = new THREE.MeshStandardMaterial({ 
      color: 0xffdbac, 
      roughness: 0.8, 
      metalness: 0 
    });
    const shirtMat = new THREE.MeshStandardMaterial({ 
      color: 0x2244aa, 
      roughness: 0.9 
    });
    const pantsMat = new THREE.MeshStandardMaterial({ 
      color: 0x1a1a2e, 
      roughness: 0.95 
    });
    const shoeMat = new THREE.MeshStandardMaterial({ 
      color: 0x111111, 
      roughness: 0.7,
      metalness: 0.2
    });
    const hairMat = new THREE.MeshStandardMaterial({ 
      color: 0x3d2314, 
      roughness: 0.9 
    });
    
    // Torso
    this.torso = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.7, 0.25),
      shirtMat
    );
    this.torso.position.y = 1.15;
    this.torso.castShadow = true;
    this.mesh.add(this.torso);
    
    // Hips
    this.hips = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.3, 0.25),
      pantsMat
    );
    this.hips.position.y = 0.8;
    this.hips.castShadow = true;
    this.mesh.add(this.hips);
    
    // Head
    this.head = new THREE.Mesh(
      new THREE.BoxGeometry(0.25, 0.25, 0.25),
      skinMat
    );
    this.head.position.y = 1.65;
    this.head.castShadow = true;
    this.mesh.add(this.head);
    
    // Hair
    this.hair = new THREE.Mesh(
      new THREE.BoxGeometry(0.27, 0.12, 0.27),
      hairMat
    );
    this.hair.position.y = 1.8;
    this.mesh.add(this.hair);
    
    // Arms
    this.armL = this.createArm(skinMat, shirtMat, true);
    this.armR = this.createArm(skinMat, shirtMat, false);
    this.mesh.add(this.armL);
    this.mesh.add(this.armR);
    
    // Legs
    this.legL = this.createLeg(pantsMat, shoeMat, true);
    this.legR = this.createLeg(pantsMat, shoeMat, false);
    this.mesh.add(this.legL);
    this.mesh.add(this.legR);
    
    // Store original positions for animation
    this.armL.userData.basePos = this.armL.position.clone();
    this.armR.userData.basePos = this.armR.position.clone();
    this.legL.userData.basePos = this.legL.position.clone();
    this.legR.userData.basePos = this.legR.position.clone();
    this.torso.userData.basePos = this.torso.position.clone();
    this.hips.userData.basePos = this.hips.position.clone();
    this.head.userData.basePos = this.head.position.clone();
    this.hair.userData.basePos = this.hair.position.clone();
  }
  
  createArm(skinMat, shirtMat, isLeft) {
    const group = new THREE.Group();
    const sign = isLeft ? 1 : -1;
    
    // Upper arm
    const upperArm = new THREE.Mesh(
      new THREE.BoxGeometry(0.15, 0.35, 0.15),
      shirtMat
    );
    upperArm.position.set(sign * 0.32, 1.15, 0);
    upperArm.castShadow = true;
    group.add(upperArm);
    group.userData.upperArm = upperArm;
    group.userData.upperArmBase = upperArm.position.clone();
    
    // Lower arm
    const lowerArm = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.3, 0.12),
      skinMat
    );
    lowerArm.position.set(sign * 0.32, 0.75, 0);
    lowerArm.castShadow = true;
    group.add(lowerArm);
    group.userData.lowerArm = lowerArm;
    group.userData.lowerArmBase = lowerArm.position.clone();
    
    // Hand
    const hand = new THREE.Mesh(
      new THREE.BoxGeometry(0.13, 0.1, 0.13),
      skinMat
    );
    hand.position.set(sign * 0.32, 0.45, 0);
    hand.castShadow = true;
    group.add(hand);
    group.userData.hand = hand;
    
    group.position.set(0, 0, 0);
    return group;
  }
  
  createLeg(pantsMat, shoeMat, isLeft) {
    const group = new THREE.Group();
    const sign = isLeft ? 1 : -1;
    
    // Thigh
    const thigh = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.4, 0.18),
      pantsMat
    );
    thigh.position.set(sign * 0.15, 0.6, 0);
    thigh.castShadow = true;
    group.add(thigh);
    group.userData.thigh = thigh;
    group.userData.thighBase = thigh.position.clone();
    
    // Calf
    const calf = new THREE.Mesh(
      new THREE.BoxGeometry(0.15, 0.4, 0.15),
      pantsMat
    );
    calf.position.set(sign * 0.15, 0.15, 0);
    calf.castShadow = true;
    group.add(calf);
    group.userData.calf = calf;
    group.userData.calfBase = calf.position.clone();
    
    // Foot
    const foot = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 0.1, 0.35),
      shoeMat
    );
    foot.position.set(sign * 0.15, -0.15, 0.1);
    foot.castShadow = true;
    group.add(foot);
    group.userData.foot = foot;
    
    group.position.set(0, 0, 0);
    return group;
  }
  
  update(delta) {
    if (this.isInVehicle) {
      this.updateInVehicle(delta);
      return;
    }
    
    this.handleInput(delta);
    this.applyPhysics(delta);
    this.handleCollisions();
    this.updateAnimation(delta);
    this.updateCamera(delta);
    this.updateWanted(delta);
    this.regenerateStamina(delta);
  }
  
  handleInput(delta) {
    // Movement input relative to camera
    const forward = new THREE.Vector3();
    this.camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();
    
    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0));
    
    let moveX = 0, moveZ = 0;
    
    if (this.input.keys.KeyW) moveZ -= 1;
    if (this.input.keys.KeyS) moveZ += 1;
    if (this.input.keys.KeyA) moveX -= 1;
    if (this.input.keys.KeyD) moveX += 1;
    
    const moveDir = new THREE.Vector3();
    moveDir.addScaledVector(right, moveX);
    moveDir.addScaledVector(forward, moveZ);
    
    if (moveDir.lengthSq() > 0) {
      moveDir.normalize();
      this.targetRotation = Math.atan2(moveDir.x, moveDir.z);
      
      // Smooth rotation
      let diff = this.targetRotation - this.rotation;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.rotation += diff * Math.min(this.turnSpeed * delta, 1);
      
      // Speed
      this.isSprinting = this.input.keys.ShiftLeft && this.stamina > 10 && moveZ < 0;
      const maxSpeed = this.isSprinting ? this.runSpeed : this.walkSpeed;
      this.speed = THREE.MathUtils.lerp(this.speed, maxSpeed, delta * 10);
      
      // Apply velocity
      this.velocity.x = Math.sin(this.rotation) * this.speed;
      this.velocity.z = Math.cos(this.rotation) * this.speed;
      
      // Drain stamina when sprinting
      if (this.isSprinting) {
        this.stamina = Math.max(0, this.stamina - delta * 15);
      }
    } else {
      this.speed = THREE.MathUtils.lerp(this.speed, 0, delta * 8);
      this.velocity.x *= 0.9;
      this.velocity.z *= 0.9;
    }
    
    // Jump
    if (this.input.keys.Space && !this.isJumping && this.canJump()) {
      this.velocity.y = this.jumpForce;
      this.isJumping = true;
    }
    
    // Enter vehicle
    if (this.input.keys.KeyE && !this.input.prevKeys.KeyE) {
      this.tryEnterVehicle();
    }
    
    // Camera orbit with mouse
    if (this.input.pointerLocked) {
      this.cameraAngleH -= this.input.mouseDelta.x * 0.002;
      this.cameraAngleV = THREE.MathUtils.clamp(
        this.cameraAngleV - this.input.mouseDelta.y * 0.002,
        this.cameraMinV, this.cameraMaxV
      );
      this.input.mouseDelta.set(0, 0);
    }
  }
  
  canJump() {
    // Raycast down to check ground
    const ray = new THREE.Raycaster(
      this.position.clone().add(new THREE.Vector3(0, 0.2, 0)),
      new THREE.Vector3(0, -1, 0),
      0, 0.4
    );
    const colliders = this.getColliders();
    const hits = ray.intersectObjects(colliders, true);
    return hits.length > 0;
  }
  
  applyPhysics(delta) {
    // Gravity
    this.velocity.y -= this.gravity * delta;
    
    // Apply velocity
    this.position.addScaledVector(this.velocity, delta);
    
    // Ground clamp
    const groundY = this.world.getGroundHeight(this.position.x, this.position.z);
    if (this.position.y < groundY + this.capsuleHalfHeight) {
      this.position.y = groundY + this.capsuleHalfHeight;
      this.velocity.y = 0;
      this.isJumping = false;
    }
    
    // Update mesh position
    this.mesh.position.copy(this.position);
    this.mesh.rotation.y = this.rotation;
  }
  
  handleCollisions() {
    // Simple AABB push-out against buildings
    const colliders = this.getColliders();
    
    for (const building of this.world.buildings) {
      if (!building.userData.isBuilding) continue;
      
      const bw = building.userData.width / 2 + this.capsuleRadius;
      const bd = building.userData.depth / 2 + this.capsuleRadius;
      const bx = building.position.x;
      const bz = building.position.z;
      
      // Check XZ overlap
      if (Math.abs(this.position.x - bx) < bw && Math.abs(this.position.z - bz) < bd) {
        // Push out
        const dx = this.position.x - bx;
        const dz = this.position.z - bz;
        
        const overlapX = bw - Math.abs(dx);
        const overlapZ = bd - Math.abs(dz);
        
        if (overlapX < overlapZ) {
          this.position.x += dx > 0 ? overlapX : -overlapX;
        } else {
          this.position.z += dz > 0 ? overlapZ : -overlapZ;
        }
        
        this.velocity.x = 0;
        this.velocity.z = 0;
      }
    }
    
    // Keep in world bounds
    const margin = 50;
    const limit = WORLD_SIZE - margin;
    this.position.x = THREE.MathUtils.clamp(this.position.x, -limit, limit);
    this.position.z = THREE.MathUtils.clamp(this.position.z, -limit, limit);
  }
  
  getColliders() {
    const colliders = [];
    this.world.buildings.forEach(b => {
      if (b.userData.isBuilding) colliders.push(b);
    });
    return colliders;
  }
  
  updateAnimation(delta) {
    if (this.speed > 0.5) {
      this.walkCycle += delta * (this.isSprinting ? 12 : 8);
      
      const swing = Math.sin(this.walkCycle) * 0.8;
      const swing2 = Math.sin(this.walkCycle + Math.PI) * 0.8;
      const bob = Math.abs(Math.sin(this.walkCycle * 0.5)) * 0.05;
      
      // Arms
      if (this.armL.userData.upperArm) {
        this.armL.userData.upperArm.rotation.x = swing;
        this.armR.userData.upperArm.rotation.x = swing2;
      }
      if (this.armL.userData.lowerArm) {
        this.armL.userData.lowerArm.rotation.x = swing * 0.5;
        this.armR.userData.lowerArm.rotation.x = swing2 * 0.5;
      }
      
      // Legs
      if (this.legL.userData.thigh) {
        this.legL.userData.thigh.rotation.x = swing2 * 0.8;
        this.legR.userData.thigh.rotation.x = swing * 0.8;
      }
      if (this.legL.userData.calf) {
        this.legL.userData.calf.rotation.x = Math.max(0, -swing2 * 0.5);
        this.legR.userData.calf.rotation.x = Math.max(0, -swing * 0.5);
      }
      
      // Body bob
      this.torso.position.y = this.torso.userData.basePos.y + bob;
      this.hips.position.y = this.hips.userData.basePos.y + bob * 0.5;
      this.head.position.y = this.head.userData.basePos.y + bob * 0.3;
      this.hair.position.y = this.hair.userData.basePos.y + bob * 0.3;
    } else {
      // Return to idle
      const lerp = delta * 8;
      this.lerpRotation(this.armL.userData.upperArm, 'x', 0, lerp);
      this.lerpRotation(this.armR.userData.upperArm, 'x', 0, lerp);
      this.lerpRotation(this.armL.userData.lowerArm, 'x', 0, lerp);
      this.lerpRotation(this.armR.userData.lowerArm, 'x', 0, lerp);
      this.lerpRotation(this.legL.userData.thigh, 'x', 0, lerp);
      this.lerpRotation(this.legR.userData.thigh, 'x', 0, lerp);
      this.lerpRotation(this.legL.userData.calf, 'x', 0, lerp);
      this.lerpRotation(this.legR.userData.calf, 'x', 0, lerp);
      
      this.torso.position.y = THREE.MathUtils.lerp(this.torso.position.y, this.torso.userData.basePos.y, lerp);
      this.hips.position.y = THREE.MathUtils.lerp(this.hips.position.y, this.hips.userData.basePos.y, lerp);
      this.head.position.y = THREE.MathUtils.lerp(this.head.position.y, this.head.userData.basePos.y, lerp);
      this.hair.position.y = THREE.MathUtils.lerp(this.hair.position.y, this.hair.userData.basePos.y, lerp);
    }
    
    // Head follows camera slightly
    this.head.rotation.y = THREE.MathUtils.lerp(this.head.rotation.y, (this.cameraAngleH - this.rotation) * 0.3, delta * 5);
  }
  
  lerpRotation(obj, axis, target, speed) {
    if (!obj) return;
    obj.rotation[axis] = THREE.MathUtils.lerp(obj.rotation[axis], target, speed);
  }
  
  updateCamera(delta) {
    // Calculate camera target (player position + offset)
    const target = this.position.clone();
    target.y += this.cameraTargetHeight;
    
    // Camera offset based on orbit angles
    const horizontalDist = this.cameraDistance * Math.cos(this.cameraAngleV);
    const verticalOffset = this.cameraDistance * Math.sin(this.cameraAngleV);
    
    const camX = target.x - Math.sin(this.rotation + this.cameraAngleH) * horizontalDist;
    const camZ = target.z - Math.cos(this.rotation + this.cameraAngleH) * horizontalDist;
    const camY = target.y + verticalOffset + this.cameraHeight;
    
    // Smooth camera movement
    this.camera.position.lerp(new THREE.Vector3(camX, camY, camZ), delta * 10);
    this.camera.lookAt(target);
    
    // Prevent camera clipping through walls
    this.preventCameraClipping(target);
  }
  
  preventCameraClipping(target) {
    const ray = new THREE.Raycaster(target, new THREE.Vector3().subVectors(this.camera.position, target).normalize());
    ray.far = this.camera.position.distanceTo(target);
    const colliders = this.getColliders();
    const hits = ray.intersectObjects(colliders, true);
    
    if (hits.length > 0) {
      this.camera.position.copy(hits[0].point);
      this.camera.position.addScaledVector(ray.ray.direction, 0.2);
    }
  }
  
  updateInVehicle(delta) {
    if (!this.vehicle) return;
    
    // Position player at vehicle seat
    const seatOffset = this.vehicle.getSeatOffset();
    this.position.copy(this.vehicle.mesh.position).add(seatOffset);
    this.mesh.position.copy(this.position);
    this.mesh.rotation.y = this.vehicle.mesh.rotation.y;
    
    // Hide character mesh
    this.mesh.visible = false;
    
    // Exit vehicle
    if (this.input.keys.KeyE && !this.input.prevKeys.KeyE) {
      this.exitVehicle();
    }
  }
  
  tryEnterVehicle() {
    // Find nearby vehicle
    const range = 3;
    let closest = null;
    let closestDist = range;
    
    // Check cars
    this.world.vehicles.forEach(v => {
      if (v.type === 'car' && !v.driver) {
        const d = this.position.distanceTo(v.mesh.position);
        if (d < closestDist) {
          closestDist = d;
          closest = v;
        }
      }
    });
    
    // Check boats
    this.world.boats.forEach(b => {
      if (!b.driver) {
        const d = this.position.distanceTo(b.mesh.position);
        if (d < closestDist) {
          closestDist = d;
          closest = b;
        }
      }
    });
    
    if (closest) {
      this.enterVehicle(closest);
    }
  }
  
  enterVehicle(vehicle) {
    this.isInVehicle = true;
    this.vehicle = vehicle;
    vehicle.driver = this;
    
    vehicle.enter(this);
    // Switch camera to vehicle camera
    this.cameraAngleH = 0;
    this.cameraAngleV = 0.3;
  }
  
  exitVehicle() {
    if (!this.vehicle) return;
    
    const exitPos = this.vehicle.getExitPosition();
    this.position.copy(exitPos);
    this.mesh.position.copy(this.position);
    this.mesh.visible = true;
    
    this.vehicle.driver = null;
    this.vehicle.exit(this);
    this.vehicle = null;
    this.isInVehicle = false;
  }
  
  updateWanted(delta) {
    if (this.wantedLevel > 0) {
      this.wantedTimer -= delta;
      if (this.wantedTimer <= 0) {
        this.wantedLevel = Math.max(0, this.wantedLevel - 1);
        this.wantedTimer = 30; // 30 seconds per star decay
      }
    }
  }
  
  regenerateStamina(delta) {
    if (!this.isSprinting && this.stamina < this.maxStamina) {
      this.stamina = Math.min(this.maxStamina, this.stamina + delta * 10);
    }
  }
  
  takeDamage(amount) {
    this.health = Math.max(0, this.health - amount);
    if (this.health <= 0) {
      this.die();
    }
  }
  
  die() {
    // Respawn
    this.health = this.maxHealth;
    this.stamina = this.maxStamina;
    this.wantedLevel = 0;
    this.money = Math.floor(this.money * 0.5);
    const spawn = this.world.getPlayerSpawn();
    this.position.copy(spawn);
    this.velocity.set(0, 0, 0);
    this.mesh.position.copy(this.position);
  }
  
  addMoney(amount) {
    this.money += amount;
  }
  
  addWanted(level) {
    this.wantedLevel = Math.min(5, this.wantedLevel + level);
    this.wantedTimer = 30;
  }
  
  // Getters for HUD
  getHealthPercent() { return this.health / this.maxHealth; }
  getStaminaPercent() { return this.stamina / this.maxStamina; }
}
// Need WORLD_SIZE from world.js
const WORLD_SIZE = 2000;
