import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack(config) {
    // Suppress "Module not found" warnings for optional wagmi connector peer deps
    // (porto, coinbase wallet, metamask, safe, walletconnect) — we only use Phantom
    config.resolve.fallback = {
      ...config.resolve.fallback,
      'porto/internal': false,
      porto: false,
      '@coinbase/wallet-sdk': false,
      '@metamask/connect-evm': false,
      '@safe-global/safe-apps-sdk': false,
      '@safe-global/safe-apps-provider': false,
      '@walletconnect/ethereum-provider': false,
      '@base-org/account': false,
    }
    return config
  },
};

export default nextConfig;
