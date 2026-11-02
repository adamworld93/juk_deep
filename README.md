# DEEP

A multiplayer ASCII mining game for browsers and phones. Dig ore, sell it, upgrade, and go deeper.

- **Story:** a private single-player world with characters, debt, permanent death and three endings.
- **The Commons:** one shared, persistent mine with a live market, world events and leaderboards.

## Run

Requires Node 20 or newer.

```bash
npm install
npm start          # http://localhost:3000
npm run dev        # restart on file changes
npm test
npm run playtime   # estimate how long the story takes
npm run loadtest -- 50 ws://localhost:3000/ws
```

Open `http://localhost:3000` and pick a name and a 4-digit PIN. Progress is saved under that name and PIN.

Open `http://localhost:3000/?host` for the big-screen view: a map of the mine, a QR code to join, leaderboards and market prices.

## Controls

| Action | Desktop | Phone |
|---|---|---|
| Walk / dig | WASD or arrows | D-pad |
| Climb, or fly using fuel | Hold ↑ | Hold ▲ |
| Use building | F | F button |
| Dynamite, teleporter, repair kit, fuel can, ladder | 1 2 3 4 5 | Item buttons |
| Settings / pause (story only) | Esc | ⚙ |
| Toggle music | M | Settings |
| Rescue (lose cargo, return to town) | R twice | Rescue button twice |
| Chat / leaderboard | T / L | 💬 / 🏆 |

## Configuration

| Env var | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | HTTP and WebSocket port |
| `DATA_DIR` | `./data` | Save directory |
| `MAX_PLAYERS` | `60` | Player cap for the Commons |
| `EVENT_SCALE` | `1` | Multiplier for the time between world events |
| `ADMIN_KEY` | none | Enables world reset at `/?host&key=<ADMIN_KEY>` |
| `PUBLIC_URL` | none | URL in the host QR code; defaults to the LAN address |

Game balance is in [`shared/config.js`](shared/config.js).

## Deploy

```bash
# .env
DOMAIN=example.com
ADMIN_KEY=change-me
```

```bash
docker compose up -d --build
```

This runs the game behind Caddy with automatic HTTPS. The world lives in memory, so run a single instance.

## Layout

```
server/index.js   HTTP and WebSocket server
server/game.js    Simulation, economy, events and story logic for one mine
server/world.js   World generation and chunk encoding
shared/           Game config, story content and miner looks, used by server and client
public/           Browser client
scripts/          Load test and playtime estimate
test/             Server tests
```
