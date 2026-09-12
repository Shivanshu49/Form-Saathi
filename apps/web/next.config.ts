import type { NextConfig } from 'next';

const config: NextConfig = {
  // The shared workspaces are plain ESM with declaration files; no transpile needed.
  reactStrictMode: true,
  poweredByHeader: false,
};

export default config;
