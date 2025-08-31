/**
 * PAC-MAN Game - Canvas-based implementation
 * 
 * Game Architecture:
 * - Grid-based movement system using 2D array representation
 * - Fixed timestep game loop with requestAnimationFrame
 * - Entity-based design for PAC-MAN and ghost characters
 * - Simple collision detection using array bounds checking
 * - Background music system with Web Audio API
 */

// Canvas setup and rendering context
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const tileSize = 20; // Size of each grid tile in pixels

/**
 * Audio System - PAC-MAN Theme Music
 * Uses HTML Audio element to play the authentic PAC-MAN theme music
 */
class PacManAudio {
  constructor() {
    this.audio = null;
    this.isPlaying = false;
    this.isInitialized = false;
  }

  async init() {
    try {
      // Create audio element with the actual PAC-MAN theme music
      this.audio = new Audio('playing-pac-man-6783.mp3');
      this.audio.loop = true; // Enable continuous looping
      this.audio.volume = 0.3; // Set moderate volume
      
      // Handle audio loading
      return new Promise((resolve) => {
        this.audio.addEventListener('canplaythrough', () => {
          this.isInitialized = true;
          resolve(true);
        });
        
        this.audio.addEventListener('error', (e) => {
          console.warn('Error loading PAC-MAN theme music:', e);
          resolve(false);
        });
        
        // Start loading the audio
        this.audio.load();
      });
    } catch (error) {
      console.warn('Audio not supported:', error);
      return false;
    }
  }

  async start() {
    if (!this.audio || !this.isInitialized) return;
    
    try {
      await this.audio.play();
      this.isPlaying = true;
    } catch (error) {
      console.warn('Could not start audio playback:', error);
      // Browser might require user interaction first
      this.isPlaying = false;
    }
  }

  stop() {
    if (!this.audio) return;
    
    this.audio.pause();
    this.audio.currentTime = 0; // Reset to beginning
    this.isPlaying = false;
  }

  async toggle() {
    if (this.isPlaying) {
      this.stop();
    } else {
      await this.start();
    }
    return this.isPlaying;
  }
}

// Initialize audio system
const pacManAudio = new PacManAudio();

// 0 - empty, 1 - wall (dots will be added dynamically)
const levelLayout = [
  "1111111111111111111111111111",
  "1000000000000000000000000001",
  "1011111110111111101111111101",
  "1020000010100000101000000201",
  "1011111010111110101111101101",
  "1000000010000100100000000001",
  "1110111011110101111011101111",
  "0000100000000000000000100000",
  "1110111011111111111011101111",
  "1000000010000100100000000001",
  "1011111010111110101111101101",
  "1020000010100000101000000201",
  "1011111110111111101111111101",
  "1000000000000000000000000001",
  "1111111111111111111111111111"
];

/**
 * Game World Initialization
 * Converts string-based level layout to mutable 2D array for runtime manipulation
 */
// Convert level layout to a mutable 2D array
let level = levelLayout.map(row => row.split(''));
const rows = level.length;
const cols = level[0].length;

// Set canvas dimensions based on level size
canvas.width = cols * tileSize;
canvas.height = rows * tileSize;
const width = canvas.width;
const height = canvas.height;

// Function to check if teleportation is possible on a row
function canTeleportOnRow(y) {
  return y >= 0 && y < rows && level[y][0] !== '1' && level[y][cols - 1] !== '1';
}

// Flood fill algorithm to find all reachable positions
function floodFillReachable(startX, startY) {
  const reachable = Array(rows).fill().map(() => Array(cols).fill(false));
  const stack = [{x: startX, y: startY}];
  
  while (stack.length > 0) {
    const {x, y} = stack.pop();
    
    // Skip if out of bounds, already visited, or a wall
    if (y < 0 || y >= rows || x < 0 || x >= cols || reachable[y][x] || level[y][x] === '1') {
      continue;
    }
    
    reachable[y][x] = true;
    
    // Add adjacent cells
    stack.push({x: x + 1, y: y});
    stack.push({x: x - 1, y: y});
    stack.push({x: x, y: y + 1});
    stack.push({x: x, y: y - 1});
    
    // Handle teleportation - if we can teleport on this row
    if (canTeleportOnRow(y)) {
      if (x === 0) {
        stack.push({x: cols - 1, y: y}); // Can reach right edge from left edge
      }
      if (x === cols - 1) {
        stack.push({x: 0, y: y}); // Can reach left edge from right edge
      }
    }
  }
  
  return reachable;
}

