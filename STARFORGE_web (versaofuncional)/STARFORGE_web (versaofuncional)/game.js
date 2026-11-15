/**
 * STARFORGE / Orbital Command: ponto de entrada do jogo (ES Module).
 *
 * Duas formas de iniciar:
 *  1) Plataforma Astrocade: ela injeta `lib` e `window.gameConfig` e chama `window.run(mode)`.
 *  2) Navegador comum (local ou hospedado): este arquivo se inicia sozinho. Carrega o
 *     `game_config.json` por `fetch` (precisa de servidor HTTP) e depois chama `run('play')`.
 */
import { startApp } from './src/game/app.js';
import { installResponsiveCanvas } from './src/game/responsive.js';

function run(mode) {
  startApp(mode);
  requestAnimationFrame(() => requestAnimationFrame(() => document.getElementById('boot')?.remove()));
}

// A plataforma chama window.run(mode); por isso a função precisa estar no escopo global.
window.run = run;

/** Lê o game_config.json e o entrega ao jogo em window.gameConfig (o app lê esse objeto). */
async function loadLocalConfig() {
  if (window.gameConfig) return; // já injetado pela plataforma
  try {
    const res = await fetch('./game_config.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    window.gameConfig = await res.json();
  } catch (err) {
    // Sem servidor HTTP (file://) o fetch é bloqueado; o app usa a configuração padrão.
    console.warn('[STARFORGE] game_config.json não carregado; usando padrões.', err);
  }
}

function showBootError(err) {
  console.error('[STARFORGE] falha ao iniciar:', err);
  document.getElementById('boot')?.remove();
  const box = document.createElement('pre');
  box.textContent = 'STARFORGE não iniciou:\n' + (err && err.message ? err.message : err);
  box.style.cssText = 'position:fixed;left:8px;top:8px;right:8px;margin:0;padding:10px;' +
    'background:#300;color:#fdd;font:12px monospace;white-space:pre-wrap;z-index:9';
  document.body.appendChild(box);
}

/** PWA: permite instalar o jogo e jogar offline. Só em https ou localhost. */
function registerServiceWorker() {
  const secure = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  if (!('serviceWorker' in navigator) || !secure) return;
  navigator.serviceWorker.register('./sw.js').catch((err) => console.warn('[STARFORGE] service worker não registrado.', err));
}

// `lib` só existe na plataforma. Fora dela (servidor local ou hospedagem), inicia sozinho.
if (typeof lib === 'undefined') {
  const canvas = document.getElementById('game-canvas');
  installResponsiveCanvas(canvas, document.getElementById('stage'));
  loadLocalConfig()
    .then(() => {
      run('play');
      canvas.focus({ preventScroll: true });
      registerServiceWorker();
    })
    .catch(showBootError);
}
