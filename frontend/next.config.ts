import type { NextConfig } from "next";

const isGitHubPages = process.env.GITHUB_PAGES === "true";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: isGitHubPages ? "export" : undefined,
  trailingSlash: true,
  images: {
    unoptimized: true
  },
  basePath: isGitHubPages ? "/solormt" : undefined,
  assetPrefix: isGitHubPages ? "/solormt/" : undefined,
};

export default nextConfig;
