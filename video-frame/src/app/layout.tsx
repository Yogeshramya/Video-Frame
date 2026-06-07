import type { Metadata } from 'next';
import { Cinzel, Inter } from 'next/font/google';
import './globals.css';

const cinzel = Cinzel({
  variable: '--font-cinzel',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
});

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: 'YR Digital Memories | Premium AR Photo Frames',
  description: 'Experience your printed photo frames coming to life. Scan your physical wedding and memory photo frames to watch your videos play instantly in augmented reality.',
  keywords: ['AR photo frame', 'augmented reality wedding', 'digital memories', 'video photo frame', 'wedding video scanner'],
  authors: [{ name: 'YR Digital Memories' }],
  openGraph: {
    title: 'YR Digital Memories | Premium AR Photo Frames',
    description: 'Scan your physical wedding and memory photo frames to watch your videos play instantly in augmented reality.',
    type: 'website',
    locale: 'en_US',
    siteName: 'YR Digital Memories',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'YR Digital Memories | Premium AR Photo Frames',
    description: 'Scan your physical wedding and memory photo frames to watch your videos play instantly in augmented reality.',
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${cinzel.variable} ${inter.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col bg-[#0a0a0a] text-white">
        {children}
      </body>
    </html>
  );
}
