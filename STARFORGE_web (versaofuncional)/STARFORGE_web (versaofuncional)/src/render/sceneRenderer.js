/**
 * Renderer for Orbital Architect: Mission Design.
 * Includes difficulty/CML progression, engineering labs, launch sequence and a reactive
 * assembly guide that explains the selected part without obscuring the vehicle.
 */
import { CATEGORY_BY_ID, MODULE_CATEGORIES } from '../core/catalog.js';
import { computeMissionStats, selectModuleOption } from '../core/missionState.js';
import { particleAlpha } from '../game/launchParticles.js';
import { MISSION_MANUAL_PAGES } from '../core/manualContent.js';
import { getLaunchRoast } from '../core/failureMessages.js';
import { DIFFICULTY_PRESETS, evaluateComponentChoice } from '../core/missionRules.js';
import { renderSurfaceFrame } from './planetarySurfaceRenderer.js';
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  getAssemblyLayout,
  getDifficultyCardRects,
  TITLE_MENU_RECTS,
  OPTIONS_DIFFICULTY_RECTS,
  TITLE_BACK_RECT,
  DIFFICULTY_BACK_RECT,
  MANUAL_PREV_RECT,
  MANUAL_NEXT_RECT
} from '../core/layout.js';

const MANUAL_PAGES = MISSION_MANUAL_PAGES;

function drawRoundedRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function drawCover(ctx, image, x, y, w, h) {
  if (!image || !image.naturalWidth || !image.naturalHeight) return;
  const scale = Math.max(w / image.naturalWidth, h / image.naturalHeight);
  const sw = w / scale;
  const sh = h / scale;
  const sx = (image.naturalWidth - sw) * 0.5;
  const sy = (image.naturalHeight - sh) * 0.5;
  ctx.drawImage(image, sx, sy, sw, sh, x, y, w, h);
}

function drawSpriteFit(ctx, image, x, y, maxW, maxH, alignX = 0.5) {
  if (!image || !image.naturalWidth || !image.naturalHeight) return;
  const scale = Math.min(maxW / image.naturalWidth, maxH / image.naturalHeight);
  const w = image.naturalWidth * scale;
  const h = image.naturalHeight * scale;
  ctx.drawImage(image, x + (maxW - w) * alignX, y + (maxH - h) * 0.5, w, h);
}

function getFittedRect(image, rect) {
  if (!image?.naturalWidth || !image?.naturalHeight) return { ...rect };
  const scale = Math.min(rect.w / image.naturalWidth, rect.h / image.naturalHeight);
  const w = image.naturalWidth * scale;
  const h = image.naturalHeight * scale;
  return { x: rect.x + (rect.w - w) / 2, y: rect.y + (rect.h - h) / 2, w, h };
}

function drawSpriteInRect(ctx, image, rect, pulse = 1) {
  if (!image?.naturalWidth || !image?.naturalHeight) return null;
  const fitted = getFittedRect(image, rect);
  ctx.save();
  ctx.translate(fitted.x + fitted.w / 2, fitted.y + fitted.h / 2);
  ctx.scale(pulse, pulse);
  ctx.drawImage(image, -fitted.w / 2, -fitted.h / 2, fitted.w, fitted.h);
  ctx.restore();
  return fitted;
}

