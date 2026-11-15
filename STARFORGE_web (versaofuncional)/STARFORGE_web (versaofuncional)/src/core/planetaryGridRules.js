/** Pure grid-based lunar rover simulation for the 1994 South Pole surface phase. */
import { TECH_DETECTION_MIN_INDEX, SCIENCE_SUCCESS_THRESHOLD } from './missionState.js';
import { FAILURE_MESSAGES } from './failureMessages.js';

export const GRID_SEED = 1994;
export const GRID_COLS = 30;
export const GRID_ROWS = 20;
export const GRID_TILE_SIZE = 24; // 16 logical pixels, scaled 1.5x inside Astrocade's portrait canvas.
export const GRID_MAP_X = 0;
export const GRID_MAP_Y = 110;
export const GRID_MAP_WIDTH = GRID_COLS * GRID_TILE_SIZE;
export const GRID_MAP_HEIGHT = GRID_ROWS * GRID_TILE_SIZE;
export const SAMPLE_GOAL = 3;
export const MISSION_CRYSTAL_COUNT = 4;
export const SCANNER_MEMORY_CAPACITY = 2;
export const DRILL_MEMORY_CAPACITY = 1;
export const SCANNER_ENERGY_COST = 3;
export const DRILL_ENERGY_COST = 12;
export const ROVER_ROCK_SPEED_FACTOR = 0.5;
export const GRID_CRYSTAL_POSITIONS = [
  { id: 'ice-1', x: 22, y: 5 },
  { id: 'ice-2', x: 7, y: 5 },
  { id: 'ice-3', x: 26, y: 16 },
  { id: 'ice-4', x: 14, y: 10 }
];

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const idx = (x, y) => y * GRID_COLS + x;
const key = (x, y) => `${x},${y}`;
const tileDistance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const DIFFICULTIES = {
  beginner: { drain: 0.5, stormAt: 60, countdown: 18 },
  engineer: { drain: 1, stormAt: 90, countdown: 10 },
  director: { drain: 1.3, stormAt: 70, countdown: 7 }
};

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 0x100000000;
  };
}

function terrainAt(map, x, y) {
  if (x < 0 || y < 0 || x >= GRID_COLS || y >= GRID_ROWS) return 'MOUNT';
  return map.terrain[idx(x, y)];
}

function terrainCost(tile) {
  if (tile === 'MOUNT') return Infinity;
  if (tile === 'ROCK') return 2.4;
  if (tile === 'CRATER') return 1.6;
  return 1;
}

function findGridPath(map, from, to) {
  const sx = clamp(Math.floor(from.x), 0, GRID_COLS - 1);
  const sy = clamp(Math.floor(from.y), 0, GRID_ROWS - 1);
  const tx = clamp(Math.floor(to.x), 0, GRID_COLS - 1);
  const ty = clamp(Math.floor(to.y), 0, GRID_ROWS - 1);
  if (terrainAt(map, tx, ty) === 'MOUNT') return [];
  const start = key(sx, sy);
  const goal = key(tx, ty);
  const open = [{ x: sx, y: sy, f: 0 }];
  const gScore = new Map([[start, 0]]);
  const parent = new Map();
  const closed = new Set();
  while (open.length) {
    open.sort((a, b) => a.f - b.f);
    const current = open.shift();
    const currentKey = key(current.x, current.y);
    if (closed.has(currentKey)) continue;
    if (currentKey === goal) {
      const path = [];
      let cursor = goal;
      while (cursor !== start) {
        const [x, y] = cursor.split(',').map(Number);
        path.push({ x, y });
        cursor = parent.get(cursor);
        if (!cursor) return [];
      }
      return path.reverse();
    }
    closed.add(currentKey);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = current.x + dx;
      const y = current.y + dy;
      const tile = terrainAt(map, x, y);
      if (!Number.isFinite(terrainCost(tile))) continue;
      const neighborKey = key(x, y);
      const tentative = (gScore.get(currentKey) ?? Infinity) + terrainCost(tile);
      if (tentative >= (gScore.get(neighborKey) ?? Infinity)) continue;
      gScore.set(neighborKey, tentative);
      parent.set(neighborKey, currentKey);
      open.push({ x, y, f: tentative + Math.abs(tx - x) + Math.abs(ty - y) });
    }
  }
  return [];
}

