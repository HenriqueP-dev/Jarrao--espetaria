import { describe, it, expect } from 'vitest';
import { validarNovaSenha, traduzirErroSenha, SENHA_MINIMA, SENHA_MAXIMA } from '../lib/senha.js';

describe('nova senha', () => {
  it('aceita uma senha boa e repetida igual', () => {
    expect(validarNovaSenha('churrasco2026', 'churrasco2026')).toBeNull();
    expect(validarNovaSenha('Picanha na brasa 7', 'Picanha na brasa 7')).toBeNull();
    const limite = 'b'.repeat(SENHA_MINIMA - 1) + '9';
    expect(validarNovaSenha(limite, limite)).toBeNull();
  });

  it('recusa senha curta, longa demais, só espaços ou repetida', () => {
    expect(validarNovaSenha('abc123', 'abc123')).toMatch(/pelo menos/);
    expect(validarNovaSenha('churras26', 'churras26')).toMatch(/pelo menos/); // 9 caracteres
    expect(validarNovaSenha('x'.repeat(SENHA_MAXIMA + 1), 'x'.repeat(SENHA_MAXIMA + 1))).toMatch(/máximo/);
    expect(validarNovaSenha('          ', '          ')).toMatch(/espaços/);
    expect(validarNovaSenha('aaaaaaaaaa', 'aaaaaaaaaa')).toMatch(/repetido/);
  });

  it('exige letras e números e recusa as óbvias', () => {
    expect(validarNovaSenha('churrascobom', 'churrascobom')).toMatch(/letras e números/);
    expect(validarNovaSenha('2026202620', '2026202620')).toMatch(/letras e números/);
    expect(validarNovaSenha('Jarrao2026!', 'Jarrao2026!')).toMatch(/adivinhar/);
    expect(validarNovaSenha('minhasenha1', 'minhasenha1')).toMatch(/adivinhar/);
    expect(validarNovaSenha('abc1234567', 'abc1234567')).toMatch(/adivinhar/);
  });

  it('recusa quando as duas senhas não batem', () => {
    expect(validarNovaSenha('churrasco2026', 'churrasco2027')).toMatch(/não são iguais/);
    expect(validarNovaSenha('churrasco2026', '')).toMatch(/não são iguais/);
  });
});

describe('mensagens do Supabase', () => {
  it('traduz os casos comuns', () => {
    expect(traduzirErroSenha({ code: 'same_password', message: 'x' })).toMatch(/diferente da atual/);
    expect(traduzirErroSenha({ code: 'weak_password', message: 'x' })).toMatch(/fraca/);
    expect(traduzirErroSenha({ message: 'Password should be at least 6 characters' })).toMatch(/fraca/);
    expect(traduzirErroSenha({ code: 'reauthentication_needed' })).toMatch(/entre de novo/);
    expect(traduzirErroSenha({ message: 'Failed to fetch' })).toMatch(/conexão/);
  });

  it('não repete mensagem técnica desconhecida', () => {
    expect(traduzirErroSenha({ message: 'erro estranho' })).toBe('Não foi possível trocar a senha. Tente de novo.');
    expect(traduzirErroSenha(null)).toBe('Não foi possível trocar a senha. Tente de novo.');
  });
});
