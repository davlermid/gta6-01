//
// MONSOON ISLES - Vehicles System
// Cars, boats, traffic AI, enter/exit, arcade driving
//

import * as THREE from 'three';
import { prng } from './prng.js';

const VEHICLE_TYPES = {
  SEDAN: { color: 0xcc2222, width: 1.8, length: 4.2, height: 1.3, mass: 1200, maxSpeed: 35, acceleration: 25 },
  PICKUP: { color: 0x2244cc, width: 1.9, length: 5.0, height: 1.6, mass: 1800, maxSpeed: 30, acceleration: 20 },
  SPORTS: { color: 0xffcc00, width: 1.8, length: 4.0, height: 1.1, mass: 1100, maxSpeed: 50, acceleration: 40 },
  VAN: { color: 0xffffff, width: 2.0, length: 4.8, height: 2.0, mass: 2000, maxSpeed: 28, acceleration: 18 },
};

export class Vehicle {
  constructor(world, type, x, z, angle) {
    this.world = world;
    this.type = type;
    this.specs = VEHICLE_TYPES[type] || VEHICLE_TYPES.SEDAN;
    this.mesh = new THREE.Group();
    this.mesh.userData.isVehicle = true;
    this.mesh.userData.vehicle = this;

    this.position = new THREE.Vector3(x, 0, z);
    this.rotation = angle;
    this.velocity = new THREE.Vector3();
    this.speed = 0;
    this.maxSpeed = this.specs.maxSpeed;
    this.acceleration = this.specs.acceleration;
    this.brakeForce = 15;
    this.handbrakeForce = 8;
    this.steerAngle = 0;
    this.maxSteerAngle = Math.PI / 4;
    this.steerSpeed = 3;
    this.drag = 0.02;
    this.mass = this.specs.mass;

    this.driver = null;
    this.isPlayer = false;
    this.engineRPM = 0;
    this.gear = 1;
    this.gears = [0, 12, 25, 40, 55, 70]; // km/h per gear

    // AI
    this.isAI = false;
    this.aiState = 'drive';
    this.aiTarget = null;
    this.aiPath = [];
    this.aiPathIndex = 0;
    this.aiTimer = 0;
    this.hornTimer = 0;

    this.createMesh();
    this.mesh.position.copy(this.position);
    this.mesh.rotation.y = this.rotation;
    this.world.scene.add(this.mesh);
  }

