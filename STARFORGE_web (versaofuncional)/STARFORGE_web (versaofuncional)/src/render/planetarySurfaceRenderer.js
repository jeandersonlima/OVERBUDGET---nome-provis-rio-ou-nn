/** Portrait-first pixel-art rendering for the deterministic 1994 lunar grid phase. */
import {
  GRID_COLS, GRID_ROWS, GRID_TILE_SIZE, GRID_MAP_X, GRID_MAP_Y,
  SAMPLE_GOAL
} from '../core/planetaryGridRules.js';
import { SURFACE_CONTROL_RECTS, SURFACE_RESULT_RECTS } from '../core/layout.js';
import { getSurfaceRoast } from '../core/failureMessages.js';

const palette = {
  ink: '#070b11', panel: '#101822', panel2: '#151f2a', edge: '#35434a',
  text: '#e7e1cb', muted: '#9a9d92', green: '#84d894', cyan: '#86efff', amber: '#f5b74f', red: '#ff6262'
};
const cell = (x, y) => y * GRID_COLS + x;

export const LANDSCAPE_SURFACE_CONTROL_RECTS = [
  { id: 'move', x: 950, y: 516, w: 146, h: 70 },
  { id: 'collect', x: 1106, y: 516, w: 146, h: 70 },
  { id: 'transmit', x: 950, y: 596, w: 146, h: 70 },
  { id: 'economy', x: 1106, y: 596, w: 146, h: 70 }
];
export const LANDSCAPE_SURFACE_RESULT_RECTS = [
  { id: 'retry', x: 700, y: 575, w: 230, h: 84 },
  { id: 'base', x: 960, y: 575, w: 230, h: 84 }
];

