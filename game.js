const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const logBox = document.getElementById('logBox');

function addLog(text) {
    logBox.innerHTML = `> ${text}<br>` + logBox.innerHTML.split('<br>').slice(0, 1).join('<br>');
}

function toggleSubPanel(panelId) {
    let panel = document.getElementById(panelId);
    ['guidePanel', 'optionsPanel', 'rankingPanel'].forEach(id => { if(id !== panelId) document.getElementById(id).style.display = 'none'; });
    let willOpen = panel.style.display !== 'block';
    panel.style.display = willOpen ? 'block' : 'none';
    if (willOpen && panelId === 'rankingPanel') loadRankingPanel();
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
async function saveScore(newName, newScore) {
    try {
        const res = await fetch('/api/save-score', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ player: newName, score: Math.floor(newScore), playerId })
        });
        if (!res.ok) throw new Error((await res.json()).error || 'Error desconocido');
    } catch (err) {
        addLog('No se pudo guardar el puntaje en el servidor.');
        console.error('saveScore error:', err);
    }
    displayLeaderboard();
}

async function displayLeaderboard() {
    const tbody = document.getElementById('leaderboardBody');
    tbody.innerHTML = "";

    let lb = [];
    try {
        const res = await fetch('/api/leaderboard?limit=5');
        if (!res.ok) throw new Error((await res.json()).error || 'Error desconocido');
        const data = await res.json();
        lb = data.leaderboard || [];
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="3" style="color:#666; padding:10px 6px;">No se pudo cargar el ranking.</td></tr>`;
        console.error('displayLeaderboard error:', err);
        return;
    }

    if (lb.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" style="color:#666; padding:10px 6px;">Aún no hay puntajes registrados.</td></tr>`;
        return;
    }

    lb.forEach((row, index) => {
        let tr = document.createElement('tr');
        tr.style.color = index === 0 ? '#fffa50' : '#fff';

        let tdPos = document.createElement('td'); tdPos.textContent = `#${index + 1}`;
        let tdName = document.createElement('td'); tdName.textContent = row.name;
        let tdScore = document.createElement('td'); let strong = document.createElement('strong'); strong.textContent = row.score; tdScore.appendChild(strong);

        tr.appendChild(tdPos); tr.appendChild(tdName); tr.appendChild(tdScore);
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
        addLog("Anuncio no disponible en este entorno.");
        grantEscapeReward();
        return;
    }

    document.getElementById('adLoadingScreen').style.display = 'flex';

    adController.show()
        .then(() => {
            document.getElementById('adLoadingScreen').style.display = 'none';
            grantEscapeReward();
        })
        .catch(() => {
            document.getElementById('adLoadingScreen').style.display = 'none';
            addLog("No se pudo reproducir el anuncio.");
            document.getElementById('gameOverScreen').style.display = 'flex';
        });
}

// --- AdsGram ---
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

function activateEscapeImmunity(durationMs) {
    player.invulnUntil = Date.now() + durationMs;
    addLog(`Inmunidad de escape activada: ${Math.round(durationMs / 1000)}s.`);
}

// --- VARIABLES JUEGO ---
let gameActive = false; let keys = {}; let wave = 1; let waveTimer = 0; let score = 0; let playerName = "CIENTIFICO";

function getPlayerId() {
    let id = localStorage.getItem('biomass_player_id');
    if (!id) {
        id = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : 'p-' + Date.now() + '-' + Math.random().toString(36).slice(2);
        localStorage.setItem('biomass_player_id', id);
    }
    return id;
}
let playerId = getPlayerId();
let matchStartTime = 0;

let player = {
    worldX: 0, worldY: 0, screenX: canvas.width / 2, screenY: canvas.height / 2,
    radius: 12, baseSpeed: 3.0, speed: 3.0, hp: 100, maxHp: 100,
    level: 1, dna: 0, dnaNeeded: 10,
    mutations: { acido: 0, puas: 0, alas: 0, regeneracion: 0, pulsoMejora: 1, bossAbanico: 0 },
    pulseCooldown: 0, pulseActiveVisual: 0, kameTimer: 0, invulnUntil: 0, lineaElegida: null
};

let dnaPool = []; let enemies = []; let projectiles = []; let powerups = []; let damageNumbers = [];
let acidTimer = 0; let regenTimer = 0;

// --- NUEVAS LISTAS PARA EL BOSS ---
let bossProjectiles = [];
let coverBlocks = []; 
let activeBoss = null;

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
    const duration = 3500;
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
    tryAutoLogin();
}

async function tryAutoLogin() {
    document.getElementById('checkingAuth').style.display = 'flex';
    document.getElementById('idGateway').style.display = 'none';
    document.getElementById('labHub').style.display = 'none';

    try {
        const res = await fetch(`/api/login?playerId=${encodeURIComponent(playerId)}`);
        if (res.ok) {
            const data = await res.json();
            if (data.success && data.player) {
                playerName = data.player;
                document.getElementById('checkingAuth').style.display = 'none';
                document.getElementById('welcomeBack').innerText = `Bienvenido de nuevo, ${data.player}.`;
                document.getElementById('labHub').style.display = 'block';
                return;
            }
        }
    } catch (err) {
        console.error('auto-login check failed:', err);
    }

    document.getElementById('checkingAuth').style.display = 'none';
    document.getElementById('idGateway').style.display = 'block';
    document.getElementById('playerName').focus();
}

