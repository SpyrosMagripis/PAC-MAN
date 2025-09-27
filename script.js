/**
 * Enhanced PAC-MAN Game - Canvas-based implementation
 *
 * Added features:
 * - Authentic four-ghost AI with chase/scatter targets
 * - Distinct frightened mode triggered by power pellets
 * - Layered audio system (theme, chase siren, frightened music)
 */

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('game'));
const ctx = canvas.getContext('2d');
const tileSize = 20;

const TILE_TYPES = {
  WALL: '1',
  EMPTY: '0',
  DOT: '2',
  POWER: '3',
  HOUSE: 'H',
  DOOR: 'D'
};

const DIRECTIONS = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 }
];

const GAME_SPEED = 150; // milliseconds between moves
const MODE_SEQUENCE = [
  { mode: 'scatter', duration: 7000 },
  { mode: 'chase', duration: 20000 },
  { mode: 'scatter', duration: 7000 },
  { mode: 'chase', duration: 20000 },
  { mode: 'scatter', duration: 5000 },
  { mode: 'chase', duration: 20000 }
];
const FRIGHTENED_DURATION = 7000;
const GHOST_EAT_SCORES = [200, 400, 800, 1600];
const GHOST_MOVE_INTERVAL = GAME_SPEED;
const GHOST_FRIGHTENED_SPEED_MULTIPLIER = 1.6;
const GHOST_EATEN_SPEED_MULTIPLIER = 0.6;
const READY_DISPLAY_DURATION = 3000;
const WIN_RESET_DELAY_MS = 4500;
const LOSE_RESET_DELAY_MS = 2800;

class PacManAudio {
  constructor() {
    this.tracks = {
      credit: this.createTrack('Sounds/01. Credit Sound.mp3', { loop: false, volume: 0.4 }),
      start: this.createTrack('Sounds/02. Start Music.mp3', { loop: false, volume: 0.4 }),
      dot: this.createTrack('Sounds/03. PAC-MAN - Eating The Pac-dots.mp3', { loop: false, volume: 0.55 }),
      corner: this.createTrack('Sounds/04. PAC-MAN - Turning The Corner While Eating The Pac-dots.mp3', { loop: false, volume: 0.55 }),
      sirenScatter: this.createTrack('Sounds/06. Ghost - Normal Move.mp3', { loop: true, volume: 0.3 }),
      sirenChase: this.createTrack('Sounds/07. Ghost - Spurt Move #1.mp3', { loop: true, volume: 0.3 }),
      sirenFrenzy: this.createTrack('Sounds/08. Ghost - Spurt Move #2.mp3', { loop: true, volume: 0.3 }),
      frightened: this.createTrack('Sounds/12. Ghost - Turn to Blue.mp3', { loop: true, volume: 0.3 }),
      ghostReturn: this.createTrack('Sounds/14. Ghost - Return to Home.mp3', { loop: false, volume: 0.35 }),
      death: this.createTrack('Sounds/15. Fail.mp3', { loop: false, volume: 0.35 }),
      win: this.createTrack('Sounds/16. Coffee Break Music.mp3', { loop: false, volume: 0.4 })
    };
    this.isInitialized = false;
    this.isEnabled = false;
    this.frightenedActive = false;
    this.currentSiren = null;
    this.lastRequestedMode = 'scatter';
    this.currentPhaseIndex = 0;
    this.lastDotChomp = 0;
    this.lastCornerTurn = 0;
    this.startFallbackTimer = null;
    this.handleStartEnded = this.handleStartEnded.bind(this);
    this.effectStopTimers = {};
  }

  createTrack(src, { loop, volume }) {
    const audio = new Audio(src);
    audio.preload = 'auto';
    audio.loop = loop;
    audio.volume = volume;
    const track = {
      audio,
      canPlayPromise: new Promise((resolve) => {
        audio.addEventListener('canplaythrough', () => resolve(true), { once: true });
        audio.addEventListener('error', (event) => {
          console.warn(`Error loading audio track ${src}:`, event);
          resolve(false);
        }, { once: true });
      })
    };
    audio.load();
    return track;
  }

  async init() {
    try {
      const readiness = await Promise.all(
        Object.values(this.tracks).map((track) => track.canPlayPromise)
      );
      this.isInitialized = readiness.includes(true);
      return this.isInitialized;
    } catch (error) {
      console.warn('Audio not supported:', error);
      return false;
    }
  }

  playTrack(key, { restart = false } = {}) {
    if (!this.isEnabled && key !== 'start' && key !== 'credit') return;
    const track = this.tracks[key];
    if (!track || !track.audio) return;
    if (restart) track.audio.currentTime = 0;
    track.audio.play().catch((error) => {
      console.warn(`Could not start ${key} audio playback:`, error);
    });
  }