function rounded(ctx, x, y, w, h, r = 8) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath(); ctx.moveTo(x + radius, y); ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius); ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h); ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius); ctx.lineTo(x, y + radius); ctx.closePath();
}
function panel(ctx, x, y, w, h, fill = palette.panel) {
  rounded(ctx, x, y, w, h, 9); ctx.fillStyle = fill; ctx.fill();
  ctx.strokeStyle = palette.edge; ctx.lineWidth = 2; ctx.stroke();
}
function text(ctx, value, x, y, size = 15, color = palette.text, align = 'left', weight = 'normal') {
  ctx.font = `${weight} ${size}px monospace`; ctx.fillStyle = color; ctx.textAlign = align;
  ctx.textBaseline = 'middle'; ctx.fillText(String(value), x, y);
}
function textWrapped(ctx, value, x, y, maxWidth, size = 15, color = palette.text, align = 'left', weight = 'normal', lineHeight = size + 6, maxLines = 2) {
  ctx.font = `${weight} ${size}px monospace`;
  const lines = [];
  let line = '';
  for (const word of String(value).split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > maxWidth) { lines.push(line); line = word; } else { line = next; }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) { lines.length = maxLines; lines[maxLines - 1] = lines[maxLines - 1].replace(/\s*\S*$/, '') + '…'; }
  lines.forEach((l, i) => text(ctx, l, x, y + i * lineHeight, size, color, align, weight));
}
function bar(ctx, x, y, w, h, value, color) {
  ctx.fillStyle = '#06090d'; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color; ctx.fillRect(x + 2, y + 2, Math.max(0, (w - 4) * Math.max(0, Math.min(1, value / 100))), h - 4);
  ctx.strokeStyle = '#53626a'; ctx.strokeRect(x, y, w, h);
}
function fmtTime(seconds) {
  const s = Math.floor(seconds); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function drawPlainTile(ctx, x, y, seed) {
  ctx.fillStyle = seed % 3 === 0 ? '#807b70' : '#777369'; ctx.fillRect(x, y, 24, 24);
  ctx.fillStyle = '#989184';
  ctx.fillRect(x + 3 + seed % 11, y + 4 + seed % 7, 2, 2);
  ctx.fillStyle = '#605d57'; ctx.fillRect(x + 14 + seed % 5, y + 15 + seed % 4, 3, 2);
  ctx.fillStyle = 'rgba(205,196,171,0.18)'; ctx.fillRect(x, y, 24, 1);
}
function drawTerrainTile(ctx, terrain, x, y, gx, gy, seed) {
  if (terrain === 'PLAIN') drawPlainTile(ctx, x, y, (gx * 19 + gy * 29 + seed) >>> 0);
  else if (terrain === 'ROCK') {
    ctx.fillStyle = '#51483d'; ctx.fillRect(x, y, 24, 24);
    const n = (gx * 31 + gy * 17 + seed) >>> 0;
    ctx.fillStyle = '#756653'; ctx.fillRect(x + 3 + n % 4, y + 4 + n % 3, 8, 6);
    ctx.fillStyle = '#302d2b'; ctx.fillRect(x + 13 + n % 3, y + 14 + n % 4, 8, 7);
    ctx.fillStyle = '#9a8060'; ctx.fillRect(x + 5 + n % 4, y + 5 + n % 3, 3, 2);
  } else if (terrain === 'CRATER') {
    ctx.fillStyle = '#262d3a'; ctx.fillRect(x, y, 24, 24);
    ctx.fillStyle = '#353747'; ctx.fillRect(x + 2, y + 2, 20, 4);
    ctx.fillStyle = '#161c28'; ctx.fillRect(x + 4, y + 6, 16, 13);
    ctx.fillStyle = '#404253'; ctx.fillRect(x + 5, y + 18, 15, 3);
  } else {
    ctx.fillStyle = '#6d767c'; ctx.fillRect(x, y, 24, 24);
    ctx.fillStyle = '#93999a'; ctx.fillRect(x + 2, y + 2, 17, 6);
    ctx.fillStyle = '#525a60'; ctx.fillRect(x + 3, y + 8, 18, 13);
    ctx.fillStyle = '#abb0ae'; ctx.fillRect(x + 5, y + 8, 9, 3);
    ctx.fillStyle = '#333b41'; ctx.fillRect(x + 17, y + 10, 5, 11);
  }
  ctx.strokeStyle = 'rgba(8,12,16,0.18)'; ctx.strokeRect(x, y, 24, 24);
}

function drawCrystal(ctx, x, y, time) {
  const flicker = 0.78 + Math.sin(time * 5 + x) * 0.16;
  ctx.save(); ctx.globalAlpha = flicker;
  ctx.fillStyle = '#68dff3'; ctx.beginPath(); ctx.moveTo(x + 12, y + 3); ctx.lineTo(x + 20, y + 13); ctx.lineTo(x + 12, y + 21); ctx.lineTo(x + 5, y + 13); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#cbffff'; ctx.fillRect(x + 10, y + 7, 3, 9); ctx.fillStyle = '#9af5ff'; ctx.fillRect(x + 13, y + 12, 4, 3);
  ctx.restore();
}
function drawRover(ctx, rover, time) {
  const x = GRID_MAP_X + rover.x * GRID_TILE_SIZE;
  const y = GRID_MAP_Y + rover.y * GRID_TILE_SIZE;
  const blink = Math.sin(time * 8) > 0;
  if (rover.path.length) {
    ctx.save(); ctx.strokeStyle = 'rgba(122,232,145,0.68)'; ctx.lineWidth = 3; ctx.setLineDash([8, 7]);
    ctx.beginPath(); ctx.moveTo(x, y);
    for (const p of rover.path) ctx.lineTo(GRID_MAP_X + (p.x + 0.5) * GRID_TILE_SIZE, GRID_MAP_Y + (p.y + 0.5) * GRID_TILE_SIZE);
    ctx.stroke(); ctx.restore();
  }
  if (rover.clickPulse > 0) {
    const pulse = (0.8 - rover.clickPulse) / 0.8;
    ctx.strokeStyle = `rgba(132,216,148,${1 - pulse})`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, 12 + pulse * 22, 0, Math.PI * 2); ctx.stroke();
  }
  const shake = rover.payload === 'advanced' && rover.activity?.type === 'collect' ? Math.sin(time * 46) * 2 : 0;
  // Wheel pods and chassis.
  ctx.fillStyle = '#151b20'; ctx.fillRect(x - 12 + shake, y - 10, 5, 20); ctx.fillRect(x + 7 + shake, y - 10, 5, 20);
  for (let i = -1; i <= 1; i += 1) { ctx.fillStyle = '#8c948d'; ctx.fillRect(x - 12 + shake, y + i * 6 - 1, 5, 2); ctx.fillRect(x + 7 + shake, y + i * 6 - 1, 5, 2); }
  ctx.fillStyle = '#b9ad8b'; ctx.fillRect(x - 7 + shake, y - 8, 14, 16);
  ctx.fillStyle = '#384a4f'; ctx.fillRect(x - 4 + shake, y - 5, 8, 10);
  if (rover.powerSource === 'solar') {
    ctx.fillStyle = '#28639a'; ctx.fillRect(x - 20, y - 5, 9, 10); ctx.fillRect(x + 11, y - 5, 9, 10);
    ctx.fillStyle = '#70c8eb'; ctx.fillRect(x - 18, y - 3, 5, 2); ctx.fillRect(x + 13, y - 3, 5, 2);
  } else {
    ctx.fillStyle = '#eb8a36'; ctx.fillRect(x - 18, y - 6, 4, 12); ctx.fillRect(x + 14, y - 6, 4, 12);
    ctx.fillStyle = '#ffbf64'; ctx.fillRect(x - 19, y - 8, 6, 2); ctx.fillRect(x + 13, y - 8, 6, 2);
  }
  if (rover.payload === 'advanced') {
    ctx.fillStyle = '#a9a89d'; ctx.fillRect(x - 2 + shake, y + 7, 4, 9);
    ctx.fillStyle = '#ffcc68'; ctx.fillRect(x - 3 + shake, y + 15, 6, 3);
  } else {
    ctx.strokeStyle = '#ee4b49'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y - 6); ctx.lineTo(x, y - 18); ctx.stroke();
    if (rover.activity?.type === 'collect') { ctx.fillStyle = 'rgba(255,45,45,0.42)'; ctx.fillRect(x - 5, y - 24, 10, 7); }
  }
  ctx.fillStyle = '#c7c2ac'; ctx.fillRect(x - 2, y - 13, 4, 5);
  if (rover.antenna === 'advanced') {
    ctx.strokeStyle = '#e4e6d1'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y - 15, 7, Math.PI, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#f0e8bd'; ctx.fillRect(x - 2, y - 19, 4, 3);
  } else { ctx.fillStyle = '#d5d2b8'; ctx.fillRect(x + 4, y - 18, 2, 8); }
  // RTS corner brackets.
  if (blink) {
    ctx.strokeStyle = '#82f295'; ctx.lineWidth = 2;
    const corners = [[-16,-15,1,1],[16,-15,-1,1],[-16,15,1,-1],[16,15,-1,-1]];
    for (const [cx, cy, sx, sy] of corners) { ctx.beginPath(); ctx.moveTo(x + cx, y + cy + sy * 7); ctx.lineTo(x + cx, y + cy); ctx.lineTo(x + cx + sx * 7, y + cy); ctx.stroke(); }
  }
  if (rover.economy) { text(ctx, 'ZZZ', x + 21, y - 21 - Math.sin(time * 2) * 3, 12, '#c3e9ff', 'left', 'bold'); }
}

