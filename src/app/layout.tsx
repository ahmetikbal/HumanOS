import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

export const metadata: Metadata = {
  title: "Human OS — The Biological Operating System",
  description:
    "Manage your life with the precision of a computer operating system. EDF-based task scheduling to minimize decision fatigue.",
  keywords: ["productivity", "scheduler", "EDF", "task management", "human os"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans antialiased`}>
        <AuthProvider>
          <div className="min-h-screen bg-background">{children}</div>
        </AuthProvider>
      </body>
    </html>
  );
}
