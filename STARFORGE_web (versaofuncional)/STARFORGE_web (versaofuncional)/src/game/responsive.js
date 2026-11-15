/**
 * Ajuste responsivo do canvas: encaixa o jogo (proporção lógica 9:16 ou 16:9) em qualquer tela,
 * respeitando áreas seguras (notch) e a barra de endereço dinâmica dos celulares.
 */

/** Função pura (testável): maior tamanho que cabe na área mantendo a proporção do canvas. */
export function computeFit(availW, availH, logicalW, logicalH, dpr = 1) {
  const aw = Math.max(1, availW);
  const ah = Math.max(1, availH);
  const scale = Math.min(aw / logicalW, ah / logicalH);
  const deviceScale = scale * dpr;
  // Pixel art nítida só quando a escala é (quase) inteira; senão suaviza para o texto não ficar serrilhado.
  const crisp = deviceScale >= 1.5 && Math.abs(deviceScale - Math.round(deviceScale)) < 0.08;
  return {
    width: Math.max(1, Math.floor(logicalW * scale)),
    height: Math.max(1, Math.floor(logicalH * scale)),
    scale,
    imageRendering: crisp ? 'pixelated' : 'auto'
  };
}

export function installResponsiveCanvas(canvas, stage = canvas.parentElement) {
  function apply() {
    const vv = window.visualViewport;
    const vw = vv ? vv.width : window.innerWidth;
    const vh = vv ? vv.height : window.innerHeight;
    stage.style.width = `${vw}px`;
    stage.style.height = `${vh}px`;
    const cs = getComputedStyle(stage);
    const padX = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
    const padY = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
    const fit = computeFit(vw - padX, vh - padY, canvas.width, canvas.height, window.devicePixelRatio || 1);
    canvas.style.width = `${fit.width}px`;
    canvas.style.height = `${fit.height}px`;
    canvas.style.imageRendering = fit.imageRendering;
  }
  const mutations = new MutationObserver(apply); // o jogo troca 720x1280 <-> 1280x720 ao girar a tela
  mutations.observe(canvas, { attributes: true, attributeFilter: ['width', 'height'] });
  window.addEventListener('resize', apply);
  window.addEventListener('orientationchange', apply);
  window.visualViewport?.addEventListener('resize', apply);
  apply();
  return function dispose() {
    mutations.disconnect();
    window.removeEventListener('resize', apply);
    window.removeEventListener('orientationchange', apply);
    window.visualViewport?.removeEventListener('resize', apply);
  };
}
