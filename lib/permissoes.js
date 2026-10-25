// Perfis e telas permitidas. É só o que a TELA mostra, por conforto: quem realmente
// impede é o banco (migration 008, função private.exigir_perfil). Mantenha as duas
// coisas coerentes.
// HIPÓTESE (ver docs/DECISOES.md): matriz de permissões a confirmar com o dono.

export const PERFIS = {
  garcom: 'Garçom',
  cozinha: 'Cozinha',
  churrasqueira: 'Churrasqueira',
  caixa: 'Caixa',
  dono: 'Dono',
};

const TELAS_DO_ATENDIMENTO = ['/garcom', '/cozinha', '/churrasqueira', '/mesas', '/caixa', '/vendas'];

// Estoque: caixa e dono (hipótese). Produtos e equipe: só o dono.
const PAGINAS = {
  garcom: ['/garcom', '/mesas'],
  cozinha: ['/cozinha'],
  churrasqueira: ['/churrasqueira'],
  caixa: [...TELAS_DO_ATENDIMENTO, '/estoque'],
  dono: [...TELAS_DO_ATENDIMENTO, '/estoque', '/produtos', '/equipe'],
};

const INICIAL = {
  garcom: '/garcom',
  cozinha: '/cozinha',
  churrasqueira: '/churrasqueira',
  caixa: '/caixa',
  dono: '/vendas',
};

export function paginasDoPerfil(perfil) {
  return PAGINAS[perfil] ?? [];
}

// A tela inicial ("/"), a de entrar ("/entrar") e a de trocar a própria senha ("/senha") são
// livres para todos os perfis (quem não estiver logado vê um aviso na tela da senha).
export function podeAcessar(perfil, caminho) {
  if (caminho === '/' || caminho === '/entrar' || caminho === '/senha') return true;
  return paginasDoPerfil(perfil).includes(caminho);
}

export function paginaInicial(perfil) {
  return INICIAL[perfil] ?? '/';
}

// O que o porteiro da tela (Guarda) faz com esta pessoa nesta página:
//  'carregando'     ainda lendo a sessão
//  'liberar'        mostra a página (trava desligada, ou tela de entrar, ou perfil com acesso)
//  'entrar'         trava ligada e ninguém logado: manda para /entrar
//  'sem_perfil'     logou, mas o dono ainda não liberou (ou desativou) o perfil
//  'sem_permissao'  tem perfil, mas este perfil não usa esta tela
export function decidirAcesso({ carregando, loginObrigatorio, usuario, perfil, caminho }) {
  if (carregando) return 'carregando';
  if (!loginObrigatorio || caminho === '/entrar') return 'liberar';
  if (!usuario) return 'entrar';
  if (!perfil) return 'sem_perfil';
  return podeAcessar(perfil, caminho) ? 'liberar' : 'sem_permissao';
}

// Quais itens do menu mostrar. Trava desligada: tudo (menos "Equipe", que é só do dono).
// Trava ligada: só as telas do perfil. Enquanto carrega: nada, para não piscar.
export function linksDoMenu(links, { carregando, loginObrigatorio, perfil }) {
  if (carregando) return [];
  if (loginObrigatorio) return links.filter(([href]) => paginasDoPerfil(perfil).includes(href));
  return links.filter(([href]) => !TELAS_SO_DO_DONO.includes(href) || perfil === 'dono');
}

// Telas que só o dono usa, mesmo com a trava do login desligada (o banco exige dono logado).
export const TELAS_SO_DO_DONO = ['/produtos', '/equipe'];

// Mensagens do login do Supabase em português simples.
export function traduzirErroLogin(erro) {
  const texto = String(erro?.message ?? erro ?? '').toLowerCase();
  const codigo = String(erro?.code ?? '').toLowerCase();
  if (codigo === 'invalid_credentials' || texto.includes('invalid login credentials')) {
    return 'E-mail ou senha incorretos.';
  }
  if (codigo === 'email_not_confirmed' || texto.includes('email not confirmed')) {
    return 'Este e-mail ainda não foi confirmado. Peça ajuda ao dono.';
  }
  if (codigo.includes('rate_limit') || texto.includes('rate limit') || texto.includes('too many')) {
    return 'Muitas tentativas. Espere um pouco e tente de novo.';
  }
  if (texto.includes('failed to fetch') || texto.includes('network')) {
    return 'Sem conexão com o sistema. Confira a internet.';
  }
  return 'Não foi possível entrar. Tente de novo.';
}
