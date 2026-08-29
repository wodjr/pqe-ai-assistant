import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disable the built-in image optimizer (we don't use next/image with remote sources)
  // This avoids the sharp/libvips vulnerabilities at runtime.
  images: {
    unoptimized: true,
  },
  // exceljs is imported in a "use client" component so it must be bundled for the browser.
  // Do NOT add it to serverExternalPackages.
};

export default nextConfig;
