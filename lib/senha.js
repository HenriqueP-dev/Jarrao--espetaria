// Troca da própria senha (tela /senha). A senha nunca passa pelo nosso banco:
// vai direto para o Supabase Auth (supabase.auth.updateUser).

// Auditoria, etapa 10: mínimo subiu de 8 para 10, com letra e número, e sem as senhas
// mais óbvias. (A proteção contra senhas vazadas do Supabase é do plano pago.)
export const SENHA_MINIMA = 10;
export const SENHA_MAXIMA = 72; // limite do algoritmo de senha do Supabase

const OBVIAS = ['jarrao', 'espetaria', 'senha', 'password', '123456', 'qwerty', 'abcdef'];

// Devolve uma mensagem de erro ou null se a nova senha pode ser usada.
export function validarNovaSenha(nova, repetida) {
  const senha = String(nova ?? '');
  if (senha.length < SENHA_MINIMA) return `A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.`;
  if (senha.length > SENHA_MAXIMA) return `A senha pode ter no máximo ${SENHA_MAXIMA} caracteres.`;
  if (senha.trim() === '') return 'A senha não pode ser só espaços.';
  if (/^(.)\1+$/.test(senha)) return 'Escolha uma senha que não seja o mesmo caractere repetido.';
  if (!/\p{L}/u.test(senha) || !/\d/.test(senha)) return 'Use letras e números na senha.';
  const minuscula = senha.toLowerCase();
  if (OBVIAS.some((o) => minuscula.includes(o))) {
    return 'Essa senha é fácil de adivinhar (tem o nome do lugar, "senha" ou sequência). Escolha outra.';
  }
  if (senha !== String(repetida ?? '')) return 'As duas senhas não são iguais.';
  return null;
}

// Mensagens do Supabase em português simples.
export function traduzirErroSenha(erro) {
  const texto = String(erro?.message ?? erro ?? '').toLowerCase();
  const codigo = String(erro?.code ?? '').toLowerCase();
  if (codigo === 'same_password' || texto.includes('different from the old')) {
    return 'A nova senha precisa ser diferente da atual.';
  }
  if (codigo === 'weak_password' || texto.includes('weak') || texto.includes('should be at least')) {
    return 'Essa senha é fraca demais. Use mais caracteres, misturando letras e números.';
  }
  if (codigo === 'reauthentication_needed' || texto.includes('reauthentication')) {
    return 'Por segurança, saia, entre de novo e tente outra vez.';
  }
  if (codigo.includes('rate_limit') || texto.includes('rate limit')) {
    return 'Muitas tentativas. Espere um pouco e tente de novo.';
  }
  if (texto.includes('session') || texto.includes('not authenticated') || texto.includes('jwt')) {
    return 'Sua sessão expirou. Entre de novo.';
  }
  if (texto.includes('failed to fetch') || texto.includes('network')) {
    return 'Sem conexão com o sistema. Confira a internet.';
  }
  return 'Não foi possível trocar a senha. Tente de novo.';
}
