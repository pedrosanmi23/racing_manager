import { describe, expect, it } from 'vitest';
import { randomResult } from './random';

const ids = Array.from({ length: 20 }, (_, i) => 'd' + i);

describe('resultado aleatorio', () => {
  it('incluye a todos los pilotos una sola vez', () => {
    const r = randomResult(ids, { dnfRate: 0.2 });
    expect([...r.order, ...r.dnf].sort()).toEqual([...ids].sort());
    expect(r.order.length).toBeGreaterThan(0);
    expect(r.order).toContain(r.fastestLap);
    expect(ids).toContain(r.pole);
  });
  it('sin abandonos todos terminan', () => {
    expect(randomResult(ids).dnf).toHaveLength(0);
  });
  it('siempre termina al menos uno', () => {
    expect(randomResult(['a', 'b'], { dnfRate: 1 }).order).toHaveLength(1);
  });
  it('cambia el orden', () => {
    const orders = new Set(Array.from({ length: 5 }, () => randomResult(ids).order.join()));
    expect(orders.size).toBeGreaterThan(1);
  });
});
