/**
 * Main runtime controller for Orbital Architect: Mission Design.
 * Handles difficulty/CML selection, progressive labs, launch validation, lunar rover
 * exploration, live thermal/battery controls, and keeps Edit mode free of gameplay.
 */
import { DEFAULT_EQUIPPED, MODULE_CATEGORIES } from '../core/catalog.js';
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  getAssemblyLayout,
  getDifficultyCardRects,
  hitTestAssembly,
  hitTestSurfaceControl,
  pointInRect,
  SURFACE_GUIDE_RECT,
  SURFACE_HUD_RECT,
  SURFACE_MAP_VIEW,
  SURFACE_MINIMAP_RECT,
  SURFACE_RESULT_RECTS,
  TITLE_MENU_RECTS,
  OPTIONS_DIFFICULTY_RECTS,
  TITLE_BACK_RECT,
  DIFFICULTY_BACK_RECT,
  MANUAL_PREV_RECT,
  MANUAL_NEXT_RECT
} from '../core/layout.js';
import {
  computeMissionStats,
  getCategoryByOffset,
  normalizeEquipped,
  selectModuleOption
} from '../core/missionState.js';
import {
  evaluateComponentChoice,
  evaluateEngineeringTest,
  evaluateLaunch,
  getDifficultyPreset
} from '../core/missionRules.js';
import { MISSION_MANUAL_PAGE_COUNT } from '../core/manualContent.js';
import { getLaunchRoast } from '../core/failureMessages.js';
import {
  createPlanetaryState,
  commandGridMove,
  commandGridCollect,
  commandGridTransmit,
  toggleEconomy,
  advancePlanetaryRover,
  GRID_MAP_X,
  GRID_MAP_Y,
  GRID_TILE_SIZE,
  GRID_COLS,
  GRID_ROWS
} from '../core/planetaryGridRules.js';
import { emitLaunchParticles, updateLaunchParticles } from './launchParticles.js';
import { loadGameArt } from '../render/artAssets.js';
import { renderFrame } from '../render/sceneRenderer.js';
import { renderLandscapeSurfaceFrame, LANDSCAPE_SURFACE_CONTROL_RECTS, LANDSCAPE_SURFACE_RESULT_RECTS } from '../render/planetarySurfaceRenderer.js';

let activeCleanup = null;

function ensureConfigDefaults(editMode = false) {
  const source = window.gameConfig || {};
  const cfg = {
    ...source,
    budgetMax: Number.isFinite(source.budgetMax) ? source.budgetMax : 350,
    padPos: source.padPos && Number.isFinite(source.padPos.x) && Number.isFinite(source.padPos.y)
      ? { x: source.padPos.x, y: source.padPos.y }
      : { x: 360, y: 430 },
    vehicleScale: Number.isFinite(source.vehicleScale) ? source.vehicleScale : 1.0,
    selectedCategory: MODULE_CATEGORIES.some((category) => category.id === source.selectedCategory)
      ? source.selectedCategory
      : 'propulsion',
    difficultyId: source.difficultyId || 'engineer',
    equipped: normalizeEquipped(source.equipped || DEFAULT_EQUIPPED)
  };
  // Play reads creator config only; Edit mode owns any config normalization/writes.
  if (editMode) window.gameConfig = cfg;
  return cfg;
}

function getCanvasPoint(canvas, clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (clientX - rect.left) * canvas.width / Math.max(1, rect.width),
    y: (clientY - rect.top) * canvas.height / Math.max(1, rect.height)
  };
}

