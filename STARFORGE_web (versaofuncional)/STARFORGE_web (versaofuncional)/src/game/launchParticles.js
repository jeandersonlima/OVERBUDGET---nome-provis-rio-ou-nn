/**
 * Pure launch exhaust particle simulation. Canvas rendering lives in sceneRenderer.js.
 */
const MAX_PARTICLES = 120;
const EMISSION_RATE = 28;

export function emitLaunchParticles(particles, emitter, accumulator, dt, random = Math.random) {
  const safeDt = Math.max(0, Math.min(0.11, dt));
  let carry = accumulator + safeDt;
  let next = particles;
  const interval = 1 / EMISSION_RATE;

  while (carry >= interval && next.length < MAX_PARTICLES) {
    carry -= interval;
    const roll = random();
    const kind = roll < 0.68 ? 'flame' : 'spark';
    next = [...next, {
      x: emitter.x + (random() - 0.5) * 20,
      y: emitter.y + (random() - 0.5) * 10,
      vx: (random() - 0.5) * 64,
      vy: 90 + random() * 150,
      life: 0.48 + random() * 0.55,
      maxLife: 1.03,
      size: 10 + random() * 15,
      rotation: (random() - 0.5) * 0.45,
      spin: (random() - 0.5) * 1.8,
      kind
    }];
  }

  return { particles: next, accumulator: carry };
}

export function updateLaunchParticles(particles, dt) {
  const safeDt = Math.max(0, Math.min(0.11, dt));
  const updated = [];
  for (const particle of particles) {
    const life = particle.life - safeDt;
    if (life <= 0) continue;
    updated.push({
      ...particle,
      x: particle.x + particle.vx * safeDt,
      y: particle.y + particle.vy * safeDt,
      vx: particle.vx * (1 - safeDt * 0.35),
      vy: particle.vy + 18 * safeDt,
      life,
      rotation: particle.rotation + particle.spin * safeDt
    });
  }
  return updated.slice(-MAX_PARTICLES);
}

export function particleAlpha(particle) {
  if (!particle || !Number.isFinite(particle.life) || !Number.isFinite(particle.maxLife) || particle.maxLife <= 0) return 0;
  return Math.max(0, Math.min(1, particle.life / particle.maxLife));
}
