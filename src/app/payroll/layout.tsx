import type { Metadata, Viewport } from 'next';
import { Inter, Source_Serif_4 } from 'next/font/google';
import './payroll.css';

const sans = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });
const serif = Source_Serif_4({ subsets: ['latin'], variable: '--font-serif', display: 'swap', axes: ['opsz'] });

const description = 'Upload a salary statement and get pay slips and a full income-tax computation, slab by slab, with rebate, surcharge, cess and TDS. Files are read in your browser.';

export const metadata: Metadata = {
  title: 'Salary & Tax Desk — pay slips and income tax from your salary statement',
  description,
  openGraph: {
    title: 'Salary & Tax Desk',
    description,
    url: 'https://income-tax.amaanabbasi.me/payroll',
    siteName: 'Income Tax Slab Calculator',
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F7F8FA' },
    { media: '(prefers-color-scheme: dark)', color: '#0B1120' },
  ],
};

// Runs before paint so a saved light/dark choice applies without a flash.
const themeScript = `(function(){try{var t=localStorage.getItem('desk-theme');if(t)document.documentElement.setAttribute('data-desk-theme',t)}catch(e){}})()`;

export default function PayrollLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${sans.variable} ${serif.variable} tax-desk min-h-[100svh] bg-bg font-body text-ink antialiased`}>
      <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      {children}
    </div>
  );
}
