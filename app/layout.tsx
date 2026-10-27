import type { Metadata } from "next";
import { Caveat, Instrument_Serif, Inter, Inter_Tight, JetBrains_Mono } from "next/font/google";
import { AmbientBackground } from "@/components/ambient-background";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
});
const interTight = Inter_Tight({
  variable: "--font-inter-tight",
  subsets: ["latin"],
  display: "swap",
});
const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  weight: "400",
  style: ["italic"],
  subsets: ["latin"],
  display: "swap",
});
const caveat = Caveat({ variable: "--font-caveat", subsets: ["latin"], display: "swap" });
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

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
    <html
      lang="en"
      className={`dark ${inter.variable} ${interTight.variable} ${instrumentSerif.variable} ${caveat.variable} ${jetbrainsMono.variable}`}
    >
      <body className="min-h-screen antialiased">
        <AmbientBackground />
        <div className="relative z-10">{children}</div>
      </body>
    </html>
  );
}
