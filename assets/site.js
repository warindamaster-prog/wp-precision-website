/* Local interaction events only: no analytics account, cookies or network requests. */
(() => {
  const emit = (name, service) => document.dispatchEvent(new CustomEvent('wp:interaction', {
    detail: {event: name, page: location.pathname, service}
  }));
  document.addEventListener('click', event => {
    const link = event.target.closest('a[href]');
    if (!link) return;
    const href = link.getAttribute('href');
    if (href.startsWith('https://calendly.com/contact-wpprecisionsystems/')) emit('demo_click', 'calibration');
    else if (href.startsWith('mailto:')) emit('email_click', href.includes('sales@') ? 'sales' : 'general');
  });
  document.querySelectorAll('.contact-form').forEach(form => form.addEventListener('submit', () => {
    emit('contact_email_app_open', 'general');
  }));
  const nav = document.querySelector('.mobile-navigation');
  if (nav) {
    const mobile = matchMedia('(max-width: 900px)');
    const syncNavigation = () => { nav.open = !mobile.matches; };
    syncNavigation();
    mobile.addEventListener('change', syncNavigation);
  }
  if (nav) document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && nav.open) {
      nav.open = false;
      nav.querySelector('summary').focus();
    }
  });
})();
