/**
 * Pure 2D lunar RTS rules: click-to-move, terrain, rover survival, samples and radio.
 * Rendering and input stay in the app/surfaceRenderer shell.
 */
import { SCIENCE_SUCCESS_THRESHOLD, TECH_DETECTION_MIN_INDEX } from './missionState.js';
import { FAILURE_MESSAGES } from './failureMessages.js';

export const WORLD_WIDTH = 1600;
export const WORLD_HEIGHT = 1200;
export const MAP_VIEW_WIDTH = 720;
export const MAP_VIEW_HEIGHT = 870;
export const PURGE_BATTERY_COST = 15;
export const PURGE_MIN_TEMPERATURE = 55;
export const MOTOR_MAX_TEMPERATURE = 100;
export const MOTOR_COOL_RESUME_TEMPERATURE = 55;
export const ROVER_SPEED_NORMAL = 82;
export const ROVER_SPEED_OVERDRIVE = 148;
export const ROVER_ROCK_SPEED_FACTOR = 0.55;
export const SOLAR_STANDBY_CHARGE_PER_SECOND = 1.5;
export const SCANNER_SAMPLE_UNITS = 1;
export const DRILL_SAMPLE_UNITS = 2;
export const SCANNER_MEMORY_CAPACITY = 3;
export const DRILL_MEMORY_CAPACITY = 6;
export const SCANNER_ENERGY_COST = 8;
export const DRILL_ENERGY_COST = 15;
export const DISCOVERY_RADIUS = 235;
export const SAMPLE_RADIUS = 74;
export const MISSION_CRYSTAL_COUNT = 4;
export const SURFACE_MAP_COUNT = 5;
const MAP_LAYOUTS = [
  {
    id: 'sunrise-basin', label: 'BACIA DO AMANHECER', palette: '#ffd27b',
    start: { x: 190, y: 190 }, relay: { x: 270, y: 930 },
    shadowZones: [{ x: 780, y: 310, rx: 270, ry: 255 }, { x: 760, y: 885, rx: 250, ry: 240 }],
    rockZones: [{ x: 1020, y: 210, w: 520, h: 420 }, { x: 1000, y: 735, w: 535, h: 410 }],
    crystals: [{ id: 'ice-1', x: 390, y: 270 }, { id: 'ice-2', x: 760, y: 310 }, { id: 'ice-3', x: 1195, y: 430 }, { id: 'ice-4', x: 1390, y: 960 }]
  },
  {
    id: 'crater-sea', label: 'MAR DE CRATERAS', palette: '#9ab8ff',
    start: { x: 220, y: 1010 }, relay: { x: 270, y: 950 },
    shadowZones: [{ x: 520, y: 350, rx: 220, ry: 270 }, { x: 1170, y: 820, rx: 250, ry: 230 }],
    rockZones: [{ x: 880, y: 280, w: 500, h: 300 }, { x: 360, y: 650, w: 460, h: 240 }],
    crystals: [{ id: 'ice-1', x: 350, y: 900 }, { id: 'ice-2', x: 720, y: 300 }, { id: 'ice-3', x: 1130, y: 520 }, { id: 'ice-4', x: 1430, y: 1080 }]
  },
  {
    id: 'basalt-ridge', label: 'DORSAL DE BASALTO', palette: '#f0aa75',
    start: { x: 210, y: 170 }, relay: { x: 250, y: 910 },
    shadowZones: [{ x: 1100, y: 250, rx: 260, ry: 240 }, { x: 520, y: 850, rx: 260, ry: 240 }],
    rockZones: [{ x: 620, y: 330, w: 400, h: 350 }, { x: 1050, y: 690, w: 490, h: 430 }],
    crystals: [{ id: 'ice-1', x: 360, y: 280 }, { id: 'ice-2', x: 780, y: 530 }, { id: 'ice-3', x: 1310, y: 470 }, { id: 'ice-4', x: 1370, y: 1000 }]
  },
  {
    id: 'blue-ice-shelf', label: 'PRATELEIRA DE GELO', palette: '#65d7ed',
    start: { x: 220, y: 670 }, relay: { x: 270, y: 960 },
    shadowZones: [{ x: 540, y: 240, rx: 250, ry: 220 }, { x: 1020, y: 650, rx: 260, ry: 300 }],
    rockZones: [{ x: 720, y: 180, w: 450, h: 260 }, { x: 230, y: 900, w: 520, h: 200 }],
    crystals: [{ id: 'ice-1', x: 360, y: 680 }, { id: 'ice-2', x: 650, y: 440 }, { id: 'ice-3', x: 1260, y: 590 }, { id: 'ice-4', x: 1400, y: 1030 }]
  },
  {
    id: 'relay-valley', label: 'VALE DO RELÉ', palette: '#e6b7ff',
    start: { x: 180, y: 180 }, relay: { x: 300, y: 930 },
    shadowZones: [{ x: 680, y: 500, rx: 300, ry: 260 }, { x: 1260, y: 900, rx: 230, ry: 260 }],
    rockZones: [{ x: 930, y: 210, w: 530, h: 330 }, { x: 720, y: 820, w: 450, h: 250 }],
    crystals: [{ id: 'ice-1', x: 400, y: 250 }, { id: 'ice-2', x: 760, y: 700 }, { id: 'ice-3', x: 1150, y: 420 }, { id: 'ice-4', x: 1400, y: 1050 }]
  }
];

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const distanceBetween = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function mapIndexFromSeed(seed) {
  if (Number.isFinite(seed)) return Math.abs(Math.floor(seed)) % SURFACE_MAP_COUNT;
  let hash = 0;
  for (const char of String(seed ?? '0')) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return Math.abs(hash) % SURFACE_MAP_COUNT;
}

