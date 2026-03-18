import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  async redirects() {
    return [
      {
        source: "/",
        destination: "/connexion",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
