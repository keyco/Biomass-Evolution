const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const logBox = document.getElementById('logBox');

function addLog(text) {
    logBox.innerHTML = `> ${text}<br>` + logBox.innerHTML.split('<br>').slice(0, 1).join('<br>');
}

function toggleSubPanel(panelId) {
    let panel = document.getElementById(panelId);
    ['guidePanel', 'optionsPanel'].forEach(id => { if(id !== panelId) document.getElementById(id).style.display = 'none'; });
    panel.style.display = (panel.style.display === 'block') ? 'none' : 'block';
}

// --- ENGINES AUDIO ---
let audioCtx = null;
let musicInterval = null;

function initAudioContext() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if(document.getElementById('musicToggle').checked) startProceduralMusic();
    }
}

function playSound(type) {
    let audioEnabled = document.getElementById('audioToggle').checked;
    if (!audioEnabled || !audioCtx) return;
    let osc = audioCtx.createOscillator(); let gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(audioCtx.destination);
    let now = audioCtx.currentTime;

    if (type === 'laser') { osc.type = 'sawtooth'; osc.frequency.setValueAtTime(450, now); osc.frequency.exponentialRampToValueAtTime(80, now + 0.1); gain.gain.setValueAtTime(0.04, now); gain.gain.linearRampToValueAtTime(0, now + 0.1); osc.start(now); osc.stop(now + 0.1); } 
    else if (type === 'hit') { osc.type = 'triangle'; osc.frequency.setValueAtTime(80, now); gain.gain.setValueAtTime(0.15, now); gain.gain.linearRampToValueAtTime(0, now + 0.08); osc.start(now); osc.stop(now + 0.08); } 
    else if (type === 'pulse') { osc.type = 'sine'; osc.frequency.setValueAtTime(100, now); osc.frequency.exponentialRampToValueAtTime(600, now + 0.2); gain.gain.setValueAtTime(0.2, now); gain.gain.linearRampToValueAtTime(0, now + 0.2); osc.start(now); osc.stop(now + 0.2); } 
    else if (type === 'nuke') { osc.type = 'sawtooth'; osc.frequency.setValueAtTime(120, now); osc.frequency.linearRampToValueAtTime(30, now + 0.7); gain.gain.setValueAtTime(0.4, now); gain.gain.linearRampToValueAtTime(0, now + 0.7); osc.start(now); osc.stop(now + 0.7); } 
    else if (type === 'kame') { osc.type = 'sine'; osc.frequency.setValueAtTime(220, now); osc.frequency.linearRampToValueAtTime(480, now + 0.5); gain.gain.setValueAtTime(0.2, now); osc.start(now); osc.stop(now + 0.5); } 
    else if (type === 'powerup') { osc.type = 'sine'; osc.frequency.setValueAtTime(300, now); osc.frequency.setValueAtTime(600, now + 0.08); gain.gain.setValueAtTime(0.1, now); gain.gain.linearRampToValueAtTime(0, now + 0.15); osc.start(now); osc.stop(now + 0.15); } 
    else if (type === 'lvl') { osc.type = 'sine'; osc.frequency.setValueAtTime(350, now); osc.frequency.linearRampToValueAtTime(850, now + 0.25); gain.gain.setValueAtTime(0.15, now); osc.start(now); osc.stop(now + 0.25); }
}