function drawMap(ctx, rover, time) {
  const map = rover.map;
  ctx.save(); ctx.beginPath(); ctx.rect(GRID_MAP_X, GRID_MAP_Y, GRID_COLS * 24, GRID_ROWS * 24); ctx.clip();
  ctx.fillStyle = '#000'; ctx.fillRect(GRID_MAP_X, GRID_MAP_Y, 720, 480);
  for (let y = 0; y < GRID_ROWS; y += 1) for (let x = 0; x < GRID_COLS; x += 1) {
    const i = cell(x, y); if (!rover.seen[i]) continue;
    const px = GRID_MAP_X + x * 24; const py = GRID_MAP_Y + y * 24;
    drawTerrainTile(ctx, map.terrain[i], px, py, x, y, map.seed);
    const crystal = map.crystals.find((item) => item.x === x && item.y === y);
    if (crystal?.collected) { ctx.fillStyle = '#191c20'; ctx.fillRect(px + 5, py + 8, 14, 10); ctx.fillStyle = '#303438'; ctx.fillRect(px + 7, py + 10, 9, 4); }
    else if (crystal && rover.visible[i]) drawCrystal(ctx, px, py, time);
    if (!rover.visible[i]) { ctx.fillStyle = 'rgba(0,0,0,0.52)'; ctx.fillRect(px, py, 24, 24); }
  }
  // Command path and rover render above the fog mask.
  drawRover(ctx, rover, time);
  if (rover.stormPhase === 'wave' && rover.stormWaveX >= 0) {
    const waveX = GRID_MAP_X + rover.stormWaveX * 24;
    ctx.fillStyle = 'rgba(255,184,55,0.20)'; ctx.fillRect(waveX - 45, GRID_MAP_Y, 90, 480);
    ctx.strokeStyle = 'rgba(255,217,100,0.9)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(waveX, GRID_MAP_Y); ctx.lineTo(waveX, GRID_MAP_Y + 480); ctx.stroke();
  }
  if (rover.stormPhase === 'warning' && Math.floor(time * 5) % 2 === 0) { ctx.fillStyle = 'rgba(255,110,32,0.13)'; ctx.fillRect(GRID_MAP_X, GRID_MAP_Y, 720, 480); }
  ctx.restore();
  ctx.strokeStyle = '#778078'; ctx.lineWidth = 2; ctx.strokeRect(GRID_MAP_X, GRID_MAP_Y, 720, 480);
}

function drawTopHud(ctx, rover) {
  ctx.fillStyle = '#0b1118'; ctx.fillRect(0, 0, 720, 104);
  text(ctx, 'STARFORGE', 16, 22, 18, '#cadccf', 'left', 'bold');
  text(ctx, `T ${fmtTime(rover.missionTime)}`, 702, 88, 12, palette.amber, 'right', 'bold');
  text(ctx, `ORÇ $${Math.round(rover.budgetSpent ?? 0)}M`, 20, 60, 14, palette.text, 'left', 'bold');
  text(ctx, `MASSA ${Math.round(rover.totalMass ?? 0)} KG`, 174, 60, 14, palette.text, 'left', 'bold');
  text(ctx, `BAT ${String(Math.round(rover.battery)).padStart(3, '0')}%`, 380, 60, 14, rover.battery < 25 ? palette.red : palette.green, 'left', 'bold');
  text(ctx, `AMOSTRAS ${rover.delivered}/${SAMPLE_GOAL}`, 554, 60, 14, palette.cyan, 'left', 'bold');
  const difficulty = rover.difficultyId === 'beginner' ? 'FÁCIL' : rover.difficultyId === 'director' ? 'DIFÍCIL' : 'NORMAL';
  text(ctx, `${rover.map.label} · ${difficulty}`, 18, 88, 11, palette.muted);
  if (rover.stormPhase === 'warning') text(ctx, `TEMPESTADE ${rover.stormSeconds ?? ''}s · ATIVE ECONOMIA [S]`, 700, 88, 12, palette.red, 'right', 'bold');
}

