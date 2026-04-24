// We don't call firebase.messaging() here — instead we handle the push event
// ourselves so the notification data structure is simple and predictable.
// The browser-side Firebase SDK still handles token registration fine without it.

importScripts('https://www.gstatic.com/firebasejs/12.12.1/firebase-app-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyCf5z-609zAvT8z3zQaVWeyDvZgwTjLnIw',
  authDomain: 'pulse-45675.firebaseapp.com',
  projectId: 'pulse-45675',
  storageBucket: 'pulse-45675.firebasestorage.app',
  messagingSenderId: '1098195570668',
  appId: '1:1098195570668:web:85c2a0df27005816df7ac9',
});

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(clients.claim()));

self.addEventListener('push', function (event) {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) {}

  const title = (data.notification && data.notification.title) || 'Pulse';
  const body  = (data.notification && data.notification.body)  || '';
  // fcmOptions.link is the absolute URL we set in push.ts via APP_URL
  const url   = (data.fcmOptions && data.fcmOptions.link)
              || (data.data && data.data.url)
              || 'https://news-aggregator-taupe-rho.vercel.app';

  event.waitUntil(
    self.registration.showNotification(title, {
      body: body,
      icon: '/icon.svg',
      data: { url: url },
    })
  );
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  var url = (event.notification.data && event.notification.data.url)
          || 'https://news-aggregator-taupe-rho.vercel.app';
  event.waitUntil(clients.openWindow(url));
});
