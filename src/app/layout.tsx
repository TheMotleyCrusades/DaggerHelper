import type { Metadata } from "next";
import { Cinzel, Source_Sans_3 } from "next/font/google";
import { ToastProvider } from "@/components/ui/toast-provider";
import { AuthProvider } from "@/components/auth/auth-provider";
import { GlobalTopNav } from "@/components/layout/global-top-nav";
import "./globals.css";

const headingFont = Cinzel({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["600", "700"],
});

const bodyFont = Source_Sans_3({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Daggerheart Helper",
  description: "Build, manage, and share Daggerheart adversaries and campaigns.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${headingFont.variable} ${bodyFont.variable} antialiased`}>
        <AuthProvider>
          <ToastProvider>
            <GlobalTopNav />
            {children}
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
