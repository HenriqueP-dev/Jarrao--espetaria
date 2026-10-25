'use client';

import { useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { agruparChamadas } from '../../lib/agendar';

// Mantém uma tela atualizada sem recarregar à toa:
//  - carrega ao abrir;
//  - tempo real: avisos em rajada (um pedido com vários itens) viram UMA recarga;
//  - reserva: recarrega a cada `intervalo` ms, mas só com a aba visível
//    (celular com a tela apagada ou aba escondida não fica consultando o banco);
//  - ao voltar para a aba, recarrega na hora.
// `tabelas` vazio = só a reserva (sem tempo real).
export function useTempoReal({ nome, tabelas = [], carregar, intervalo = 30000, ativo = true }) {
  useEffect(() => {
    if (!ativo) return undefined;
    carregar();
    const recarregar = agruparChamadas(carregar);

    let canal = null;
    if (tabelas.length) {
      canal = supabase.channel(nome);
      for (const tabela of tabelas) {
        canal.on('postgres_changes', { event: '*', schema: 'public', table: tabela }, recarregar);
      }
      canal.subscribe();
    }

    const tempo = setInterval(() => {
      if (!document.hidden) carregar();
    }, intervalo);
    const aoVoltar = () => {
      if (!document.hidden) recarregar();
    };
    document.addEventListener('visibilitychange', aoVoltar);

    return () => {
      recarregar.cancelar();
      clearInterval(tempo);
      document.removeEventListener('visibilitychange', aoVoltar);
      if (canal) supabase.removeChannel(canal);
    };
    // `tabelas` é uma lista fixa em cada tela; comparar pelo texto evita reassinar à toa
  }, [nome, tabelas.join(','), carregar, intervalo, ativo]);
}