function drawLogs(ctx, rover, time) {
  ctx.fillStyle = '#030504'; ctx.fillRect(0, 598, 720, 64);
  ctx.strokeStyle = rover.stormPhase === 'warning' && Math.floor(time * 6) % 2 === 0 ? palette.red : '#1f3827'; ctx.strokeRect(1, 599, 718, 62);
  const logs = rover.logs.slice(-3);
  logs.forEach((line, i) => {
    const alert = /IMPACTO|ALERTA|ESGOTADA|DESTRUÍDOS|SUPERAQUECIDOS/.test(line);
    const color = alert ? (Math.floor(time * 6) % 2 ? palette.red : palette.amber) : '#83dd8b';
    text(ctx, line, 12, 610 + i * 17, 12, color, 'left', alert ? 'bold' : 'normal');
  });
}

function drawMinimap(ctx, rover, time) {
  panel(ctx, 16, 674, 250, 188, '#10171e');
  text(ctx, 'RADAR / MAPA', 28, 691, 12, palette.cyan, 'left', 'bold');
  text(ctx, 'TERRA ^', 140, 708, 10, '#dad9c5', 'center', 'bold');
  const ox = 42; const oy = 724; const s = 6;
  ctx.fillStyle = '#070b10'; ctx.fillRect(ox, oy, GRID_COLS * s, GRID_ROWS * s);
  for (let y = 0; y < GRID_ROWS; y += 1) for (let x = 0; x < GRID_COLS; x += 1) {
    const i = cell(x, y); if (!rover.seen[i]) continue;
    const terrain = rover.map.terrain[i];
    ctx.fillStyle = terrain === 'MOUNT' ? '#9aa3a2' : terrain === 'CRATER' ? '#303648' : terrain === 'ROCK' ? '#62513e' : '#706e65';
    ctx.fillRect(ox + x * s, oy + y * s, s, s);
    const crystal = rover.map.crystals.find((c) => c.x === x && c.y === y && !c.collected);
    if (crystal) { ctx.fillStyle = '#75edff'; ctx.fillRect(ox + x * s + 1, oy + y * s + 1, 4, 4); }
  }
  if (Math.sin(time * 7) > -0.1) { ctx.fillStyle = '#ff4444'; ctx.fillRect(ox + Math.floor(rover.x) * s, oy + Math.floor(rover.y) * s, 6, 6); }
  text(ctx, rover.signal ? 'SINAL OK' : 'SEM SINAL', 32, 853, 11, rover.signal ? palette.green : palette.red, 'left', 'bold');
}