function log(state, line) {
  return { ...state, logs: [...state.logs, line].slice(-3) };
}

function reveal(map, center, radius, easyReveal = false) {
  const next = { ...map, seen: map.seen ? [...map.seen] : Array(GRID_COLS * GRID_ROWS).fill(0), visible: Array(GRID_COLS * GRID_ROWS).fill(false) };
  for (let y = 0; y < GRID_ROWS; y += 1) {
    for (let x = 0; x < GRID_COLS; x += 1) {
      const d = Math.hypot(x - center.x, y - center.y);
      const cell = idx(x, y);
      if (d <= radius) {
        next.visible[cell] = true;
        next.seen[cell] = 1;
      }
      if (easyReveal && next.crystals.some((crystal) => Math.hypot(x - crystal.x, y - crystal.y) <= 2.2)) next.seen[cell] = 1;
    }
  }
  return next;
}

export function generateGridSurfaceMap(mapIndex = 0, seed = GRID_SEED) {
  const variant = ((Math.floor(mapIndex) % 5) + 5) % 5;
  const random = seededRandom(seed + variant * 271);
  const terrain = Array(GRID_COLS * GRID_ROWS).fill('PLAIN');
  const rockX = 14 + (variant === 0 ? 0 : variant % 2 ? 1 : -1);
  const rockY = 9.5 + (variant === 0 ? 0 : (variant - 2) * 0.3);
  for (let y = 0; y < GRID_ROWS; y += 1) {
    for (let x = 0; x < GRID_COLS; x += 1) {
      if (((x - rockX) / 5.2) ** 2 + ((y - rockY) / 3.6) ** 2 <= 1) terrain[idx(x, y)] = 'ROCK';
      const craterCenters = variant === 0 ? [{ x: 22, y: 5 }, { x: 7, y: 5 }] : [
        { x: 22 - (variant % 2), y: 5 + (variant % 3 === 0 ? 1 : 0) },
        { x: 7 + (variant % 2), y: 5 + (variant % 2) }
      ];
      if (craterCenters.some((c) => (x - c.x) ** 2 + (y - c.y) ** 2 <= 5)) terrain[idx(x, y)] = 'CRATER';
    }
  }
  const mountains = [{ x: 26, y: 15 }, { x: 12, y: 13 }, { x: 12, y: 14 }, { x: 20, y: 12 }, { x: 21, y: 12 }];
  if (variant > 0) {
    for (let n = 0; n < 6 + variant; n += 1) {
      const x = 3 + Math.floor(random() * 24);
      const y = 2 + Math.floor(random() * 16);
      if (terrainAt({ terrain }, x, y) === 'PLAIN' && !mountains.some((m) => m.x === x && m.y === y)
        && !GRID_CRYSTAL_POSITIONS.some((poi) => poi.x === x && poi.y === y)) mountains.push({ x, y });
    }
  }
  for (const mountain of mountains) terrain[idx(mountain.x, mountain.y)] = 'MOUNT';
  for (const crystal of GRID_CRYSTAL_POSITIONS) {
    terrain[idx(crystal.x, crystal.y)] = crystal.id === 'ice-1' || crystal.id === 'ice-2' ? 'CRATER'
      : crystal.id === 'ice-4' ? 'ROCK' : 'PLAIN';
  }
  const start = variant === 1 ? { x: 14, y: 2 } : variant === 2 ? { x: 15, y: 17 } : { x: 14, y: 17 };
  terrain[idx(start.x, start.y)] = 'PLAIN';
  return {
    seed,
    variant,
    label: ['1994 · POLO SUL', '1994 · MAR DE CRATERAS', '1994 · DORSAL DE BASALTO', '1994 · GELO AZUL', '1994 · VALE DO RELÉ'][variant],
    terrain,
    mountains,
    crystals: GRID_CRYSTAL_POSITIONS.map((poi) => ({ ...poi, collected: false })),
    start,
    decorations: Array.from({ length: 90 }, (_, i) => ({ x: Math.floor(random() * GRID_COLS), y: Math.floor(random() * GRID_ROWS), shade: i % 3 }))
  };
}

export function lineOfSightToEarth(map, tile) {
  if (!tile || terrainAt(map, tile.x, tile.y) === 'CRATER') return false;
  for (let y = 0; y < tile.y; y += 1) if (terrainAt(map, tile.x, y) === 'MOUNT') return false;
  return true;
}

