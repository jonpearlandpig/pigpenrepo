import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["pdf-parse", "mammoth"],
  },
  // Allow large document uploads (50MB max)
  api: {
    bodyParser: {
      sizeLimit: "50mb",
    },
    responseLimit: "50mb",
  },
};

export default nextConfig;
