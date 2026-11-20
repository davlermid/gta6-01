// MONSOON ISLES - HUD System
// Circular minimap (2D canvas), health+armor bars, money, wanted stars, weapon/ammo, speedometer, mission objective banner, dialogue box, toasts, pause menu, death/busted screens
import * as THREE from 'three';
import { WORLD_SIZE, ISLAND_CENTERS } from './world.js';

export class HUDSystem {
  constructor(world, player, traffic, missions, input) {
    this.world = world;
    this.player = player;
    this.traffic = traffic;
    this.missions = missions;
    this.input = input;
    
    // Canvas for minimap
    this.minimapCanvas = document.getElementById('minimap');
    this.minimapCtx = this.minimapCanvas.getContext('2d');
    this.minimapSize = 180;
    
    // DOM elements
    this.healthFill = document.querySelector('#health-bar .bar-fill');
    this.staminaFill = document.querySelector('#stamina-bar .bar-fill');
    this.moneyEl = document.getElementById('money');
    this.stars = document.querySelectorAll('#stars .star');
    this.missionBanner = document.getElementById('mission-banner');
    
    // Additional HUD elements (created dynamically)
    this.weaponInfo = null;
    this.ammoInfo = null;
    this.speedometer = null;
    this.armorFill = null;
    this.toastContainer = null;
    this.deathScreen = null;
    this.bustedScreen = null;
    
    // State
    this.wantedFlashTimer = 0;
    this.wantedFlashVisible = true;
    this.lastWantedLevel = 0;
    this.toasts = [];
    
    this.createExtraHUD();
    this.createPauseMenu();
    this.createDeathScreens();
  }
  
  createExtraHUD() {
    // Weapon/Ammo display (bottom right)
    this.weaponInfo = document.createElement('div');
    this.weaponInfo.id = 'weapon-info';
    this.weaponInfo.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 220px;
      background: rgba(0, 20, 40, 0.8);
      border: 2px solid #444;
      border-radius: 8px;
      padding: 10px 16px;
      color: #fff;
      font-family: 'Courier New', monospace;
      font-size: 14px;
      display: none;
      z-index: 50;
      min-width: 120px;
      text-align: right;
    `;
    this.weaponInfo.innerHTML = `
      <div id="weapon-name" style="color: #0ff; font-weight: bold;"></div>
      <div id="ammo-count" style="color: #ff0; font-size: 18px;"></div>
    `;
    document.body.appendChild(this.weaponInfo);
    
    // Speedometer (bottom center)
    this.speedometer = document.createElement('div');
    this.speedometer.id = 'speedometer';
    this.speedometer.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0, 20, 40, 0.8);
      border: 2px solid #444;
      border-radius: 8px;
      padding: 8px 20px;
      color: #0ff;
      font-family: 'Courier New', monospace;
      font-size: 24px;
      font-weight: bold;
      display: none;
      z-index: 50;
      text-shadow: 0 0 8px #0ff;
    `;
    this.speedometer.textContent = '0 km/h';
    document.body.appendChild(this.speedometer);
    
    // Armor bar (below stamina)
    const barsContainer = document.getElementById('bars');
    this.armorFill = document.createElement('div');
    this.armorFill.style.cssText = `
      width: 200px; height: 12px;
      background: rgba(0, 0, 0, 0.6);
      border: 1px solid #444;
      border-radius: 2px;
      overflow: hidden;
      display: none;
    `;
    this.armorFill.innerHTML = '<div class="bar-fill" style="width: 0%; height: 100%; background: linear-gradient(90deg, #04f, #0af);"></div>';
    barsContainer.appendChild(this.armorFill);
    
    // Toast container (top center)
    this.toastContainer = document.createElement('div');
    this.toastContainer.id = 'toast-container';
    this.toastContainer.style.cssText = `
      position: fixed;
      top: 80px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      z-index: 100;
      pointer-events: none;
    `;
    document.body.appendChild(this.toastContainer);
  }
  
