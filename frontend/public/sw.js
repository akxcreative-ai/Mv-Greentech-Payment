/**
 * Service Worker: MV Payment Approval System
 * Version: 1.0.0
 * 
 * Features:
 * - App shell caching for offline reliability
 * - Strict financial security: NO caching for approvals, payments, transactions, and auth APIs
 * - Network-first for navigation with offline.html fallback
 * - Cache version management, automatic cleanup
 * - skipWaiting and clients.claim for seamless updates
 */

const CACHE_VERSION = 'v2.0.3';
const STATIC_CACHE_NAME = `mv-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE_NAME = `mv-dynamic-${CACHE_VERSION}`;

// Pre-cached application shell assets
const APP_SHELL_ASSETS = [
  '/',
  '/offline.html',
  '/manifest.json',
  '/logo.png',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/icon-192.svg',
  '/icons/icon-512.svg',
];

// Sensitive endpoints that MUST NEVER be stored in any browser cache
const NEVER_CACHE_PATTERNS = [
  /\/api\/v1\/approvals/i,
  /\/api\/v1\/payments/i,
  /\/api\/v1\/transactions/i,
  /\/api\/v1\/vouchers/i,
  /\/api\/v1\/auth/i,
  /\/api\/v1\/users/i,
  /\/api\/v1\/audit/i,
  /\/api\/v1\/documents/i,
  /\/ws\//i,
];

/**
 * Install Event: Cache app shell and immediately take over
 */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME)
      .then((cache) => {
        return cache.addAll(APP_SHELL_ASSETS);
      })
      .then(() => {
        // Force the waiting service worker to become the active service worker
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[ServiceWorker] Pre-cache failed:', error);
      })
  );
});

/**
 * Activate Event: Clean up outdated caches and claim existing clients
 */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== STATIC_CACHE_NAME && cacheName !== DYNAMIC_CACHE_NAME) {
            console.info('[ServiceWorker] Purging stale cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // Immediately control all active tabs and clients
      return self.clients.claim();
    })
  );
});

/**
 * Helper: Determine if a request URL matches sensitive financial paths
 */
function isSensitiveFinancialEndpoint(url) {
  return NEVER_CACHE_PATTERNS.some((pattern) => pattern.test(url.pathname));
}

/**
 * Helper: Determine if request is an API call
 */
function isApiRequest(url) {
  return url.pathname.startsWith('/api/');
}

/**
 * Fetch Event Handler
 */
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // 1. Non-GET requests (POST, PUT, DELETE, PATCH): Never touch cache, straight to network
  if (request.method !== 'GET') {
    event.respondWith(
      fetch(request).catch((error) => {
        if (isApiRequest(url)) {
          return new Response(
            JSON.stringify({
              error: 'NetworkUnavailable',
              message: 'Financial transactions and write operations require an active network connection.',
              status: 503,
            }),
            {
              status: 503,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        }
        throw error;
      })
    );
    return;
  }

  // 2. Navigation requests: Network-first with offline.html fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // If network returns a valid page, update the static cache copy
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(STATIC_CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(async () => {
          // Offline fallback: serve offline.html
          const cache = await caches.open(STATIC_CACHE_NAME);
          const cachedOffline = await cache.match('/offline.html');
          return cachedOffline || cache.match('/index.html');
        })
    );
    return;
  }

  // 3. Financial & Approval API Calls: DO NOT CACHE
  // Always go to network; if offline, return structured error
  if (isSensitiveFinancialEndpoint(url)) {
    event.respondWith(
      fetch(request).catch(() => {
        return new Response(
          JSON.stringify({
            error: 'OfflineFinancialOperationBlocked',
            message: 'Approval and payment data cannot be served from offline cache to maintain financial integrity.',
            status: 503,
          }),
          {
            status: 503,
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'no-store, no-cache, must-revalidate',
            },
          }
        );
      })
    );
    return;
  }

  // 4. Other non-sensitive API calls: Network-first
  if (isApiRequest(url)) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          return networkResponse;
        })
        .catch(() => {
          return new Response(
            JSON.stringify({
              error: 'Offline',
              message: 'You are currently offline. Please reconnect to access live data.',
              status: 503,
            }),
            {
              status: 503,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        })
    );
    return;
  }

  // 5. Static Assets (CSS, JS, Fonts, Images): Cache-first with network fallback
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        // Return cached asset and update cache in background (Stale-While-Revalidate)
        fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(DYNAMIC_CACHE_NAME).then((cache) => {
                cache.put(request, networkResponse);
              });
            }
          })
          .catch(() => {
            // Background fetch failed, client still got cached asset
          });
        return cachedResponse;
      }

      // If not in cache, fetch from network and store in dynamic cache
      return fetch(request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }

        const responseToCache = networkResponse.clone();
        caches.open(DYNAMIC_CACHE_NAME).then((cache) => {
          cache.put(request, responseToCache);
        });

        return networkResponse;
      });
    })
  );
});

/**
 * Handle Push Notifications (e.g. Payment Approval Pending)
 */
self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const title = data.title || 'MV Payment Approval Alert';
    const options = {
      body: data.body || 'A payment request requires your review.',
      icon: '/icons/icon-192.svg',
      badge: '/icons/icon-192.svg',
      data: {
        url: data.url || '/approvals',
      },
      tag: data.tag || 'payment-approval',
      renotify: true,
      vibrate: [100, 50, 100],
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch (err) {
    console.error('[ServiceWorker] Push notification error:', err);
  }
});

/**
 * Handle Notification Click
 */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
