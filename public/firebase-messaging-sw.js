importScripts('https://www.gstatic.com/firebasejs/12.12.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.12.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyCf5z-609zAvT8z3zQaVWeyDvZgwTjLnIw',
  authDomain: 'pulse-45675.firebaseapp.com',
  projectId: 'pulse-45675',
  storageBucket: 'pulse-45675.firebasestorage.app',
  messagingSenderId: '1098195570668',
  appId: '1:1098195570668:web:85c2a0df27005816df7ac9',
});

firebase.messaging();

// FCM shows the notification but does not open anything on tap without this.
// When a background message arrives, FCM stores the payload in
// event.notification.data.FCM_MSG. We pull the URL from there (data.url) or
// fall back to fcmOptions.link, then navigate the app to that path.
self.addEventListener('notificationclick', function (event) {
  event.notification.close();

  const fcmMsg = (event.notification.data || {}).FCM_MSG || {};
  const url =
    fcmMsg.data?.url ||
    fcmMsg.fcmOptions?.link ||
    event.notification.data?.url ||
    '/';

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(function (windowClients) {
        // If Pulse is already open, navigate that tab and bring it to front.
        for (const client of windowClients) {
          if ('navigate' in client) {
            return client.navigate(url).then((c) => c && c.focus());
          }
        }
        // Otherwise open a new tab.
        return clients.openWindow(url);
      })
  );
});
