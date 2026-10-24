/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable SWC and use TSC directly
  transpilePackages: ['next'],
  typescript: {
    ignoreBuildErrors: true,
  },
  webpack(config, { dev, isServer }) {
    // Force Node.js module resolution
    config.resolve.extensions = ['.js', '.json', '.ts'];
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': require('path').resolve(__dirname),
    };
    return config;
  },
  // Explicitly disable SWC minification
  swcMinify: false,
  // Experimental settings
  experimental: {
    appDir: false,
  },
};

// Add module aliases support
module.exports = nextConfig;