function drawHangarBackground(ctx, art) {
  ctx.fillStyle = '#090e1c';
  ctx.fillRect(0, 0, CANVAS_WIDTH, 660);
  drawCover(ctx, art?.hangar_background, 0, 0, CANVAS_WIDTH, 660);
  const shade = ctx.createLinearGradient(0, 0, 0, 150);
  shade.addColorStop(0, 'rgba(3, 7, 18, 0.54)');
  shade.addColorStop(0.76, 'rgba(3, 7, 18, 0.08)');
  shade.addColorStop(1, 'rgba(3, 7, 18, 0.0)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, CANVAS_WIDTH, 160);
}

function drawTopTelemetryBar(ctx, stats) {
  const y = 24;
  const h = 76;
  const gap = 16;
  const marginX = 32;
  const w = Math.floor((CANVAS_WIDTH - marginX * 2 - gap * 2) / 3);
  const pills = [
    {
      label: 'ORÇAMENTO',
      value: `$${stats.remainingBudget}M`,
      color: stats.isOverBudget ? '#ff5c7a' : stats.remainingBudget < stats.budgetMax * 0.2 ? '#fbbf24' : '#4ade80'
    },
    {
      label: 'MASSA',
      value: `${stats.totalMass} kg`,
      color: stats.totalMass > 1800 ? '#fbbf24' : '#60a5fa'
    },
    {
      label: 'POTÊNCIA',
      value: `${stats.netPower >= 0 ? '+' : ''}${stats.netPower} W`,
      color: stats.isPowerDeficit ? '#ff5c7a' : '#34f5c5'
    }
  ];

  pills.forEach((pill, i) => {
    const x = marginX + i * (w + gap);
    drawRoundedRect(ctx, x, y, w, h, 14);
    ctx.fillStyle = 'rgba(10, 16, 31, 0.9)';
    ctx.fill();
    ctx.strokeStyle = pill.color;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#a8b7ca';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(pill.label, x + w / 2, y + 24);
    ctx.fillStyle = pill.color;
    ctx.font = 'bold 26px monospace';
    ctx.fillText(pill.value, x + w / 2, y + 56);
  });
}

const LAB_POSITIONS = {
  propulsion: { x: 12, y: 460, w: 92, h: 96 },
  avionics: { x: 103, y: 508, w: 88, h: 92 },
  structure: { x: 198, y: 508, w: 82, h: 84 },
  payload: { x: 568, y: 510, w: 92, h: 88 },
  satellite: { x: 624, y: 390, w: 82, h: 82 }
};

function drawProgressiveLabs(ctx, state, art) {
  const visibleLabs = new Set(state.builtLabs || []);
  if (state.mode === 'edit') {
    for (const category of MODULE_CATEGORIES) visibleLabs.add(category.id);
  }
  for (const category of MODULE_CATEGORIES) {
    if (!visibleLabs.has(category.id)) continue;
    const rect = LAB_POSITIONS[category.id];
    const asset = art?.[`lab_${category.id}`];
    ctx.save();
    if (state.mode !== 'edit' && state.selectedCategory === category.id && state.screen === 'base') {
      ctx.globalAlpha = 1;
    } else {
      ctx.globalAlpha = 0.92;
    }
    drawSpriteFit(ctx, asset, rect.x, rect.y, rect.w, rect.h);
    ctx.restore();
  }
}

function drawModularVehicle(ctx, state, time, layout, art) {
  const { equipped, selectedCategory, swapPulse } = state;
  const liftY = state.launchLiftY || 0;
  const slot = Object.fromEntries(layout.padParts.map((part) => [part.id, part]));
  const artByCategory = {
    propulsion: art?.[`engine_${equipped.propulsion}`],
    avionics: art?.[`avionics_${equipped.avionics}`],
    structure: art?.[`fuselage_${equipped.structure}`],
    payload: art?.[`rover_${equipped.payload}`],
    satellite: art?.[`satellite_${equipped.satellite}`]
  };
  const pulseFor = (category) => swapPulse?.category === category
    ? 1 + Math.sin(Math.max(0, 1 - (time - swapPulse.at) / 0.35) * Math.PI) * 0.075
    : 1;

  // One shared geometry drives sprite placement, hit areas, and each live selection outline.
  for (const category of MODULE_CATEGORIES) {
    const rect = slot[category.id];
    const artRect = category.id === 'payload' ? rect : { ...rect, y: rect.y + liftY };
    drawSpriteInRect(ctx, artByCategory[category.id], artRect, pulseFor(category.id));
  }

  if (state.screen === 'base' || state.mode === 'edit') {
    for (const category of MODULE_CATEGORIES) {
      const image = artByCategory[category.id];
      if (!image?.naturalWidth || !image?.naturalHeight) continue;
      const fitted = getFittedRect(image, slot[category.id]);
      if (!fitted.w || !fitted.h) continue;
      const isSelected = selectedCategory === category.id && state.screen === 'base' && state.mode === 'play';
      ctx.save();
      ctx.strokeStyle = isSelected ? category.accent : '#9bb8d8';
      ctx.globalAlpha = isSelected ? 0.9 + 0.08 * Math.sin(time * 5) : 0.26;
      ctx.lineWidth = isSelected ? 3 : 1.5;
      ctx.setLineDash(isSelected ? [9, 6] : []);
      drawRoundedRect(ctx, fitted.x - 2, fitted.y - 2, fitted.w + 4, fitted.h + 4, 7);
      ctx.stroke();
      ctx.restore();
    }
  }

  if (state.mode === 'edit') {
    const b = layout.padBounds;
    ctx.save();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 3;
    ctx.setLineDash([12, 8]);
    drawRoundedRect(ctx, b.x, b.y, b.w, b.h, 16);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(10, 16, 31, 0.76)';
    ctx.fillRect(b.x, b.y, 148, 32);
    ctx.fillStyle = '#e0f2fe';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('BASE CENTRAL', b.x + 12, b.y + 22);
    ctx.restore();
  }
}

const ASSEMBLY_GUIDE_LINES = {
  propulsion: {
    standard: 'Propulsão: o motor leve poupa massa e custo.',
    advanced: 'Propulsor pesado dá mais impulso, mas pesa e custa mais.'
  },
  avionics: {
    standard: 'Aviônica básica controla a nave com consumo contido.',
    advanced: 'Autopiloto amplia ciência, mas exige mais potência e custo.'
  },
  structure: {
    standard: 'Alumínio é leve. Titânio reforça, mas pesa mais.',
    advanced: 'Titânio protege melhor; confira a massa total.'
  },
  payload: {
    standard: 'Scanner coleta rápido e usa menos energia.',
    advanced: 'Perfuratriz rende mais ciência e adiciona massa.'
  },
  satellite: {
    standard: 'Satélite LEO é leve e econômico.',
    advanced: 'Relé amplia a comunicação, mas exige mais recursos.'
  }
};

function drawAssemblyGuide(ctx, state, stats, art) {
  const category = state.selectedCategory;
  const choice = state.equipped[category];
  const text = ASSEMBLY_GUIDE_LINES[category]?.[choice] || 'Escolha uma peça para receber uma dica de engenharia.';
  const portrait = art?.[stats.remainingBudget < 20 ? 'guide_worried' : 'guide_calm'];
  drawRoundedRect(ctx, 18, 126, 178, 324, 16);
  ctx.fillStyle = 'rgba(9, 15, 30, 0.91)';
  ctx.fill();
  ctx.strokeStyle = stats.remainingBudget < 20 ? '#fbbf24' : '#3a567e';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#63d7ff';
  ctx.textAlign = 'center';
  ctx.font = 'bold 13px monospace';
  ctx.fillText('GUIA DE MISSÃO', 107, 148);
  drawSpriteFit(ctx, portrait, 42, 152, 130, 112);
  drawRoundedRect(ctx, 29, 274, 156, 159, 12);
  ctx.fillStyle = '#121e34';
  ctx.fill();
  ctx.strokeStyle = '#314c70';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = '#dbe4ef';
  ctx.textAlign = 'left';
  ctx.font = '14px sans-serif';
  wrapText(ctx, text, 42, 300, 130, 21, 6);
}

function drawLabTabs(ctx, state, layout) {
  const built = new Set(state.builtLabs || []);
  const nextId = MODULE_CATEGORIES[(state.builtLabs || []).length]?.id;
  if (state.mode === 'edit') {
    for (const category of MODULE_CATEGORIES) built.add(category.id);
  }

  for (const [index, tabRect] of layout.categoryTabs.entries()) {
    const cat = CATEGORY_BY_ID[tabRect.id];
    const isSelected = state.selectedCategory === cat.id;
    const isBuilt = built.has(cat.id);
    const isAvailable = isBuilt || cat.id === nextId || state.mode === 'edit';
    drawRoundedRect(ctx, tabRect.x, tabRect.y, tabRect.w, tabRect.h, 14);
    ctx.fillStyle = isSelected ? '#1b294a' : isAvailable ? '#111a31' : '#0b1120';
    ctx.fill();
    ctx.strokeStyle = isSelected ? cat.accent : isBuilt ? '#43d9a4' : isAvailable ? '#2a3c63' : '#202a3d';
    ctx.lineWidth = isSelected ? 3 : 2;
    ctx.stroke();

    ctx.fillStyle = isBuilt ? '#43d9a4' : isAvailable ? cat.accent : '#475569';
    ctx.beginPath();
    ctx.arc(tabRect.x + tabRect.w / 2, tabRect.y + 29, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = isAvailable ? (isSelected ? '#ffffff' : '#94a3b8') : '#64748b';
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(cat.shortLabel, tabRect.x + tabRect.w / 2, tabRect.y + 78);
    ctx.fillStyle = isBuilt ? '#43d9a4' : '#718096';
    ctx.font = 'bold 14px monospace';
    ctx.fillText(isBuilt ? '✓' : `${index + 1}`, tabRect.x + tabRect.w / 2, tabRect.y + 55);
  }
}

function getPrimaryActionText(state, difficulty) {
  if (state.mode === 'edit') return 'EDITOR DA BASE';
  const nextIndex = (state.builtLabs || []).length;
  if (nextIndex < MODULE_CATEGORIES.length) {
    const nextId = MODULE_CATEGORIES[nextIndex].id;
    if (state.selectedCategory !== nextId) return `CONTINUAR · LAB ${nextIndex + 1}/5`;
    return `CONSTRUIR LAB ${nextIndex + 1}/5`;
  }
  if (difficulty.requiresTest && !state.testCompleted) return 'EXECUTAR TESTE CML 6';
  return 'INICIAR LANÇAMENTO';
}

function drawPrimaryAction(ctx, state, layout, stats, difficulty) {
  const rect = layout.actionButton;
  const overBudget = stats.isOverBudget;
  const color = overBudget ? '#f87171' : (state.builtLabs.length === 5 && (!difficulty.requiresTest || state.testCompleted)) ? '#43d9a4' : '#53c8ff';
  drawRoundedRect(ctx, rect.x, rect.y, rect.w, rect.h, 18);
  ctx.fillStyle = overBudget ? '#321927' : '#111d35';
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = overBudget ? '#ff95a7' : color;
  ctx.font = 'bold 22px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(getPrimaryActionText(state, difficulty), rect.x + rect.w / 2, rect.y + 42);
  const sub = state.statusMessage || (overBudget
    ? 'Orçamento excedido · escolha outra configuração'
    : state.builtLabs.length < 5
      ? 'Confirme o módulo e expanda a base'
      : difficulty.requiresTest && !state.testCompleted
        ? 'Teste de integração obrigatório antes do voo'
        : 'Validar os sistemas e lançar');
  ctx.fillStyle = '#cbd5e1';
  ctx.font = '15px sans-serif';
  ctx.fillText(sub, rect.x + rect.w / 2, rect.y + 74);
}

function drawBottomControls(ctx, state, layout, art, stats, difficulty) {
  ctx.fillStyle = '#0d1426';
  ctx.fillRect(0, 660, CANVAS_WIDTH, CANVAS_HEIGHT - 660);
  ctx.strokeStyle = '#233252';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 660);
  ctx.lineTo(CANVAS_WIDTH, 660);
  ctx.stroke();

  const activeCat = CATEGORY_BY_ID[state.selectedCategory];
  ctx.fillStyle = '#dbeafe';
  ctx.font = 'bold 17px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`${difficulty.cml}   ·   ${state.builtLabs.length}/5 LABORATÓRIOS   ·   ${activeCat.label.toUpperCase()}`, CANVAS_WIDTH / 2, 696);

  drawLabTabs(ctx, state, layout);
  const equippedChoice = state.equipped[state.selectedCategory];
  for (const cardRect of layout.optionCards) {
    const opt = activeCat.options[cardRect.optionId];
    const isActive = equippedChoice === cardRect.optionId;
    const candidate = selectModuleOption(state.equipped, state.selectedCategory, cardRect.optionId);
    const candidateStats = computeMissionStats(candidate, difficulty.budgetMax);
    const feasibility = evaluateComponentChoice(candidateStats, difficulty.id, true);
    const isBlocked = state.mode === 'play' && !isActive && !feasibility.feasible;
    drawRoundedRect(ctx, cardRect.x, cardRect.y, cardRect.w, cardRect.h, 20);
    ctx.fillStyle = isBlocked ? '#1a1420' : isActive ? '#172544' : '#10182d';
    ctx.fill();
    ctx.strokeStyle = isBlocked ? '#704052' : isActive ? opt.color : '#293a60';
    ctx.lineWidth = isActive ? 4 : 2;
    ctx.stroke();

    drawRoundedRect(ctx, cardRect.x + 20, cardRect.y + 14, cardRect.w - 40, 34, 10);
    ctx.fillStyle = isBlocked ? '#522333' : isActive ? opt.color : '#1e293b';
    ctx.fill();
    ctx.fillStyle = isBlocked ? '#ffc1ce' : isActive ? '#081020' : '#94a3b8';
    ctx.font = 'bold 15px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(cardRect.optionId === 'standard' ? 'PADRÃO' : 'AVANÇADO', cardRect.x + cardRect.w / 2, cardRect.y + 37);

    const artFamily = {
      propulsion: 'engine', structure: 'fuselage', avionics: 'avionics', satellite: 'satellite', payload: 'rover'
    }[state.selectedCategory];
    const preview = art?.[`${artFamily}_${cardRect.optionId}`];
    ctx.save();
    ctx.globalAlpha = isBlocked ? 0.4 : 1;
    drawSpriteFit(ctx, preview, cardRect.x + cardRect.w / 2 - 60, cardRect.y + 52, 120, 78);
    ctx.restore();

    ctx.fillStyle = isBlocked ? '#a38b96' : '#f8fafc';
    ctx.font = 'bold 19px sans-serif';
    ctx.fillText(opt.name, cardRect.x + cardRect.w / 2, cardRect.y + 154);

    const statsRows = [
      { label: 'CUSTO', val: `$${opt.cost}M`, col: '#f87171' },
      { label: 'MASSA', val: `${opt.mass} kg`, col: '#60a5fa' },
      { label: 'POTÊNCIA', val: `${opt.power >= 0 ? '+' : ''}${opt.power} W`, col: opt.power >= 0 ? '#4ade80' : '#fbbf24' }
    ];
    statsRows.forEach((row, idx) => {
      const ry = cardRect.y + 190 + idx * 29;
      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(row.label, cardRect.x + 22, ry);
      ctx.fillStyle = row.col;
      ctx.textAlign = 'right';
      ctx.fillText(row.val, cardRect.x + cardRect.w - 22, ry);
    });
    if (isBlocked) {
      const issue = feasibility.issues[0] || '';
      const reason = issue.includes('orçamento') ? 'ORÇAMENTO' : issue.includes('Massa') ? 'MASSA' : 'POTÊNCIA';
      ctx.fillStyle = '#ff8fa3';
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`BLOQUEADO · ${reason}`, cardRect.x + cardRect.w / 2, cardRect.y + 278);
    }
  }
  drawPrimaryAction(ctx, state, layout, stats, difficulty);
}

