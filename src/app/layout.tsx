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
  title: "CALTEX MD - WhatsApp Bot Dashboard",
  description:
    "CALTEX MD is a powerful, production-ready WhatsApp Multi-Device bot with AI features, plugin system, web dashboard, and REST API.",
  keywords: [
    "CALTEX MD",
    "WhatsApp Bot",
    "Multi-Device",
    "AI Chatbot",
    "Dashboard",
    "Baileys",
    "TypeScript",
  ],
  authors: [{ name: "CALTEX MD Team" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
  openGraph: {
    title: "CALTEX MD - WhatsApp Bot Dashboard",
    description: "Powerful WhatsApp Multi-Device bot with AI and dashboard",
    type: "website",
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
