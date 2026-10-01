/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      // Node.js Risk Engine API (port 4000)
      {
        source:      '/api/v1/:path*',
        destination: 'http://localhost:4000/api/v1/:path*',
      },
      // Python AI Microservice (port 5000) — direct access for raw ML endpoints
      {
        source:      '/api/ai/:path*',
        destination: 'http://localhost:5000/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
