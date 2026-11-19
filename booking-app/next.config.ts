import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Logo uploads go through a server action (max 2 MB file + form overhead).
    serverActions: { bodySizeLimit: "3mb" },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