// --- CLASIFICACIÓN ---
async function loadRankingPanel() {
    const scoreBody = document.getElementById('menuLeaderboardBody');
    const recentList = document.getElementById('recentPlayersList');

    try {
        const res = await fetch('/api/leaderboard?limit=5');
        const data = await res.json();
        const lb = data.leaderboard || [];
        scoreBody.innerHTML = '';
        if (lb.length === 0) {
            scoreBody.innerHTML = `<tr><td colspan="3" style="color:#666;">Aún no hay puntajes registrados.</td></tr>`;
        } else {
            lb.forEach((row, i) => {
                let tr = document.createElement('tr');
                tr.style.color = i === 0 ? '#fffa50' : '#fff';
                let tdPos = document.createElement('td'); tdPos.textContent = `#${i + 1}`;
                let tdName = document.createElement('td'); tdName.textContent = row.name;
                let tdScore = document.createElement('td'); let strong = document.createElement('strong'); strong.textContent = row.score; tdScore.appendChild(strong);
                tr.appendChild(tdPos); tr.appendChild(tdName); tr.appendChild(tdScore);
                scoreBody.appendChild(tr);
            });
        }
    } catch (err) {
        scoreBody.innerHTML = `<tr><td colspan="3" style="color:#666;">No se pudo cargar el ranking.</td></tr>`;
    }

    try {
        const res = await fetch('/api/recent-players?limit=8');
        const data = await res.json();
        const players = data.players || [];
        recentList.innerHTML = '';
        if (players.length === 0) {
            recentList.innerHTML = `<li style="color:#666;">Aún no hay jugadores registrados.</li>`;
        } else {
            players.forEach(p => {
                let li = document.createElement('li');
                let nameSpan = document.createElement('span'); nameSpan.textContent = p.name;
                let timeSpan = document.createElement('span'); timeSpan.className = 'rp-time'; timeSpan.textContent = timeAgo(p.lastSeen);
                li.appendChild(nameSpan); li.appendChild(timeSpan);
                recentList.appendChild(li);
            });
        }
    } catch (err) {
        recentList.innerHTML = `<li style="color:#666;">No se pudo cargar la lista.</li>`;
    }
}

function timeAgo(timestamp) {
    if (!timestamp) return '';
    let diffSec = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
    if (diffSec < 60) return 'ahora';
    let diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `hace ${diffMin}m`;
    let diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `hace ${diffH}h`;
    return `hace ${Math.floor(diffH / 24)}d`;
}

document.getElementById('playerName').addEventListener('input', e => {
    document.getElementById('accederBtn').disabled = e.target.value.trim() === '';
});

async function validateAndEnter() {
    const input = document.getElementById('playerName');
    const errorEl = document.getElementById('gatewayError');
    const btn = document.getElementById('accederBtn');
    const val = input.value.trim();

    if (!val) {
        errorEl.classList.add('show');
        input.classList.remove('input-error');
        void input.offsetWidth;
        input.classList.add('input-error');
        return;
    }

    errorEl.classList.remove('show');
    btn.disabled = true;
    btn.innerText = 'VERIFICANDO...';

    let confirmedName = val.toUpperCase();
    try {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: val, playerId })
        });
        if (res.ok) {
            const data = await res.json();
            confirmedName = data.player;
            if (data.playerId) { playerId = data.playerId; localStorage.setItem('biomass_player_id', playerId); }
        } else {
            addLog('No se pudo verificar contra el servidor, continuando en modo local.');
        }
    } catch (err) {
        addLog('Sin conexión con el servidor, continuando en modo local.');
        console.error('login error:', err);
    }

    playerName = confirmedName;
    document.getElementById('welcomeBack').innerText = `Identidad confirmada: ${confirmedName}`;
    document.getElementById('idGateway').style.display = 'none';
    document.getElementById('labHub').style.display = 'block';

    btn.disabled = false;
    btn.innerText = 'ACCEDER AL LABORATORIO';
}

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
    player.mutations = { acido: 0, puas: 0, alas: 0, regeneracion: 0, pulsoMejora: 1, bossAbanico: 0 };
    enemies = []; dnaPool = []; projectiles = []; powerups = []; damageNumbers = [];
    bossProjectiles = []; coverBlocks = []; activeBoss = null;
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
    document.getElementById('checkingAuth').style.display = 'none';
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

// --- JOYSTICK VIRTUAL ---
let joystickVector = { x: 0, y: 0 };
let joystickActive = false;
let joystickTouchId = null;

function initJoystick() {
    const base = document.getElementById('joystickBase');
    const stick = document.getElementById('joystickStick');
    const maxDist = 34;

    function getCenter() {
        const rect = base.getBoundingClientRect();
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    }

    function pointFromEvent(e) {
        if (e.changedTouches && e.changedTouches.length) {
            if (joystickTouchId === null) return e.changedTouches[0];
            for (let t of e.changedTouches) { if (t.identifier === joystickTouchId) return t; }
            return null;
        }
        return e;
    }

    function handleStart(e) {
        joystickActive = true;
        if (e.changedTouches && e.changedTouches.length) joystickTouchId = e.changedTouches[0].identifier;
        handleMove(e);
    }

    function handleMove(e) {
        if (!joystickActive) return;
        const touch = pointFromEvent(e);
        if (!touch) return;
        const center = getCenter();
        let dx = touch.clientX - center.x;
        let dy = touch.clientY - center.y;
        let dist = Math.hypot(dx, dy);
        let clamped = Math.min(maxDist, dist);
        let angle = Math.atan2(dy, dx);
        let sx = Math.cos(angle) * clamped;
        let sy = Math.sin(angle) * clamped;
        stick.style.transform = `translate(${sx}px, ${sy}px)`;

        if (dist > 8) {
            joystickVector.x = Math.cos(angle) * (clamped / maxDist);
            joystickVector.y = Math.sin(angle) * (clamped / maxDist);
        } else {
            joystickVector.x = 0; joystickVector.y = 0;
        }
        if (e.cancelable) e.preventDefault();
    }

    function handleEnd() {
        joystickActive = false;
        joystickTouchId = null;
        joystickVector.x = 0; joystickVector.y = 0;
        stick.style.transform = 'translate(0px, 0px)';
    }

    base.addEventListener('touchstart', handleStart, { passive: false });
    base.addEventListener('touchmove', handleMove, { passive: false });
    base.addEventListener('touchend', handleEnd);
    base.addEventListener('touchcancel', handleEnd);
    base.addEventListener('mousedown', handleStart);
    window.addEventListener('mousemove', e => { if (joystickActive) handleMove(e); });
    window.addEventListener('mouseup', handleEnd);
}
initJoystick();

