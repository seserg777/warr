importScripts("https://www.gstatic.com/firebasejs/4.1.2/firebase-app.js");
importScripts("https://www.gstatic.com/firebasejs/4.1.2/firebase-messaging.js");
var config = {
    apiKey:            "AIzaSyDbZQtDXaZKDCFa0BIMxAoqbaqhnMDhWbQ",
    authDomain:        "play4play-fbe85.firebaseapp.com",
    databaseURL:       "https://play4play-fbe85.firebaseio.com",
    storageBucket:     "play4play-fbe85.appspot.com",
    messagingSenderId: "579459198113"
};

firebase.initializeApp(config);

var messaging = firebase.messaging();

messaging.setBackgroundMessageHandler(function(payload) {
    console.log('[worker] Received push notification: ', payload);
    payload.icon = '/images/icons/android-icon-96x96.png';
    return self.registration.showNotification(payload.title, payload);
});

