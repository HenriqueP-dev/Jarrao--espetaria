import { describe, it, expect } from 'vitest';
import {
  PERFIS,
  paginasDoPerfil,
  podeAcessar,
  paginaInicial,
  decidirAcesso,
  linksDoMenu,
  traduzirErroLogin,
} from '../lib/permissoes.js';

describe('telas por perfil', () => {
  it('garçom lança pedido e vê as mesas, mas não o caixa nem as vendas', () => {
    expect(podeAcessar('garcom', '/garcom')).toBe(true);
    expect(podeAcessar('garcom', '/mesas')).toBe(true);
    expect(podeAcessar('garcom', '/caixa')).toBe(false);
    expect(podeAcessar('garcom', '/vendas')).toBe(false);
    expect(podeAcessar('garcom', '/equipe')).toBe(false);
  });

  it('cozinha e churrasqueira só veem a própria tela', () => {
    expect(paginasDoPerfil('cozinha')).toEqual(['/cozinha']);
    expect(paginasDoPerfil('churrasqueira')).toEqual(['/churrasqueira']);
    expect(podeAcessar('cozinha', '/churrasqueira')).toBe(false);
    expect(podeAcessar('churrasqueira', '/cozinha')).toBe(false);
  });

  it('caixa vê o atendimento todo, mas não a equipe', () => {
    for (const tela of ['/garcom', '/cozinha', '/churrasqueira', '/mesas', '/caixa', '/vendas']) {
      expect(podeAcessar('caixa', tela)).toBe(true);
    }
    expect(podeAcessar('caixa', '/equipe')).toBe(false);
  });

  it('só o dono vê a equipe', () => {
    expect(podeAcessar('dono', '/equipe')).toBe(true);
    expect(podeAcessar('dono', '/vendas')).toBe(true);
  });

  it('o início e a tela de entrar são livres; perfil desconhecido não acessa nada', () => {
    expect(podeAcessar('garcom', '/')).toBe(true);
    expect(podeAcessar(null, '/entrar')).toBe(true);
    expect(podeAcessar(null, '/caixa')).toBe(false);
    expect(podeAcessar('invasor', '/garcom')).toBe(false);
  });

  it('cada perfil abre na sua tela', () => {
    expect(paginaInicial('garcom')).toBe('/garcom');
    expect(paginaInicial('cozinha')).toBe('/cozinha');
    expect(paginaInicial('caixa')).toBe('/caixa');
    expect(paginaInicial('dono')).toBe('/vendas');
    expect(paginaInicial(null)).toBe('/');
  });

  it('a tela inicial de cada perfil é uma tela que ele pode acessar', () => {
    for (const perfil of Object.keys(PERFIS)) {
      expect(podeAcessar(perfil, paginaInicial(perfil))).toBe(true);
    }
  });
});

describe('porteiro da tela', () => {
  const base = { carregando: false, loginObrigatorio: false, usuario: null, perfil: null, caminho: '/caixa' };
  const logado = { id: 'u1' };

  it('trava desligada: todo mundo entra, como no protótipo', () => {
    expect(decidirAcesso({ ...base })).toBe('liberar');
    expect(decidirAcesso({ ...base, usuario: logado, perfil: 'garcom' })).toBe('liberar');
  });

  it('endereço que não existe mostra a página 404, com ou sem login', () => {
    expect(decidirAcesso({ ...base, loginObrigatorio: true, caminho: '/nao-existe' })).toBe('liberar');
    expect(decidirAcesso({ ...base, loginObrigatorio: true, usuario: logado, perfil: 'garcom', caminho: '/xyz' })).toBe('liberar');
    // telas reais continuam protegidas
    expect(decidirAcesso({ ...base, loginObrigatorio: true, caminho: '/caixa' })).toBe('entrar');
  });

  it('enquanto lê a sessão, espera', () => {
    expect(decidirAcesso({ ...base, carregando: true, loginObrigatorio: true })).toBe('carregando');
  });

  it('trava ligada e ninguém logado: manda para entrar, mas a tela de entrar é livre', () => {
    expect(decidirAcesso({ ...base, loginObrigatorio: true })).toBe('entrar');
    expect(decidirAcesso({ ...base, loginObrigatorio: true, caminho: '/entrar' })).toBe('liberar');
  });

  it('trava ligada: logado sem perfil ou desativado não passa', () => {
    expect(decidirAcesso({ ...base, loginObrigatorio: true, usuario: logado, perfil: null })).toBe('sem_perfil');
  });

  it('trava ligada: cada perfil só vê as suas telas', () => {
    const com = (perfil, caminho) =>
      decidirAcesso({ ...base, loginObrigatorio: true, usuario: logado, perfil, caminho });
    expect(com('garcom', '/garcom')).toBe('liberar');
    expect(com('garcom', '/caixa')).toBe('sem_permissao');
    expect(com('cozinha', '/churrasqueira')).toBe('sem_permissao');
    expect(com('caixa', '/vendas')).toBe('liberar');
    expect(com('caixa', '/equipe')).toBe('sem_permissao');
    expect(com('dono', '/equipe')).toBe('liberar');
    expect(com('garcom', '/')).toBe('liberar');
  });
});

