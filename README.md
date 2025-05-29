# HappyHour

🎯 **Happy Hour** - Rotating Donut Stage Party Game

An exciting 3D physics-based party game where players shoot objects into a rotating donut stage's central hole to earn points and money within 15 seconds!

## 🎮 Game Overview

Happy Hour is a thrilling arcade-style game built with **Three.js** and **Ammo.js** physics engine. Players control various weapons to knock objects into the central hole of a rotating merry-go-round stage, earning points and money to unlock more powerful weapons.

### 🎯 Objective
- Shoot objects into the **rotating donut stage's central hole**
- Earn as many points as possible within **15 seconds**
- Collect money to purchase better weapons
- Avoid the dangerous devil objects (-50 points!)

## ✨ Features

### 🔫 Weapon System
- **🍺 Beer Bottle**: Free starter weapon
  - Speed: 14 | Mass: 3 | Cooldown: 0.5s
- **🍸 Cocktail Glass**: $150,000
  - Speed: 18 | Mass: 2 | Cooldown: 0.25s
- **💣 Party Bomb**: $500,000
  - Speed: 12 | Mass: 4 | Explodes after 2 seconds

### 🎪 Game Mechanics
- **Rotating Merry-Go-Round**: Stage rotates continuously
- **Physics-Based**: Realistic object interactions with Ammo.js
- **Weight System**: Higher point objects are heavier and harder to move
- **15-Second Rounds**: Fast-paced gameplay sessions

### 💰 Point & Reward System
- 📦 **BOX**: 1 point ($1,000)
- 🚗 **Car**: 10 points ($10,000)
- 🎃 **Halloween**: 15 points ($15,000)
- 🥊 **Fighter**: 20 points ($20,000)
- 👑 **King**: 30 points ($30,000)
- 😈 **Devil**: -50 points (-$50,000) ⚠️

### 🛒 Shop System - "Bar Merry-Round"
- Purchase weapons with earned money
- Persistent progress with local storage
- Weapon unlock progression system

### 🎵 Audio Features
- Background music during menu and gameplay
- Sound effects for weapon firing, explosions, and scoring
- Audio toggle option

### 📊 Progress Tracking
- High score recording
- Play history (last 10 games)
- Money and weapon ownership persistence
- Statistics display

## 🎮 Controls

- **Mouse Click**: Shoot weapons
- **Mouse Drag**: Rotate camera view
- **Mouse Wheel**: Zoom in/out
- **UI Buttons**: 
  - 🏆 View rankings
  - 🛒 Open weapon shop
  - ⚙️ Settings & data reset
  - ❓ Help & tutorial
  - 🔊/🔇 Toggle sound

## 🏗️ Technical Stack

- **Three.js**: 3D graphics and rendering
- **Ammo.js**: Physics simulation
- **WebGL**: Hardware-accelerated graphics
- **Web Audio API**: Sound effects and music
- **Local Storage**: Progress persistence
- **Vanilla JavaScript**: Core game logic

## 📁 Project Structure

```
medarion/
├── main.js                 # Main game logic
├── index.html             # Game HTML structure
├── style.css              # Game styling
├── bgm/                   # Audio files
│   ├── waltz.mp3         # Menu BGM
│   ├── magebgm.mp3       # Game BGM
│   ├── click.mp3         # UI sounds
│   └── ...               # Other sound effects
├── target/               # 3D models for objects
│   ├── car.glb
│   ├── devil.glb
│   └── ...
├── beer.glb              # Weapon models
├── cocktail.glb
├── bomb.glb
└── README.md
```

## 🚀 Getting Started

### Prerequisites
- Modern web browser with WebGL support
- Web server (for loading 3D models and audio)

### Installation

1. **Clone or download** the project files
2. **Set up a local web server**:
   ```bash
   # Using Python 3
   python -m http.server 8000
   
   # Using Node.js (with http-server)
   npx http-server
   
   # Using PHP
   php -S localhost:8000
   ```
3. **Open your browser** and navigate to `http://localhost:8000`
4. **Click anywhere** to enable audio and start playing!

### Browser Compatibility
- Chrome 80+ ✅
- Firefox 75+ ✅
- Safari 13+ ✅
- Edge 80+ ✅

## 🎯 Gameplay Tips

### Beginner Strategy
1. Start with the **Beer Bottle** to learn the mechanics
2. Aim for **BOX objects** (1 point) to build initial funds
3. Observe the **rotation pattern** of the stage
4. Avoid **Devil objects** at all costs!

### Advanced Strategy
1. Purchase **Cocktail Glass** for faster firing
2. Target **medium-value objects** (Cars, Halloween items)
3. Use **Party Bombs** to create chain reactions
4. Time your shots with the stage rotation

### Expert Tips
- **Weight matters**: Heavier objects (higher points) are harder to move
- **Devil trap**: Devils are light and easy to hit accidentally
- **Bomb timing**: Use explosion radius to affect multiple objects
- **Camera positioning**: Find the best angle for consistent shots

## 🎨 Game Features

### Visual Effects
- **Rainbow hole bottom** with pulsing animations
- **Explosion particles** and lighting effects
- **Success/failure** visual feedback
- **Money reel animations** on completion

### Audio System
- **Dynamic BGM** switching between menu and game
- **Weapon-specific** sound effects
- **Spatial audio** for immersive experience
- **User interaction** compliance for web browsers

### UI/UX Design
- **Responsive design** for different screen sizes
- **Intuitive controls** with visual feedback
- **Modal system** for settings and information
- **Progress indicators** and loading screens

## 🏆 Achievements & Goals

### Score Rankings
- **NOVICE**: 0-9 points
- **BEGINNER**: 10-29 points
- **INTERMEDIATE**: 30-59 points
- **ADVANCED**: 60-89 points
- **EXPERT**: 90-119 points
- **MASTER**: 120-149 points
- **LEGEND**: 150+ points

### Collection Goals
- Unlock all weapons (3 total)
- Achieve highest possible score
- Master the bomb's explosion mechanics
- Complete weapon collection with minimal games

## 🛠️ Development

### Created by
**R creative Lab**  
Website: [R-TARO.com](https://R-TARO.com)

### Technology Highlights
- **Real-time physics** simulation with Ammo.js
- **3D model loading** with GLTFLoader
- **Audio management** with preloading and user interaction detection
- **Local storage** for persistent game progress
- **Responsive UI** with CSS animations

## 📋 Game Modes

### Current Mode: Classic
- 15-second time limit
- Rotating stage
- Point-based scoring
- Weapon progression

### Future Possibilities
- Extended time modes
- Multiplayer competitions
- Custom stage designs
- Seasonal events

## 🎉 Fun Facts

- The game features a **rotating merry-go-round** stage inspired by amusement parks
- **Weight-based physics** makes high-value targets more challenging
- The **Devil object** is intentionally light to create a "trap" mechanic
- **Party Bomb** explosions can create satisfying chain reactions
- **Bar Merry-Round** shop name is a playful pun on the rotating stage

---

🍻 **Ready to party?** Load up the game and start your Happy Hour adventure!

*Remember: This is a party game - invite friends to compete for the highest scores!*
