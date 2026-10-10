# Tiltocracy

**Everyone tilts their own phone, and the ball goes wherever the team actually agrees.**

Tiltocracy is a browser-based cooperative physics game where multiple players use the physical tilt of their phones to control one shared game world.

Each player contributes a real-time 2D motion vector from their phone. The game combines those vectors into a single team vector that controls the board and ball:

- aligned inputs reinforce one another;
- opposing inputs cancel;
- no single player controls the game alone.

The result is a multiplayer game built around physical coordination, consensus, and collective control.

## How It Works

1. A host creates a game room.
2. Players join from their phones using a room code or QR code.
3. Each player calibrates their phone's neutral position.
4. Phone tilt is converted into a normalized 2D control vector.
5. The host combines all active player vectors into one resultant team vector.
6. That resultant controls the shared physics simulation.

The core control model is:

```text
player vectors → team vector → game physics
```

If everyone tilts in the same direction, the team gets a strong movement in that direction.

If players tilt against one another, their inputs partially or fully cancel.

## Gameplay

Players cooperate to guide a ball through physics-based challenges using only their combined motion.

The game is designed around mechanics that make collective control visible and meaningful, including:

- **Maze navigation** — guide the ball through obstacles together.
- **Consensus Gates** — gates respond to how closely the team aligns its inputs.
- **Social coordination mechanics** — levels can change how individual contributions affect the team.

The individual player vectors and the final team vector are visualized in real time, making the group's coordination directly visible.

## Architecture

Tiltocracy uses a browser-first architecture so players can join without installing an app.

### Controller

Each phone browser handles:

- motion permission
- neutral calibration
- tilt processing
- normalized `(x, y)` vector generation
- player feedback
- fallback touch controls when motion input is unavailable

### Server

The server handles:

- room creation and joining
- player connections
- message routing between controllers and the host

### Host

The host runs:

- vector aggregation
- game state
- physics
- level logic
- rendering
- team and player visualizations

The main data path is:

```text
phone
  ↓
processed tilt vector
  ↓
server relay
  ↓
host aggregation
  ↓
shared physics
  ↓
game render
```

## Team Vector

Each player contributes a vector:

```text
vᵢ = (xᵢ, yᵢ)
```

The team vector is computed from the active player inputs:

```text
T = (Σ vᵢ) / N
```

Using the mean keeps the control range consistent as the number of players changes.

An agreement metric can also be derived from the player vectors to measure how closely the team is aligned and drive game mechanics such as Consensus Gates.

## Tech Stack

- TypeScript
- Vite
- Node.js
- WebSockets
- Matter.js
- HTML5 Canvas / browser rendering
- Mobile motion sensors through browser APIs

## Project Structure

```text
tiltocracy/
├── apps/
│   ├── controller/
│   └── host/
├── server/
├── shared/
├── docs/
└── README.md
```

## Development

Tiltocracy is built as a real-time multiplayer web experience with a focus on:

- responsive physical input
- low-friction phone onboarding
- reliable real-time networking
- clear visualization of individual and collective control
- polished cooperative gameplay

## Knight Hacks IX

Tiltocracy was created for **Knight Hacks IX** at UCF.
