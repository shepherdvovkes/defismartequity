/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  env: {
    NEXT_PUBLIC_NETWORK: 'sepolia',
    NEXT_PUBLIC_CHAIN_ID: '11155111',
  },
}

module.exports = nextConfig