export function generateSurfaceMap(seed = 0) {
  const source = MAP_LAYOUTS[mapIndexFromSeed(seed)];
  const shadowZones = source.shadowZones.map((zone) => ({ ...zone }));
  const rockZones = source.rockZones.map((zone) => ({ ...zone }));
  const rockDecorations = rockZones.flatMap((zone, zoneIndex) => [
    { x: zone.x + zone.w * 0.23, y: zone.y + zone.h * 0.28, size: 90 },
    { x: zone.x + zone.w * 0.68, y: zone.y + zone.h * 0.34, size: 108 },
    { x: zone.x + zone.w * 0.46, y: zone.y + zone.h * 0.73, size: 96 + zoneIndex * 8 }
  ]);
  return {
    id: source.id,
    label: source.label,
    palette: source.palette,
    start: { ...source.start },
    relay: { ...source.relay },
    shadowZones,
    rockZones,
    rockDecorations,
    crystals: source.crystals.map((crystal) => ({ ...crystal }))
  };
}

const DEFAULT_MAP = generateSurfaceMap(0);

export function getTerrainAt(pointOrX, optionalY, map = DEFAULT_MAP) {
  const point = typeof pointOrX === 'number' ? { x: pointOrX, y: optionalY ?? 0 } : pointOrX;
  const inEllipse = (zone) => ((point.x - zone.x) / zone.rx) ** 2 + ((point.y - zone.y) / zone.ry) ** 2 <= 1;
  const inRect = (zone) => point.x >= zone.x && point.x <= zone.x + zone.w && point.y >= zone.y && point.y <= zone.y + zone.h;
  if (map.shadowZones.some(inEllipse)) return { id: 'shadow', label: 'CRATERA ESCURA', heatRate: -2.1, signal: false };
  if (map.rockZones.some(inRect)) return { id: 'rocks', label: 'CAMPO DE ROCHAS', heatRate: 2.25, signal: true };
  return { id: 'sunlight', label: 'PLANÍCIE ILUMINADA', heatRate: 0.22, signal: true };
}