// Fill only reachable empty spaces with dots
const reachableAreas = floodFillReachable(1, 1); // Start from Pac-Man's position
for (let y = 0; y < rows; y++) {
  for (let x = 0; x < cols; x++) {
    if (level[y][x] !== '1' && reachableAreas[y][x]) {
      level[y][x] = '2'; // Place dot only in reachable areas
    } else if (level[y][x] !== '1') {
      level[y][x] = '0'; // Make unreachable areas empty
    }
  }
}

/**
 * Game Entity Definitions
 * Uses object-based entities with position and direction vectors
 * Direction vectors: {x: 1, y: 0} = right, {x: -1, y: 0} = left, etc.
 */
let pacman = { 
  x: 1, 
  y: 1, 
  dir: { x: 0, y: 0 } // Initially stationary
};

let ghost = { 
  x: cols - 2, 
  y: rows - 2, 
  dir: { x: 0, y: -1 } // Initially moving up
};

// Game state variables
let score = 0;
let lastTime = 0;
const GAME_SPEED = 150; // milliseconds between moves (controls game difficulty)

/**
 * Clear Starting Positions
 * Remove dots from entity starting positions to prevent immediate collection
 */
level[pacman.y][pacman.x] = '0';
level[ghost.y][ghost.x] = '0';

/**
 * Main Rendering Function
 * Draws all game elements in proper order: level → entities → UI
 * Uses double buffering via clearRect for smooth animation
 */
function draw() {
  // Clear entire canvas for fresh frame
  ctx.clearRect(0, 0, width, height);

  /**
   * Level Rendering Pass
   * Iterates through 2D level array and draws walls, empty spaces, and dots
   */
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const cell = level[y][x];
      
      // Draw walls with blue color
      if (cell === '1') {
        ctx.fillStyle = '#0031ff';
        ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
      } 
      // Draw empty spaces and dots with black background
      else if (cell === '0' || cell === '2') {
        ctx.fillStyle = 'black';
        ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
        
        // Draw collectible dots as small white circles
        if (cell === '2') {
          ctx.fillStyle = 'white';
          ctx.beginPath();
          ctx.arc(
            x * tileSize + tileSize / 2, 
            y * tileSize + tileSize / 2, 
            3, 0, Math.PI * 2
          );
          ctx.fill();
        }
      }
    }
  }

  /**
   * Entity Rendering Pass
   * Draws PAC-MAN and ghost characters on top of level geometry
   */
  // Draw PAC-MAN as yellow pac-man shape with mouth opening
  ctx.fillStyle = 'yellow';
  ctx.beginPath();
  ctx.arc(
    pacman.x * tileSize + tileSize / 2, 
    pacman.y * tileSize + tileSize / 2, 
    tileSize / 2 - 2, 
    0.25 * Math.PI, 1.75 * Math.PI // Creates pac-man mouth opening
  );
  ctx.lineTo(pacman.x * tileSize + tileSize / 2, pacman.y * tileSize + tileSize / 2);
  ctx.fill();