function drawGuide(ctx, rover, time, art) {
  panel(ctx, 280, 674, 424, 332, '#10171e');
  const mood = rover.stormPhase === 'warning' || rover.stormPhase === 'wave' ? 'guide_panic'
    : rover.battery < 25 ? 'guide_worried'
      : rover.delivered >= SAMPLE_GOAL ? 'guide_happy' : 'guide_calm';
  const image = art?.[mood];
  const stormAlarm = rover.stormPhase === 'warning' || rover.stormPhase === 'wave';
  ctx.fillStyle = stormAlarm && Math.floor(time * 7) % 2 ? '#682a2a' : '#1b2930';
  ctx.fillRect(296, 690, 92, 106);
  if (image?.naturalWidth && image?.naturalHeight) {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(image, 296, 690, 92, 106);
    if (Math.sin(time * 3.4) > 0.97) {
      ctx.fillStyle = '#261e20'; ctx.fillRect(328, 729, 10, 3); ctx.fillRect(347, 729, 10, 3);
    }
  } else {
    // Procedural pixel-art engineer portrait fallback.
    ctx.fillStyle = rover.stormPhase === 'wave' && Math.floor(time * 7) % 2 ? '#782d2d' : '#1b2930'; ctx.fillRect(296, 690, 92, 106);
    ctx.fillStyle = '#d9b899'; ctx.fillRect(323, 707, 39, 47); ctx.fillStyle = '#e4d8b5'; ctx.fillRect(319, 700, 47, 15);
    ctx.fillStyle = '#151e25'; ctx.fillRect(331, 724, 5, 4); ctx.fillRect(350, 724, 5, 4);
    ctx.fillStyle = '#718a94'; ctx.fillRect(314, 756, 56, 33);
  }
  text(ctx, rover.stormPhase === 'warning' || rover.stormPhase === 'wave' ? 'ALARM' : rover.battery < 25 ? 'WORRY' : rover.delivered >= SAMPLE_GOAL ? 'HAPPY' : 'IDLE', 342, 805, 10, palette.amber, 'center', 'bold');
  text(ctx, rover.signal ? '■ SINAL OK' : '■ SEM SINAL', 404, 698, 13, rover.signal ? palette.green : palette.red, 'left', 'bold');
  text(ctx, `VEL ${String(Math.round(rover.speedPercent)).padStart(2, '0')}%`, 690, 698, 13, palette.text, 'right', 'bold');
  text(ctx, `MEMÓRIA ${rover.memory}/${rover.memoryCapacity}`, 404, 727, 12, palette.text, 'left', 'bold');
  for (let i = 0; i < rover.memoryCapacity; i += 1) {
    ctx.fillStyle = i < rover.memory ? '#80eaff' : '#202a30'; ctx.fillRect(404 + i * 28, 741, 20, 14);
    ctx.strokeStyle = '#5d8289'; ctx.strokeRect(404 + i * 28, 741, 20, 14);
  }
  const row = (label, value, y, color) => { text(ctx, label, 404, y, 11, palette.muted, 'left', 'bold'); bar(ctx, 456, y - 7, 190, 14, value, color); text(ctx, `${Math.round(value)}%`, 692, y, 10, palette.text, 'right'); };
  row('BAT', rover.battery, 777, rover.battery < 25 ? palette.red : '#5dd47b');
  row('TERM', rover.temperature, 802, rover.temperature > 70 ? palette.red : palette.amber);
  row('CIRC', rover.circuits, 827, rover.circuits < 25 ? palette.red : '#6aca83');
  text(ctx, `TECH ${rover.techIndex}% · CIÊNCIA ${rover.scienceYield}/${rover.scienceThreshold}`, 298, 871, 11, rover.scienceYield < rover.scienceThreshold ? palette.amber : palette.cyan);
  text(ctx, `MEMÓRIA: ${rover.payload === 'advanced' ? 'PERFURATRIZ' : 'SCANNER LASER'} · ANTENA ${rover.antenna === 'advanced' ? 'ALTO GANHO' : 'SIMPLES'}`, 298, 894, 10, '#b3c0b6');
  if (rover.activity) {
    ctx.fillStyle = '#2b2315'; ctx.fillRect(298, 921, 390, 18);
    ctx.fillStyle = '#eab447'; ctx.fillRect(300, 923, 386 * Math.min(1, rover.activity.elapsed / rover.activity.duration), 14);
    text(ctx, rover.activity.type === 'collect' ? 'COLETANDO...' : 'TRANSMITINDO...', 298, 957, 11, palette.amber, 'left', 'bold');
  } else if (rover.overheated) text(ctx, 'MOTORES SUPERAQUECIDOS', 298, 942, 13, palette.red, 'left', 'bold');
  else text(ctx, rover.economy ? 'MODO ECONOMIA ATIVO' : 'SISTEMAS ATIVOS', 298, 942, 11, rover.economy ? palette.cyan : palette.muted);
}

function drawButton(ctx, rect, label, icon, active, time) {
  panel(ctx, rect.x, rect.y, rect.w, rect.h, active ? '#23353c' : '#141e27');
  const color = active ? palette.cyan : '#9ed3a7';
  ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const x = rect.x + 32; const y = rect.y + rect.h / 2;
  if (icon === 'move') { ctx.beginPath(); ctx.moveTo(x - 12, y); ctx.lineTo(x + 12, y); ctx.moveTo(x, y - 12); ctx.lineTo(x, y + 12); ctx.stroke(); ctx.fillRect(x - 2, y - 2, 4, 4); }
  else if (icon === 'collect') { ctx.beginPath(); ctx.moveTo(x, y - 14); ctx.lineTo(x - 12, y + 9); ctx.lineTo(x + 12, y + 9); ctx.closePath(); ctx.stroke(); ctx.fillRect(x - 2, y - 4, 4, 10); }
  else if (icon === 'transmit') { ctx.beginPath(); ctx.arc(x, y + 9, 4, Math.PI, 0); ctx.arc(x, y + 9, 11, Math.PI, 0); ctx.stroke(); ctx.fillRect(x - 2, y + 9, 4, 7); }
  else { text(ctx, 'ZZZ', x, y, 16, active ? palette.cyan : palette.muted, 'center', 'bold'); }
  text(ctx, label, rect.x + 64, y, 15, color, 'left', 'bold');
  if (active) { ctx.fillStyle = `rgba(105,225,255,${0.15 + Math.sin(time * 5) * 0.05})`; ctx.fillRect(rect.x + rect.w - 14, rect.y + 10, 4, rect.h - 20); }
}

function drawControls(ctx, rover, time) {
  drawButton(ctx, SURFACE_CONTROL_RECTS[0], 'MOVER [M]', 'move', false, time);
  drawButton(ctx, SURFACE_CONTROL_RECTS[1], 'COLETAR [C]', 'collect', rover.activity?.type === 'collect', time);
  drawButton(ctx, SURFACE_CONTROL_RECTS[2], 'TRANSMITIR [T]', 'transmit', rover.activity?.type === 'transmit', time);
  drawButton(ctx, SURFACE_CONTROL_RECTS[3], 'ECONOMIA [S]', 'economy', rover.economy, time);
}