function startProceduralMusic() {
    if (musicInterval) clearInterval(musicInterval);
    const notasBio = [90, 110, 90, 130]; let paso = 0;
    musicInterval = setInterval(() => {
        let musicEnabled = document.getElementById('musicToggle').checked;
        if (!musicEnabled || !gameActive || !audioCtx) return;
        let now = audioCtx.currentTime; let osc = audioCtx.createOscillator(); let gain = audioCtx.createGain();
        osc.type = 'square'; osc.frequency.setValueAtTime(notasBio[paso % notasBio.length], now);
        gain.gain.setValueAtTime(0.03, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc.connect(gain); gain.connect(audioCtx.destination); osc.start(now); osc.stop(now + 0.4);
        paso++;
    }, 500); 
}

// --- SISTEMA DE LEADERBOARD ---
function getLeaderboard() {
    let data = localStorage.getItem('biomass_leaderboard');
    return data ? JSON.parse(data) : [];
}

function saveScore(newName, newScore) {
    let lb = getLeaderboard(); lb.push({name: newName.toUpperCase(), score: newScore});
    lb.sort((a, b) => b.score - a.score); lb = lb.slice(0, 5);
    localStorage.setItem('biomass_leaderboard', JSON.stringify(lb));
    displayLeaderboard();
}

function displayLeaderboard() {
    let lb = getLeaderboard(); let tbody = document.getElementById('leaderboardBody'); tbody.innerHTML = "";
    if (lb.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" style="color:#666; padding:10px 6px;">Aún no hay puntajes registrados.</td></tr>`;
        return;
    }
    lb.forEach((row, index) => {
        let tr = document.createElement('tr');
        tr.style.color = index === 0 ? '#fffa50' : '#fff';
        tr.innerHTML = `<td>#${index + 1}</td><td>${row.name}</td><td><strong>${row.score}</strong></td>`;
        tbody.appendChild(tr);
    });
}

function formatTime(ms) {
    let totalSec = Math.max(0, Math.floor(ms / 1000));
    let m = Math.floor(totalSec / 60); let s = totalSec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function endGame() {
    gameActive = false;
    let elapsedMs = Date.now() - matchStartTime;
    document.getElementById('go-wave').innerText = wave;
    document.getElementById('go-time').innerText = formatTime(elapsedMs);
    document.getElementById('go-score').innerText = score;
    saveScore(playerName, score);
    document.getElementById('gameOverScreen').style.display = 'flex';
}

function continueWithAd() {
    document.getElementById('gameOverScreen').style.display = 'none';

    if (!adController) {
        // SDK de AdsGram no disponible en este entorno (p. ej. fuera de Telegram): continuar sin anuncio.
        addLog("Anuncio no disponible en este entorno.");
        grantEscapeReward();
        return;
    }

    document.getElementById('adLoadingScreen').style.display = 'flex';

    adController.show()
        .then(() => {
            // El usuario vio el anuncio hasta el final (o lo cerró en formato interstitial)
            document.getElementById('adLoadingScreen').style.display = 'none';
            grantEscapeReward();
        })
        .catch(() => {
            // Error al reproducir el anuncio o no había inventario disponible
            document.getElementById('adLoadingScreen').style.display = 'none';
            addLog("No se pudo reproducir el anuncio.");
            document.getElementById('gameOverScreen').style.display = 'flex';
        });
}

// --- AdsGram: bloque de recompensa (blockId 38546) ---
let adController = null;
function initAdsgram() {
    if (window.Adsgram) {
        adController = window.Adsgram.init({ blockId: "38546" });
    }
}

function grantEscapeReward() {
    player.hp = Math.max(player.maxHp * 0.5, 20);
    activateEscapeImmunity(5000);
    gameActive = true;
}

// --- Inmunidad temporal tras ver el anuncio (para poder escapar sin recibir daño) ---
function activateEscapeImmunity(durationMs) {
    player.invulnUntil = Date.now() + durationMs;
    addLog(`Inmunidad de escape activada: ${Math.round(durationMs / 1000)}s.`);
}

// --- VARIABLES JUEGO ---
let gameActive = false; let keys = {}; let wave = 1; let waveTimer = 0; let score = 0; let playerName = "CIENTIFICO";
let matchStartTime = 0;

let player = {
    worldX: 0, worldY: 0, screenX: canvas.width / 2, screenY: canvas.height / 2,
    radius: 12, baseSpeed: 3.0, speed: 3.0, hp: 100, maxHp: 100,
    level: 1, dna: 0, dnaNeeded: 10,
    mutations: { acido: 0, puas: 0, alas: 0, regeneracion: 0, pulsoMejora: 1 },
    pulseCooldown: 0, pulseActiveVisual: 0, kameTimer: 0, invulnUntil: 0, lineaElegida: null
};

let dnaPool = []; let enemies = []; let projectiles = []; let powerups = []; let damageNumbers = [];
let acidTimer = 0; let regenTimer = 0;

const MUTACIONES_DATA = [
    { id: 'acido', nombre: 'Brazo Químico', desc: 'Tu brazo desgarra la bata y escupe ácido a los infectados cercanos.', linea: 'A' },
    { id: 'puas', nombre: 'Exoesqueleto Reactivo', desc: 'Púas de quitina atraviesan tu traje para devolver daño letal.', linea: 'A' },
    { id: 'alas', nombre: 'Alas de Energía', desc: 'Energía pura brota de tu espalda, aumentando drásticamente tu velocidad.', linea: 'B' },
    { id: 'regeneracion', nombre: 'Sangre Mitótica', desc: 'Tu cuerpo se cura a sí mismo cerrando heridas automáticamente.', linea: 'B' },
    { id: 'pulsoMejora', nombre: 'Sobrecarga de Traje', desc: 'Amplía el radio y la fuerza del empuje electromagnético [Espacio].', linea: null }
];
const NOMBRES_LINEA = { A: 'OFENSIVA', B: 'SUPERVIVENCIA' };

// --- LOADING / SPLASH SCREEN ---
function initLoadingScreen() {
    const fill = document.getElementById('loadingBarFill');
    const percentEl = document.getElementById('loadingPercent');
    const startBtn = document.getElementById('startBtn');

    let progress = 0;
    const duration = 3500; // ms totales para "apreciar la imagen"
    const stepMs = 60;
    const increment = 100 / (duration / stepMs);

    const interval = setInterval(() => {
        progress = Math.min(100, progress + increment);
        fill.style.width = progress + '%';
        percentEl.innerText = Math.floor(progress) + '%';
        if (progress >= 100) {
            clearInterval(interval);
            percentEl.innerText = 'LISTO';
            startBtn.disabled = false;
        }
    }, stepMs);
}

function dismissLoadingScreen() {
    document.getElementById('loadingScreen').style.display = 'none';
    document.getElementById('mainMenuScreen').style.display = 'flex';
    document.getElementById('playerName').focus();
}

// --- STATE 1 -> STATE 2: Scientist ID Gateway ---
document.getElementById('playerName').addEventListener('input', e => {
    document.getElementById('accederBtn').disabled = e.target.value.trim() === '';
});

function validateAndEnter() {
    const input = document.getElementById('playerName');
    const errorEl = document.getElementById('gatewayError');
    const val = input.value.trim();

    if (!val) {
        errorEl.classList.add('show');
        input.classList.remove('input-error');
        void input.offsetWidth; // restart animation if triggered again
        input.classList.add('input-error');
        return;
    }

    errorEl.classList.remove('show');
    playerName = val;
    document.getElementById('welcomeBack').innerText = `Identidad confirmada: ${val}`;
    document.getElementById('idGateway').style.display = 'none';
    document.getElementById('labHub').style.display = 'block';
}

// --- MENU -> TUTORIAL: leaving the hub opens the mission briefing before gameplay ---
let gameLoopStarted = false;
function ensureGameLoopRunning() {
    if (!gameLoopStarted) {
        gameLoopStarted = true;
        gameLoop();
    }
}

function startFromMenu() {
    playerName = document.getElementById('playerName').value.trim() || playerName || "DR_MORTIS";
    document.getElementById('mainMenuScreen').style.display = 'none';
    document.getElementById('tutorialModal').style.display = 'flex';
    ensureGameLoopRunning();
}

// --- TUTORIAL -> GAMEPLAY: dismissing the briefing actually starts the mission ---
function beginMission() {
    document.getElementById('tutorialModal').style.display = 'none';
    initAudioContext();
    gameActive = true;
    matchStartTime = Date.now();
    spawnWave();
}

function resetGameState() {
    score = 0; wave = 1; waveTimer = 0;
    player.worldX = 0; player.worldY = 0; player.hp = 100; player.level = 1; player.dna = 0; player.dnaNeeded = 10;
    player.speed = player.baseSpeed; player.kameTimer = 0; player.invulnUntil = 0; player.lineaElegida = null;
    player.mutations = { acido: 0, puas: 0, alas: 0, regeneracion: 0, pulsoMejora: 1 };
    enemies = []; dnaPool = []; projectiles = []; powerups = []; damageNumbers = [];
    document.getElementById('ui-mutations').innerText = "Estado Físico: Humano Normal";
}

function restartGame() {
    resetGameState();
    document.getElementById('gameOverScreen').style.display = 'none';
    matchStartTime = Date.now();
    gameActive = true; spawnWave();
}

function returnToMenu() {
    resetGameState();
    document.getElementById('gameOverScreen').style.display = 'none';
    document.getElementById('idGateway').style.display = 'none';
    document.getElementById('labHub').style.display = 'block';
    document.getElementById('mainMenuScreen').style.display = 'flex';
}

document.getElementById('playerName').addEventListener('keydown', e => { if (e.key === 'Enter') validateAndEnter(); });

initLoadingScreen();
initAdsgram();
displayLeaderboard();

window.addEventListener('keydown', e => { keys[e.key.toLowerCase()] = true; if (e.key === ' ' || e.code === 'Space') triggerPulse(); });
window.addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);

function createDamageNumber(x, y, amount, isSpecial = false) {
    damageNumbers.push({ worldX: x, worldY: y, text: Math.round(amount), life: 35, color: isSpecial ? '#fffa50' : '#ff4757', size: isSpecial ? 20 : 14 });
}

function triggerPulse() {
    if (!gameActive || player.pulseCooldown > 0) return;
    playSound('pulse'); player.pulseCooldown = 180; player.pulseActiveVisual = 15;
    let radius = 100 + (player.mutations.pulsoMejora * 25); let force = 50 + (player.mutations.pulsoMejora * 15);
    enemies.forEach(e => {
        let dx = e.worldX - player.worldX; let dy = e.worldY - player.worldY;
        if (Math.hypot(dx, dy) < radius) {
            let angle = Math.atan2(dy, dx);
            e.worldX += Math.cos(angle) * force; e.worldY += Math.sin(angle) * force;
            let dmg = 2 + player.mutations.pulsoMejora * 2; e.hp -= dmg; createDamageNumber(e.worldX, e.worldY, dmg, true);
        }
    });
    checkEnemyDeaths();
}

function spawnWave() {
    let qty = 4 + wave * 2;
    for (let i = 0; i < qty; i++) {
        let angle = Math.random() * Math.PI * 2; let dist = 450 + Math.random() * 150; 
        enemies.push({ worldX: player.worldX + Math.cos(angle) * dist, worldY: player.worldY + Math.sin(angle) * dist, radius: 12, hp: 2 + wave, maxHp: 2 + wave, speed: 1.3 + Math.random() * 1.1, color: '#ff2a2a' });
    }
    if (Math.random() > 0.3) {
        let types = ['heal', 'magnet', 'nuke', 'kame'];
        powerups.push({ worldX: player.worldX + (Math.random() - 0.5) * 600, worldY: player.worldY + (Math.random() - 0.5) * 400, type: types[Math.floor(Math.random() * types.length)] });
    }
}

function checkEnemyDeaths() {
    enemies = enemies.filter(e => {
        if(e.hp <= 0) { dnaPool.push({ worldX: e.worldX, worldY: e.worldY, value: 2 }); score += 15 * wave; return false; }
        return true;
    });
}

function update() {
    if (!gameActive) return;

    let moveX = 0; let moveY = 0;
    if (keys['arrowup'] || keys['w']) moveY = -player.speed;
    if (keys['arrowdown'] || keys['s']) moveY = player.speed;
    if (keys['arrowleft'] || keys['a']) moveX = -player.speed;
    if (keys['arrowright'] || keys['d']) moveX = player.speed;
    if (moveX !== 0 && moveY !== 0) { moveX *= 0.7071; moveY *= 0.7071; }
    player.worldX += moveX; player.worldY += moveY;

    if (player.pulseCooldown > 0) player.pulseCooldown--;
    if (player.pulseActiveVisual > 0) player.pulseActiveVisual--;
    
    if (player.kameTimer > 0) {
        player.kameTimer--; if(player.kameTimer % 6 === 0) playSound('laser');
        enemies.forEach(e => {
            let scrX = e.worldX - player.worldX + player.screenX; let scrY = e.worldY - player.worldY + player.screenY;
            if (scrX > player.screenX && scrX < player.screenX + 500 && Math.abs(scrY - player.screenY) < 40) { e.hp -= 0.5; if(Math.random() > 0.7) createDamageNumber(e.worldX, e.worldY, 5, true); }
        });
        checkEnemyDeaths();
    }

    waveTimer++; if (waveTimer > 750) { wave++; waveTimer = 0; spawnWave(); addLog(`Oleada de contención ${wave} aproximándose.`); }

    if (player.mutations.regeneracion > 0) {
        regenTimer++;
        if (regenTimer >= 120) { player.hp = Math.min(player.maxHp, player.hp + (0.6 * player.mutations.regeneracion)); regenTimer = 0; }
    }

    for (let i = 0; i < enemies.length; i++) {
        let e1 = enemies[i];
        let dx = player.worldX - e1.worldX; let dy = player.worldY - e1.worldY; let dist = Math.hypot(dx, dy);
        e1.worldX += (dx / (dist || 1)) * e1.speed; e1.worldY += (dy / (dist || 1)) * e1.speed;

        if (dist < player.radius + e1.radius) {
            playSound('hit');
            if (player.mutations.puas > 0) { let retDmg = 1 + player.mutations.puas * 2; e1.hp -= retDmg; createDamageNumber(e1.worldX, e1.worldY, retDmg, true); }
            let isImmune = player.invulnUntil && Date.now() < player.invulnUntil;
            if (!isImmune) player.hp -= 0.5;
            if(e1.hp <= 0) { dnaPool.push({ worldX: e1.worldX, worldY: e1.worldY, value: 2 }); score += 15 * wave; enemies.splice(i, 1); i--; }
            
            if (player.hp <= 0) {
                player.hp = 0;
                endGame();
                return;
            }
        }
    }

    if (player.mutations.acido > 0 && enemies.length > 0) {
        acidTimer++; let cooldownTarget = Math.max(10, 50 - (player.mutations.acido * 8));
        if (acidTimer >= cooldownTarget) {
            let closest = null; let minDist = Infinity;
            enemies.forEach(e => { let d = Math.hypot(e.worldX - player.worldX, e.worldY - player.worldY); if (d < minDist) { minDist = d; closest = e; } });
            if (closest && minDist < 350) {
                let angle = Math.atan2(closest.worldY - player.worldY, closest.worldX - player.worldX);
                projectiles.push({ worldX: player.worldX, worldY: player.worldY, vx: Math.cos(angle) * 7, vy: Math.sin(angle) * 7, radius: 5 });
                playSound('laser');
            }
            acidTimer = 0;
        }
    }

    for (let i = projectiles.length - 1; i >= 0; i--) {
        let p = projectiles[i]; p.worldX += p.vx; p.worldY += p.vy;
        for (let j = enemies.length - 1; j >= 0; j--) {
            let e = enemies[j];
            if (Math.hypot(p.worldX - e.worldX, p.worldY - e.worldY) < p.radius + e.radius) {
                let dmgBase = 1 + (player.mutations.acido * 0.5); e.hp -= dmgBase; createDamageNumber(e.worldX, e.worldY, dmgBase);
                projectiles.splice(i, 1); playSound('hit');
                if (e.hp <= 0) { dnaPool.push({ worldX: e.worldX, worldY: e.worldY, value: 2 }); enemies.splice(j, 1); score += 15 * wave;}
                break;
            }
        }
    }

    for (let i = powerups.length - 1; i >= 0; i--) {
        let pu = powerups[i];
        if (Math.hypot(player.worldX - pu.worldX, player.worldY - pu.worldY) < player.radius + 14) {
            playSound('powerup');
            if (pu.type === 'heal') { player.hp = Math.min(player.maxHp, player.hp + 35); addLog("Kit médico aplicado."); }
            else if (pu.type === 'magnet') { dnaPool.forEach(d => d.magnetized = true); addLog("Atracción magnética de biomasa activada."); }
            else if (pu.type === 'nuke') { playSound('nuke'); enemies.forEach(e => { e.hp = 0; createDamageNumber(e.worldX, e.worldY, 99, true); }); checkEnemyDeaths(); addLog("PELIGRO: Detonación térmica ejecutada."); }
            else if (pu.type === 'kame') { playSound('kame'); player.kameTimer = 180; addLog("Cañón de iones desatado."); }
            powerups.splice(i, 1);
        }
    }

    for (let i = dnaPool.length - 1; i >= 0; i--) {
        let d = dnaPool[i];
        if (d.magnetized) { let angle = Math.atan2(player.worldY - d.worldY, player.worldX - d.worldX); d.worldX += Math.cos(angle) * 10; d.worldY += Math.sin(angle) * 10; }
        if (Math.hypot(player.worldX - d.worldX, player.worldY - d.worldY) < player.radius + 10) { player.dna += d.value; score += 5; dnaPool.splice(i, 1); checkLevelUp(); }
    }

    damageNumbers.forEach((dn, idx) => { dn.worldY -= 0.8; dn.life--; if(dn.life <= 0) damageNumbers.splice(idx, 1); });

    document.getElementById('ui-score').innerText = score;
    document.getElementById('ui-wave').innerText = wave;
    document.getElementById('ui-lvl').innerText = player.level;
    document.getElementById('ui-dna').innerText = player.dna;
    document.getElementById('ui-next-lvl').innerText = player.dnaNeeded;
    document.getElementById('ui-hp').innerText = Math.round(player.hp);
    let immuneLeft = player.invulnUntil ? Math.max(0, player.invulnUntil - Date.now()) : 0;
    document.getElementById('ui-immune').style.display = immuneLeft > 0 ? 'inline' : 'none';
    document.getElementById('ui-immune').innerText = immuneLeft > 0 ? ` 🛡 INMUNE ${Math.ceil(immuneLeft / 1000)}s` : '';
    document.getElementById('ui-pulse-lvl').innerText = player.mutations.pulsoMejora;
    document.getElementById('ui-cooldown').innerText = player.pulseCooldown > 0 ? `${Math.ceil(player.pulseCooldown/60)}s` : "LISTO";
    document.getElementById('ui-cooldown').style.color = player.pulseCooldown > 0 ? '#ff5555' : '#54a0ff';
}

function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let size = 50; let offsetX = -(player.worldX % size); let offsetY = -(player.worldY % size);
    ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 1;
    for (let x = offsetX; x < canvas.width; x += size) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke(); }
    for (let y = offsetY; y < canvas.height; y += size) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke(); }

    powerups.forEach(pu => {
        let scrX = pu.worldX - player.worldX + player.screenX; let scrY = pu.worldY - player.worldY + player.screenY;
        ctx.font = "16px Arial";
        if (pu.type === 'heal') ctx.fillText("💉", scrX-8, scrY+5);
        else if (pu.type === 'magnet') ctx.fillText("🧲", scrX-8, scrY+5);
        else if (pu.type === 'nuke') ctx.fillText("☢️", scrX-8, scrY+5);
        else if (pu.type === 'kame') ctx.fillText("⚡", scrX-8, scrY+5);
    });

    dnaPool.forEach(d => {
        let scrX = d.worldX - player.worldX + player.screenX; let scrY = d.worldY - player.worldY + player.screenY;
        ctx.fillStyle = '#4af626'; ctx.beginPath(); ctx.moveTo(scrX, scrY - 5); ctx.lineTo(scrX + 4, scrY); ctx.lineTo(scrX, scrY + 5); ctx.lineTo(scrX - 4, scrY); ctx.fill();
    });

    projectiles.forEach(p => {
        let scrX = p.worldX - player.worldX + player.screenX; let scrY = p.worldY - player.worldY + player.screenY;
        ctx.fillStyle = '#a3cb38'; ctx.beginPath(); ctx.arc(scrX, scrY, p.radius, 0, Math.PI*2); ctx.fill();
    });

    enemies.forEach(e => {
        let scrX = e.worldX - player.worldX + player.screenX; let scrY = e.worldY - player.worldY + player.screenY;
        ctx.fillStyle = e.color; ctx.beginPath(); 
        ctx.arc(scrX, scrY, e.radius, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#800000'; ctx.beginPath(); ctx.arc(scrX-3, scrY-3, 3, 0, Math.PI*2); ctx.fill();
    });

    if (player.kameTimer > 0) {
        let grad = ctx.createLinearGradient(player.screenX, player.screenY, player.screenX + 500, player.screenY);
        grad.addColorStop(0, "rgba(0, 255, 255, 0.9)"); grad.addColorStop(0.5, "rgba(255, 255, 255, 1)"); grad.addColorStop(1, "rgba(0, 150, 255, 0)");
        ctx.fillStyle = grad; ctx.fillRect(player.screenX + player.radius, player.screenY - 20, 500, 40) ;
    }

    if (player.pulseActiveVisual > 0) {
        let radioDinamico = 100 + (player.mutations.pulsoMejora * 25);
        ctx.strokeStyle = 'rgba(84, 160, 255, ' + (player.pulseActiveVisual / 15) + ')'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(player.screenX, player.screenY, radioDinamico - (player.pulseActiveVisual * 4), 0, Math.PI*2); ctx.stroke();
    }

    if (player.invulnUntil && Date.now() < player.invulnUntil) {
        let pulse = 3 + Math.sin(Date.now() * 0.012) * 2;
        ctx.strokeStyle = 'rgba(74, 246, 38, 0.85)';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(player.screenX, player.screenY, player.radius + 10 + pulse, 0, Math.PI*2); ctx.stroke();
        ctx.strokeStyle = 'rgba(74, 246, 38, 0.3)';
        ctx.lineWidth = 8;
        ctx.beginPath(); ctx.arc(player.screenX, player.screenY, player.radius + 10 + pulse, 0, Math.PI*2); ctx.stroke();
    }

    // --- RENDERIZADO DEL CIENTÍFICO MUTANTE ---
    
    // 1. Alas de Energía (Fondo)
    if (player.mutations.alas > 0) {
        ctx.fillStyle = 'rgba(84, 160, 255, 0.6)';
        let wingW = 15 + player.mutations.alas * 5 + Math.sin(Date.now() * 0.01) * 3;
        ctx.beginPath(); ctx.moveTo(player.screenX - 8, player.screenY); ctx.lineTo(player.screenX - 8 - wingW, player.screenY - 15); ctx.lineTo(player.screenX - 12, player.screenY + 10); ctx.fill();
        ctx.beginPath(); ctx.moveTo(player.screenX + 8, player.screenY); ctx.lineTo(player.screenX + 8 + wingW, player.screenY - 15); ctx.lineTo(player.screenX + 12, player.screenY + 10); ctx.fill();
    }

    // 2. Bata de Laboratorio (Cuerpo base)
    ctx.fillStyle = (player.mutations.regeneracion > 0) ? '#d1ffd1' : '#ffffff'; 
    ctx.fillRect(player.screenX - 10, player.screenY - 8, 20, 22);
    
    // Núcleo regenerativo brillando a través de la bata
    if(player.mutations.regeneracion > 0) {
        ctx.fillStyle = '#4af626'; ctx.beginPath(); ctx.arc(player.screenX, player.screenY + 3, 4 + Math.sin(Date.now()*0.005)*2, 0, Math.PI*2); ctx.fill();
    }

    // 3. Púas saliendo del traje
    if (player.mutations.puas > 0) { 
        ctx.fillStyle = '#ff9f43';
        let puaSize = 4 + player.mutations.puas * 2;
        ctx.beginPath(); ctx.moveTo(player.screenX - 10, player.screenY); ctx.lineTo(player.screenX - 10 - puaSize, player.screenY - puaSize); ctx.lineTo(player.screenX - 5, player.screenY - 5); ctx.fill();
        ctx.beginPath(); ctx.moveTo(player.screenX + 10, player.screenY); ctx.lineTo(player.screenX + 10 + puaSize, player.screenY - puaSize); ctx.lineTo(player.screenX + 5, player.screenY - 5); ctx.fill();
    }

    // 4. Cabeza (Humano)
    ctx.fillStyle = '#ffccaa'; // Color piel
    ctx.beginPath(); ctx.arc(player.screenX, player.screenY - 12, 7, 0, Math.PI*2); ctx.fill();
    // Lentes de científico
    ctx.fillStyle = '#333';
    ctx.fillRect(player.screenX - 6, player.screenY - 14, 4, 3); ctx.fillRect(player.screenX + 2, player.screenY - 14, 4, 3);

    // 5. Brazo Mutante Químico (Ácido)
    if (player.mutations.acido > 0) { 
        ctx.fillStyle = '#4af626'; ctx.beginPath(); 
        ctx.arc(player.screenX + 14, player.screenY + 2, 6 + player.mutations.acido, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#27ae60'; ctx.beginPath(); ctx.arc(player.screenX + 14, player.screenY + 2, 3, 0, Math.PI*2); ctx.fill();
    } else {
        // Brazo normal derecho
        ctx.fillStyle = '#ffffff'; ctx.fillRect(player.screenX + 10, player.screenY - 8, 4, 12);
    }
    // Brazo normal izquierdo
    ctx.fillStyle = '#ffffff'; ctx.fillRect(player.screenX - 14, player.screenY - 8, 4, 12);

    // Textos de daño
    damageNumbers.forEach(dn => {
        let scrX = dn.worldX - player.worldX + player.screenX; let scrY = dn.worldY - player.worldY + player.screenY;
        ctx.fillStyle = dn.color; ctx.font = `bold ${dn.size}px monospace`; ctx.fillText(dn.text, scrX, scrY);
    });
}

function checkLevelUp() {
    if (!gameActive) return; // ya hay un modal de mutación abierto/resolviéndose: no dispares otro en el mismo frame
    if (player.dna >= player.dnaNeeded) {
        playSound('lvl'); player.dna -= player.dnaNeeded; player.level++; player.dnaNeeded = Math.floor(player.dnaNeeded * 1.5); gameActive = false; showMutationMenu();
    }
}

function showMutationMenu() {
    const modal = document.getElementById('mutationModal');
    const container = document.getElementById('mutationOptions');

    // 1. Pausar el juego primero de forma segura para congelar físicas antes de tocar el DOM
    gameActive = false;
    addLog("ADVERTENCIA: Alteración del genoma detectada.");

    // 2. Limpiar el contenedor de forma segura
    container.innerHTML = '';

    // 3. Solo se ofrecen mutaciones de la línea ya elegida (o ambas líneas si aún no se ha elegido ninguna)
    const opciones = MUTACIONES_DATA.filter(m => !m.linea || !player.lineaElegida || m.linea === player.lineaElegida);

    // 4. Crear y adjuntar los elementos al DOM uno por uno (más seguro que innerHTML masivo en bucle)
    opciones.forEach(m => {
        let nivelActual = player.mutations[m.id];
        let txtBoton = nivelActual > 0 ? `Profundizar ${m.nombre} (+${nivelActual + 1})` : `Inyectar ${m.nombre}`;
        if(m.id === 'pulsoMejora') txtBoton = `Mejorar Sobrecarga (+${nivelActual + 1})`;

        let btn = document.createElement('button');
        btn.className = 'btn-mutar';
        let tagHtml = m.linea ? `<span class="mut-linea-tag linea-${m.linea}">${NOMBRES_LINEA[m.linea]}</span>` : '';
        btn.innerHTML = `${tagHtml}<strong>${txtBoton}</strong><span class="mut-desc">${m.desc}</span>`;

        // Manejador de click seguro
        btn.onclick = (e) => {
            e.preventDefault();
            aplicarMutacion(m.id, m.nombre, m.linea);
        };

        container.appendChild(btn);
    });

    // 5. Mostrar el modal una vez el árbol de botones esté completamente listo en el buffer
    modal.style.display = 'block';
}

function aplicarMutacion(id, nombre, linea) {
    // 1. Ocultar el modal inmediatamente para evitar doble click accidental
    document.getElementById('mutationModal').style.display = 'none';

    // 2. Aplicar los cambios en el estado lógico del jugador
    player.mutations[id]++;
    let nuevoNivel = player.mutations[id];
    addLog(`Mutación aceptada: ${nombre} Fase ${nuevoNivel}. El cuerpo se adapta.`);

    // 2b. Si esta mutación pertenece a una línea y aún no había una elegida, queda fijada para el resto de la partida
    if (linea && !player.lineaElegida) {
        player.lineaElegida = linea;
        addLog(`Línea genética ${NOMBRES_LINEA[linea]} fijada. La línea rival ya no estará disponible.`);
    }

    if (id === 'alas') {
        player.speed = player.baseSpeed + (player.mutations.alas * 0.6);
    }

    // 3. Reconstruir la lista de mutaciones activas en la interfaz HUD
    let listaActivas = [];
    for (let key in player.mutations) {
        if (player.mutations[key] > 0) {
            let ref = MUTACIONES_DATA.find(m => m.id === key);
            if (ref) {
                listaActivas.push(`${ref.nombre} (Fase ${player.mutations[key]})`);
            }
        }
    }

    document.getElementById('ui-mutations').innerHTML = "Mutaciones Activas:<br>" + listaActivas.join("<br>");

    // 4. Asegurar una pequeña holgura de ejecución antes de reanudar el bucle principal (previene micro-stuttering)
    setTimeout(() => {
        gameActive = true;
    }, 50);
}

function gameLoop() { update(); render(); requestAnimationFrame(gameLoop); }