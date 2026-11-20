// MONSOON ISLES - Save System
// localStorage save/load (money, health, missions, position, wanted, weapons, settings)
// Autosave on mission complete, Continue on title screen

const SAVE_KEY = 'monsoon_isles_save';
const SETTINGS_KEY = 'monsoon_isles_settings';

export class SaveSystem {
  constructor(player, world, missions, combat, audio, hud) {
    this.player = player;
    this.world = world;
    this.missions = missions;
    this.combat = combat;
    this.audio = audio;
    this.hud = hud;

    this.autosaveTimer = 0;
    this.autosaveInterval = 30; // seconds
    this.lastSaveSlot = 'auto';
  }

  // Collect all game state into a save object
  collectSaveData() {
    const data = {
      version: 1,
      timestamp: Date.now(),
      seed: this.world.prng.seed,

      // Player state
      player: {
        position: { x: this.player.position.x, y: this.player.position.y, z: this.player.position.z },
        rotation: this.player.rotation,
        health: this.player.health,
        maxHealth: this.player.maxHealth,
        stamina: this.player.stamina,
        maxStamina: this.player.maxStamina,
        money: this.player.money,
        armor: this.player.armor || 0,
        wantedLevel: this.player.wantedLevel,
        wantedTimer: this.player.wantedTimer,
        isInVehicle: this.player.isInVehicle,
      },

      // Vehicle state (if in vehicle)
      vehicle: this.player.isInVehicle && this.player.vehicle ? {
        type: this.player.vehicle.type,
        specs: this.player.vehicle.specs,
        position: { x: this.player.vehicle.mesh.position.x, y: this.player.vehicle.mesh.position.y, z: this.player.vehicle.mesh.position.z },
        rotation: this.player.vehicle.rotation,
        speed: this.player.vehicle.speed,
        health: this.player.vehicle.health || 100,
      } : null,

      // Combat state
      combat: this.combat ? {
        weapon: this.combat.weapon,
        hasWeapon: this.combat.hasWeapon,
        isArmed: this.combat.isArmed,
        ammo: this.combat.ammo,
        ammoInClip: this.combat.ammoInClip,
      } : null,

      // Mission progress
      missions: this.missions ? this.missions.getSaveData() : null,

      // World state
      world: {
        timeOfDay: this.world.timeOfDay,
        weather: this.world.weather,
        rainIntensity: this.world.rainIntensity,
      },

      // Settings
      settings: this.getSettings(),
    };

    return data;
  }

  // Save to localStorage
  save(slot = 'auto') {
    try {
      const data = this.collectSaveData();
      data.slot = slot;
      localStorage.setItem(`${SAVE_KEY}_${slot}`, JSON.stringify(data));

      // Update save list
      this.updateSaveList(slot);

      if (slot !== 'auto') {
        this.hud?.showToast(`Game saved to slot ${slot}`, 2000, '#0f0');
      }
      return true;
    } catch (e) {
      console.error('Save failed:', e);
      this.hud?.showToast('Save failed!', 2000, '#f00');
      return false;
    }
  }

  // Load from localStorage
  load(slot = 'auto') {
    try {
      const data = JSON.parse(localStorage.getItem(`${SAVE_KEY}_${slot}`));
      if (!data) return false;

      this.applySaveData(data);
      this.lastSaveSlot = slot;
      this.hud?.showToast(`Game loaded from slot ${slot}`, 2000, '#0f0');
      return true;
    } catch (e) {
      console.error('Load failed:', e);
      this.hud?.showToast('Load failed!', 2000, '#f00');
      return false;
    }
  }

  // Apply loaded save data to game systems
  applySaveData(data) {
    // Restore PRNG seed
    this.world.prng.seed = data.seed;
    this.world.prng.state = data.seed;

    // Restore player state
    this.player.position.set(data.player.position.x, data.player.position.y, data.player.position.z);
    this.player.rotation = data.player.rotation;
    this.player.health = data.player.health;
    this.player.maxHealth = data.player.maxHealth;
    this.player.stamina = data.player.stamina;
    this.player.maxStamina = data.player.maxStamina;
    this.player.money = data.player.money;
    this.player.armor = data.player.armor || 0;
    this.player.wantedLevel = data.player.wantedLevel;
    this.player.wantedTimer = data.player.wantedTimer;

    // Restore vehicle if player was in one
    if (data.vehicle && data.player.isInVehicle) {
      // Vehicle will be recreated by traffic system, we just mark that player should enter one
      this.player._pendingVehicleEntry = data.vehicle;
    }

    // Restore combat state
    if (this.combat && data.combat) {
      this.combat.weapon = data.combat.weapon;
      this.combat.hasWeapon = data.combat.hasWeapon;
      this.combat.isArmed = data.combat.isArmed;
      this.combat.ammo = data.combat.ammo;
      this.combat.ammoInClip = data.combat.ammoInClip;
    }

    // Restore mission progress
    if (this.missions && data.missions) {
      this.missions.loadSaveData(data.missions);
    }

    // Restore world state
    this.world.timeOfDay = data.world.timeOfDay;
    this.world.setWeather(data.world.weather);
    this.world.rainIntensity = data.world.rainIntensity;
    this.world.targetRainIntensity = data.world.rainIntensity;

    // Restore settings
    if (data.settings) {
      this.applySettings(data.settings);
    }

    // Update HUD
    this.hud?.update(0);
  }

