import type { Metadata } from 'next';
import '../styles/globals.css';

export const metadata: Metadata = {
  title: 'Kerala Compliance AI — Business Regulation Assistant',
  description:
    'AI-powered assistant for Kerala business licenses, permits, and regulatory compliance. Get accurate answers backed by official government documents.',
  keywords: 'Kerala business license, trade license Kerala, FSSAI Kerala, Factory license Kerala, MSME registration Kerala',
  openGraph: {
    title: 'Kerala Compliance AI',
    description: 'AI assistant for Kerala business regulations and compliance',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body>{children}</body>
    </html>
  );
}
