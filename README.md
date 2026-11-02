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
| Walk | WASD or arrows | D-pad |
| Dig (letting go cancels it) | Hold WASD or arrows | Hold D-pad |
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
| `TRUST_PROXY` | off | Set to `1` only behind a proxy, to read client addresses from `X-Forwarded-For` |
| `MAX_CONNECTIONS_PER_ADDRESS` | `30` | Connection limit per client address |

Game balance is in [`shared/config.js`](shared/config.js).

## Deploy

The game container runs as a non-root user with no outbound network access. The world lives in memory, so run a single instance.

With a random `trycloudflare.com` address, which changes when the tunnel restarts:

```bash
docker compose --profile tunnel up -d --build
docker compose logs cloudflared | grep trycloudflare.com
```

With your own domain and automatic HTTPS, create a `.env` file and start Caddy:

```bash
# .env
DOMAIN=example.com
PUBLIC_URL=https://example.com
ADMIN_KEY=change-me
```

```bash
docker compose --profile domain up -d --build
```

## Layout

```
server/index.js   HTTP and WebSocket server
server/game.js    Simulation, economy, events and story logic for one mine
server/world.js   World generation and chunk encoding
server/limits.js  Login and new-account rate limits
shared/           Game config, story content and miner looks, used by server and client
public/           Browser client
scripts/          Load test and playtime estimate
test/             Server tests
```
