/** @type {import('next').NextConfig} */

const devOrigins = [];
if (process.env.REPLIT_DEV_DOMAIN) {
  devOrigins.push(process.env.REPLIT_DEV_DOMAIN);
}
if (process.env.REPL_SLUG && process.env.REPL_OWNER) {
  devOrigins.push(`${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`);
}

const nextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: devOrigins,
  async rewrites() {
    return [
      {
        source: "/backend/:path*",
        destination: "http://localhost:8000/:path*",
      },
    ];
  },
};

module.exports = nextConfig;