function drawTitleBackdrop(ctx, art, time = 0) {
  ctx.fillStyle = '#070b1b';
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  drawCover(ctx, art?.title_background_ober, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  const shade = ctx.createLinearGradient(0, 0, CANVAS_WIDTH, 0);
  shade.addColorStop(0, 'rgba(5, 10, 27, 0.66)');
  shade.addColorStop(0.52, 'rgba(5, 10, 27, 0.24)');
  shade.addColorStop(1, 'rgba(5, 10, 27, 0.04)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  const starGlow = 0.025 + Math.sin(time * 1.3) * 0.012;
  ctx.fillStyle = `rgba(106, 226, 255, ${starGlow})`;
  ctx.fillRect(0, 0, CANVAS_WIDTH, 430);
}

function drawMenuButton(ctx, rect, label, active, accent = '#64dfff') {
  drawRoundedRect(ctx, rect.x, rect.y, rect.w, rect.h, 15);
  ctx.fillStyle = active ? 'rgba(18, 47, 71, 0.96)' : 'rgba(8, 20, 39, 0.82)';
  ctx.fill();
  ctx.strokeStyle = active ? accent : 'rgba(126, 172, 199, 0.62)';
  ctx.lineWidth = active ? 3 : 1.5;
  ctx.stroke();
  if (active) {
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.moveTo(rect.x + 17, rect.y + rect.h / 2);
    ctx.lineTo(rect.x + 29, rect.y + rect.h / 2 - 9);
    ctx.lineTo(rect.x + 29, rect.y + rect.h / 2 + 9);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = active ? '#f4fbff' : '#c5d8e6';
  ctx.textAlign = 'center';
  ctx.font = 'bold 19px monospace';
  ctx.fillText(label, rect.x + rect.w / 2 + (active ? 5 : 0), rect.y + rect.h / 2 + 7);
}

function drawTitleScreen(ctx, state, art, time) {
  drawTitleBackdrop(ctx, art, time);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#8ceaff';
  ctx.font = 'bold 14px monospace';
  ctx.fillText('PROGRAMA DE EXPLORAÇÃO LUNAR', 58, 270);
  ctx.fillStyle = 'rgba(4, 12, 28, 0.8)';
  ctx.font = 'bold 44px monospace';
  ctx.fillText('STARFORGE', 58, 344);
  ctx.fillStyle = '#f7d477';
  ctx.font = 'bold 44px monospace';
  ctx.fillText('STARFORGE', 54, 340);
  ctx.fillStyle = '#f0e6c7';
  ctx.font = 'bold 36px monospace';
  ctx.fillText('MISSÃO LUNAR · 1994', 58, 389);
  ctx.fillStyle = '#b9d3e5';
  ctx.font = '16px monospace';
  ctx.fillText('DESIGN  ·  EXPLORE  ·  TRANSMIT', 60, 426);

  drawRoundedRect(ctx, 34, 495, 374, 394, 20);
  ctx.fillStyle = 'rgba(7, 16, 34, 0.64)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(96, 197, 222, 0.42)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#96b9cf';
  ctx.textAlign = 'left';
  ctx.font = 'bold 12px monospace';
  ctx.fillText('MENU PRINCIPAL', 58, 525);
  const labels = ['INICIAR MISSÃO', 'OPÇÕES', 'COMO JOGAR'];
  TITLE_MENU_RECTS.forEach((rect, index) => drawMenuButton(ctx, rect, labels[index], index === state.titleSelection));

  ctx.save();
  const rocketBob = Math.sin(time * 1.7) * 5;
  const trail = ctx.createLinearGradient(570, 560, 645, 795 + rocketBob);
  trail.addColorStop(0, 'rgba(255, 205, 95, 0)');
  trail.addColorStop(0.55, 'rgba(255, 182, 86, 0.32)');
  trail.addColorStop(1, 'rgba(255, 228, 153, 0.92)');
  ctx.strokeStyle = trail;
  ctx.lineWidth = 12;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(603, 575);
  ctx.bezierCurveTo(694, 655, 678, 735, 637, 782 + rocketBob);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255, 241, 190, 0.72)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(603, 575);
  ctx.bezierCurveTo(694, 655, 678, 735, 637, 782 + rocketBob);
  ctx.stroke();
  ctx.translate(542, 780 + rocketBob);
  ctx.rotate(-0.13);
  drawSpriteFit(ctx, art?.title_rocket_ober, -128, -62, 256, 124);
  ctx.restore();

  ctx.fillStyle = 'rgba(9, 17, 33, 0.74)';
  drawRoundedRect(ctx, 52, 1080, 256, 44, 10);
  ctx.fill();
  ctx.fillStyle = '#91adc1';
  ctx.textAlign = 'center';
  ctx.font = '12px monospace';
  ctx.fillText('A LUA ESPERA PELO SEU PROJETO', 180, 1108);
  ctx.fillStyle = '#597589';
  ctx.font = '11px monospace';
  ctx.fillText('USE ↑ ↓ E ENTER OU TOQUE', 180, 1150);
}

function drawOptionsScreen(ctx, state, art) {
  drawTitleBackdrop(ctx, art);
  drawRoundedRect(ctx, 26, 230, 668, 820, 22);
  ctx.fillStyle = 'rgba(7, 16, 34, 0.87)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(96, 197, 222, 0.55)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f7d477';
  ctx.font = 'bold 31px monospace';
  ctx.fillText('OPÇÕES', 360, 296);
  ctx.fillStyle = '#9ab5c8';
  ctx.font = '15px monospace';
  ctx.fillText('DIFICULDADE INICIAL', 360, 338);
  const colors = ['#4ade80', '#53c8ff', '#fbbf24'];
  DIFFICULTY_PRESETS.forEach((preset, index) => {
    const rect = OPTIONS_DIFFICULTY_RECTS[index];
    const selected = state.difficultyId === preset.id;
    const focused = state.optionsSelection === index;
    drawRoundedRect(ctx, rect.x, rect.y, rect.w, rect.h, 16);
    ctx.fillStyle = selected ? 'rgba(17, 48, 64, 0.96)' : 'rgba(12, 25, 45, 0.86)';
    ctx.fill();
    ctx.strokeStyle = focused || selected ? colors[index] : '#526b82';
    ctx.lineWidth = focused ? 3 : selected ? 2 : 1.5;
    ctx.stroke();
    ctx.textAlign = 'left';
    ctx.fillStyle = colors[index];
    ctx.font = 'bold 13px monospace';
    ctx.fillText(preset.cml, rect.x + 22, rect.y + 30);
    ctx.fillStyle = '#eef7fa';
    ctx.font = 'bold 21px monospace';
    ctx.fillText(preset.name, rect.x + 22, rect.y + 66);
    ctx.fillStyle = '#a8bdce';
    ctx.font = '13px sans-serif';
    ctx.fillText(preset.tolerance, rect.x + 22, rect.y + 91);
    ctx.textAlign = 'right';
    ctx.fillStyle = colors[index];
    ctx.font = 'bold 19px monospace';
    ctx.fillText(`$${preset.budgetMax}M`, rect.x + rect.w - 22, rect.y + 67);
    if (selected) {
      ctx.fillStyle = colors[index];
      ctx.font = 'bold 10px monospace';
      ctx.fillText('ATUAL', rect.x + rect.w - 22, rect.y + 31);
    }
  });
  ctx.textAlign = 'center';
  ctx.fillStyle = '#bed0dd';
  ctx.font = '13px monospace';
  ctx.fillText('TOQUE NO TERRENO PARA MOVER  ·  SHIFT OVERDRIVE  ·  P PURGA', 360, 858);
  drawMenuButton(ctx, TITLE_BACK_RECT, 'VOLTAR AO MENU', false, '#65e2c2');
}

function drawManualPanel(ctx, art) {
  drawTitleBackdrop(ctx, art);
  drawRoundedRect(ctx, 23, 58, 674, 1031, 20);
  ctx.fillStyle = 'rgba(5, 13, 29, 0.96)';
  ctx.fill();
  ctx.strokeStyle = '#66839b';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = 'rgba(94, 204, 224, 0.13)';
  ctx.fillRect(24, 60, 12, 1027);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#81e1f3';
  ctx.font = 'bold 12px monospace';
  ctx.fillText('STARFORGE  /  CADERNO DE OPERAÇÕES', 50, 94);
  ctx.fillStyle = '#91a9ba';
  ctx.textAlign = 'right';
  ctx.font = '11px monospace';
  ctx.fillText('FLIGHT MANUAL · REV. 05', 670, 94);
  ctx.strokeStyle = 'rgba(119, 157, 178, 0.44)';
  ctx.beginPath();
  ctx.moveTo(48, 116);
  ctx.lineTo(672, 116);
  ctx.stroke();
}

function drawManualHeading(ctx, page, pageIndex) {
  ctx.textAlign = 'left';
  ctx.fillStyle = '#f4cd71';
  ctx.font = 'bold 11px monospace';
  ctx.fillText(page.eyebrow, 50, 148);
  ctx.fillStyle = '#f2f6f8';
  ctx.font = 'bold 25px monospace';
  ctx.fillText(page.title, 50, 185);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#7c95aa';
  ctx.font = '12px monospace';
  ctx.fillText(`PÁGINA ${String(pageIndex + 1).padStart(2, '0')} / ${MANUAL_PAGES.length}`, 670, 148);
}

function drawManualOverview(ctx, page, art) {
  ctx.fillStyle = '#cbd9e1';
  ctx.textAlign = 'left';
  ctx.font = '14px sans-serif';
  wrapText(ctx, page.intro, 50, 225, 440, 20, 3);
  drawSpriteFit(ctx, art?.title_rocket_ober, 520, 205, 138, 83);
  page.steps.forEach((step, index) => {
    const y = 310 + index * 132;
    drawRoundedRect(ctx, 46, y, 628, 113, 13);
    ctx.fillStyle = '#0c192e';
    ctx.fill();
    ctx.strokeStyle = '#314c66';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.fillStyle = '#59cde5';
    ctx.font = 'bold 19px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(step.number, 62, y + 30);
    ctx.fillStyle = '#f4d174';
    ctx.font = 'bold 14px monospace';
    ctx.fillText(step.title, 112, y + 29);
    ctx.fillStyle = '#d2dfe7';
    ctx.font = '14px sans-serif';
    wrapText(ctx, step.text, 112, y + 55, 530, 19, 3);
  });
  page.missionFacts.forEach((fact, index) => {
    const x = 46 + index * 211;
    drawRoundedRect(ctx, x, 850, 202, 74, 10);
    ctx.fillStyle = '#101f35';
    ctx.fill();
    ctx.strokeStyle = '#3d5b76';
    ctx.stroke();
    ctx.fillStyle = '#91e2f0';
    ctx.textAlign = 'left';
    ctx.font = 'bold 11px monospace';
    wrapText(ctx, fact, x + 13, 878, 176, 16, 3);
  });
}

function drawManualHardware(ctx, page, art) {
  ctx.fillStyle = '#cbd9e1';
  ctx.textAlign = 'left';
  ctx.font = '13px sans-serif';
  wrapText(ctx, page.intro, 50, 223, 615, 18, 2);
  page.modules.forEach((module, index) => {
    const y = 270 + index * 135;
    drawRoundedRect(ctx, 44, y, 632, 126, 12);
    ctx.fillStyle = '#0b192d';
    ctx.fill();
    ctx.strokeStyle = '#344e67';
    ctx.lineWidth = 1.3;
    ctx.stroke();
    drawSpriteFit(ctx, art?.[`lab_${module.id}`], 51, y + 15, 69, 96);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#7de1ed';
    ctx.font = 'bold 12px monospace';
    ctx.fillText(`${module.number}  ${module.label.toUpperCase()}`, 132, y + 22);
    ctx.fillStyle = '#a9bfce';
    ctx.font = '11px sans-serif';
    ctx.fillText(module.summary, 132, y + 42);
    const cols = [
      { item: module.standard, x: 132, color: '#7ee0ae', label: 'PADRÃO' },
      { item: module.advanced, x: 405, color: '#f2c66b', label: 'AVANÇADO' }
    ];
    for (const col of cols) {
      ctx.fillStyle = col.color;
      ctx.font = 'bold 10px monospace';
      ctx.fillText(`${col.label} · ${col.item.name}`, col.x, y + 64, 255);
      ctx.fillStyle = '#d5e0e8';
      ctx.font = '10px monospace';
      ctx.fillText(`M ${col.item.mass}kg · P ${col.item.power >= 0 ? '+' : ''}${col.item.power}W`, col.x, y + 84);
      ctx.fillStyle = '#95aabb';
      ctx.fillText(`CUSTO $${col.item.cost}M · CIÊNCIA ${col.item.science}`, col.x, y + 103);
    }
  });
}

function drawManualRovers(ctx, page, art) {
  ctx.fillStyle = '#cbd9e1';
  ctx.textAlign = 'left';
  ctx.font = '13px sans-serif';
  wrapText(ctx, page.intro, 50, 222, 620, 18, 2);
  page.rovers.forEach((rover, index) => {
    const x = index === 0 ? 45 : 365;
    drawRoundedRect(ctx, x, 270, 306, 286, 14);
    ctx.fillStyle = '#0c1a2e';
    ctx.fill();
    ctx.strokeStyle = index === 0 ? '#57d8e8' : '#e9b965';
    ctx.lineWidth = 2;
    ctx.stroke();
    drawSpriteFit(ctx, art?.[rover.art], x + 85, 282, 136, 104);
    ctx.fillStyle = index === 0 ? '#74e0ec' : '#f2c66b';
    ctx.textAlign = 'center';
    ctx.font = 'bold 11px monospace';
    ctx.fillText(rover.name.toUpperCase(), x + 153, 404);
    ctx.fillStyle = '#d7e3eb';
    ctx.font = '10px monospace';
    ctx.fillText(`M ${rover.mass}kg · P ${rover.power}W · CI ${rover.science}`, x + 153, 446);
    ctx.fillStyle = '#a8bdcc';
    ctx.fillText(`${rover.sampleUnits} AMOSTRA(S) / CRISTAL`, x + 153, 476);
    ctx.fillText(`MEMÓRIA ${rover.memory} · CUSTO ${rover.energy} BATERIA`, x + 153, 498);
    ctx.fillStyle = '#81e4ef';
    ctx.font = 'bold 10px monospace';
    ctx.fillText(index === 0 ? 'SCANNER LASER' : 'PERFURATRIZ', x + 153, 530);
  });
  ctx.textAlign = 'left';
  ctx.fillStyle = '#f4cd71';
  ctx.font = 'bold 12px monospace';
  ctx.fillText('ROTINA DE COLETA', 50, 592);
  page.workflow.forEach((line, index) => {
    ctx.fillStyle = '#67d8e9';
    ctx.font = 'bold 14px monospace';
    ctx.fillText(`${index + 1}.`, 52, 625 + index * 34);
    ctx.fillStyle = '#d2dfe7';
    ctx.font = '13px sans-serif';
    wrapText(ctx, line, 82, 625 + index * 34, 570, 18, 2);
  });
  drawRoundedRect(ctx, 46, 748, 628, 174, 12);
  ctx.fillStyle = '#0b192d';
  ctx.fill();
  ctx.strokeStyle = '#344e67';
  ctx.stroke();
  drawCover(ctx, art?.surface_map_topdown, 58, 760, 230, 150);
  ctx.fillStyle = '#81e4ef';
  ctx.font = 'bold 11px monospace';
  ctx.fillText('NAVEGAÇÃO', 308, 783);
  ctx.fillStyle = '#d2dfe7';
  ctx.font = '12px sans-serif';
  wrapText(ctx, `Toque no terreno para definir o destino. O minimapa acompanha rover, câmera e cristais revelados a ${page.discoveryRadius} unidades.`, 308, 807, 340, 20, 4);
}

function drawManualSurface(ctx, page) {
  ctx.fillStyle = '#cbd9e1';
  ctx.textAlign = 'left';
  ctx.font = '13px sans-serif';
  wrapText(ctx, page.intro, 50, 223, 615, 18, 2);
  page.terrains.forEach((terrain, index) => {
    const y = 264 + index * 70;
    const accent = terrain.id === 'sunlight' ? '#f0ca70' : terrain.id === 'shadow' ? '#8fa8ff' : terrain.id === 'mountain' ? '#c5d0d4' : '#f39b65';
    drawRoundedRect(ctx, 46, y, 628, 62, 11);
    ctx.fillStyle = '#0c192e';
    ctx.fill();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = accent;
    ctx.font = 'bold 12px monospace';
    ctx.fillText(terrain.title, 62, y + 18);
    ctx.fillStyle = '#d2dfe7';
    ctx.font = '11px sans-serif';
    wrapText(ctx, terrain.text, 62, y + 39, 590, 15, 2);
  });
  const rules = page.roverStats;
  const cards = [
    { y: 558, title: 'MOVIMENTO & ROTA', text: `Plano ${rules.plainSpeed}% · rochas ${rules.rockSpeedPercent}% (A* peso 2,4). Clique para traçar uma rota que evita o terreno caro.` },
    { y: 674, title: 'ENERGIA & TEMPERATURA', text: `BAT: parado 0,1/s; movimento ${rules.plainDrain}/${rules.rockDrain}%/s. Solar +${rules.solar}%/s (Economia +${rules.economySolar}); crateras drenam ${rules.craterDrain}%/s.` },
    { y: 790, title: 'TEMPESTADE & SINAL', text: `Alertas em ${rules.stormEasy}/${rules.stormNormal}/${rules.stormHard}s. Economia evita a onda; cratera/montanha bloqueiam o sinal. Envie parado com SINAL OK.` }
  ];
  cards.forEach((card) => {
    drawRoundedRect(ctx, 46, card.y, 628, 102, 11);
    ctx.fillStyle = '#101f35';
    ctx.fill();
    ctx.strokeStyle = '#3b5a74';
    ctx.stroke();
    ctx.fillStyle = '#f1cd75';
    ctx.font = 'bold 11px monospace';
    ctx.fillText(card.title, 62, card.y + 24);
    ctx.fillStyle = '#d1dfe7';
    ctx.font = '12px sans-serif';
    wrapText(ctx, card.text, 62, card.y + 51, 590, 18, 3);
  });
  ctx.fillStyle = '#8098ad';
  ctx.textAlign = 'center';
  ctx.font = '10px monospace';
  ctx.fillText(`GRADE ${page.worldStats.cols}×${page.worldStats.rows} · TILE ${page.worldStats.tileSize}px · SEED ${page.worldStats.seed} · ${page.worldStats.crystalCount} CRISTAIS / ${page.worldStats.sampleGoal} ENTREGAS`, 360, 931);
}

function drawManualTech(ctx, page) {
  ctx.fillStyle = '#cbd9e1'; ctx.textAlign = 'left'; ctx.font = '14px sans-serif';
  wrapText(ctx, page.intro, 50, 224, 620, 19, 3);
  page.steps.forEach((step, index) => {
    const y = 310 + index * 132;
    drawRoundedRect(ctx, 46, y, 628, 112, 13);
    ctx.fillStyle = '#0c192e'; ctx.fill(); ctx.strokeStyle = '#314c66'; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.fillStyle = '#59cde5'; ctx.font = 'bold 19px monospace'; ctx.fillText(step.number, 62, y + 30);
    ctx.fillStyle = '#f4d174'; ctx.font = 'bold 14px monospace'; ctx.fillText(step.title, 112, y + 29);
    ctx.fillStyle = '#d2dfe7'; ctx.font = '14px sans-serif'; wrapText(ctx, step.text, 112, y + 55, 530, 19, 3);
  });
  page.missionFacts.forEach((fact, index) => {
    const x = 46 + index * 211;
    drawRoundedRect(ctx, x, 850, 202, 74, 10); ctx.fillStyle = '#101f35'; ctx.fill(); ctx.strokeStyle = '#3d5b76'; ctx.stroke();
    ctx.fillStyle = '#91e2f0'; ctx.textAlign = 'left'; ctx.font = 'bold 10px monospace'; wrapText(ctx, fact, x + 13, 878, 176, 15, 3);
  });
}

function drawManualScreen(ctx, state, art) {
  const pageIndex = Math.max(0, Math.min(MANUAL_PAGES.length - 1, state.manualPage || 0));
  const page = MANUAL_PAGES[pageIndex];
  drawManualPanel(ctx, art);
  drawManualHeading(ctx, page, pageIndex);
  if (page.id === 'mission-overview') drawManualOverview(ctx, page, art);
  else if (page.id === 'labs-and-hardware') drawManualHardware(ctx, page, art);
  else if (page.id === 'rover-platforms') drawManualRovers(ctx, page, art);
  else if (page.id === 'surface-operations') drawManualSurface(ctx, page);
  else drawManualTech(ctx, page);
  drawMenuButton(ctx, MANUAL_PREV_RECT, '‹  ANTERIOR', pageIndex > 0, '#66dfea');
  drawMenuButton(ctx, MANUAL_NEXT_RECT, 'PRÓXIMA  ›', pageIndex < MANUAL_PAGES.length - 1, '#66dfea');
  ctx.fillStyle = '#8fa9bb';
  ctx.textAlign = 'center';
  ctx.font = '12px monospace';
  ctx.fillText(`${pageIndex + 1} / ${MANUAL_PAGES.length}`, 360, 1040);
  drawMenuButton(ctx, TITLE_BACK_RECT, 'VOLTAR AO MENU', false, '#65e2c2');
}

function drawDifficultySelector(ctx, state, art) {
  drawHangarBackground(ctx, art);
  ctx.fillStyle = '#0d1426';
  ctx.fillRect(0, 660, CANVAS_WIDTH, CANVAS_HEIGHT - 660);
  ctx.fillStyle = '#f8fafc';
  ctx.textAlign = 'center';
  ctx.font = 'bold 28px monospace';
  ctx.fillText('PROJETO DA MISSÃO', CANVAS_WIDTH / 2, 171);
  ctx.fillStyle = '#a8b7ca';
  ctx.font = '18px sans-serif';
  ctx.fillText('Escolha a maturidade e o orçamento da sua missão', CANVAS_WIDTH / 2, 207);

  const cardRects = getDifficultyCardRects();
  const colors = ['#4ade80', '#53c8ff', '#fbbf24'];
  DIFFICULTY_PRESETS.forEach((preset, index) => {
    const rect = cardRects[index];
    const color = colors[index];
    drawRoundedRect(ctx, rect.x, rect.y, rect.w, rect.h, 20);
    ctx.fillStyle = '#10182d';
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.textAlign = 'left';
    ctx.fillStyle = color;
    ctx.font = 'bold 18px monospace';
    ctx.fillText(preset.cml, rect.x + 28, rect.y + 39);
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText(preset.name, rect.x + 28, rect.y + 82);
    ctx.fillStyle = '#a8b7ca';
    ctx.font = '16px sans-serif';
    ctx.fillText(preset.tolerance, rect.x + 28, rect.y + 116);
    ctx.fillStyle = color;
    ctx.font = 'bold 24px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`$${preset.budgetMax}M`, rect.x + rect.w - 28, rect.y + 83);
    ctx.fillStyle = '#718096';
    ctx.font = '14px monospace';
    ctx.fillText(index === 0 ? 'MARGEM AMPLA' : index === 1 ? 'TRADE-OFFS REAIS' : 'TESTE OBRIGATÓRIO', rect.x + rect.w - 28, rect.y + 116);
  });
  ctx.fillStyle = '#52617a';
  ctx.font = '14px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('STARFORGE  /  OPERAÇÃO LUNAR', CANVAS_WIDTH / 2, 1008);
  drawMenuButton(ctx, DIFFICULTY_BACK_RECT, 'VOLTAR AO MENU', false, '#65e2c2');
}

function drawLaunchParticles(ctx, state, art) {
  for (const particle of state.particles || []) {
    const image = particle.kind === 'spark' ? art?.launch_spark : art?.launch_flame;
    if (!image?.naturalWidth || !image?.naturalHeight) continue;
    const alpha = particleAlpha(particle);
    const width = particle.kind === 'spark' ? particle.size : particle.size * 0.68;
    const height = particle.size;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(particle.x, particle.y);
    ctx.rotate(particle.rotation);
    drawSpriteFit(ctx, image, -width / 2, -height / 2, width, height);
    ctx.restore();
  }
}

function drawLaunchScreen(ctx, state, time, layout, art, stats, difficulty) {
  const elapsed = Math.max(0, time - state.launchStartedAt);
  drawHangarBackground(ctx, art);
  drawProgressiveLabs(ctx, state, art);

  if (elapsed < 1.8) {
    state.launchLiftY = 0;
  } else {
    const progress = Math.min(1, (elapsed - 1.8) / 2.8);
    const ease = 1 - Math.pow(1 - progress, 3);
    state.launchLiftY = -ease * 560;
  }
  if (elapsed > 2.0) {
    ctx.fillStyle = `rgba(3, 8, 20, ${Math.min(0.68, (elapsed - 2.0) * 0.22)})`;
    ctx.fillRect(0, 0, CANVAS_WIDTH, 660);
  }

  drawModularVehicle(ctx, state, time, layout, art);
  drawLaunchParticles(ctx, state, art);
  drawTopTelemetryBar(ctx, stats);
  ctx.fillStyle = '#0d1426';
  ctx.fillRect(0, 660, CANVAS_WIDTH, CANVAS_HEIGHT - 660);
  ctx.textAlign = 'center';
  if (elapsed < 1.8) {
    const count = Math.max(1, 3 - Math.floor(elapsed / 0.6));
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 46px monospace';
    ctx.fillText(`T − 0${count}`, CANVAS_WIDTH / 2, 760);
    ctx.fillStyle = '#dbeafe';
    ctx.font = 'bold 20px monospace';
    ctx.fillText('SEQUÊNCIA DE LANÇAMENTO', CANVAS_WIDTH / 2, 806);
    ctx.fillStyle = '#91a4bf';
    ctx.font = '16px sans-serif';
    ctx.fillText(`${difficulty.cml} · validação de sistemas concluída`, CANVAS_WIDTH / 2, 844);
  } else {
    ctx.fillStyle = '#53c8ff';
    ctx.font = 'bold 30px monospace';
    ctx.fillText('ASCENSÃO', CANVAS_WIDTH / 2, 774);
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '17px sans-serif';
    ctx.fillText('Acompanhe a telemetria da missão', CANVAS_WIDTH / 2, 813);
    drawRoundedRect(ctx, 92, 854, 536, 16, 8);
    ctx.fillStyle = '#1d2a43';
    ctx.fill();
    ctx.fillStyle = '#53c8ff';
    ctx.fillRect(100, 862, 520 * Math.min(1, (elapsed - 1.8) / 2.8), 4);
  }
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 5) {
  const words = String(text || '').split(/\s+/);
  let line = '';
  let lines = 0;
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > maxWidth) {
      ctx.fillText(line, x, y + lines * lineHeight);
      line = word;
      lines += 1;
      if (lines >= maxLines) return;
    } else {
      line = next;
    }
  }
  if (line && lines < maxLines) ctx.fillText(line, x, y + lines * lineHeight);
}

