# Copilot Instructions for PAC-MAN Game

## Project Overview
This is a classic PAC-MAN game implementation using HTML5 Canvas and vanilla JavaScript. The game features a player-controlled PAC-MAN character that must collect dots while avoiding a ghost enemy.

## Code Architecture & Patterns

### Core Components
- **Canvas Rendering**: All graphics are drawn using HTML5 Canvas 2D context
- **Game Loop**: Uses `requestAnimationFrame` for smooth 60fps animation
- **Entity System**: PAC-MAN and ghost are objects with position (`x`, `y`) and direction (`dir`) properties
- **Level System**: 2D array representation where `1` = walls, `2` = dots, `0` = empty space

### Coding Standards & Preferences

#### JavaScript Style
- Use `const` for immutable values, `let` for variables that change
- Prefer explicit variable names (`pacman`, `ghost`, `levelLayout`)
- Use object destructuring where appropriate
- Keep functions focused and single-purpose

#### Game Development Patterns
- **Entity Movement**: All entities use the same `move()` function with direction vectors
- **Collision Detection**: Simple grid-based collision using array bounds checking
- **Game State**: Minimal state management with global variables for game entities
- **Timing**: Fixed timestep game loop with `GAME_SPEED` constant

#### Canvas Drawing Conventions
- Clear canvas completely each frame with `clearRect()`
- Draw in order: background → dots → entities → UI
- Use consistent naming: `ctx` for canvas context, `tileSize` for grid scale
- Center entities within grid tiles using `tileSize / 2` offsets

### Code Organization
- **Global Constants**: Define at top of file (canvas setup, level layout, game speed)
- **Game State**: Entity objects and score tracking
- **Core Functions**: `draw()`, `move()`, `update()` - keep them focused
- **Event Handlers**: Keyboard input handling for player movement

### Performance Considerations
- Avoid creating objects in the game loop
- Cache array lengths in loops when possible
- Use efficient collision detection (grid-based vs pixel-perfect)
- Minimize DOM queries - cache element references

### Common Patterns for This Project
- **Position Management**: Always validate bounds before moving entities
- **Game Loop**: Separate update logic from rendering logic
- **Input Handling**: Map keyboard events directly to direction vectors
- **Level Design**: Use string arrays for easy level editing and visualization

### When Adding Features
- Follow the existing entity system pattern for new game objects
- Add new game states as additional properties on existing objects
- Keep rendering and game logic clearly separated
- Maintain the fixed-timestep game loop structure

### Debugging & Development
- Use `console.log()` for debugging entity positions and game state
- Test collision detection thoroughly with edge cases
- Verify game loop timing with different frame rates
- Test keyboard input across different browsers

## File Structure
- `index.html`: Game container and asset loading
- `script.js`: All game logic, rendering, and input handling
- `style.css`: Basic styling and layout
- `README.md`: User documentation

## Key Functions to Understand
- `move(entity)`: Universal entity movement with collision detection
- `update(currentTime)`: Main game loop with timing control
- `draw()`: Complete rendering pipeline
- Event listeners: Keyboard input mapping to game actions