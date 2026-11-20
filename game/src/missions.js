//
// MONSOON ISLES - Mission System
// Story missions, side jobs, objectives, waypoints, progression tracking
//

import * as THREE from 'three';
import { prng } from './prng.js';
import { Vehicle, Boat } from './vehicles.js';
import { ISLAND_CENTERS } from './world.js';

// Mission state constants
const MISSION_STATE = {
  INACTIVE: 'inactive',
  AVAILABLE: 'available',
  ACTIVE: 'active',
  COMPLETED: 'completed',
  FAILED: 'failed',
};

// Mission types
const MISSION_TYPE = {
  STORY: 'story',
  SIDE_TAXI: 'taxi',
  SIDE_COURIER: 'courier',
  SIDE_BOAT_RACE: 'boat_race',
};

// Harbor warehouse position (Mara Venn's location)
const MARA_POSITION = new THREE.Vector3(-500 + 350 * 0.88 * 0.7, 1, -500 + 350 * 0.6);
const MARA_MARKER_POS = new THREE.Vector3(-500 + 350 * 0.88 * 0.7, 3, -500 + 350 * 0.6);

// Story mission definitions
const STORY_MISSIONS = [
  {
    id: 'harbor_1_first_run',
    name: 'First Run',
    giver: 'Mara Venn',
    description: 'Sail a package to the lighthouse island.',
    objectives: [
      'Reach the harbor warehouse',
      'Board the marked boat',
      'Deliver the package to the lighthouse island',
    ],
    waypoints: [
      { pos: new THREE.Vector3(-500 + 350 * 0.88 * 0.7, 0, -500 + 350 * 0.6), type: 'marker', label: 'Harbor Warehouse' },
      { pos: new THREE.Vector3(-500 + 350 * 0.9, 0, -500), type: 'vehicle', label: 'Mission Boat', vehicleType: 'SPEEDBOAT' },
      { pos: new THREE.Vector3(-500, 0, 350 * 0.9), type: 'destination', label: 'Lighthouse Island', radius: 15 },
    ],
    reward: 500,
    unlocks: 'harbor_2_wheels',
    dialogue: [
      "Mara Venn: 'You're the new face around here. Good.'",
      "Mara Venn: 'I got a package needs moving. Quiet-like. To the lighthouse.'",
      "Mara Venn: 'Boat's at the end of the dock. Don't scratch it.'",
      "Mara Venn: 'Come back when it's done. We'll talk more.'",
    ],
  },
  {
    id: 'harbor_2_wheels',
    name: 'Wheels',
    giver: 'Mara Venn',
    description: 'Steal a marked sports car, deliver to garage.',
    objectives: [
      'Return to the harbor warehouse',
      'Steal the marked sports car',
      'Deliver it to the garage on the east island',
    ],
    waypoints: [
      { pos: new THREE.Vector3(-500 + 350 * 0.88 * 0.7, 0, -500 + 350 * 0.6), type: 'marker', label: 'Harbor Warehouse' },
      { pos: new THREE.Vector3(-500 + 350 * 0.5, 0, -500 + 350 * 0.3), type: 'vehicle', label: 'Target Sports Car', vehicleType: 'SPORTS' },
      { pos: new THREE.Vector3(500 - 350 * 0.7, 0, -200), type: 'destination', label: 'East Island Garage', radius: 10 },
    ],
    reward: 1200,
    unlocks: 'harbor_3_street_heat',
    dialogue: [
      "Mara Venn: 'You made it back. Good. Now for something with wheels.'",
      "Mara Venn: 'Red sports car. Parked near the bridge entrance on the west island.'",
      "Mara Venn: 'Take it to my garage on the east island. Don't damage the paint.'",
      "Mara Venn: 'Cops might notice a stolen ride. Drive smart.'",
    ],
  },
  {
    id: 'harbor_3_street_heat',
    name: 'Street Heat',
    giver: 'Mara Venn',
    description: 'Checkpoint race across the bridges.',
    objectives: [
      'Meet at the harbor warehouse',
      'Race through checkpoints across all three bridges',
      'Finish at the airstrip before time runs out',
    ],
    waypoints: [
      { pos: new THREE.Vector3(-500 + 350 * 0.88 * 0.7, 0, -500 + 350 * 0.6), type: 'marker', label: 'Harbor Warehouse' },
      { pos: new THREE.Vector3(-500 + 350 * 0.88, 0, 0), type: 'checkpoint', label: 'Checkpoint 1: West Bridge' },
      { pos: new THREE.Vector3(500 - 350 * 0.88, 0, 0), type: 'checkpoint', label: 'Checkpoint 2: East Bridge' },
      { pos: new THREE.Vector3(0, 0, -500 + 350 * 0.88), type: 'checkpoint', label: 'Checkpoint 3: South Bridge' },
      { pos: new THREE.Vector3(100, 0, -500 + 350 * 0.6), type: 'destination', label: 'Finish: Airstrip', radius: 15 },
    ],
    reward: 2000,
    unlocks: 'harbor_4_warehouse_job',
    timeLimit: 180, // 3 minutes
    dialogue: [
      "Mara Venn: 'You handle a car well. Let's see you handle pressure.'",
      "Mara Venn: 'Race across all three bridges. Checkpoints at each end.'",
      "Mara Venn: 'Three minutes. Airstrip on the south island. Go.'",
      "Mara Venn: 'Traffic won't move for you. Make them move.'",
    ],
  },
  {
    id: 'harbor_4_warehouse_job',
    name: 'The Warehouse Job',
    giver: 'Mara Venn',
    description: 'Drive to warehouse, shoot marked targets, grab ledger, escape.',
    objectives: [
      'Drive to the warehouse on the west island',
      'Eliminate the marked targets inside',
      'Grab the ledger from the office',
      'Escape to the safehouse',
    ],
    waypoints: [
      { pos: new THREE.Vector3(-500 + 350 * 0.88 * 0.7, 0, -500 + 350 * 0.6), type: 'marker', label: 'Harbor Warehouse' },
      { pos: new THREE.Vector3(-500 - 100, 0, 50), type: 'destination', label: 'Target Warehouse', radius: 20 },
      { pos: new THREE.Vector3(-500 - 100, 0, 50), type: 'targets', label: 'Targets', count: 4 },
      { pos: new THREE.Vector3(-500 - 100, 3, 55), type: 'pickup', label: 'Ledger (Office)' },
      { pos: new THREE.Vector3(-500 + 200, 0, 200), type: 'destination', label: 'Safehouse', radius: 10 },
    ],
    reward: 3500,
    unlocks: 'harbor_5_hot_cargo',
    dialogue: [
      "Mara Venn: 'Now we're talking real business. A ledger. Names. Routes.'",
      "Mara Venn: 'Warehouse on the west island, inland. Heavily guarded.'",
      "Mara Venn: 'Take them out. Grab the ledger from the office upstairs.'",
      "Mara Venn: 'Get to the safehouse. I'll handle the rest.'",
    ],
  },
  {
    id: 'harbor_5_hot_cargo',
    name: 'Hot Cargo',
    giver: 'Mara Venn',
    description: 'Boat delivery with forced wanted level 3.',
    objectives: [
      'Meet at the harbor warehouse',
      'Board the cargo boat',
      'Deliver the cargo to the drop point while evading police',
      'Lose the heat',
    ],
    waypoints: [
      { pos: new THREE.Vector3(-500 + 350 * 0.88 * 0.7, 0, -500 + 350 * 0.6), type: 'marker', label: 'Harbor Warehouse' },
      { pos: new THREE.Vector3(-500 + 350 * 0.9, 0, -500 - 50), type: 'vehicle', label: 'Cargo Boat', vehicleType: 'CARGO' },
      { pos: new THREE.Vector3(500 - 100, 0, -500 - 100), type: 'destination', label: 'Drop Point', radius: 20 },
    ],
    reward: 5000,
    unlocks: 'harbor_6_kingpins_ledger',
    forcedWantedLevel: 3,
    dialogue: [
      "Mara Venn: 'This one's hot. Real hot. Cops'll be on you the moment you leave.'",
      "Mara Venn: 'Cargo boat at the far dock. Take it to the drop near the east island.'",
      "Mara Venn: 'You'll start at three stars. Lose 'em after the drop.'",
      "Mara Venn: 'Don't sink the boat. Cargo's fragile.'",
    ],
  },
  {
    id: 'harbor_6_kingpins_ledger',
    name: "Kingpin's Ledger",
    giver: 'Mara Venn',
    description: 'Reach the airstrip before timer ends at 4-star heat.',
    objectives: [
      'Final meeting at the harbor warehouse',
      'Race to the airstrip on the south island',
      'Survive at 4-star wanted level',
      'Reach the airstrip before time runs out',
    ],
    waypoints: [
      { pos: new THREE.Vector3(-500 + 350 * 0.88 * 0.7, 0, -500 + 350 * 0.6), type: 'marker', label: 'Harbor Warehouse' },
      { pos: new THREE.Vector3(100, 0, -500 + 350 * 0.6), type: 'destination', label: 'Airstrip', radius: 25 },
    ],
    reward: 10000,
    unlocks: null,
    timeLimit: 240, // 4 minutes
    forcedWantedLevel: 4,
    dialogue: [
      "Mara Venn: 'This is it. The kingpin's ledger. Everything.'",
      "Mara Venn: 'Airstrip on the south island. Four minutes. Four stars.'",
      "Mara Venn: 'Every cop in the archipelago will be hunting you.'",
      "Mara Venn: 'Make it. And we both walk away rich.'",
    ],
  },
];

