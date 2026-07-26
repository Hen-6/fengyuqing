import type { NextConfig } from "next";

console.log("--- VERCEL BUILD ENV DIAGNOSTICS ---");
console.log("NEXT_PUBLIC_SUPABASE_URL:", process.env.NEXT_PUBLIC_SUPABASE_URL ? "SET (length: " + process.env.NEXT_PUBLIC_SUPABASE_URL.length + ")" : "NOT SET");
console.log("NEXT_PUBLIC_SUPABASE_ANON_KEY:", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "SET (length: " + process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.length + ")" : "NOT SET");
console.log("-------------------------------------");

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
  webpack: (config, { dev, isServer, webpack }) => {
    if (!dev && !isServer) {
      config.optimization = {
        ...config.optimization,
        minimize: false,
      };
    }
    // Fix for @jobinjia/shuimo-core dynamic wasm imports in nextjs
    config.plugins.push(
      new webpack.IgnorePlugin({
        resourceRegExp: /wasm\/shuimo_noise\.js/,
      })
    );
    // Suppress Webpack's "Critical dependency: the request of a dependency is an expression" error
    config.module.exprContextCritical = false;

    return config;
  },
};

export default nextConfig;
