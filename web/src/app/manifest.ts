import type { MetadataRoute } from 'next';

// Lets phones and tablets add Featherbound to the home screen as an app, with Tuft as the icon.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Featherbound',
    short_name: 'Featherbound',
    description: 'Your private family library, where every book is a little softer.',
    start_url: '/',
    display: 'standalone',
    background_color: '#FBF4E4',
    theme_color: '#FBF4E4',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