function signalAt(map, tile) {
  return lineOfSightToEarth(map, tile);
}

function setDestination(state, tile, automaticAction = '', pendingTransmit = false) {
  const path = findGridPath(state.map, state, tile);
  if (!path.length && (Math.floor(state.x) !== tile.x || Math.floor(state.y) !== tile.y)) {
    return { ...state, logs: [...state.logs, '> CAMINHO BLOQUEADO. CLIQUE EM OUTRA ROTA.'].slice(-3) };
  }
  const next = { ...state, destination: tile, path, automaticAction, pendingTransmit, economy: false, clickPulse: 0.8 };
  return log(next, `> ROTA DEFINIDA · SETOR ${String(tile.x).padStart(2, '0')}-${String(tile.y).padStart(2, '0')}`);
}

export function createPlanetaryState(equipped, difficultyId, missionStats, mapIndex = 0) {
  const map = generateGridSurfaceMap(mapIndex);
  const difficulty = DIFFICULTIES[difficultyId] || DIFFICULTIES.engineer;
  const drill = equipped?.payload === 'advanced';
  const highGain = equipped?.satellite === 'advanced';
  const solar = !highGain;
  let state = {
    map,
    x: map.start.x + 0.5,
    y: map.start.y + 0.5,
    destination: null,
    path: [],
    automaticAction: '',
    speedPercent: 0,
    battery: 100,
    circuits: 100,
    temperature: 20,
    overheated: false,
    economy: false,
    missionTime: 0,
    memory: 0,
    memoryCapacity: drill ? DRILL_MEMORY_CAPACITY : SCANNER_MEMORY_CAPACITY,
    delivered: 0,
    collectionCount: 0,
    payload: drill ? 'advanced' : 'standard',
    antenna: highGain ? 'advanced' : 'standard',
    powerSource: solar ? 'solar' : 'rtg',
    difficultyId,
    drainFactor: difficulty.drain,
    techIndex: missionStats?.techIndex ?? 100,
    techFactor: missionStats?.techFactor ?? 1,
    scienceYield: missionStats?.scienceYield ?? 100,
    scienceThreshold: missionStats?.scienceThreshold ?? SCIENCE_SUCCESS_THRESHOLD,
    budgetSpent: missionStats?.spentCost ?? 0,
    totalMass: missionStats?.totalMass ?? 0,
    activity: null,
    currentTerrain: 'PLAIN',
    signal: true,
    seen: Array(GRID_COLS * GRID_ROWS).fill(0),
    visible: Array(GRID_COLS * GRID_ROWS).fill(false),
    roverBlink: 0,
    clickPulse: 0,
    missionFailed: false,
    failureKind: '',
    failureReason: '',
    missionComplete: false,
    logs: ['> SISTEMAS REATIVADOS.', '> SEED DE SUPERFÍCIE 1994.', '> COLETE 3 AMOSTRAS E TRANSMITA.'],
    stormStarted: false,
    stormImpact: false,
    stormPhase: 'idle',
    stormWaveX: -1
  };
  if (difficultyId === 'beginner') state.map = reveal({ ...state.map, crystals: state.map.crystals }, state, 5, true);
  else state.map = reveal({ ...state.map, crystals: state.map.crystals }, state, 4, false);
  state.seen = state.map.seen;
  state.visible = state.map.visible;
  state.map = { ...state.map, seen: undefined, visible: undefined };
  state.currentTerrain = terrainAt(map, Math.floor(state.x), Math.floor(state.y));
  state.signal = signalAt(map, { x: Math.floor(state.x), y: Math.floor(state.y) });
  return state;
}

export function commandGridMove(state, tileX, tileY) {
  if (state.missionFailed || state.missionComplete) return state;
  const destination = { x: clamp(Math.floor(tileX), 0, GRID_COLS - 1), y: clamp(Math.floor(tileY), 0, GRID_ROWS - 1) };
  return setDestination(state, destination);
}

function nearestCrystal(state, maxDistance = Infinity, discoveredOnly = false) {
  return state.map.crystals
    .filter((crystal) => !crystal.collected && (!discoveredOnly || state.seen[idx(crystal.x, crystal.y)]))
    .map((crystal) => ({ crystal, distance: tileDistance(state, crystal) }))
    .filter((entry) => entry.distance <= maxDistance)
    .sort((a, b) => a.distance - b.distance)[0]?.crystal || null;
}