function drawResultScreen(ctx, state, time, layout, art, stats, difficulty) {
  drawHangarBackground(ctx, art);
  drawProgressiveLabs(ctx, state, art);
  if (state.launchResult?.success) state.launchLiftY = -560;
  else state.launchLiftY = 0;
  drawModularVehicle(ctx, state, time, layout, art);
  drawTopTelemetryBar(ctx, stats);
  ctx.fillStyle = '#0d1426';
  ctx.fillRect(0, 660, CANVAS_WIDTH, CANVAS_HEIGHT - 660);

  const success = Boolean(state.launchResult?.success);
  const color = success ? '#43d9a4' : '#ff758f';
  const panel = { x: 36, y: 190, w: 648, h: 700 };
  drawRoundedRect(ctx, panel.x, panel.y, panel.w, panel.h, 24);
  ctx.fillStyle = '#10182d';
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.font = 'bold 18px monospace';
  ctx.fillText(state.launchResult?.cml || difficulty.cml, CANVAS_WIDTH / 2, panel.y + 52);
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 30px monospace';
  ctx.fillText(success ? 'ÓRBITA ALCANÇADA' : 'LANÇAMENTO ABORTADO', CANVAS_WIDTH / 2, panel.y + 104);

  if (success) {
    drawSpriteFit(ctx, art?.[`satellite_${state.equipped.satellite}`], 272, panel.y + 132, 176, 132);
  } else {
    drawSpriteFit(ctx, art?.guide_panic, 258, panel.y + 118, 204, 150);
  }

  ctx.fillStyle = success ? '#cbd5e1' : '#ffd2da';
  ctx.textAlign = 'left';
  ctx.font = success ? '18px sans-serif' : '16px sans-serif';
  if (success) {
    wrapText(ctx, state.launchResult?.message, panel.x + 34, panel.y + 300, panel.w - 68, 30, 3);
  } else {
    wrapText(ctx, getLaunchRoast(state.launchResult?.failureCause), panel.x + 34, panel.y + 290, panel.w - 68, 22, 6);
  }

  const issues = state.launchResult?.issues || [];
  const issuesTop = success ? 390 : 462;
  if (issues.length) {
    ctx.fillStyle = '#ffb3c1';
    ctx.textAlign = 'left';
    ctx.font = 'bold 16px monospace';
    ctx.fillText('VALIDAÇÃO', panel.x + 34, panel.y + issuesTop);
    ctx.font = '15px sans-serif';
    issues.slice(0, 5).forEach((issue, index) => {
      wrapText(ctx, `• ${issue}`, panel.x + 34, panel.y + issuesTop + 34 + index * 43, panel.w - 68, 20, 2);
    });
  } else {

    ctx.fillStyle = '#91a4bf';
    ctx.font = '17px sans-serif';
    ctx.fillText('Massa, potência, margem e laboratórios verificados.', panel.x + 34, panel.y + 392);
  }

  const button = layout.actionButton;
  drawRoundedRect(ctx, button.x, 1122, button.w, 110, 18);
  ctx.fillStyle = '#13213a';
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.font = 'bold 22px monospace';
  ctx.fillText(success ? 'IR PARA A SUPERFÍCIE' : 'VOLTAR À BASE', CANVAS_WIDTH / 2, 1166);
  ctx.fillStyle = '#b8c6d9';
  ctx.font = '15px sans-serif';
  ctx.fillText(success ? 'Começar exploração do Polo Sul lunar' : 'Ajuste os módulos e tente novamente', CANVAS_WIDTH / 2, 1198);
}

