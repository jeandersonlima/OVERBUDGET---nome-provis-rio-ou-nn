/** Data source for the mission manual. Values are shared with the active catalog and grid simulation. */
import { MODULE_CATEGORIES } from './catalog.js';
import { SCIENCE_SUCCESS_THRESHOLD, TECH_DETECTION_MIN_INDEX } from './missionState.js';
import {
  GRID_SEED, GRID_COLS, GRID_ROWS, GRID_TILE_SIZE, SAMPLE_GOAL, MISSION_CRYSTAL_COUNT,
  GRID_CRYSTAL_POSITIONS, SCANNER_MEMORY_CAPACITY, DRILL_MEMORY_CAPACITY,
  SCANNER_ENERGY_COST, DRILL_ENERGY_COST, ROVER_ROCK_SPEED_FACTOR
} from './planetaryGridRules.js';

const optionData = (option) => ({
  name: option.name, cost: option.cost, mass: option.mass,
  power: option.power, science: option.science, techLevel: option.techLevel ?? 1
});

export function buildMissionManualPages() {
  const modules = MODULE_CATEGORIES.map((category, index) => ({
    id: category.id, number: String(index + 1).padStart(2, '0'), label: category.label,
    summary: category.manualSummary, standard: optionData(category.options.standard), advanced: optionData(category.options.advanced)
  }));
  const payload = MODULE_CATEGORIES.find((category) => category.id === 'payload');
  const scannerRover = {
    id: 'standard', name: payload.options.standard.name, art: 'rover_map_scanner',
    mass: payload.options.standard.mass, power: payload.options.standard.power, science: payload.options.standard.science,
    sampleUnits: 1, memory: SCANNER_MEMORY_CAPACITY, energy: SCANNER_ENERGY_COST
  };
  const drillRover = {
    id: 'advanced', name: payload.options.advanced.name, art: 'rover_map_drill',
    mass: payload.options.advanced.mass, power: payload.options.advanced.power, science: payload.options.advanced.science,
    sampleUnits: 1, memory: DRILL_MEMORY_CAPACITY, energy: DRILL_ENERGY_COST
  };

  return [
    {
      id: 'mission-overview', eyebrow: '01 · RESUMO DE MISSÃO', title: 'SEQUÊNCIA DE VOO',
      intro: 'STARFORGE · do hangar ao Polo Sul: planeje, pouse, explore e transmita.',
      steps: [
        { number: '01', title: 'MONTAGEM', text: 'Escolha entre peças simples e avançadas: custo e massa menores sacrificam precisão científica.' },
        { number: '02', title: 'VALIDAÇÃO', text: 'Respeite o orçamento e os limites de massa e potência do Centro de Missão Lunar.' },
        { number: '03', title: 'LANÇAMENTO', text: 'Complete os laboratórios e a verificação exigida para liberar a missão.' },
        { number: '04', title: 'POLO SUL', text: `Explore o mapa-semente ${GRID_SEED}, colete ${SAMPLE_GOAL} de ${MISSION_CRYSTAL_COUNT} cristais e transmita os dados para a Terra.` }
      ],
      missionFacts: [`GRADE ${GRID_COLS}×${GRID_ROWS} · TILE ${GRID_TILE_SIZE}px`, `SEED FIXA ${GRID_SEED}`, `${MISSION_CRYSTAL_COUNT} CRISTAIS · ${SAMPLE_GOAL} PARA VENCER`]
    },
    {
      id: 'labs-and-hardware', eyebrow: '02 · SEGMENTO DE LANÇAMENTO', title: 'LABORATÓRIOS & PEÇAS',
      intro: 'Cada terminal libera uma família. Custo, massa, potência, ciência e tecnologia vêm do catálogo ativo.', modules
    },
    {
      id: 'rover-platforms', eyebrow: '03 · CARGA ÚTIL', title: 'ESCOLHA DO ROVER',
      intro: 'O módulo de Rover define alcance de coleta, memória, gasto de energia e visual do veículo.',
      rovers: [scannerRover, drillRover],
      discoveryRadius: 4,
      workflow: [
        'Use COLETAR [C] ou toque em um cristal revelado; Fácil e Normal pilotam até ele automaticamente.',
        'Scanner: alcance 3,3 tiles, 1,5 s, custo 3% BAT, 2 slots de memória.',
        'Perfuratriz: alcance 1,7 tiles, 3 s, custo 12% BAT e +15 TERM; 1 slot de memória.'
      ]
    },
    {
      id: 'surface-operations', eyebrow: '04 · PROCEDIMENTOS DE SUPERFÍCIE', title: 'OPERAÇÃO LUNAR',
      intro: 'Top-down tático: clique para traçar uma rota A* e escolha quando explorar, conservar energia e transmitir.',
      worldStats: { cols: GRID_COLS, rows: GRID_ROWS, tileSize: GRID_TILE_SIZE, seed: GRID_SEED, crystalCount: MISSION_CRYSTAL_COUNT, sampleGoal: SAMPLE_GOAL },
      roverStats: {
        plainSpeed: 100, rockSpeedPercent: Math.round(ROVER_ROCK_SPEED_FACTOR * 100),
        plainDrain: 1.2, rockDrain: 2.4, solar: 2.2, economySolar: 3.2,
        craterDrain: 2.8, economyCraterDrain: 1.4, rtg: 1.2,
        stormEasy: 60, stormNormal: 90, stormHard: 70
      },
      terrains: [
        { id: 'sunlight', title: 'PLAIN · SOLO PLANO', text: '100% de velocidade, gasto normal, resfria TERM em 5/s, recebe carga solar e mantém sinal livre.' },
        { id: 'rocks', title: 'ROCK · CAMPO DE ROCHAS', text: '50% de velocidade, custo de movimento ×2, aquece +9 TERM/s (exceto Fácil); peso A* 2,4.' },
        { id: 'shadow', title: 'CRATER · CRATERAS', text: 'Sem luz solar, drena mais 2,8 BAT/s (1,4 em Economia) e bloqueia o sinal da Terra; peso A* 1,6.' },
        { id: 'mountain', title: 'MOUNT · MONTANHAS', text: 'Blocos intransponíveis. Uma montanha ao norte na mesma coluna corta a linha de visão com a Terra.' }
      ]
    },
    {
      id: 'tech-yield', eyebrow: '05 · TECNOLOGIA & CIÊNCIA', title: 'TECH LEVEL & RENDIMENTO',
      intro: 'Peças simples reduzem custo e massa, mas deixam o rover menos preciso. O lançamento continua possível; o preço aparece na superfície e no relatório.',
      steps: [
        { number: '01', title: 'TECH INDEX', text: 'Cada módulo simples vale 1 ponto e cada avançado vale 3. O índice total (0–100%) controla precisão e rendimento científico.' },
        { number: '02', title: 'DETECÇÃO', text: `Abaixo de ${TECH_DETECTION_MIN_INDEX}% o scanner não detecta gelo; tentar coletar perto de um cristal encerra a missão por falha tecnológica.` },
        { number: '03', title: 'RENDIMENTO', text: `Ciência das peças × Tech Index = rendimento. Menos de ${SCIENCE_SUCCESS_THRESHOLD} pontos reprova o relatório, mesmo após transmitir três amostras.` },
        { number: '04', title: 'ESCOLHA', text: 'Peças avançadas melhoram a ciência e o sinal; peças simples são mais leves e baratas. Ajuste a montagem antes de partir.' }
      ],
      missionFacts: [`DETECÇÃO MÍNIMA ${TECH_DETECTION_MIN_INDEX}%`, `RELATÓRIO MÍNIMO ${SCIENCE_SUCCESS_THRESHOLD} PONTOS`, `POIs FIXOS: ${GRID_CRYSTAL_POSITIONS.map((p) => `(${p.x},${p.y})`).join(' · ')}`]
    }
  ];
}

export const MISSION_MANUAL_PAGES = buildMissionManualPages();
export const MISSION_MANUAL_PAGE_COUNT = MISSION_MANUAL_PAGES.length;