function beginCollection(state, crystal) {
  if (state.memory >= state.memoryCapacity) return log(state, '> MEMÓRIA CHEIA. TRANSMITA ANTES DE COLETAR.');
  const cost = state.payload === 'advanced' ? DRILL_ENERGY_COST : SCANNER_ENERGY_COST;
  if (state.battery <= cost) return log(state, '> BATERIA INSUFICIENTE PARA COLETAR.');
  const duration = state.payload === 'advanced' ? 3 : 1.5;
  const next = { ...state, activity: { type: 'collect', crystalId: crystal.id, elapsed: 0, duration }, battery: Math.max(0, state.battery - cost), economy: false };
  if (state.payload === 'advanced') next.temperature = Math.min(100, state.temperature + 15);
  return log(next, '> COLETANDO AMOSTRA...');
}

export function commandGridCollect(state) {
  if (state.missionFailed || state.missionComplete || state.activity || state.overheated) return { state, failed: false };
  if (state.techIndex < TECH_DETECTION_MIN_INDEX && nearestCrystal(state, 3.5)) {
    const reason = FAILURE_MESSAGES.lowTech(state.techIndex);
    const failed = { ...state, missionFailed: true, failureKind: 'tech', failureReason: reason };
    return { state: log(failed, '> ERRO DE DETECÇÃO: SCANNER SEM PRECISÃO.'), failed: true, reason };
  }
  const range = state.payload === 'advanced' ? 1.7 : 3.3;
  const close = nearestCrystal(state, range);
  if (close) return { state: beginCollection(state, close), failed: false };
  const difficulty = DIFFICULTIES[state.difficultyId] || DIFFICULTIES.engineer;
  const autoPilot = state.difficultyId !== 'director';
  const target = autoPilot ? nearestCrystal(state, Infinity, true) : null;
  if (target) return { state: setDestination(state, { x: target.x, y: target.y }, target.id), failed: false };
  return { state: log(state, '> NENHUM CRISTAL REVELADO AO ALCANCE. MARQUE UMA ROTA.'), failed: false };
}

export function commandGridTransmit(state) {
  if (state.missionFailed || state.missionComplete || state.activity) return { state, failed: false };
  if (state.memory <= 0) return { state: log(state, '> SEM AMOSTRAS NA MEMÓRIA.'), failed: false };
  if (state.signal) {
    if (state.destination || state.path.length || state.speedPercent > 0) {
      return { state: log(state, '> PARE O ROVER ANTES DE TRANSMITIR.'), failed: false };
    }
    const duration = state.antenna === 'advanced' ? 2 : 10;
    return { state: log({ ...state, activity: { type: 'transmit', elapsed: 0, duration }, economy: false }, '> TRANSMITINDO...'), failed: false };
  }
  if (state.difficultyId === 'director') return { state: log(state, '> SEM SINAL. NAVEGUE MANUALMENTE ATÉ UMA ZONA ABERTA.'), failed: false };
  const safeTiles = []; 
  for (let y = 0; y < GRID_ROWS; y += 1) for (let x = 0; x < GRID_COLS; x += 1) {
    if (state.seen[idx(x, y)] && terrainAt(state.map, x, y) !== 'MOUNT' && lineOfSightToEarth(state.map, { x, y })) safeTiles.push({ x, y });
  }
  const target = safeTiles.sort((a, b) => tileDistance(state, a) - tileDistance(state, b))[0];
  if (!target) return { state: log(state, '> SEM SINAL. NENHUMA ZONA VISÍVEL PARA A TERRA.'), failed: false };
  return { state: setDestination(state, target, '', true), failed: false };
}

export function toggleEconomy(state) {
  if (state.missionFailed || state.missionComplete) return state;
  const economy = !state.economy;
  const next = {
    ...state, economy,
    path: economy ? [] : state.path,
    destination: economy ? null : state.destination,
    automaticAction: economy ? '' : state.automaticAction,
    pendingTransmit: economy ? false : state.pendingTransmit
  };
  return log(next, economy ? '> MODO ECONOMIA ATIVO · SISTEMAS EM REPOUSO.' : '> SISTEMAS REATIVADOS.');
}

