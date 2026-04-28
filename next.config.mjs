/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",

  // Timezone is set via TZ env variable in Docker
  // No special Next.js config needed — Node.js respects TZ env

  images: {
    // Local photos served via /api/photos/* — no remote patterns needed
    // External MGNREGA URLs kept as fallback for any legacy data
    remotePatterns: [
      {
        protocol: "https",
        hostname: "mnregaweb4.nic.in",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