export function createRoverState(payload = 'standard', mapOrSeed = 0, science = null) {
  const isDrill = payload === 'advanced' || payload === 'drill';
  const techIndex = Number.isFinite(science?.techIndex) ? science.techIndex : 100;
  const techFactor = Number.isFinite(science?.techFactor) ? science.techFactor : 1;
  const sensorBlocked = techIndex < TECH_DETECTION_MIN_INDEX;
  const map = mapOrSeed && typeof mapOrSeed === 'object' && Array.isArray(mapOrSeed.shadowZones)
    ? mapOrSeed
    : generateSurfaceMap(mapOrSeed);
  const start = { ...map.start };
  const terrain = getTerrainAt(start, undefined, map);
  return {
    map,
    x: start.x,
    y: start.y,
    heading: 0,
    speed: 0,
    target: null,
    battery: 100,
    temperature: 32,
    peakTemperature: 32,
    terrainId: terrain.id,
    signal: terrain.signal,
    overdrive: false,
    standby: false,
    forcedStandby: false,
    purgeCooldown: 0,
    purgePulse: 0,
    purgeCount: 0,
    samplePulse: 0,
    transmitPulse: 0,
    event: '',
    elapsed: 0,
    batteryStallTime: 0,
    payload: isDrill ? 'advanced' : 'standard',
    techIndex,
    techFactor,
    sensorBlocked,
    sensorRange: sensorBlocked ? 0 : DISCOVERY_RADIUS * techFactor,
    scienceYield: Number.isFinite(science?.scienceYield) ? science.scienceYield : SCIENCE_SUCCESS_THRESHOLD,
    scienceThreshold: science?.scienceThreshold ?? SCIENCE_SUCCESS_THRESHOLD,
    failureKind: '',
    scienceSuccess: false,
    scienceFailureReason: '',
    memoryCapacity: isDrill ? DRILL_MEMORY_CAPACITY : SCANNER_MEMORY_CAPACITY,
    memory: 0,
    dataTransmitted: 0,
    crystals: map.crystals.map((crystal) => ({ ...crystal, discovered: false, collected: false })),
    zonesVisited: [terrain.id],
    tracks: [{ x: start.x, y: start.y, time: 0 }],
    trackDistance: 0,
    completed: false,
    failed: false,
    failureReason: ''
  };
}

export function getCameraTarget(rover, viewportWidth = MAP_VIEW_WIDTH, viewportHeight = MAP_VIEW_HEIGHT) {
  return {
    x: clamp(rover.x - viewportWidth / 2, 0, Math.max(0, WORLD_WIDTH - viewportWidth)),
    y: clamp(rover.y - viewportHeight / 2, 0, Math.max(0, WORLD_HEIGHT - viewportHeight))
  };
}

export function setRoverDestination(state, point) {
  if (state.completed || state.failed || state.forcedStandby || state.battery <= 0) return state;
  const target = {
    x: clamp(Number(point?.x) || 0, 0, WORLD_WIDTH),
    y: clamp(Number(point?.y) || 0, 0, WORLD_HEIGHT)
  };
  return { ...state, target, standby: false, event: 'destination' };
}

export function setStandby(state, active) {
  if (state.completed || state.failed || state.forcedStandby) return state;
  return {
    ...state,
    standby: Boolean(active),
    target: active ? null : state.target,
    speed: active ? 0 : state.speed,
    event: active ? 'standby' : 'standby-off'
  };
}

export function setOverdrive(state, active) {
  if (state.completed || state.failed) return state;
  return { ...state, overdrive: Boolean(active), event: active ? 'overdrive' : 'overdrive-off' };
}

function revealNearbyCrystals(crystals, rover, range = DISCOVERY_RADIUS) {
  return crystals.map((crystal) => ({
    ...crystal,
    discovered: crystal.discovered || distanceBetween(crystal, rover) <= range
  }));
}

