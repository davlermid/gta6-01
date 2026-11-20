// MONSOON ISLES - Audio System
// WebAudio procedural: engine hum, boat motor, gunshot, siren, rain, thunder, footsteps, UI clicks, cash, ambient synthwave

export class AudioSystem {
  constructor() {
    this.audioContext = null;
    this.masterGain = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.ambientGain = null;

    // Volume settings (0-1)
    this.masterVolume = 1.0;
    this.musicVolume = 0.3;
    this.sfxVolume = 0.7;
    this.ambientVolume = 0.5;

    // Audio state
    this.isInitialized = false;
    this.isMuted = false;

    // Procedural audio nodes
    this.engineOsc = null;
    this.engineGain = null;
    this.boatOsc = null;
    this.boatGain = null;
    this.ambientPad = null;
    this.ambientBass = null;
    this.ambientGainNode = null;
    this.rainNoise = null;
    this.rainGain = null;
    this.thunderTimeout = null;

    // Engine parameters
    this.currentEngineRPM = 0;
    this.targetEngineRPM = 0;
    this.currentBoatRPM = 0;
    this.targetBoatRPM = 0;

    // Footstep timer
    this.footstepTimer = 0;
    this.footstepInterval = 0.4;

    // One-shot audio buffers (generated on demand)
    this.gunshotBuffer = null;
    this.sirenBuffer = null;
    this.cashBuffer = null;
    this.clickBuffer = null;

    // Vehicle reference
    this.playerVehicle = null;
    this.player = null;
    this.world = null;
  }

  async init() {
    // Wait for user gesture to start audio context
    const startAudio = async () => {
      if (this.isInitialized) return;

      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      await this.audioContext.resume();

      // Create gain chain
      this.masterGain = this.audioContext.createGain();
      this.masterGain.gain.value = this.masterVolume;
      this.masterGain.connect(this.audioContext.destination);

      this.musicGain = this.audioContext.createGain();
      this.musicGain.gain.value = this.musicVolume;
      this.musicGain.connect(this.masterGain);

      this.sfxGain = this.audioContext.createGain();
      this.sfxGain.gain.value = this.sfxVolume;
      this.sfxGain.connect(this.masterGain);

      this.ambientGain = this.audioContext.createGain();
      this.ambientGain.gain.value = this.ambientVolume;
      this.ambientGain.connect(this.masterGain);

      // Generate one-shot buffers
      this.generateOneShotBuffers();

      // Start ambient synthwave
      this.startAmbientMusic();

      this.isInitialized = true;

      // Remove gesture listeners
      document.removeEventListener('click', startAudio);
      document.removeEventListener('keydown', startAudio);
      document.removeEventListener('mousedown', startAudio);
    };

    // Listen for first user gesture
    document.addEventListener('click', startAudio, { once: true });
    document.addEventListener('keydown', startAudio, { once: true });
    document.addEventListener('mousedown', startAudio, { once: true });
  }

  generateOneShotBuffers() {
    // Gunshot - sharp noise burst with pitch drop
    this.gunshotBuffer = this.createGunshotBuffer();

    // Siren - two-tone alternating
    this.sirenBuffer = this.createSirenBuffer();

    // Cash - pleasant chime
    this.cashBuffer = this.createCashBuffer();

    // UI Click - short tick
    this.clickBuffer = this.createClickBuffer();
  }

