/**
 * In-character guidance for failed launches and expeditions. Pure text selection only.
 * Each roast names the mistake that caused the failure, so the player knows what to fix.
 */
export const FAILURE_MESSAGES = Object.freeze({
  lowTech: (technologyIndex) => `Parabéns, engenheiro. O foguete subiu lindo, mas nosso computador de bordo era tão primitivo que o rover pousou a 400 quilômetros do alvo. O "scanner avançado" que você comprou de promoção é basicamente uma lanterna velha com fita isolante. Tech Level ${technologyIndex}%: o Congresso acabou de cortar nosso orçamento de café para os próximos dez anos. Tente de novo.`,
  lowScience: 'O rover voltou com as amostras, mas a ciência não fechou: tecnologia barata demais deixou os dados imprecisos. O Congresso quer saber por que financiamos uma lanterna lunar. Suba o Tech Level antes de voltar.',
  energy: 'O rover ficou sem bateria no meio do nada. Lua não tem posto de gasolina, e o guia não tem paciência. Calcule a carga antes de sair da luz do sol.',
  circuits: 'CIRCUITOS DESTRUÍDOS. A tempestade solar fritou o que restava da telemetria. Da próxima vez, deixe os sistemas em Economia quando o alerta tocar.',
  abort: 'Você desistiu com as amostras ainda no porta-malas. A ciência não perdoa pressa. Tente de novo, dessa vez até o fim.',
  weight: 'Boa tentativa. Acontece que a blindagem de titânio somada à sua super perfuratriz transformou o foguete em um tijolo voador. O propelente acabou na metade da atmosfera e nós viramos uma chuva de meteoritos artificiais sobre o Atlântico. Recomendo abrir o manual de física básica antes de voltar para a prancheta.',
  power: 'Ótimo design de nave, mas ela consome mais energia do que os painéis conseguem entregar. Sem potência, a telemetria apaga antes da ignição. Equilibre os sistemas antes de pedir fogos de artifício.',
  validation: 'A prancheta ainda tem cara de rascunho. Termine os laboratórios e as validações antes de pedir fogo na plataforma.'
});

/** Roast for a launch that aborted on the pad, chosen by its primary failure cause. */
export function getLaunchRoast(failureCause) {
  return FAILURE_MESSAGES[failureCause] || FAILURE_MESSAGES.validation;
}

/**
 * Roast for a failed expedition. `report` is the output of getMissionReport().
 * Technology and science failures get the harshest messages, because the fix is always in the build.
 */
export function getSurfaceRoast(report) {
  const kind = report?.failureKind || 'abort';
  if (kind === 'tech') return FAILURE_MESSAGES.lowTech(report.techIndex ?? 0);
  if (kind === 'science') return FAILURE_MESSAGES.lowScience;
  if (kind === 'energy') return FAILURE_MESSAGES.energy;
  if (kind === 'circuits') return FAILURE_MESSAGES.circuits;
  return FAILURE_MESSAGES.abort;
}
