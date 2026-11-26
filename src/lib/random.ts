import type { ID } from './model';

export interface RandomResult {
  order: ID[]; // clasificados, en orden de llegada
  dnf: ID[]; // abandonos
  pole?: ID;
  fastestLap?: ID;
}

/** Genera un resultado de carrera al azar (mezcla de Fisher–Yates). */
export function randomResult(drivers: ID[], opts: { dnfRate?: number; rand?: () => number } = {}): RandomResult {
  const rand = opts.rand ?? Math.random;
  const rate = opts.dnfRate ?? 0;
  const shuffled = [...drivers];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const dnf = rate > 0 ? shuffled.filter(() => rand() < rate) : [];
  // Siempre termina al menos uno
  if (dnf.length === shuffled.length) dnf.pop();
  const order = shuffled.filter((d) => !dnf.includes(d));
  const pick = (list: ID[]) => list[Math.floor(rand() * list.length)];
  return {
    order,
    dnf,
    pole: pick(shuffled),
    fastestLap: pick(order.slice(0, Math.max(1, Math.min(10, order.length)))),
  };
}
