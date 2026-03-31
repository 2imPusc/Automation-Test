import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { cn } from "@/lib/utils";
import { Sidebar } from "@/components/sidebar";
import { PipelineProvider } from "@/context/PipelineContext";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Shopify Autotest",
  description: "Playwright automation test runner for Shopify apps",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={cn("font-sans", inter.variable)}>
      <body className="flex min-h-screen">
        <PipelineProvider>
          <Sidebar />
          <main className="flex-1 p-6 ml-64">{children}</main>
        </PipelineProvider>
      </body>
    </html>
  );
}
