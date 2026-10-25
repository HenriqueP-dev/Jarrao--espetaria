// Cabeçalhos de segurança do site.
// Em desenvolvimento ficam desligados os que atrapalham o recarregamento automático (CSP e HSTS).
//
// Sobre a política de conteúdo (CSP): ela só deixa o site falar com ele mesmo e com o projeto do
// Supabase. Scripts e estilos "inline" continuam permitidos porque o Next.js precisa deles para
// carregar as páginas. Uma política mais rígida (com "nonce") exigiria deixar todas as páginas
// dinâmicas; fica como melhoria futura (ver docs/PUBLICACAO.md).

const producao = process.env.NODE_ENV === 'production';

let supabase = '';
try {
  supabase = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').host;
} catch {
  // sem URL do Supabase configurada: o site não conversa com ninguém além dele mesmo
}

const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self'${supabase ? ` https://${supabase} wss://${supabase}` : ''}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

const cabecalhos = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
  ...(producao
    ? [
        { key: 'Content-Security-Policy', value: csp },
        { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
      ]
    : []),
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: cabecalhos }];
  },
};

export default nextConfig;
