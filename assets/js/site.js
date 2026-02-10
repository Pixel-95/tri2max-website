(() => {
  const header = document.querySelector('.site-header');
  const navToggle = document.querySelector('.nav-toggle');
  const primaryNav = document.querySelector('#primary-nav');
  const feedback = document.querySelector('.form-feedback');
  const waitlistForm = document.querySelector('.waitlist-form');

  const setHeaderState = () => {
    if (!header) return;
    header.classList.toggle('is-scrolled', window.scrollY > 8);
  };

  const closeMenu = () => {
    if (!primaryNav || !navToggle) return;
    primaryNav.classList.remove('is-open');
    navToggle.setAttribute('aria-expanded', 'false');
  };

  if (navToggle && primaryNav) {
    navToggle.addEventListener('click', () => {
      const expanded = navToggle.getAttribute('aria-expanded') === 'true';
      navToggle.setAttribute('aria-expanded', String(!expanded));
      primaryNav.classList.toggle('is-open', !expanded);
    });

    document.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest('.nav-shell')) return;
      closeMenu();
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeMenu();
    });

    primaryNav.querySelectorAll('a[href^="#"]').forEach((link) => {
      link.addEventListener('click', () => closeMenu());
    });
  }

  const sectionLinks = document.querySelectorAll('a[href^="#"]');
  sectionLinks.forEach((link) => {
    if (link.classList.contains('skip-link')) return;

    link.addEventListener('click', (event) => {
      const href = link.getAttribute('href');
      if (!href || href === '#') return;
      const target = document.querySelector(href);
      if (!target) return;

      event.preventDefault();
      const headerOffset = header ? header.offsetHeight + 12 : 0;
      const top = target.getBoundingClientRect().top + window.scrollY - headerOffset;
      window.scrollTo({ top, behavior: 'smooth' });

      history.replaceState(null, '', href);
    });
  });

  const revealItems = document.querySelectorAll('.reveal');
  revealItems.forEach((item) => {
    const delay = Number(item.getAttribute('data-delay') || '0');
    item.style.setProperty('--delay', `${delay}ms`);
  });

  if ('IntersectionObserver' in window) {
    const revealObserver = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        });
      },
      {
        threshold: 0.16,
        rootMargin: '0px 0px -8% 0px'
      }
    );

    revealItems.forEach((item) => revealObserver.observe(item));
  } else {
    revealItems.forEach((item) => item.classList.add('is-visible'));
  }

  if (waitlistForm && feedback) {
    waitlistForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const formData = new FormData(waitlistForm);
      const email = String(formData.get('email') || '').trim();

      if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
        feedback.textContent = 'Please enter a valid email address.';
        feedback.style.color = 'var(--accent)';
        return;
      }

      feedback.textContent = 'Thanks. You are on the early-access list.';
      feedback.style.color = 'var(--ink-soft)';
      waitlistForm.reset();
    });
  }

  const year = document.querySelector('#year');
  if (year) {
    year.textContent = String(new Date().getFullYear());
  }

  setHeaderState();
  window.addEventListener('scroll', setHeaderState, { passive: true });
})();