export function renderFrame(ctx, state, stats, time) {
  if (state.screen === 'surface' || state.screen === 'surfaceResult') {
    renderSurfaceFrame(ctx, state, time, state.art);
    return;
  }
  const layout = getAssemblyLayout(state.padPos, state.vehicleScale);
  const difficulty = DIFFICULTY_PRESETS.find((item) => item.id === state.difficultyId) || DIFFICULTY_PRESETS[1];
  ctx.imageSmoothingEnabled = false;

  if (state.screen === 'title') {
    drawTitleScreen(ctx, state, state.art, time);
    return;
  }
  if (state.screen === 'options') {
    drawOptionsScreen(ctx, state, state.art);
    return;
  }
  if (state.screen === 'controls') {
    drawManualScreen(ctx, state, state.art);
    return;
  }
  if (state.screen === 'difficulty') {
    drawDifficultySelector(ctx, state, state.art);
    return;
  }

  if (state.screen === 'launch') {
    drawLaunchScreen(ctx, state, time, layout, state.art, stats, difficulty);
    return;
  }

  if (state.screen === 'result') {
    drawResultScreen(ctx, state, time, layout, state.art, stats, difficulty);
    return;
  }

  drawHangarBackground(ctx, state.art);
  drawProgressiveLabs(ctx, state, state.art);
  drawTopTelemetryBar(ctx, stats);
  drawModularVehicle(ctx, state, time, layout, state.art);
  drawBottomControls(ctx, state, layout, state.art, stats, difficulty);
  drawAssemblyGuide(ctx, state, stats, state.art);
}
