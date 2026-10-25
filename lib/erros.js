// Transforma um erro do Supabase numa frase que a equipe entende (auditoria, etapa 10).
// As regras do sistema já falam português (são escritas por nós nas funções do banco, código
// P0001 ou 42501 com texto nosso); o resto (erro técnico do Postgres ou da rede) vira uma
// frase simples, sem nomes de tabela ou de restrição.

const SEM_CONEXAO = 'Sem conexão com o sistema. Confira a internet e tente de novo.';

export function mensagemDeErro(erro) {
  if (!erro) return null;
  const texto = String(erro.message ?? erro ?? '');
  const codigo = String(erro.code ?? '');
  const minusculo = texto.toLowerCase();

  if (minusculo.includes('failed to fetch') || minusculo.includes('network') || minusculo.includes('load failed')) {
    return SEM_CONEXAO;
  }
  if (minusculo.includes('jwt') || codigo === 'PGRST301' || codigo === 'PGRST303') {
    return 'Sua sessão expirou. Saia e entre de novo.';
  }
  // regras do sistema (raise exception nas nossas funções): o texto já é para a equipe
  if (codigo === 'P0001') return texto;
  if (codigo === '42501') {
    return minusculo.includes('permission denied')
      ? 'Você não tem permissão para fazer isso.'
      : texto; // "Entre no sistema para continuar", "O perfil garcom não pode fazer isto"...
  }
  if (codigo === '23505') return 'Já existe um registro igual a esse.';
  if (codigo === '23514' || codigo === '23502' || codigo === '22P02' || codigo === '22003') {
    return 'Algum valor está fora do permitido. Confira o que foi digitado.';
  }
  if (codigo === '57014') return 'O sistema demorou para responder. Tente de novo.';
  return 'Não foi possível concluir. Tente de novo; se continuar, avise o dono.';
}