describe('menu', () => {
  const links = [['/garcom', 'Garçom'], ['/caixa', 'Caixa'], ['/vendas', 'Vendas'], ['/equipe', 'Equipe']];
  const hrefs = (r) => r.map(([h]) => h);

  it('trava desligada: mostra tudo, e "Equipe" e "Produtos" só para o dono', () => {
    const comProdutos = [...links, ['/produtos', 'Produtos']];
    expect(hrefs(linksDoMenu(comProdutos, { carregando: false, loginObrigatorio: false, perfil: null }))).toEqual([
      '/garcom', '/caixa', '/vendas',
    ]);
    const doDono = hrefs(linksDoMenu(comProdutos, { carregando: false, loginObrigatorio: false, perfil: 'dono' }));
    expect(doDono).toContain('/equipe');
    expect(doDono).toContain('/produtos');
  });

  it('estoque: caixa e dono; produtos: só o dono', () => {
    expect(podeAcessar('caixa', '/estoque')).toBe(true);
    expect(podeAcessar('dono', '/estoque')).toBe(true);
    expect(podeAcessar('garcom', '/estoque')).toBe(false);
    expect(podeAcessar('cozinha', '/estoque')).toBe(false);
    expect(podeAcessar('dono', '/produtos')).toBe(true);
    expect(podeAcessar('caixa', '/produtos')).toBe(false);
    expect(podeAcessar('garcom', '/produtos')).toBe(false);
  });

  it('trava ligada: só as telas do perfil; sem perfil, nada', () => {
    expect(hrefs(linksDoMenu(links, { carregando: false, loginObrigatorio: true, perfil: 'garcom' }))).toEqual(['/garcom']);
    expect(hrefs(linksDoMenu(links, { carregando: false, loginObrigatorio: true, perfil: 'caixa' }))).toEqual([
      '/garcom', '/caixa', '/vendas',
    ]);
    expect(linksDoMenu(links, { carregando: false, loginObrigatorio: true, perfil: null })).toEqual([]);
  });

  it('enquanto carrega, não mostra nada (não pisca)', () => {
    expect(linksDoMenu(links, { carregando: true, loginObrigatorio: false, perfil: 'dono' })).toEqual([]);
  });
});

describe('mensagens de erro do login', () => {
  it('traduz senha errada, e-mail não confirmado, limite e rede', () => {
    expect(traduzirErroLogin({ code: 'invalid_credentials', message: 'Invalid login credentials' })).toMatch(/incorretos/);
    expect(traduzirErroLogin({ message: 'Email not confirmed' })).toMatch(/confirmado/);
    expect(traduzirErroLogin({ code: 'over_request_rate_limit', message: 'x' })).toMatch(/Muitas tentativas/);
    expect(traduzirErroLogin({ message: 'Failed to fetch' })).toMatch(/conexão/);
  });

  it('não repete mensagem técnica desconhecida', () => {
    expect(traduzirErroLogin({ message: 'algo muito estranho do servidor' })).toBe(
      'Não foi possível entrar. Tente de novo.'
    );
    expect(traduzirErroLogin(null)).toBe('Não foi possível entrar. Tente de novo.');
  });
});