function drawGhost(x, y) {
  const centerX = x * tileSize + tileSize / 2;
  const centerY = y * tileSize + tileSize / 2;
  const radius = tileSize / 2 - 2;
  
  ctx.fillStyle = 'red';
  
  // Draw ghost body (rounded top, wavy bottom)
  ctx.beginPath();
  
  // Top half circle
  ctx.arc(centerX, centerY - 2, radius - 2, Math.PI, 0, false);
  
  // Side walls
  ctx.lineTo(centerX + radius - 2, centerY + radius - 4);
  
  // Wavy bottom
  const waveWidth = (radius - 2) * 2 / 3;
  ctx.lineTo(centerX + waveWidth / 2, centerY + radius - 6);
  ctx.lineTo(centerX, centerY + radius - 2);
  ctx.lineTo(centerX - waveWidth / 2, centerY + radius - 6);
  ctx.lineTo(centerX - radius + 2, centerY + radius - 4);
  
  ctx.closePath();
  ctx.fill();
  
  // Draw eyes
  ctx.fillStyle = 'white';
  const eyeRadius = 2;
  const eyeOffsetX = 4;
  const eyeOffsetY = 3;
  
  // Left eye
  ctx.beginPath();
  ctx.arc(centerX - eyeOffsetX, centerY - eyeOffsetY, eyeRadius, 0, Math.PI * 2);
  ctx.fill();
  
  // Right eye
  ctx.beginPath();
  ctx.arc(centerX + eyeOffsetX, centerY - eyeOffsetY, eyeRadius, 0, Math.PI * 2);
  ctx.fill();
  
  // Eye pupils
  ctx.fillStyle = 'black';
  const pupilRadius = 1;
  
  // Left pupil
  ctx.beginPath();
  ctx.arc(centerX - eyeOffsetX, centerY - eyeOffsetY, pupilRadius, 0, Math.PI * 2);
  ctx.fill();
  
  // Right pupil
  ctx.beginPath();
  ctx.arc(centerX + eyeOffsetX, centerY - eyeOffsetY, pupilRadius, 0, Math.PI * 2);
  ctx.fill();
}

  // Draw ghost
  drawGhost(ghost.x, ghost.y);
  
  /**
   * UI Rendering Pass
   * Draws score and other interface elements on top of game world
   */
  ctx.fillStyle = 'white';
  ctx.font = '20px Arial';
  ctx.fillText('Score: ' + score, 10, 25);
}

/**
 * Universal Entity Movement Function
 * Handles movement for any entity (PAC-MAN, ghost, future entities)
 * Performs collision detection and boundary checking
 * 
 * @param {Object} entity - Entity object with x, y, and dir properties
 */
function move(entity) {
  // Calculate next position based on current direction
  const nextX = entity.x + entity.dir.x;
  const nextY = entity.y + entity.dir.y;
  
  // Handle horizontal teleportation
  if (entity.dir.x !== 0) { // Moving horizontally
    if (nextX < 0) {
      // Moving off left edge - check if current row allows teleportation
      if (entity.y >= 0 && entity.y < rows && level[entity.y][0] !== '1') {
        entity.x = cols - 1; // Teleport to right edge
        // entity.y remains unchanged during horizontal teleportation
        return;
      }
    } else if (nextX >= cols) {
      // Moving off right edge - check if current row allows teleportation
      if (entity.y >= 0 && entity.y < rows && level[entity.y][cols - 1] !== '1') {
        entity.x = 0; // Teleport to left edge
        // entity.y remains unchanged during horizontal teleportation
        return;
      }
    }
  }
  
  // Check bounds and walls
  if (nextY >= 0 && nextY < rows && nextX >= 0 && nextX < cols && level[nextY][nextX] !== '1') {
    entity.x = nextX;
    entity.y = nextY;
  } else {
    // Invalid move: stop entity movement
    entity.dir = { x: 0, y: 0 };
  }
}

/**
 * Main Game Loop Update Function
 * Fixed timestep game loop that runs at consistent intervals
 * Handles game logic updates, collision detection, and win/lose conditions
 * 
 * @param {number} currentTime - Timestamp from requestAnimationFrame
 */
