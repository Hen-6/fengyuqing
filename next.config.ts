import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  // basePath removed for local development
  images: {
    unoptimized: true,
  },
  // Force webpack to transpile @jobinjia/shuimo-core (skip SWC, faster)
  transpilePackages: ["@jobinjia/shuimo-core"],
  turbopack: {},
  webpack: (config, { dev, isServer }) => {
    if (!dev && !isServer) {
      config.optimization = {
        ...config.optimization,
        minimize: false,
      };
    }
    return config;
  },
};

export default nextConfig;
