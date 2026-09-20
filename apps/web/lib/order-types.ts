// Shared checkout enums used across the checkout UI. Orders themselves are now
// persisted by the API (see app/api/checkout) rather than in the browser.

export type DeliveryMethod = 'home' | 'pickup';
export type PaymentMethod = 'mpesa' | 'emola' | 'mkesh' | 'cod';
