import './globals.css';
import { Bebas_Neue, Inter } from 'next/font/google';
import SessaoProvider from './componentes/Sessao';
import Cabecalho from './componentes/Cabecalho';
import Guarda from './componentes/Guarda';

// Títulos em letras condensadas (parecidas com as do logo) e texto em Inter.
const titulo = Bebas_Neue({ weight: '400', subsets: ['latin'], variable: '--fonte-titulo' });
const corpo = Inter({ subsets: ['latin'], variable: '--fonte-corpo' });

export const metadata = {
  title: 'Jarrão Espetaria',
  description: 'Pedidos, mesas e contas do Jarrão Espetaria',
  applicationName: 'Jarrão Espetaria',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0b0b0b',
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body className={`${titulo.variable} ${corpo.variable}`}>
        <SessaoProvider>
          <Cabecalho />
          <main>
            <Guarda>{children}</Guarda>
          </main>
        </SessaoProvider>
      </body>
    </html>
  );
}