export function advanceRover(state, input = {}, dt = 1 / 60) {
  if (state.completed || state.failed) return state;
  const step = clamp(Number(dt) || 0, 0, 0.11);
  if (!step) return state;

  const next = {
    ...state,
    purgeCooldown: Math.max(0, state.purgeCooldown - step),
    purgePulse: Math.max(0, state.purgePulse - step),
    samplePulse: Math.max(0, state.samplePulse - step),
    transmitPulse: Math.max(0, state.transmitPulse - step),
    elapsed: state.elapsed + step,
    event: state.event === 'destination' || state.event === 'sample' || state.event === 'transmit' ? state.event : ''
  };
  let forcedStandby = Boolean(state.forcedStandby && state.temperature > MOTOR_COOL_RESUME_TEMPERATURE);
  const overdrive = Boolean(input.overdrive || state.overdrive);
  const userStandby = Boolean(state.standby);
  const isStopped = forcedStandby || userStandby || state.battery <= 0;
  let x = state.x;
  let y = state.y;
  let heading = state.heading;
  let speed = 0;
  let moved = 0;
  const terrainBefore = getTerrainAt(state.x, state.y, state.map);
  const massFactor = clamp(Number(input.massFactor) || 1, 0.8, 2.1);

  if (!isStopped && state.target) {
    const dx = state.target.x - state.x;
    const dy = state.target.y - state.y;
    const distance = Math.hypot(dx, dy);
    if (distance <= 3) {
      next.target = null;
    } else {
      const baseSpeed = overdrive ? ROVER_SPEED_OVERDRIVE : ROVER_SPEED_NORMAL;
      const terrainFactor = terrainBefore.id === 'rocks' ? ROVER_ROCK_SPEED_FACTOR : 1;
      const maxSpeed = baseSpeed * terrainFactor / Math.sqrt(massFactor);
      moved = Math.min(distance, maxSpeed * step);
      x = clamp(state.x + (dx / distance) * moved, 0, WORLD_WIDTH);
      y = clamp(state.y + (dy / distance) * moved, 0, WORLD_HEIGHT);
      heading = Math.atan2(dy, dx) + Math.PI / 2;
      speed = moved / step;
      if (distance <= moved + 2) next.target = null;
    }
  }

  const terrain = getTerrainAt(x, y, state.map);
  const moving = moved > 0;
  const stopped = forcedStandby || userStandby || state.battery <= 0;
  const solarGain = terrain.id === 'sunlight' ? (stopped ? SOLAR_STANDBY_CHARGE_PER_SECOND : 0.12) : 0;
  let batteryDrain = stopped ? (terrain.id === 'shadow' ? 0.28 : 0.08) : 0.10;
  if (moving) batteryDrain += (0.34 + (overdrive ? 0.68 : 0)) * massFactor;
  if (terrain.id === 'shadow') batteryDrain += moving ? 1.0 : 0.34;
  if (terrain.id === 'rocks') batteryDrain += moving ? 0.42 + massFactor * 0.15 : 0.12;
  const battery = clamp(state.battery + (solarGain - batteryDrain) * step, 0, 100);

  let thermalRate = terrain.heatRate;
  if (moving && terrain.id === 'rocks') thermalRate += 1.75 * massFactor;
  else if (moving) thermalRate += 0.3 * massFactor;
  if (overdrive && moving) thermalRate += 4.4 * massFactor;
  if (stopped) thermalRate -= terrain.id === 'shadow' ? 1.1 : 1.45;
  let temperature = clamp(state.temperature + thermalRate * step, 0, MOTOR_MAX_TEMPERATURE);
  if (state.forcedStandby) temperature = clamp(temperature - 1.2 * step, 0, MOTOR_MAX_TEMPERATURE);

  next.x = x;
  next.y = y;
  next.heading = heading;
  next.speed = speed;
  next.battery = battery;
  next.temperature = temperature;
  next.peakTemperature = Math.max(state.peakTemperature ?? state.temperature, temperature);
  next.terrainId = terrain.id;
  next.signal = terrain.signal || distanceBetween({ x, y }, state.map.relay) <= 150;
  next.forcedStandby = forcedStandby;
  next.zonesVisited = state.zonesVisited.includes(terrain.id) ? state.zonesVisited : [...state.zonesVisited, terrain.id];
  next.crystals = revealNearbyCrystals(state.crystals, { x, y }, state.sensorRange ?? DISCOVERY_RADIUS);

  if (moving) {
    next.trackDistance = state.trackDistance + moved;
    if (next.trackDistance >= 18) {
      next.tracks = [...state.tracks, { x, y, time: next.elapsed }].slice(-360);
      next.trackDistance %= 18;
    }
  }

  if (temperature >= MOTOR_MAX_TEMPERATURE && !forcedStandby) {
    next.forcedStandby = true;
    next.target = null;
    next.speed = 0;
    next.event = 'overheat';
    forcedStandby = true;
  } else if (state.forcedStandby && temperature <= MOTOR_COOL_RESUME_TEMPERATURE) {
    next.forcedStandby = false;
    next.event = 'cooled';
  }

  if (battery <= 0 && terrain.id !== 'sunlight') {
    next.batteryStallTime = state.batteryStallTime + step;
    next.target = null;
    next.speed = 0;
    if (next.batteryStallTime >= 6) {
      next.failed = true;
      next.failureReason = 'A bateria zerou longe da luz solar; rover sem potência para continuar.';
      next.failureKind = 'energy';
    }
  } else {
    next.batteryStallTime = 0;
  }

  if (battery <= 0 && terrain.id === 'sunlight') {
    next.target = null;
    next.speed = 0;
  }
  return next;
}

