import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CALTEX MD - WhatsApp Bot Session Generator",
  description:
    "CALTEX MD — The most powerful WhatsApp Bot Session Generator. Generate secure Pairing Codes and QR Sessions instantly.",
  keywords: [
    "CALTEX MD",
    "WhatsApp Bot",
    "Multi-Device",
    "AI Chatbot",
    "Session Generator",
    "Pairing Code",
    "QR Code",
    "Baileys",
    "TypeScript",
  ],
  authors: [{ name: "CALTEX MD" }],
  icons: {
    icon: "/caltex-profile.png",
    apple: "/caltex-profile.png",
  },
  openGraph: {
    title: "CALTEX MD - WhatsApp Bot Session Generator",
    description: "Generate secure Pairing Codes and QR Sessions instantly",
    type: "website",
    images: ["/caltex-profile.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