function completeActivity(state) {
  const activity = state.activity;
  if (!activity) return state;
  if (activity.type === 'collect') {
    const crystals = state.map.crystals.map((crystal) => crystal.id === activity.crystalId ? { ...crystal, collected: true } : crystal);
    const completedState = { ...state, map: { ...state.map, crystals }, memory: state.memory + 1, collectionCount: state.collectionCount + 1, activity: null };
    return log(completedState, '> AMOSTRA ARMAZENADA EM MEMÓRIA.');
  }
  if (activity.type === 'transmit') {
    const delivered = state.delivered + state.memory;
    const reachesGoal = delivered >= SAMPLE_GOAL;
    const scienceFailure = reachesGoal && state.scienceYield < state.scienceThreshold;
    const completedState = {
      ...state, delivered, memory: 0, activity: null,
      missionComplete: reachesGoal && !scienceFailure,
      missionFailed: scienceFailure,
      failureKind: scienceFailure ? 'science' : state.failureKind,
      failureReason: scienceFailure ? 'RELATÓRIO CIENTÍFICO REPROVADO: RENDIMENTO ABAIXO DO LIMITE.' : state.failureReason
    };
    return log(completedState, completedState.missionComplete ? '> 3 AMOSTRAS CONFIRMADAS NA TERRA.' : scienceFailure ? '> RELATÓRIO REPROVADO · TECH INSUFICIENTE.' : `> PACOTE RECEBIDO · ${delivered}/${SAMPLE_GOAL}.`);
  }
  return { ...state, activity: null };
}

function updateStorm(state, dt) {
  const schedule = DIFFICULTIES[state.difficultyId] || DIFFICULTIES.engineer;
  const warningAt = schedule.stormAt;
  const waveAt = warningAt + schedule.countdown;
  const elapsed = state.missionTime;
  let phase = elapsed < warningAt ? 'idle' : elapsed < waveAt ? 'warning' : elapsed < waveAt + 4 ? 'wave' : 'over';
  let next = { ...state, stormPhase: phase, stormSeconds: phase === 'warning' ? Math.max(0, Math.ceil(waveAt - elapsed)) : 0 };
  if (phase === 'warning' && state.stormPhase !== 'warning') next = log(next, '> ALERTA: TEMPESTADE SOLAR IMINENTE. ATIVE ECONOMIA!');
  if (phase === 'wave') {
    next.stormWaveX = clamp((elapsed - waveAt) / 4, 0, 1) * GRID_COLS;
    if (!state.stormImpact) {
      next.stormImpact = true;
      if (!state.economy) {
        next.battery = Math.max(0, state.battery - 35);
        next.circuits = Math.max(0, state.circuits - 70);
        next = log(next, '> IMPACTO SOLAR! BAT -35 · CIRC -70.');
      } else next = log(next, '> ECONOMIA RESISTIU À TEMPESTA.');
    }
  }
  if (phase === 'over') {
    next.stormImpact = false;
    next.stormWaveX = -1;
  }
  return next;
}

function revealAndSignal(state) {
  const map = reveal({ ...state.map, seen: state.seen, visible: state.visible, crystals: state.map.crystals }, { x: Math.floor(state.x), y: Math.floor(state.y) }, state.difficultyId === 'beginner' ? 5 : 4, false);
  return {
    ...state,
    seen: map.seen,
    visible: map.visible,
    currentTerrain: terrainAt(state.map, Math.floor(state.x), Math.floor(state.y)),
    signal: signalAt(state.map, { x: Math.floor(state.x), y: Math.floor(state.y) })
  };
}

