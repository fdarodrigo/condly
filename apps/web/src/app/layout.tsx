import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans, Space_Grotesk } from 'next/font/google';
import './globals.css';
import { cn } from '@/lib/utils';
import { RegisterServiceWorker } from '@/components/register-service-worker';

// Tipografia do design importado ("Condly App.dc.html"): Plus Jakarta
// Sans pro corpo, Space Grotesk pra títulos/números — self-hosted via
// next/font (sem chamada de rede em runtime, importante pro PWA offline).
const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  weight: ['400', '500', '600', '700'],
});
const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['500', '600', '700'],
});

export const metadata: Metadata = {
  title: 'Condly',
  description: 'Gestão condominial multi-tenant',
  manifest: '/manifest.json',
  icons: {
    icon: '/icons/icon.svg',
    apple: '/icons/icon.svg',
  },
};

export const viewport: Viewport = {
  themeColor: '#0b0d11',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={cn('font-sans', plusJakartaSans.variable, spaceGrotesk.variable)}>
      <body className="antialiased">
        {children}
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