// Side job definitions
const SIDE_JOBS = {
  taxi: {
    id: 'side_taxi',
    name: 'Taxi Fare',
    type: MISSION_TYPE.SIDE_TAXI,
    description: 'Pick up a passenger and drive them to their destination.',
    baseReward: 200,
    timePerDistance: 0.5, // seconds per meter
    minDistance: 100,
    maxDistance: 800,
  },
  courier: {
    id: 'side_courier',
    name: 'Courier Run',
    type: MISSION_TYPE.SIDE_COURIER,
    description: 'Deliver a package between islands.',
    baseReward: 350,
    timePerDistance: 0.4,
    minDistance: 200,
    maxDistance: 1200,
    useBoat: false,
  },
  boatRace: {
    id: 'side_boat_race',
    name: 'Boat Race',
    type: MISSION_TYPE.SIDE_BOAT_RACE,
    description: 'Race through checkpoints on the water.',
    baseReward: 500,
    checkpointCount: 5,
    timeLimit: 120,
  },
};

// Mission system class
export class MissionSystem {
  constructor(world, player, traffic, police) {
    this.world = world;
    this.player = player;
    this.traffic = traffic;
    this.police = police;

    // Mission state
    this.activeMission = null;
    this.missionProgress = {}; // missionId -> { state, currentObjective, objectivesCompleted, ... }
    this.storyProgress = 0; // Index of next story mission
    this.sideJobCooldowns = {}; // jobId -> timestamp

    // UI elements
    this.missionMarker = null;
    this.missionBlip = null;
    this.dialogueBox = null;
    this.objectiveText = null;
    this.completionBanner = null;
    this.typewriterText = '';
    this.typewriterIndex = 0;
    this.typewriterSpeed = 30; // ms per character
    this.typewriterTimer = 0;
    this.showingDialogue = false;
    this.currentDialogueLines = [];
    this.currentDialogueLine = 0;
    this.waitingForDialogueAdvance = false;

    // Waypoint system
    this.currentWaypointIndex = 0;
    this.waypointMarkers = []; // Three.js meshes for waypoints
    this.checkpointMeshes = [];

    // Mission vehicle/entity references
    this.missionVehicle = null;
    this.missionTargets = [];
    this.missionPickups = [];

    // Timers
    this.missionTimer = 0;
    this.missionTimeLimit = 0;

    // Initialize mission progress for story missions
    STORY_MISSIONS.forEach((m, i) => {
      this.missionProgress[m.id] = {
        state: i === 0 ? MISSION_STATE.AVAILABLE : MISSION_STATE.INACTIVE,
        currentObjective: 0,
        objectivesCompleted: [],
        startTime: null,
        endTime: null,
      };
    });

    // Create UI elements
    this.createUI();
    this.createMissionMarker();
  }

