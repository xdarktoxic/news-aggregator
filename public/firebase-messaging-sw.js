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
  var payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch (e) {}

  var d     = payload.data || {};
  var title = d.title || 'Pulse';
  var body  = d.body  || '';
  var url   = (payload.fcmOptions && payload.fcmOptions.link)
            || d.url
            || 'https://news-aggregator-taupe-rho.vercel.app';

  event.waitUntil(
    self.registration.showNotification(title, {
      body: body,
      icon: '/icon.svg',
      data: { url: url },
    })
  );
});

// DIAGNOSTIC: shows a second notification on click to confirm the event fires.
// If you see "Click received!" appear after tapping, notificationclick works.
self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  var url = (event.notification.data && event.notification.data.url)
          || 'https://news-aggregator-taupe-rho.vercel.app';

  event.waitUntil(
    self.registration.showNotification('✅ Click received!', {
      body: 'notificationclick fired — url: ' + url,
      data: {},
    }).then(function () {
      return clients.matchAll({ type: 'window', includeUncontrolled: true });
    }).then(function (list) {
      if (list.length > 0) {
        list[0].postMessage({ type: 'NOTIF_CLICK', url: url });
        return list[0].focus();
      }
      return clients.openWindow(url);
    })
  );
});
