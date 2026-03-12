export function initAnalytics(): void {
  if (!import.meta.env.PROD) return;

  const domain = (import.meta.env.VITE_PLAUSIBLE_DOMAIN as string | undefined)?.trim();
  if (!domain) return;

  const src =
    (import.meta.env.VITE_PLAUSIBLE_SRC as string | undefined)?.trim() ||
    'https://plausible.io/js/script.js';

  if (document.querySelector('script[data-analytics="plausible"]')) return;

  const script = document.createElement('script');
  script.defer = true;
  script.src = src;
  script.setAttribute('data-domain', domain);
  script.setAttribute('data-analytics', 'plausible');
  document.head.appendChild(script);
}