  playEffect(key, { allowOverlap = false, stopAfterMs = null } = {}) {
    if (!this.isEnabled && key !== 'credit' && key !== 'start') return;
    const track = this.tracks[key];
    if (!track || !track.audio) return;
    if (allowOverlap) {
      const clone = track.audio.cloneNode(true);
      clone.volume = track.audio.volume;
      clone.play().catch((error) => {
        console.warn(`Could not play overlapping ${key} effect:`, error);
      });
      if (stopAfterMs != null) {
        setTimeout(() => {
          clone.pause();
        }, stopAfterMs);
      }
      return;
    }
    if (this.effectStopTimers[key]) {
      clearTimeout(this.effectStopTimers[key]);
      this.effectStopTimers[key] = null;
    }
    track.audio.currentTime = 0;
    track.audio.play().catch((error) => {
      console.warn(`Could not play ${key} effect:`, error);
    });
    if (stopAfterMs != null) {
      this.effectStopTimers[key] = setTimeout(() => {
        track.audio.pause();
        track.audio.currentTime = 0;
        this.effectStopTimers[key] = null;
      }, stopAfterMs);
    }
  }

  stopTrack(key) {
    const track = this.tracks[key];
    if (!track || !track.audio) return;
    track.audio.pause();
    track.audio.currentTime = 0;
    if (this.effectStopTimers[key]) {
      clearTimeout(this.effectStopTimers[key]);
      this.effectStopTimers[key] = null;
    }
  }

  stopAllTracks() {
    Object.keys(this.tracks).forEach((key) => this.stopTrack(key));
    this.currentSiren = null;
    this.frightenedActive = false;
    Object.keys(this.effectStopTimers).forEach((key) => {
      if (this.effectStopTimers[key]) {
        clearTimeout(this.effectStopTimers[key]);
        this.effectStopTimers[key] = null;
      }
    });
    this.effectStopTimers = {};
  }

  start() {
    if (!this.isInitialized || this.isEnabled) return;
    this.isEnabled = true;
    this.lastRequestedMode = 'scatter';
    this.stopAllTracks();
    this.playEffect('credit');
    const startTrack = this.tracks.start?.audio;
    if (startTrack) {
      startTrack.removeEventListener('ended', this.handleStartEnded);
      startTrack.addEventListener('ended', this.handleStartEnded, { once: true });
      this.playTrack('start', { restart: true });
      if (this.startFallbackTimer) clearTimeout(this.startFallbackTimer);
      this.startFallbackTimer = setTimeout(() => {
        if (this.isEnabled && !this.frightenedActive && startTrack.paused) {
          this.handleStartEnded();
        }
      }, 4000);
    } else {
      this.handleStartEnded();
    }
  }

  handleStartEnded() {
    if (!this.isEnabled) return;
    this.setGhostMode(this.lastRequestedMode, { phaseIndex: this.currentPhaseIndex, force: true });
  }

  stop() {
    if (this.startFallbackTimer) {
      clearTimeout(this.startFallbackTimer);
      this.startFallbackTimer = null;
    }
    this.stopAllTracks();
    this.isEnabled = false;
    this.frightenedActive = false;
  }

  toggle() {
    if (this.isEnabled) {
      this.stop();
      return false;
    }

    if (!this.isInitialized) return false;
    this.start();
    return this.isEnabled;
  }

  setGhostMode(mode, { phaseIndex = 0, force = false } = {}) {
    this.lastRequestedMode = mode;
    this.currentPhaseIndex = phaseIndex;
    if (!this.isEnabled || this.frightenedActive) return;

    let targetKey = 'sirenScatter';
    if (mode === 'chase') {
      targetKey = phaseIndex >= 4 ? 'sirenFrenzy' : 'sirenChase';
    }

    if (!force && this.currentSiren === targetKey) return;

    if (this.currentSiren) {
      this.stopTrack(this.currentSiren);
    }

    this.currentSiren = targetKey;
    this.playTrack(targetKey, { restart: true });
  }

  enterFrightened() {
    if (!this.isEnabled) return;
    if (this.currentSiren) {
      this.stopTrack(this.currentSiren);
      this.currentSiren = null;
    }
    this.frightenedActive = true;
    this.stopTrack('dot');
    this.stopTrack('corner');
    this.playTrack('frightened', { restart: true });
  }

  exitFrightened() {
    if (!this.isEnabled || !this.frightenedActive) return;
    this.stopTrack('frightened');
    this.frightenedActive = false;
    this.setGhostMode(this.lastRequestedMode, { phaseIndex: this.currentPhaseIndex, force: true });
  }

  playDotChomp() {
    if (!this.isEnabled) return;
    this.stopTrack('corner');
    this.stopTrack('dot');
    const now = performance.now ? performance.now() : Date.now();
    this.lastDotChomp = now;
    this.playEffect('dot', { stopAfterMs: 180 });
  }

