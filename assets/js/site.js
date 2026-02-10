(() => {
  const header = document.querySelector('.site-header');
  const navToggle = document.querySelector('.nav-toggle');
  const primaryNav = document.querySelector('#primary-nav');
  const feedback = document.querySelector('.form-feedback');
  const waitlistForm = document.querySelector('.waitlist-form');
  const heroSteps = document.querySelectorAll('.hero-step, .hero-headline');
  const planButtons = Array.from(document.querySelectorAll('.plan-day'));
  const planDetail = document.querySelector('[data-plan-detail]');
  const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

  const setHeaderState = () => {
    if (!header) return;
    header.classList.toggle('is-scrolled', window.scrollY > 8);
  };

  const closeMenu = () => {
    if (!primaryNav || !navToggle) return;
    primaryNav.classList.remove('is-open');
    navToggle.setAttribute('aria-expanded', 'false');
    navToggle.classList.remove('is-open');
  };

  if (navToggle && primaryNav) {
    navToggle.addEventListener('click', () => {
      const expanded = navToggle.getAttribute('aria-expanded') === 'true';
      navToggle.setAttribute('aria-expanded', String(!expanded));
      primaryNav.classList.toggle('is-open', !expanded);
      navToggle.classList.toggle('is-open', !expanded);
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
    const submitButton = waitlistForm.querySelector('button[type="submit"]');
    const waitlistEndpoint =
      waitlistForm.getAttribute('data-endpoint') || 'https://formsubmit.co/ajax/tri2maxapp@gmail.com';

    const getConnectionData = () => {
      const connection =
        navigator.connection || navigator.mozConnection || navigator.webkitConnection || null;
      if (!connection) return 'n/a';
      const parts = [
        connection.effectiveType || 'unknown',
        `downlink:${connection.downlink ?? 'n/a'}`,
        `rtt:${connection.rtt ?? 'n/a'}`,
        `saveData:${connection.saveData ? 'on' : 'off'}`
      ];
      return parts.join(', ');
    };

    const getDeviceData = () => ({
      userAgent: navigator.userAgent || 'n/a',
      platform: navigator.platform || 'n/a',
      language: navigator.language || 'n/a',
      languages: Array.isArray(navigator.languages) ? navigator.languages.join(', ') : 'n/a',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'n/a',
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      screen: `${window.screen.width}x${window.screen.height}`,
      colorDepth: String(window.screen.colorDepth ?? 'n/a'),
      pixelRatio: String(window.devicePixelRatio ?? 'n/a'),
      touchPoints: String(navigator.maxTouchPoints ?? 0),
      cookiesEnabled: String(Boolean(navigator.cookieEnabled)),
      doNotTrack: navigator.doNotTrack || 'n/a',
      hardwareConcurrency: String(navigator.hardwareConcurrency ?? 'n/a'),
      deviceMemory: String(navigator.deviceMemory ?? 'n/a'),
      connection: getConnectionData(),
      referrer: document.referrer || 'direct',
      page: window.location.href
    });

    const getLocationData = async () => {
      if (!('geolocation' in navigator)) {
        return { status: 'unsupported' };
      }

      return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const latitude = Number(position.coords.latitude).toFixed(6);
            const longitude = Number(position.coords.longitude).toFixed(6);
            let city = 'n/a';
            let country = 'n/a';
            let region = 'n/a';

            try {
              const reverse = await fetch(
                `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`,
                { method: 'GET' }
              );

              if (reverse.ok) {
                const geo = await reverse.json();
                city = geo.city || geo.locality || geo.principalSubdivision || 'n/a';
                country = geo.countryName || 'n/a';
                region = geo.principalSubdivision || 'n/a';
              }
            } catch (error) {
              city = 'lookup-failed';
              country = 'lookup-failed';
              region = 'lookup-failed';
            }

            resolve({
              status: 'granted',
              latitude,
              longitude,
              accuracy: `${Math.round(position.coords.accuracy || 0)}m`,
              city,
              region,
              country
            });
          },
          (error) => {
            const map = {
              1: 'denied',
              2: 'unavailable',
              3: 'timeout'
            };
            resolve({ status: map[error.code] || 'failed' });
          },
          {
            enableHighAccuracy: false,
            timeout: 8000,
            maximumAge: 300000
          }
        );
      });
    };

    waitlistForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const formData = new FormData(waitlistForm);
      const email = String(formData.get('email') || '').trim();

      if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
        feedback.textContent = 'Please enter a valid email address.';
        feedback.style.color = 'var(--accent)';
        return;
      }

      feedback.textContent = 'Sending request...';
      feedback.style.color = 'var(--text-muted)';
      if (submitButton instanceof HTMLButtonElement) submitButton.disabled = true;

      try {
        const [locationData, deviceData] = await Promise.all([getLocationData(), Promise.resolve(getDeviceData())]);
        const timestamp = new Date().toISOString();

        formData.set('email', email);
        formData.append('submitted_at', timestamp);
        formData.append('location_status', locationData.status || 'unknown');
        formData.append('latitude', locationData.latitude || 'n/a');
        formData.append('longitude', locationData.longitude || 'n/a');
        formData.append('gps_accuracy', locationData.accuracy || 'n/a');
        formData.append('city', locationData.city || 'n/a');
        formData.append('region', locationData.region || 'n/a');
        formData.append('country', locationData.country || 'n/a');
        formData.append('device_user_agent', deviceData.userAgent);
        formData.append('device_platform', deviceData.platform);
        formData.append('device_language', deviceData.language);
        formData.append('device_languages', deviceData.languages);
        formData.append('device_timezone', deviceData.timezone);
        formData.append('device_viewport', deviceData.viewport);
        formData.append('device_screen', deviceData.screen);
        formData.append('device_color_depth', deviceData.colorDepth);
        formData.append('device_pixel_ratio', deviceData.pixelRatio);
        formData.append('device_touch_points', deviceData.touchPoints);
        formData.append('device_cookies_enabled', deviceData.cookiesEnabled);
        formData.append('device_do_not_track', deviceData.doNotTrack);
        formData.append('device_hardware_concurrency', deviceData.hardwareConcurrency);
        formData.append('device_memory', deviceData.deviceMemory);
        formData.append('device_connection', deviceData.connection);
        formData.append('page', deviceData.page);
        formData.append('referrer', deviceData.referrer);

        const response = await fetch(waitlistEndpoint, {
          method: 'POST',
          body: formData,
          headers: {
            Accept: 'application/json'
          }
        });

        if (!response.ok) {
          throw new Error(`Waitlist request failed with status ${response.status}`);
        }

        feedback.textContent = 'Thanks. Your waitlist request was sent.';
        feedback.style.color = 'var(--text-soft)';
        waitlistForm.reset();
      } catch (error) {
        feedback.textContent = 'Request failed. Please try again in a moment.';
        feedback.style.color = 'var(--accent)';
      } finally {
        if (submitButton instanceof HTMLButtonElement) submitButton.disabled = false;
      }
    });
  }

  if (heroSteps.length > 0) {
    heroSteps.forEach((step) => {
      const delay = Number(step.getAttribute('data-hero-delay') || '0');
      step.style.setProperty('--hero-delay', `${delay}ms`);
    });

    const armHero = () => document.body.classList.add('is-hero-ready');
    if (reducedMotionQuery.matches) {
      armHero();
    } else {
      window.setTimeout(armHero, 60);
    }
  }

  if (planButtons.length > 0 && planDetail) {
    const detailDay = planDetail.querySelector('.plan-detail-day');
    const detailTitle = planDetail.querySelector('.plan-detail-title');
    const detailMeta = planDetail.querySelector('.plan-detail-meta');
    const detailCopy = planDetail.querySelector('.plan-detail-copy');
    const hasFinePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

    const setActiveDay = (button) => {
      if (!(button instanceof HTMLButtonElement)) return;
      if (button.classList.contains('is-selected')) return;

      planButtons.forEach((entry) => {
        entry.classList.remove('is-selected');
        entry.setAttribute('aria-selected', 'false');
      });

      button.classList.add('is-selected');
      button.setAttribute('aria-selected', 'true');
      planDetail.classList.add('is-updating');

      window.setTimeout(() => {
        if (detailDay) detailDay.textContent = button.dataset.label || '';
        if (detailTitle) detailTitle.textContent = button.dataset.title || '';
        if (detailMeta) detailMeta.textContent = button.dataset.meta || '';
        if (detailCopy) detailCopy.textContent = button.dataset.copy || '';
        planDetail.classList.remove('is-updating');
      }, 130);
    };

    planButtons.forEach((button) => {
      button.addEventListener('click', () => setActiveDay(button));

      if (hasFinePointer) {
        button.addEventListener('mouseenter', () => setActiveDay(button));
      }

      button.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        setActiveDay(button);
      });
    });
  }

  const year = document.querySelector('#year');
  if (year) {
    year.textContent = String(new Date().getFullYear());
  }

  setHeaderState();
  window.addEventListener('scroll', setHeaderState, { passive: true });
})();
