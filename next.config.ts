import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  basePath: "/fengyuqing",
  images: {
    unoptimized: true,
  },
  transpilePackages: ["@jobinjia/shuimo-core"],
  webpack: (config, { dev, isServer }) => {
    if (!dev && !isServer) {
      config.optimization = {
        ...config.optimization,
        minimize: false,
        splitChunks: {
          ...config.optimization.splitChunks,
          chunks: "all",
          cacheGroups: {
            poemsData: {
              test: /[\\/]src[\\/]lib[\\/]poemsData\.ts$/,
              name: "poems-data",
              chunks: "all",
              priority: 10,
            },
          },
        },
      };
    }
    return config;
  },
};

export default nextConfig;
