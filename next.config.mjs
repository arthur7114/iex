/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  experimental: {
    // enviarProposta recebe o PDF/Word em base64 como argumento da Server Action;
    // o padrão do Next (1 MB) recusaria o anexo.
    serverActions: { bodySizeLimit: "10mb" },
  },
}

export default nextConfig