  createUI() {
    // Objective text display (top-right)
    this.objectiveText = document.createElement('div');
    this.objectiveText.id = 'mission-objective';
    this.objectiveText.style.cssText = `
      position: fixed;
      top: 80px;
      right: 20px;
      background: rgba(0, 20, 40, 0.9);
      border: 2px solid #00aaff;
      border-radius: 8px;
      padding: 12px 16px;
      color: #fff;
      font-family: 'Courier New', monospace;
      font-size: 14px;
      line-height: 1.5;
      max-width: 350px;
      z-index: 100;
      display: none;
      box-shadow: 0 0 20px rgba(0, 170, 255, 0.3);
    `;
    document.body.appendChild(this.objectiveText);

    // Dialogue box (bottom center)
    this.dialogueBox = document.createElement('div');
    this.dialogueBox.id = 'mission-dialogue';
    this.dialogueBox.style.cssText = `
      position: fixed;
      bottom: 100px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0, 10, 20, 0.95);
      border: 2px solid #ffcc00;
      border-radius: 8px;
      padding: 20px 30px;
      color: #ffcc00;
      font-family: 'Courier New', monospace;
      font-size: 16px;
      line-height: 1.6;
      max-width: 700px;
      min-width: 400px;
      text-align: center;
      z-index: 200;
      display: none;
      box-shadow: 0 0 30px rgba(255, 204, 0, 0.4);
    `;
    this.dialogueBox.innerHTML = `
      <div id="dialogue-name" style="font-weight: bold; color: #00aaff; margin-bottom: 8px;"></div>
      <div id="dialogue-text"></div>
      <div id="dialogue-hint" style="margin-top: 12px; font-size: 12px; color: #888;">Press E to continue...</div>
    `;
    document.body.appendChild(this.dialogueBox);

    // Completion banner
    this.completionBanner = document.createElement('div');
    this.completionBanner.id = 'mission-banner';
    this.completionBanner.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: linear-gradient(135deg, rgba(0, 40, 80, 0.95), rgba(0, 20, 40, 0.95));
      border: 3px solid #00ff88;
      border-radius: 12px;
      padding: 40px 60px;
      color: #00ff88;
      font-family: 'Courier New', monospace;
      font-size: 28px;
      font-weight: bold;
      text-align: center;
      z-index: 300;
      display: none;
      box-shadow: 0 0 50px rgba(0, 255, 136, 0.5);
      animation: bannerPulse 2s ease-in-out infinite;
    `;
    // Add animation keyframes
    if (!document.getElementById('mission-banner-style')) {
      const style = document.createElement('style');
      style.id = 'mission-banner-style';
      style.textContent = `
        @keyframes bannerPulse {
          0%, 100% { box-shadow: 0 0 50px rgba(0, 255, 136, 0.5); border-color: #00ff88; }
          50% { box-shadow: 0 0 80px rgba(0, 255, 136, 0.8); border-color: #00ffcc; }
        }
      `;
      document.head.appendChild(style);
    }
    document.body.appendChild(this.completionBanner);
  }

  createMissionMarker() {
    // Create a visible marker at Mara's position
    const geometry = new THREE.CylinderGeometry(0.5, 1.5, 3, 8);
    const material = new THREE.MeshBasicMaterial({
      color: 0x00aaff,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
    });
    this.missionMarker = new THREE.Mesh(geometry, material);
    this.missionMarker.position.copy(MARA_MARKER_POS);
    this.missionMarker.userData.isMissionMarker = true;
    this.missionMarker.userData.missionId = 'mara_harbor';
    this.world.scene.add(this.missionMarker);

    // Add pulsing animation
    this.markerPulsePhase = 0;

    // Minimap blip data
    this.missionBlip = {
      position: new THREE.Vector2(MARA_MARKER_POS.x, MARA_MARKER_POS.z),
      color: '#00aaff',
      label: 'M',
      pulse: true,
    };
  }

  // Main update loop
  update(delta, input) {
    // Update marker animation
    if (this.missionMarker) {
      this.markerPulsePhase += delta * 3;
      this.missionMarker.scale.y = 1 + Math.sin(this.markerPulsePhase) * 0.15;
      this.missionMarker.material.opacity = 0.6 + Math.sin(this.markerPulsePhase * 2) * 0.2;
      this.missionMarker.rotation.y += delta * 0.5;
    }

    // Handle dialogue typewriter
    if (this.showingDialogue) {
      this.updateTypewriter(delta);
      this.handleDialogueInput(input);
      return; // Don't process mission logic during dialogue
    }

    // Check for mission start at marker
    if (!this.activeMission && this.storyProgress < STORY_MISSIONS.length) {
      this.checkMissionStart(input);
    }

    // Update active mission
    if (this.activeMission) {
      this.updateActiveMission(delta, input);
    }

    // Update side job cooldowns
    this.updateSideJobCooldowns(delta);

    // Update objective display
    this.updateObjectiveDisplay();
  }

  checkMissionStart(input) {
    const mission = STORY_MISSIONS[this.storyProgress];
    const progress = this.missionProgress[mission.id];

    if (progress.state !== MISSION_STATE.AVAILABLE) return;
    const dist = this.player.position.distanceTo(MARA_POSITION);
    if (dist < 5) {
      // Show interaction prompt
      this.showInteractionPrompt(mission);
      if (input.keys.KeyE && !input.prevKeys.KeyE) {
        this.startMission(mission);
      }
    }
  }

  showInteractionPrompt(mission) {
    // Could add a small "Press E to talk" hint near player
    // For now, the dialogue box will appear when they press E
  }

  startMission(mission) {
    this.activeMission = mission;
    this.currentWaypointIndex = 0;
    this.missionProgress[mission.id].state = MISSION_STATE.ACTIVE;
    this.missionProgress[mission.id].startTime = performance.now();
    this.missionProgress[mission.id].currentObjective = 0;

    // Apply forced wanted level if specified
    if (mission.forcedWantedLevel) {
      this.player.wantedLevel = mission.forcedWantedLevel;
      this.player.wantedTimer = 9999; // Keep it high
      this.police.alertPolice(this.player.position, mission.forcedWantedLevel);
    }

    // Set time limit if specified
    if (mission.timeLimit) {
      this.missionTimeLimit = mission.timeLimit;
      this.missionTimer = 0;
    }

    // Show dialogue
    this.showDialogue(mission.giver, mission.dialogue, () => {
      this.spawnMissionEntities();
      this.updateWaypoint();
      this.showObjective(mission.objectives[0]);
    });
  }

  spawnMissionEntities() {
    const mission = this.activeMission;
    if (!mission) return;

    const firstWaypoint = mission.waypoints[0];

    // Spawn mission vehicle if needed
    if (firstWaypoint.type === 'vehicle') {
      this.spawnMissionVehicle(firstWaypoint);
    }

    // Spawn targets for warehouse job
    if (mission.id === 'harbor_4_warehouse_job') {
      this.spawnMissionTargets();
    }

    // Spawn pickup for ledger
    if (mission.id === 'harbor_4_warehouse_job') {
      this.spawnMissionPickup();
    }
  }

  spawnMissionVehicle(waypoint) {
    if (this.missionVehicle) {
      this.missionVehicle.dispose();
    }

    // Find a nearby vehicle spawn or create at waypoint
    const spawnPos = waypoint.pos.clone();
    const vehicleType = waypoint.vehicleType || 'SEDAN';

    if (waypoint.vehicleType === 'SPEEDBOAT' || waypoint.vehicleType === 'CARGO') {
      this.missionVehicle = new Boat(this.world, waypoint.vehicleType, spawnPos.x, spawnPos.z, 0);
    } else {
      this.missionVehicle = new Vehicle(this.world, vehicleType, spawnPos.x, spawnPos.z, 0);
    }

    this.missionVehicle.mesh.userData.isMissionVehicle = true;
    this.missionVehicle.mesh.userData.missionId = this.activeMission.id;

    // Add a marker above it
    this.addVehicleMarker(this.missionVehicle);
  }

  addVehicleMarker(vehicle) {
    const geometry = new THREE.ConeGeometry(1, 2, 4);
    const material = new THREE.MeshBasicMaterial({
      color: 0x00ff88,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
    });
    const marker = new THREE.Mesh(geometry, material);
    marker.position.set(0, 5, 0);
    marker.userData.isMissionMarker = true;
    vehicle.mesh.add(marker);
    vehicle.missionMarker = marker;
  }

  spawnMissionTargets() {
    // Spawn 4 enemy pedestrians at warehouse
    const warehousePos = new THREE.Vector3(-500 - 100, 0, 50);
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      const radius = 8;
      const x = warehousePos.x + Math.cos(angle) * radius;
      const z = warehousePos.z + Math.sin(angle) * radius;

      // Create a simple target marker (using a pedestrian-like entity)
      const geometry = new THREE.CylinderGeometry(0.5, 0.5, 1.8, 8);
      const material = new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0x440000 });
      const target = new THREE.Mesh(geometry, material);
      target.position.set(x, 1, z);
      target.userData.isMissionTarget = true;
      target.userData.missionId = this.activeMission.id;
      target.userData.health = 100;
      this.world.scene.add(target);
      this.missionTargets.push(target);

      // Add marker above
      const markerGeo = new THREE.ConeGeometry(0.8, 1.5, 4);
      const markerMat = new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.9 });
      const marker = new THREE.Mesh(markerGeo, markerMat);
      marker.position.set(0, 3, 0);
      target.add(marker);
      target.marker = marker;
    }
  }

  spawnMissionPickup() {
    const pickupPos = new THREE.Vector3(-500 - 100, 3, 55);
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshStandardMaterial({
      color: 0xffcc00,
      emissive: 0x443300,
      roughness: 0.3,
      metalness: 0.7,
    });
    const pickup = new THREE.Mesh(geometry, material);
    pickup.position.copy(pickupPos);
    pickup.userData.isMissionPickup = true;
    pickup.userData.missionId = this.activeMission.id;
    pickup.userData.collected = false;
    this.world.scene.add(pickup);
    this.missionPickups.push(pickup);

    // Floating animation
    pickup.userData.floatPhase = 0;
  }

  updateActiveMission(delta, input) {
    const mission = this.activeMission;
    const progress = this.missionProgress[mission.id];

    // Update timer
    if (mission.timeLimit) {
      this.missionTimer += delta;
      if (this.missionTimer >= mission.timeLimit) {
        this.failMission('Time ran out!');
        return;
      }
    }

    // Update mission vehicle
    if (this.missionVehicle) {
      this.missionVehicle.update(delta, null);
      if (this.missionVehicle.missionMarker) {
        this.missionVehicle.missionMarker.rotation.y += delta * 2;
      }
    }

    // Update targets
    this.missionTargets.forEach(target => {
      if (target.marker) {
        target.marker.rotation.y += delta * 2;
      }
    });

    // Update pickups
    this.missionPickups.forEach(pickup => {
      pickup.userData.floatPhase += delta * 3;
      pickup.position.y = pickup.position.y + Math.sin(pickup.userData.floatPhase) * 0.02;
      pickup.rotation.y += delta;
    });

    // Check waypoint progress
    this.checkWaypointProgress();

    // Check mission-specific objectives
    this.checkMissionObjectives();

    // Check for mission vehicle entry
    if (this.missionVehicle && !this.player.isInVehicle) {
      const dist = this.player.position.distanceTo(this.missionVehicle.mesh.position);
      if (dist < 3 && input.keys.KeyE && !input.prevKeys.KeyE) {
        this.player.tryEnterVehicle(this.missionVehicle);
      }
    }

    // Check for pickup collection
    this.missionPickups.forEach(pickup => {
      if (!pickup.userData.collected) {
        const dist = this.player.position.distanceTo(pickup.position);
        if (dist < 2) {
          pickup.userData.collected = true;
          this.collectPickup(pickup);
        }
      }
    });

    // Update forced wanted level
    if (mission.forcedWantedLevel && this.player.wantedLevel < mission.forcedWantedLevel) {
      this.player.wantedLevel = mission.forcedWantedLevel;
    }
  }

  checkWaypointProgress() {
    if (!this.activeMission || this.currentWaypointIndex >= this.activeMission.waypoints.length) return;

    const waypoint = this.activeMission.waypoints[this.currentWaypointIndex];
    const playerPos = this.player.position;

    let checkPos = playerPos;
    if (this.player.isInVehicle && this.missionVehicle) {
      checkPos = this.missionVehicle.mesh.position;
    }

    const dist = new THREE.Vector2(checkPos.x, checkPos.z).distanceTo(new THREE.Vector2(waypoint.pos.x, waypoint.pos.z));

    if (dist < (waypoint.radius || 5)) {
      this.advanceWaypoint();
    }
  }

  advanceWaypoint() {
    this.currentWaypointIndex++;
    this.missionProgress[this.activeMission.id].currentObjective = this.currentWaypointIndex;

    if (this.currentWaypointIndex >= this.activeMission.waypoints.length) {
      // All waypoints done, check if mission complete
      this.checkMissionComplete();
    } else {
      this.updateWaypoint();
      const mission = this.activeMission;
      if (mission.objectives[this.currentWaypointIndex]) {
        this.showObjective(mission.objectives[this.currentWaypointIndex]);
      }
    }
  }

  updateWaypoint() {
    // Remove old waypoint markers
    this.clearWaypointMarkers();

    if (this.currentWaypointIndex >= this.activeMission.waypoints.length) return;

    const waypoint = this.activeMission.waypoints[this.currentWaypointIndex];

    // Create 3D waypoint marker
    const geometry = new THREE.CylinderGeometry(2, 3, 0.5, 8);
    const material = new THREE.MeshBasicMaterial({
      color: 0x00ff88,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
    });
    const marker = new THREE.Mesh(geometry, material);
    marker.position.set(waypoint.pos.x, 0.3, waypoint.pos.z);
    marker.userData.isWaypoint = true;
    this.world.scene.add(marker);
    this.waypointMarkers.push(marker);

    // Create vertical beam
    const beamGeo = new THREE.CylinderGeometry(0.2, 0.2, 50, 4);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0x00ff88,
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
    });
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.position.set(waypoint.pos.x, 25, waypoint.pos.z);
    this.world.scene.add(beam);
    this.waypointMarkers.push(beam);

    // Add to minimap blips (handled by main.js minimap update)
    this.currentWaypointBlip = {
      position: new THREE.Vector2(waypoint.pos.x, waypoint.pos.z),
      color: '#00ff88',
      label: '●',
      pulse: true,
    };
  }

  clearWaypointMarkers() {
    this.waypointMarkers.forEach(m => {
      this.world.scene.remove(m);
      m.geometry.dispose();
      m.material.dispose();
    });
    this.waypointMarkers = [];
    this.currentWaypointBlip = null;
  }

  checkMissionObjectives() {
    const mission = this.activeMission;
    const progress = this.missionProgress[mission.id];

    // Mission-specific checks
    switch (mission.id) {
      case 'harbor_4_warehouse_job':
        this.checkWarehouseJobObjectives();
        break;
      case 'harbor_5_hot_cargo':
        this.checkHotCargoObjectives();
        break;
      case 'harbor_6_kingpins_ledger':
        this.checkKingpinLedgerObjectives();
        break;
    }
  }

  checkWarehouseJobObjectives() {
    // Check if all targets eliminated
    const aliveTargets = this.missionTargets.filter(t => t.userData.health > 0);
    if (aliveTargets.length === 0 && this.currentWaypointIndex < 3) {
      // Advance to ledger pickup
      this.advanceWaypoint();
    }

    // Check if ledger collected and at safehouse
    const ledgerCollected = this.missionPickups.some(p => p.userData.collected);
    if (ledgerCollected && this.currentWaypointIndex === 3) {
      // At safehouse waypoint
      const safehouseWP = this.activeMission.waypoints[4];
      const dist = this.player.position.distanceTo(safehouseWP.pos);
      if (dist < safehouseWP.radius) {
        this.completeMission();
      }
    }
  }

  checkHotCargoObjectives() {
    // Check if at drop point with mission boat
    if (this.currentWaypointIndex === 2 && this.player.isInVehicle && this.missionVehicle) {
      const dropPoint = this.activeMission.waypoints[2];
      const dist = this.missionVehicle.mesh.position.distanceTo(dropPoint.pos);
      if (dist < dropPoint.radius) {
        // Cargo delivered, now lose heat
        this.advanceWaypoint();
        this.showObjective('Lose the police!');
      }
    }

    // Check if heat lost (wanted level 0)
    if (this.currentWaypointIndex === 3 && this.player.wantedLevel === 0) {
      this.completeMission();
    }
  }

  checkKingpinLedgerObjectives() {
    // Just need to reach airstrip before timer
    if (this.currentWaypointIndex === 1) {
      const airstrip = this.activeMission.waypoints[1];
      const dist = this.player.position.distanceTo(airstrip.pos);
      if (dist < airstrip.radius) {
        this.completeMission();
      }
    }
  }

  collectPickup(pickup) {
    // Remove pickup
    this.world.scene.remove(pickup);
    pickup.geometry.dispose();
    pickup.material.dispose();

    // Show feedback
    this.showObjective('Ledger secured! Escape to the safehouse!');

    // Advance waypoint
    this.advanceWaypoint();
  }

  showObjective(text) {
    if (this.objectiveText) {
      this.objectiveText.innerHTML = `<strong>OBJECTIVE:</strong><br>${text}`;
      this.objectiveText.style.display = 'block';
    }
  }

  updateObjectiveDisplay() {
    if (this.activeMission && this.objectiveText && this.objectiveText.style.display !== 'none') {
      const mission = this.activeMission;
      const objIndex = this.currentWaypointIndex;
      if (mission.objectives[objIndex]) {
        let text = mission.objectives[objIndex];
        if (mission.timeLimit) {
          const remaining = Math.max(0, Math.ceil(mission.timeLimit - this.missionTimer));
          text += `<br><span style="color: #ff4444;">TIME: ${remaining}s</span>`;
        }
        if (mission.forcedWantedLevel) {
          text += `<br><span style="color: #ff8800;">HEAT: ${this.player.wantedLevel}★</span>`;
        }
        this.objectiveText.innerHTML = `<strong>OBJECTIVE:</strong><br>${text}`;
      }
    } else if (!this.activeMission && this.objectiveText) {
      this.objectiveText.style.display = 'none';
    }
  }

  completeMission() {
    const mission = this.activeMission;
    const progress = this.missionProgress[mission.id];

    progress.state = MISSION_STATE.COMPLETED;
    progress.endTime = performance.now();
    progress.objectivesCompleted = [...mission.objectives];

    // Award cash
    this.player.money += mission.reward;

    // Unlock next mission
    if (mission.unlocks) {
      const nextProgress = this.missionProgress[mission.unlocks];
      if (nextProgress) {
        nextProgress.state = MISSION_STATE.AVAILABLE;
      }
      this.storyProgress++;
    }

    // Show completion banner
    this.showCompletionBanner(`MISSION COMPLETE<br>+$${mission.reward.toLocaleString()}`);

    // Clean up
    this.cleanupMission();

    this.activeMission = null;
    this.currentWaypointIndex = 0;
  }

  failMission(reason) {
    const mission = this.activeMission;
    const progress = this.missionProgress[mission.id];

    progress.state = MISSION_STATE.FAILED;
    progress.endTime = performance.now();

    // Show failure banner
    this.showCompletionBanner(`MISSION FAILED<br>${reason}`, true);

    // Clean up
    this.cleanupMission();

    this.activeMission = null;
    this.currentWaypointIndex = 0;
  }

  showCompletionBanner(text, isFailure = false) {
    if (this.completionBanner) {
      this.completionBanner.innerHTML = text;
      this.completionBanner.style.borderColor = isFailure ? '#ff4444' : '#00ff88';
      this.completionBanner.style.color = isFailure ? '#ff4444' : '#00ff88';
      this.completionBanner.style.display = 'block';

      // Hide after 4 seconds
      setTimeout(() => {
        if (this.completionBanner) {
          this.completionBanner.style.display = 'none';
        }
      }, 4000);
    }
  }

  cleanupMission() {
    // Clear waypoints
    this.clearWaypointMarkers();

    // Remove mission vehicle
    if (this.missionVehicle) {
      this.missionVehicle.dispose();
      this.missionVehicle = null;
    }

    // Remove targets
    this.missionTargets.forEach(t => {
      this.world.scene.remove(t);
      t.geometry.dispose();
      t.material.dispose();
      if (t.marker) {
        t.marker.geometry.dispose();
        t.marker.material.dispose();
      }
    });
    this.missionTargets = [];

    // Remove pickups
    this.missionPickups.forEach(p => {
      this.world.scene.remove(p);
      p.geometry.dispose();
      p.material.dispose();
    });
    this.missionPickups = [];

    // Hide objective
    if (this.objectiveText) {
      this.objectiveText.style.display = 'none';
    }

    // Reset forced wanted level
    if (this.activeMission && this.activeMission.forcedWantedLevel) {
      this.player.wantedLevel = 0;
      this.player.wantedTimer = 0;
    }
  }

  // Dialogue system with typewriter effect
  showDialogue(speaker, lines, onComplete) {
    this.showingDialogue = true;
    this.currentDialogueLines = lines;
    this.currentDialogueLine = 0;
    this.typewriterText = '';
    this.typewriterIndex = 0;
    this.typewriterTimer = 0;
    this.waitingForDialogueAdvance = false;
    this.dialogueCallback = onComplete;

    if (this.dialogueBox) {
      const nameEl = document.getElementById('dialogue-name');
      const textEl = document.getElementById('dialogue-text');
      const hintEl = document.getElementById('dialogue-hint');

      if (nameEl) nameEl.textContent = speaker;
      if (textEl) textEl.textContent = '';
      if (hintEl) hintEl.style.display = 'none';

      this.dialogueBox.style.display = 'block';
    }
  }

  updateTypewriter(delta) {
    if (this.waitingForDialogueAdvance) return;

    const textEl = document.getElementById('dialogue-text');
    if (!textEl) return;

    const currentLine = this.currentDialogueLines[this.currentDialogueLine];
    if (!currentLine) {
      // All lines done
      this.endDialogue();
      return;
    }

    this.typewriterTimer += delta * 1000;
    if (this.typewriterTimer >= this.typewriterSpeed) {
      this.typewriterTimer = 0;
      if (this.typewriterIndex < currentLine.length) {
        this.typewriterText += currentLine[this.typewriterIndex];
        textEl.textContent = this.typewriterText;
        this.typewriterIndex++;
      } else {
        // Line complete
        this.waitingForDialogueAdvance = true;
        const hintEl = document.getElementById('dialogue-hint');
        if (hintEl) hintEl.style.display = 'block';
      }
    }
  }

  handleDialogueInput(input) {
    if (this.waitingForDialogueAdvance && input.keys.KeyE && !input.prevKeys.KeyE) {
      this.advanceDialogue();
    }
  }

  advanceDialogue() {
    this.currentDialogueLine++;
    this.typewriterText = '';
    this.typewriterIndex = 0;
    this.typewriterTimer = 0;
    this.waitingForDialogueAdvance = false;

    const textEl = document.getElementById('dialogue-text');
    const hintEl = document.getElementById('dialogue-hint');
    if (textEl) textEl.textContent = '';
    if (hintEl) hintEl.style.display = 'none';

    if (this.currentDialogueLine >= this.currentDialogueLines.length) {
      this.endDialogue();
    }
  }

  endDialogue() {
    this.showingDialogue = false;
    if (this.dialogueBox) {
      this.dialogueBox.style.display = 'none';
    }
    if (this.dialogueCallback) {
      this.dialogueCallback();
      this.dialogueCallback = null;
    }
  }

  // Side job system
  updateSideJobCooldowns(delta) {
    const now = performance.now();
    Object.keys(this.sideJobCooldowns).forEach(jobId => {
      if (now - this.sideJobCooldowns[jobId] > 30000) { // 30 second cooldown
        delete this.sideJobCooldowns[jobId];
      }
    });
  }

  startSideJob(type) {
    if (this.activeMission) return false; // Can't start side job during mission
    if (this.sideJobCooldowns[type]) return false;

    const job = SIDE_JOBS[type];
    if (!job) return false;

    // Generate random pickup and dropoff
    const pickup = this.generateRandomRoadPosition();
    const dropoff = this.generateRandomRoadPosition(pickup, job.minDistance, job.maxDistance);

    this.activeMission = {
      id: `side_${type}_${Date.now()}`,
      name: job.name,
      type: job.type,
      isSideJob: true,
      objectives: [
        `Pick up ${type === 'taxi' ? 'passenger' : 'package'}`,
        `Deliver to destination`,
      ],
      waypoints: [
        { pos: pickup, type: 'pickup', label: type === 'taxi' ? 'Passenger' : 'Pickup', radius: 3 },
        { pos: dropoff, type: 'destination', label: 'Destination', radius: 5 },
      ],
      reward: job.baseReward + Math.floor(pickup.distanceTo(dropoff) * 0.5),
      timeLimit: job.timeLimit || (pickup.distanceTo(dropoff) * (job.timePerDistance || 0.5)),
    };

    this.currentWaypointIndex = 0;
    this.missionTimer = 0;
    this.missionTimeLimit = this.activeMission.timeLimit;

    this.spawnSideJobEntities();
    this.updateWaypoint();
    this.showObjective(this.activeMission.objectives[0]);

    return true;
  }

  spawnSideJobEntities() {
    if (!this.activeMission || !this.activeMission.isSideJob) return;

    const job = SIDE_JOBS[this.activeMission.type.replace('side_', '')];
    const firstWP = this.activeMission.waypoints[0];

    if (job.type === MISSION_TYPE.SIDE_TAXI || job.type === MISSION_TYPE.SIDE_COURIER) {
      // Spawn a vehicle at pickup
      const vehicleType = job.useBoat ? 'SPEEDBOAT' : 'SEDAN';
      if (job.useBoat) {
        this.missionVehicle = new Boat(this.world, vehicleType, firstWP.pos.x, firstWP.pos.z, 0);
      } else {
        this.missionVehicle = new Vehicle(this.world, vehicleType, firstWP.pos.x, firstWP.pos.z, 0);
      }
      this.missionVehicle.mesh.userData.isMissionVehicle = true;
      this.addVehicleMarker(this.missionVehicle);
    }
  }

  generateRandomRoadPosition(avoidPos, minDist, maxDist) {
    const nodes = this.world.roadNodes;
    if (!nodes || nodes.length === 0) {
      return new THREE.Vector3(0, 0, 0);
    }

    let bestNode = null;
    let bestDist = -1;

    for (let i = 0; i < 10; i++) {
      const node = prng.choice(nodes);
      const pos = new THREE.Vector3(node.pos.x, 0, node.pos.y);
      let dist = Infinity;
      if (avoidPos) {
        dist = pos.distanceTo(avoidPos);
      }
      if (dist >= minDist && dist <= maxDist && dist > bestDist) {
        bestDist = dist;
        bestNode = node;
      }
    }

    if (bestNode) {
      return new THREE.Vector3(bestNode.pos.x, 0, bestNode.pos.y);
    }

    // Fallback
    const node = prng.choice(nodes);
    return new THREE.Vector3(node.pos.x, 0, node.pos.y);
  }

  // Get minimap blip data for current mission
  getMissionBlips() {
    const blips = [];

    // Mara marker (always show if story not complete)
    if (this.storyProgress < STORY_MISSIONS.length) {
      blips.push(this.missionBlip);
    }

    // Active mission waypoint
    if (this.currentWaypointBlip) {
      blips.push(this.currentWaypointBlip);
    }

    // Mission vehicle
    if (this.missionVehicle) {
      blips.push({
        position: new THREE.Vector2(this.missionVehicle.mesh.position.x, this.missionVehicle.mesh.position.z),
        color: '#00ff88',
        label: 'V',
        pulse: true,
      });
    }

    // Targets
    this.missionTargets.forEach(t => {
      blips.push({
        position: new THREE.Vector2(t.position.x, t.position.z),
        color: '#ff0000',
        label: 'T',
        pulse: true,
      });
    });

    // Pickups
    this.missionPickups.forEach(p => {
      if (!p.userData.collected) {
        blips.push({
          position: new THREE.Vector2(p.position.x, p.position.z),
          color: '#ffcc00',
          label: 'P',
          pulse: true,
        });
      }
    });

    return blips;
  }

  // Save/load mission progress
  getSaveData() {
    return {
      storyProgress: this.storyProgress,
      missionProgress: this.missionProgress,
      sideJobCooldowns: this.sideJobCooldowns,
    };
  }

  loadSaveData(data) {
    if (!data) return;
    this.storyProgress = data.storyProgress || 0;
    this.missionProgress = data.missionProgress || this.missionProgress;
    this.sideJobCooldowns = data.sideJobCooldowns || {};

    // Reactivate available missions
    STORY_MISSIONS.forEach((m, i) => {
      const prog = this.missionProgress[m.id];
      if (prog && prog.state === MISSION_STATE.AVAILABLE && i <= this.storyProgress) {
        // Marker already exists
      }
    });
  }

  dispose() {
    // Clean up UI
    if (this.objectiveText) this.objectiveText.remove();
    if (this.dialogueBox) this.dialogueBox.remove();
    if (this.completionBanner) this.completionBanner.remove();

    // Clean up 3D objects
    if (this.missionMarker) {
      this.world.scene.remove(this.missionMarker);
      this.missionMarker.geometry.dispose();
      this.missionMarker.material.dispose();
    }

    this.cleanupMission();
  }
}

// Export init function matching module style
export function createMissionSystem(world, player, traffic, police) {
  return new MissionSystem(world, player, traffic, police);
}

// Export constants for external use
export { MISSION_STATE, MISSION_TYPE, STORY_MISSIONS, SIDE_JOBS };