import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'Backlink Graph — AEO Toolkit',
  description:
    'Enter one URL and explore its backlink universe as an interactive 3D force-directed graph of the sites linking to and referencing it.',
};

export default function RootLayout({ children }: { children: ReactNode }): ReactNode {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
