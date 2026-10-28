import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Build enxuto para a imagem Docker (node server.js)
  output: "standalone",
  cacheComponents: true,
  partialPrefetching: true,
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