  playCornerTurn() {
    if (!this.isEnabled) return;
    this.stopTrack('dot');
    this.stopTrack('corner');
    const now = performance.now ? performance.now() : Date.now();
    if (now - this.lastCornerTurn < 180) return;
    this.lastCornerTurn = now;
    this.playEffect('corner', { stopAfterMs: 220 });
  }

  playGhostReturn() {
    if (!this.isEnabled) return;
    this.playEffect('ghostReturn');
  }

  playDeath() {
    if (!this.isEnabled) return;
    this.stopAllTracks();
    this.playEffect('death');
  }

  playWin() {
    if (!this.isEnabled) return;
    this.stopAllTracks();
    this.playEffect('win');
  }
}

const pacManAudio = new PacManAudio();

const levelLayout = [
  '1111111111111111111111111111',
  '1000000000000000000000000001',
  '1011111110111111101111111101',
  '1020000010100000101000000201',
  '1011111010111110101111101101',
  '1000000010000000100000000001',
  '111011101111DDD1111011101111',
  '00001000001HHHH1000000100000',
  '11101110111HHHH1111011101111',
  '1000000010000100100000000001',
  '1011111010111110101111101101',
  '1020000010100000101000000201',
  '1011111110111111101111111101',
  '1000000000000000000000000001',
  '1111111111111111111111111111'
];

let level = levelLayout.map((row) => row.split(''));
const rows = level.length;
const cols = level[0].length;

canvas.width = cols * tileSize;
canvas.height = rows * tileSize;
const width = canvas.width;
const height = canvas.height;

function canTeleportOnRow(y) {
  return (
    y >= 0 &&
    y < rows &&
    level[y][0] !== TILE_TYPES.WALL &&
    level[y][cols - 1] !== TILE_TYPES.WALL
  );
}

function floodFillReachable(startX, startY) {
  const reachable = Array(rows)
    .fill(null)
    .map(() => Array(cols).fill(false));
  const stack = [{ x: startX, y: startY }];

  while (stack.length > 0) {
    const { x, y } = stack.pop();

    if (
      y < 0 ||
      y >= rows ||
      x < 0 ||
      x >= cols ||
      reachable[y][x] ||
      level[y][x] === TILE_TYPES.WALL ||
      level[y][x] === TILE_TYPES.HOUSE ||
      level[y][x] === TILE_TYPES.DOOR
    ) {
      continue;
    }

    reachable[y][x] = true;

    DIRECTIONS.forEach((dir) => {
      let nx = x + dir.x;
      let ny = y + dir.y;
      if (dir.x !== 0) {
        if (nx < 0 && canTeleportOnRow(y)) {
          nx = cols - 1;
        } else if (nx >= cols && canTeleportOnRow(y)) {
          nx = 0;
        }
      }
      stack.push({ x: nx, y: ny });
    });
  }

  return reachable;
}

const reachableAreas = floodFillReachable(1, 1);
for (let y = 0; y < rows; y++) {
  for (let x = 0; x < cols; x++) {
    if (
      level[y][x] === TILE_TYPES.WALL ||
      level[y][x] === TILE_TYPES.HOUSE ||
      level[y][x] === TILE_TYPES.DOOR
    ) {
      continue;
    }
    level[y][x] = reachableAreas[y][x] ? TILE_TYPES.DOT : TILE_TYPES.EMPTY;
  }
}

const powerPelletPositions = [
  { x: 1, y: 3 },
  { x: cols - 2, y: 3 },
  { x: 1, y: rows - 4 },
  { x: cols - 2, y: rows - 4 }
];

powerPelletPositions.forEach(({ x, y }) => {
  if (level[y] && level[y][x] && level[y][x] !== TILE_TYPES.WALL) {
    level[y][x] = TILE_TYPES.POWER;
  }
});

const pacman = {
  x: 1,
  y: 1,
  dir: { x: 0, y: 0 },
  pendingDir: { x: 0, y: 0 },
  prevDir: { x: 0, y: 0 },
  turnJustMade: false,
  type: 'pacman'
};

