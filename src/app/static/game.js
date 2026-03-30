// ============================================================
// HEDGEHOG HIGHWAY - A DEFRA Conservation Simulator
// ============================================================

// --- CONFIG ---
const CONFIG = {
    W: 320,
    H: 480,
    TILE: 32,
    COLS: 10,
    ROWS: 15,
    ROUND_TIME: 45,
    INITIAL_LIVES: 3,
};

// Lane definitions: row 0 = top, row 14 = bottom
// type: 'safe' | 'road' | 'farm' | 'water' | 'fence'
const LANE_DEFS = [
    { row: 0,  type: 'safe',  label: 'SANCTUARY' },
    { row: 1,  type: 'fence', label: 'Garden Fence' },
    { row: 2,  type: 'road',  speed: 1.2, dir: 1,  sprites: ['landrover', 'cyclist'],   spawnRate: 0.012 },
    { row: 3,  type: 'road',  speed: 0.9, dir: -1, sprites: ['cyclist', 'landrover'],    spawnRate: 0.010 },
    { row: 4,  type: 'safe',  label: 'hedge' },
    { row: 5,  type: 'water', speed: 0.8, dir: 1,  sprites: ['log', 'lilypad'],          spawnRate: 0.015 },
    { row: 6,  type: 'safe',  label: 'hedge' },
    { row: 7,  type: 'farm',  speed: 0.6, dir: -1, sprites: ['sheep', 'sheep', 'sheep'], spawnRate: 0.014 },
    { row: 8,  type: 'farm',  speed: 1.4, dir: 1,  sprites: ['combine'],                 spawnRate: 0.006 },
    { row: 9,  type: 'safe',  label: 'hedge' },
    { row: 10, type: 'road',  speed: 1.0, dir: -1, sprites: ['car_red', 'car_blue', 'tractor'],  spawnRate: 0.012 },
    { row: 11, type: 'road',  speed: 1.5, dir: 1,  sprites: ['royalmail', 'car_green'],          spawnRate: 0.010 },
    { row: 12, type: 'safe',  label: 'hedge' },
    { row: 13, type: 'safe',  label: 'start_area' },
    { row: 14, type: 'safe',  label: 'start' },
];

const DEATH_MESSAGES = [
    "Bit of a sticky wicket, that.",
    "Should've used the hedgehog crossing.",
    "That's going in the DEFRA incident report.",
    "Health & Safety would like a word.",
    "Right. Third risk assessment this week.",
    "The Environment Agency sends its condolences.",
    "That tractor came out of nowhere. Allegedly.",
    "Hedgehog down! Hedgehog down!",
    "The A-road claims another victim.",
    "Not quite what Natural England had in mind.",
];

const SPLASH_MESSAGES = [
    "Hedgehogs can swim! Just... not this one.",
    "Splosh. Should've packed armbands.",
    "The RSPCA has been notified.",
    "That stream was deeper than it looked.",
];

const VICTORY_MESSAGES = [
    "SANCTUARY REACHED! Another hedgehog saved from the B-roads!",
    "DEFRA approves! Biodiversity +1!",
    "A triumph for British wildlife!",
    "The hedgehog has been awarded an OBE.",
    "One small step for hog, one giant leap for hogkind.",
    "Natural England is delighted!",
];

const SHEEP_MESSAGES = [
    "You befriended a sheep! (+20)",
    "Baa-rilliant! (+20)",
    "The sheep is now your emotional support animal. (+20)",
    "Ewe made a friend! (+20)",
];

const GAMEOVER_MESSAGES = [
    "The Minister for the Environment has been notified.",
    "Perhaps try a less ambitious route next time.",
    "The hedgehog preservation society is disappointed.",
    "Brexit didn't prepare us for this.",
    "The countryside will remember your sacrifice.",
];

// --- STATE ---
let state = {};
let canvas, ctx;
let lastTime = 0;
let timerAccum = 0;
let audioCtx = null;
let highestRow = CONFIG.ROWS - 1;
let playerName = 'HEDGEHOG';

function initState() {
    highestRow = CONFIG.ROWS - 1;
    state = {
        screen: 'TITLE',
        score: 0,
        hedgehogsSaved: 0,
        highScore: parseInt(localStorage.getItem('hedgehogHighScore') || '0'),
        lives: CONFIG.INITIAL_LIVES,
        timeRemaining: CONFIG.ROUND_TIME,
        round: 1,
        speedMultiplier: 1.0,
        player: {
            x: 4 * CONFIG.TILE,
            y: 14 * CONFIG.TILE,
            w: CONFIG.TILE - 4,
            h: CONFIG.TILE - 4,
            moving: false,
            targetX: 4 * CONFIG.TILE,
            targetY: 14 * CONFIG.TILE,
            facing: 'up',
            animFrame: 0,
            animTimer: 0,
            dead: false,
            onPlatform: null,
        },
        entities: [],
        acorns: [],
        particles: [],
        fenceGapX: (Math.floor(Math.random() * 8) + 1) * CONFIG.TILE,
        deathTimer: 0,
        victoryTimer: 0,
        messageTimer: 0,
        currentMessage: '',
        shaking: false,
        duckX: -50,
        duckDir: 1,
    };
}

