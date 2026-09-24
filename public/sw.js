// Service Worker Pasif - DOI TA POS
// Dibuat untuk memenuhi kualifikasi PWA Installable & TWA tanpa merusak dynamic SSR / API routes

const CACHE_NAME = 'doita-pos-v1';

self.addEventListener('install', (event) => {
  // Langsung aktifkan SW tanpa menunggu tab lama ditutup
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Ambil kendali klien secara instan
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Pasif fetch handler untuk kepatuhan kriteria PWA installability browser
  // Membiarkan network request berjalan natural (tidak mencache API/SSR dinamis secara agresif)
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    fetch(event.request).catch(() => {
      // Fallback opsional jika network offline
      return caches.match(event.request);
    })
  );
});
