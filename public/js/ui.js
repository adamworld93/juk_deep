// DOM HUD: stats bars, building panels (fuel / market / shop), items, feed, leaderboard, host panel.
import * as C from '/shared/config.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
const fmt = (n) => Math.floor(n).toLocaleString('en');
const setHtml = (el, html) => { if (el._html !== html) { el._html = html; el.innerHTML = html; } };
const ORE_DEFS = Object.fromEntries(C.TILES.filter((t) => t.ore).map((t) => [t.key, t]));

const bar = (v, max, n = 14) => {
  const k = Math.max(0, Math.min(n, Math.round((v / max) * n)));
  return `[${'█'.repeat(k)}${'░'.repeat(n - k)}]`;
};

export function statsOf(me) {
  const U = C.UPGRADES;
  return {
    tank: U.tank.value[me.u.tank], cargo: U.cargo.value[me.u.cargo], hull: U.hull.value[me.u.hull],
    lamp: U.lamp.value[me.u.lamp], power: U.drill.power[me.u.drill],
  };
}

export class UI {
  constructor(actions) {
    this.actions = actions; // { send(msg), use(item) }
    this.feedLines = [];
    this.toastTimer = null;
    this.lb = null;
    this.market = null;
    this.lastPrices = {};
    $('panel').addEventListener('click', (e) => {
      if (e.target.closest('h2')) { $('panel').classList.toggle('open'); return; }
      const b = e.target.closest('button[data-a]');
      if (!b || b.disabled) return;
      const msg = { t: b.dataset.a };
      if (b.dataset.k) msg.k = b.dataset.k;
      actions.send(msg);
    });
    $('items').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-item]');
      if (b) actions.use(b.dataset.item);
    });
  }

  toast(text, kind = '') {
    const el = $('toast');
    el.textContent = text;
    el.className = `show ${kind}`;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => { el.className = ''; }, 2000);
  }

  addFeed(html, kind = 'info') {
    this.feedLines.push({ html, kind });
    if (this.feedLines.length > 8) this.feedLines.shift();
    setHtml($('feed'), this.feedLines.map((f) => `<div class="k-${f.kind}">${f.html}</div>`).join(''));
    if (this.host) this.renderHostFeed();
  }

  setMarket(m) {
    if (this.market) this.lastPrices = this.market.p;
    this.market = m;
  }

  toggleLb(force) {
    $('lb').classList.toggle('hidden', force === undefined ? undefined : !force);
  }

  // Called ~10×/s with the current client state.
  update(S) {
    if (S.host) return this.updateHost(S);
    const me = S.me;
    if (!me) return;
    const st = statsOf(me), self = S.players.get(S.you);
    const y = self?.y ?? 0, depth = C.depthOf(y), layer = C.layerOf(depth);
    setHtml($('depth'), y < C.SURFACE ? '▲ surface' : `▼ ${depth}m · ${layer.name}`);
    setHtml($('money'), `$${fmt(me.m)}`);
    setHtml($('stars'), me.s ? '★'.repeat(Math.min(me.s, 5)) + (me.s > 5 ? `×${me.s}` : '') : '');
    setHtml($('online'), S.mode === 'solo' ? '· story ·' : `${S.players.size} online`);

    const cargo = Object.values(me.c).reduce((s, n) => s + n, 0);
    const lowFuel = me.f < st.tank * 0.25;
    setHtml($('bars'), [
      `<span class="f ${lowFuel ? 'warn' : ''}">FUEL  ${bar(me.f, st.tank)} ${Math.floor(me.f)}/${st.tank}</span>`,
      `<span class="h ${me.h < st.hull * 0.3 ? 'warn' : ''}">HULL  ${bar(me.h, st.hull)} ${me.h}/${st.hull}</span>`,
      `<span class="c ${cargo >= st.cargo ? 'warn' : ''}">CARGO ${bar(cargo, st.cargo)} ${cargo}/${st.cargo}</span>`,
    ].join('\n'));

    const touch = document.body.classList.contains('touch');
    const underground = y >= C.SURFACE;
    setHtml($('items'), C.ITEM_KEYS.map((k) => {
      const it = C.ITEMS[k], n = me.i[k] ?? 0;
      return `<button data-item="${k}" ${n ? '' : 'disabled'}>${touch ? '' : `<b>${it.key}</b> `}${it.name.toLowerCase()} ×${n}</button>`;
    }).join('') + (underground ? `<button data-item="rescue">${touch ? '' : '<b>R</b> '}rescue</button>` : ''));

    const rush = this.market?.rush;
    $('rush').classList.toggle('hidden', !rush);
    if (rush) setHtml($('rush'), `💰 RUSH: ${ORE_DEFS[rush.ore].name} ×3 · ${rush.left}s`);

    this.updatePanel(S, me, st, y);
    this.renderLb();
  }

  updatePanel(S, me, st, y) {
    const station = y <= C.SURFACE - 1 ? C.stationAt(S.players.get(S.you)?.x ?? -99) : null;
    $('panel').classList.toggle('hidden', !station);
    if (!station) return;
    const btn = (a, label, enabled = true, k = '', cls = '') => `<button data-a="${a}" ${k ? `data-k="${k}"` : ''} class="${cls}" ${enabled ? '' : 'disabled'}>${label}</button>`;
    let html = '';
    if (station.key === 'fuel') {
      const need = st.tank - me.f, cost = Math.ceil(need * C.FUEL_PRICE);
      html = `<h2>⛽ FUEL PUMP</h2>
        <div class="row"><span>Tank</span><span>${Math.floor(me.f)} / ${st.tank}</span></div>
        <div class="row"><span>Price</span><span>$${C.FUEL_PRICE} / unit</span></div>
        ${btn('fuel', need < 1 ? 'TANK FULL' : `[F] REFUEL — $${fmt(Math.min(cost, me.m))}`, need >= 1 && me.m > 0, '', 'primary')}`;
    } else if (station.key === 'sell') {
      const p = this.market?.p ?? {};
      const bonus = 1 + C.REBIRTH_BONUS * me.s;
      let total = 0;
      const rows = Object.entries(me.c).filter(([, n]) => n > 0).map(([k, n]) => {
        const sub = (p[k] ?? 0) * n * bonus;
        total += sub;
        return `<div class="row"><span style="color:${ORE_DEFS[k].color}">${ORE_DEFS[k].ch} ${ORE_DEFS[k].name} ×${n}</span><span>$${fmt(sub)}</span></div>`;
      }).join('');
      const board = C.ORES.map((k) => {
        const d = ORE_DEFS[k], cur = p[k] ?? d.value, prev = this.lastPrices[k] ?? cur;
        const trend = cur > prev ? '<span class="up">▲</span>' : cur < prev ? '<span class="down">▼</span>' : ' ';
        return `<div class="row sub"><span style="color:${d.color}">${d.ch} ${d.name}</span><span>$${fmt(cur)} ${trend}</span></div>`;
      }).join('');
      html = `<h2>$ MARKET</h2>${rows || '<div class="sub">Cargo is empty. Go dig!</div>'}
        ${btn('sell', `[F] SELL ALL — $${fmt(total)}`, total > 0, '', 'primary')}
        <h2 style="margin-top:12px">PRICES${me.s ? ` <span class="sub">(+${Math.round((bonus - 1) * 100)}% ★)</span>` : ''}</h2>${board}`;
    } else {
      const ups = C.UPGRADE_KEYS.map((k) => {
        const U = C.UPGRADES[k], lvl = me.u[k], max = lvl >= C.MAX_LEVEL;
        const vals = k === 'drill' ? U.speed : U.value;
        const next = max ? '' : ` → ${k === 'drill' ? `${vals[lvl + 1]}× (hardness ${U.power[lvl + 1]})` : vals[lvl + 1]}`;
        return `<div class="row"><span>${U.name} <span class="lvl">Lv${lvl + 1}</span><br><span class="sub">${k === 'drill' ? `${vals[lvl]}× · hardness ${U.power[lvl]}` : vals[lvl]}${next}</span></span>
          ${btn('upgrade', max ? 'MAX' : `$${fmt(U.cost[lvl + 1])}`, !max && me.m >= U.cost[lvl + 1], k)}</div>`;
      }).join('');
      const items = C.ITEM_KEYS.map((k) => {
        const it = C.ITEMS[k];
        return `<div class="row"><span>${it.name} <span class="lvl">×${me.i[k] ?? 0}</span><br><span class="sub">${it.desc}</span></span>${btn('buy', `$${it.price}`, me.m >= it.price, k)}</div>`;
      }).join('');
      const dmg = st.hull - me.h;
      const repair = `<div class="row"><span>Repair hull <span class="lvl">${me.h}/${st.hull}</span></span>${btn('repair', dmg > 0 ? `[F] $${fmt(Math.min(dmg * C.REPAIR_PRICE, me.m))}` : 'OK', dmg > 0 && me.m > 0)}</div>`;
      const reborn = me.rd >= C.REBIRTH_DEPTH
        ? `<h2 style="margin-top:12px">🌟 REBIRTH</h2><div class="sub">Reset money + upgrades, gain ★ (+${Math.round(C.REBIRTH_BONUS * 100)}% ore value, +5% dig speed forever).</div>${btn('rebirth', `REBIRTH → ★${me.s + 1}`, true, '', 'primary')}`
        : `<div class="sub" style="margin-top:10px">🌟 Rebirth unlocks at ${C.REBIRTH_DEPTH}m (best this run: ${me.rd}m)</div>`;
      html = `<h2>⚙ SHOP</h2>${repair}${ups}<h2 style="margin-top:12px">ITEMS</h2>${items}${reborn}`;
    }
    setHtml($('panel'), html);
  }

  renderLb() {
    if (!this.lb || $('lb').classList.contains('hidden')) return;
    const li = ([name, v, stars, on], unit) => `<li class="${on ? 'on' : ''}">${esc(name)}${stars ? ` <span style="color:#ff8af0">★${stars}</span>` : ''} — ${unit === '$' ? `$${fmt(v)}` : `${v}m`}</li>`;
    setHtml($('lb'), `<h3>DEEPEST</h3><ol>${this.lb.deep.map((r) => li(r, 'm')).join('')}</ol><h3>RICHEST</h3><ol>${this.lb.rich.map((r) => li(r, '$')).join('')}</ol>`);
  }

  // ---------- host ----------

  updateHost(S) {
    this.host = true;
    setHtml($('host-online'), `${S.players.size} miners online`);
    if (this.lb) {
      const li = ([name, v, stars, on], unit) => `<li class="${on ? 'on' : ''}">${esc(name)}${stars ? ` ★${stars}` : ''} <span class="dim">${unit === '$' ? `$${fmt(v)}` : `${v}m`}</span></li>`;
      setHtml($('host-deep'), this.lb.deep.slice(0, 6).map((r) => li(r, 'm')).join(''));
      setHtml($('host-rich'), this.lb.rich.slice(0, 6).map((r) => li(r, '$')).join(''));
    }
    if (this.market) {
      setHtml($('host-market'), C.ORES.map((k) => {
        const d = ORE_DEFS[k], cur = this.market.p[k], prev = this.lastPrices[k] ?? cur;
        const hot = this.market.rush?.ore === k ? ' 💰' : '';
        return `<span style="color:${d.color}">${d.ch} ${d.name}${hot}</span><span>$${fmt(cur)} ${cur > prev ? '▲' : cur < prev ? '▼' : ''}</span>`;
      }).join(''));
    }
  }

  renderHostFeed() {
    setHtml($('host-feed'), this.feedLines.slice().reverse().map((f) => `<div class="k-${f.kind}">${f.html}</div>`).join(''));
  }
}

export { esc };
