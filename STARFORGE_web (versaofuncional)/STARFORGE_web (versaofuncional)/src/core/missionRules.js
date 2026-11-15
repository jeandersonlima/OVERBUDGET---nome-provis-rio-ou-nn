/**
 * Mission difficulty, commissioning tests, and pre-launch engineering validation.
 * Pure ES module: deterministic rules only, with no browser or platform APIs.
 */
import { SCIENCE_SUCCESS_THRESHOLD } from './missionState.js';

export const DIFFICULTY_PRESETS = [
  {
    id: 'beginner',
    name: 'Iniciante',
    cml: 'CML 1',
    budgetMax: 500,
    maxMass: 2800,
    minPower: -80,
    requiresTest: false,
    tolerance: 'Margem ampla · dicas guiadas'
  },
  {
    id: 'engineer',
    name: 'Engenheiro',
    cml: 'CML 3',
    budgetMax: 350,
    maxMass: 2000,
    minPower: 0,
    requiresTest: false,
    tolerance: 'Trade-offs realistas'
  },
  {
    id: 'director',
    name: 'Diretor de Missão',
    cml: 'CML 6',
    budgetMax: 240,
    maxMass: 1450,
    minPower: 30,
    requiresTest: true,
    testCost: 10,
    tolerance: 'Margem mínima · teste obrigatório'
  }
];

export function getDifficultyPreset(id) {
  return DIFFICULTY_PRESETS.find((preset) => preset.id === id) || DIFFICULTY_PRESETS[1];
}

export function evaluateComponentChoice(stats, difficultyId, reserveMandatoryTest = true) {
  const preset = getDifficultyPreset(difficultyId);
  const testReserve = reserveMandatoryTest && preset.requiresTest ? preset.testCost : 0;
  const remainingBudget = preset.budgetMax - stats.spentCost - testReserve;
  const issues = [];

  if (remainingBudget < 0) issues.push(`Excede o orçamento disponível em $${Math.abs(remainingBudget)}M.`);
  if (stats.totalMass > preset.maxMass) issues.push(`Massa acima do limite do ${preset.cml} (${preset.maxMass} kg).`);
  if (stats.netPower < preset.minPower) issues.push(`Potência abaixo da margem do ${preset.cml} (${preset.minPower} W).`);
  return { feasible: issues.length === 0, issues, remainingBudget };
}

export function evaluateEngineeringTest(stats, difficultyId) {
  const preset = getDifficultyPreset(difficultyId);
  const testCost = preset.requiresTest ? preset.testCost : 0;
  const issues = [];
  const remainingBudget = preset.budgetMax - stats.spentCost;
  if (remainingBudget < testCost) issues.push(`Faltam $${testCost - remainingBudget}M para custear o teste.`);
  if (stats.totalMass > preset.maxMass) issues.push(`Massa ${stats.totalMass} kg acima do limite de ${preset.maxMass} kg.`);
  if (stats.netPower < preset.minPower) issues.push(`Potência ${stats.netPower} W abaixo da margem de ${preset.minPower} W.`);
  return {
    pass: issues.length === 0,
    testCost,
    issues,
    message: issues.length === 0
      ? 'Teste de integração aprovado. Sistemas prontos para lançamento.'
      : 'Teste reprovado: revise os módulos indicados antes de tentar novamente.'
  };
}

/**
 * Launch validation. Technology does not block liftoff: a low-tech rocket still flies,
 * and its science yield is judged after the mission in the post-mission report.
 */
export function evaluateLaunch(stats, difficultyId, builtLabCount, testsComplete = false) {
  const preset = getDifficultyPreset(difficultyId);
  const issues = [];
  let failureCause = '';
  if (builtLabCount < 5) issues.push(`Laboratórios incompletos: ${builtLabCount}/5 construídos.`);
  const remainingBudget = preset.budgetMax - stats.spentCost;
  if (remainingBudget < 0) issues.push(`Orçamento excedido em $${Math.abs(remainingBudget)}M.`);
  if (stats.totalMass > preset.maxMass) {
    issues.push(`Massa ${stats.totalMass} kg acima do limite de ${preset.maxMass} kg.`);
    failureCause = failureCause || 'weight';
  }
  if (stats.netPower < preset.minPower) {
    issues.push(`Potência ${stats.netPower} W abaixo da margem de ${preset.minPower} W.`);
    failureCause = failureCause || 'power';
  }
  if (preset.requiresTest && !testsComplete) issues.push('O teste de integração obrigatório ainda não foi aprovado.');
  if (issues.length && !failureCause) failureCause = 'validation';
  return {
    success: issues.length === 0,
    difficulty: preset.id,
    cml: preset.cml,
    issues,
    failureCause,
    technologyIndex: stats.techIndex ?? 0,
    scienceYield: stats.scienceYield ?? 0,
    scienceThreshold: SCIENCE_SUCCESS_THRESHOLD,
    message: issues.length === 0
      ? 'Validação concluída. Telemetria orbital estável; inserção em órbita confirmada.'
      : 'Lançamento abortado com segurança. Ajuste o projeto e tente novamente.'
  };
}