function toggleFullscreen() {
    if (!document.fullscreenElement) {
        (document.documentElement.requestFullscreen?.() || Promise.resolve())
            .then(() => { if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {}); })
            .catch(() => {});
    } else {
        document.exitFullscreen?.();
    }
}
document.addEventListener('fullscreenchange', () => {
    const btn = document.getElementById('fullscreenBtn');
    if (btn) btn.innerText = document.fullscreenElement ? '⤢' : '⛶';
});

let rotateDismissed = false;
function dismissRotateOverlay() {
    rotateDismissed = true;
    document.getElementById('rotateOverlay').style.display = 'none';
}
function checkOrientation() {
    if (rotateDismissed) return;
    const isTouch = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
    const isPortrait = window.innerHeight > window.innerWidth;
    document.getElementById('rotateOverlay').style.display = (isTouch && isPortrait) ? 'flex' : 'none';
}
window.addEventListener('resize', checkOrientation);
window.addEventListener('orientationchange', checkOrientation);
checkOrientation();

function createDamageNumber(x, y, amount, isSpecial = false) {
    damageNumbers.push({ worldX: x, worldY: y, text: Math.round(amount), life: 35, color: isSpecial ? '#fffa50' : '#ff4757', size: isSpecial ? 20 : 14 });
}

// --- PULSO ELECTROMAGNÉTICO MEJORADO ---
function triggerPulse() {
    if (!gameActive || player.pulseCooldown > 0) return;
    playSound('pulse'); player.pulseCooldown = 180; player.pulseActiveVisual = 15;
    
    let radius = 100 + (player.mutations.pulsoMejora * 25); 
    let force = 50 + (player.mutations.pulsoMejora * 15);
    
    // Si elegimos defensa (Línea B) y derrotamos al Boss, el pulso se sobrecarga
    let esDefensaConBoss = player.mutations.bossAbanico > 0 && player.mutations.acido === 0;

    if (esDefensaConBoss) {
        radius *= 1.4; // Radio del pulso un 40% mayor
        force *= 1.5;  // Fuerza de empuje aumentada un 50%
        
        // ¡Disparamos 8 espinas radiales del Boss en un ángulo de 360 grados!
        let numSpikes = 8;
        for (let i = 0; i < numSpikes; i++) {
            let angle = (i * (Math.PI * 2)) / numSpikes;
            projectiles.push({
                worldX: player.worldX,
                worldY: player.worldY,
                vx: Math.cos(angle) * 8.5,
                vy: Math.sin(angle) * 8.5,
                radius: 6,
                isBossCopy: true // Identificador visual
            });
        }
        addLog("🛡️ ¡Nova de Espinas Desatada!");
    }
    
    enemies.forEach(e => {
        let dx = e.worldX - player.worldX; let dy = e.worldY - player.worldY;
        if (Math.hypot(dx, dy) < radius) {
            let angle = Math.atan2(dy, dx);
            e.worldX += Math.cos(angle) * force; e.worldY += Math.sin(angle) * force;
            let dmg = 2 + player.mutations.pulsoMejora * 2; e.hp -= dmg; createDamageNumber(e.worldX, e.worldY, dmg, true);
        }
    });

    if (activeBoss) {
        let dx = activeBoss.worldX - player.worldX;
        let dy = activeBoss.worldY - player.worldY;
        if (Math.hypot(dx, dy) < radius) {
            let dmg = (2 + player.mutations.pulsoMejora * 2) * 2;
            activeBoss.hp -= dmg;
            createDamageNumber(activeBoss.worldX, activeBoss.worldY, dmg, true);
        }
    }
    checkEnemyDeaths();
}

// --- GENERACIÓN DE OLEADAS Y BOSS ---
function spawnWave() {
    if (wave % 15 === 0) {
        spawnBoss();
        return;
    }

    let qty = 4 + wave * 2;
    for (let i = 0; i < qty; i++) {
        let angle = Math.random() * Math.PI * 2; let dist = 450 + Math.random() * 150; 
        enemies.push({ 
            worldX: player.worldX + Math.cos(angle) * dist, 
            worldY: player.worldY + Math.sin(angle) * dist, 
            radius: 12, hp: 2 + wave, maxHp: 2 + wave, 
            speed: 1.3 + Math.random() * 1.1, color: '#ff2a2a' 
        });
    }
    if (Math.random() > 0.3) {
        let types = ['heal', 'magnet', 'nuke', 'kame'];
        powerups.push({ worldX: player.worldX + (Math.random() - 0.5) * 600, worldY: player.worldY + (Math.random() - 0.5) * 400, type: types[Math.floor(Math.random() * types.length)] });
    }
}

