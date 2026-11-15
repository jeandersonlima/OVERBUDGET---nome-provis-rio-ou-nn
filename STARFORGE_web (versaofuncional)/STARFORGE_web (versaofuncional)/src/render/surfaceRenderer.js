/**
 * Top-down RTS lunar surface: camera-follow map, route marker, minimap, rover guide and touch HUD.
 * Simulation rules are pure and live in src/core/explorationRules.js.
 */
import {
  MAP_VIEW_HEIGHT,
  MAP_VIEW_WIDTH,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  canTransmitData,
  findNearbyCrystal,
  getGuideCue,
  getMissionReport,
  getTerrainAt
} from '../core/explorationRules.js';
import { getSurfaceRoast } from '../core/failureMessages.js';
import { SURFACE_CONTROL_RECTS, SURFACE_GUIDE_RECT, SURFACE_HUD_RECT, SURFACE_MAP_VIEW, SURFACE_MINIMAP_RECT, SURFACE_RESULT_RECTS } from '../core/layout.js';

function roundedRect(ctx, x, y, w, h, r) {
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

function drawFit(ctx, image, x, y, w, h) {
  if (!image?.naturalWidth || !image?.naturalHeight) return;
  const scale = Math.min(w / image.naturalWidth, h / image.naturalHeight);
  const drawW = image.naturalWidth * scale;
  const drawH = image.naturalHeight * scale;
  ctx.drawImage(image, x + (w - drawW) / 2, y + (h - drawH) / 2, drawW, drawH);
}

function worldToScreen(point, camera) {
  return { x: point.x - camera.x, y: point.y - camera.y };
}

function drawMapPlate(ctx, image, camera, palette) {
  ctx.fillStyle = '#181f31';
  ctx.fillRect(0, 0, MAP_VIEW_WIDTH, MAP_VIEW_HEIGHT);
  if (!image?.naturalWidth || !image?.naturalHeight) return;
  const sx = camera.x / WORLD_WIDTH * image.naturalWidth;
  const sy = camera.y / WORLD_HEIGHT * image.naturalHeight;
  const sw = Math.min(image.naturalWidth - sx, MAP_VIEW_WIDTH / WORLD_WIDTH * image.naturalWidth);
  const sh = Math.min(image.naturalHeight - sy, MAP_VIEW_HEIGHT / WORLD_HEIGHT * image.naturalHeight);
  if (sw <= 0 || sh <= 0) return;
  ctx.drawImage(image, sx, sy, sw, sh, 0, 0, MAP_VIEW_WIDTH, MAP_VIEW_HEIGHT);
  ctx.save();
  ctx.globalAlpha = 0.08;
  ctx.fillStyle = palette;
  ctx.fillRect(0, 0, MAP_VIEW_WIDTH, MAP_VIEW_HEIGHT);
  ctx.restore();
}

function drawTerrainArt(ctx, state, camera, art, time) {
  const map = state.rover.map;
  const craterImage = art?.crater_topdown;
  for (const crater of map.shadowZones) {
    const pos = worldToScreen({ x: crater.x, y: crater.y }, camera);
    const w = crater.rx * 2;
    const h = crater.ry * 2;
    if (pos.x + w / 2 < -20 || pos.x - w / 2 > MAP_VIEW_WIDTH || pos.y + h / 2 < -20 || pos.y - h / 2 > MAP_VIEW_HEIGHT) continue;
    ctx.save();
    ctx.globalAlpha = 0.25;
    drawFit(ctx, craterImage, pos.x - w / 2, pos.y - h / 2, w, h);
    ctx.globalAlpha = 0.13;
    ctx.fillStyle = '#253a8c';
    ctx.beginPath();
    ctx.ellipse(pos.x, pos.y, crater.rx, crater.ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  for (const zone of map.rockZones) {
    const pos = worldToScreen({ x: zone.x, y: zone.y }, camera);
    ctx.fillStyle = 'rgba(232, 157, 87, 0.10)';
    ctx.fillRect(pos.x, pos.y, zone.w, zone.h);
    ctx.strokeStyle = 'rgba(255, 192, 113, 0.16)';
    ctx.lineWidth = 2;
    ctx.strokeRect(pos.x, pos.y, zone.w, zone.h);
  }
  for (const rock of map.rockDecorations) {
    const pos = worldToScreen(rock, camera);
    if (pos.x + rock.size < -20 || pos.x - rock.size > MAP_VIEW_WIDTH || pos.y + rock.size < -20 || pos.y - rock.size > MAP_VIEW_HEIGHT) continue;
    drawFit(ctx, art?.rock_cluster_topdown, pos.x - rock.size / 2, pos.y - rock.size / 2, rock.size, rock.size);
  }
  const relay = worldToScreen(map.relay, camera);
  if (relay.x > -60 && relay.x < MAP_VIEW_WIDTH + 60 && relay.y > -65 && relay.y < MAP_VIEW_HEIGHT + 65) {
    drawFit(ctx, art?.relay_beacon_topdown, relay.x - 38, relay.y - 46, 76, 92);
    ctx.fillStyle = '#f4cf75';
    ctx.textAlign = 'center';
    ctx.font = 'bold 11px monospace';
    ctx.fillText('RELÉ', relay.x, relay.y + 54);
  }
  for (const crystal of state.rover.crystals) {
    if (crystal.collected || !crystal.discovered) continue;
    const pos = worldToScreen(crystal, camera);
    if (pos.x < -40 || pos.x > MAP_VIEW_WIDTH + 40 || pos.y < -45 || pos.y > MAP_VIEW_HEIGHT + 45) continue;
    const pulse = 0.92 + 0.08 * Math.sin(time * 4 + crystal.x);
    drawFit(ctx, art?.ice_crystal_topdown, pos.x - 25 * pulse, pos.y - 28 * pulse, 50 * pulse, 56 * pulse);
    ctx.strokeStyle = 'rgba(107, 232, 255, 0.82)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 34 + 3 * Math.sin(time * 3 + crystal.y), 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawTracks(ctx, rover, camera) {
  if (rover.tracks.length < 2) return;
  ctx.save();
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  for (let i = 1; i < rover.tracks.length; i += 1) {
    const a = worldToScreen(rover.tracks[i - 1], camera);
    const b = worldToScreen(rover.tracks[i], camera);
    const age = Math.max(0, rover.elapsed - (b.time || 0));
    ctx.globalAlpha = Math.max(0.12, 1 - age / 80);
    ctx.strokeStyle = '#11161f';
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const length = Math.hypot(dx, dy) || 1;
    const ox = -dy / length * 5;
    const oy = dx / length * 5;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(a.x + ox * side, a.y + oy * side);
      ctx.lineTo(b.x + ox * side, b.y + oy * side);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawRoute(ctx, rover, camera, time) {
  if (!rover.target) return;
  const start = worldToScreen(rover, camera);
  const target = worldToScreen(rover.target, camera);
  if (start.x < -WORLD_WIDTH || target.x < -WORLD_WIDTH) return;
  const unsafe = getTerrainAt(rover.target, undefined, rover.map).id !== 'sunlight';
  ctx.save();
  ctx.setLineDash([14, 10]);
  ctx.lineDashOffset = -time * 22;
  ctx.strokeStyle = unsafe ? '#ff596f' : '#55f29b';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(target.x, target.y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = unsafe ? '#ff596f' : '#55f29b';
  ctx.beginPath();
  ctx.arc(target.x, target.y, 8 + Math.sin(time * 5) * 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#e9f6ff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(target.x, target.y, 19, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawRover(ctx, state, camera, art, time) {
  const rover = state.rover;
  const pos = worldToScreen(rover, camera);
  const image = art?.[rover.payload === 'advanced' ? 'rover_map_drill' : 'rover_map_scanner'];
  ctx.save();
  ctx.translate(pos.x, pos.y + (rover.speed > 0 ? Math.sin(time * 15) * 1.5 : 0));
  ctx.rotate(rover.heading);
  ctx.fillStyle = rover.forcedStandby ? 'rgba(255, 92, 115, 0.28)' : 'rgba(5, 10, 18, 0.48)';
  ctx.beginPath();
  ctx.ellipse(0, 4, 34, 42, 0, 0, Math.PI * 2);
  ctx.fill();
  drawFit(ctx, image, -37, -47, 74, 94);
  if (rover.overdrive && rover.speed > 0) {
    ctx.strokeStyle = '#ffb85e';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(0, 0, 44, 53, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawMapScene(ctx, state, time, art) {
  const camera = state.camera || { x: 0, y: 0 };
  ctx.save();
  ctx.beginPath();
  ctx.rect(SURFACE_MAP_VIEW.x, SURFACE_MAP_VIEW.y, SURFACE_MAP_VIEW.w, SURFACE_MAP_VIEW.h);
  ctx.clip();
  drawMapPlate(ctx, art?.surface_map_topdown, camera, state.rover.map.palette);
  drawTerrainArt(ctx, state, camera, art, time);
  drawTracks(ctx, state.rover, camera);
  drawRoute(ctx, state.rover, camera, time);
  drawRover(ctx, state, camera, art, time);
  ctx.restore();
}

function drawMeter(ctx, x, y, label, value, color, valueLabel) {
  ctx.fillStyle = '#dbeafe';
  ctx.textAlign = 'left';
  ctx.font = 'bold 14px monospace';
  ctx.fillText(label, x, y + 15);
  roundedRect(ctx, x + 91, y, 260, 20, 8);
  ctx.fillStyle = '#111b32';
  ctx.fill();
  roundedRect(ctx, x + 95, y + 4, 252 * Math.max(0.025, value / 100), 12, 5);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.fillStyle = color;
  ctx.textAlign = 'right';
  ctx.font = 'bold 14px monospace';
  ctx.fillText(valueLabel, x + 439, y + 15);
}

function drawMiniMap(ctx, state, art) {
  const rect = SURFACE_MINIMAP_RECT;
  roundedRect(ctx, rect.x, rect.y, rect.w, rect.h, 13);
  ctx.fillStyle = '#10182a';
  ctx.fill();
  ctx.strokeStyle = '#6e8fb7';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#a8bed8';
  ctx.textAlign = 'left';
  ctx.font = 'bold 11px monospace';
  ctx.fillText(`MAPA · ${state.rover.map.id.toUpperCase()}`, rect.x + 10, rect.y + 16);
  const map = { x: rect.x + 8, y: rect.y + 23, w: rect.w - 16, h: rect.h - 31 };
  if (art?.surface_map_topdown?.naturalWidth) {
    ctx.drawImage(art.surface_map_topdown, map.x, map.y, map.w, map.h);
  } else {
    ctx.fillStyle = '#34394a';
    ctx.fillRect(map.x, map.y, map.w, map.h);
  }
  ctx.save();
  ctx.beginPath();
  ctx.rect(map.x, map.y, map.w, map.h);
  ctx.clip();
  const scaleX = map.w / WORLD_WIDTH;
  const scaleY = map.h / WORLD_HEIGHT;
  const worldMap = state.rover.map;
  ctx.fillStyle = 'rgba(53, 69, 144, 0.34)';
  for (const zone of worldMap.shadowZones) {
    ctx.beginPath();
    ctx.ellipse(map.x + zone.x * scaleX, map.y + zone.y * scaleY, zone.rx * scaleX, zone.ry * scaleY, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(255, 177, 90, 0.32)';
  for (const zone of worldMap.rockZones) {
    ctx.fillRect(map.x + zone.x * scaleX, map.y + zone.y * scaleY, zone.w * scaleX, zone.h * scaleY);
  }
  const camera = state.camera || { x: 0, y: 0 };
  ctx.strokeStyle = '#f4edaf';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(map.x + camera.x * scaleX, map.y + camera.y * scaleY, MAP_VIEW_WIDTH * scaleX, MAP_VIEW_HEIGHT * scaleY);
  for (const crystal of state.rover.crystals) {
    if (!crystal.discovered || crystal.collected) continue;
    ctx.fillStyle = '#66e9ff';
    ctx.beginPath();
    ctx.arc(map.x + crystal.x * scaleX, map.y + crystal.y * scaleY, 3.1, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#ffd975';
  ctx.beginPath();
  ctx.arc(map.x + worldMap.relay.x * scaleX, map.y + worldMap.relay.y * scaleY, 3, 0, Math.PI * 2);
  ctx.fill();
  if (state.rover.target) {
    ctx.fillStyle = '#73ffac';
    ctx.beginPath();
    ctx.arc(map.x + state.rover.target.x * scaleX, map.y + state.rover.target.y * scaleY, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#0b172b';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(map.x + state.rover.x * scaleX, map.y + state.rover.y * scaleY, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function wrapLines(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
  let line = '';
  let lines = 0;
  for (const word of String(text || '').split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > maxWidth) {
      ctx.fillText(line, x, y + lines * lineHeight);
      lines += 1;
      line = word;
      if (lines >= maxLines) return;
    } else line = next;
  }
  if (line && lines < maxLines) ctx.fillText(line, x, y + lines * lineHeight);
}

function drawGuidePanel(ctx, state, art) {
  const rect = SURFACE_GUIDE_RECT;
  const cue = getGuideCue(state.rover);
  roundedRect(ctx, rect.x, rect.y, rect.w, rect.h, 15);
  ctx.fillStyle = 'rgba(8, 15, 30, 0.95)';
  ctx.fill();
  ctx.strokeStyle = cue.mood === 'panic' ? '#fb7185' : cue.mood === 'worried' ? '#fbbf24' : '#5f83aa';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#73dfff';
  ctx.textAlign = 'center';
  ctx.font = 'bold 14px monospace';
  ctx.fillText('GUIA DE MISSÃO', rect.x + rect.w / 2, rect.y + 22);
  const portrait = art?.[`guide_${cue.mood}`] || art?.guide_calm;
  drawFit(ctx, portrait, rect.x + 15, rect.y + 30, rect.w - 30, 142);
  roundedRect(ctx, rect.x + 11, rect.y + 181, rect.w - 22, 208, 11);
  ctx.fillStyle = '#111d32';
  ctx.fill();
  ctx.strokeStyle = '#2c4362';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = '#dbeafe';
  ctx.textAlign = 'left';
  ctx.font = '14px sans-serif';
  wrapLines(ctx, cue.text, rect.x + 22, rect.y + 206, rect.w - 44, 20, 8);

  roundedRect(ctx, rect.x + 11, rect.y + 400, rect.w - 22, 106, 10);
  ctx.fillStyle = '#0d172b';
  ctx.fill();
  ctx.fillStyle = '#95abc5';
  ctx.textAlign = 'center';
  ctx.font = 'bold 11px monospace';
  ctx.fillText('TERRENO', rect.x + rect.w / 2, rect.y + 421);
  const terrain = getTerrainAt(state.rover, undefined, state.rover.map);
  ctx.fillStyle = terrain.id === 'rocks' ? '#ffd08a' : terrain.id === 'shadow' ? '#94a8ff' : '#86efac';
  ctx.font = 'bold 12px monospace';
  ctx.fillText(terrain.label, rect.x + rect.w / 2, rect.y + 443);
  ctx.fillStyle = state.rover.signal ? '#5de1b1' : '#ff788b';
  ctx.fillText(state.rover.signal ? 'SINAL LIMPO' : 'SEM SINAL', rect.x + rect.w / 2, rect.y + 469);
  ctx.fillStyle = '#9aacc3';
  ctx.font = '11px monospace';
  ctx.fillText(`${Math.round(state.rover.speed)} u/s`, rect.x + rect.w / 2, rect.y + 492);
}

function drawHud(ctx, state) {
  const rect = SURFACE_HUD_RECT;
  roundedRect(ctx, rect.x, rect.y, rect.w, rect.h, 15);
  ctx.fillStyle = 'rgba(7, 13, 26, 0.91)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(106, 166, 223, 0.56)';
  ctx.lineWidth = 2;
  ctx.stroke();
  const rover = state.rover;
  const batteryColor = rover.battery < 25 ? '#ff718b' : rover.battery < 50 ? '#fbbf24' : '#43d9a4';
  const heatColor = rover.temperature > 80 ? '#ff6f61' : rover.temperature > 60 ? '#ffb15c' : '#45d5c2';
  drawMeter(ctx, rect.x + 12, rect.y + 32, 'BATERIA', rover.battery, batteryColor, `${Math.round(rover.battery)}%`);
  drawMeter(ctx, rect.x + 12, rect.y + 76, 'MOTOR', rover.temperature, heatColor, `${Math.round(rover.temperature)}°`);
  ctx.textAlign = 'left';
  ctx.fillStyle = rover.signal ? '#65e8b5' : '#ff718b';
  ctx.font = 'bold 12px monospace';
  ctx.fillText(rover.signal ? 'RÁDIO: OK' : 'RÁDIO: SEM SINAL', rect.x + 13, rect.y + 126);
  ctx.fillStyle = '#d2def0';
  ctx.textAlign = 'right';
  ctx.fillText(`DADOS ${rover.memory}/${rover.memoryCapacity}`, rect.x + rect.w - 13, rect.y + 126);
}

function drawActionButton(ctx, rect, title, subtitle, color, active, disabled, thirdLine = '') {
  roundedRect(ctx, rect.x, rect.y, rect.w, rect.h, 17);
  ctx.fillStyle = active ? '#17304a' : disabled ? '#111827' : '#121e34';
  ctx.fill();
  ctx.strokeStyle = disabled ? '#354156' : color;
  ctx.lineWidth = active ? 3.5 : 2;
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.fillStyle = disabled ? '#758096' : color;
  ctx.font = 'bold 16px monospace';
  ctx.fillText(title, rect.x + rect.w / 2, rect.y + 39);
  ctx.fillStyle = disabled ? '#728096' : '#c8d6e8';
  ctx.font = '12px monospace';
  ctx.fillText(subtitle, rect.x + rect.w / 2, rect.y + 67);
  if (thirdLine) {
    ctx.fillStyle = '#97a8bd';
    ctx.font = '11px monospace';
    ctx.fillText(thirdLine, rect.x + rect.w / 2, rect.y + 91);
  }
}

function drawControls(ctx, state, time) {
  const rover = state.rover;
  ctx.fillStyle = '#0b1222';
  ctx.fillRect(0, MAP_VIEW_HEIGHT, 720, 410);
  ctx.strokeStyle = '#31435f';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, MAP_VIEW_HEIGHT);
  ctx.lineTo(720, MAP_VIEW_HEIGHT);
  ctx.stroke();
  ctx.textAlign = 'left';
  ctx.fillStyle = '#f1f5f9';
  ctx.font = 'bold 15px monospace';
  ctx.fillText(rover.map.label, 28, 904);
  const collected = rover.crystals.filter((crystal) => crystal.collected).length;
  ctx.textAlign = 'right';
  ctx.fillStyle = '#9eeaff';
  ctx.font = 'bold 12px monospace';
  ctx.fillText(`GELO ${collected}/${rover.crystals.length} · DADOS ${rover.dataTransmitted}`, 690, 904);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#92a2ba';
  ctx.font = '12px sans-serif';
  ctx.fillText('Toque no terreno para traçar rota · Shift ativa o overdrive', 28, 929);

  const rects = Object.fromEntries(SURFACE_CONTROL_RECTS.map((rect) => [rect.id, rect]));
  const sampleTarget = findNearbyCrystal(rover);
  const transmitter = canTransmitData(rover);
  drawActionButton(ctx, rects.overdrive, rover.overdrive ? 'OVERDRIVE ON' : 'OVERDRIVE', 'SHIFT · MAIS RÁPIDO', '#ffbd62', rover.overdrive, false);
  drawActionButton(ctx, rects.standby, rover.standby ? 'RETOMAR ROTA' : 'STANDBY', rover.standby ? 'PAINÉIS RECARREGAM' : 'PARA · RECARGA SOLAR', '#88dfff', rover.standby, rover.forcedStandby);
  const sampleTitle = rover.payload === 'advanced' ? 'PERFURAR GELO' : 'COLETAR GELO';
  const sampleSub = sampleTarget ? 'CRISTAL AO ALCANCE' : rover.payload === 'advanced' ? 'BROCA · AMOSTRA 2' : 'SCANNER · AMOSTRA 1';
  const sampleDisabled = !sampleTarget || rover.memory >= rover.memoryCapacity || rover.battery < (rover.payload === 'advanced' ? 15 : 8);
  drawActionButton(ctx, rects.sample, sampleTitle, sampleSub, '#79e5ff', Boolean(sampleTarget), sampleDisabled, `${rover.memory}/${rover.memoryCapacity} MEMÓRIA`);
  const purgeDisabled = rover.temperature < 55 || rover.battery < 15 || rover.purgeCooldown > 0 || rover.failed || rover.completed;
  const purgeSub = rover.purgeCooldown > 0 ? `RECARGA ${rover.purgeCooldown.toFixed(1)}s` : 'RESFRIA A 0° · -15% CARGA';
  drawActionButton(ctx, rects.purge, 'PURGA DE EMERGÊNCIA', purgeSub, '#ff8a6a', false, purgeDisabled, 'TECLA P');
  const transmitDisabled = !transmitter.allowed || rover.failed || rover.completed;
  const transmitSub = !rover.signal ? 'SEM SINAL · SAIA DA CRATERA' : rover.memory <= 0 ? 'MEMÓRIA VAZIA' : `${rover.memory} DADO(S) PRONTO(S)`;
  drawActionButton(ctx, rects.transmit, 'TRANSMITIR AO SATÉLITE', transmitSub, '#56e0b0', transmitter.allowed, transmitDisabled, 'SOMENTE COM SINAL');
  const abortArmed = state.abortConfirmUntil > time;
  drawActionButton(ctx, rects.abort, abortArmed ? 'CONFIRMAR ABANDONO' : 'ENCERRAR MISSÃO', abortArmed ? 'TOQUE NOVAMENTE PARA CONFIRMAR' : 'AMOSTRAS NÃO ENVIADAS SERÃO PERDIDAS', '#ff718b', abortArmed, false);
}

function drawSurfaceResult(ctx, state, art) {
  const report = getMissionReport(state.rover);
  const accent = report.success ? '#43d9a4' : '#ff718b';
  if (!report.success) {
    ctx.fillStyle = 'rgba(3, 6, 14, 0.94)';
    ctx.fillRect(0, 0, 720, MAP_VIEW_HEIGHT);
    drawFit(ctx, art?.guide_panic, 200, 70, 320, 320);
    roundedRect(ctx, 36, 404, 648, 440, 18);
    ctx.fillStyle = 'rgba(12, 18, 36, 0.97)';
    ctx.fill();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = '#ffd7de';
    ctx.textAlign = 'left';
    ctx.font = '18px sans-serif';
    wrapLines(ctx, getSurfaceRoast(report), 64, 452, 592, 27, 13);
  }

  ctx.fillStyle = '#0b1222';
  ctx.fillRect(0, MAP_VIEW_HEIGHT, 720, 410);
  roundedRect(ctx, 24, 884, 672, 260, 17);
  ctx.fillStyle = '#10182d';
  ctx.fill();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.fillStyle = accent;
  ctx.font = 'bold 19px monospace';
  ctx.fillText(report.success ? 'RELATÓRIO · MISSÃO CONCLUÍDA' : 'RELATÓRIO · MISSÃO FALHOU', 360, 914);
  ctx.fillStyle = '#9eb1c9';
  ctx.font = '12px monospace';
  ctx.fillText(report.mapLabel, 360, 937);

  const duration = `${Math.floor(report.elapsedSeconds / 60).toString().padStart(2, '0')}:${(report.elapsedSeconds % 60).toString().padStart(2, '0')}`;
  const stats = [
    { label: 'GELO', value: `${report.crystalsCollected}/${report.crystalsTotal}` },
    { label: 'DADOS', value: String(report.dataTransmitted) },
    { label: 'BATERIA', value: `${report.batteryRemaining}%` },
    { label: 'TEMPO', value: duration }
  ];
  const boxW = 151;
  stats.forEach((stat, index) => {
    const x = 35 + index * 162;
    roundedRect(ctx, x, 950, boxW, 66, 10);
    ctx.fillStyle = '#0c172a';
    ctx.fill();
    ctx.strokeStyle = '#344966';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#95abc5';
    ctx.font = 'bold 10px monospace';
    ctx.fillText(stat.label, x + boxW / 2, 970);
    ctx.fillStyle = '#e5edf7';
    ctx.font = 'bold 17px monospace';
    ctx.fillText(stat.value, x + boxW / 2, 999);
  });
  ctx.fillStyle = '#a8bed7';
  ctx.font = '11px monospace';
  ctx.fillText(`PURGAS ${report.purgeCount} · ZONAS ${report.zonesVisited.length}/3 · MOTOR ${report.peakTemperature}°`, 360, 1038);
  ctx.fillStyle = '#dbe4ef';
  ctx.textAlign = 'left';
  ctx.font = '14px sans-serif';
  const message = report.success
    ? `${report.dataTransmitted} unidades de ciência transmitidas. O guia já está preparando uma piada sobre antenas.`
    : `${report.failureReason} Cristais coletados: ${report.crystalsCollected}/${report.crystalsTotal}; dados ainda na memória: ${report.dataInMemory}.`;
  wrapLines(ctx, message, 44, 1063, 632, 19, 4);

  const actions = Object.fromEntries(SURFACE_RESULT_RECTS.map((rect) => [rect.id, rect]));
  drawActionButton(ctx, actions.retry, 'NOVA EXPEDIÇÃO', 'PRÓXIMO MAPA', '#73dfff', false, false);
  drawActionButton(ctx, actions.base, 'VOLTAR À BASE', 'REVISAR O PROJETO', '#55d4ce', false, false);
}

export function renderSurfaceFrame(ctx, state, time, art) {
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#080d19';
  ctx.fillRect(0, 0, 720, 1280);
  drawMapScene(ctx, state, time, art);
  drawHud(ctx, state);
  drawMiniMap(ctx, state, art);
  drawGuidePanel(ctx, state, art);
  if (state.screen === 'surfaceResult') drawSurfaceResult(ctx, state, art);
  else drawControls(ctx, state, time);
}
