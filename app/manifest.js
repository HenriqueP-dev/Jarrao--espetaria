// Permite "adicionar à tela inicial" no celular, com o ícone da marca.
export default function manifest() {
  return {
    name: 'Jarrão Espetaria',
    short_name: 'Jarrão',
    description: 'Pedidos, mesas e contas do Jarrão Espetaria',
    start_url: '/',
    display: 'standalone',
    background_color: '#0b0b0b',
    theme_color: '#0b0b0b',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}