  createGunshotBuffer() {
    const sampleRate = this.audioContext.sampleRate;
    const duration = 0.3;
    const length = sampleRate * duration;
    const buffer = this.audioContext.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      // Noise burst with exponential decay
      const noise = (Math.random() * 2 - 1) * Math.exp(-t * 30);
      // Add a quick pitch drop for "crack"
      const pitch = Math.sin(2 * Math.PI * 150 * t * Math.exp(-t * 20)) * 0.3 * Math.exp(-t * 15);
      data[i] = (noise + pitch) * 0.5;
    }
    return buffer;
  }

  createSirenBuffer() {
    const sampleRate = this.audioContext.sampleRate;
    const duration = 1.0; // One cycle (up + down)
    const length = sampleRate * duration;
    const buffer = this.audioContext.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      // Two-tone: 800Hz <-> 1200Hz
      const freq = 800 + 400 * Math.sin(2 * Math.PI * t);
      const phase = 2 * Math.PI * freq * t;
      data[i] = Math.sin(phase) * 0.3 * (0.5 + 0.5 * Math.sin(2 * Math.PI * t));
    }
    return buffer;
  }

  createCashBuffer() {
    const sampleRate = this.audioContext.sampleRate;
    const duration = 0.4;
    const length = sampleRate * duration;
    const buffer = this.audioContext.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);

    // Pleasant major chord arpeggio
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    const noteDuration = duration / notes.length;

    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      const noteIndex = Math.floor(t / noteDuration);
      if (noteIndex >= notes.length) continue;
      const noteT = (t % noteDuration) / noteDuration;
      const freq = notes[noteIndex];
      const envelope = Math.exp(-noteT * 8);
      data[i] = Math.sin(2 * Math.PI * freq * t) * envelope * 0.2;
    }
    return buffer;
  }

  createClickBuffer() {
    const sampleRate = this.audioContext.sampleRate;
    const duration = 0.05;
    const length = sampleRate * duration;
    const buffer = this.audioContext.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      const envelope = Math.exp(-t * 80);
      // Short click with slight pitch
      data[i] = Math.sin(2 * Math.PI * 2000 * t) * envelope * 0.1;
    }
    return buffer;
  }

  startAmbientMusic() {
    if (!this.audioContext) return;

    // Synthwave pad - slow evolving chord
    this.ambientPad = this.audioContext.createGain();
    this.ambientPad.gain.value = 0;
    this.ambientPad.connect(this.ambientGain);

    // Multiple oscillators for rich pad
    const padOscs = [];
    const padNotes = [130.81, 164.81, 196.00, 261.63]; // C3, E3, G3, C4 (C major)
    padNotes.forEach((freq, i) => {
      const osc = this.audioContext.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq * (1 + i * 0.001); // Slight detune
      const gain = this.audioContext.createGain();
      gain.gain.value = 0.03;
      osc.connect(gain);
      gain.connect(this.ambientPad);
      osc.start();
      padOscs.push(osc);

      // Slow LFO for subtle movement
      const lfo = this.audioContext.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 0.05 + i * 0.01;
      const lfoGain = this.audioContext.createGain();
      lfoGain.gain.value = 0.005;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      lfo.start();
    });

    // Bass - deep sub
    this.ambientBass = this.audioContext.createOscillator();
    this.ambientBass.type = 'sine';
    this.ambientBass.frequency.value = 65.41; // C2
    const bassGain = this.audioContext.createGain();
    bassGain.gain.value = 0;
    this.ambientBass.connect(bassGain);
    bassGain.connect(this.ambientGain);
    this.ambientBass.start();

    // Bass pattern (simple arpeggio)
    const bassNotes = [65.41, 82.41, 98.00, 65.41]; // C2, E2, G2, C2
    let bassIndex = 0;
    const playBassNote = () => {
      if (!this.ambientBass) return;
      this.ambientBass.frequency.setValueAtTime(bassNotes[bassIndex], this.audioContext.currentTime);
      bassGain.gain.setValueAtTime(0.08, this.audioContext.currentTime);
      bassGain.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 2.5);
      bassIndex = (bassIndex + 1) % bassNotes.length;
      setTimeout(playBassNote, 3000);
    };
    playBassNote();

    // Fade in ambient
    this.ambientPad.gain.setValueAtTime(0, this.audioContext.currentTime);
    this.ambientPad.gain.linearRampToValueAtTime(0.15, this.audioContext.currentTime + 5);
    bassGain.gain.setValueAtTime(0, this.audioContext.currentTime);
    bassGain.gain.linearRampToValueAtTime(0.08, this.audioContext.currentTime + 5);
  }

  setPlayer(player, vehicle, world) {
    this.player = player;
    this.playerVehicle = vehicle;
    this.world = world;
  }

  update(delta) {
    if (!this.isInitialized || this.isMuted) return;

    this.updateEngineSound(delta);
    this.updateBoatSound(delta);
    this.updateRainSound(delta);
    this.updateFootsteps(delta);
    this.updateSirenSounds(delta);
  }

  updateEngineSound(delta) {
    if (!this.playerVehicle || this.playerVehicle.type !== 'car') {
      // Fade out engine
      if (this.engineGain && this.engineGain.gain.value > 0) {
        this.engineGain.gain.value = Math.max(0, this.engineGain.gain.value - delta * 2);
      }
      return;
    }

    // Initialize engine oscillator if needed
    if (!this.engineOsc) {
      this.engineOsc = this.audioContext.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineGain = this.audioContext.createGain();
      this.engineGain.gain.value = 0;

      // Add harmonics for richer engine sound
      const filter = this.audioContext.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 800;
      filter.Q.value = 2;

      this.engineOsc.connect(filter);
      filter.connect(this.engineGain);
      this.engineGain.connect(this.sfxGain);
      this.engineOsc.start();
    }

    // Calculate target RPM based on vehicle speed
    const speedRatio = Math.abs(this.playerVehicle.speed) / this.playerVehicle.maxSpeed;
    this.targetEngineRPM = 800 + speedRatio * 5000; // 800-5800 RPM

    // Smooth RPM
    this.currentEngineRPM += (this.targetEngineRPM - this.currentEngineRPM) * delta * 5;

    // Update oscillator frequency (base frequency * RPM factor)
    const baseFreq = 55; // Low A
    const rpmFactor = this.currentEngineRPM / 1000;
    this.engineOsc.frequency.setValueAtTime(baseFreq * rpmFactor, this.audioContext.currentTime);

    // Volume based on throttle
    const targetGain = 0.1 + speedRatio * 0.3;
    this.engineGain.gain.value = THREE.MathUtils.lerp(this.engineGain.gain.value, targetGain, delta * 5);

    // Add subtle vibrato
    if (!this.engineVibrato) {
      this.engineVibrato = this.audioContext.createOscillator();
      this.engineVibrato.type = 'sine';
      this.engineVibrato.frequency.value = 15;
      const vibratoGain = this.audioContext.createGain();
      vibratoGain.gain.value = 2;
      this.engineVibrato.connect(vibratoGain);
      vibratoGain.connect(this.engineOsc.frequency);
      this.engineVibrato.start();
    }
  }

  updateBoatSound(delta) {
    if (!this.playerVehicle || this.playerVehicle.type !== 'boat') {
      if (this.boatGain && this.boatGain.gain.value > 0) {
        this.boatGain.gain.value = Math.max(0, this.boatGain.gain.value - delta * 2);
      }
      return;
    }

    if (!this.boatOsc) {
      this.boatOsc = this.audioContext.createOscillator();
      this.boatOsc.type = 'square';
      this.boatGain = this.audioContext.createGain();
      this.boatGain.gain.value = 0;

      const filter = this.audioContext.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 400;
      filter.Q.value = 1;

      this.boatOsc.connect(filter);
      filter.connect(this.boatGain);
      this.boatGain.connect(this.sfxGain);
      this.boatOsc.start();

      // Propeller "chop" LFO
      this.boatChop = this.audioContext.createOscillator();
      this.boatChop.type = 'square';
      this.boatChop.frequency.value = 8;
      const chopGain = this.audioContext.createGain();
      chopGain.gain.value = 0;
      this.boatChop.connect(chopGain);
      chopGain.connect(this.boatGain.gain);
      this.boatChop.start();
      this.boatChopGain = chopGain;
    }

    const speedRatio = Math.abs(this.playerVehicle.speed) / this.playerVehicle.maxSpeed;
    this.targetBoatRPM = 600 + speedRatio * 3000;
    this.currentBoatRPM += (this.targetBoatRPM - this.currentBoatRPM) * delta * 3;

    const baseFreq = 40;
    this.boatOsc.frequency.setValueAtTime(baseFreq * (this.currentBoatRPM / 1000), this.audioContext.currentTime);

    const targetGain = 0.15 + speedRatio * 0.4;
    this.boatGain.gain.value = THREE.MathUtils.lerp(this.boatGain.gain.value, targetGain, delta * 3);

    // Propeller chop intensity
    this.boatChopGain.gain.value = 0.05 + speedRatio * 0.15;
    this.boatChop.frequency.setValueAtTime(6 + speedRatio * 10, this.audioContext.currentTime);
  }

  updateRainSound(delta) {
    if (!this.world) return;

    const targetIntensity = this.world.rainIntensity || 0;

    if (targetIntensity > 0.05) {
      if (!this.rainNoise) {
        // Create rain noise buffer
        const bufferSize = this.audioContext.sampleRate * 2; // 2 seconds
        const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = (Math.random() * 2 - 1) * 0.3;
        }

        this.rainNoise = this.audioContext.createBufferSource();
        this.rainNoise.buffer = buffer;
        this.rainNoise.loop = true;

        this.rainGain = this.audioContext.createGain();
        this.rainGain.gain.value = 0;

        // High-pass filter for rain sound
        const filter = this.audioContext.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 800;
        filter.Q.value = 0.5;

        this.rainNoise.connect(filter);
        filter.connect(this.rainGain);
        this.rainGain.connect(this.ambientGain);
        this.rainNoise.start();
      }

      this.rainGain.gain.value = THREE.MathUtils.lerp(this.rainGain.gain.value, targetIntensity * 0.4, delta * 2);

      // Random thunder
      if (this.world.weather === 'storm' && Math.random() < 0.0001) {
        this.playThunder();
      }
    } else if (this.rainNoise) {
      this.rainGain.gain.value = Math.max(0, this.rainGain.gain.value - delta);
      if (this.rainGain.gain.value <= 0) {
        this.rainNoise.stop();
        this.rainNoise = null;
        this.rainGain = null;
      }
    }
  }

  playThunder() {
    if (!this.audioContext) return;

    const now = this.audioContext.currentTime;
    const duration = 2 + Math.random() * 3;

    // Thunder: filtered noise with slow envelope
    const bufferSize = this.audioContext.sampleRate * duration;
    const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      const t = i / this.audioContext.sampleRate;
      const envelope = Math.exp(-t * 0.8) * (1 - Math.exp(-t * 20));
      data[i] = (Math.random() * 2 - 1) * envelope * 0.5;
    }

    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;

    const filter = this.audioContext.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 200;
    filter.Q.value = 1;

    const gain = this.audioContext.createGain();
    gain.gain.value = 0.3;

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    source.start(now);

    // Rumble after flash (delayed)
    setTimeout(() => {
      if (this.ambientGain) {
        const rumbleGain = this.audioContext.createGain();
        rumbleGain.gain.value = 0;
        const rumbleOsc = this.audioContext.createOscillator();
        rumbleOsc.type = 'sine';
        rumbleOsc.frequency.value = 30;
        rumbleOsc.connect(rumbleGain);
        rumbleGain.connect(this.sfxGain);
        rumbleOsc.start();
        rumbleGain.gain.setValueAtTime(0.1, this.audioContext.currentTime);
        rumbleGain.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 1.5);
        rumbleOsc.stop(this.audioContext.currentTime + 1.5);
      }
    }, 500 + Math.random() * 2000); // Thunder arrives after lightning
  }

  updateFootsteps(delta) {
    if (!this.player || this.player.isInVehicle) return;
    if (this.player.speed < 2) return;

    this.footstepTimer -= delta;
    const interval = this.player.isSprinting ? 0.25 : 0.45;

    if (this.footstepTimer <= 0) {
      this.footstepTimer = interval;
      this.playFootstep();
    }
  }

  playFootstep() {
    if (!this.audioContext) return;

    const now = this.audioContext.currentTime;
    const isOnRoad = this.world && this.world.isOnRoad(this.player.position.x, this.player.position.z);

    // Short noise burst
    const bufferSize = this.audioContext.sampleRate * 0.1;
    const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      const t = i / this.audioContext.sampleRate;
      const envelope = Math.exp(-t * 50);
      data[i] = (Math.random() * 2 - 1) * envelope * (isOnRoad ? 0.15 : 0.1);
    }

    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;

    const filter = this.audioContext.createBiquadFilter();
    filter.type = isOnRoad ? 'bandpass' : 'lowpass';
    filter.frequency.value = isOnRoad ? 2000 : 300;
    filter.Q.value = 2;

    const gain = this.audioContext.createGain();
    gain.gain.value = 0.3;

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    source.start(now);
  }

  updateSirenSounds(delta) {
    if (!this.world || !this.world.policeSystem) return;

    const police = [...this.world.policeSystem.policeCars, ...this.world.policeSystem.policeBoats];
    police.forEach(p => {
      if (!p.sirenAudio) {
        // Create siren oscillator
        p.sirenAudio = {
          osc: this.audioContext.createOscillator(),
          gain: this.audioContext.createGain(),
          filter: this.audioContext.createBiquadFilter(),
        };
        p.sirenAudio.osc.type = 'square';
        p.sirenAudio.filter.type = 'bandpass';
        p.sirenAudio.filter.frequency.value = 1000;
        p.sirenAudio.filter.Q.value = 5;
        p.sirenAudio.gain.gain.value = 0;
        p.sirenAudio.osc.connect(p.sirenAudio.filter);
        p.sirenAudio.filter.connect(p.sirenAudio.gain);
        p.sirenAudio.gain.connect(this.sfxGain);
        p.sirenAudio.osc.start();
        p.sirenAudio.phase = 0;
      }

      // Update siren based on visual state
      const isActive = p.sirenOn;
      const dist = p.mesh.position.distanceTo(this.player.position);
      const volume = isActive ? Math.max(0, 0.4 * (1 - dist / 100)) : 0;

      p.sirenAudio.gain.gain.value = THREE.MathUtils.lerp(p.sirenAudio.gain.gain.value, volume, delta * 5);

      if (isActive) {
        p.sirenAudio.phase += delta * 4; // 2 cycles per second
        const freq = 800 + 400 * Math.sin(p.sirenAudio.phase * Math.PI);
        p.sirenAudio.osc.frequency.setValueAtTime(freq, this.audioContext.currentTime);
      }
    });
  }

  // One-shot sound effects
  playGunshot(position) {
    if (!this.isInitialized || this.isMuted) return;
    this.playBufferAtPosition(this.gunshotBuffer, position, 0.5);
  }

  playSiren(position) {
    if (!this.isInitialized || this.isMuted) return;
    this.playBufferAtPosition(this.sirenBuffer, position, 0.4, true);
  }

  playCashSound() {
    if (!this.isInitialized || this.isMuted) return;
    this.playBuffer(this.cashBuffer, this.sfxGain, 0.4);
  }

  playClickSound() {
    if (!this.isInitialized || this.isMuted) return;
    this.playBuffer(this.clickBuffer, this.sfxGain, 0.2);
  }

  playExplosion(position) {
    if (!this.isInitialized || this.isMuted) return;
    const buffer = this.createExplosionBuffer();
    this.playBufferAtPosition(buffer, position, 0.8);
  }

  createExplosionBuffer() {
    const sampleRate = this.audioContext.sampleRate;
    const duration = 1.5;
    const length = sampleRate * duration;
    const buffer = this.audioContext.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      const envelope = Math.exp(-t * 1.5) * (1 - Math.exp(-t * 10));
      // Low-frequency rumble + noise
      const rumble = Math.sin(2 * Math.PI * 40 * t * Math.exp(-t * 2)) * 0.3;
      const noise = (Math.random() * 2 - 1) * 0.5;
      data[i] = (rumble + noise) * envelope;
    }
    return buffer;
  }

  playBuffer(buffer, destinationGain, volume = 1) {
    if (!this.audioContext || !buffer) return;
    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    const gain = this.audioContext.createGain();
    gain.gain.value = volume;
    source.connect(gain);
    gain.connect(destinationGain);
    source.start();
    return source;
  }

  playBufferAtPosition(buffer, position, volume = 1, loop = false) {
    if (!this.audioContext || !buffer || !this.player) return;

    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.loop = loop;

    // Panner for 3D positioning
    const panner = this.audioContext.createPanner();
    panner.panningModel = 'HRTF';
    panner.distanceModel = 'inverse';
    panner.refDistance = 5;
    panner.maxDistance = 150;
    panner.rolloffFactor = 1;
    panner.positionX.setValueAtTime(position.x, this.audioContext.currentTime);
    panner.positionY.setValueAtTime(position.y, this.audioContext.currentTime);
    panner.positionZ.setValueAtTime(position.z, this.audioContext.currentTime);

    const gain = this.audioContext.createGain();
    gain.gain.value = volume;

    source.connect(panner);
    panner.connect(gain);
    gain.connect(this.sfxGain);

    source.start();
    return source;
  }

  // Volume controls
  setMasterVolume(vol) {
    this.masterVolume = THREE.MathUtils.clamp(vol, 0, 1);
    if (this.masterGain) this.masterGain.gain.value = this.masterVolume;
  }

  setMusicVolume(vol) {
    this.musicVolume = THREE.MathUtils.clamp(vol, 0, 1);
    if (this.musicGain) this.musicGain.gain.value = this.musicVolume;
  }

  setSfxVolume(vol) {
    this.sfxVolume = THREE.MathUtils.clamp(vol, 0, 1);
    if (this.sfxGain) this.sfxGain.gain.value = this.sfxVolume;
  }

  setAmbientVolume(vol) {
    this.ambientVolume = THREE.MathUtils.clamp(vol, 0, 1);
    if (this.ambientGain) this.ambientGain.gain.value = this.ambientVolume;
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.masterGain) this.masterGain.gain.value = this.isMuted ? 0 : this.masterVolume;
  }

  getVolumeSettings() {
    return {
      master: this.masterVolume,
      music: this.musicVolume,
      sfx: this.sfxVolume,
      ambient: this.ambientVolume,
      muted: this.isMuted,
    };
  }

  applyVolumeSettings(settings) {
    if (settings.master !== undefined) this.setMasterVolume(settings.master);
    if (settings.music !== undefined) this.setMusicVolume(settings.music);
    if (settings.sfx !== undefined) this.setSfxVolume(settings.sfx);
    if (settings.ambient !== undefined) this.setAmbientVolume(settings.ambient);
    if (settings.muted !== undefined && settings.muted !== this.isMuted) this.toggleMute();
  }

  dispose() {
    if (this.engineOsc) { this.engineOsc.stop(); this.engineOsc.disconnect(); }
    if (this.boatOsc) { this.boatOsc.stop(); this.boatOsc.disconnect(); }
    if (this.ambientPad) { this.ambientPad.disconnect(); }
    if (this.ambientBass) { this.ambientBass.stop(); this.ambientBass.disconnect(); }
    if (this.rainNoise) { this.rainNoise.stop(); this.rainNoise.disconnect(); }
    if (this.audioContext) { this.audioContext.close(); }
  }
}

export function createAudioSystem() {
  return new AudioSystem();
}