import type { NextConfig } from "next";

// Empty string from `ENV BACKEND_URL=$BACKEND_URL` (unset ARG) is not nullish.
// In Docker, rewrite must hit the compose service (`http://api:3000`), not
// https://api.bcwin.club — that hairpins through Cloudflare and Next returns 500.
const backendUrl =
  process.env.BACKEND_URL?.trim() || "http://localhost:3000";

/**
 * Production-ready Next config
 * - `output: "standalone"` kept for Docker / prod deploys
 * - API rewrites, security headers, image formats, icon tree-shaking
 * - Optional Cloudflare Images / CDN via NEXT_PUBLIC_IMAGE_CDN + remotePatterns
 */
const cfImageHost = process.env.NEXT_PUBLIC_CF_IMAGES_HOST; // e.g. imagedelivery.net or custom
const cdnHost = process.env.NEXT_PUBLIC_CDN_HOST; // e.g. assets.bcwin.example.com
// ImageKit: full endpoint or just enable default host
// e.g. NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT=https://ik.imagekit.io/your_id
const imageKitEndpoint = process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT;

const remotePatterns: NonNullable<NextConfig["images"]>["remotePatterns"] = [];

// Always allow ImageKit delivery host (safe even before env is set)
remotePatterns.push({
  protocol: "https",
  hostname: "ik.imagekit.io",
  pathname: "/**",
});

// Inout third-party game icons
remotePatterns.push({
  protocol: "https",
  hostname: "icons.inout.games",
  pathname: "/**",
});

if (imageKitEndpoint) {
  try {
    const u = new URL(imageKitEndpoint);
    if (u.hostname && u.hostname !== "ik.imagekit.io") {
      remotePatterns.push({
        protocol: u.protocol.replace(":", "") as "http" | "https",
        hostname: u.hostname,
        pathname: "/**",
      });
    }
  } catch {
    /* ignore invalid endpoint at build */
  }
}

if (cfImageHost) {
  remotePatterns.push({
    protocol: "https",
    hostname: cfImageHost,
    pathname: "/**",
  });
}
if (cdnHost) {
  remotePatterns.push({
    protocol: "https",
    hostname: cdnHost,
    pathname: "/**",
  });
}

const nextConfig: NextConfig = {
  // ── Production deploy (keep) ─────────────────────────────────────────────
  output: "standalone",
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,

  images: {
    formats: ["image/avif", "image/webp"],
    qualities: [75, 90, 92, 95],
    dangerouslyAllowSVG: false,
    // Local /public always works; ImageKit + optional CF/custom CDN
    remotePatterns,
  },

  experimental: {
    optimizePackageImports: [
      "react-icons",
      "react-icons/io5",
      "react-icons/hi2",
      "recharts",
      "gsap",
    ],
  },

  // Pixi is client-only (dynamic import in Moto race canvas)
  serverExternalPackages: ["pixi.js"],

  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${backendUrl.replace(/\/$/, "")}/api/v1/:path*`,
      },
    ];
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
          { key: "X-DNS-Prefetch-Control", value: "on" },
        ],
      },
      {
        source: "/assets/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/gamecategory/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
