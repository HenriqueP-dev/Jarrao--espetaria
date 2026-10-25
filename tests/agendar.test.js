import { describe, it, expect, vi, afterEach } from 'vitest';
import { agruparChamadas } from '../lib/agendar';

afterEach(() => vi.useRealTimers());

describe('agrupar chamadas (recargas do tempo real)', () => {
  it('uma rajada de avisos vira uma recarga só', () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const chamar = agruparChamadas(fn, 300);
    for (let i = 0; i < 6; i++) chamar(); // pedido com 6 itens
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(300);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('avisos em momentos separados recarregam de novo', () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const chamar = agruparChamadas(fn, 300);
    chamar();
    vi.advanceTimersByTime(300);
    chamar();
    vi.advanceTimersByTime(300);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('cancelar (tela fechada) não recarrega depois', () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const chamar = agruparChamadas(fn, 300);
    chamar();
    chamar.cancelar();
    vi.advanceTimersByTime(1000);
    expect(fn).not.toHaveBeenCalled();
  });
});
