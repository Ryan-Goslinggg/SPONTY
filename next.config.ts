import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Lets a second account run side by side at http://127.0.0.1:3000 (cookies are per host). Dev only.
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
