import type { NextConfig } from "next";

// Entirely client-side: static export, no API routes or server actions.
const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
};

export default nextConfig;
