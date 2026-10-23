import { Capacitor } from '@capacitor/core';

export const CHECKOUT_EVENT = 'cc:external-checkout';

export const isIOSApp = () => {
  try { return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios'; } catch { return false; }
};

// Success URL opened in Safari after Stripe checkout; src=app tells the page to send the user back to the app
export const checkoutSuccessUrl = (plan) =>
  `${window.location.origin}/checkout-success?plan=${plan}${isIOSApp() ? '&src=app' : ''}`;

// iOS app: hand the URL to an in-app sheet whose tap opens Safari. Web/Android: unchanged redirect.
// Returns true when the caller should reset its loading state.
export const redirectToCheckout = (url) => {
  if (isIOSApp()) {
    window.dispatchEvent(new CustomEvent(CHECKOUT_EVENT, { detail: { url } }));
    return true;
  }
  window.location.href = url;
  return false;
};
