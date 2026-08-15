import type { Metadata, Viewport } from "next";
import "./globals.css";
import Providers from "./components/Providers";

export const metadata: Metadata = {
  title: {
    default: "BCWin",
    template: "%s | BCWin",
  },
  description: "Play and Win",
  robots: "noindex,nofollow",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "BCWin",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "32x32" },
      { url: "/assets/png/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/assets/png/favicon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/assets/png/favicon-bc.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/assets/png/favicon-192.png", sizes: "192x192", type: "image/png" }],
    shortcut: ["/assets/png/favicon-32.png"],
  },
};

/**
 * Mobile-native shell: lock zoom (no pinch / double-tap scale).
 * Matches production casino SPAs / PWA standalone feel.
 * Admin can still use browser zoom on desktop (meta is soft-ignored there).
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#110D14",
};

/** Mobile-native shell: full-bleed dark app. Admin routes override their own bg. */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className="min-h-full antialiased"
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full font-sans bg-[#110D14] text-[#FDE4BC]">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