// --- INIT ---
function init() {
    canvas = document.getElementById('game-canvas');
    ctx = canvas.getContext('2d');
    canvas.width = CONFIG.W;
    canvas.height = CONFIG.H;

    initState();
    updateLivesDisplay();

    document.addEventListener('keydown', handleKeyDown);
    canvas.addEventListener('click', handleClick);
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd, { passive: false });

    // Mobile d-pad
    ['up', 'down', 'left', 'right'].forEach(dir => {
        const btn = document.getElementById('btn-' + dir);
        if (btn) {
            btn.addEventListener('touchstart', (e) => { e.preventDefault(); movePlayer(dir); });
            btn.addEventListener('mousedown', () => movePlayer(dir));
        }
    });

    requestAnimationFrame(gameLoop);
}

// --- AUDIO ---
function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
}

function playTone(freq, duration, type, volume, slide) {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    if (slide) {
        osc.frequency.linearRampToValueAtTime(slide, audioCtx.currentTime + duration);
    }
    gain.gain.setValueAtTime(volume || 0.1, audioCtx.currentTime);
    gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
}

function playHop() { playTone(220, 0.05, 'square', 0.08, 440); }
function playPickup() { playTone(440, 0.08, 'triangle', 0.1, 880); setTimeout(() => playTone(660, 0.1, 'triangle', 0.1, 1100), 80); }
function playDeath() { playTone(440, 0.3, 'square', 0.12, 110); }
function playSplash() {
    if (!audioCtx) return;
    const bufferSize = audioCtx.sampleRate * 0.15;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    const source = audioCtx.createBufferSource();
    const gain = audioCtx.createGain();
    source.buffer = buffer;
    gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
    source.connect(gain);
    gain.connect(audioCtx.destination);
    source.start();
}
function playVictory() {
    [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => playTone(f, 0.15, 'triangle', 0.1), i * 150));
}
function playSheep() { playTone(300, 0.1, 'sawtooth', 0.06, 350); setTimeout(() => playTone(280, 0.15, 'sawtooth', 0.06, 320), 100); }
function playGameOver() {
    [440, 370, 311, 261].forEach((f, i) => setTimeout(() => playTone(f, 0.3, 'square', 0.1), i * 300));
}

// --- INPUT ---
let touchStartX = 0, touchStartY = 0;

function handleKeyDown(e) {
    initAudio();
    if (state.screen === 'TITLE') {
        if (document.activeElement === document.getElementById('username-field') && e.code !== 'Enter') return;
        if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); startGame(); }
        return;
    }
    if (state.screen === 'GAME_OVER') {
        if (e.code === 'Space' || e.code === 'Enter') restartGame();
        return;
    }
    if (state.screen !== 'PLAYING' || state.player.dead) return;

    const dirMap = {
        ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
        KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right',
    };
    if (dirMap[e.code]) {
        e.preventDefault();
        movePlayer(dirMap[e.code]);
    }
}

function handleClick() {
    initAudio();
    if (state.screen === 'TITLE') startGame();
    else if (state.screen === 'GAME_OVER') restartGame();
}

function handleTouchStart(e) {
    e.preventDefault();
    initAudio();
    if (state.screen === 'TITLE') { startGame(); return; }
    if (state.screen === 'GAME_OVER') { restartGame(); return; }
    const t = e.touches[0];
    touchStartX = t.clientX;
    touchStartY = t.clientY;
}

function handleTouchEnd(e) {
    e.preventDefault();
    if (state.screen !== 'PLAYING' || state.player.dead) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStartX;
    const dy = t.clientY - touchStartY;
    const minSwipe = 20;
    if (Math.abs(dx) < minSwipe && Math.abs(dy) < minSwipe) {
        movePlayer('up');
        return;
    }
    if (Math.abs(dx) > Math.abs(dy)) {
        movePlayer(dx > 0 ? 'right' : 'left');
    } else {
        movePlayer(dy > 0 ? 'down' : 'up');
    }
}

function movePlayer(dir) {
    const p = state.player;
    if (p.moving || p.dead) return;

    let nx = p.x, ny = p.y;
    if (dir === 'up') ny -= CONFIG.TILE;
    else if (dir === 'down') ny += CONFIG.TILE;
    else if (dir === 'left') nx -= CONFIG.TILE;
    else if (dir === 'right') nx += CONFIG.TILE;

    if (nx < 0 || nx >= CONFIG.W || ny < 0 || ny >= CONFIG.H) return;

    p.targetX = nx;
    p.targetY = ny;
    p.moving = true;
    p.facing = dir;
    playHop();
}

// --- GAME FLOW ---
function startGame() {
    const nameField = document.getElementById('username-field');
    playerName = (nameField.value.trim() || 'HEDGEHOG').toUpperCase().slice(0, 12);
    nameField.value = playerName;

    initState();
    state.screen = 'PLAYING';
    document.getElementById('title-screen').classList.add('hidden');
    document.getElementById('gameover-screen').classList.add('hidden');
    document.getElementById('hud').style.display = 'flex';
    updateLivesDisplay();
    updateScoreDisplay();
    updateTimerDisplay();
}

function restartGame() {
    startGame();
}