  // Autosave periodically and on mission complete
  update(delta) {
    this.autosaveTimer += delta;
    if (this.autosaveTimer >= this.autosaveInterval) {
      this.autosaveTimer = 0;
      this.save('auto');
    }
  }

  // Call when mission completes
  onMissionComplete() {
    this.save('auto');
    this.save('mission_' + Date.now()); // Keep a named backup
  }

  // Get list of available saves
  getSaveList() {
    const list = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith(SAVE_KEY + '_')) {
        const slot = key.replace(SAVE_KEY + '_', '');
        try {
          const data = JSON.parse(localStorage.getItem(key));
          list.push({
            slot,
            timestamp: data.timestamp,
            money: data.player?.money || 0,
            health: data.player?.health || 100,
            wantedLevel: data.player?.wantedLevel || 0,
            storyProgress: data.missions?.storyProgress || 0,
            timeOfDay: data.world?.timeOfDay || 0.25,
          });
        } catch (e) {
          // Corrupted save
        }
      }
    }
    // Sort by timestamp descending
    list.sort((a, b) => b.timestamp - a.timestamp);
    return list;
  }

  updateSaveList(slot) {
    // Could update a save list index for faster listing
  }

  deleteSave(slot) {
    localStorage.removeItem(`${SAVE_KEY}_${slot}`);
  }

  // Settings management
  getDefaultSettings() {
    return {
      masterVolume: 1.0,
      musicVolume: 0.3,
      sfxVolume: 0.7,
      ambientVolume: 0.5,
      graphicsQuality: 'high', // low, medium, high
      vsync: true,
      fov: 60,
      mouseSensitivity: 1.0,
      invertY: false,
      showHUD: true,
      showMinimap: true,
      subtitles: true,
    };
  }

  getSettings() {
    try {
      const saved = localStorage.getItem(SETTINGS_KEY);
      if (saved) {
        return { ...this.getDefaultSettings(), ...JSON.parse(saved) };
      }
    } catch (e) {
      console.error('Failed to load settings:', e);
    }
    return this.getDefaultSettings();
  }

  saveSettings(settings) {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      return true;
    } catch (e) {
      console.error('Failed to save settings:', e);
      return false;
    }
  }

  applySettings(settings) {
    // Apply to audio
    if (this.audio) {
      this.audio.applyVolumeSettings(settings);
    }

    // Apply to renderer (quality)
    if (this.world && this.world.scene) {
      // Quality settings would affect renderer/shadows
      // This is handled in main.js
    }

    // Apply to player (mouse sensitivity, invertY)
    if (this.player) {
      this.player.mouseSensitivity = settings.mouseSensitivity || 1.0;
      this.player.invertY = settings.invertY || false;
    }
  }

  // Quick save/load (F5/F9)
  quickSave() {
    return this.save('quick');
  }

  quickLoad() {
    return this.load('quick');
  }

  // Check if continue should be enabled on title screen
  hasSaveGame() {
    return localStorage.getItem(`${SAVE_KEY}_auto`) !== null ||
           localStorage.getItem(`${SAVE_KEY}_quick`) !== null;
  }

  // Get most recent save slot for Continue button
  getLatestSaveSlot() {
    const list = this.getSaveList();
    if (list.length > 0) return list[0].slot;
    return 'auto';
  }

  // Export save data (for backup)
  exportSave(slot = 'auto') {
    const data = localStorage.getItem(`${SAVE_KEY}_${slot}`);
    if (data) {
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `monsoon_isles_save_${slot}_${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }

  // Import save data
  importSave(file, slot = 'imported') {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          localStorage.setItem(`${SAVE_KEY}_${slot}`, JSON.stringify(data));
          this.hud?.showToast(`Save imported as ${slot}`, 2000, '#0f0');
          resolve(true);
        } catch (err) {
          this.hud?.showToast('Invalid save file', 2000, '#f00');
          reject(err);
        }
      };
      reader.readAsText(file);
    });
  }
}

export function createSaveSystem(player, world, missions, combat, audio, hud) {
  return new SaveSystem(player, world, missions, combat, audio, hud);
}