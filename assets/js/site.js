(() => {
  const header = document.querySelector('.site-header');
  const navToggle = document.querySelector('.nav-toggle');
  const primaryNav = document.querySelector('#primary-nav');
  const feedback = document.querySelector('.form-feedback');
  const waitlistForm = document.querySelector('.waitlist-form');
  const heroSteps = document.querySelectorAll('.hero-step, .hero-headline');
  const planButtons = Array.from(document.querySelectorAll('.plan-day'));
  const planDetail = document.querySelector('[data-plan-detail]');
  const planList = document.querySelector('.plan-list');
  const quietSignal = document.querySelector('[data-quiet-signal]');
  const loadCurrent = document.querySelector('[data-load-current]');
  const volumeCurrent = document.querySelector('[data-volume-current]');
  const fireworksCanvas = document.querySelector('[data-quiet-fireworks]');
  const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const quietTargetLoad = 490;
  const quietTargetVolumeSeconds = 585;

  let quietLastLoad = -1;
  let quietLastVolume = -1;
  let quietTicking = false;
  let quietWasAtBottom = false;
  let fireworksContext = null;
  let fireworksParticles = [];
  let fireworksFrame = 0;

  const setHeaderState = () => {
    if (!header) return;
    header.classList.toggle('is-scrolled', window.scrollY > 8);
  };

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  const getScrollProgress = () => {
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    if (maxScroll <= 0) return 1;
    return clamp(window.scrollY / maxScroll, 0, 1);
  };

  const formatVolume = (totalSeconds) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}h`;
  };

  const resizeFireworksCanvas = () => {
    if (!fireworksCanvas) return;
    const scale = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.floor(window.innerWidth * scale);
    const height = Math.floor(window.innerHeight * scale);

    if (fireworksCanvas.width !== width || fireworksCanvas.height !== height) {
      fireworksCanvas.width = width;
      fireworksCanvas.height = height;
    }

    if (!fireworksContext) {
      fireworksContext = fireworksCanvas.getContext('2d');
    }

    if (fireworksContext) {
      fireworksContext.setTransform(scale, 0, 0, scale, 0, 0);
    }
  };

  const animateFireworks = () => {
    if (!fireworksContext) return;

    fireworksContext.clearRect(0, 0, window.innerWidth, window.innerHeight);
    fireworksContext.globalCompositeOperation = 'lighter';

    let liveCount = 0;

    fireworksParticles.forEach((particle) => {
      particle.life -= 16.67;
      if (particle.life <= 0) return;

      liveCount += 1;
      particle.vx *= 0.985;
      particle.vy = particle.vy * 0.986 + 0.015;
      particle.x += particle.vx;
      particle.y += particle.vy;

      const alpha = (particle.life / particle.maxLife) * 0.48;
      fireworksContext.beginPath();
      fireworksContext.fillStyle = `rgba(${particle.color[0]}, ${particle.color[1]}, ${particle.color[2]}, ${alpha.toFixed(3)})`;
      fireworksContext.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
      fireworksContext.fill();
    });

    fireworksContext.globalCompositeOperation = 'source-over';

    if (liveCount > 0) {
      fireworksFrame = window.requestAnimationFrame(animateFireworks);
      return;
    }

    fireworksParticles = [];
    fireworksContext.clearRect(0, 0, window.innerWidth, window.innerHeight);
    fireworksFrame = 0;
  };

  const triggerQuietFireworks = () => {
    if (!fireworksCanvas || reducedMotionQuery.matches) return;

    resizeFireworksCanvas();
    if (!fireworksContext) return;

    const signalRect = quietSignal instanceof HTMLElement ? quietSignal.getBoundingClientRect() : null;
    const originX = signalRect ? signalRect.left + signalRect.width * 0.76 : window.innerWidth - 60;
    const originY = signalRect ? signalRect.top + signalRect.height * 0.56 : (header ? header.offsetHeight + 24 : 68);
    const particleCount = 16;

    fireworksParticles = Array.from({ length: particleCount }, (_, index) => {
      const baseAngle = (Math.PI * 2 * index) / particleCount;
      const angle = baseAngle + (Math.random() - 0.5) * 0.28;
      const speed = 0.55 + Math.random() * 1.15;
      const useAccent = Math.random() > 0.72;

      return {
        x: originX,
        y: originY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 0.2,
        radius: 0.9 + Math.random() * 1.6,
        life: 420 + Math.random() * 240,
        maxLife: 420 + Math.random() * 240,
        color: useAccent ? [194, 64, 31] : [246, 248, 255]
      };
    });

    if (fireworksFrame) {
      window.cancelAnimationFrame(fireworksFrame);
    }

    fireworksFrame = window.requestAnimationFrame(animateFireworks);
  };

  const updateQuietSignal = () => {
    if (!(loadCurrent instanceof HTMLElement) || !(volumeCurrent instanceof HTMLElement)) return;

    const progress = getScrollProgress();
    const load = Math.round(progress * quietTargetLoad);
    const volumeSeconds = Math.round(progress * quietTargetVolumeSeconds);

    if (load !== quietLastLoad) {
      loadCurrent.textContent = String(load);
      quietLastLoad = load;
    }

    if (volumeSeconds !== quietLastVolume) {
      volumeCurrent.textContent = formatVolume(volumeSeconds);
      quietLastVolume = volumeSeconds;
    }

    const atBottom = progress >= 0.9995;
    if (atBottom && !quietWasAtBottom) {
      triggerQuietFireworks();
    }
    quietWasAtBottom = atBottom;
  };

  const queueQuietSignalUpdate = () => {
    if (quietTicking) return;
    quietTicking = true;

    window.requestAnimationFrame(() => {
      quietTicking = false;
      updateQuietSignal();
    });
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
      feedback.style.color = 'var(--text-soft)';
      waitlistForm.reset();
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
    const allowPlanInteraction = window.matchMedia('(min-width: 900px) and (hover: hover) and (pointer: fine)').matches;

    if (!allowPlanInteraction) {
      if (planList) planList.classList.add('is-static');
      planButtons.forEach((button, index) => {
        button.setAttribute('aria-disabled', 'true');
        if (index > 0) button.setAttribute('tabindex', '-1');
      });
    }

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

    if (allowPlanInteraction) {
      planButtons.forEach((button) => {
        button.addEventListener('click', () => setActiveDay(button));
        button.addEventListener('mouseenter', () => setActiveDay(button));

        button.addEventListener('keydown', (event) => {
          if (event.key !== 'Enter' && event.key !== ' ') return;
          event.preventDefault();
          setActiveDay(button);
        });
      });
    }
  }

  const year = document.querySelector('#year');
  if (year) {
    year.textContent = String(new Date().getFullYear());
  }

  if (quietSignal && loadCurrent && volumeCurrent) {
    resizeFireworksCanvas();
    updateQuietSignal();
    window.addEventListener('scroll', queueQuietSignalUpdate, { passive: true });
    window.addEventListener('resize', () => {
      resizeFireworksCanvas();
      queueQuietSignalUpdate();
    });
  }

  setHeaderState();
  window.addEventListener('scroll', setHeaderState, { passive: true });
})();