  createPauseMenu() {
    const pauseScreen = document.getElementById('pause-screen');
    pauseScreen.innerHTML = `
      <h2>PAUSED</h2>
      <div class="pause-menu" style="display: flex; flex-direction: column; gap: 12px;">
        <button id="btn-resume" class="pause-btn">Resume</button>
        <button id="btn-save" class="pause-btn">Save Game</button>
        <button id="btn-load" class="pause-btn">Load Game</button>
        <button id="btn-controls" class="pause-btn">Controls</button>
        <button id="btn-quality" class="pause-btn">Quality: High</button>
        <button id="btn-volume" class="pause-btn">Volume: 100%</button>
        <button id="btn-quit" class="pause-btn">Quit to Title</button>
      </div>
    `;
    
    const style = document.createElement('style');
    style.textContent = `
      .pause-btn {
        background: rgba(255, 200, 0, 0.1);
        border: 2px solid #fa0;
        color: #ff0;
        padding: 12px 32px;
        font-size: 18px;
        cursor: pointer;
        transition: all 0.2s;
        font-family: 'Courier New', monospace;
      }
      .pause-btn:hover { background: #fa0; color: #000; box-shadow: 0 0 20px #fa0; }
      .controls-overlay {
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0, 0, 0, 0.9); z-index: 300;
        display: none; flex-direction: column; align-items: center; justify-content: center;
        color: #fff; font-family: 'Courier New', monospace; gap: 16px;
      }
      .controls-overlay h3 { color: #ff0; font-size: 24px; }
      .controls-overlay ul { text-align: left; line-height: 2; font-size: 16px; }
      .controls-overlay button { margin-top: 20px; }
    `;
    document.head.appendChild(style);
    
    // Controls overlay
    this.controlsOverlay = document.createElement('div');
    this.controlsOverlay.className = 'controls-overlay';
    this.controlsOverlay.innerHTML = `
      <h3>CONTROLS</h3>
      <ul>
        <li>WASD - Move / Drive</li>
        <li>Shift - Sprint / Boost</li>
        <li>Space - Jump / Handbrake</li>
        <li>Mouse - Look / Aim</li>
        <li>E - Enter/Exit Vehicle</li>
        <li>1 - Draw/Holster Weapon</li>
        <li>R - Reload</li>
        <li>Left Click - Fire</li>
        <li>Esc - Pause Menu</li>
        <li>F11 - Fullscreen</li>
      </ul>
      <button class="pause-btn" id="btn-close-controls">Back</button>
    `;
    document.body.appendChild(this.controlsOverlay);
  }
  
  createDeathScreens() {
    // Death screen (WASTED)
    this.deathScreen = document.createElement('div');
    this.deathScreen.id = 'death-screen';
    this.deathScreen.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0, 0, 0, 0.95);
      display: none; flex-direction: column; align-items: center; justify-content: center;
      z-index: 400; color: #fff; font-family: 'Courier New', monospace;
    `;
    this.deathScreen.innerHTML = `
      <div style="font-size: 72px; color: #f00; text-shadow: 0 0 30px #f00; animation: wastedPulse 0.5s ease-in-out infinite;">WASTED</div>
      <div id="death-message" style="margin-top: 20px; font-size: 18px; color: #aaa;"></div>
      <button class="pause-btn" id="btn-death-respawn" style="margin-top: 30px;">Respawn</button>
    `;
    document.body.appendChild(this.deathScreen);
    
    // Busted screen
    this.bustedScreen = document.createElement('div');
    this.bustedScreen.id = 'busted-screen';
    this.bustedScreen.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0, 0, 0, 0.95);
      display: none; flex-direction: column; align-items: center; justify-content: center;
      z-index: 400; color: #fff; font-family: 'Courier New', monospace;
    `;
    this.bustedScreen.innerHTML = `
      <div style="font-size: 72px; color: #08f; text-shadow: 0 0 30px #08f; animation: wastedPulse 0.5s ease-in-out infinite;">BUSTED</div>
      <div id="busted-message" style="margin-top: 20px; font-size: 18px; color: #aaa;"></div>
      <button class="pause-btn" id="btn-busted-respawn" style="margin-top: 30px;">Continue</button>
    `;
    document.body.appendChild(this.bustedScreen);
    