const ghostConfigs = [
  {
    name: 'Blinky',
    color: '#FF0000',
    start: { x: 13, y: 5 },
    home: { x: 13, y: 7 },
    scatterTarget: { x: cols - 2, y: 1 },
    chaseTarget: () => ({ x: pacman.x, y: pacman.y }),
    initialState: 'normal',
    initialTimer: 0,
    startsInHouse: false
  },
  {
    name: 'Pinky',
    color: '#FFB8FF',
    start: { x: 12, y: 7 },
    home: { x: 12, y: 7 },
    scatterTarget: { x: 1, y: 1 },
    chaseTarget: () => getAheadTarget(4, true),
    initialState: 'pen',
    initialTimer: 500,
    startsInHouse: true
  },
  {
    name: 'Inky',
    color: '#00FFFF',
    start: { x: 14, y: 8 },
    home: { x: 14, y: 8 },
    scatterTarget: { x: cols - 2, y: rows - 2 },
    chaseTarget: (_ghost, allGhosts) => {
      const blinky = allGhosts.find((ghost) => ghost.name === 'Blinky');
      const ahead = getAheadTarget(2, false);
      if (!blinky) return ahead;
      const vectorX = ahead.x - blinky.x;
      const vectorY = ahead.y - blinky.y;
      return clampTarget({ x: ahead.x + vectorX, y: ahead.y + vectorY });
    },
    initialState: 'pen',
    initialTimer: 1500,
    startsInHouse: true
  },
  {
    name: 'Clyde',
    color: '#FFA500',
    start: { x: 11, y: 8 },
    home: { x: 11, y: 8 },
    scatterTarget: { x: 1, y: rows - 2 },
    chaseTarget: (ghost) => {
      const distance = distanceSquared(pacman, ghost);
      if (distance > 64) {
        return { x: pacman.x, y: pacman.y };
      }
      return ghost.scatterTarget;
    },
    initialState: 'pen',
    initialTimer: 2500,
    startsInHouse: true
  }
];

const ghosts = ghostConfigs.map((config) => {
  const ghost = {
    name: config.name,
    color: config.color,
    x: config.start.x,
    y: config.start.y,
    type: 'ghost',
    start: { ...config.start },
    home: { ...config.home },
    scatterTarget: { ...config.scatterTarget },
    getChaseTarget: () => config.chaseTarget,
    dir: { x: 0, y: 0 },
    mode: config.initialState === 'pen' ? 'pen' : 'scatter',
    state: config.initialState || 'normal',
    respawnTimer: config.initialTimer || 0,
    isInHouse:
      config.startsInHouse ?? (level[config.start.y][config.start.x] === TILE_TYPES.HOUSE),
    moveAccumulator: 0,
  };

  if (ghost.state === 'pen' && ghost.respawnTimer <= 0) {
    ghost.respawnTimer = 1000;
  }

  if (ghost.state === 'normal' && (level[ghost.y][ghost.x] === TILE_TYPES.HOUSE || level[ghost.y][ghost.x] === TILE_TYPES.DOOR)) {
    ghost.isInHouse = true;
  }

  return ghost;
});

ghosts.forEach((ghost, index) => {
  const config = ghostConfigs[index];
  ghost.getChaseTarget = () => config.chaseTarget(ghost, ghosts);
});

level[pacman.y][pacman.x] = TILE_TYPES.EMPTY;
ghosts.forEach((ghost) => {
  const tile = level[ghost.y][ghost.x];
  if (tile === TILE_TYPES.DOT || tile === TILE_TYPES.POWER) {
    level[ghost.y][ghost.x] = TILE_TYPES.EMPTY;
  }
});

let score = 0;
let lastTime = 0;
let ghostModeIndex = 0;
let ghostModeTimer = 0;
let globalGhostMode = MODE_SEQUENCE[0].mode;
let frightenedActive = false;
let frightenedTimer = 0;
let frightenedChain = 0;
let collectiblesRemaining = countCollectibles();
let gameEnded = false;
let resetTimerId = null;
let readyTimer = READY_DISPLAY_DURATION;

applyGlobalMode(globalGhostMode, { reverse: false });

function scheduleGameReset(message, delay) {
  if (resetTimerId) clearTimeout(resetTimerId);
  resetTimerId = setTimeout(() => {
    alert(message);
    resetTimerId = null;
    document.location.reload();
  }, delay);
}

function endGame(type, message) {
  if (gameEnded) return;
  gameEnded = true;
  frightenedActive = false;
  frightenedTimer = 0;
  frightenedChain = 0;
  ghostModeTimer = 0;
  readyTimer = 0;
  pacman.dir = { x: 0, y: 0 };
  pacman.pendingDir = { x: 0, y: 0 };
  pacman.prevDir = { x: 0, y: 0 };
  pacman.turnJustMade = false;
  ghosts.forEach((ghost) => {
    ghost.dir = { x: 0, y: 0 };
    ghost.moveAccumulator = 0;
  });
  const delay = type === 'win' ? WIN_RESET_DELAY_MS : LOSE_RESET_DELAY_MS;
  scheduleGameReset(message, delay);
}

function countCollectibles() {
  let count = 0;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (level[y][x] === TILE_TYPES.DOT || level[y][x] === TILE_TYPES.POWER) {
        count++;
      }
    }
  }
  return count;
}

function getAheadTarget(distance, applyUpBug) {
  const dir = (pacman.dir.x !== 0 || pacman.dir.y !== 0) ? pacman.dir : { x: 0, y: -1 };
  let targetX = pacman.x + dir.x * distance;
  let targetY = pacman.y + dir.y * distance;
  if (applyUpBug && dir.y === -1) {
    // Mimic original overflow bug pushing target further up and left
    targetX -= 2;
    targetY -= 2;
  }
  return clampTarget({ x: targetX, y: targetY });
}

