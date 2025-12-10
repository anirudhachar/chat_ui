import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)", // apply to all routes
        headers: [
          {
            key: "X-Frame-Options",
            value: "ALLOWALL", // allow iframe embedding
          },
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors *", // allow any domain to embed
          },
        ],
      },
    ];
  },
};

export default nextConfig;
