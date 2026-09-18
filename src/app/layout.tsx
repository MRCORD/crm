import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import './globals.css';
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";
import { TooltipProvider } from '@/components/ui/tooltip';

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
  title: {
    default: "Agentic CRM",
    template: "%s · Agentic CRM",
  },
  description:
    "Self-hosted, MCP-native CRM on PostgreSQL — Next.js 16 web app + 66 Model Context Protocol tools for AI agents.",
  keywords: [
    "CRM",
    "MCP",
    "Model Context Protocol",
    "AI agents",
    "Next.js",
    "PostgreSQL",
    "Cloudflare Workers",
    "open source",
  ],
  openGraph: {
    title: "Agentic CRM",
    description: "Self-hosted, MCP-native CRM on PostgreSQL",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Agentic CRM",
    description: "Self-hosted, MCP-native CRM on PostgreSQL",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en" className={cn("font-sans", geist.variable)}>
        <body>
          <TooltipProvider>{children}</TooltipProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