function drawSurfaceResult(ctx, state, art) {
  const success = state.rover?.missionComplete || state.surfaceResult?.success;
  ctx.fillStyle = 'rgba(3,7,11,0.88)'; ctx.fillRect(0, 0, 720, 1280);
  panel(ctx, 30, 168, 660, 950, '#111921');
  text(ctx, success ? 'RELATÓRIO DE MISSÃO' : 'FALHA NA SUPERFÍCIE', 360, 226, 27, success ? palette.green : palette.red, 'center', 'bold');
  const portrait = art?.[success ? 'guide_happy' : 'guide_panic'];
  if (portrait?.naturalWidth) { ctx.imageSmoothingEnabled = false; ctx.drawImage(portrait, 278, 258, 164, 180); }
  textWrapped(ctx, success ? 'AMOSTRAS TRANSMITIDAS' : state.rover?.failureReason || state.surfaceResult?.reason || 'SISTEMA CRÍTICO', 360, 460, 610, 16, success ? palette.cyan : palette.amber, 'center', 'bold', 22, 2);;
  const report = state.rover;
  const rows = [
    `AMOSTRAS ENTREGUES  ${report?.delivered ?? 0}/3`,
    `AMOSTRAS COLETADAS  ${report?.collectionCount ?? 0}/4`,
    `TECH INDEX  ${report?.techIndex ?? 0}%`,
    `RENDIMENTO CIENTÍFICO  ${report?.scienceYield ?? 0}/${report?.scienceThreshold ?? 60}`,
    `BATERIA  ${Math.round(report?.battery ?? 0)}%   CIRCUITOS  ${Math.round(report?.circuits ?? 0)}%`,
    `TEMPO DE MISSÃO  ${fmtTime(report?.missionTime ?? 0)}`,
    report?.map?.label ?? 'POLO SUL LUNAR · SEED 1994'
  ];
  rows.forEach((line, i) => text(ctx, line, 360, 526 + i * 37, 15, i === 0 && success ? palette.green : palette.text, 'center'));
  if (!success) {
    const quote = getSurfaceRoast({ failureKind: report?.failureKind, techIndex: report?.techIndex });
    const lines = quote.match(/.{1,55}(?:\s|$)/g)?.slice(0, 4) ?? [quote];
    lines.forEach((line, i) => text(ctx, line.trim(), 360, 824 + i * 23, 12, '#cfbfa7', 'center'));
  }
  drawButton(ctx, SURFACE_RESULT_RECTS[0], 'REPETIR', 'move', false, 0);
  drawButton(ctx, SURFACE_RESULT_RECTS[1], 'BASE', 'move', false, 0);
}

export function renderSurfaceFrame(ctx, state, time, art = {}) {
  const rover = state.rover;
  if (state.screen === 'surfaceResult') { drawSurfaceResult(ctx, state, art); return; }
  ctx.fillStyle = palette.ink; ctx.fillRect(0, 0, 720, 1280);
  drawTopHud(ctx, rover);
  drawMap(ctx, rover, time);
  drawLogs(ctx, rover, time);
  drawMinimap(ctx, rover, time);
  drawGuide(ctx, rover, time, art);
  drawControls(ctx, rover, time);
}

function drawLandscapeHeader(ctx, rover) {
  ctx.fillStyle = '#0b1118'; ctx.fillRect(0, 0, 1280, 64);
  text(ctx, 'STARFORGE', 18, 24, 18, '#cadccf', 'left', 'bold');
  text(ctx, `ORÇ $${Math.round(rover.budgetSpent ?? 0)}M`, 292, 24, 13, palette.text, 'left', 'bold');
  text(ctx, `MASSA ${Math.round(rover.totalMass ?? 0)} KG`, 426, 24, 13, palette.text, 'left', 'bold');
  text(ctx, `BAT ${String(Math.round(rover.battery)).padStart(3, '0')}%`, 590, 24, 13, rover.battery < 25 ? palette.red : palette.green, 'left', 'bold');
  text(ctx, `AMOSTRAS ${rover.delivered}/${SAMPLE_GOAL}`, 744, 24, 13, palette.cyan, 'left', 'bold');
  text(ctx, `T ${fmtTime(rover.missionTime)}`, 1040, 24, 14, palette.amber, 'left', 'bold');
}

function drawLandscapeRadar(ctx, rover, time) {
  text(ctx, 'RADAR', 952, 91, 11, palette.cyan, 'left', 'bold');
  text(ctx, 'TERRA ^', 1101, 102, 9, '#dcd8c7', 'center', 'bold');
  const ox = 1026; const oy = 111; const size = 5;
  ctx.fillStyle = '#060a0e'; ctx.fillRect(ox, oy, GRID_COLS * size, GRID_ROWS * size);
  for (let y = 0; y < GRID_ROWS; y += 1) for (let x = 0; x < GRID_COLS; x += 1) {
    const i = cell(x, y); if (!rover.seen[i]) continue;
    const terrain = rover.map.terrain[i];
    ctx.fillStyle = terrain === 'MOUNT' ? '#9aa3a2' : terrain === 'CRATER' ? '#303648' : terrain === 'ROCK' ? '#62513e' : '#706e65';
    ctx.fillRect(ox + x * size, oy + y * size, size, size);
    const crystal = rover.map.crystals.find((c) => c.x === x && c.y === y && !c.collected);
    if (crystal) { ctx.fillStyle = '#75edff'; ctx.fillRect(ox + x * size + 1, oy + y * size + 1, 3, 3); }
  }
  if (Math.sin(time * 7) > -0.1) { ctx.fillStyle = '#ff4444'; ctx.fillRect(ox + Math.floor(rover.x) * size, oy + Math.floor(rover.y) * size, 5, 5); }
}