function spawnBoss() {
    addLog("⚠️ ALERTA DE AMENAZA BIOMÁSICA GIGANTE ACERCÁNDOSE ⚠️");
    playSound('nuke');

    let angle = Math.random() * Math.PI * 2;
    let dist = 500;
    
    activeBoss = {
        worldX: player.worldX + Math.cos(angle) * dist,
        worldY: player.worldY + Math.sin(angle) * dist,
        radius: 48,
        hp: 150 + (wave * 15),
        maxHp: 150 + (wave * 15),
        speed: 1.0,
        color: '#8b0000',
        phase: 1,
        shootCooldown: 0,
        attackTimer: 0,
        isChargingOnda: false,
        ondaChargeProgress: 0,
        ondaRadiusVisual: 0
    };
}

function checkEnemyDeaths() {
    enemies = enemies.filter(e => {
        if(e.hp <= 0) { dnaPool.push({ worldX: e.worldX, worldY: e.worldY, value: 2 }); score += 15 * wave; return false; }
        return true;
    });

    if (activeBoss && activeBoss.hp <= 0) {
        // Drop masivo de ADN
        for (let i = 0; i < 15; i++) {
            dnaPool.push({ 
                worldX: activeBoss.worldX + (Math.random() - 0.5) * 60, 
                worldY: activeBoss.worldY + (Math.random() - 0.5) * 60, 
                value: 5 
            });
        }
        score += 1000 * wave;
        
        // --- ADQUISICIÓN DE RECOMPENSA CORREGIDA ---
        player.mutations.bossAbanico++; 
        
        // Comprobar si tiene el brazo de ácido (Línea Ofensiva) o no (Línea Defensiva)
        if (player.mutations.acido > 0) {
            addLog("🧬 ¡GENOMA ASIMILADO! Has absorbido su ADN de dispersión. ¡Tu brazo químico ahora dispara en abanico!");
        } else {
            addLog("🛡️ ¡GENOMA ASIMILADO! Tu sistema de defensa copia al enemigo. ¡Tu pulso [Espacio] ahora emite una Nova de Espinas!");
        }
        
        actualizarListaMutacionesUI();
        playSound('lvl');
        activeBoss = null;
        coverBlocks = [];
    }
}

function isPlayerCoveredFromBoss() {
    if (!activeBoss) return false;
    
    let dx = activeBoss.worldX - player.worldX;
    let dy = activeBoss.worldY - player.worldY;
    let distToBoss = Math.hypot(dx, dy);
    
    for (let block of coverBlocks) {
        let bx = block.worldX - player.worldX;
        let by = block.worldY - player.worldY;
        let distToBlock = Math.hypot(bx, by);
        
        if (distToBlock < distToBoss) {
            let angleToBoss = Math.atan2(dy, dx);
            let angleToBlock = Math.atan2(by, bx);
            let angleDiff = Math.abs(angleToBoss - angleToBlock);
            if (angleDiff > Math.PI) angleDiff = Math.PI * 2 - angleDiff;
            
            if (angleDiff < 0.25) { 
                return true; 
            }
        }
    }
    return false;
}

