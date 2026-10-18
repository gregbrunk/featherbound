import type { NextConfig } from 'next';
import { withWorkflow } from 'workflow/next';

// Headless Chrome for PDF export ships its binary as files the bundler can't see, so it stays
// external and its files are traced into just the two export routes.
const CHROMIUM = ['./node_modules/@sparticuz/chromium/bin/**'];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // pdf.js loads its worker and fonts from its own package files at runtime.
  serverExternalPackages: ['pdfjs-dist', '@sparticuz/chromium', 'puppeteer-core', 'sharp'],
  outputFileTracingIncludes: {
    '/api/editions/\\[id\\]/export': CHROMIUM,
    '/api/books/\\[id\\]/export': CHROMIUM,
  },
};

export default withWorkflow(nextConfig);