export function advancePlanetaryRover(state, dt) {
  if (state.missionFailed || state.missionComplete) return state;
  const step = clamp(dt, 0, 0.11);
  let next = { ...state, missionTime: state.missionTime + step, roverBlink: state.roverBlink + step, clickPulse: Math.max(0, state.clickPulse - step) };
  const schedule = DIFFICULTIES[state.difficultyId] || DIFFICULTIES.engineer;
  if (state.path.length && !state.economy && !state.overheated) {
    const waypoint = state.path[0];
    const cx = waypoint.x + 0.5;
    const cy = waypoint.y + 0.5;
    const dx = cx - state.x;
    const dy = cy - state.y;
    const distance = Math.hypot(dx, dy) || 1;
    const tile = terrainAt(state.map, Math.floor(state.x), Math.floor(state.y));
    const speed = 3.2 * (tile === 'ROCK' ? ROVER_ROCK_SPEED_FACTOR : 1);
    const moved = Math.min(distance, speed * step);
    next.x = state.x + dx / distance * moved;
    next.y = state.y + dy / distance * moved;
    next.speedPercent = tile === 'ROCK' ? 50 : 100;
    if (distance <= moved + 0.02) {
      next.x = cx;
      next.y = cy;
      next.path = state.path.slice(1);
      if (!next.path.length) {
        next.destination = null;
        next.speedPercent = 0;
        if (next.automaticAction) {
          const crystal = next.map.crystals.find((item) => item.id === next.automaticAction && !item.collected);
          next.automaticAction = '';
          if (crystal) next = beginCollection(next, crystal);
        }
        if (next.pendingTransmit) {
          next.pendingTransmit = false;
          next = { ...next, signal: signalAt(next.map, { x: Math.floor(next.x), y: Math.floor(next.y) }) };
          if (next.signal && next.memory > 0) next.activity = { type: 'transmit', elapsed: 0, duration: next.antenna === 'advanced' ? 2 : 10 };
        }
      }
    }
  } else next.speedPercent = 0;

  const tile = terrainAt(state.map, Math.floor(next.x), Math.floor(next.y));
  const moving = next.speedPercent > 0;
  const easy = state.difficultyId === 'beginner';
  let drain = moving ? tile === 'ROCK' ? 2.4 : 1.2 : state.economy ? 0.05 : 0.1;
  if (tile === 'CRATER' && !state.economy) drain += 2.8;
  if (tile === 'CRATER' && state.economy) drain += 1.4;
  drain *= schedule.drain;
  let generation = state.powerSource === 'rtg' ? 1.2 : tile === 'CRATER' ? 0 : state.economy ? 3.2 : 2.2;
  if (next.activity?.type === 'transmit') drain += 0.8;
  next.battery = clamp(state.battery + (generation - drain) * step, 0, 100);
  if (state.economy) next.temperature = Math.max(0, state.temperature - 18 * step);
  else if (tile === 'ROCK' && moving && !easy) next.temperature = Math.min(100, state.temperature + 9 * step);
  else if (tile !== 'ROCK') next.temperature = Math.max(0, state.temperature - 5 * step);

  if (next.temperature >= 100 && !state.overheated) {
    next.overheated = true;
    next.circuits = Math.max(0, next.circuits - 10);
    next.path = [];
    next.destination = null;
    next = log(next, '> MOTORES SUPERAQUECIDOS · CIRC -10. ATIVE ECONOMIA.');
  }
  if (next.overheated && state.economy && next.temperature <= 40) {
    next.overheated = false;
    next = log(next, '> MOTORES RESFRIADOS · ROVER LIBERADO.');
  }

  if (next.activity) {
    next.activity = { ...next.activity, elapsed: next.activity.elapsed + step };
    if (next.activity.elapsed >= next.activity.duration) next = completeActivity(next);
  }
  next = updateStorm(next, step);
  next = revealAndSignal(next);
  if (next.battery <= 0) {
    next.missionFailed = true;
    next.failureKind = 'energy';
    next.failureReason = 'BATERIA ESGOTADA: O ROVER CONGELOU.';
    next = log(next, '> BAT 0% · ROVER CONGELADO.');
  } else if (next.circuits <= 0) {
    next.missionFailed = true;
    next.failureKind = 'circuits';
    next.failureReason = 'CIRCUITOS DESTRUÍDOS.';
    next = log(next, '> CIRC 0% · SISTEMAS PERDIDOS.');
  }
  return next;
}

export function getGridMissionReport(state) {
  return {
    success: state.missionComplete,
    failed: state.missionFailed,
    failureKind: state.failureKind,
    failureReason: state.failureReason,
    delivered: state.delivered,
    collected: state.collectionCount,
    technologyIndex: state.techIndex,
    scienceYield: state.scienceYield,
    battery: Math.round(state.battery),
    circuits: Math.round(state.circuits),
    missionTime: Math.floor(state.missionTime),
    mapLabel: state.map.label
  };
}