function update() {
    if (!gameActive) return;

    let moveX = 0; let moveY = 0;
    if (keys['arrowup'] || keys['w']) moveY = -player.speed;
    if (keys['arrowdown'] || keys['s']) moveY = player.speed;
    if (keys['arrowleft'] || keys['a']) moveX = -player.speed;
    if (keys['arrowright'] || keys['d']) moveX = player.speed;
    if (moveX !== 0 && moveY !== 0) { moveX *= 0.7071; moveY *= 0.7071; }

    if (joystickVector.x !== 0 || joystickVector.y !== 0) {
        moveX = joystickVector.x * player.speed;
        moveY = joystickVector.y * player.speed;
    }
    player.worldX += moveX; player.worldY += moveY;

    if (player.pulseCooldown > 0) player.pulseCooldown--;
    if (player.pulseActiveVisual > 0) player.pulseActiveVisual--;
    
    if (player.kameTimer > 0) {
        player.kameTimer--; if(player.kameTimer % 6 === 0) playSound('laser');
        enemies.forEach(e => {
            let scrX = e.worldX - player.worldX + player.screenX; let scrY = e.worldY - player.worldY + player.screenY;
            if (scrX > player.screenX && scrX < player.screenX + 500 && Math.abs(scrY - player.screenY) < 40) { e.hp -= 0.5; if(Math.random() > 0.7) createDamageNumber(e.worldX, e.worldY, 5, true); }
        });
        if (activeBoss) {
            let scrX = activeBoss.worldX - player.worldX + player.screenX;
            let scrY = activeBoss.worldY - player.worldY + player.screenY;
            if (scrX > player.screenX && scrX < player.screenX + 500 && Math.abs(scrY - player.screenY) < activeBoss.radius) { 
                activeBoss.hp -= 0.8; 
                if(Math.random() > 0.7) createDamageNumber(activeBoss.worldX, activeBoss.worldY, 8, true); 
            }
        }
        checkEnemyDeaths();
    }

    waveTimer++; if (waveTimer > 750) { wave++; waveTimer = 0; spawnWave(); addLog(`Oleada de contención ${wave} aproximándose.`); }

    if (player.mutations.regeneracion > 0) {
        regenTimer++;
        if (regenTimer >= 120) { player.hp = Math.min(player.maxHp, player.hp + (0.6 * player.mutations.regeneracion)); regenTimer = 0; }
    }

    // --- LÓGICA DE ENEMIGOS COMUNES ---
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
            
            if (player.hp <= 0) { player.hp = 0; endGame(); return; }
        }
    }

    // --- LÓGICA EXCLUSIVA DEL BOSS ---
    if (activeBoss) {
        let dx = player.worldX - activeBoss.worldX;
        let dy = player.worldY - activeBoss.worldY;
        let dist = Math.hypot(dx, dy);

        if (activeBoss.phase === 1 && activeBoss.hp < activeBoss.maxHp * 0.5) {
            activeBoss.phase = 2;
            addLog("⚠️ ¡ADVERTENCIA! El jefe mutó a FASE 2. ¡Busca cobertura tras los bloques!");
            playSound('lvl');
            spawnCoverBlocks();
        }

        if (!activeBoss.isChargingOnda) {
            activeBoss.worldX += (dx / (dist || 1)) * activeBoss.speed;
            activeBoss.worldY += (dy / (dist || 1)) * activeBoss.speed;
        }

        if (dist < player.radius + activeBoss.radius) {
            let isImmune = player.invulnUntil && Date.now() < player.invulnUntil;
            if (!isImmune) player.hp -= 2; 
            if (player.hp <= 0) { player.hp = 0; endGame(); return; }
        }

        activeBoss.shootCooldown--;
        activeBoss.attackTimer++;

        if (activeBoss.shootCooldown <= 0 && !activeBoss.isChargingOnda) {
            activeBoss.shootCooldown = 120; 
            playSound('laser');
            
            let numProjectiles = 16;
            let gapIndex1 = Math.floor(Math.random() * numProjectiles);
            let gapIndex2 = (gapIndex1 + 1) % numProjectiles; 

            for (let i = 0; i < numProjectiles; i++) {
                if (i === gapIndex1 || i === gapIndex2) continue; 
                
                let angle = (i * (Math.PI * 2)) / numProjectiles;
                bossProjectiles.push({
                    worldX: activeBoss.worldX,
                    worldY: activeBoss.worldY,
                    vx: Math.cos(angle) * 4.5,
                    vy: Math.sin(angle) * 4.5,
                    radius: 8
                });
            }
        }

        if (activeBoss.phase === 2) {
            if (activeBoss.attackTimer >= 480 && !activeBoss.isChargingOnda) {
                activeBoss.isChargingOnda = true;
                activeBoss.ondaChargeProgress = 0;
                addLog("☢️ ¡El Jefe está canalizando una ONDA DE CHOQUE LETAL! ¡Cúbrete detrás de un bloque!");
                spawnCoverBlocks(); 
            }

            if (activeBoss.isChargingOnda) {
                activeBoss.ondaChargeProgress += 0.5; 
                
                if (Math.floor(activeBoss.ondaChargeProgress) % 20 === 0) {
                    playSound('pulse');
                }

                if (activeBoss.ondaChargeProgress >= 100) {
                    playSound('nuke');
                    activeBoss.isChargingOnda = false;
                    activeBoss.attackTimer = 0;
                    activeBoss.ondaRadiusVisual = 600; 

                    if (isPlayerCoveredFromBoss()) {
                        addLog("🛡️ ¡Bloqueaste la onda expansiva usando la cobertura!");
                        playSound('hit');
                    } else {
                        let isImmune = player.invulnUntil && Date.now() < player.invulnUntil;
                        if (!isImmune) {
                            player.hp -= 65; 
                            createDamageNumber(player.worldX, player.worldY, 65, true);
                            addLog("💥 ¡Impacto directo de la onda expansiva! Daño severo.");
                        }
                        if (player.hp <= 0) { player.hp = 0; endGame(); return; }
                    }
                }
            }
        }
    }

    for (let i = coverBlocks.length - 1; i >= 0; i--) {
        let block = coverBlocks[i];
        block.life--;
        if (block.life <= 0) {
            coverBlocks.splice(i, 1);
        }
    }

    function spawnCoverBlocks() {
        coverBlocks = []; 
        let qty = 3;
        for (let i = 0; i < qty; i++) {
            let angleToBoss = Math.atan2(activeBoss.worldY - player.worldY, activeBoss.worldX - player.worldX);
            let blockAngle = angleToBoss - 0.5 + (i * 0.5); 
            let dist = 120 + Math.random() * 40; 

            coverBlocks.push({
                worldX: player.worldX + Math.cos(blockAngle) * dist,
                worldY: player.worldY + Math.sin(blockAngle) * dist,
                width: 32,
                height: 32,
                life: 450 
            });
        }
    }

    for (let i = bossProjectiles.length - 1; i >= 0; i--) {
        let p = bossProjectiles[i];
        p.worldX += p.vx;
        p.worldY += p.vy;

        let hitBlock = false;
        for (let block of coverBlocks) {
            let dx = p.worldX - block.worldX;
            let dy = p.worldY - block.worldY;
            if (Math.abs(dx) < block.width / 2 && Math.abs(dy) < block.height / 2) {
                hitBlock = true;
                break;
            }
        }

        if (hitBlock) {
            bossProjectiles.splice(i, 1);
            continue;
        }

        let dist = Math.hypot(p.worldX - player.worldX, p.worldY - player.worldY);
        if (dist < p.radius + player.radius) {
            let isImmune = player.invulnUntil && Date.now() < player.invulnUntil;
            if (!isImmune) {
                player.hp -= 10;
                createDamageNumber(player.worldX, player.worldY, 10);
                playSound('hit');
            }
            bossProjectiles.splice(i, 1);
            if (player.hp <= 0) { player.hp = 0; endGame(); return; }
            continue;
        }

        if (Math.hypot(p.worldX - player.worldX, p.worldY - player.worldY) > 800) {
            bossProjectiles.splice(i, 1);
        }
    }

    // --- ATAQUES DEL JUGADOR (CON SOPORTE DE ABANICO DE BOSS) ---
    if (player.mutations.acido > 0 && (enemies.length > 0 || activeBoss)) {
        acidTimer++; let cooldownTarget = Math.max(10, 50 - (player.mutations.acido * 8));
        if (acidTimer >= cooldownTarget) {
            let target = null; let minDist = Infinity;
            
            enemies.forEach(e => { let d = Math.hypot(e.worldX - player.worldX, e.worldY - player.worldY); if (d < minDist) { minDist = d; target = e; } });
            if (activeBoss) {
                let d = Math.hypot(activeBoss.worldX - player.worldX, activeBoss.worldY - player.worldY);
                if (d < minDist) { minDist = d; target = activeBoss; }
            }

            if (target && minDist < 350) {
                let baseAngle = Math.atan2(target.worldY - player.worldY, target.worldX - player.worldX);
                
                // Si el jugador asimiló el ADN del Boss en Senda Ofensiva (disparo en abanico)
                if (player.mutations.bossAbanico > 0) {
                    let conteoDisparos = player.mutations.bossAbanico === 1 ? 3 : 5; 
                    let separacionAngular = 0.25;

                    for (let i = 0; i < conteoDisparos; i++) {
                        let offset = (i - (conteoDisparos - 1) / 2) * separacionAngular;
                        let angle = baseAngle + offset;
                        projectiles.push({ worldX: player.worldX, worldY: player.worldY, vx: Math.cos(angle) * 7.5, vy: Math.sin(angle) * 7.5, radius: 5 });
                    }
                } else {
                    projectiles.push({ worldX: player.worldX, worldY: player.worldY, vx: Math.cos(baseAngle) * 7, vy: Math.sin(baseAngle) * 7, radius: 5 });
                }
                
                playSound('laser');
            }
            acidTimer = 0;
        }
    }

    for (let i = projectiles.length - 1; i >= 0; i--) {
        let p = projectiles[i]; p.worldX += p.vx; p.worldY += p.vy;
        let hit = false;

        for (let j = enemies.length - 1; j >= 0; j--) {
            let e = enemies[j];
            if (Math.hypot(p.worldX - e.worldX, p.worldY - e.worldY) < p.radius + e.radius) {
                // Las espinas radiales del Boss disparadas por el jugador hacen más daño base
                let dmgBase = p.isBossCopy ? 5 : (1 + (player.mutations.acido * 0.5)); 
                e.hp -= dmgBase; 
                createDamageNumber(e.worldX, e.worldY, dmgBase, p.isBossCopy);
                projectiles.splice(i, 1); playSound('hit');
                if (e.hp <= 0) { dnaPool.push({ worldX: e.worldX, worldY: e.worldY, value: 2 }); enemies.splice(j, 1); score += 15 * wave;}
                hit = true; break;
            }
        }

        if (hit) continue;

        if (activeBoss && Math.hypot(p.worldX - activeBoss.worldX, p.worldY - activeBoss.worldY) < p.radius + activeBoss.radius) {
            let dmgBase = p.isBossCopy ? 8 : (1 + (player.mutations.acido * 0.5));
            activeBoss.hp -= dmgBase;
            createDamageNumber(activeBoss.worldX, activeBoss.worldY, dmgBase, p.isBossCopy);
            projectiles.splice(i, 1);
            playSound('hit');
            checkEnemyDeaths();
        }
    }

    for (let i = powerups.length - 1; i >= 0; i--) {
        let pu = powerups[i];
        if (Math.hypot(player.worldX - pu.worldX, player.worldY - pu.worldY) < player.radius + 14) {
            playSound('powerup');
            if (pu.type === 'heal') { player.hp = Math.min(player.maxHp, player.hp + 35); addLog("Kit médico aplicado."); }
            else if (pu.type === 'magnet') { dnaPool.forEach(d => d.magnetized = true); addLog("Atracción magnética de biomasa activada."); }
            else if (pu.type === 'nuke') { 
                playSound('nuke'); 
                enemies.forEach(e => { e.hp = 0; createDamageNumber(e.worldX, e.worldY, 99, true); }); 
                if (activeBoss) { activeBoss.hp -= 50; createDamageNumber(activeBoss.worldX, activeBoss.worldY, 50, true); }
                checkEnemyDeaths(); 
                addLog("PELIGRO: Detonación térmica ejecutada."); 
            }
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
        if (p.isBossCopy) {
            ctx.fillStyle = '#ff4757'; ctx.beginPath(); ctx.arc(scrX, scrY, p.radius + 1, 0, Math.PI*2); ctx.fill();
        } else {
            ctx.fillStyle = '#a3cb38'; ctx.beginPath(); ctx.arc(scrX, scrY, p.radius, 0, Math.PI*2); ctx.fill();
        }
    });

    enemies.forEach(e => {
        let scrX = e.worldX - player.worldX + player.screenX; let scrY = e.worldY - player.worldY + player.screenY;
        ctx.fillStyle = e.color; ctx.beginPath(); 
        ctx.arc(scrX, scrY, e.radius, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#800000'; ctx.beginPath(); ctx.arc(scrX-3, scrY-3, 3, 0, Math.PI*2); ctx.fill();
    });

    coverBlocks.forEach(block => {
        let scrX = block.worldX - player.worldX + player.screenX;
        let scrY = block.worldY - player.worldY + player.screenY;
        ctx.fillStyle = '#57606f';
        ctx.fillRect(scrX - block.width / 2, scrY - block.height / 2, block.width, block.height);
        ctx.strokeStyle = '#54a0ff';
        ctx.lineWidth = 3;
        ctx.strokeRect(scrX - block.width / 2 + 3, scrY - block.height / 2 + 3, block.width - 6, block.height - 6);
    });

    if (activeBoss) {
        let scrX = activeBoss.worldX - player.worldX + player.screenX;
        let scrY = activeBoss.worldY - player.worldY + player.screenY;

        if (activeBoss.isChargingOnda) {
            ctx.strokeStyle = `rgba(255, 71, 87, ${Math.sin(Date.now() * 0.01) * 0.5 + 0.5})`;
            ctx.lineWidth = 5;
            ctx.beginPath();
            ctx.arc(scrX, scrY, activeBoss.radius + 30, 0, Math.PI * 2);
            ctx.stroke();

            ctx.fillStyle = '#ff4757';
            ctx.font = 'bold 16px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(`CARGANDO ONDA: ${Math.floor(activeBoss.ondaChargeProgress)}%`, scrX, scrY - activeBoss.radius - 15);
        }

        ctx.fillStyle = activeBoss.color;
        ctx.beginPath();
        ctx.arc(scrX, scrY, activeBoss.radius, 0, Math.PI*2);
        ctx.fill();

        ctx.fillStyle = activeBoss.phase === 2 ? '#ff4757' : '#ff9f43';
        ctx.beginPath();
        ctx.arc(scrX, scrY, activeBoss.radius * 0.4, 0, Math.PI*2);
        ctx.fill();

        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.arc(scrX - 10, scrY - 10, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ff3838';
        ctx.beginPath();
        ctx.arc(scrX - 12, scrY - 10, 6, 0, Math.PI * 2);
        ctx.fill();

        let barW = 120;
        let barH = 10;
        ctx.fillStyle = '#333';
        ctx.fillRect(scrX - barW / 2, scrY - activeBoss.radius - 35, barW, barH);
        ctx.fillStyle = '#ff4d4d';
        ctx.fillRect(scrX - barW / 2, scrY - activeBoss.radius - 35, barW * (activeBoss.hp / activeBoss.maxHp), barH);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.strokeRect(scrX - barW / 2, scrY - activeBoss.radius - 35, barW, barH);
    }

    bossProjectiles.forEach(p => {
        let scrX = p.worldX - player.worldX + player.screenX;
        let scrY = p.worldY - player.worldY + player.screenY;
        ctx.fillStyle = '#ff3838'; 
        ctx.beginPath();
        ctx.arc(scrX, scrY, p.radius, 0, Math.PI*2);
        ctx.fill();
        ctx.strokeStyle = '#ffb8b8';
        ctx.lineWidth = 2;
        ctx.stroke();
    });

    if (activeBoss && activeBoss.ondaRadiusVisual > 0) {
        let scrX = activeBoss.worldX - player.worldX + player.screenX;
        let scrY = activeBoss.worldY - player.worldY + player.screenY;
        ctx.strokeStyle = `rgba(255, 71, 87, ${activeBoss.ondaRadiusVisual / 600})`;
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.arc(scrX, scrY, 600 - activeBoss.ondaRadiusVisual, 0, Math.PI * 2);
        ctx.stroke();
        activeBoss.ondaRadiusVisual -= 15;
    }

    if (player.kameTimer > 0) {
        let grad = ctx.createLinearGradient(player.screenX, player.screenY, player.screenX + 500, player.screenY);
        grad.addColorStop(0, "rgba(0, 255, 255, 0.9)"); grad.addColorStop(0.5, "rgba(255, 255, 255, 1)"); grad.addColorStop(1, "rgba(0, 150, 255, 0)");
        ctx.fillStyle = grad; ctx.fillRect(player.screenX + player.radius, player.screenY - 20, 500, 40) ;
    }

    if (player.pulseActiveVisual > 0) {
        let radioDinamico = 100 + (player.mutations.pulsoMejora * 25);
        if (player.mutations.bossAbanico > 0 && player.mutations.acido === 0) radioDinamico *= 1.4;
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

    if (player.mutations.alas > 0) {
        ctx.fillStyle = 'rgba(84, 160, 255, 0.6)';
        let wingW = 15 + player.mutations.alas * 5 + Math.sin(Date.now() * 0.01) * 3;
        ctx.beginPath(); ctx.moveTo(player.screenX - 8, player.screenY); ctx.lineTo(player.screenX - 8 - wingW, player.screenY - 15); ctx.lineTo(player.screenX - 12, player.screenY + 10); ctx.fill();
        ctx.beginPath(); ctx.moveTo(player.screenX + 8, player.screenY); ctx.lineTo(player.screenX + 8 + wingW, player.screenY - 15); ctx.lineTo(player.screenX + 12, player.screenY + 10); ctx.fill();
    }

    ctx.fillStyle = (player.mutations.regeneracion > 0) ? '#d1ffd1' : '#ffffff'; 
    ctx.fillRect(player.screenX - 10, player.screenY - 8, 20, 22);
    
    if(player.mutations.regeneracion > 0) {
        ctx.fillStyle = '#4af626'; ctx.beginPath(); ctx.arc(player.screenX, player.screenY + 3, 4 + Math.sin(Date.now()*0.005)*2, 0, Math.PI*2); ctx.fill();
    }

    if (player.mutations.puas > 0) { 
        ctx.fillStyle = '#ff9f43';
        let puaSize = 4 + player.mutations.puas * 2;
        ctx.beginPath(); ctx.moveTo(player.screenX - 10, player.screenY); ctx.lineTo(player.screenX - 10 - puaSize, player.screenY - puaSize); ctx.lineTo(player.screenX - 5, player.screenY - 5); ctx.fill();
        ctx.beginPath(); ctx.moveTo(player.screenX + 10, player.screenY); ctx.lineTo(player.screenX + 10 + puaSize, player.screenY - puaSize); ctx.lineTo(player.screenX + 5, player.screenY - 5); ctx.fill();
    }

    ctx.fillStyle = '#ffccaa';
    ctx.beginPath(); ctx.arc(player.screenX, player.screenY - 12, 7, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#333';
    ctx.fillRect(player.screenX - 6, player.screenY - 14, 4, 3); ctx.fillRect(player.screenX + 2, player.screenY - 14, 4, 3);

    if (player.mutations.acido > 0) { 
        ctx.fillStyle = '#4af626'; ctx.beginPath(); 
        ctx.arc(player.screenX + 14, player.screenY + 2, 6 + player.mutations.acido, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#27ae60'; ctx.beginPath(); ctx.arc(player.screenX + 14, player.screenY + 2, 3, 0, Math.PI*2); ctx.fill();
    } else {
        ctx.fillStyle = '#ffffff'; ctx.fillRect(player.screenX + 10, player.screenY - 8, 4, 12);
    }
    ctx.fillStyle = '#ffffff'; ctx.fillRect(player.screenX - 14, player.screenY - 8, 4, 12);

    damageNumbers.forEach(dn => {
        let scrX = dn.worldX - player.worldX + player.screenX; let scrY = dn.worldY - player.worldY + player.screenY;
        ctx.fillStyle = dn.color; ctx.font = `bold ${dn.size}px monospace`; ctx.fillText(dn.text, scrX, scrY);
    });
}

function checkLevelUp() {
    if (!gameActive) return;
    if (player.dna >= player.dnaNeeded) {
        playSound('lvl'); player.dna -= player.dnaNeeded; player.level++; player.dnaNeeded = Math.floor(player.dnaNeeded * 1.5); gameActive = false; showMutationMenu();
    }
}

function showMutationMenu() {
    const modal = document.getElementById('mutationModal');
    const container = document.getElementById('mutationOptions');

    gameActive = false;
    addLog("ADVERTENCIA: Alteración del genoma detectada.");
    container.innerHTML = '';

    const opciones = MUTACIONES_DATA.filter(m => !m.linea || !player.lineaElegida || m.linea === player.lineaElegida);

    opciones.forEach(m => {
        let nivelActual = player.mutations[m.id];
        let txtBoton = nivelActual > 0 ? `Profundizar ${m.nombre} (+${nivelActual + 1})` : `Inyectar ${m.nombre}`;
        if(m.id === 'pulsoMejora') txtBoton = `Mejorar Sobrecarga (+${nivelActual + 1})`;

        let btn = document.createElement('button');
        btn.className = 'btn-mutar';
        let tagHtml = m.linea ? `<span class="mut-linea-tag linea-${m.linea}">${NOMBRES_LINEA[m.linea]}</span>` : '';
        btn.innerHTML = `${tagHtml}<strong>${txtBoton}</strong><span class="mut-desc">${m.desc}</span>`;

        btn.onclick = (e) => {
            e.preventDefault();
            aplicarMutacion(m.id, m.nombre, m.linea);
        };

        container.appendChild(btn);
    });

    modal.style.display = 'block';
}

function aplicarMutacion(id, nombre, linea) {
    document.getElementById('mutationModal').style.display = 'none';

    player.mutations[id]++;
    let nuevoNivel = player.mutations[id];
    addLog(`Mutación aceptada: ${nombre} Fase ${nuevoNivel}. El cuerpo se adapta.`);

    if (linea && !player.lineaElegida) {
        player.lineaElegida = linea;
        addLog(`Línea genética ${NOMBRES_LINEA[linea]} fijada. La línea rival ya no estará disponible.`);
    }

    if (id === 'alas') {
        player.speed = player.baseSpeed + (player.mutations.alas * 0.6);
    }

    actualizarListaMutacionesUI();

    setTimeout(() => {
        gameActive = true;
    }, 50);
}

function actualizarListaMutacionesUI() {
    let listaActivas = [];
    for (let key in player.mutations) {
        if (player.mutations[key] > 0) {
            let ref = MUTACIONES_DATA.find(m => m.id === key);
            if (ref) {
                listaActivas.push(`${ref.nombre} (Fase ${player.mutations[key]})`);
            } else if (key === 'bossAbanico') {
                if (player.mutations.acido > 0) {
                    listaActivas.push(`🔥 Genoma Boss: Dispersión x${player.mutations[key] === 1 ? 3 : 5}`);
                } else {
                    listaActivas.push(`🛡️ Genoma Boss: Nova de Espinas`);
                }
            }
        }
    }
    document.getElementById('ui-mutations').innerHTML = "Mutaciones Activas:<br>" + (listaActivas.length > 0 ? listaActivas.join("<br>") : "Estado Físico: Humano Normal");
}

function gameLoop() { update(); render(); requestAnimationFrame(gameLoop); }