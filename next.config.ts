import type { NextConfig } from "next";
const config: NextConfig = {
  reactStrictMode: true,
  typescript: { ignoreBuildErrors: false },
  serverExternalPackages: ["pdf-parse"],
};
export default config;
