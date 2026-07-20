import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(__dirname),
  },
  // Dependências nativas/pesadas só de servidor (extração de PDF e OCR): não devem ser
  // empacotadas pelo bundler — o binário .node do @napi-rs/canvas não é "placeable" em
  // chunks ESM. Ficam como require() em runtime no Node.
  serverExternalPackages: ["pdfjs-dist", "tesseract.js", "@napi-rs/canvas"],
};

export default nextConfig;
