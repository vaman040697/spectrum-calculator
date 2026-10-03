/* Check for a newer app shell only if the user previously enabled offline mode. */
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.getRegistration().then(registration => registration?.update()).catch(() => {});
}
