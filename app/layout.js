import './globals.css';

export const metadata = { title: 'Jarrão Espetaria' };

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>
        <main>{children}</main>
      </body>
    </html>
  );
}
