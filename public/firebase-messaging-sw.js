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

// Force this SW to activate immediately instead of waiting for old tabs to close.
self.addEventListener('install', (event) => {
  self.skipWaiting();
});
self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

// FCM stores the push payload under event.notification.data.FCM_MSG.
// We pull the absolute click URL from fcmOptions.link (set by push.ts via
// APP_URL), falling back to the relative path in data.url.
self.addEventListener('notificationclick', function (event) {
  event.notification.close();

  const fcmMsg = (event.notification.data || {}).FCM_MSG || {};
  // Prefer the absolute URL so clients.openWindow always works cross-browser.
  const url =
    fcmMsg.fcmOptions?.link ||
    fcmMsg.data?.url ||
    event.notification.data?.url ||
    '/';

  event.waitUntil(clients.openWindow(url));
});