function loseLife(isSplash) {
    const p = state.player;
    p.dead = true;
    state.deathTimer = 90; // frames
    state.shaking = true;
    setTimeout(() => { state.shaking = false; }, 150);
    document.getElementById('game-container').classList.add('shake');
    setTimeout(() => document.getElementById('game-container').classList.remove('shake'), 150);

    if (isSplash) {
        playSplash();
        showMessage('death', randomFrom(SPLASH_MESSAGES));
    } else {
        playDeath();
        showMessage('death', randomFrom(DEATH_MESSAGES));
    }

    state.lives--;
    updateLivesDisplay();

    if (state.lives <= 0) {
        setTimeout(() => gameOver(), 1500);
    }
}

function reachSanctuary() {
    state.player.dead = true;
    state.victoryTimer = 120;
    playVictory();

    state.hedgehogsSaved++;
    const timeBonus = state.timeRemaining * 3;
    state.score += 50 + timeBonus;
    updateScoreDisplay();

    showMessage('victory', randomFrom(VICTORY_MESSAGES) + ` (+${50 + timeBonus})`);

    setTimeout(() => {
        if (state.screen !== 'PLAYING') return;
        state.round++;
        state.speedMultiplier += 0.15;
        state.timeRemaining = CONFIG.ROUND_TIME;
        state.fenceGapX = (Math.floor(Math.random() * 8) + 1) * CONFIG.TILE;
        state.entities = [];
        state.acorns = [];
        highestRow = CONFIG.ROWS - 1;
        const p = state.player;
        p.x = 4 * CONFIG.TILE;
        p.y = 14 * CONFIG.TILE;
        p.targetX = p.x;
        p.targetY = p.y;
        p.dead = false;
        p.moving = false;
        p.onPlatform = null;
        hideMessages();
        updateTimerDisplay();
    }, 2000);
}

function gameOver() {
    state.screen = 'GAME_OVER';
    playGameOver();
    hideMessages();

    document.getElementById('go-hedgehogs-saved').textContent = `Hedgehogs saved: ${state.hedgehogsSaved}`;
    document.getElementById('go-final-score').textContent = `Final score: ${state.score}`;
    document.getElementById('go-message').textContent = randomFrom(GAMEOVER_MESSAGES);
    document.getElementById('lb-entries').innerHTML = '<p style="font-size:5px;color:#666">Loading...</p>';
    document.getElementById('gameover-screen').classList.remove('hidden');

    // Submit score then fetch leaderboard
    submitScore(playerName, state.score, state.round).then(myId => fetchLeaderboard(myId));
}

function submitScore(username, score, round) {
    return fetch('/api/scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, score, round }),
    })
    .then(r => r.json())
    .then(data => data.id)
    .catch(() => null);
}

function fetchLeaderboard(myId) {
    fetch('/api/scores')
        .then(r => r.json())
        .then(scores => {
            const el = document.getElementById('lb-entries');
            if (!scores.length) { el.innerHTML = '<p style="font-size:5px;color:#666">No scores yet!</p>'; return; }
            let html = scores.map((s, i) =>
                `<div class="lb-row${s.id === myId ? ' you' : ''}">` +
                `<span class="lb-rank">${i + 1}.</span>` +
                `<span class="lb-name">${s.username}</span>` +
                `<span class="lb-score">${s.score}</span></div>`
            ).join('');
            // If player's score didn't make top 10, show it below with a separator
            if (myId && !scores.find(s => s.id === myId)) {
                html += '<div class="lb-row" style="border-top:1px solid rgba(255,255,255,0.2);margin-top:4px;padding-top:4px">' +
                    '<span class="lb-rank" style="color:#666">...</span>' +
                    '<span class="lb-name" style="color:#666"></span>' +
                    '<span class="lb-score" style="color:#666"></span></div>';
                html += `<div class="lb-row you">` +
                    `<span class="lb-rank">--</span>` +
                    `<span class="lb-name">${playerName}</span>` +
                    `<span class="lb-score">${state.score}</span></div>`;
            }
            el.innerHTML = html;
        })
        .catch(() => {
            document.getElementById('lb-entries').innerHTML = '<p style="font-size:5px;color:#666">Offline</p>';
        });
}

