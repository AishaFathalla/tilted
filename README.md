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

### Combined lobby

Run `npm run dev:server` and `npm run dev:web` in separate terminals, then open
`http://localhost:5173/`. Create and Join are on this same page. The creator
hosts the room; players enter a name and the six-digit code to join. Everyone
in the room sees the live player list with matching assigned colors. Players
get slider controls, and the host sees the team average. The host is a shared
screen and does not count as a player.

Phones should open `http://<laptop-LAN-IP>:5173/`, not localhost. Restart the
room server after updating so it can send the shared player roster.

The combined lobby also loads the shared 3D maze on the host screen after room
creation. Joined players select Phone motion, tap **Enable motion**, hold a
comfortable neutral pose, then tap **Calibrate**. Portrait and either landscape
side are supported; rotating the screen requires recalibration. Motion requires
trusted HTTPS on phones. **Slider fallback** works without motion permission.
The host's team average drives the maze physics, and **New maze** resets the board.

On the combined lobby, rounds have a two-minute limit starting with the first
nonzero team input. A win or timeout freezes the ball and opens the result menu.
**Restart** retries the same maze, **Next maze** generates a new board, and
**Exit** closes the hosted room and returns to the menu. The duration is configured
by `ROUND_SECONDS` in `apps/lobby/main.ts`.

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

## Milestone 2 — Phone Motion

Phone motion is the default input mode; **Slider fallback** is an explicit option.
Join, tap **Enable motion**, hold a comfortable neutral pose in portrait or
landscape, and tap **Calibrate**. Recalibration immediately sends zero and resets smoothing.
Switching input modes also resets both sliders and the outgoing vector; returning
to motion requires enabling and calibrating again.

Motion uses `DeviceOrientationEvent` and the screen orientation angle. Portrait
and both landscape sides are supported on portrait-natural phones, with directions
always relative to the screen. In portrait (screen angle 0°),
`x = (gamma - gamma₀) / 30` and `y = -shortestAngle(beta - beta₀) / 30`.
At 90° (phone top on the left), `x = shortestAngle(beta - beta₀) / 30` and
`y = (gamma - gamma₀) / 30`. At 180° and 270° (phone top on the right), the 0° and
90° signs reverse. Each mapping is the portrait one rotated by the screen angle.
Unknown screen angles pause motion instead of guessing.

On iPhone, which can only lock rotation in portrait, the most stable setup is
**Portrait Orientation Lock on** and playing in portrait: the screen can't rotate
mid-game, so hard tilts never pause motion. With rotation unlocked, landscape
works too.
A radial clamp bounds magnitude to 1,
a radial dead zone of 0.08 rescales the remaining range, and exponential smoothing
uses a factor of 0.2 per sensor sample. Tiny residuals snap to zero. All tuning
constants are in `apps/controller/motion.ts`. This supports ordinary tilts around
a comfortable neutral pose; inverted poses are outside this milestone.

Any screen rotation (portrait ↔ landscape, or flipping sides) pauses at zero and
invalidates calibration; calibrate again in the new orientation. Backgrounding the page, invalid readings,
or two seconds without readings also pauses at zero and requires recalibration.
Permission denial and unavailable sensors show instructions to use sliders.

### Trusted HTTPS for phone testing

The simplest setup for the current two-process development deployment is a
Cloudflare Quick Tunnel (the `cloudflared` binary is installed on this Mac).
Run the room server, Vite, and tunnel in three terminals:

```bash
npm run dev:server
```

```bash
npm run dev:web
```

```bash
cloudflared tunnel --url http://localhost:5173
```

Open the printed `https://<random>.trycloudflare.com/apps/host/` on the laptop
and `https://<random>.trycloudflare.com/apps/controller/` on phones.
Cloudflare supplies a publicly trusted TLS certificate. The controller connects
to `wss://<random>.trycloudflare.com/ws`; the tunnel forwards to Vite, whose
existing `/ws` proxy forwards to `ws://127.0.0.1:8080/ws`. No separate tunnel or
TLS certificate is needed for the room server. The temporary URL changes when
the tunnel restarts. Stop the tunnel when testing ends.

`vite.config.ts` allows any `.trycloudflare.com` hostname, so a new tunnel URL
works without restarting Vite or editing the config.

Plain HTTP LAN URLs still work for sliders, but cannot be used for phone motion.
Quick Tunnel documentation: https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/

### Required real-phone acceptance test

The user reported the original portrait test successful (device/browser not
specified). The current mappings (portrait and both landscape sides) require another
physical check. Complete these steps in iPhone Safari and Android Chrome.

1. Create a room over HTTPS and join. On iPhone, tap **Enable motion** and allow
   the prompt. Android may attach sensors without a prompt. Calibrate.
2. In portrait and in each landscape position, lower the screen’s right edge: controller and host must show positive X. Lower the
   screen’s left edge: negative X. Lower the screen’s top edge away from you: positive Y. Lift
   the screen’s top edge toward you: negative Y. Record phone, browser, and each sign.
3. Hold neutral: output settles to exactly zero. Small tilts stay zero; roughly
   30° reaches full strength after smoothing. Diagonal magnitude stays ≤ 1.
4. Recalibrate in a different comfortable pose: output immediately becomes zero.
5. Tilt, switch to sliders: host immediately sees zero. Move sliders; switch
   back to motion: zero again until enabling and calibrating.
6. While tilted, rotate the screen (portrait ↔ landscape): host immediately sees zero
   and output stays zero until fresh readings and explicit calibration. Flip
   landscape sides and confirm another calibration is required. With iPhone
   Portrait Orientation Lock on, confirm hard tilts in portrait never pause.
   Also check background/foreground and sensor loss.
7. Deny permission in a fresh browser session: helpful feedback appears and
   sliders still work. Retry after allowing sensor access in browser settings.
8. Join from two phones: aligned tilts reinforce; opposing tilts cancel.

| Device/browser | Screen right edge down → +X | Screen top edge down/away → +Y | Status |
| --- | --- | --- | --- |
| iPhone / Safari (portrait) | Pending | Pending | Portrait retest pending |
| iPhone / Safari (landscape) | Pending | Pending | Landscape retest pending |
| Android / Chrome (portrait) | Pending | Pending | Portrait retest pending |
| Android / Chrome (landscape) | Pending | Pending | Landscape retest pending |

Local verification: `npm run typecheck`, `npm run build`, and
`node --import tsx --test tests/motion.test.ts`. Automated tests verify the angle transform,
clamp, dead zone, wrap handling, all four screen-angle mappings (and that each is the previous one rotated
a quarter turn), and smoothing, not physical sensor signs.
