import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Flezi | Sign in',
  description: 'Create an account or sign in to your Flezi workspace.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