// --- UPDATE ---
function update(dt) {
    if (state.screen !== 'PLAYING') return;

    const p = state.player;

    // Smooth movement
    if (p.moving) {
        const speed = 4;
        const dx = p.targetX - p.x;
        const dy = p.targetY - p.y;
        if (Math.abs(dx) <= speed && Math.abs(dy) <= speed) {
            p.x = p.targetX;
            p.y = p.targetY;
            p.moving = false;

            // Track highest row for scoring
            const currentRow = Math.floor(p.y / CONFIG.TILE);
            if (currentRow < highestRow) {
                state.score += (highestRow - currentRow) * 10;
                highestRow = currentRow;
                updateScoreDisplay();
            }
        } else {
            p.x += Math.sign(dx) * speed;
            p.y += Math.sign(dy) * speed;
        }
    }

    // Animation
    p.animTimer++;
    if (p.animTimer > 8) { p.animFrame = 1 - p.animFrame; p.animTimer = 0; }

    // Timer
    timerAccum += dt;
    if (timerAccum >= 1000) {
        timerAccum -= 1000;
        if (!p.dead) {
            state.timeRemaining--;
            updateTimerDisplay();
            if (state.timeRemaining <= 0) {
                loseLife(false);
                if (state.lives > 0) {
                    state.timeRemaining = CONFIG.ROUND_TIME;
                }
            }
        }
    }

    // Death/victory timers
    if (state.deathTimer > 0) {
        state.deathTimer--;
        if (state.deathTimer === 0 && state.lives > 0) {
            respawnPlayer();
        }
    }
    if (state.victoryTimer > 0) {
        state.victoryTimer--;
    }

    // Spawn & move entities
    updateEntities(dt);

    // Spawn acorns occasionally
    if (Math.random() < 0.002 && state.acorns.length < 3) {
        const safeRows = [4, 6, 9, 12, 13];
        const row = safeRows[Math.floor(Math.random() * safeRows.length)];
        const col = Math.floor(Math.random() * CONFIG.COLS);
        state.acorns.push({ x: col * CONFIG.TILE + 8, y: row * CONFIG.TILE + 8, w: 16, h: 16, timer: 300 });
    }

    // Update acorns
    state.acorns = state.acorns.filter(a => {
        a.timer--;
        return a.timer > 0;
    });

    // Move duck
    state.duckX += 0.3 * state.duckDir;
    if (state.duckX > CONFIG.W + 20) state.duckX = -20;

    // Collision detection
    if (!p.dead && !p.moving) {
        checkCollisions();
    }

    // Particles
    state.particles = state.particles.filter(pt => {
        pt.x += pt.vx;
        pt.y += pt.vy;
        pt.vy += 0.1;
        pt.life--;
        return pt.life > 0;
    });
}

function updateEntities(dt) {
    // Spawn new entities
    LANE_DEFS.forEach(lane => {
        if (!lane.speed) return;
        if (Math.random() < lane.spawnRate * state.speedMultiplier) {
            const spriteType = lane.sprites[Math.floor(Math.random() * lane.sprites.length)];
            const w = getEntityWidth(spriteType);
            const x = lane.dir > 0 ? -w : CONFIG.W;
            state.entities.push({
                x, y: lane.row * CONFIG.TILE,
                w, h: CONFIG.TILE - 2,
                speed: lane.speed * state.speedMultiplier * lane.dir,
                type: spriteType,
                laneType: lane.type,
                row: lane.row,
            });
        }
    });

    // Move entities
    state.entities.forEach(e => { e.x += e.speed; });

    // Remove off-screen
    state.entities = state.entities.filter(e =>
        e.x > -e.w - 10 && e.x < CONFIG.W + 10
    );
}

function getEntityWidth(type) {
    switch (type) {
        case 'log': return 80;
        case 'combine': return 64;
        case 'tractor': return 42;
        case 'royalmail': return 44;
        case 'landrover': return 44;
        case 'sheep': return 30;
        case 'lilypad': return 32;
        case 'cyclist': return 28;
        default: return 36;
    }
}

function checkCollisions() {
    const p = state.player;
    const pBox = { x: p.x + 2, y: p.y + 2, w: p.w, h: p.h };
    const currentRow = Math.floor(p.y / CONFIG.TILE);
    const lane = LANE_DEFS.find(l => l.row === currentRow);

    if (!lane) return;

    // Fence - just a gate, blocks or lets you stand on the row
    if (lane.type === 'fence') {
        const snappedX = Math.round(p.x / CONFIG.TILE) * CONFIG.TILE;
        p.x = snappedX;
        p.targetX = snappedX;

        const playerCenter = p.x + CONFIG.TILE / 2;
        if (playerCenter < state.fenceGapX || playerCenter > state.fenceGapX + CONFIG.TILE) {
            // Blocked - push back
            p.y += CONFIG.TILE;
            p.targetY = p.y;
            playTone(150, 0.1, 'square', 0.08);
        }
        // Otherwise: player stays on fence row, can keep moving up to sanctuary
        return;
    }

    // Victory ONLY when player reaches row 0
    if (lane.type === 'safe' && lane.label === 'SANCTUARY') {
        reachSanctuary();
        return;
    }

    // Water - need to be on a platform
    if (lane.type === 'water') {
        let onPlatform = false;
        state.entities.forEach(e => {
            if (e.row === currentRow && collides(pBox, e)) {
                onPlatform = true;
                p.x += e.speed; // Move with platform
                p.targetX = p.x;
                // Clamp to screen
                if (p.x < 0 || p.x >= CONFIG.W - p.w) {
                    loseLife(true);
                }
            }
        });
        if (!onPlatform) {
            loseLife(true);
        }
        return;
    }

    // Road & farm collisions
    state.entities.forEach(e => {
        if (e.row !== currentRow) return;
        if (!collides(pBox, e)) return;

        if (e.type === 'sheep') {
            state.score += 20;
            updateScoreDisplay();
            playSheep();
            showMessage('victory', randomFrom(SHEEP_MESSAGES));
            setTimeout(() => hideMessages(), 1200);
            spawnParticles(e.x + e.w / 2, e.y + e.h / 2, '#ffffff');
            // Remove the sheep
            e.x = -999;
        } else if (lane.type === 'road' || e.type === 'combine') {
            loseLife(false);
        }
    });

    // Acorn pickup
    state.acorns = state.acorns.filter(a => {
        if (collides(pBox, a)) {
            state.score += 5;
            updateScoreDisplay();
            playPickup();
            spawnParticles(a.x + a.w / 2, a.y + a.h / 2, '#8B6914');
            return false;
        }
        return true;
    });
}