function update(currentTime) {
  // Throttle updates to fixed timestep based on GAME_SPEED
  if (currentTime - lastTime >= GAME_SPEED) {
    /**
     * Entity Movement Phase
     * Move all entities based on their current direction vectors
     */
    move(pacman);
    move(ghost);

    /**
     * Dot Collection Logic
     * Check if PAC-MAN is on a dot tile and handle collection
     */
    if (level[pacman.y][pacman.x] === '2') {
      level[pacman.y][pacman.x] = '0'; // Remove dot from level
      score += 10; // Award points
      
      /**
       * Win Condition Check
       * Count remaining dots and trigger win state if all collected
       * Performance note: Could be optimized by tracking dot count instead of scanning
       */
      let dotsRemaining = 0;
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          if (level[y][x] === '2') dotsRemaining++;
        }
      }
      
      if (dotsRemaining === 0) {
        alert('You Win! Final Score: ' + score);
        document.location.reload(); // Reset game for replay
      }
    }

    /**
     * Ghost AI System
     * Simple random direction changes with wall avoidance
     * 10% chance per frame to change direction (creates unpredictable movement)
     */
    if (Math.random() < 0.1) {
      // All possible movement directions
      const dirs = [
        { x: 1, y: 0 },   // Right
        { x: -1, y: 0 },  // Left
        { x: 0, y: 1 },   // Down
        { x: 0, y: -1 }   // Up
      ];
      
      /**
       * AI Collision Avoidance
       * Filter out directions that would result in wall collision
       * Ensures ghost never gets stuck in walls
       */
      const validDirs = dirs.filter(dir => {
        const nextX = ghost.x + dir.x;
        const nextY = ghost.y + dir.y;
        return nextY >= 0 && nextY < rows && 
               nextX >= 0 && nextX < cols && 
               level[nextY][nextX] !== '1';
      });
      
      // Randomly select from valid directions
      if (validDirs.length > 0) {
        ghost.dir = validDirs[Math.floor(Math.random() * validDirs.length)];
      }
    }

    /**
     * Game Over Collision Detection
     * Check if PAC-MAN and ghost occupy the same grid position
     */
    if (pacman.x === ghost.x && pacman.y === ghost.y) {
      alert('Game Over! Score: ' + score);
      document.location.reload(); // Reset game for replay
    }

    // Update timing for next frame
    lastTime = currentTime;
  }

  // Render current frame and schedule next update
  draw();
  requestAnimationFrame(update);
}

/**
 * Input Handling System
 * Maps keyboard arrow keys to PAC-MAN movement direction vectors
 * Immediate response - no buffering or delay
 */
document.addEventListener('keydown', (e) => {
  // Map arrow keys to direction vectors for immediate movement
  if (e.key === 'ArrowLeft') pacman.dir = { x: -1, y: 0 };
  else if (e.key === 'ArrowRight') pacman.dir = { x: 1, y: 0 };
  else if (e.key === 'ArrowUp') pacman.dir = { x: 0, y: -1 };
  else if (e.key === 'ArrowDown') pacman.dir = { x: 0, y: 1 };
});

/**
 * Music Toggle System
 * Initialize audio and set up toggle button functionality
 */
async function initializeAudio() {
  const musicButton = document.getElementById('musicToggle');
  let audioInitialized = false;
  let isFirstClick = true;
  
  musicButton.addEventListener('click', async () => {
    // Initialize audio on first user interaction (browser requirement)
    if (!audioInitialized) {
      audioInitialized = await pacManAudio.init();
      
      if (!audioInitialized) {
        musicButton.textContent = '🔇 Audio Not Available';
        musicButton.disabled = true;
        return;
      }
    }
    
    // Handle the toggle
    if (isFirstClick) {
      // Start music on first click
      await pacManAudio.start();
      musicButton.textContent = '🎵 Music: ON';
      musicButton.classList.remove('music-off');
      isFirstClick = false;
    } else {
      // Toggle music on subsequent clicks
      const isPlaying = await pacManAudio.toggle();
      
      if (isPlaying) {
        musicButton.textContent = '🎵 Music: ON';
        musicButton.classList.remove('music-off');
      } else {
        musicButton.textContent = '🔇 Music: OFF';
        musicButton.classList.add('music-off');
      }
    }
  });
}

// Initialize the game
draw();
initializeAudio();
requestAnimationFrame(update);
