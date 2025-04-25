import type {Metadata} from 'next';
import { Inter } from 'next/font/google'; // Import Inter font
import './globals.css';
import { Toaster } from "@/components/ui/toaster"; // Import Toaster

// Configure Inter font
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter', // Optional: if you want to use it as a CSS variable
});

export const metadata: Metadata = {
  title: 'AgriWaste AI', // Updated App Name
  description: 'Detect and classify agricultural waste using AI.', // Updated description
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} antialiased`}> {/* Use Inter font class */}
        <main className="min-h-screen container mx-auto p-4 md:p-8">
          {children}
        </main>
        <Toaster /> {/* Add Toaster for notifications */}
      </body>
    </html>
  );
}