export function findNearbyCrystal(state, radius = SAMPLE_RADIUS) {
  return state.crystals
    .filter((crystal) => !crystal.collected && distanceBetween(crystal, state) <= radius)
    .sort((a, b) => distanceBetween(a, state) - distanceBetween(b, state))[0] || null;
}

export function collectIceSample(state, payload = state.payload) {
  if (state.completed || state.failed) return { state, collected: false, reason: 'A missão já terminou.' };
  const crystal = findNearbyCrystal(state);
  if (!crystal) return { state, collected: false, reason: 'Aproxime o rover de um cristal de gelo.' };
  if (state.techIndex < TECH_DETECTION_MIN_INDEX) {
    const failureReason = FAILURE_MESSAGES.lowTech(state.techIndex);
    return {
      state: { ...state, failed: true, failureKind: 'tech', failureReason, target: null, speed: 0 },
      collected: false,
      failed: true,
      reason: failureReason
    };
  }
  const drill = payload === 'advanced' || payload === 'drill';
  const amount = drill ? DRILL_SAMPLE_UNITS : SCANNER_SAMPLE_UNITS;
  const energyCost = drill ? DRILL_ENERGY_COST : SCANNER_ENERGY_COST;
  const heatCost = drill ? 14 : 7;
  if (state.memory + amount > state.memoryCapacity) {
    return { state, collected: false, reason: 'Memória cheia. Transmita os dados na luz antes de coletar.' };
  }
  if (state.battery < energyCost) return { state, collected: false, reason: 'Bateria insuficiente para coletar a amostra.' };
  const next = {
    ...state,
    crystals: state.crystals.map((item) => item.id === crystal.id ? { ...item, discovered: true, collected: true } : item),
    memory: state.memory + amount,
    battery: state.battery - energyCost,
    temperature: clamp(state.temperature + heatCost, 0, 100),
    peakTemperature: Math.max(state.peakTemperature ?? state.temperature, clamp(state.temperature + heatCost, 0, 100)),
    samplePulse: 1.2,
    event: 'sample'
  };
  return { state: next, collected: true, amount, reason: drill ? 'Amostra profunda armazenada.' : 'Amostra de gelo armazenada.' };
}

export function canTransmitData(state) {
  if (!state.signal) return { allowed: false, reason: 'Sem sinal no fundo da cratera.' };
  if (state.memory <= 0) return { allowed: false, reason: 'Nenhuma amostra na memória.' };
  return { allowed: true, reason: 'Canal orbital liberado.' };
}

export function transmitIceSamples(state) {
  const availability = canTransmitData(state);
  if (!availability.allowed) return { state, transmitted: false, reason: availability.reason };
  const transmitted = state.memory;
  const dataTransmitted = state.dataTransmitted + transmitted;
  const allCollected = state.crystals.every((crystal) => crystal.collected);
  const unitsPerCrystal = state.payload === 'advanced' ? DRILL_SAMPLE_UNITS : SCANNER_SAMPLE_UNITS;
  const completed = allCollected && dataTransmitted >= state.crystals.length * unitsPerCrystal;
  const scienceFailed = completed && Number.isFinite(state.scienceYield) && state.scienceYield < state.scienceThreshold;
  const next = {
    ...state,
    memory: 0,
    dataTransmitted,
    transmitPulse: 1.5,
    event: 'transmit',
    completed: completed && !scienceFailed,
    failed: scienceFailed,
    failureKind: scienceFailed ? 'science' : state.failureKind,
    failureReason: scienceFailed ? FAILURE_MESSAGES.lowScience : state.failureReason
  };
  return { state: next, transmitted, reason: 'Dados transmitidos ao satélite.' };
}

export function abortMission(state) {
  if (state.completed || state.failed) return state;
  const techCause = Boolean(state.sensorBlocked);
  return {
    ...state,
    failed: true,
    target: null,
    speed: 0,
    failureKind: techCause ? 'tech' : 'abort',
    failureReason: techCause
      ? FAILURE_MESSAGES.lowTech(state.techIndex)
      : 'Missão encerrada antes de coletar e transmitir todas as amostras.',
    event: 'aborted'
  };
}