function respawnPlayer() {
    const p = state.player;
    p.x = 4 * CONFIG.TILE;
    p.y = 14 * CONFIG.TILE;
    p.targetX = p.x;
    p.targetY = p.y;
    p.dead = false;
    p.moving = false;
    p.onPlatform = null;
    highestRow = CONFIG.ROWS - 1;
    hideMessages();
}

function collides(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function spawnParticles(x, y, color) {
    for (let i = 0; i < 8; i++) {
        state.particles.push({
            x, y,
            vx: (Math.random() - 0.5) * 4,
            vy: (Math.random() - 0.5) * 4 - 2,
            life: 20 + Math.random() * 20,
            color,
            size: 2 + Math.random() * 3,
        });
    }
}

// --- RENDER ---
function render() {
    ctx.clearRect(0, 0, CONFIG.W, CONFIG.H);

    drawBackground();
    drawEntities();
    drawAcorns();
    drawFence();

    if (!state.player.dead || state.deathTimer > 0) {
        drawPlayer();
    }

    drawDuck();
    drawParticles();
}

function drawBackground() {
    LANE_DEFS.forEach(lane => {
        const y = lane.row * CONFIG.TILE;

        switch (lane.type) {
            case 'road':
                ctx.fillStyle = '#555566';
                ctx.fillRect(0, y, CONFIG.W, CONFIG.TILE);
                // Dashed center line
                ctx.fillStyle = '#aaaa77';
                for (let x = ((Date.now() / 50) % 20) - 20; x < CONFIG.W; x += 20) {
                    ctx.fillRect(x, y + CONFIG.TILE / 2 - 1, 10, 2);
                }
                break;
            case 'farm':
                ctx.fillStyle = lane.row === 8 ? '#5a7a3a' : '#6b8e3a';
                ctx.fillRect(0, y, CONFIG.W, CONFIG.TILE);
                // Furrow lines
                ctx.fillStyle = '#4a6e2a';
                for (let x = 0; x < CONFIG.W; x += 16) {
                    ctx.fillRect(x, y + CONFIG.TILE - 2, 12, 1);
                }
                break;
            case 'water':
                ctx.fillStyle = '#2266aa';
                ctx.fillRect(0, y, CONFIG.W, CONFIG.TILE);
                // Wave pattern
                ctx.fillStyle = '#3377bb';
                const waveOffset = (Date.now() / 200) % 16;
                for (let x = -16 + waveOffset; x < CONFIG.W; x += 16) {
                    ctx.fillRect(x, y + 6, 8, 2);
                    ctx.fillRect(x + 4, y + 18, 8, 2);
                }
                break;
            case 'fence':
                ctx.fillStyle = '#4a7c3a';
                ctx.fillRect(0, y, CONFIG.W, CONFIG.TILE);
                // Fence
                ctx.fillStyle = '#6b4226';
                ctx.fillRect(0, y + 8, CONFIG.W, 16);
                ctx.fillStyle = '#8B5A2B';
                ctx.fillRect(0, y + 10, CONFIG.W, 2);
                ctx.fillRect(0, y + 20, CONFIG.W, 2);
                // Fence posts
                for (let x = 0; x < CONFIG.W; x += CONFIG.TILE) {
                    ctx.fillStyle = '#5a3a1a';
                    ctx.fillRect(x + 14, y + 4, 4, 24);
                }
                // Gap
                ctx.fillStyle = '#4a7c3a';
                ctx.fillRect(state.fenceGapX, y + 4, CONFIG.TILE, 26);
                // Gap sign
                ctx.fillStyle = '#fff';
                ctx.font = '3px "Press Start 2P"';
                ctx.fillText('HH', state.fenceGapX + 6, y + 18);
                break;
            case 'safe':
                if (lane.label === 'SANCTUARY') {
                    ctx.fillStyle = '#3a8c4a';
                    ctx.fillRect(0, y, CONFIG.W, CONFIG.TILE);
                    ctx.fillStyle = '#fff';
                    ctx.font = '5px "Press Start 2P"';
                    ctx.textAlign = 'center';
                    ctx.fillText('SANCTUARY', CONFIG.W / 2, y + 20);
                    ctx.textAlign = 'left';
                } else if (lane.label === 'hedge') {
                    ctx.fillStyle = '#3a6e2a';
                    ctx.fillRect(0, y, CONFIG.W, CONFIG.TILE);
                    // Hedge bushes
                    ctx.fillStyle = '#2d5a1e';
                    for (let x = 0; x < CONFIG.W; x += 20) {
                        drawBush(x + 4, y + 4, 16, 24);
                    }
                } else {
                    ctx.fillStyle = '#4a7c3a';
                    ctx.fillRect(0, y, CONFIG.W, CONFIG.TILE);
                    // Grass tufts
                    ctx.fillStyle = '#5a8c4a';
                    for (let x = 0; x < CONFIG.W; x += 12) {
                        ctx.fillRect(x, y + 10, 2, 6);
                        ctx.fillRect(x + 4, y + 8, 2, 8);
                    }
                }
                break;
        }
    });
}

function drawBush(x, y, w, h) {
    ctx.beginPath();
    ctx.arc(x + w / 2, y + h / 2, w / 2, 0, Math.PI * 2);
    ctx.fill();
}

function drawEntities() {
    state.entities.forEach(e => {
        switch (e.type) {
            case 'car_red': drawCar(e.x, e.y, '#cc3333', e.speed > 0); break;
            case 'car_blue': drawCar(e.x, e.y, '#3355cc', e.speed > 0); break;
            case 'car_green': drawCar(e.x, e.y, '#336633', e.speed > 0); break;
            case 'royalmail': drawRoyalMail(e.x, e.y, e.speed > 0); break;
            case 'tractor': drawTractor(e.x, e.y, e.speed > 0); break;
            case 'landrover': drawLandRover(e.x, e.y, e.speed > 0); break;
            case 'cyclist': drawCyclist(e.x, e.y, e.speed > 0); break;
            case 'sheep': drawSheep(e.x, e.y); break;
            case 'combine': drawCombine(e.x, e.y, e.speed > 0); break;
            case 'log': drawLog(e.x, e.y, e.w); break;
            case 'lilypad': drawLilypad(e.x, e.y); break;
        }
    });
}

// --- SPRITE DRAWING ---
function drawPlayer() {
    const p = state.player;
    const x = p.x;
    const y = p.y;
    const flash = p.dead && state.deathTimer % 6 < 3;

    ctx.save();

    if (flash) {
        ctx.globalAlpha = 0.5;
    }

    // Body
    ctx.fillStyle = flash ? '#fff' : '#8B6914';
    ctx.beginPath();
    ctx.ellipse(x + 14, y + 18, 12, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    // Spikes
    ctx.fillStyle = flash ? '#ddd' : '#5a4510';
    const spikeOffset = p.animFrame * 2;
    for (let i = 0; i < 5; i++) {
        const sx = x + 4 + i * 5 + spikeOffset;
        const sy = y + 6;
        ctx.beginPath();
        ctx.moveTo(sx, sy + 10);
        ctx.lineTo(sx + 3, sy);
        ctx.lineTo(sx + 6, sy + 10);
        ctx.fill();
    }

    // Face (direction-aware)
    const faceX = p.facing === 'left' ? x + 4 : (p.facing === 'right' ? x + 18 : x + 10);
    const faceY = p.facing === 'up' ? y + 10 : y + 18;

    // Eyes
    ctx.fillStyle = '#000';
    ctx.fillRect(faceX, faceY, 2, 2);
    ctx.fillRect(faceX + 6, faceY, 2, 2);

    // Nose
    ctx.fillStyle = flash ? '#fcc' : '#ff9999';
    ctx.fillRect(faceX + 3, faceY + 3, 2, 2);

    // Tiny feet
    ctx.fillStyle = flash ? '#ddd' : '#6b4e14';
    ctx.fillRect(x + 6, y + 26, 4, 3);
    ctx.fillRect(x + 18, y + 26, 4, 3);

    ctx.restore();
}

function drawCar(x, y, color, facingRight) {
    // Body
    ctx.fillStyle = color;
    ctx.fillRect(x + 2, y + 6, 32, 18);
    // Roof
    ctx.fillStyle = shadeColor(color, -20);
    ctx.fillRect(x + 8, y + 2, 16, 12);
    // Windows
    ctx.fillStyle = '#aaddff';
    ctx.fillRect(x + 10, y + 4, 5, 8);
    ctx.fillRect(x + 17, y + 4, 5, 8);
    // Wheels
    ctx.fillStyle = '#222';
    ctx.fillRect(x + 4, y + 22, 8, 6);
    ctx.fillRect(x + 24, y + 22, 8, 6);
    // Headlights
    ctx.fillStyle = '#ffff66';
    const hlX = facingRight ? x + 32 : x + 2;
    ctx.fillRect(hlX, y + 10, 3, 4);
    ctx.fillRect(hlX, y + 18, 3, 4);
}

function drawRoyalMail(x, y, facingRight) {
    // Body - Royal Mail red
    ctx.fillStyle = '#cc0000';
    ctx.fillRect(x + 2, y + 4, 40, 22);
    // Yellow stripe
    ctx.fillStyle = '#ffcc00';
    ctx.fillRect(x + 2, y + 14, 40, 3);
    // Cab window
    ctx.fillStyle = '#aaddff';
    const cabX = facingRight ? x + 32 : x + 4;
    ctx.fillRect(cabX, y + 6, 8, 8);
    // Wheels
    ctx.fillStyle = '#222';
    ctx.fillRect(x + 4, y + 24, 8, 5);
    ctx.fillRect(x + 32, y + 24, 8, 5);
    // RM text
    ctx.fillStyle = '#fff';
    ctx.font = '4px "Press Start 2P"';
    ctx.fillText('RM', x + 14, y + 12);
}

function drawTractor(x, y, facingRight) {
    // Body
    ctx.fillStyle = '#2d7a2d';
    ctx.fillRect(x + 4, y + 6, 28, 18);
    // Cab
    ctx.fillStyle = '#aaddff';
    ctx.fillRect(x + 18, y + 2, 12, 12);
    // Big rear wheel
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.arc(x + 10, y + 24, 8, 0, Math.PI * 2);
    ctx.fill();
    // Small front wheel
    ctx.beginPath();
    ctx.arc(x + 32, y + 24, 5, 0, Math.PI * 2);
    ctx.fill();
    // Exhaust
    ctx.fillStyle = '#555';
    ctx.fillRect(x + 2, y + 2, 3, 8);
}

function drawLandRover(x, y, facingRight) {
    // Body - Defender green
    ctx.fillStyle = '#4a6e3a';
    ctx.fillRect(x + 2, y + 6, 40, 18);
    // Roof rack
    ctx.fillStyle = '#333';
    ctx.fillRect(x + 6, y + 2, 28, 4);
    ctx.fillRect(x + 8, y + 2, 2, 4);
    ctx.fillRect(x + 18, y + 2, 2, 4);
    ctx.fillRect(x + 28, y + 2, 2, 4);
    // Windows
    ctx.fillStyle = '#aaddff';
    ctx.fillRect(x + 8, y + 8, 8, 6);
    ctx.fillRect(x + 18, y + 8, 8, 6);
    // Wheels
    ctx.fillStyle = '#222';
    ctx.fillRect(x + 4, y + 22, 8, 6);
    ctx.fillRect(x + 32, y + 22, 8, 6);
    // Headlight
    ctx.fillStyle = '#ffff66';
    ctx.fillRect(facingRight ? x + 40 : x + 2, y + 12, 3, 6);
}

function drawCyclist(x, y, facingRight) {
    // Wheels
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.arc(x + 6, y + 22, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + 22, y + 22, 6, 0, Math.PI * 2);
    ctx.fill();
    // Frame
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 6, y + 22);
    ctx.lineTo(x + 14, y + 12);
    ctx.lineTo(x + 22, y + 22);
    ctx.stroke();
    // Rider body
    ctx.fillStyle = '#cc6600';
    ctx.fillRect(x + 12, y + 4, 4, 10);
    // Helmet
    ctx.fillStyle = '#ff4444';
    ctx.beginPath();
    ctx.arc(x + 14, y + 4, 4, 0, Math.PI * 2);
    ctx.fill();
}

function drawSheep(x, y) {
    // Fluffy body
    ctx.fillStyle = '#eeeedd';
    ctx.beginPath();
    ctx.ellipse(x + 15, y + 16, 13, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    // Fluffy bumps
    ctx.beginPath();
    ctx.arc(x + 6, y + 12, 5, 0, Math.PI * 2);
    ctx.arc(x + 24, y + 12, 5, 0, Math.PI * 2);
    ctx.arc(x + 15, y + 8, 5, 0, Math.PI * 2);
    ctx.fill();
    // Black face
    ctx.fillStyle = '#333';
    ctx.fillRect(x + 2, y + 12, 8, 10);
    // Eyes
    ctx.fillStyle = '#fff';
    ctx.fillRect(x + 3, y + 14, 2, 2);
    ctx.fillRect(x + 7, y + 14, 2, 2);
    // Legs
    ctx.fillStyle = '#333';
    ctx.fillRect(x + 6, y + 24, 3, 6);
    ctx.fillRect(x + 12, y + 24, 3, 6);
    ctx.fillRect(x + 18, y + 24, 3, 6);
    ctx.fillRect(x + 24, y + 24, 3, 6);
}

function drawCombine(x, y, facingRight) {
    // Main body
    ctx.fillStyle = '#cc9900';
    ctx.fillRect(x + 12, y + 4, 40, 22);
    // Header (red rotating part)
    ctx.fillStyle = '#cc2200';
    const headerX = facingRight ? x : x + 48;
    ctx.fillRect(headerX, y + 2, 14, 26);
    // Spinning bars
    ctx.fillStyle = '#991100';
    const rot = (Date.now() / 100) % 4;
    for (let i = 0; i < 4; i++) {
        const barY = y + 4 + ((i * 6 + rot * 2) % 24);
        ctx.fillRect(headerX + 2, barY, 10, 2);
    }
    // Cab
    ctx.fillStyle = '#aaddff';
    ctx.fillRect(x + 36, y + 6, 12, 10);
    // Wheels
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.arc(x + 20, y + 26, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + 44, y + 26, 6, 0, Math.PI * 2);
    ctx.fill();
}

function drawLog(x, y, w) {
    ctx.fillStyle = '#6b4226';
    ctx.fillRect(x, y + 6, w, 20);
    ctx.fillStyle = '#8B5A2B';
    ctx.fillRect(x + 2, y + 8, w - 4, 3);
    ctx.fillRect(x + 2, y + 18, w - 4, 3);
    // End rings
    ctx.fillStyle = '#5a3a1a';
    ctx.beginPath();
    ctx.arc(x + 4, y + 16, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + w - 4, y + 16, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#7a5a3a';
    ctx.beginPath();
    ctx.arc(x + 4, y + 16, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + w - 4, y + 16, 3, 0, Math.PI * 2);
    ctx.fill();
}

function drawLilypad(x, y) {
    ctx.fillStyle = '#338833';
    ctx.beginPath();
    ctx.arc(x + 16, y + 16, 14, 0, Math.PI * 2);
    ctx.fill();
    // Notch
    ctx.fillStyle = '#2266aa';
    ctx.beginPath();
    ctx.moveTo(x + 16, y + 16);
    ctx.lineTo(x + 28, y + 10);
    ctx.lineTo(x + 28, y + 22);
    ctx.fill();
    // Vein
    ctx.strokeStyle = '#226622';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 16, y + 16);
    ctx.lineTo(x + 4, y + 10);
    ctx.moveTo(x + 16, y + 16);
    ctx.lineTo(x + 6, y + 24);
    ctx.moveTo(x + 16, y + 16);
    ctx.lineTo(x + 10, y + 4);
    ctx.stroke();
}

function drawDuck() {
    const x = state.duckX;
    const y = 5 * CONFIG.TILE + 4;
    // Body
    ctx.fillStyle = '#ffcc00';
    ctx.beginPath();
    ctx.ellipse(x + 6, y + 10, 6, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    // Head
    ctx.beginPath();
    ctx.arc(x + 12, y + 5, 4, 0, Math.PI * 2);
    ctx.fill();
    // Beak
    ctx.fillStyle = '#ff8800';
    ctx.fillRect(x + 15, y + 4, 4, 3);
    // Eye
    ctx.fillStyle = '#000';
    ctx.fillRect(x + 13, y + 4, 1, 1);
}

function drawAcorns() {
    state.acorns.forEach(a => {
        // Cap
        ctx.fillStyle = '#8B6914';
        ctx.fillRect(a.x + 2, a.y, 12, 6);
        // Stem
        ctx.fillStyle = '#5a4510';
        ctx.fillRect(a.x + 7, a.y - 3, 2, 4);
        // Nut
        ctx.fillStyle = '#B8860B';
        ctx.beginPath();
        ctx.ellipse(a.x + 8, a.y + 10, 6, 7, 0, 0, Math.PI * 2);
        ctx.fill();
        // Blink when about to expire
        if (a.timer < 60 && a.timer % 10 < 5) {
            ctx.globalAlpha = 0.4;
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.ellipse(a.x + 8, a.y + 8, 8, 8, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        }
    });
}

function drawFence() {
    // Already drawn in background, but add the sign text more prominently
    const lane = LANE_DEFS.find(l => l.type === 'fence');
    if (!lane) return;
    const y = lane.row * CONFIG.TILE;

    // Arrow pointing to gap
    ctx.fillStyle = '#ffd700';
    const arrowX = state.fenceGapX + CONFIG.TILE / 2;
    ctx.beginPath();
    ctx.moveTo(arrowX - 4, y - 2);
    ctx.lineTo(arrowX + 4, y - 2);
    ctx.lineTo(arrowX, y + 3);
    ctx.fill();
}

function drawParticles() {
    state.particles.forEach(pt => {
        ctx.globalAlpha = pt.life / 40;
        ctx.fillStyle = pt.color;
        ctx.fillRect(pt.x, pt.y, pt.size, pt.size);
    });
    ctx.globalAlpha = 1;
}

// --- UI HELPERS ---
function updateLivesDisplay() {
    const el = document.getElementById('hud-lives');
    el.innerHTML = '';
    for (let i = 0; i < state.lives; i++) {
        const icon = document.createElement('div');
        icon.className = 'life-icon';
        el.appendChild(icon);
    }
}

function updateScoreDisplay() {
    document.getElementById('score-val').textContent = state.score;
}

function updateTimerDisplay() {
    const el = document.getElementById('timer-val');
    el.textContent = state.timeRemaining;
    const timerEl = document.getElementById('hud-timer');
    if (state.timeRemaining <= 10) {
        timerEl.classList.add('warning');
    } else {
        timerEl.classList.remove('warning');
    }
}

function showMessage(type, text) {
    hideMessages();
    const screen = type === 'death' ? document.getElementById('death-screen') : document.getElementById('victory-screen');
    const msg = type === 'death' ? document.getElementById('death-message') : document.getElementById('victory-message');
    msg.textContent = text;
    screen.classList.remove('hidden');
}

function hideMessages() {
    document.getElementById('death-screen').classList.add('hidden');
    document.getElementById('victory-screen').classList.add('hidden');
}

function randomFrom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function shadeColor(color, percent) {
    const num = parseInt(color.replace('#', ''), 16);
    const r = Math.min(255, Math.max(0, (num >> 16) + percent));
    const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + percent));
    const b = Math.min(255, Math.max(0, (num & 0x0000FF) + percent));
    return '#' + (0x1000000 + r * 0x10000 + g * 0x100 + b).toString(16).slice(1);
}

// --- GAME LOOP ---
function gameLoop(timestamp) {
    const dt = timestamp - lastTime;
    lastTime = timestamp;

    if (state.screen === 'PLAYING') {
        update(Math.min(dt, 50)); // Cap delta to avoid spiral
    }

    render();
    requestAnimationFrame(gameLoop);
}

// --- START ---
window.addEventListener('load', init);
