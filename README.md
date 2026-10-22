# DEEP

An ASCII mining grind with two worlds:

- **▼ STORY:** a private descent through a world with characters and three endings. You are an employee of DEEP MINING CO., and the grind itself is the theme: the Foreman's cheerful industrial optimism, a Madman with a lantern who says we dug the sky away, a Hermit who left the system for self-chosen work, a Stone-Roller who makes peace with the endless task, the Abyss that looks back, and a Mirror at the heart of the earth where you choose what you become.
- **◆ THE COMMONS:** one shared, persistent multiplayer mine for everyone. Dig ore, haul it up, sell on a live market, upgrade, and go deeper than anyone else.

Generative chiptune and ambient music follows your depth and gets darker and slower with each layer. Toggle it with **M**.

```
██████╗ ███████╗███████╗██████╗
██╔══██╗██╔════╝██╔════╝██╔══██╗
██║  ██║█████╗  █████╗  ██████╔╝
██████╔╝███████╗███████╗██║
```

## Run it

```bash
npm install
npm start          # http://localhost:3000
npm run dev        # restarts on file changes
```

- **Play:** open `http://localhost:3000`, pick a name and a 4-digit PIN. Your progress is saved under name + PIN.
- **Big screen (projector):** open `http://localhost:3000/?host`. It shows a live cross-section of the whole mine with every miner, a QR code to join (your LAN IP), leaderboards, market prices and the event log.
- **Saves:** the Commons is saved to `data/world.json` and each story world to `data/solo/<name>.json`, every 30 s and on shutdown.

## Controls

| | Desktop | Phone |
|---|---|---|
| Move / dig | WASD or arrows (hold) | D-pad |
| Fly (thruster, costs fuel) | hold ↑ | hold ▲ |
| Use building (refuel / sell / repair) | F | F button |
| Items: dynamite, teleporter, repair kit, fuel can | 1 2 3 4 | item buttons |
| Rescue (lose cargo, back to town) | R twice | rescue button twice |
| Chat / leaderboard | T / L | 💬 / 🏆 |

## The grind

- **Loop:** dig, fill your cargo, get back up (fly, or use a teleporter), then **sell** at the MARKET, **refuel** at the FUEL pump and **upgrade** at the SHOP.
- **Upgrades** (8 levels each):
  - **Drill:** dig speed, plus the hardness it can break. Hard rock and obsidian gate the deeper layers.
  - **Fuel tank**, **Cargo bay**, **Hull** (HP and safe fall height), **Lamp** (light radius in the dark).
- **Layers:** Topsoil → Clay Beds → Stone → Deep Rock → Magma → The Core. Ores get rarer and pricier with depth: copper `•`, iron `%`, silver `*`, gold `$`, ruby `♦`, emerald `♣`, diamond `◆`, artifact `¤`.
- **Hazards:**
  - Gas pockets look like stone and explode.
  - Lava `≈` burns.
  - Long falls hurt.
  - Running out of fuel strands you.
- **Rebirth:** reach 450m (Magma) to unlock it. It resets your money and upgrades and gives a permanent ★: +15% ore value and +5% dig speed per star.
- **Fog of war:** you only see what your lamp lights. Explored tunnels are remembered on your device.

## Shared-world features

- **Tunnels are shared:** everyone's tunnels persist, and other miners' lamps light the dark around them.
- **Live market:** every sale lowers that ore's price, and prices recover over time.
- **World events, every few minutes:**
  - 💰 **Rush:** one ore sells for 3× for 2 minutes.
  - ☄ **Meteor:** a 25 s warning, then it craters the surface and leaves meteorite `✦` worth $1,500 each.
  - ⚠ **Cave-in:** tunnels collapse near a miner.
  - 🐛 **Giant worm boss:** it tunnels toward miners and hurts them. Drill into it together; the reward is split by damage and it drops treasure.
  - ⛏ **Fresh veins:** new ore regrows in the upper layers so newcomers can still earn.
- **Leaderboards (deepest, richest)** and a feed announcing rare finds, deaths and records.

## Configuration

| Env var | Default | What it does |
|---|---|---|
| `PORT` | 3000 | HTTP + WebSocket port |
| `DATA_DIR` | `./data` | where the world save lives |
| `EVENT_SCALE` | 1 | multiplies the time between world events (`0.3` = much more frequent, good for a live demo) |
| `MAX_PLAYERS` | 60 | player cap for the Commons |
| `ADMIN_KEY` | – | enables the **reset the world** button on the big screen: open `/?host&key=<ADMIN_KEY>` |
| `PUBLIC_URL` | – | URL shown in the host QR code (set this when tunnelled or deployed) |

Balance (prices, upgrade costs, ore rates per layer, timings) lives in [`shared/config.js`](shared/config.js).

## Architecture

```
server/index.js   HTTP static + /qr.svg + /api/info, WebSocket /ws, save on exit
server/game.js    one mine (Commons or a solo story world): 20 Hz sim, economy, events, worm, story beats, saves
server/world.js   procedural generation (noise rock bands, ore veins, caves, gas, lava), chunk encoding
shared/config.js  tiles, layers, upgrades, items, timings — imported by server AND browser
shared/story.js   characters, ASCII portraits, story beats, choices and endings
public/js/audio.js   generative soundtrack + sound effects (WebAudio, no files)
public/js/dialog.js  typewriter dialogue with portraits and choices
public/js/        main (net + input), view (ASCII canvas renderer), host (big-screen map), ui (HUD, shop)
scripts/loadtest.js   fake miners for load testing
```

**Networking:**
- The world is 160 × 1013 tiles. It's streamed to each player in 32-row chunks around them, and tile changes are broadcast as small deltas.
- Player positions go out at 10 Hz, and the client smooths them.
- **Measured:** 50 simultaneous miners use about 20% of one CPU core and about 12 KB/s per player.

```bash
npm run loadtest -- 50 ws://localhost:3000/ws
```

## Deploy / share

Lecture-hall Wi-Fi often blocks phones from reaching a laptop. To get around that:
- **Tunnel:** `cloudflared tunnel --url http://localhost:3000`, then restart with `PUBLIC_URL=https://<url>`.
- **Deploy:** the `Dockerfile` runs on Fly.io, Railway, Render or a VPS. Mount a volume at `/data` so the world survives restarts, and run a **single instance**, since the world lives in memory.

