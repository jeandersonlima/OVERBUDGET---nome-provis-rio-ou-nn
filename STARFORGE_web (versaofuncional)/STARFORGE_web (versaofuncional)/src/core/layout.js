/**
 * Layout geometry & hit-testing for the 720x1280 portrait canvas.
 * Pure ES module — no DOM, window, or lib references.
 */

import { MODULE_CATEGORIES } from './catalog.js';

export const CANVAS_WIDTH = 720;
export const CANVAS_HEIGHT = 1280;

export const TITLE_MENU_RECTS = [
  { id: 'start', x: 48, y: 540, w: 344, h: 96 },
  { id: 'options', x: 48, y: 652, w: 344, h: 96 },
  { id: 'controls', x: 48, y: 764, w: 344, h: 96 }
];
export const OPTIONS_DIFFICULTY_RECTS = [
  { id: 'beginner', x: 48, y: 406, w: 624, h: 112 },
  { id: 'engineer', x: 48, y: 540, w: 624, h: 112 },
  { id: 'director', x: 48, y: 674, w: 624, h: 112 }
];
export const TITLE_BACK_RECT = { x: 32, y: 1120, w: 656, h: 104 };
export const DIFFICULTY_BACK_RECT = { x: 32, y: 1120, w: 656, h: 104 };
export const MANUAL_PREV_RECT = { x: 40, y: 990, w: 260, h: 82 };
export const MANUAL_NEXT_RECT = { x: 420, y: 990, w: 260, h: 82 };

export const SURFACE_MAP_VIEW = { x: 0, y: 110, w: 720, h: 480 };
export const SURFACE_HUD_RECT = { x: 16, y: 10, w: 688, h: 92 };
export const SURFACE_MINIMAP_RECT = { x: 20, y: 676, w: 250, h: 170 };
export const SURFACE_GUIDE_RECT = { x: 284, y: 676, w: 416, h: 330 };
export const SURFACE_CONTROL_RECTS = [
  { id: 'move', x: 20, y: 1038, w: 330, h: 96 },
  { id: 'collect', x: 370, y: 1038, w: 330, h: 96 },
  { id: 'transmit', x: 20, y: 1148, w: 330, h: 96 },
  { id: 'economy', x: 370, y: 1148, w: 330, h: 96 }
];
export const SURFACE_RESULT_RECTS = [
  { id: 'retry', x: 28, y: 1160, w: 320, h: 96 },
  { id: 'base', x: 372, y: 1160, w: 320, h: 96 }
];

export function hitTestSurfaceControl(x, y) {
  return SURFACE_CONTROL_RECTS.find((rect) => pointInRect(x, y, rect))?.id || null;
}

export function getVehiclePartRects(padPos = { x: 360, y: 430 }, vehicleScale = 1) {
  const scale = Math.max(0.6, Math.min(1.5, vehicleScale || 1));
  const rocketX = padPos.x - 52;
  const py = padPos.y;
  return [
    { id: 'avionics', x: rocketX - 62 * scale, y: py - 314 * scale, w: 124 * scale, h: 184 * scale },
    { id: 'propulsion', x: rocketX - 76 * scale, y: py - 3 * scale, w: 152 * scale, h: 142 * scale },
    { id: 'structure', x: rocketX - 66 * scale, y: py - 156 * scale, w: 132 * scale, h: 194 * scale },
    { id: 'satellite', x: rocketX + 160 * scale - 5, y: py - 228 * scale, w: 160 * scale, h: 110 * scale },
    { id: 'payload', x: rocketX + 158 * scale - 100 * scale, y: py + 32 - 76 * scale, w: 202 * scale, h: 148 * scale }
  ];
}

export function getAssemblyLayout(padPos = { x: 360, y: 430 }, vehicleScale = 1) {
  const tabsY = 716;
  const tabHeight = 104;
  const tabGap = 12;
  const marginX = 32;
  const totalTabsWidth = CANVAS_WIDTH - marginX * 2;
  const tabWidth = Math.floor((totalTabsWidth - tabGap * (MODULE_CATEGORIES.length - 1)) / MODULE_CATEGORIES.length);

  const categoryTabs = MODULE_CATEGORIES.map((category, index) => ({
    id: category.id,
    x: marginX + index * (tabWidth + tabGap),
    y: tabsY,
    w: tabWidth,
    h: tabHeight
  }));

  const cardY = 852;
  const cardH = 286;
  const cardGap = 24;
  const cardW = Math.floor((totalTabsWidth - cardGap) / 2);

  const optionCards = [
    {
      optionId: 'standard',
      x: marginX,
      y: cardY,
      w: cardW,
      h: cardH
    },
    {
      optionId: 'advanced',
      x: marginX + cardW + cardGap,
      y: cardY,
      w: cardW,
      h: cardH
    }
  ];

  // Hit-zones and selection outlines use the exact same base geometry as the sprites.
  const padParts = getVehiclePartRects(padPos, vehicleScale);
  const left = Math.min(...padParts.map((part) => part.x));
  const top = Math.min(...padParts.map((part) => part.y));
  const right = Math.max(...padParts.map((part) => part.x + part.w));
  const bottom = Math.max(...padParts.map((part) => part.y + part.h));
  const padBounds = { x: left - 18, y: top - 18, w: right - left + 36, h: bottom - top + 36 };

  const actionButton = { x: marginX, y: 1148, w: totalTabsWidth, h: 102 };

  return {
    categoryTabs,
    optionCards,
    padParts,
    padBounds,
    actionButton
  };
}

export function getDifficultyCardRects() {
  const x = 32;
  const w = CANVAS_WIDTH - 64;
  const h = 190;
  const gap = 28;
  const startY = 300;
  return ['beginner', 'engineer', 'director'].map((id, index) => ({
    id,
    x,
    y: startY + index * (h + gap),
    w,
    h
  }));
}

export function pointInRect(x, y, rect) {
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}

export function hitTestAssembly(x, y, layout) {
  for (const tab of layout.categoryTabs) {
    if (pointInRect(x, y, tab)) {
      return { type: 'category', id: tab.id };
    }
  }
  for (const card of layout.optionCards) {
    if (pointInRect(x, y, card)) {
      return { type: 'option', id: card.optionId };
    }
  }
  for (const part of layout.padParts) {
    if (pointInRect(x, y, part)) {
      return { type: 'category', id: part.id };
    }
  }
  return null;
}
