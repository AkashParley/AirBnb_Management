import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { Footer } from '@/components/layout/Footer';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });

export const metadata: Metadata = { title: 'Keeystay', description: 'Property operations' };
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover' };

/** Applies the saved theme before paint, so there is no light-then-dark flash. */
const NO_FLASH = `
  try {
    var t = localStorage.getItem('keeystay-theme');
    if (t === 'dark' || (!t && matchMedia('(prefers-color-scheme: dark)').matches))
      document.documentElement.classList.add('dark');
  } catch (_) {}
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" className={inter.variable} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: NO_FLASH }} /></head>
      <body>
        {children}
        <Footer />
      </body>
    </html>
  );
}
