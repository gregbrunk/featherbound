import type { NextConfig } from 'next';
import { withWorkflow } from 'workflow/next';

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // pdf.js loads its worker and fonts from its own package files at runtime.
  serverExternalPackages: ['pdfjs-dist'],
};

export default withWorkflow(nextConfig);
