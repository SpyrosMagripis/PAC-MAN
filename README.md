# PAC-MAN Game

A classic PAC-MAN game implementation using HTML5 Canvas and vanilla JavaScript. Control PAC-MAN with the arrow keys and avoid the ghost while collecting all dots.

## 🎮 How to Play

1. **Quick Start**: Open `index.html` in any modern web browser - no additional setup required!
2. **Controls**: Use arrow keys (↑↓←→) to move PAC-MAN around the maze
3. **Objective**: Collect all yellow dots while avoiding the red ghost
4. **Scoring**: Each dot collected awards 10 points
5. **Win**: Collect all dots to win the game
6. **Game Over**: Don't let the ghost catch you!

## 🛠️ Development Setup

### Prerequisites
- Modern web browser (Chrome, Firefox, Safari, Edge)
- Text editor or IDE (VS Code recommended)
- Python 3.x (for development server)

### Getting Started

```bash
# Clone the repository
git clone https://github.com/SpyrosMagripis/PAC-MAN.git
cd PAC-MAN

# Start development server
npm run dev
# or alternatively:
python3 -m http.server 3000

# Open in browser
# Navigate to http://localhost:3000
```

### Development Environment

This project includes enhanced development configuration for GitHub Copilot:

- **Copilot Instructions**: Comprehensive coding guidelines in `.github/copilot-instructions.md`
- **VS Code Configuration**: Optimized settings in `.vscode/` directory
- **MCP Support**: Model Context Protocol configuration for enhanced AI assistance
- **IntelliSense**: JavaScript type checking and autocompletion via `jsconfig.json`

### Project Structure

```
PAC-MAN/
├── index.html          # Main game page
├── script.js          # Game logic and rendering
├── style.css          # Game styling
├── package.json       # Project metadata and scripts
├── jsconfig.json      # JavaScript/TypeScript configuration
├── .github/
│   └── copilot-instructions.md  # Copilot coding guidelines
├── .vscode/
│   ├── settings.json  # VS Code editor settings
│   ├── extensions.json # Recommended extensions
│   └── launch.json    # Debug configurations
└── .mcp-config.json   # MCP server configuration
```

### Code Architecture

- **Canvas Rendering**: HTML5 Canvas with 2D context for all graphics
- **Game Loop**: Fixed timestep using `requestAnimationFrame` for smooth 60fps
- **Entity System**: Object-based entities with position and direction vectors
- **Level System**: 2D array representation for walls, dots, and empty spaces
- **Input Handling**: Direct keyboard to direction vector mapping

### Development Scripts

```bash
npm run start    # Start development server on port 3000
npm run dev      # Same as start (development mode)
npm run serve    # Alternative server on port 8080
```

### Contributing

1. Follow the coding patterns established in the codebase
2. Use the provided VS Code configuration for consistent formatting
3. Refer to `.github/copilot-instructions.md` for detailed coding guidelines
4. Test changes in multiple browsers

## 🎯 Game Features

- **Classic Gameplay**: Authentic PAC-MAN mechanics
- **Smooth Animation**: 60fps rendering with fixed timestep
- **Smart AI**: Ghost with random movement and wall avoidance
- **Responsive Controls**: Immediate input response
- **Win/Lose Conditions**: Complete dot collection and collision detection
- **Score Tracking**: Real-time score display

## 🔧 Technical Details

- **No Dependencies**: Pure vanilla JavaScript, HTML5, and CSS3
- **Browser Compatibility**: Works on all modern browsers
- **Performance**: Optimized rendering and collision detection
- **Maintainable**: Well-documented code with clear separation of concerns

## 📝 License

MIT License - see [LICENSE](LICENSE) file for details.
