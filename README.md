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

## Milestone 1 Development — Dummy Vectors

The current implementation supports one in-memory room per server process, host
room creation, controller joining, two dummy sliders per phone, and host displays
for each player’s vector and their arithmetic mean. Components are independently
bounded to [-1, 1]; neutral players count, and an empty room has mean (0, 0).

With Node.js 22.12+ installed, run:

```bash
npm install
```

Start the room server and Vite in separate terminals:

```bash
npm run dev:server
```

```bash
npm run dev:web
```

On the host laptop, open `http://<laptop-LAN-IP>:5173/apps/host/` and click
**Create room**. On two phones on the same Wi-Fi, open
`http://<laptop-LAN-IP>:5173/apps/controller/` and enter the displayed room code
and a name. Use the laptop's LAN IP, not `localhost`, for phone access.
Allow local network access through the laptop firewall if needed; Wi-Fi client
isolation can prevent connections. Vite proxies `/ws` to the room server on port
8080, so browsers only need access to port 5173.

### Manual Milestone 1 test

1. Create a room on the host; verify a six-digit code appears.
2. Join from two phones with distinct names; verify both names and a count of 2
   appear on the host.
3. Set both phones to (1, 0): mean must be (1, 0). Set the second to (-1, 0):
   mean must be (0, 0). Set the first to (1, 1) and second to (0, 0): mean must
   be (0.5, 0.5). Verify individual numeric values and arrow directions.
4. Try an invalid room code in another browser; verify an error, then retry with
   the correct code and verify joining succeeds.
5. Close a phone tab; verify its player is removed once the socket closes.
   Immediate detection of lost connectivity is outside this milestone.
6. Close the host tab; verify controllers show that the room closed.
7. Open a fresh host page and create a new room; verify a new room can be opened.

Run `npm run typecheck` and `npm run build` for local checks. The build produces
frontend assets only; the documented two-process development setup supplies the
WebSocket proxy. There is no production deployment setup or reconnect system yet.

For an IPv6-only hotspot, start Vite with `npm run dev:web -- --host ::`.
Use the Mac’s current IPv6 address in brackets:
`http://[<Mac-IPv6-address>]:5173/apps/controller/index.html`.
The address may change when reconnecting. On the laptop the host remains at
`http://localhost:5173/apps/host/index.html`.
