/**
 * Modular spacecraft & rover component catalog.
 * Pure ES module — no DOM, window, or lib references.
 */

export const MODULE_CATEGORIES = [
  {
    id: 'propulsion',
    shortLabel: 'PROP',
    label: 'Propulsão',
    manualSummary: 'Altera massa, potência e ciência do conjunto de motor.',
    accent: '#ff7b3b',
    options: {
      standard: {
        id: 'standard',
        name: 'Motor Leve',
        tag: 'S',
        cost: 40,
        mass: 420,
        power: 120,
        science: 15,
        techLevel: 1,
        color: '#5ec8ff',
        trim: '#1d4f73'
      },
      advanced: {
        id: 'advanced',
        name: 'Propulsor Pesado',
        tag: 'A',
        cost: 95,
        mass: 880,
        power: 220,
        science: 25,
        techLevel: 3,
        color: '#ff7b3b',
        trim: '#8f2d14'
      }
    }
  },
  {
    id: 'avionics',
    shortLabel: 'AVIO',
    label: 'Aviônica',
    manualSummary: 'Computador/autopiloto muda massa, consumo e ciência.',
    accent: '#54e6b8',
    options: {
      standard: {
        id: 'standard',
        name: 'Computador Básico',
        tag: 'S',
        cost: 30,
        mass: 90,
        power: -60,
        science: 15,
        techLevel: 1,
        color: '#7dd3fc',
        trim: '#1e3a5f'
      },
      advanced: {
        id: 'advanced',
        name: 'Autopiloto Avançado',
        tag: 'A',
        cost: 75,
        mass: 130,
        power: -110,
        science: 40,
        techLevel: 3,
        color: '#34f5c5',
        trim: '#0b5c49'
      }
    }
  },
  {
    id: 'structure',
    shortLabel: 'ESTR',
    label: 'Estrutura',
    manualSummary: 'Materiais alteram massa e retorno de ciência estrutural.',
    accent: '#f7c948',
    options: {
      standard: {
        id: 'standard',
        name: 'Alumínio Padrão',
        tag: 'S',
        cost: 35,
        mass: 310,
        power: 0,
        science: 10,
        techLevel: 1,
        color: '#cbd5e1',
        trim: '#475569'
      },
      advanced: {
        id: 'advanced',
        name: 'Blindagem Titânio',
        tag: 'A',
        cost: 85,
        mass: 480,
        power: 0,
        science: 30,
        techLevel: 3,
        color: '#f7c948',
        trim: '#6b4f10'
      }
    }
  },
  {
    id: 'payload',
    shortLabel: 'ROVER',
    label: 'Rover',
    manualSummary: 'Scanner leve ou perfuratriz: muda massa, potência e coleta.',
    accent: '#a78bfa',
    options: {
      standard: {
        id: 'standard',
        name: 'Compacto + Laser',
        tag: 'S',
        cost: 55,
        mass: 240,
        power: -80,
        science: 35,
        techLevel: 1,
        color: '#38bdf8',
        trim: '#0f3f66'
      },
      advanced: {
        id: 'advanced',
        name: 'Pesado + Perfuratriz',
        tag: 'A',
        cost: 120,
        mass: 460,
        power: -160,
        science: 80,
        techLevel: 3,
        color: '#c084fc',
        trim: '#4c1d95'
      }
    }
  },
  {
    id: 'satellite',
    shortLabel: 'SAT',
    label: 'Satélite',
    manualSummary: 'Relé modifica massa, potência disponível e ciência de rádio.',
    accent: '#f472b6',
    options: {
      standard: {
        id: 'standard',
        name: 'Satélite LEO',
        tag: 'S',
        cost: 30,
        mass: 140,
        power: 90,
        science: 25,
        techLevel: 1,
        color: '#93c5fd',
        trim: '#1e3a8a'
      },
      advanced: {
        id: 'advanced',
        name: 'Relé Longo Alcance',
        tag: 'A',
        cost: 70,
        mass: 230,
        power: 190,
        science: 55,
        techLevel: 3,
        color: '#fbbf24',
        trim: '#78350f'
      }
    }
  }
];

export const CATEGORY_BY_ID = Object.fromEntries(
  MODULE_CATEGORIES.map((category) => [category.id, category])
);

export const DEFAULT_EQUIPPED = {
  propulsion: 'standard',
  avionics: 'standard',
  structure: 'standard',
  payload: 'standard',
  satellite: 'standard'
};
