import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // web-tree-sitter loads its WASM at runtime; keep it unbundled and ship the grammars.
  serverExternalPackages: ["web-tree-sitter"],
  outputFileTracingIncludes: {
    "/api/**": [
      "./node_modules/web-tree-sitter/web-tree-sitter.wasm",
      "./node_modules/tree-sitter-typescript/*.wasm",
      "./node_modules/tree-sitter-javascript/*.wasm",
      "./node_modules/tree-sitter-python/*.wasm",
    ],
  },
};

export default nextConfig;