export function startApp(mode) {
  if (activeCleanup) {
    activeCleanup();
    activeCleanup = null;
  }

  const canvas = document.getElementById('game-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const gameMode = mode === 'edit' ? 'edit' : 'play';
  const cfg = ensureConfigDefaults(gameMode === 'edit');
  const builtForEditor = gameMode === 'edit' ? MODULE_CATEGORIES.map((category) => category.id) : [];
  const state = {
    mode: gameMode,
    screen: gameMode === 'edit' ? 'base' : 'title',
    titleSelection: 0,
    optionsSelection: 0,
    manualPage: 0,
    difficultyId: gameMode === 'edit' ? cfg.difficultyId : 'engineer',
    budgetMax: cfg.budgetMax,
    padPos: { x: cfg.padPos.x, y: cfg.padPos.y },
    vehicleScale: cfg.vehicleScale,
    selectedCategory: cfg.selectedCategory,
    equipped: normalizeEquipped(cfg.equipped),
    builtLabs: builtForEditor,
    testCompleted: false,
    testCostSpent: 0,
    testResult: null,
    launchStartedAt: 0,
    launchLiftY: 0,
    launchResult: null,
    resultKind: null,
    rover: null,
    roverMassFactor: 1,
    camera: { x: 0, y: 0 },
    abortConfirmUntil: 0,
    surfaceResult: null,
    particles: [],
    particleAccumulator: 0,
    statusMessage: '',
    swapPulse: null,
    art: {},
    fullscreenLandscape: false,
    fullscreenErrorUntil: 0
  };

  const portraitCanvas = document.createElement('canvas');
  portraitCanvas.width = 720;
  portraitCanvas.height = 1280;
  const portraitCtx = portraitCanvas.getContext('2d');

  let appAlive = true;
  const assetGetter = typeof lib !== 'undefined' && typeof lib.getAsset === 'function'
    ? (id) => lib.getAsset(id)
    : null;
  loadGameArt(assetGetter).then((art) => {
    if (appAlive) state.art = art;
  });

  let simTime = 0;
  let audioContext = null;
  let lastTimestamp = performance.now();
  let rafId = 0;
  let dragState = null;
  const heldKeys = new Set();
  let engineHapticsActive = false;
  let surfaceRunCount = 0;

  function unlockAudio() {
    if (state.mode !== 'play') return;
    const AudioContextType = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextType) return;
    if (!audioContext) audioContext = new AudioContextType();
    if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
  }

  function playStormAlarm() {
    if (!audioContext || audioContext.state !== 'running') return;
    const startAt = audioContext.currentTime + 0.015;
    for (let i = 0; i < 3; i += 1) {
      const start = startAt + i * 0.28;
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = 'square';
      oscillator.frequency.setValueAtTime(i === 1 ? 660 : 880, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.035, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.16);
      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.17);
    }
  }

  const fullscreenSupported = !!document.documentElement.requestFullscreen; // iPhone/Safari não suporta

  function fullscreenButtonRect() {
    const wide = state.fullscreenLandscape;
    return { x: (wide ? 1280 : 720) - (wide ? 166 : 160), y: 7, w: wide ? 154 : 148, h: 30 };
  }

  function drawFullscreenButton(targetCtx) {
    if (!fullscreenSupported) return;
    const rect = fullscreenButtonRect();
    const blocked = state.fullscreenErrorUntil > simTime;
    targetCtx.save();
    targetCtx.fillStyle = blocked ? '#492528' : '#132a37';
    targetCtx.strokeStyle = blocked ? '#ff6868' : '#65d7e5';
    targetCtx.lineWidth = 2;
    targetCtx.fillRect(rect.x, rect.y, rect.w, rect.h);
    targetCtx.strokeRect(rect.x, rect.y, rect.w, rect.h);
    targetCtx.font = 'bold 11px monospace';
    targetCtx.textAlign = 'center';
    targetCtx.textBaseline = 'middle';
    targetCtx.fillStyle = blocked ? '#ffd0c9' : '#d9f5f2';
    targetCtx.fillText(blocked ? 'BLOQUEADO' : document.fullscreenElement ? 'SAIR TELA CHEIA' : 'TELA CHEIA', rect.x + rect.w / 2, rect.y + rect.h / 2);
    targetCtx.restore();
  }

  function portraitPointFromWide(point) {
    const scale = 0.5625;
    const left = (1280 - 720 * scale) / 2;
    if (point.x < left || point.x > left + 720 * scale || point.y < 0 || point.y > 720) return null;
    return { x: (point.x - left) / scale, y: point.y / scale };
  }

  function drawWidePortraitFrame(stats) {
    renderFrame(portraitCtx, state, stats, simTime);
    ctx.fillStyle = '#070c14';
    ctx.fillRect(0, 0, 1280, 720);
    for (let i = 0; i < 72; i += 1) {
      const x = (i * 191 + 47) % 1280;
      const y = (i * 83 + 19) % 720;
      ctx.fillStyle = i % 4 === 0 ? 'rgba(115,219,238,0.5)' : 'rgba(148,174,195,0.28)';
      ctx.fillRect(x, y, i % 5 === 0 ? 2 : 1, i % 5 === 0 ? 2 : 1);
    }
    ctx.fillStyle = '#101a27'; ctx.fillRect(20, 80, 398, 560); ctx.strokeStyle = '#315266'; ctx.strokeRect(20, 80, 398, 560);
    ctx.fillStyle = '#101a27'; ctx.fillRect(862, 80, 398, 560); ctx.strokeStyle = '#315266'; ctx.strokeRect(862, 80, 398, 560);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(portraitCanvas, 437.5, 0, 405, 720);
    ctx.strokeStyle = '#4a7185'; ctx.lineWidth = 2; ctx.strokeRect(437.5, 0, 405, 720);
    const write = (value, x, y, color = '#c7d6df', size = 15, weight = 'normal') => {
      ctx.font = `${weight} ${size}px monospace`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = color; ctx.fillText(value, x, y);
    };
    write('MISSION CONTROL', 44, 112, '#78e4ef', 14, 'bold');
    write('STARFORGE', 44, 150, '#f0d27d', 18, 'bold');
    write('1994 · POLO SUL LUNAR', 44, 179, '#9fb7c6', 12);
    write(`TELA: ${state.screen.toUpperCase()}`, 44, 234, '#b9d8e2', 12, 'bold');
    write('C  COLETAR AMOSTRA', 44, 292, '#c7d6df', 12);
    write('T  TRANSMITIR DADOS', 44, 326, '#c7d6df', 12);
    write('S  MODO ECONOMIA', 44, 360, '#c7d6df', 12);
    write('M / CLIQUE  DEFINIR ROTA', 44, 394, '#c7d6df', 12);
    write('AMOSTRAS: 3 ENTREGAS', 44, 462, '#8fe8f0', 12, 'bold');
    write('EVITE CRATERAS DURANTE', 44, 494, '#879dab', 11);
    write('A TEMPESTADE SOLAR.', 44, 516, '#879dab', 11);
    write('STATUS DA MISSÃO', 888, 112, '#78e4ef', 14, 'bold');
    write(state.mode === 'edit' ? 'MODO EDITOR' : 'MISSÃO LUNAR', 888, 153, '#f0d27d', 16, 'bold');
    write(`ORÇAMENTO  $${Math.round(stats.spentCost)}M / $${Math.round(stats.budgetMax)}M`, 888, 208, '#d4e2e9', 12);
    write(`MASSA       ${Math.round(stats.totalMass)} kg`, 888, 240, '#d4e2e9', 12);
    write(`TECH INDEX  ${Math.round(stats.techIndex)}%`, 888, 272, '#8fe8f0', 12);
    write(`CIÊNCIA     ${Math.round(stats.scienceYield)} / 60`, 888, 304, '#d4e2e9', 12);
    const note = state.rover ? `${state.rover.delivered}/3 AMOSTRAS ENTREGUES` : 'MONTAGEM E LANÇAMENTO';
    write(note, 888, 382, '#8fe8f0', 12, 'bold');
    if (state.statusMessage) write(state.statusMessage.slice(0, 42), 888, 442, '#f1ca77', 11);
  }

  // Layout responsivo: telas largas (desktop, celular deitado) usam o layout paisagem 1280x720;
  // telas altas usam o layout retrato 720x1280. Não depende mais de estar em tela cheia.
  function wantsLandscape() {
    const vv = window.visualViewport;
    const w = vv ? vv.width : window.innerWidth;
    const h = vv ? vv.height : window.innerHeight;
    return w / Math.max(1, h) >= 1.15;
  }

  function syncFullscreenLayout() {
    const wide = wantsLandscape();
    state.fullscreenLandscape = wide;
    document.body.classList.toggle('fullscreen-landscape', wide);
    const w = wide ? 1280 : 720;
    const h = wide ? 720 : 1280;
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  }

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }
      if (!document.documentElement.requestFullscreen) throw new Error('fullscreen unavailable');
      await document.documentElement.requestFullscreen();
    } catch {
      state.fullscreenErrorUntil = simTime + 3;
      if (state.rover) state.rover = { ...state.rover, logs: [...state.rover.logs, '> TELA CHEIA BLOQUEADA PELO NAVEGADOR.'].slice(-3) };
      else state.statusMessage = 'O navegador bloqueou o modo tela cheia.';
    }
  }

  if (typeof lib !== 'undefined' && lib.showGameParameters) {
    lib.showGameParameters({
      name: 'Configuração da Base',
      params: {
        'Orçamento ($M)': {
          key: 'budgetMax',
          type: 'slider',
          min: 180,
          max: 600,
          step: 10,
          onChange: (value) => {
            if (state.mode !== 'edit') return;
            const num = Number(value);
            if (Number.isFinite(num)) {
              state.budgetMax = num;
              window.gameConfig.budgetMax = num;
            }
          }
        },
        'Escala do Veículo': {
          key: 'vehicleScale',
          type: 'slider',
          min: 0.7,
          max: 1.3,
          step: 0.05,
          onChange: (value) => {
            if (state.mode !== 'edit') return;
            const num = Number(value);
            if (Number.isFinite(num)) {
              state.vehicleScale = num;
              window.gameConfig.vehicleScale = num;
            }
          }
        }
      }
    });
  }

  function getCurrentStats() {
    const base = computeMissionStats(state.equipped, state.budgetMax);
    const spentCost = base.spentCost + state.testCostSpent;
    const remainingBudget = state.budgetMax - spentCost;
    return {
      ...base,
      spentCost,
      remainingBudget,
      isOverBudget: remainingBudget < 0
    };
  }

  function openPadEditMenu() {
    if (typeof lib === 'undefined' || !lib.editMenu?.open) return;
    lib.editMenu.open({
      name: 'Base Central de Montagem',
      params: {
        'Posição X': {
          key: 'padPos.x', type: 'slider', min: 200, max: 520, step: 5,
          onChange: (val) => {
            state.padPos.x = Number(val);
            window.gameConfig.padPos = { ...state.padPos };
          }
        },
        'Posição Y': {
          key: 'padPos.y', type: 'slider', min: 260, max: 500, step: 5,
          onChange: (val) => {
            state.padPos.y = Number(val);
            window.gameConfig.padPos = { ...state.padPos };
          }
        },
        'Escala': {
          key: 'vehicleScale', type: 'slider', min: 0.7, max: 1.3, step: 0.05,
          onChange: (val) => {
            state.vehicleScale = Number(val);
            window.gameConfig.vehicleScale = state.vehicleScale;
          }
        }
      }
    });
  }

  function selectDifficulty(difficultyId) {
    const preset = getDifficultyPreset(difficultyId);
    state.screen = 'base';
    state.difficultyId = preset.id;
    state.budgetMax = preset.budgetMax;
    state.equipped = { ...DEFAULT_EQUIPPED };
    state.builtLabs = [];
    state.selectedCategory = MODULE_CATEGORIES[0].id;
    state.testCompleted = false;
    state.testCostSpent = 0;
    state.testResult = null;
    state.launchResult = null;
    state.resultKind = null;
    state.rover = null;
    state.surfaceResult = null;
    state.launchLiftY = 0;
    state.particles = [];
    state.particleAccumulator = 0;
    state.statusMessage = preset.id === 'beginner'
      ? 'Dica: compare custo, massa e potência antes de confirmar.'
      : `${preset.name} · ${preset.cml}`;
    if (typeof lib !== 'undefined' && lib.haptics?.play) lib.haptics.play('tap');
  }

  function activateTitleChoice(index = state.titleSelection) {
    if (index === 0) {
      state.screen = 'difficulty';
    } else if (index === 1) {
      state.screen = 'options';
      state.optionsSelection = ['beginner', 'engineer', 'director'].indexOf(state.difficultyId);
      if (state.optionsSelection < 0) state.optionsSelection = 1;
    } else {
      state.screen = 'controls';
      state.manualPage = 0;
    }
    if (typeof lib !== 'undefined' && lib.haptics?.play) lib.haptics.play('tap');
  }

  function setDefaultDifficulty(difficultyId) {
    const preset = getDifficultyPreset(difficultyId);
    state.difficultyId = preset.id;
    state.budgetMax = preset.budgetMax;
    state.optionsSelection = ['beginner', 'engineer', 'director'].indexOf(preset.id);
    state.statusMessage = `${preset.name} · ${preset.cml}`;
    if (typeof lib !== 'undefined' && lib.haptics?.play) lib.haptics.play('tick');
  }

  function canAccessCategory(categoryId) {
    const index = MODULE_CATEGORIES.findIndex((category) => category.id === categoryId);
    if (index < 0) return false;
    if (state.mode === 'edit') return true;
    return state.builtLabs.includes(categoryId) || index === state.builtLabs.length;
  }

  function applyCategory(categoryId) {
    if (!canAccessCategory(categoryId)) {
      state.statusMessage = 'Construa o laboratório anterior para liberar este terminal.';
      if (typeof lib !== 'undefined' && lib.haptics?.play) lib.haptics.play('error');
      return;
    }
    if (state.selectedCategory === categoryId) return;
    state.selectedCategory = categoryId;
    state.statusMessage = '';
    if (typeof lib !== 'undefined' && lib.haptics?.play) lib.haptics.play('tick');
  }

  function applyOption(optionId) {
    const nextEquipped = selectModuleOption(state.equipped, state.selectedCategory, optionId);
    if (nextEquipped[state.selectedCategory] === state.equipped[state.selectedCategory]) {
      state.statusMessage = '';
      return;
    }
    if (nextEquipped !== state.equipped) {
      const candidateStats = computeMissionStats(nextEquipped, state.budgetMax);
      const feasibility = evaluateComponentChoice(candidateStats, state.difficultyId, true);
      if (!feasibility.feasible) {
        state.statusMessage = feasibility.issues[0];
        if (typeof lib !== 'undefined' && lib.haptics?.play) lib.haptics.play('warning');
        return;
      }
      state.equipped = nextEquipped;
      state.swapPulse = { category: state.selectedCategory, at: simTime };
      state.statusMessage = '';
      // Changing hardware invalidates any previous commissioning result.
      state.testCompleted = false;
      state.testCostSpent = 0;
      state.testResult = null;
      if (typeof lib !== 'undefined' && lib.haptics?.play) lib.haptics.play('tap');
    }
  }

  function runDirectorTest() {
    const preset = getDifficultyPreset(state.difficultyId);
    const stats = getCurrentStats();
    const result = evaluateEngineeringTest(stats, state.difficultyId);
    state.testResult = result;
    if (result.pass) {
      state.testCompleted = true;
      state.testCostSpent = result.testCost;
      state.statusMessage = `Teste aprovado · $${result.testCost}M contabilizados`;
      if (typeof lib !== 'undefined' && lib.haptics?.play) lib.haptics.play('success');
    } else {
      state.statusMessage = result.issues[0] || result.message;
      if (typeof lib !== 'undefined' && lib.haptics?.play) lib.haptics.play('warning');
    }
    return preset;
  }

  function startLaunch() {
    const stats = getCurrentStats();
    const result = evaluateLaunch(stats, state.difficultyId, state.builtLabs.length, state.testCompleted);
    state.launchResult = result;
    state.resultKind = 'launch';
    state.launchLiftY = 0;
    state.particles = [];
    state.particleAccumulator = 0;
    if (!result.success) {
      state.screen = 'result';
      state.statusMessage = result.issues[0] || result.message;
      if (typeof lib !== 'undefined' && lib.haptics?.play) lib.haptics.play('error');
      return;
    }
    state.screen = 'launch';
    state.launchStartedAt = simTime;
    state.statusMessage = '';
    if (typeof lib !== 'undefined' && lib.haptics?.play) lib.haptics.play('success');
  }

  function handlePrimaryAction() {
    if (state.mode !== 'play') return;
    if (state.screen === 'result' || state.screen === 'surfaceResult') {
      returnFromResult();
      return;
    }
    if (state.screen !== 'base') return;

    const nextIndex = state.builtLabs.length;
    if (nextIndex < MODULE_CATEGORIES.length) {
      const nextCategory = MODULE_CATEGORIES[nextIndex];
      if (state.selectedCategory !== nextCategory.id) {
        state.selectedCategory = nextCategory.id;
        state.statusMessage = `Terminal ${nextIndex + 1} liberado · configure e construa.`;
        return;
      }
      const stats = getCurrentStats();
      const preset = getDifficultyPreset(state.difficultyId);
      const testReserve = preset.requiresTest && !state.testCompleted ? preset.testCost : 0;
      if (stats.isOverBudget || stats.remainingBudget < testReserve) {
        const shortfall = Math.max(Math.abs(Math.min(0, stats.remainingBudget)), testReserve - stats.remainingBudget);
        state.statusMessage = testReserve > 0
          ? `Reserve $${testReserve}M para o teste CML 6 antes de construir.`
          : `Reduza $${shortfall}M antes de construir.`;
        if (typeof lib !== 'undefined' && lib.haptics?.play) lib.haptics.play('warning');
        return;
      }
      state.builtLabs.push(nextCategory.id);
      const next = MODULE_CATEGORIES[state.builtLabs.length];
      if (next) state.selectedCategory = next.id;
      state.statusMessage = next
        ? `${nextCategory.label} construído · próximo: ${next.label}`
        : 'Cinco laboratórios prontos · revisão de missão liberada';
      if (typeof lib !== 'undefined' && lib.haptics?.play) lib.haptics.play('success');
      return;
    }

    const difficulty = getDifficultyPreset(state.difficultyId);
    if (difficulty.requiresTest && !state.testCompleted) {
      runDirectorTest();
      return;
    }
    startLaunch();
  }

  function startSurfaceExploration() {
    state.screen = 'surface';
    const science = computeMissionStats(state.equipped, state.budgetMax);
    state.rover = createPlanetaryState(state.equipped, state.difficultyId, science, surfaceRunCount++);
    state.abortConfirmUntil = 0;
    state.roverMassFactor = Math.max(0.8, Math.min(2.1, science.totalMass / 1200));
    state.camera = { x: 0, y: 0 };
    state.surfaceResult = null;
    state.resultKind = null;
    state.launchLiftY = 0;
    heldKeys.clear();
  }

  function finishSurfaceIfEnded() {
    if (!state.rover || (!state.rover.missionComplete && !state.rover.missionFailed)) return;
    state.screen = 'surfaceResult';
    state.resultKind = 'surface';
    state.surfaceResult = { success: state.rover.missionComplete, reason: state.rover.failureReason };
    heldKeys.clear();
    if (typeof lib !== 'undefined' && lib.haptics?.play) lib.haptics.play(state.rover.missionComplete ? 'success' : 'error');
  }

  function collectSurfaceSample() {
    if (!state.rover) return;
    const result = commandGridCollect(state.rover);
    state.rover = result.state;
    if (typeof lib !== 'undefined' && lib.haptics?.play) lib.haptics.play(result.failed ? 'error' : 'tap');
    finishSurfaceIfEnded();
  }

  function transmitSurfaceData() {
    if (!state.rover) return;
    const result = commandGridTransmit(state.rover);
    state.rover = result.state;
    if (typeof lib !== 'undefined' && lib.haptics?.play) lib.haptics.play('tap');
  }

  function toggleEconomyMode() {
    if (!state.rover) return;
    state.rover = toggleEconomy(state.rover);
    if (typeof lib !== 'undefined' && lib.haptics?.play) lib.haptics.play('tap');
  }

  function requestAbortMission() {
    if (state.screen !== 'surface' || !state.rover) return;
    if (state.abortConfirmUntil > simTime) {
      state.rover = { ...state.rover, missionFailed: true, failureKind: 'abort', failureReason: 'MISSÃO ABORTADA PELO CONTROLADOR.' };
      state.screen = 'surfaceResult';
      state.resultKind = 'surface';
      state.surfaceResult = { success: false, reason: state.rover.failureReason };
      state.abortConfirmUntil = 0;
      heldKeys.clear();
      if (engineHapticsActive && typeof lib !== 'undefined' && lib.haptics?.stop) lib.haptics.stop();
      engineHapticsActive = false;
      if (typeof lib !== 'undefined' && lib.haptics?.play) lib.haptics.play('error');
      return;
    }
    state.abortConfirmUntil = simTime + 3;
    state.statusMessage = 'Toque novamente para confirmar o abandono.';
    state.rover = { ...state.rover, logs: [...state.rover.logs, '> ESC NOVAMENTE PARA ABANDONAR.'].slice(-3) };
    if (typeof lib !== 'undefined' && lib.haptics?.play) lib.haptics.play('warning');
  }

  function returnFromResult() {
    if (state.resultKind === 'launch' && state.launchResult?.success) {
      startSurfaceExploration();
      return;
    }
    state.screen = 'base';
    state.launchLiftY = 0;
    state.launchResult = null;
    state.resultKind = null;
    state.surfaceResult = null;
    state.rover = null;
    state.camera = { x: 0, y: 0 };
    heldKeys.clear();
    state.particles = [];
    state.particleAccumulator = 0;
    state.statusMessage = '';
  }

  function onPointerDown(e) {
    unlockAudio();
    let pt = getCanvasPoint(canvas, e.clientX, e.clientY);
    const fullButton = fullscreenButtonRect();
    if (fullscreenSupported && pointInRect(pt.x, pt.y, fullButton)) { void toggleFullscreen(); return; }

    if (state.fullscreenLandscape && state.screen === 'surface') {
      const control = LANDSCAPE_SURFACE_CONTROL_RECTS.find((rect) => pointInRect(pt.x, pt.y, rect))?.id;
      if (control === 'move') {
        state.rover = { ...state.rover, logs: [...state.rover.logs, '> CLIQUE NO MAPA PARA DEFINIR A ROTA.'].slice(-3) };
        return;
      }
      if (control === 'collect') { collectSurfaceSample(); return; }
      if (control === 'transmit') { transmitSurfaceData(); return; }
      if (control === 'economy') { toggleEconomyMode(); return; }
      if (pt.x >= 18 && pt.x < 918 && pt.y >= 76 && pt.y < 676) {
        const tileX = Math.floor((pt.x - 18) / 30);
        const tileY = Math.floor((pt.y - 76) / 30);
        state.rover = commandGridMove(state.rover, tileX, tileY);
        if (typeof lib !== 'undefined' && lib.haptics?.play) lib.haptics.play('tap');
      }
      return;
    }
    if (state.fullscreenLandscape && state.screen === 'surfaceResult') {
      const action = LANDSCAPE_SURFACE_RESULT_RECTS.find((rect) => pointInRect(pt.x, pt.y, rect));
      if (action?.id === 'retry') startSurfaceExploration();
      else if (action?.id === 'base') returnFromResult();
      return;
    }
    if (state.fullscreenLandscape) {
      pt = portraitPointFromWide(pt);
      if (!pt) return;
    }

    const layout = getAssemblyLayout(state.padPos, state.vehicleScale);

    if (state.mode === 'edit') {
      if (pointInRect(pt.x, pt.y, layout.padBounds)) {
        dragState = {
          pointerId: e.pointerId,
          offsetX: pt.x - state.padPos.x,
          offsetY: pt.y - state.padPos.y,
          moved: false
        };
        canvas.setPointerCapture?.(e.pointerId);
      } else if (typeof lib !== 'undefined' && lib.editMenu?.close) {
        lib.editMenu.close();
      }
      return;
    }

    if (state.screen === 'title') {
      const index = TITLE_MENU_RECTS.findIndex((rect) => pointInRect(pt.x, pt.y, rect));
      if (index >= 0) {
        state.titleSelection = index;
        activateTitleChoice(index);
      }
      return;
    }
    if (state.screen === 'options') {
      const option = OPTIONS_DIFFICULTY_RECTS.find((rect) => pointInRect(pt.x, pt.y, rect));
      if (option) setDefaultDifficulty(option.id);
      else if (pointInRect(pt.x, pt.y, TITLE_BACK_RECT)) state.screen = 'title';
      return;
    }
    if (state.screen === 'controls') {
      if (pointInRect(pt.x, pt.y, TITLE_BACK_RECT)) {
        state.screen = 'title';
      } else if (pointInRect(pt.x, pt.y, MANUAL_PREV_RECT)) {
        state.manualPage = Math.max(0, state.manualPage - 1);
      } else if (pointInRect(pt.x, pt.y, MANUAL_NEXT_RECT)) {
        state.manualPage = Math.min(MISSION_MANUAL_PAGE_COUNT - 1, state.manualPage + 1);
      }
      if (typeof lib !== 'undefined' && lib.haptics?.play) lib.haptics.play('tick');
      return;
    }
    if (state.screen === 'difficulty') {
      for (const card of getDifficultyCardRects()) {
        if (pointInRect(pt.x, pt.y, card)) {
          selectDifficulty(card.id);
          return;
        }
      }
      if (pointInRect(pt.x, pt.y, DIFFICULTY_BACK_RECT)) state.screen = 'title';
      return;
    }

    if (state.screen === 'surface') {
      const control = hitTestSurfaceControl(pt.x, pt.y);
      if (control === 'move') {
        state.statusMessage = 'TOQUE NO MAPA PARA DEFINIR A ROTA.';
        state.rover = { ...state.rover, logs: [...state.rover.logs, '> TOQUE NO MAPA PARA DEFINIR A ROTA.'].slice(-3) };
        if (typeof lib !== 'undefined' && lib.haptics?.play) lib.haptics.play('tap');
        return;
      }
      if (control === 'collect') { collectSurfaceSample(); return; }
      if (control === 'transmit') { transmitSurfaceData(); return; }
      if (control === 'economy') { toggleEconomyMode(); return; }

      if (pt.x >= GRID_MAP_X && pt.x < GRID_MAP_X + GRID_COLS * GRID_TILE_SIZE
        && pt.y >= GRID_MAP_Y && pt.y < GRID_MAP_Y + GRID_ROWS * GRID_TILE_SIZE) {
        const tileX = Math.floor((pt.x - GRID_MAP_X) / GRID_TILE_SIZE);
        const tileY = Math.floor((pt.y - GRID_MAP_Y) / GRID_TILE_SIZE);
        state.rover = commandGridMove(state.rover, tileX, tileY);
        if (typeof lib !== 'undefined' && lib.haptics?.play) lib.haptics.play('tap');
      }
      return;
    }
    if (state.screen === 'surfaceResult') {
      const action = SURFACE_RESULT_RECTS.find((rect) => pointInRect(pt.x, pt.y, rect));
      if (action?.id === 'retry') startSurfaceExploration();
      else if (action?.id === 'base') returnFromResult();
      return;
    }
    if (state.screen === 'launch') return;
    if (state.screen === 'result') {
      const action = { x: 32, y: 1122, w: CANVAS_WIDTH - 64, h: 110 };
      if (pointInRect(pt.x, pt.y, action)) returnFromResult();
      return;
    }

    if (pointInRect(pt.x, pt.y, layout.actionButton)) {
      handlePrimaryAction();
      return;
    }

    const hit = hitTestAssembly(pt.x, pt.y, layout);
    if (!hit) return;
    if (hit.type === 'category') applyCategory(hit.id);
    else if (hit.type === 'option') applyOption(hit.id);
  }

  function onPointerMove(e) {
    if (state.mode !== 'edit' || !dragState || dragState.pointerId !== e.pointerId) return;
    let pt = getCanvasPoint(canvas, e.clientX, e.clientY);
    if (state.fullscreenLandscape) {
      pt = portraitPointFromWide(pt);
      if (!pt) return;
    }
    const nx = Math.max(200, Math.min(520, Math.round(pt.x - dragState.offsetX)));
    const ny = Math.max(260, Math.min(500, Math.round(pt.y - dragState.offsetY)));
    if (nx !== state.padPos.x || ny !== state.padPos.y) {
      dragState.moved = true;
      state.padPos.x = nx;
      state.padPos.y = ny;
      window.gameConfig.padPos = { x: nx, y: ny };
    }
  }

  function onPointerUp(e) {
    if (state.mode !== 'edit' || !dragState || dragState.pointerId !== e.pointerId) return;
    if (!dragState.moved) openPadEditMenu();
    dragState = null;
  }

  function onKeyDown(e) {
    if (state.mode !== 'play') return;
    unlockAudio();
    if ((e.key === 'f' || e.key === 'F') && fullscreenSupported && !e.repeat) { e.preventDefault(); void toggleFullscreen(); return; }
    if (state.screen === 'surface') {
      const key = e.key.toLowerCase();
      if (key === 'm') {
        e.preventDefault();
        state.statusMessage = 'TOQUE NO MAPA PARA DEFINIR A ROTA.';
        state.rover = { ...state.rover, logs: [...state.rover.logs, '> TOQUE NO MAPA PARA DEFINIR A ROTA.'].slice(-3) };
      } else if (key === 's') {
        e.preventDefault();
        toggleEconomyMode();
      } else if (key === 'c') {
        e.preventDefault();
        collectSurfaceSample();
      } else if (key === 't') {
        e.preventDefault();
        transmitSurfaceData();
      } else if (key === 'escape') {
        e.preventDefault();
        requestAbortMission();
      }
      return;
    }
    const key = e.key.toLowerCase();
    if (state.screen === 'title') {
      if (key === 'arrowup' || key === 'arrowdown') {
        e.preventDefault();
        const direction = key === 'arrowdown' ? 1 : -1;
        state.titleSelection = (state.titleSelection + direction + TITLE_MENU_RECTS.length) % TITLE_MENU_RECTS.length;
      } else if (key === 'enter' || key === ' ') {
        e.preventDefault();
        activateTitleChoice();
      }
      return;
    }
    if (state.screen === 'options') {
      if (key === 'escape') {
        e.preventDefault();
        state.screen = 'title';
      } else if (key === 'arrowup' || key === 'arrowdown') {
        e.preventDefault();
        const direction = key === 'arrowdown' ? 1 : -1;
        state.optionsSelection = (state.optionsSelection + direction + OPTIONS_DIFFICULTY_RECTS.length) % OPTIONS_DIFFICULTY_RECTS.length;
      } else if (key === 'enter' || key === ' ') {
        e.preventDefault();
        const option = OPTIONS_DIFFICULTY_RECTS[state.optionsSelection];
        if (option) setDefaultDifficulty(option.id);
      }
      return;
    }
    if (state.screen === 'controls') {
      if (key === 'escape') {
        e.preventDefault();
        state.screen = 'title';
      } else if (key === 'arrowleft') {
        e.preventDefault();
        state.manualPage = Math.max(0, state.manualPage - 1);
      } else if (key === 'arrowright' || key === 'enter' || key === ' ') {
        e.preventDefault();
        state.manualPage = Math.min(MISSION_MANUAL_PAGE_COUNT - 1, state.manualPage + 1);
      }
      return;
    }
    if (state.screen === 'difficulty') {
      if (key === 'escape') {
        e.preventDefault();
        state.screen = 'title';
      } else {
        const difficultyByKey = { '1': 'beginner', '2': 'engineer', '3': 'director' };
        if (difficultyByKey[key]) {
          e.preventDefault();
          selectDifficulty(difficultyByKey[key]);
        }
      }
      return;
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handlePrimaryAction();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      applyCategory(getCategoryByOffset(state.selectedCategory, -1));
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      applyCategory(getCategoryByOffset(state.selectedCategory, 1));
    } else if (e.key === 'ArrowUp' || e.key === '1') {
      e.preventDefault();
      applyOption('standard');
    } else if (e.key === 'ArrowDown' || e.key === '2') {
      e.preventDefault();
      applyOption('advanced');
    }
  }

  function onFullscreenChange() { syncFullscreenLayout(); }
  function onViewportResize() { syncFullscreenLayout(); }
  function onContextMenu(e) { e.preventDefault(); }
  document.addEventListener('fullscreenchange', onFullscreenChange);
  window.addEventListener('resize', onViewportResize);
  window.addEventListener('orientationchange', onViewportResize);
  window.visualViewport?.addEventListener('resize', onViewportResize);
  canvas.addEventListener('contextmenu', onContextMenu);
  syncFullscreenLayout();

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  function onKeyUp(e) {
    heldKeys.delete(e.key.toLowerCase());
  }

  function advanceSurface(dt) {
    if (state.screen !== 'surface' || !state.rover) return;
    const previous = state.rover;
    const next = advancePlanetaryRover(previous, dt);
    state.rover = next;
    if ((next.memory > previous.memory || next.delivered > previous.delivered)
      && !next.missionComplete && !next.missionFailed && typeof lib !== 'undefined' && lib.haptics?.play) lib.haptics.play('success');
    if (!previous.overheated && next.overheated && typeof lib !== 'undefined' && lib.haptics?.play) lib.haptics.play('warning');
    if (previous.stormPhase !== 'warning' && next.stormPhase === 'warning') {
      playStormAlarm();
      if (typeof lib !== 'undefined' && lib.haptics?.play) lib.haptics.play('warning');
    }
    if (previous.stormPhase !== 'wave' && next.stormPhase === 'wave') {
      playStormAlarm();
      if (typeof lib !== 'undefined' && lib.haptics?.play) lib.haptics.play('warning');
    }
    if (next.missionComplete || next.missionFailed) finishSurfaceIfEnded();
  }

  function advanceExhaustParticles(dt) {
    state.particles = updateLaunchParticles(state.particles, dt);
    if (state.screen !== 'launch') return;
    const elapsed = simTime - state.launchStartedAt;
    if (elapsed < 1.8 || elapsed > 4.45) return;
    const emitted = emitLaunchParticles(
      state.particles,
      { x: state.padPos.x - 52, y: state.padPos.y + 110 + state.launchLiftY },
      state.particleAccumulator,
      dt
    );
    state.particles = emitted.particles;
    state.particleAccumulator = emitted.accumulator;
  }

  function loop(timestamp) {
    const rawDt = (timestamp - lastTimestamp) / 1000;
    lastTimestamp = timestamp;
    const dt = Math.min(0.11, Math.max(0, rawDt));
    simTime += dt;

    if (state.screen === 'launch' && simTime - state.launchStartedAt >= 4.8) {
      state.screen = 'result';
      state.launchLiftY = -560;
      state.particles = [];
      state.particleAccumulator = 0;
      state.statusMessage = '';
      if (typeof lib !== 'undefined' && lib.haptics?.play) lib.haptics.play('success');
    }
    advanceSurface(dt);
    advanceExhaustParticles(dt);

    const stats = getCurrentStats();
    if (state.fullscreenLandscape && (state.screen === 'surface' || state.screen === 'surfaceResult')) {
      renderLandscapeSurfaceFrame(ctx, state, simTime, state.art);
    } else if (state.fullscreenLandscape) {
      drawWidePortraitFrame(stats);
    } else {
      renderFrame(ctx, state, stats, simTime);
    }
    drawFullscreenButton(ctx);
    rafId = requestAnimationFrame(loop);
  }

  rafId = requestAnimationFrame(loop);
  activeCleanup = () => {
    appAlive = false;
    if (engineHapticsActive && typeof lib !== 'undefined' && lib.haptics?.stop) lib.haptics.stop();
    engineHapticsActive = false;
    if (audioContext && audioContext.state !== 'closed') audioContext.close().catch(() => {});
    cancelAnimationFrame(rafId);
    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('pointerup', onPointerUp);
    canvas.removeEventListener('pointercancel', onPointerUp);
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    document.removeEventListener('fullscreenchange', onFullscreenChange);
    window.removeEventListener('resize', onViewportResize);
    window.removeEventListener('orientationchange', onViewportResize);
    window.visualViewport?.removeEventListener('resize', onViewportResize);
    canvas.removeEventListener('contextmenu', onContextMenu);
  };
}