function drawLandscapeButton(ctx, rect, label, icon, active, time) {
  panel(ctx, rect.x, rect.y, rect.w, rect.h, active ? '#23353c' : '#141e27');
  const color = active ? palette.cyan : '#9ed3a7';
  const x = rect.x + 18; const y = rect.y + rect.h / 2;
  ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.lineCap = 'round';
  if (icon === 'move') { ctx.beginPath(); ctx.moveTo(x - 7, y); ctx.lineTo(x + 7, y); ctx.moveTo(x, y - 7); ctx.lineTo(x, y + 7); ctx.stroke(); }
  else if (icon === 'collect') { ctx.beginPath(); ctx.moveTo(x, y - 8); ctx.lineTo(x - 7, y + 7); ctx.lineTo(x + 7, y + 7); ctx.closePath(); ctx.stroke(); }
  else if (icon === 'transmit') { ctx.beginPath(); ctx.arc(x, y + 6, 4, Math.PI, 0); ctx.arc(x, y + 6, 9, Math.PI, 0); ctx.stroke(); }
  else text(ctx, 'ZZZ', x, y, 10, color, 'center', 'bold');
  text(ctx, label, rect.x + 34, y, 10, color, 'left', 'bold');
  if (active) { ctx.fillStyle = `rgba(105,225,255,${0.15 + Math.sin(time * 5) * 0.05})`; ctx.fillRect(rect.x + rect.w - 8, rect.y + 8, 3, rect.h - 16); }
}

function drawLandscapeStatus(ctx, rover, time, art) {
  panel(ctx, 936, 76, 328, 600, '#10171e');
  drawLandscapeRadar(ctx, rover, time);
  const alarm = rover.stormPhase === 'warning' || rover.stormPhase === 'wave';
  ctx.fillStyle = alarm && Math.floor(time * 7) % 2 ? '#682a2a' : '#1b2930'; ctx.fillRect(950, 228, 76, 80);
  const mood = alarm ? 'guide_panic' : rover.battery < 25 ? 'guide_worried' : rover.delivered >= SAMPLE_GOAL ? 'guide_happy' : 'guide_calm';
  const image = art?.[mood];
  if (image?.naturalWidth && image?.naturalHeight) { ctx.imageSmoothingEnabled = false; ctx.drawImage(image, 950, 228, 76, 80); }
  text(ctx, alarm ? 'ALARM' : rover.battery < 25 ? 'WORRY' : rover.delivered >= SAMPLE_GOAL ? 'HAPPY' : 'IDLE', 988, 312, 9, palette.amber, 'center', 'bold');
  text(ctx, rover.signal ? '■ SINAL OK' : '■ SEM SINAL', 1038, 244, 12, rover.signal ? palette.green : palette.red, 'left', 'bold');
  text(ctx, `VEL ${String(Math.round(rover.speedPercent)).padStart(2, '0')}%`, 1248, 244, 11, palette.text, 'right', 'bold');
  text(ctx, `MEMÓRIA ${rover.memory}/${rover.memoryCapacity}`, 1038, 274, 10, palette.text, 'left', 'bold');
  for (let i = 0; i < rover.memoryCapacity; i += 1) {
    ctx.fillStyle = i < rover.memory ? '#80eaff' : '#202a30'; ctx.fillRect(1038 + i * 24, 285, 18, 12); ctx.strokeStyle = '#5d8289'; ctx.strokeRect(1038 + i * 24, 285, 18, 12);
  }
  const row = (label, value, y, color) => {
    text(ctx, label, 950, y, 10, palette.muted, 'left', 'bold'); bar(ctx, 996, y - 6, 190, 12, value, color); text(ctx, `${Math.round(value)}%`, 1248, y, 9, palette.text, 'right');
  };
  row('BAT', rover.battery, 320, rover.battery < 25 ? palette.red : '#5dd47b');
  row('TERM', rover.temperature, 343, rover.temperature > 70 ? palette.red : palette.amber);
  row('CIRC', rover.circuits, 366, rover.circuits < 25 ? palette.red : '#6aca83');
  text(ctx, `TECH ${rover.techIndex}% · CIÊNCIA ${rover.scienceYield}/${rover.scienceThreshold}`, 950, 391, 10, rover.scienceYield < rover.scienceThreshold ? palette.amber : palette.cyan);
  text(ctx, `${rover.powerSource === 'rtg' ? 'RTG' : 'SOLAR'} · ${rover.payload === 'advanced' ? 'PERFURATRIZ' : 'SCANNER'} · ANTENA ${rover.antenna === 'advanced' ? 'ALTO GANHO' : 'SIMPLES'}`, 950, 414, 9, '#b3c0b6');
  if (rover.activity) {
    ctx.fillStyle = '#2b2315'; ctx.fillRect(950, 438, 300, 16); ctx.fillStyle = '#eab447'; ctx.fillRect(952, 440, 296 * Math.min(1, rover.activity.elapsed / rover.activity.duration), 12);
    text(ctx, rover.activity.type === 'collect' ? 'COLETANDO...' : 'TRANSMITINDO...', 950, 472, 10, palette.amber, 'left', 'bold');
  } else if (rover.overheated) text(ctx, 'MOTORES SUPERAQUECIDOS', 950, 463, 11, palette.red, 'left', 'bold');
  else if (alarm) text(ctx, `TEMPESTADE ${rover.stormSeconds ?? 0}s · ECONOMIA [S]`, 950, 463, 10, palette.red, 'left', 'bold');
  const labels = ['MOVER [M]', 'COLETAR [C]', 'TRANSMITIR [T]', 'ECONOMIA [S]'];
  const icons = ['move', 'collect', 'transmit', 'economy'];
  LANDSCAPE_SURFACE_CONTROL_RECTS.forEach((rect, i) => {
    const active = i === 1 ? rover.activity?.type === 'collect' : i === 2 ? rover.activity?.type === 'transmit' : i === 3 ? rover.economy : false;
    drawLandscapeButton(ctx, rect, labels[i], icons[i], active, time);
  });
}