function clampTarget(target) {
  return {
    x: Math.max(0, Math.min(cols - 1, target.x)),
    y: Math.max(0, Math.min(rows - 1, target.y))
  };
}

function distanceSquared(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function getWrappedPosition(x, y, dir) {
  let nx = x + dir.x;
  let ny = y + dir.y;
  if (dir.x !== 0) {
    if (nx < 0 && canTeleportOnRow(y)) {
      nx = cols - 1;
    } else if (nx >= cols && canTeleportOnRow(y)) {
      nx = 0;
    }
  }
  return { x: nx, y: ny };
}

function isTileBlocked(entity, tile) {
  if (tile === TILE_TYPES.WALL) return true;
  if (!entity) return false;

  if (entity.type === 'pacman') {
    return tile === TILE_TYPES.HOUSE || tile === TILE_TYPES.DOOR;
  }

  if (entity.type === 'ghost') {
    if (tile === TILE_TYPES.HOUSE || tile === TILE_TYPES.DOOR) {
      if (entity.state === 'eaten' || entity.isInHouse) {
        return false;
      }
      return true;
    }
  }

  return false;
}

function canMoveTo(entity, dir) {
  const next = getWrappedPosition(entity.x, entity.y, dir);
  if (next.y < 0 || next.y >= rows || next.x < 0 || next.x >= cols) return false;
  const tile = level[next.y][next.x];
  return !isTileBlocked(entity, tile);
}

function moveEntity(entity, { stopOnBlock = false } = {}) {
  if (!entity.dir) return false;
  const next = getWrappedPosition(entity.x, entity.y, entity.dir);
  if (next.y < 0 || next.y >= rows || next.x < 0 || next.x >= cols) {
    if (stopOnBlock) entity.dir = { x: 0, y: 0 };
    return false;
  }

  const tile = level[next.y][next.x];
  if (isTileBlocked(entity, tile)) {
    if (stopOnBlock) entity.dir = { x: 0, y: 0 };
    return false;
  }

  entity.x = next.x;
  entity.y = next.y;

  if (entity.type === 'ghost') {
    if (tile === TILE_TYPES.HOUSE || tile === TILE_TYPES.DOOR) {
      entity.isInHouse = true;
    } else if (entity.isInHouse) {
      entity.isInHouse = false;
    }
  }

  return true;
}

function getValidDirections(entity) {
  return DIRECTIONS.filter((dir) => canMoveTo(entity, dir));
}

function getGhostSpeedMultiplier(ghost) {
  if (ghost.state === 'frightened') return GHOST_FRIGHTENED_SPEED_MULTIPLIER;
  if (ghost.state === 'eaten') return GHOST_EATEN_SPEED_MULTIPLIER;
  return 1;
}

function shouldGhostMove(ghost, delta) {
  const required = GHOST_MOVE_INTERVAL * getGhostSpeedMultiplier(ghost);
  ghost.moveAccumulator = (ghost.moveAccumulator || 0) + delta;
  if (ghost.moveAccumulator < required) {
    return false;
  }
  ghost.moveAccumulator -= required;
  return true;
}

function computeDirectionTowards(entity, target) {
  if (entity.x === target.x && entity.y === target.y) return null;
  const visited = Array(rows)
    .fill(null)
    .map(() => Array(cols).fill(false));
  const queue = [{ x: entity.x, y: entity.y, firstDir: null }];
  visited[entity.y][entity.x] = true;

  while (queue.length) {
    const node = queue.shift();
    for (const dir of DIRECTIONS) {
      const next = getWrappedPosition(node.x, node.y, dir);
      if (
        next.y < 0 ||
        next.y >= rows ||
        next.x < 0 ||
        next.x >= cols ||
        visited[next.y][next.x]
      ) {
        continue;
      }
      const tile = level[next.y][next.x];
      if (isTileBlocked(entity, tile)) continue;
      visited[next.y][next.x] = true;
      const firstDir = node.firstDir || dir;
      if (next.x === target.x && next.y === target.y) {
        return firstDir;
      }
      queue.push({ x: next.x, y: next.y, firstDir });
    }
  }
  return null;
}

function chooseFrightenedDirection(ghost) {
  const options = getValidDirections(ghost);
  if (options.length === 0) return ghost.dir;
  let best = options[0];
  let bestScore = -Infinity;
  options.forEach((dir) => {
    const next = getWrappedPosition(ghost.x, ghost.y, dir);
    const score = distanceSquared(next, pacman);
    if (score > bestScore) {
      best = dir;
      bestScore = score;
    }
  });
  return best;
}

function updateGhost(ghost, delta) {
  if (ghost.state === 'pen') {
    if (ghost.respawnTimer > 0) {
      ghost.respawnTimer -= delta;
      if (ghost.respawnTimer > 0) {
        return;
      }
    }
    ghost.state = 'normal';
    ghost.mode = globalGhostMode;
    ghost.dir = { x: 0, y: -1 };
    ghost.isInHouse = true;
    ghost.respawnTimer = 0;
    ghost.moveAccumulator = 0;
  }

  if (ghost.state === 'eaten') {
    if (!shouldGhostMove(ghost, delta)) return;
    const dir = computeDirectionTowards(ghost, ghost.home);
    if (dir) ghost.dir = dir;
    moveEntity(ghost);
    if (ghost.x === ghost.home.x && ghost.y === ghost.home.y) {
      ghost.state = 'pen';
      ghost.respawnTimer = 1200;
      ghost.dir = { x: 0, y: 0 };
      ghost.isInHouse = true;
      ghost.mode = 'pen';
      ghost.moveAccumulator = 0;
    }
    return;
  }

  if (ghost.isInHouse && ghost.state !== 'eaten') {
    if (!shouldGhostMove(ghost, delta)) return;
    ghost.dir = { x: 0, y: -1 };
    const moved = moveEntity(ghost);
    if (!moved) {
      ghost.isInHouse = false;
      return;
    }
    const newTile = level[ghost.y][ghost.x];
    if (newTile !== TILE_TYPES.HOUSE && newTile !== TILE_TYPES.DOOR) {
      ghost.isInHouse = false;
    }
    return;
  }

  if (ghost.state === 'frightened') {
    if (!shouldGhostMove(ghost, delta)) return;
    const dir = chooseFrightenedDirection(ghost);
    if (dir) ghost.dir = dir;
    moveEntity(ghost);
    return;
  }

  if (!shouldGhostMove(ghost, delta)) return;
  ghost.mode = globalGhostMode;
  const target = ghost.mode === 'scatter'
    ? ghost.scatterTarget
    : ghost.getChaseTarget();
  const clampedTarget = clampTarget(target);
  const dir = computeDirectionTowards(ghost, clampedTarget);
  if (dir) {
    ghost.dir = dir;
  }
  if (!moveEntity(ghost)) {
    const fallback = getValidDirections(ghost);
    if (fallback.length) {
      ghost.dir = fallback[Math.floor(Math.random() * fallback.length)];
      moveEntity(ghost);
    }
  }
}

function applyGlobalMode(mode, { reverse = true } = {}) {
  globalGhostMode = mode;
  ghosts.forEach((ghost) => {
    if (ghost.state !== 'normal') return;
    ghost.mode = mode;
    if (reverse) {
      ghost.dir = { x: -ghost.dir.x, y: -ghost.dir.y };
    }
  });
  if (!frightenedActive) {
    pacManAudio.setGhostMode(mode, { phaseIndex: ghostModeIndex });
  }
}

function advanceGhostMode() {
  const phase = MODE_SEQUENCE[Math.min(ghostModeIndex, MODE_SEQUENCE.length - 1)];
  applyGlobalMode(phase.mode);
}

function enterFrightenedMode() {
  frightenedActive = true;
  frightenedTimer = FRIGHTENED_DURATION;
  frightenedChain = 0;
  pacManAudio.enterFrightened();
  ghosts.forEach((ghost) => {
    if (ghost.state !== 'normal') return;
    if (ghost.isInHouse) return;
    ghost.state = 'frightened';
    ghost.mode = 'frightened';
    ghost.dir = { x: -ghost.dir.x, y: -ghost.dir.y };
    ghost.moveAccumulator = 0;
  });
}

function exitFrightenedMode() {
  frightenedActive = false;
  pacManAudio.exitFrightened();
  ghosts.forEach((ghost) => {
    if (ghost.state === 'frightened') {
      ghost.state = 'normal';
      ghost.mode = globalGhostMode;
      ghost.moveAccumulator = 0;
    }
  });
  pacManAudio.setGhostMode(globalGhostMode, { phaseIndex: ghostModeIndex, force: true });
}

function handlePacManCollection() {
  const cell = level[pacman.y][pacman.x];
  if (cell === TILE_TYPES.DOT || cell === TILE_TYPES.POWER) {
    level[pacman.y][pacman.x] = TILE_TYPES.EMPTY;
    collectiblesRemaining = Math.max(0, collectiblesRemaining - 1);
    score += cell === TILE_TYPES.DOT ? 10 : 50;
    if (pacman.turnJustMade) {
      pacManAudio.playCornerTurn();
    } else {
      pacManAudio.playDotChomp();
    }
    if (cell === TILE_TYPES.POWER) {
      enterFrightenedMode();
    }
    if (collectiblesRemaining === 0 && !gameEnded) {
      pacManAudio.playWin();
      endGame('win', 'You Win! Final Score: ' + score);
    }
  }
  pacman.turnJustMade = false;
}

function handleGhostCollisions() {
  if (gameEnded) return;
  for (const ghost of ghosts) {
    if (ghost.x !== pacman.x || ghost.y !== pacman.y) continue;

    if (ghost.state === 'frightened') {
      frightenedChain = Math.min(frightenedChain + 1, GHOST_EAT_SCORES.length);
      score += GHOST_EAT_SCORES[frightenedChain - 1];
      ghost.state = 'eaten';
      ghost.dir = { x: 0, y: 0 };
      ghost.mode = 'eaten';
      ghost.isInHouse = false;
      ghost.moveAccumulator = 0;
      pacManAudio.playGhostReturn();
    } else if (ghost.state !== 'eaten') {
      pacManAudio.playDeath();
      endGame('lose', 'Game Over! Score: ' + score);
      break;
    }
  }
}

function draw() {
  ctx.clearRect(0, 0, width, height);

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const cell = level[y][x];
      if (cell === TILE_TYPES.WALL) {
        ctx.fillStyle = '#0031ff';
        ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
        continue;
      }
      if (cell === TILE_TYPES.HOUSE) {
        ctx.fillStyle = '#1a103a';
        ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
        continue;
      }
      if (cell === TILE_TYPES.DOOR) {
        ctx.fillStyle = 'black';
        ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
        ctx.fillStyle = '#a8a4ff';
        ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize / 4);
        ctx.fillRect(x * tileSize, y * tileSize + tileSize / 4, tileSize, tileSize / 2);
        continue;
      }

      ctx.fillStyle = 'black';
      ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);

      if (cell === TILE_TYPES.DOT) {
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.arc(
          x * tileSize + tileSize / 2,
          y * tileSize + tileSize / 2,
          3,
          0,
          Math.PI * 2
        );
        ctx.fill();
      } else if (cell === TILE_TYPES.POWER) {
        ctx.fillStyle = '#ffb000';
        ctx.beginPath();
        ctx.arc(
          x * tileSize + tileSize / 2,
          y * tileSize + tileSize / 2,
          6,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }
    }
  }

  // Draw Pac-Man
  ctx.fillStyle = 'yellow';
  ctx.beginPath();
  ctx.arc(
    pacman.x * tileSize + tileSize / 2,
    pacman.y * tileSize + tileSize / 2,
    tileSize / 2 - 2,
    0.25 * Math.PI,
    1.75 * Math.PI
  );
  ctx.lineTo(
    pacman.x * tileSize + tileSize / 2,
    pacman.y * tileSize + tileSize / 2
  );
  ctx.fill();

  ghosts.forEach((ghost) => drawGhost(ghost));

  ctx.fillStyle = 'white';
  ctx.font = '20px Arial';
  ctx.fillText('Score: ' + score, 10, 25);

  if (readyTimer > 0 && !gameEnded) {
    ctx.save();
    ctx.fillStyle = '#ffff00';
    ctx.font = '24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('READY!', width / 2, (rows / 2 + 1) * tileSize);
    ctx.restore();
  }
}