export function getMissionReport(state) {
  const collected = state.crystals.filter((crystal) => crystal.collected).length;
  return {
    mapLabel: state.map.label,
    mapId: state.map.id,
    success: Boolean(state.completed),
    failureKind: state.failed ? state.failureKind || 'abort' : '',
    failureReason: state.failed ? state.failureReason : '',
    crystalsCollected: collected,
    crystalsTotal: state.crystals.length,
    crystalsMissing: state.crystals.length - collected,
    dataTransmitted: state.dataTransmitted,
    dataInMemory: state.memory,
    purgeCount: state.purgeCount,
    batteryRemaining: Math.round(state.battery),
    peakTemperature: Math.round(state.peakTemperature ?? state.temperature),
    elapsedSeconds: Math.floor(state.elapsed),
    zonesVisited: [...state.zonesVisited],
    techIndex: state.techIndex,
    scienceYield: state.scienceYield,
    scienceThreshold: state.scienceThreshold
  };
}

export function activateEmergencyPurge(state) {
  if (state.completed || state.failed) return { state, used: false, reason: 'A missão já terminou.' };
  if (state.purgeCooldown > 0) return { state, used: false, reason: 'Purga recarregando.' };
  if (state.temperature < PURGE_MIN_TEMPERATURE) return { state, used: false, reason: 'Motor estável; guarde a purga para uma emergência.' };
  if (state.battery < PURGE_BATTERY_COST) return { state, used: false, reason: 'Bateria insuficiente para a purga.' };
  return {
    used: true,
    reason: 'Purga de emergência: motores resfriados.',
    state: {
      ...state,
      temperature: 0,
      battery: state.battery - PURGE_BATTERY_COST,
      purgeCooldown: 1.2,
      purgePulse: 1,
      purgeCount: state.purgeCount + 1,
      forcedStandby: false,
      event: 'purge'
    }
  };
}

export function getGuideCue(state) {
  const terrain = state.terrainId || getTerrainAt(state, undefined, state.map || DEFAULT_MAP).id;
  if (state.completed) return { mood: 'happy', text: 'Amostras transmitidas! A ciência chegou em casa; minha piada também.' };
  if (state.failed) return { mood: 'panic', text: state.failureReason || 'Sem energia. A missão parou por aqui.' };
  if (state.transmitPulse > 0.25) return { mood: 'happy', text: 'Pacote recebido pelo satélite! A ciência atravessou a cratera.' };
  if (state.samplePulse > 0.25) return { mood: 'happy', text: state.payload === 'advanced' ? 'Perfuratriz coletou uma amostra profunda. Memória subindo!' : 'Scanner coletou gelo. Amostra guardada na memória.' };
  if (state.purgePulse > 0.25) return { mood: 'happy', text: 'Purga total! Motor a zero; a bateria pagou a rodada.' };
  if (state.forcedStandby) return { mood: 'panic', text: 'Motores travados para resfriar. Já volto a andar quando baixar.' };
  if (state.memory >= state.memoryCapacity) return { mood: 'worried', text: 'Memória cheia. Volte à luz e transmita antes de coletar mais.' };
  if (state.temperature >= 82) return { mood: 'panic', text: 'Calor crítico! Solte o turbo ou use a purga de emergência.' };
  if (state.battery <= 18) return { mood: 'panic', text: `Bateria em ${Math.ceil(state.battery)}%. Procure a planície iluminada.` };
  if (!state.signal) return { mood: 'worried', text: 'Sem sinal nesta cratera. Saia da sombra para enviar os dados.' };
  if (state.battery <= 34) return { mood: 'worried', text: `Só ${Math.ceil(state.battery)}% de bateria. O turbo cobra caro.` };
  if (state.overdrive && state.speed > 0) return { mood: 'happy', text: 'Overdrive ligado! Rápido, sim; econômico, nem um pouco.' };
  if (terrain === 'shadow') return { mood: 'worried', text: 'Sombra profunda: sem recarga solar e sem rádio.' };
  if (terrain === 'rocks') return { mood: 'worried', text: 'Campo de rochas: devagar e de olho na temperatura.' };
  if (state.standby) return { mood: 'calm', text: 'Standby: rover quieto, painéis trabalhando. Belo descanso.' };
  return { mood: 'calm', text: 'Toque no terreno para traçar a rota. Os cristais revelam-se ao chegar perto.' };
}
