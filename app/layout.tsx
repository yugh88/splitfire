import type { Metadata } from "next";
import { Geist, Geist_Mono, Silkscreen } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const pixel = Silkscreen({ variable: "--font-pixel", weight: ["400", "700"], subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Splitfire",
  description: "Split the work. Not the codebase.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${geistSans.variable} ${geistMono.variable} ${pixel.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