    // Add pulse animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes wastedPulse {
        0%, 100% { transform: scale(1); opacity: 1; }
        50% { transform: scale(1.05); opacity: 0.8; }
      }
    `;
    document.head.appendChild(style);
  }
  
  update(delta) {
    this.updateMinimap();
    this.updateHealthArmor();
    this.updateMoney();
    this.updateWantedStars(delta);
    this.updateWeaponAmmo();
    this.updateSpeedometer();
    this.updateMissionBanner();
    this.updateToasts(delta);
    this.updatePauseMenu();
    this.updateDeathScreens();
  }
  
  updateMinimap() {
    const ctx = this.minimapCtx;
    const size = this.minimapSize;
    const scale = size / (WORLD_SIZE * 0.5); // Show 1km radius
    
    ctx.clearRect(0, 0, size, size);
    
    // Background
    ctx.fillStyle = 'rgba(0, 20, 40, 0.9)';
    ctx.fillRect(0, 0, size, size);
    
    // Border
    ctx.strokeStyle = '#00aaff';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, size - 2, size - 2);
    
    // Water
    ctx.fillStyle = '#001a33';
    ctx.fillRect(0, 0, size, size);
    
    // Islands
    ctx.fillStyle = '#2d5a27';
    ISLAND_CENTERS.forEach(center => {
      const x = (center.x + WORLD_SIZE/2) * scale;
      const y = (center.y + WORLD_SIZE/2) * scale;
      const r = 350 * scale;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    });
    
    // Roads (ring roads)
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 2 * scale;
    ISLAND_CENTERS.forEach(center => {
      const x = (center.x + WORLD_SIZE/2) * scale;
      const y = (center.y + WORLD_SIZE/2) * scale;
      const r = 350 * 0.88 * scale;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.stroke();
    });
    
    // Bridges
    ctx.strokeStyle = '#665544';
    ctx.lineWidth = 3 * scale;
    // Bridge 0-1 (west-east)
    ctx.beginPath();
    ctx.moveTo((ISLAND_CENTERS[0].x + 350*0.88 + WORLD_SIZE/2) * scale, (WORLD_SIZE/2) * scale);
    ctx.lineTo((ISLAND_CENTERS[1].x - 350*0.88 + WORLD_SIZE/2) * scale, (WORLD_SIZE/2) * scale);
    ctx.stroke();
    // Bridge 0-2 (west-south)
    ctx.beginPath();
    ctx.moveTo((ISLAND_CENTERS[0].x + WORLD_SIZE/2) * scale, (ISLAND_CENTERS[0].y - 350*0.88 + WORLD_SIZE/2) * scale);
    ctx.lineTo((ISLAND_CENTERS[2].x + WORLD_SIZE/2) * scale, (ISLAND_CENTERS[2].y + 350*0.88 + WORLD_SIZE/2) * scale);
    ctx.stroke();
    // Bridge 1-2 (east-south)
    ctx.beginPath();
    ctx.moveTo((ISLAND_CENTERS[1].x + WORLD_SIZE/2) * scale, (ISLAND_CENTERS[1].y - 350*0.88 + WORLD_SIZE/2) * scale);
    ctx.lineTo((ISLAND_CENTERS[2].x + WORLD_SIZE/2) * scale, (ISLAND_CENTERS[2].y + 350*0.88 + WORLD_SIZE/2) * scale);
    ctx.stroke();
    
    // Mission blips
    if (this.missions) {
      const blips = this.missions.getMissionBlips();
      blips.forEach(blip => {
        const bx = (blip.position.x + WORLD_SIZE/2) * scale;
        const by = (blip.position.y + WORLD_SIZE/2) * scale;
        const dist = Math.hypot(bx - size/2, by - size/2);
        if (dist < size/2 + 10) {
          ctx.fillStyle = blip.color;
          ctx.beginPath();
          ctx.arc(bx, by, blip.pulse ? (4 + Math.sin(Date.now() * 0.005) * 2) : 4, 0, Math.PI * 2);
          ctx.fill();
          if (blip.label) {
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 10px Courier New';
            ctx.textAlign = 'center';
            ctx.fillText(blip.label, bx, by - 8);
          }
        }
      });
    }
    
    // Player
    const px = (this.player.position.x + WORLD_SIZE/2) * scale;
    const py = (this.player.position.z + WORLD_SIZE/2) * scale;
    ctx.fillStyle = '#ff0';
    ctx.beginPath();
    ctx.arc(px, py, 4, 0, Math.PI * 2);
    ctx.fill();
    
    // Player direction arrow
    ctx.strokeStyle = '#ff0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(
      px + Math.sin(this.player.rotation) * 12,
      py + Math.cos(this.player.rotation) * 12
    );
    ctx.stroke();
    
    // Vehicles
    ctx.fillStyle = '#fff';
    this.traffic.vehicles.forEach(v => {
      if (v === this.player.vehicle) return;
      const vx = (v.mesh.position.x + WORLD_SIZE/2) * scale;
      const vy = (v.mesh.position.z + WORLD_SIZE/2) * scale;
      const dist = Math.hypot(vx - px, vy - py);
      if (dist < size/2) {
        ctx.beginPath();
        ctx.arc(vx, vy, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    
    // Boats
    ctx.fillStyle = '#0ff';
    this.traffic.boats.forEach(b => {
      const bx = (b.mesh.position.x + WORLD_SIZE/2) * scale;
      const by = (b.mesh.position.z + WORLD_SIZE/2) * scale;
      const dist = Math.hypot(bx - px, by - py);
      if (dist < size/2) {
        ctx.beginPath();
        ctx.arc(bx, by, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    
    // Police
    if (this.world.policeSystem) {
      ctx.fillStyle = '#08f';
      [...this.world.policeSystem.policeCars, ...this.world.policeSystem.policeBoats].forEach(p => {
        const px2 = (p.mesh.position.x + WORLD_SIZE/2) * scale;
        const py2 = (p.mesh.position.z + WORLD_SIZE/2) * scale;
        const dist = Math.hypot(px2 - px, py2 - py);
        if (dist < size/2) {
          ctx.beginPath();
          ctx.arc(px2, py2, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      });
    }
  }
  
  updateHealthArmor() {
    if (this.healthFill) {
      this.healthFill.style.width = `${this.player.getHealthPercent() * 100}%`;
    }
    if (this.staminaFill) {
      this.staminaFill.style.width = `${this.player.getStaminaPercent() * 100}%`;
    }
    if (this.armorFill) {
      const armor = this.player.armor || 0;
      const armorFill = this.armorFill.querySelector('.bar-fill');
      if (armor > 0) {
        this.armorFill.style.display = 'block';
        armorFill.style.width = `${armor}%`;
      } else {
        this.armorFill.style.display = 'none';
      }
    }
  }
  
  updateMoney() {
    if (this.moneyEl) {
      this.moneyEl.textContent = `$${this.player.money.toLocaleString()}`;
    }
  }
  
  updateWantedStars(delta) {
    // Flash stars when wanted level changes or when police don't see player
    if (this.player.wantedLevel !== this.lastWantedLevel) {
      this.wantedFlashTimer = 1.0;
      this.lastWantedLevel = this.player.wantedLevel;
    }
    
    this.stars.forEach((star, i) => {
      const isActive = i < this.player.wantedLevel;
      star.classList.toggle('active', isActive);
      
      // Flash when police don't see player (wanted level > 0 but no police pursuing)
      if (isActive && this.world.policeSystem) {
        const policeSeePlayer = this.world.policeSystem.policeCars.some(p => p.aiState === 'pursue' || p.aiState === 'ram') ||                                this.world.policeSystem.policeBoats.some(p => p.aiState === 'pursue' || p.aiState === 'ram');
        if (!policeSeePlayer && this.player.wantedLevel > 0) {
          this.wantedFlashTimer -= delta;
          if (this.wantedFlashTimer <= 0) {
            this.wantedFlashTimer = 0.5;
            this.wantedFlashVisible = !this.wantedFlashVisible;
          }
          star.style.opacity = this.wantedFlashVisible ? '1' : '0.3';
        } else {
          star.style.opacity = '1';
        }
      }
    });
  }
  
  updateWeaponAmmo() {
    if (!this.player.combatSystem) return;
    
    const info = this.player.combatSystem.getWeaponInfo();
    const weaponNameEl = document.getElementById('weapon-name');
    const ammoCountEl = document.getElementById('ammo-count');
    
    if (info.isArmed) {
      this.weaponInfo.style.display = 'block';
      weaponNameEl.textContent = info.name.toUpperCase();
      if (info.isReloading) {
        ammoCountEl.textContent = 'RELOADING';
        ammoCountEl.style.color = '#f80';
      } else {
        ammoCountEl.textContent = `${info.ammoInClip} / ${info.ammo}`;
        ammoCountEl.style.color = info.ammoInClip === 0 ? '#f00' : '#ff0';
      }
    } else {
      this.weaponInfo.style.display = 'none';
    }
  }
  
  updateSpeedometer() {
    if (this.player.isInVehicle && this.player.vehicle) {
      const speedKmh = Math.round(Math.abs(this.player.vehicle.speed) * 3.6);
      this.speedometer.style.display = 'block';
      this.speedometer.textContent = `${speedKmh} km/h`;
      if (speedKmh > this.player.vehicle.maxSpeed * 3.6 * 0.9) {
        this.speedometer.style.color = '#f00';
      } else {
        this.speedometer.style.color = '#0ff';
      }
    } else {
      this.speedometer.style.display = 'none';
    }
  }
  
  updateMissionBanner() {
    // Handled by mission system
  }
  
  updateToasts(delta) {
    for (let i = this.toasts.length - 1; i >= 0; i--) {
      const toast = this.toasts[i];
      toast.life -= delta;
      toast.el.style.opacity = Math.max(0, toast.life / toast.duration);
      if (toast.life <= 0) {
        toast.el.remove();
        this.toasts.splice(i, 1);
      }
    }
  }
  
  updatePauseMenu() {
    // Handled by main.js input handling
  }
  
  updateDeathScreens() {
    if (this.player.health <= 0 && !this.deathScreenVisible) {
      this.showDeathScreen();
    }
    if (this.player.wasBusted && !this.bustedScreenVisible) {
      this.showBustedScreen();
    }
  }
  
  showDeathScreen() {
    this.deathScreenVisible = true;
    const msg = document.getElementById('death-message');
    const loss = Math.floor(this.player.money * 0.2);
    msg.textContent = `You lost $${loss.toLocaleString()}. Respawned at hospital.`;
    this.deathScreen.style.display = 'flex';
    document.exitPointerLock();
  }
  
  showBustedScreen() {
    this.bustedScreenVisible = true;
    const msg = document.getElementById('busted-message');
    const loss = Math.floor(this.player.money * 0.1);
    msg.textContent = `You lost $${loss.toLocaleString()}. Respawned at police station.`;
    this.bustedScreen.style.display = 'flex';
    document.exitPointerLock();
  }
  
  hideDeathScreens() {
    this.deathScreenVisible = false;
    this.bustedScreenVisible = false;
    this.deathScreen.style.display = 'none';
    this.bustedScreen.style.display = 'none';
  }
  
  // Toast notification
  showToast(message, duration = 3000, color = '#0ff') {
    const toast = document.createElement('div');
    toast.style.cssText = `
      background: rgba(0, 20, 40, 0.95);
      border: 2px solid ${color};
      border-radius: 6px;
      padding: 12px 24px;
      color: ${color};
      font-family: 'Courier New', monospace;
      font-size: 14px;
      box-shadow: 0 0 20px ${color}80;
      animation: toastSlideIn 0.3s ease-out;
    `;
    toast.textContent = message;
    this.toastContainer.appendChild(toast);
    
    const style = document.createElement('style');
    style.textContent = `
      @keyframes toastSlideIn {
        from { transform: translateY(-20px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
    `;
    if (!document.getElementById('toast-style')) {
      style.id = 'toast-style';
      document.head.appendChild(style);
    }
    
    this.toasts.push({ el: toast, life: duration / 1000, duration: duration / 1000 });
  }
  
  // Setup pause menu event listeners
  setupPauseMenu(resumeCallback, saveCallback, loadCallback, quitCallback, qualityCallback, volumeCallback) {
    document.getElementById('btn-resume').addEventListener('click', resumeCallback);
    document.getElementById('btn-save').addEventListener('click', saveCallback);
    document.getElementById('btn-load').addEventListener('click', loadCallback);
    document.getElementById('btn-controls').addEventListener('click', () => {
      document.getElementById('pause-screen').style.display = 'none';
      this.controlsOverlay.style.display = 'flex';
    });
    document.getElementById('btn-quality').addEventListener('click', qualityCallback);
    document.getElementById('btn-volume').addEventListener('click', volumeCallback);
    document.getElementById('btn-quit').addEventListener('click', quitCallback);
    document.getElementById('btn-close-controls').addEventListener('click', () => {
      this.controlsOverlay.style.display = 'none';
      document.getElementById('pause-screen').style.display = 'flex';
    });
    document.getElementById('btn-death-respawn').addEventListener('click', () => {
      this.hideDeathScreens();
      resumeCallback();
    });
    document.getElementById('btn-busted-respawn').addEventListener('click', () => {
      this.hideDeathScreens();
      this.player.wasBusted = false;
      resumeCallback();
    });
  }
}

export function createHUDSystem(world, player, traffic, missions, input) {
  return new HUDSystem(world, player, traffic, missions, input);
}