function drawLandscapeLogs(ctx, rover, time) {
  ctx.fillStyle = '#030504'; ctx.fillRect(18, 684, 900, 27);
  ctx.strokeStyle = rover.stormPhase === 'warning' && Math.floor(time * 6) % 2 === 0 ? palette.red : '#1f3827'; ctx.strokeRect(18, 684, 900, 27);
  const last = rover.logs[rover.logs.length - 1] || '> SISTEMAS REATIVADOS.';
  const alert = /IMPACTO|ALERTA|ESGOTADA|DESTRUÍDOS|SUPERAQUECIDOS/.test(last);
  text(ctx, last, 28, 698, 11, alert ? palette.red : '#83dd8b', 'left', 'bold');
}

function drawLandscapeResult(ctx, state, art) {
  const rover = state.rover;
  const success = rover?.missionComplete || state.surfaceResult?.success;
  ctx.fillStyle = '#070b11'; ctx.fillRect(0, 0, 1280, 720);
  panel(ctx, 70, 42, 1140, 636, '#111921');
  text(ctx, success ? 'RELATÓRIO DE MISSÃO' : 'FALHA NA SUPERFÍCIE', 640, 93, 26, success ? palette.green : palette.red, 'center', 'bold');
  const portrait = art?.[success ? 'guide_happy' : 'guide_panic'];
  if (portrait?.naturalWidth) { ctx.imageSmoothingEnabled = false; ctx.drawImage(portrait, 145, 170, 200, 220); }
  textWrapped(ctx, success ? 'AMOSTRAS TRANSMITIDAS' : rover?.failureReason || state.surfaceResult?.reason || 'SISTEMA CRÍTICO', 395, 165, 800, 15, success ? palette.cyan : palette.amber, 'left', 'bold', 20, 2);
  const rows = [
    `AMOSTRAS ENTREGUES ${rover?.delivered ?? 0}/3`,
    `AMOSTRAS COLETADAS ${rover?.collectionCount ?? 0}/4`,
    `TECH INDEX ${rover?.techIndex ?? 0}% · CIÊNCIA ${rover?.scienceYield ?? 0}/${rover?.scienceThreshold ?? 60}`,
    `BAT ${Math.round(rover?.battery ?? 0)}% · CIRC ${Math.round(rover?.circuits ?? 0)}%`,
    `TEMPO ${fmtTime(rover?.missionTime ?? 0)} · ${rover?.map?.label ?? 'SEED 1994'}`
  ];
  rows.forEach((line, i) => text(ctx, line, 395, 222 + i * 38, 14, palette.text, 'left'));
  if (!success) text(ctx, getSurfaceRoast({ failureKind: rover?.failureKind, techIndex: rover?.techIndex }).slice(0, 105), 395, 435, 11, '#cfbfa7', 'left');
  drawLandscapeButton(ctx, LANDSCAPE_SURFACE_RESULT_RECTS[0], 'REPETIR', 'move', false, 0);
  drawLandscapeButton(ctx, LANDSCAPE_SURFACE_RESULT_RECTS[1], 'BASE', 'move', false, 0);
}

export function renderLandscapeSurfaceFrame(ctx, state, time, art = {}) {
  if (state.screen === 'surfaceResult') { drawLandscapeResult(ctx, state, art); return; }
  ctx.fillStyle = palette.ink; ctx.fillRect(0, 0, 1280, 720);
  drawLandscapeHeader(ctx, state.rover);
  ctx.save(); ctx.translate(18, 76 - GRID_MAP_Y * 1.25); ctx.scale(1.25, 1.25); drawMap(ctx, state.rover, time); ctx.restore();
  drawLandscapeLogs(ctx, state.rover, time);
  drawLandscapeStatus(ctx, state.rover, time, art);
}