function drawGhost(ghost) {
  const centerX = ghost.x * tileSize + tileSize / 2;
  const centerY = ghost.y * tileSize + tileSize / 2;
  const radius = tileSize / 2 - 2;

  if (ghost.state === 'eaten') {
    ctx.fillStyle = 'white';
    const eyeOffsetX = 4;
    const eyeOffsetY = 3;
    [ -1, 1 ].forEach((multiplier) => {
      ctx.beginPath();
      ctx.arc(
        centerX + eyeOffsetX * multiplier,
        centerY - eyeOffsetY,
        3,
        0,
        Math.PI * 2
      );
      ctx.fill();
      ctx.fillStyle = 'black';
      ctx.beginPath();
      ctx.arc(
        centerX + eyeOffsetX * multiplier,
        centerY - eyeOffsetY,
        1.5,
        0,
        Math.PI * 2
      );
      ctx.fill();
      ctx.fillStyle = 'white';
    });
    return;
  }

  const bodyColor = ghost.state === 'frightened' ? '#1e90ff' : ghost.color;
  ctx.fillStyle = bodyColor;
  ctx.beginPath();
  ctx.arc(centerX, centerY - 2, radius - 2, Math.PI, 0, false);
  ctx.lineTo(centerX + radius - 2, centerY + radius - 4);
  const waveWidth = ((radius - 2) * 2) / 3;
  ctx.lineTo(centerX + waveWidth / 2, centerY + radius - 6);
  ctx.lineTo(centerX, centerY + radius - 2);
  ctx.lineTo(centerX - waveWidth / 2, centerY + radius - 6);
  ctx.lineTo(centerX - radius + 2, centerY + radius - 4);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = 'white';
  const eyeRadius = 3;
  const eyeOffsetX = 4;
  const eyeOffsetY = 3;
  ctx.beginPath();
  ctx.arc(centerX - eyeOffsetX, centerY - eyeOffsetY, eyeRadius, 0, Math.PI * 2);
  ctx.arc(centerX + eyeOffsetX, centerY - eyeOffsetY, eyeRadius, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'black';
  const pupilRadius = 1.5;
  ctx.beginPath();
  ctx.arc(centerX - eyeOffsetX, centerY - eyeOffsetY, pupilRadius, 0, Math.PI * 2);
  ctx.arc(centerX + eyeOffsetX, centerY - eyeOffsetY, pupilRadius, 0, Math.PI * 2);
  ctx.fill();
}

function update(currentTime) {
  if (gameEnded) {
    draw();
    return;
  }
  if (currentTime - lastTime >= GAME_SPEED) {
    const delta = currentTime - lastTime;

    if (readyTimer > 0) {
      readyTimer = Math.max(0, readyTimer - delta);
      lastTime = currentTime;
      if (readyTimer > 0) {
        draw();
        requestAnimationFrame(update);
        return;
      }
    }

    if (!frightenedActive) {
      ghostModeTimer += delta;
      const currentPhase = MODE_SEQUENCE[Math.min(ghostModeIndex, MODE_SEQUENCE.length - 1)];
      if (ghostModeTimer >= currentPhase.duration) {
        ghostModeTimer = 0;
        ghostModeIndex = Math.min(ghostModeIndex + 1, MODE_SEQUENCE.length - 1);
        advanceGhostMode();
      }
    } else {
      frightenedTimer -= delta;
      if (frightenedTimer <= 0) {
        exitFrightenedMode();
      }
    }

    if (
      (pacman.pendingDir.x !== pacman.dir.x || pacman.pendingDir.y !== pacman.dir.y) &&
      canMoveTo(pacman, pacman.pendingDir)
    ) {
      pacman.dir = { ...pacman.pendingDir };
    }

    const prevDirBeforeMove = { ...pacman.prevDir };
    const dirBeforeMove = { ...pacman.dir };
    const turnAttempted =
      dirBeforeMove.x !== prevDirBeforeMove.x || dirBeforeMove.y !== prevDirBeforeMove.y;
    const moved = moveEntity(pacman, { stopOnBlock: true });
    if (moved && (dirBeforeMove.x !== 0 || dirBeforeMove.y !== 0)) {
      pacman.turnJustMade = turnAttempted && (prevDirBeforeMove.x !== 0 || prevDirBeforeMove.y !== 0);
      pacman.prevDir = { ...dirBeforeMove };
    } else if (!moved) {
      pacman.turnJustMade = false;
    }

    handlePacManCollection();
    if (gameEnded) {
      lastTime = currentTime;
      draw();
      return;
    }

    ghosts.forEach((ghost) => updateGhost(ghost, delta));
    handleGhostCollisions();
    if (gameEnded) {
      lastTime = currentTime;
      draw();
      return;
    }

    if (!frightenedActive) {
      pacManAudio.setGhostMode(globalGhostMode, { phaseIndex: ghostModeIndex });
    }

    lastTime = currentTime;
  }

  draw();
  requestAnimationFrame(update);
}

document.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowLeft') pacman.pendingDir = { x: -1, y: 0 };
  else if (event.key === 'ArrowRight') pacman.pendingDir = { x: 1, y: 0 };
  else if (event.key === 'ArrowUp') pacman.pendingDir = { x: 0, y: -1 };
  else if (event.key === 'ArrowDown') pacman.pendingDir = { x: 0, y: 1 };
});

async function initializeAudio() {
  const musicButton = /** @type {HTMLButtonElement} */ (
    document.getElementById('musicToggle')
  );
  let audioInitialized = false;
  let isFirstClick = true;

  musicButton.textContent = '🔇 Music: OFF';
  musicButton.classList.add('music-off');

  musicButton.addEventListener('click', async () => {
    if (!audioInitialized) {
      audioInitialized = await pacManAudio.init();
      if (!audioInitialized) {
        musicButton.textContent = '🔇 Audio Not Available';
        musicButton.setAttribute('disabled', 'true');
        return;
      }
    }

    if (isFirstClick) {
      pacManAudio.start();
      musicButton.textContent = '🎵 Music: ON';
      musicButton.classList.remove('music-off');
      isFirstClick = false;
    } else {
      const enabled = pacManAudio.toggle();
      if (enabled) {
        musicButton.textContent = '🎵 Music: ON';
        musicButton.classList.remove('music-off');
      } else {
        musicButton.textContent = '🔇 Music: OFF';
        musicButton.classList.add('music-off');
      }
    }
  });
}

draw();
initializeAudio();
requestAnimationFrame(update);