  createMesh() {
    const { width, length, height } = this.specs;
    const bodyColor = this.specs.color;
    const darkColor = new THREE.Color(bodyColor).multiplyScalar(0.4).getHex();
    const glassColor = 0x223344;
    const chromeColor = 0xcccccc;
    const tireColor = 0x111111;
    const rimColor = 0x888888;
    const lightColor = 0xffffee;
    const brakeColor = 0xcc0000;
    const reverseColor = 0xffffff;

    const bodyMat = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.4, metalness: 0.6 });
    const darkMat = new THREE.MeshStandardMaterial({ color: darkColor, roughness: 0.5, metalness: 0.4 });
    const glassMat = new THREE.MeshStandardMaterial({ color: glassColor, roughness: 0.1, metalness: 0.9, transparent: true, opacity: 0.6 });
    const chromeMat = new THREE.MeshStandardMaterial({ color: chromeColor, roughness: 0.1, metalness: 1 });
    const tireMat = new THREE.MeshStandardMaterial({ color: tireColor, roughness: 0.9 });
    const rimMat = new THREE.MeshStandardMaterial({ color: rimColor, roughness: 0.3, metalness: 0.7 });
    const lightMat = new THREE.MeshBasicMaterial({ color: lightColor, transparent: true, opacity: 0 });
    const brakeMat = new THREE.MeshBasicMaterial({ color: brakeColor, transparent: true, opacity: 0 });
    const reverseMat = new THREE.MeshBasicMaterial({ color: reverseColor, transparent: true, opacity: 0 });

    // Chassis
    const chassisGeo = new THREE.BoxGeometry(width * 0.9, 0.3, length * 0.9);
    const chassis = new THREE.Mesh(chassisGeo, darkMat);
    chassis.position.y = 0.35;
    chassis.castShadow = true;
    this.mesh.add(chassis);
    this.chassis = chassis;

    // Body
    const bodyGeo = new THREE.BoxGeometry(width, height, length * 0.7);
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.35 + height / 2;
    body.castShadow = true;
    this.mesh.add(body);
    this.body = body;

    // Cabin (roof + windows)
    const cabinGeo = new THREE.BoxGeometry(width * 0.85, height * 0.6, length * 0.35);
    const cabin = new THREE.Mesh(cabinGeo, bodyMat);
    cabin.position.y = 0.35 + height + cabinGeo.parameters.height / 2;
    cabin.castShadow = true;
    this.mesh.add(cabin);
    this.cabin = cabin;

    // Windows
    const windowGeo = new THREE.BoxGeometry(width * 0.82, height * 0.5, length * 0.33);
    const windows = new THREE.Mesh(windowGeo, glassMat);
    windows.position.y = cabin.position.y;
    windows.castShadow = true;
    this.mesh.add(windows);
    this.windows = windows;

    // Windshield (front)
    const wsGeo = new THREE.BoxGeometry(width * 0.82, height * 0.5, 0.1);
    const windshield = new THREE.Mesh(wsGeo, glassMat);
    windshield.position.set(0, cabin.position.y, length * 0.35);
    this.mesh.add(windshield);

    // Rear window
    const rwGeo = new THREE.BoxGeometry(width * 0.82, height * 0.5, 0.1);
    const rearWindow = new THREE.Mesh(rwGeo, glassMat);
    rearWindow.position.set(0, cabin.position.y, -length * 0.35);
    this.mesh.add(rearWindow);

    // Wheels
    this.wheels = [];
    const wheelPositions = [
      { x: width/2 + 0.1, z: length/2 - 0.4 },   // FL
      { x: -width/2 - 0.1, z: length/2 - 0.4 },  // FR
      { x: width/2 + 0.1, z: -length/2 + 0.4 },  // RL
      { x: -width/2 - 0.1, z: -length/2 + 0.4 }, // RR
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
      wheel.userData.isLeft = i % 2 === 0;
      wheel.userData.tire = tire;
      wheel.userData.rim = rim;
      wheel.userData.rotation = 0;
      wheel.userData.steerAngle = 0;

      this.mesh.add(wheel);
      this.wheels.push(wheel);
    });

    // Lights
    this.headlights = [];
    this.brakeLights = [];
    this.reverseLights = [];

    // Front lights
    for (let i = 0; i < 2; i++) {
      const sign = i === 0 ? 1 : -1;
      const hlGeo = new THREE.BoxGeometry(0.3, 0.15, 0.1);
      const hl = new THREE.Mesh(hlGeo, lightMat);
      hl.position.set(sign * (width/2 - 0.15), 0.6, length/2);
      this.mesh.add(hl);
      this.headlights.push(hl);

      // Point light
      const pl = new THREE.PointLight(lightColor, 0, 30, 2);
      pl.position.copy(hl.position);
      pl.position.z += 0.5;
      this.mesh.add(pl);
      hl.userData.pointLight = pl;
    }

    // Rear lights
    for (let i = 0; i < 2; i++) {
      const sign = i === 0 ? 1 : -1;

      // Brake light
      const blGeo = new THREE.BoxGeometry(0.25, 0.2, 0.1);
      const bl = new THREE.Mesh(blGeo, brakeMat);
      bl.position.set(sign * (width/2 - 0.15), 0.6, -length/2);
      this.mesh.add(bl);
      this.brakeLights.push(bl);

      // Reverse light
      const rlGeo = new THREE.BoxGeometry(0.15, 0.15, 0.1);
      const rl = new THREE.Mesh(rlGeo, reverseMat);
      rl.position.set(sign * (width/2 - 0.45), 0.5, -length/2);
      this.mesh.add(rl);
      this.reverseLights.push(rl);
    }

    // Exhaust
    const exhaustGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.4, 8);
    const exhaust = new THREE.Mesh(exhaustGeo, chromeMat);
    exhaust.position.set(-width/2 + 0.2, 0.3, -length/2 + 0.2);
    exhaust.rotation.x = -Math.PI / 6;
    this.mesh.add(exhaust);
    this.exhaust = exhaust;
  }

  getSeatOffset() {
    return new THREE.Vector3(0.7, 0.9, 0.5);
  }

  getExitPosition() {
    const offset = new THREE.Vector3(this.specs.width / 2 + 1, 0.5, 0);
    offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.rotation);
    return this.mesh.position.clone().add(offset);
  }

  enter(driver) {
    this.driver = driver;
    this.isPlayer = driver.isPlayer || false;
  }

  exit(driver) {
    this.driver = null;
    this.isPlayer = false;
  }

  update(delta, input) {
    if (this.isPlayer && input) {
      this.handlePlayerInput(delta, input);
    } else if (this.isAI) {
      this.updateAI(delta);
    }

    this.applyPhysics(delta);
    this.updateWheels(delta);
    this.updateLights();
    this.updateEngineSound(delta);
  }

  handlePlayerInput(delta, input) {
    let throttle = 0;
    let brake = 0;
    let handbrake = false;
    let steer = 0;

    if (input.keys.KeyW) throttle = 1;
    if (input.keys.KeyS) brake = 1;
    if (input.keys.Space) handbrake = true;
    if (input.keys.KeyA) steer = -1;
    if (input.keys.KeyD) steer = 1;

    // Steering
    const targetSteer = steer * this.maxSteerAngle * (1 - Math.abs(this.speed) / this.maxSpeed * 0.5);
    this.steerAngle = THREE.MathUtils.lerp(this.steerAngle, targetSteer, delta * this.steerSpeed);

    // Throttle/Brake
    if (throttle > 0) {
      const accel = this.acceleration * throttle;
      this.speed += accel * delta;
      if (this.speed > this.maxSpeed) this.speed = this.maxSpeed;
    }

    if (brake > 0) {
      const decel = this.brakeForce * brake;
      this.speed -= decel * delta;
      if (this.speed < -this.maxSpeed * 0.3) this.speed = -this.maxSpeed * 0.3;
    }

    // Handbrake
    if (handbrake && Math.abs(this.speed) > 1) {
      this.speed -= this.handbrakeForce * delta * Math.sign(this.speed);
      this.steerAngle *= 1.5;
    }

    // Natural deceleration
    if (throttle === 0 && brake === 0) {
      this.speed -= this.speed * this.drag * delta;
      if (Math.abs(this.speed) < 0.1) this.speed = 0;
    }

    // Engine RPM
    this.engineRPM = Math.abs(this.speed) / this.maxSpeed * 6000 + 800;
  }

  updateAI(delta) {
    this.aiTimer += delta;

    // Simple AI: follow road network
    if (!this.aiTarget || this.aiTimer > 10) {
      this.pickNewTarget();
      this.aiTimer = 0;
    }

    if (this.aiTarget) {
      const toTarget = new THREE.Vector2(this.aiTarget.x - this.mesh.position.x, this.aiTarget.y - this.mesh.position.z);
      const dist = toTarget.length();

      if (dist < 5) {
        this.pickNewTarget();
        return;
      }

      const targetAngle = Math.atan2(toTarget.x, toTarget.y);
      let diff = targetAngle - this.rotation;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;

      // Steer towards target
      const steer = THREE.MathUtils.clamp(diff * 2, -1, 1);
      const targetSteer = steer * this.maxSteerAngle;
      this.steerAngle = THREE.MathUtils.lerp(this.steerAngle, targetSteer, delta * this.steerSpeed);

      // Throttle
      const speedTarget = this.maxSpeed * 0.7;
      if (this.speed < speedTarget) {
        this.speed += this.acceleration * 0.5 * delta;
      } else if (this.speed > speedTarget) {
        this.speed -= this.brakeForce * 0.3 * delta;
      }

      // Random honking
      if (this.hornTimer <= 0 && prng.chance(0.001)) {
        this.hornTimer = 0.5;
        // Could play sound here
      }
      this.hornTimer -= delta;
    }
  }

  pickNewTarget() {
    // Pick a random road node
    const nodes = this.world.roadNodes;
    if (nodes.length > 0) {
      const node = prng.choice(nodes);
      this.aiTarget = node.pos.clone();
    }
  }

  applyPhysics(delta) {
    // Calculate forward vector
    const forward = new THREE.Vector3(
      Math.sin(this.rotation),
      0,
      Math.cos(this.rotation)
    );

    // Apply velocity
    this.velocity.copy(forward).multiplyScalar(this.speed);

    // Steering affects rotation
    if (Math.abs(this.speed) > 0.5) {
      const turnRate = this.steerAngle * (this.speed / this.maxSpeed) * 2;
      this.rotation += turnRate * delta;
    }

    // Update position
    this.mesh.position.addScaledVector(this.velocity, delta);
    this.mesh.rotation.y = this.rotation;

    // Ground height
    const groundY = this.world.getGroundHeight(this.mesh.position.x, this.mesh.position.z);
    this.mesh.position.y = groundY + 0.35;

    // Keep in bounds
    const limit = 1900;
    this.mesh.position.x = THREE.MathUtils.clamp(this.mesh.position.x, -limit, limit);
    this.mesh.position.z = THREE.MathUtils.clamp(this.mesh.position.z, -limit, limit);
  }

  updateWheels(delta) {
    this.wheels.forEach(wheel => {
      // Spin
      wheel.userData.rotation += this.speed * delta * 5;
      wheel.userData.tire.rotation.x = wheel.userData.rotation;
      wheel.userData.rim.rotation.x = wheel.userData.rotation;

      // Steering (front wheels only)
      if (wheel.userData.isFront) {
        wheel.userData.steerAngle = THREE.MathUtils.lerp(wheel.userData.steerAngle, this.steerAngle, delta * 10);
        wheel.rotation.y = wheel.userData.steerAngle;
      }

      // Suspension (simple)
      const groundY = this.world.getGroundHeight(
        this.mesh.position.x + Math.sin(this.rotation) * wheel.position.x + Math.cos(this.rotation) * wheel.position.z,
        this.mesh.position.z + Math.cos(this.rotation) * wheel.position.x - Math.sin(this.rotation) * wheel.position.z
      );
      const targetY = groundY + 0.35;
      wheel.position.y = THREE.MathUtils.lerp(wheel.position.y, targetY, delta * 15);
    });
  }

  updateLights() {
    // Headlights always on at night or in tunnels
    const isNight = this.world.isNight;
    const headlightOn = isNight || this.world.weather !== 'clear';

    this.headlights.forEach(hl => {
      hl.material.opacity = headlightOn ? 1 : 0;
      hl.userData.pointLight.intensity = headlightOn ? 2 : 0;
    });

    // Brake lights
    const braking = this.speed > 0 && (this.isPlayer ? false : this.speed > this.maxSpeed * 0.8); // Simplified
    this.brakeLights.forEach(bl => {
      bl.material.opacity = braking ? 1 : 0.1;
    });

    // Reverse lights
    const reversing = this.speed < -0.5;
    this.reverseLights.forEach(rl => {
      rl.material.opacity = reversing ? 1 : 0;
    });
  }

  updateEngineSound(delta) {
    // Placeholder for engine sound
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

export class Boat {
  constructor(world, type, x, z, angle) {
    this.world = world;
    this.type = type;
    this.specs = BOAT_TYPES[type] || BOAT_TYPES.SPEEDBOAT;
    this.mesh = new THREE.Group();
    this.mesh.userData.isVehicle = true;
    this.mesh.userData.isBoat = true;
    this.mesh.userData.vehicle = this;

    this.position = new THREE.Vector3(x, 0, z);
    this.rotation = angle;
    this.velocity = new THREE.Vector3();
    this.speed = 0;
    this.maxSpeed = this.specs.maxSpeed;
    this.acceleration = this.specs.acceleration;
    this.drag = 0.05; // Water drag
    this.turnSpeed = 1.5;
    this.steerAngle = 0;

    this.driver = null;
    this.isPlayer = false;
    this.isAI = false;
    this.aiTarget = null;
    this.aiTimer = 0;

    this.createMesh();
    this.mesh.position.copy(this.position);
    this.mesh.rotation.y = this.rotation;
    this.world.scene.add(this.mesh);
  }

  createMesh() {
    const { width, length, height } = this.specs;
    const bodyColor = this.specs.color;
    const deckColor = new THREE.Color(bodyColor).multiplyScalar(0.8).getHex();
    const cabinColor = new THREE.Color(bodyColor).multiplyScalar(0.6).getHex();
    const glassColor = 0x223344;
    const metalColor = 0x888888;

    const bodyMat = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.3, metalness: 0.5 });
    const deckMat = new THREE.MeshStandardMaterial({ color: deckColor, roughness: 0.6, metalness: 0.2 });
    const cabinMat = new THREE.MeshStandardMaterial({ color: cabinColor, roughness: 0.4, metalness: 0.4 });
    const glassMat = new THREE.MeshStandardMaterial({ color: glassColor, roughness: 0.1, metalness: 0.9, transparent: true, opacity: 0.5 });
    const metalMat = new THREE.MeshStandardMaterial({ color: metalColor, roughness: 0.2, metalness: 0.8 });

    // Hull (displacement shape)
    const hullGeo = new THREE.BoxGeometry(width, height * 0.6, length);
    // Taper front
    const hull = new THREE.Mesh(hullGeo, bodyMat);
    hull.position.y = height * 0.3;
    hull.castShadow = true;
    this.mesh.add(hull);
    this.hull = hull;

    // Deck
    const deckGeo = new THREE.BoxGeometry(width * 0.9, 0.2, length * 0.8);
    const deck = new THREE.Mesh(deckGeo, deckMat);
    deck.position.y = height * 0.6 + 0.1;
    deck.castShadow = true;
    this.mesh.add(deck);
    this.deck = deck;

    // Cabin
    const cabinGeo = new THREE.BoxGeometry(width * 0.7, height * 0.7, length * 0.3);
    const cabin = new THREE.Mesh(cabinGeo, cabinMat);
    cabin.position.y = height * 0.6 + 0.1 + cabinGeo.parameters.height / 2;
    cabin.position.z = -length * 0.1;
    cabin.castShadow = true;
    this.mesh.add(cabin);
    this.cabin = cabin;

    // Cabin windows
    const winGeo = new THREE.BoxGeometry(width * 0.68, height * 0.5, length * 0.28);
    const windows = new THREE.Mesh(winGeo, glassMat);
    windows.position.copy(cabin.position);
    windows.castShadow = true;
    this.mesh.add(windows);

    // Windshield
    const wsGeo = new THREE.BoxGeometry(width * 0.68, height * 0.5, 0.1);
    const windshield = new THREE.Mesh(wsGeo, glassMat);
    windshield.position.set(0, cabin.position.y, cabin.position.z + length * 0.15);
    this.mesh.add(windshield);

    // Engine/outboard
    const engineGeo = new THREE.BoxGeometry(0.5, 0.8, 0.6);
    const engine = new THREE.Mesh(engineGeo, metalMat);
    engine.position.set(0, height * 0.6 + 0.5, -length/2 + 0.3);
    engine.castShadow = true;
    this.mesh.add(engine);
    this.engine = engine;

    // Propeller
    const propGeo = new THREE.CylinderGeometry(0.6, 0.6, 0.1, 3);
    const propMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.5, metalness: 0.5 });
    this.propeller = new THREE.Mesh(propGeo, propMat);
    this.propeller.position.set(0, height * 0.3, -length/2 + 0.6);
    this.propeller.rotation.x = Math.PI / 2;
    this.mesh.add(this.propeller);

    // Wake particles
    this.wakeParticles = null;
    this.createWake();

    // Lights
    this.navLights = [];
    // Port (red)
    const portGeo = new THREE.SphereGeometry(0.15, 8, 8);
    const portMat = new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 1 });
    const portLight = new THREE.Mesh(portGeo, portMat);
    portLight.position.set(width/2, height * 0.6 + 0.3, length/3);
    this.mesh.add(portLight);
    this.navLights.push({ mesh: portLight, color: 0xff0000, pointLight: new THREE.PointLight(0xff0000, 1, 20, 2) });
    this.mesh.add(this.navLights[0].pointLight);

    // Starboard (green)
    const starGeo = new THREE.SphereGeometry(0.15, 8, 8);
    const starMat = new THREE.MeshBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 1 });
    const starLight = new THREE.Mesh(starGeo, starMat);
    starLight.position.set(-width/2, height * 0.6 + 0.3, length/3);
    this.mesh.add(starLight);
    this.navLights.push({ mesh: starLight, color: 0x00ff00, pointLight: new THREE.PointLight(0x00ff00, 1, 20, 2) });
    this.mesh.add(this.navLights[1].pointLight);

    // Stern (white)
    const sternGeo = new THREE.SphereGeometry(0.15, 8, 8);
    const sternMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1 });
    const sternLight = new THREE.Mesh(sternGeo, sternMat);
    sternLight.position.set(0, height * 0.6 + 0.3, -length/2 + 0.2);
    this.mesh.add(sternLight);
    this.navLights.push({ mesh: sternLight, color: 0xffffff, pointLight: new THREE.PointLight(0xffffff, 1, 30, 2) });
    this.mesh.add(this.navLights[2].pointLight);
  }

  createWake() {
    const count = 100;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const life = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      positions[i * 3] = 0;
      positions[i * 3 + 1] = -100;
      positions[i * 3 + 2] = 0;
      sizes[i] = 0.3;
      life[i] = 0;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute('life', new THREE.BufferAttribute(life, 1));

    const mat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.3,
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
      sizeAttenuation: true,
    });

    this.wakeParticles = new THREE.Points(geo, mat);
    this.world.scene.add(this.wakeParticles);
  }

  getSeatOffset() {
    return new THREE.Vector3(0, this.specs.height * 0.6 + 1, -this.specs.length * 0.1);
  }

  getExitPosition() {
    // Exit to side of boat
    const offset = new THREE.Vector3(this.specs.width / 2 + 1, this.specs.height * 0.6 + 0.5, 0);
    offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.rotation);
    return this.mesh.position.clone().add(offset);
  }

  enter(driver) {
    this.driver = driver;
    this.isPlayer = driver.isPlayer || false;
  }

  exit(driver) {
    this.driver = null;
    this.isPlayer = false;
  }

  update(delta, input) {
    if (this.isPlayer && input) {
      this.handlePlayerInput(delta, input);
    } else if (this.isAI) {
      this.updateAI(delta);
    }

    this.applyPhysics(delta);
    this.updateWake(delta);
    this.updatePropeller(delta);
  }

  handlePlayerInput(delta, input) {
    let throttle = 0;
    let steer = 0;

    if (input.keys.KeyW) throttle = 1;
    if (input.keys.KeyS) throttle = -0.5;
    if (input.keys.KeyA) steer = -1;
    if (input.keys.KeyD) steer = 1;

    // Steering (boats turn slower at low speed)
    const steerEffect = Math.max(0.3, Math.abs(this.speed) / this.maxSpeed);
    this.steerAngle = THREE.MathUtils.lerp(this.steerAngle, steer * this.turnSpeed * steerEffect, delta * 2);
    this.rotation += this.steerAngle * delta;

    // Throttle
    if (throttle > 0) {
      this.speed += this.acceleration * throttle * delta;
      if (this.speed > this.maxSpeed) this.speed = this.maxSpeed;
    } else if (throttle < 0) {
      this.speed += this.acceleration * throttle * delta;
      if (this.speed < -this.maxSpeed * 0.3) this.speed = -this.maxSpeed * 0.3;
    } else {
      // Water drag
      this.speed -= this.speed * this.drag * delta;
      if (Math.abs(this.speed) < 0.1) this.speed = 0;
    }
  }

  updateAI(delta) {
    this.aiTimer += delta;
    if (!this.aiTarget || this.aiTimer > 15) {
      // Pick random point in water
      this.aiTarget = new THREE.Vector2(
        prng.range(-1500, 1500),
        prng.range(-1500, 1500)
      );
      this.aiTimer = 0;
    }

    if (this.aiTarget) {
      const toTarget = new THREE.Vector2(this.aiTarget.x - this.mesh.position.x, this.aiTarget.y - this.mesh.position.z);
      const dist = toTarget.length();

      if (dist < 20) {
        this.aiTarget = null;
        return;
      }

      const targetAngle = Math.atan2(toTarget.x, toTarget.y);
      let diff = targetAngle - this.rotation;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;

      const steer = THREE.MathUtils.clamp(diff * 0.5, -1, 1);
      this.steerAngle = THREE.MathUtils.lerp(this.steerAngle, steer * this.turnSpeed, delta * 2);
      this.rotation += this.steerAngle * delta;

      if (this.speed < this.maxSpeed * 0.6) {
        this.speed += this.acceleration * 0.5 * delta;
      }
    }
  }

  applyPhysics(delta) {
    const forward = new THREE.Vector3(
      Math.sin(this.rotation),
      0,
      Math.cos(this.rotation)
    );

    this.velocity.copy(forward).multiplyScalar(this.speed);
    this.mesh.position.addScaledVector(this.velocity, delta);
    this.mesh.rotation.y = this.rotation;

    // Water height with waves
    const waterY = this.world.WATER_LEVEL;
    const waveHeight = this.getWaveHeight(this.mesh.position.x, this.mesh.position.z);
    this.mesh.position.y = waterY + waveHeight + this.specs.height * 0.3;

    // Tilt with waves
    const waveSlopeX = this.getWaveSlope(this.mesh.position.x, this.mesh.position.z, true);
    const waveSlopeZ = this.getWaveSlope(this.mesh.position.x, this.mesh.position.z, false);
    this.mesh.rotation.x = waveSlopeX * 0.3;
    this.mesh.rotation.z = waveSlopeZ * 0.3;
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
    const t = this.world.waveTime;
    const eps = 1;
    if (isX) {
      return (this.getWaveHeight(x + eps, z) - this.getWaveHeight(x - eps, z)) / (2 * eps);
    } else {
      return (this.getWaveHeight(x, z + eps) - this.getWaveHeight(x, z - eps)) / (2 * eps);
    }
  }

  updateWake(delta) {
    if (!this.wakeParticles || Math.abs(this.speed) < 1) return;

    const positions = this.wakeParticles.geometry.attributes.position;
    const sizes = this.wakeParticles.geometry.attributes.size;
    const life = this.wakeParticles.geometry.attributes.life;

    // Spawn new wake particles
    const spawnRate = Math.abs(this.speed) * 2;
    for (let i = 0; i < spawnRate * delta; i++) {
      // Find dead particle
      for (let j = 0; j < life.count; j++) {
        if (life.array[j] <= 0) {
          // Spawn behind boat
          const backOffset = new THREE.Vector3(0, 0, this.specs.length / 2 - 0.5);
          backOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.rotation);

          positions.array[j * 3] = this.mesh.position.x + backOffset.x + prng.range(-0.5, 0.5);
          positions.array[j * 3 + 1] = this.world.WATER_LEVEL + 0.2;
          positions.array[j * 3 + 2] = this.mesh.position.z + backOffset.z + prng.range(-0.5, 0.5);
          sizes.array[j] = prng.range(0.2, 0.5);
          life.array[j] = 1;
          break;
        }
      }
    }

    // Update particles
    for (let i = 0; i < life.count; i++) {
      if (life.array[i] > 0) {
        life.array[i] -= delta * 2;
        positions.array[i * 3 + 1] += delta * 0.5; // Rise slightly
        if (life.array[i] <= 0) {
          positions.array[i * 3 + 1] = -100;
        }
      }
    }

    positions.needsUpdate = true;
    life.needsUpdate = true;
  }

  updatePropeller(delta) {
    if (this.propeller) {
      this.propeller.rotation.z += this.speed * delta * 20;
    }
  }

  dispose() {
    if (this.wakeParticles) {
      this.wakeParticles.geometry.dispose();
      this.wakeParticles.material.dispose();
      this.world.scene.remove(this.wakeParticles);
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

// Traffic system
export class TrafficSystem {
  constructor(world) {
    this.world = world;
    this.vehicles = [];
    this.boats = [];
    this.maxCars = 20;
    this.maxBoats = 6;
    this.spawnTimer = 0;
    this.despawnDistance = 300;
  }

  init() {
    // Spawn parked cars
    const spawns = this.world.getVehicleSpawns();
    spawns.forEach((spawn, i) => {
      if (spawn.type === 'car' && i < this.maxCars) {
        const types = Object.keys(VEHICLE_TYPES);
        const type = prng.choice(types);
        const car = new Vehicle(this.world, type, spawn.x, spawn.z, spawn.angle);
        car.isAI = true;
        this.vehicles.push(car);
      } else if (spawn.type === 'boat' && i < this.maxBoats) {
        const types = Object.keys(BOAT_TYPES);
        const type = prng.choice(types);
        const boat = new Boat(this.world, type, spawn.x, spawn.z, spawn.angle);
        boat.isAI = true;
        this.boats.push(boat);
      }
    });
  }

  update(delta, playerPos) {
    this.spawnTimer += delta;

    // Update cars
    this.vehicles.forEach(car => {
      car.update(delta, null);

      // Despawn distant cars
      const dist = car.mesh.position.distanceTo(playerPos);
      if (dist > this.despawnDistance && !car.isPlayer) {
        this.removeCar(car);
      }
    });

    // Update boats
    this.boats.forEach(boat => {
      boat.update(delta, null);

      const dist = boat.mesh.position.distanceTo(playerPos);
      if (dist > this.despawnDistance && !boat.isPlayer) {
        this.removeBoat(boat);
      }
    });

    // Spawn new traffic if needed
    if (this.vehicles.filter(v => !v.isPlayer).length < this.maxCars && this.spawnTimer > 5) {
      this.spawnRandomCar();
      this.spawnTimer = 0;
    }

    if (this.boats.filter(b => !b.isPlayer).length < this.maxBoats && this.spawnTimer > 10) {
      this.spawnRandomBoat();
      this.spawnTimer = 0;
    }
  }

  spawnRandomCar() {
    const spawns = this.world.getVehicleSpawns().filter(s => s.type === 'car');
    if (spawns.length === 0) return;

    const spawn = prng.choice(spawns);
    // Check if spawn is clear
    const clear = !this.vehicles.some(v => v.mesh.position.distanceTo(new THREE.Vector3(spawn.x, 0, spawn.z)) < 10);
    if (!clear) return;

    const types = Object.keys(VEHICLE_TYPES);
    const type = prng.choice(types);
    const car = new Vehicle(this.world, type, spawn.x, spawn.z, spawn.angle);
    car.isAI = true;
    this.vehicles.push(car);
  }

  spawnRandomBoat() {
    const spawns = this.world.getVehicleSpawns().filter(s => s.type === 'boat');
    if (spawns.length === 0) return;

    const spawn = prng.choice(spawns);
    const clear = !this.boats.some(b => b.mesh.position.distanceTo(new THREE.Vector3(spawn.x, 0, spawn.z)) < 20);
    if (!clear) return;

    const types = Object.keys(BOAT_TYPES);
    const type = prng.choice(types);
    const boat = new Boat(this.world, type, spawn.x, spawn.z, spawn.angle);
    boat.isAI = true;
    this.boats.push(boat);
  }

  removeCar(car) {
    car.dispose();
    const idx = this.vehicles.indexOf(car);
    if (idx >= 0) this.vehicles.splice(idx, 1);
  }

  removeBoat(boat) {
    boat.dispose();
    const idx = this.boats.indexOf(boat);
    if (idx >= 0) this.boats.splice(idx, 1);
  }

  getNearbyVehicles(pos, range) {
    const result = [];
    this.vehicles.forEach(v => {
      if (v.mesh.position.distanceTo(pos) < range) result.push(v);
    });
    this.boats.forEach(b => {
      if (b.mesh.position.distanceTo(pos) < range) result.push(b);
    });
    return result;
  }

  dispose() {
    this.vehicles.forEach(v => v.dispose());
    this.boats.forEach(b => b.dispose());
    this.vehicles = [];
    this.boats = [];
  }
}