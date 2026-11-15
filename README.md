# STARFORGE

> *"Wake up, engineer! We don't have time to nap. The Congress just cut half our budget..."*

**STARFORGE** is a high-fidelity, single-player educational space simulation game developed in **Godot 4.3+**, combining rigorous NASA systems engineering with engaging, humor-filled gameplay wrapped in a nostalgic 1994 CRT retro aesthetic.

---

## 🚀 Game Overview

In **STARFORGE**, you manage the full lifecycle of a lunar exploration mission under tight budget, mass, and physics constraints. The game is divided into two distinct, deeply interconnected phases:

### Phase 1: The Progressive NASA Base & Hangar (Tuning Style)
* **Progressive Basebuilding:** Start with a minimalist site featuring just landing strips and a central launch pad. As you acquire components, physical laboratory modules emerge and expand across the base map.
* **Modular Engineering & Trade-offs:** Equip 5 specialized labs (Propulsion, Avionics, Structure, Payload/Rover, and Monitoring) choosing between low-cost/low-tech options versus advanced/heavy equipment using a shared global budget.
* **Midnight Club-Style Customization:** Every part you choose instantly updates the visual sprite of your rocket and rover on the central launch platform in real-time.
* **Aerospace Physics Validation:** Your design must pass strict calculations for mass, thrust-to-weight ratio ($T/W$), and round-trip fuel capacity before launch. Avoid the "cheap part trap"—low-tech components yield useless scientific data or faulty navigation.

### Phase 2: Tactical RTS Lunar Exploration
* **Tactical Click-to-Move Controls:** Command your custom rover across the hazardous terrain of the lunar South Pole using an RTS-style interface and minimap.
* **Thermal & Light Cycles:** Navigate the extreme temperature swings (+120°C to -150°C) between direct solar heat and deep crater shadows. Solar panels recharge in light but drain quickly in darkness.
* **Emergency Purge:** Stressed out by motor overheating on jagged rock fields? Trigger the panic *Emergency Purge* to vent heat instantly at the cost of 15% total battery.
* **Comms & Data Transmission:** Lay down signal relay beacons to maintain radio connection with orbit while exploring dark craters.

---

## 🎭 The Avatar-Guide
Forget boring text pop-ups. Meet your caffeinated, cynical veteran mentor who guides you through an atmospheric CRT typewriter-style intro and stays with you via a reactive side-panel HUD during gameplay, reacting live and roasting your engineering mistakes with witty humor.

---

## 🛠️ Tech Stack & Requirements
* **Engine:** Godot 4.3+ (GDScript)
* **Art Style:** Fluid 2D Pixel Art (Base resolution: 640x360, Stretch mode: `canvas_items`, Filter: `Nearest`) enhanced with dynamic 2D lighting shaders and particle systems (`GPUParticles2D`).
* **Audio:** Dynamic adaptive soundtrack (`AudioStreamSynchronized`) inspired by Hans Zimmer's *Interstellar*.

---

## 📁 Project Structure
```text
STARFORGE/
├── src/
│   ├── jogo/           # Main game loops and controllers (app.js, player, etc.)
│   ├── nucleo/         # Core rules, catalogs, exploration, and mission state logic
│   └── renderizar/     # Surface, scene, and planetary renderers/assets
├── testes/             # Automated test suites
└── assets/             # Pixel art sprites, UI, and audio streams
