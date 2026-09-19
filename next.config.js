/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: { unoptimized: true },
  // Workaround: Next 13.5's SWC minifier drops escaped backticks inside
  // template literals (e.g. @radix-ui/react-progress), producing
  // "SyntaxError: missing ) after argument list" during page-data collection.
  swcMinify: false,
};

module.exports = nextConfig;
