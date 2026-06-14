import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next" // force layout rebuild
import { Inter } from "next/font/google";
import "./globals.css";
import "@/lib/env";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { ToastProvider } from "@/components/ui/toast-provider";
import { ThemeProvider } from "@/components/providers/ThemeProvider";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "StudyBuddy AI — Your Personalised Study Companion",
  description:
    "Get a personalised, day-by-day study plan in 2 minutes. AI-powered daily check-ins, streak tracking, and auto-generated quizzes to keep you on track.",
  keywords: ["study planner", "AI study companion", "exam preparation", "personalised learning"],
  openGraph: {
    title: "StudyBuddy AI",
    description: "Your personalised AI study companion",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-background font-sans antialiased">
        <ThemeProvider>
          <AuthProvider>
            <ToastProvider>
              {children}
            </ToastProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
