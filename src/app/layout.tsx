import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppProvider } from "@/components/AppProvider";
import { Nav } from "@/components/Nav";
import { SwRegister } from "@/components/SwRegister";

export const metadata: Metadata = {
  title: "OA Trainer",
  description: "Personal trainer for the Optiver trading online assessment",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "OA Trainer", statusBarStyle: "black-translucent" },
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0e1116",
};

// Applies the saved theme before first paint (dark by default).
const themeScript = `try{var t=localStorage.getItem('oa-theme')||'dark';var d=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light'}catch(e){document.documentElement.dataset.theme='dark'}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh antialiased">
        <AppProvider>
          <Nav />
          <main className="mx-auto w-full max-w-3xl px-3 pb-24 pt-3 sm:px-4">{children}</main>
          <SwRegister />
        </AppProvider>
      </body>
    </html>
  );
}
