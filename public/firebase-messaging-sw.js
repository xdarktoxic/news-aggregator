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
  var data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) {}

  var title = (data.notification && data.notification.title) || 'Pulse';
  var body  = (data.notification && data.notification.body)  || '';
  var url   = (data.fcmOptions && data.fcmOptions.link)
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

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
      // If Pulse is already open, tell it to navigate via postMessage
      // and bring it to front. This is the reliable path on Safari.
      if (list.length > 0) {
        var c = list[0];
        c.postMessage({ type: 'NOTIF_CLICK', url: url });
        return c.focus();
      }
      // No open window — open one. Safari may open the origin root
      // instead of the exact URL; the app will handle the redirect.
      return clients.openWindow(url);
    })
  );
});
