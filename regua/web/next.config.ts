import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // geoip-lite lê seu .dat pelo __dirname do próprio pacote em runtime;
  // deixado para o bundler, o Turbopack reescreve o caminho e o arquivo some
  // ("/ROOT/node_modules/..." em vez do caminho real). Fora do bundle, o
  // require nativo do Node resolve certo.
  serverExternalPackages: ['geoip-lite'],
};

export default nextConfig;
