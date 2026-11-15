/**
 * Mission assembly, trade-off, technology and science-yield calculations.
 * Pure ES module — no DOM, window, or lib references.
 */
import { CATEGORY_BY_ID, DEFAULT_EQUIPPED, MODULE_CATEGORIES } from './catalog.js';

export const SCIENCE_SUCCESS_THRESHOLD = 60;
export const TECH_DETECTION_MIN_INDEX = 40;
const MAX_TECH_POINTS = MODULE_CATEGORIES.length * 3;

export function getTechIndex(techPoints) {
  return Math.round(Math.max(0, Math.min(MAX_TECH_POINTS, techPoints)) / MAX_TECH_POINTS * 100);
}

export function getTechFactor(techIndex) {
  return Math.max(0, Math.min(1, techIndex / 100));
}

export function normalizeEquipped(equipped) {
  const result = { ...DEFAULT_EQUIPPED };
  if (!equipped || typeof equipped !== 'object') return result;
  for (const category of MODULE_CATEGORIES) {
    const choice = equipped[category.id];
    if (choice === 'standard' || choice === 'advanced') result[category.id] = choice;
  }
  return result;
}

export function getEquippedOption(equipped, categoryId) {
  const category = CATEGORY_BY_ID[categoryId];
  if (!category) return null;
  const optionId = equipped?.[categoryId] === 'advanced' ? 'advanced' : 'standard';
  return category.options[optionId];
}

export function computeMissionStats(equipped, budgetMax = 350) {
  const normalized = normalizeEquipped(equipped);
  let spentCost = 0;
  let totalMass = 0;
  let netPower = 0;
  let scienceScore = 0;
  let techPoints = 0;
  for (const category of MODULE_CATEGORIES) {
    const option = category.options[normalized[category.id]];
    spentCost += option.cost;
    totalMass += option.mass;
    netPower += option.power;
    scienceScore += option.science;
    techPoints += option.techLevel ?? 1;
  }

  const safeBudget = Number.isFinite(budgetMax) ? budgetMax : 350;
  const remainingBudget = safeBudget - spentCost;
  const techIndex = getTechIndex(techPoints);
  const techFactor = getTechFactor(techIndex);
  const scienceYield = Math.round(scienceScore * techFactor);

  return {
    budgetMax: safeBudget,
    spentCost,
    remainingBudget,
    totalMass,
    netPower,
    scienceScore,
    techPoints,
    techIndex,
    techFactor,
    scienceYield,
    scienceThreshold: SCIENCE_SUCCESS_THRESHOLD,
    scienceReady: scienceYield >= SCIENCE_SUCCESS_THRESHOLD,
    isOverBudget: remainingBudget < 0,
    isPowerDeficit: netPower < 0
  };
}

export function selectModuleOption(equipped, categoryId, optionId) {
  const normalized = normalizeEquipped(equipped);
  if (!CATEGORY_BY_ID[categoryId]) return normalized;
  if (optionId !== 'standard' && optionId !== 'advanced') return normalized;
  if (normalized[categoryId] === optionId) return normalized;
  return { ...normalized, [categoryId]: optionId };
}

export function getCategoryByOffset(currentCategoryId, delta) {
  const index = MODULE_CATEGORIES.findIndex((c) => c.id === currentCategoryId);
  const baseIndex = index === -1 ? 0 : index;
  const nextIndex = (baseIndex + delta + MODULE_CATEGORIES.length) % MODULE_CATEGORIES.length;
  return MODULE_CATEGORIES[nextIndex].id;
}
