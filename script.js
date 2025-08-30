const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const tileSize = 20;

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


// Convert level layout to a mutable 2D array
let level = levelLayout.map(row => row.split(''));
const rows = level.length;
const cols = level[0].length;
canvas.width = cols * tileSize;
canvas.height = rows * tileSize;
const width = canvas.width;
const height = canvas.height;

// Fill all empty spaces with dots
for (let y = 0; y < rows; y++) {
  for (let x = 0; x < cols; x++) {
    if (level[y][x] !== '1') level[y][x] = '2';
  }
}

let pacman = { x: 1, y: 1, dir: { x: 0, y: 0 } };
let ghost = { x: cols - 2, y: rows - 2, dir: { x: 0, y: -1 } };
let score = 0;
let lastTime = 0;
const GAME_SPEED = 150; // milliseconds between moves


// Clear dots at starting positions
level[pacman.y][pacman.x] = '0';
level[ghost.y][ghost.x] = '0';

function draw() {
  ctx.clearRect(0, 0, width, height);

  // Draw level
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const cell = level[y][x];
      if (cell === '1') {
        ctx.fillStyle = '#0031ff';
        ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
      } else if (cell === '0' || cell === '2') {
        ctx.fillStyle = 'black';
        ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
        if (cell === '2') {
          ctx.fillStyle = 'white';
          ctx.beginPath();
          ctx.arc(x * tileSize + tileSize / 2, y * tileSize + tileSize / 2, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  // Draw pacman
  ctx.fillStyle = 'yellow';
  ctx.beginPath();
  ctx.arc(pacman.x * tileSize + tileSize / 2, pacman.y * tileSize + tileSize / 2, tileSize / 2 - 2, 0.25 * Math.PI, 1.75 * Math.PI);
  ctx.lineTo(pacman.x * tileSize + tileSize / 2, pacman.y * tileSize + tileSize / 2);
  ctx.fill();

  // Draw ghost
  ctx.fillStyle = 'red';
  ctx.fillRect(ghost.x * tileSize + 2, ghost.y * tileSize + 2, tileSize - 4, tileSize - 4);
  
  // Draw score
  ctx.fillStyle = 'white';
  ctx.font = '20px Arial';
  ctx.fillText('Score: ' + score, 10, 25);
}

function move(entity) {
  const nextX = entity.x + entity.dir.x;
  const nextY = entity.y + entity.dir.y;
  
  // Check bounds and walls
  if (nextY >= 0 && nextY < rows && nextX >= 0 && nextX < cols && level[nextY][nextX] !== '1') {
    entity.x = nextX;
    entity.y = nextY;
  } else {
    entity.dir = { x: 0, y: 0 };
  }
}

function update(currentTime) {
  if (currentTime - lastTime >= GAME_SPEED) {
    move(pacman);
    move(ghost);

    // Check dot collision
    if (level[pacman.y][pacman.x] === '2') {
      level[pacman.y][pacman.x] = '0';
      score += 10;
      
      // Check win condition
      let dotsRemaining = 0;
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          if (level[y][x] === '2') dotsRemaining++;
        }
      }
      if (dotsRemaining === 0) {
        alert('You Win! Final Score: ' + score);
        document.location.reload();
      }
    }

    // Ghost AI: random at intersections, but avoid walls
    if (Math.random() < 0.1) {
      const dirs = [
        { x: 1, y: 0 },
        { x: -1, y: 0 },
        { x: 0, y: 1 },
        { x: 0, y: -1 }
      ];
      // Filter out directions that would hit walls
      const validDirs = dirs.filter(dir => {
        const nextX = ghost.x + dir.x;
        const nextY = ghost.y + dir.y;
        return nextY >= 0 && nextY < rows && nextX >= 0 && nextX < cols && level[nextY][nextX] !== '1';
      });
      if (validDirs.length > 0) {
        ghost.dir = validDirs[Math.floor(Math.random() * validDirs.length)];
      }
    }

    // Check game over
    if (pacman.x === ghost.x && pacman.y === ghost.y) {
      alert('Game Over! Score: ' + score);
      document.location.reload();
    }

    lastTime = currentTime;
  }

  draw();
  requestAnimationFrame(update);
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft') pacman.dir = { x: -1, y: 0 };
  else if (e.key === 'ArrowRight') pacman.dir = { x: 1, y: 0 };
  else if (e.key === 'ArrowUp') pacman.dir = { x: 0, y: -1 };
  else if (e.key === 'ArrowDown') pacman.dir = { x: 0, y: 1 };
});

draw();
requestAnimationFrame(update);
