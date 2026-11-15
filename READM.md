<div align="center">

# 🚀 STARFORGE: MISSION DESIGN

> *“Wake up, engineer! The government just slashed our budget, and our rover is basically a toaster on wheels.”*

[![Godot Engine](https://img.shields.io/badge/Godot-4.3%2B-blue?style=for-the-badge&logo=godot-engine)](https://godotengine.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)
[![Status](https://img.shields.io/badge/Status-Pre--Development-orange?style=for-the-badge)]()

</div>

---

## 🛰️ About the Project

**STARFORGE** is a high-fidelity single-player educational space simulation game developed in **Godot 4.3+**. Blending rigorous NASA systems engineering with engaging, humor-filled retro gameplay, the game drops you into **October 1994** at the Goddard Space Flight Center. 

Your mission: design, budget, build, and launch a lunar exploration mission to the South Pole of the Moon, commanding a custom rover to uncover ice crystals while surviving extreme thermal hazards.

---

## 🎮 Core Gameplay Loops

### [A] Phase 1: The Progressive NASA Base & Hangar (Midnight Club Tuning)
* **Progressive Base Building:** Start with an empty patch of grass, old landing strips, and a central launch pad. As you acquire parts, physical laboratory modules expand and construct themselves onto the base map.
* **Midnight Club-Style Customization:** Every component you select in the 5 modular labs (Propulsion, Avionics, Structure, Payload/Rover, and Monitoring) instantly updates the real-time visual model of your rocket and rover on the central pad.
* **Rigorous Physics & The "Cheap Part" Trap:** Balance a shared global budget against mass ($kg$), thrust-to-weight ratios ($T/W$), and round-trip fuel capacity. Cheap, low-tech parts save weight and money, but yield useless scientific data or faulty navigation—leading to catastrophic launch failures and hilarious reprimands from your guide.

### [B] Phase 2: Tactical Planetary Exploration (RTS & Survival)
* **Click-to-Move RTS Controls:** Command your customized rover across an open lunar map with minimap support, tactical waypoints, and a high-speed `Shift` Turbo mode.
* **Extreme Environmental Hazards:**
  * **Regolith & Rock Fields:** Heavy soft dust slows you down, while sharp rocks spike motor temperatures.
  * **Light/Shadow Thermal Cycle:** Direct sunlight recharges solar panels, but deep dark craters freeze your battery, cut off radio signals, and plunge you into absolute darkness.
* **Emergency Purge & Circuit Panics:** Overheating triggers circuit failures. Use the panic *Emergency Purge* button to vent gas and cool motors instantly at the cost of 15% total battery.

---

## 🎭 The Narrative & Guide

You are not alone in this frantic engineering nightmare. A caffeinated, cynical veteran **Avatar-Guia** guides your journey:
* **Retro Typewriter Briefings:** Immersive 1994 CRT monitor aesthetics with scanlines and slow text rendering.
* **Live Side-Panel Reactions:** The guide stays on your HUD during Phase 2, reacting dynamically with expressive facial changes and sharp, witty voice lines whenever your rover overheats, faces low battery, or triggers an emergency purge.

---

## 🛠️ Tech Stack & Architecture

* **Engine:** Godot 4.3+ (`GDScript`)
* **Art Style:** Fluid 2D Pixel Art (Base resolution 640x360, `canvas_items`, Nearest filtering) with dynamic 2D lighting shaders and `GPUParticles2D`.
* **Dynamic Audio:** Hans Zimmer-inspired (`"Interstellar"`) adaptive soundscape using `AudioStreamSynchronized` with 3 progressive tension layers.
* **Modular Codebase Architecture:**
  * `MissionManager.gd` — Global budget, weight, round-trip fuel physics, and tech-level validations.
  * `RoverRTS.gd` & `PlanetSurface.gd` — Tactical movement, terrain friction, thermal loops, and survival mechanics.
  * `BaseManager.gd` — Progressive physical base construction.
  * `GuidePanel.gd` — Dynamic humorous reactions and dialogue system.

---

## 📁 Repository Structure

```tree
STARFORGE/
│
├── src/
│   ├── jogo/          # Core gameplay logic (app, launch particles, customizers)
│   ├── nucleo/        # Rules, catalogs, mission states, and exploration logic
│   └── renderizar/    # Surface and scene renderers, asset management
│
├── testes/            # Automated test suites and rules verification
├── game_config.json   # Modular balance configuration
└── index.html         # Web export entry point
```

---

## 🚀 Getting Started

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/starforge.git
   ```
2. Open **Godot Engine 4.3+**.
3. Import the project folder and select `project.godot`.
4. Press `F5` to run and begin your journey as NASA's newest (and most stressed) aerospace engineer!

---

## 📜 License

Distributed under the MIT License. See `LICENSE` for more information.
