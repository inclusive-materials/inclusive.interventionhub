/* ============================================================
   Inclusive Intervention Hub — main.js
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {

  /* ── Feature flag: Parent Portal paused ─────────────────────
     Flip to true (and unpause docs/portal/index.html's own flag)
     to bring the portal link back into the nav and footer. ── */
  const PORTAL_ENABLED = false;
  if (!PORTAL_ENABLED) {
    document.querySelectorAll('a[href="/portal/"]').forEach((link) => {
      link.closest('li')?.remove();
    });
  }

  /* ── Nav Dropdowns ──────────────────────────────────────── */
  const navDropdowns = ['shopDropdown', 'servicesDropdown']
    .map(id => document.getElementById(id))
    .filter(Boolean);

  navDropdowns.forEach(dropdown => {
    const toggle = dropdown.querySelector('.navbar__dropdown-toggle');
    if (!toggle) return;

    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = dropdown.classList.toggle('open');
      toggle.setAttribute('aria-expanded', isOpen);
      // close sibling dropdowns
      navDropdowns.forEach(d => {
        if (d !== dropdown) {
          d.classList.remove('open');
          d.querySelector('.navbar__dropdown-toggle')?.setAttribute('aria-expanded', false);
        }
      });
    });
  });

  document.addEventListener('click', () => {
    navDropdowns.forEach(d => {
      d.classList.remove('open');
      d.querySelector('.navbar__dropdown-toggle')?.setAttribute('aria-expanded', false);
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      navDropdowns.forEach(d => {
        d.classList.remove('open');
        d.querySelector('.navbar__dropdown-toggle')?.setAttribute('aria-expanded', false);
      });
    }
  });

  /* ── Mobile Hamburger ───────────────────────────────────── */
  const hamburger = document.getElementById('hamburger');
  const mainNav = document.getElementById('main-nav');

  if (hamburger && mainNav) {
    hamburger.addEventListener('click', () => {
      mainNav.classList.toggle('open');
    });

    // Close nav on outside click (mobile)
    document.addEventListener('click', (e) => {
      if (!hamburger.contains(e.target) && !mainNav.contains(e.target)) {
        mainNav.classList.remove('open');
      }
    });
  }

  /* ── Shop Filters ───────────────────────────────────────── */
  const productsGrid =
    document.getElementById('shop-resources-container') || document.getElementById('productsGrid');
  const emptyState = document.getElementById('emptyState');
  const searchInput = document.getElementById('shopSearch');

  if (productsGrid) {
    let activeAudience = 'all';
    let activeCategory = 'all';
    let searchQuery = '';

    const pills = document.querySelectorAll('.filter-pill');

    pills.forEach(pill => {
      pill.addEventListener('click', () => {
        const filterType = pill.dataset.filter;
        const filterValue = pill.dataset.value;

        // Update active pill in its group
        pills.forEach(p => {
          if (p.dataset.filter === filterType) p.classList.remove('active');
        });
        pill.classList.add('active');

        if (filterType === 'audience') activeAudience = filterValue;
        if (filterType === 'category') activeCategory = filterValue;

        applyFilters();
      });
    });

    if (searchInput) {
      searchInput.addEventListener('input', () => {
        searchQuery = searchInput.value.toLowerCase().trim();
        applyFilters();
      });
    }

    function applyFilters() {
      const cards = productsGrid.querySelectorAll('.resource-detail');
      let visibleCount = 0;

      cards.forEach(card => {
        const cardAudience = (card.dataset.audience || '').toLowerCase();
        const cardCategory = (card.dataset.category || '').toLowerCase();
        const cardTitle = (card.dataset.title || '').toLowerCase(); 
        const cardTags = (card.dataset.tags || '').toLowerCase();

        const audienceMatch =
          activeAudience === 'all' ||
          cardAudience === 'all' ||
          cardAudience.split(/[\s,]+/).filter(Boolean).includes(activeAudience);
        const categoryMatch =
          activeCategory === 'all' || cardCategory === 'all' || cardCategory === activeCategory;
        const searchMatch = searchQuery === '' || cardTitle.includes(searchQuery) || cardTags.includes(searchQuery);

        if (audienceMatch && categoryMatch && searchMatch) {
          card.style.display = '';
          visibleCount++;
        } else {
          card.style.display = 'none';
        }
      });

      if (emptyState) {
        if (visibleCount === 0) emptyState.classList.remove('hidden');
        else emptyState.classList.add('hidden');
      }
    }

    function applyShopUrlAudienceParam() {
      const params = new URLSearchParams(window.location.search);
      const catParam = (params.get('cat') || '').toLowerCase();
      if (catParam) {
        // Set the audience directly — filter pills may not be present in the layout
        activeAudience = catParam;
        const matchPill = document.querySelector(`.filter-pill[data-filter="audience"][data-value="${catParam}"]`);
        if (matchPill) matchPill.click();
      }
    }

    applyShopUrlAudienceParam();

    document.addEventListener('cms:shop-ready', () => {
      applyShopUrlAudienceParam();
      applyFilters();
    });
  }

/* ── Contact Form ───────────────────────────────────────── */
  const contactForm = document.getElementById('contactForm');
  const formSuccess = document.getElementById('formSuccess');

  if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
      e.preventDefault();

      const name = contactForm.querySelector('#name').value.trim();
      const email = contactForm.querySelector('#email').value.trim();
      const subject = contactForm.querySelector('#subject').value.trim();
      const message = contactForm.querySelector('#message').value.trim();

      if (!name || !email || !message) {
        [contactForm.querySelector('#name'), contactForm.querySelector('#email'), contactForm.querySelector('#message')]
          .forEach(field => {
            if (!field.value.trim()) {
              field.style.borderColor = '#e05a5a';
              field.addEventListener('input', () => { field.style.borderColor = ''; }, { once: true });
            }
          });
        return;
      }

      const submitBtn = contactForm.querySelector('[type="submit"]');
      submitBtn.textContent = 'Sending…';
      submitBtn.disabled = true;

      fetch('https://hook.us2.make.com/dygxlzskmsj5k9qm9rdip5bis2a8ckj6', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, subject, message })
      })
      .then(() => {
        contactForm.reset();
        submitBtn.textContent = 'Send Message';
        submitBtn.disabled = false;
        if (formSuccess) {
          formSuccess.classList.remove('hidden');
          setTimeout(() => formSuccess?.classList.add('hidden'), 5000);
        }
      })
      .catch(() => {
        submitBtn.textContent = 'Send Message';
        submitBtn.disabled = false;
        alert('Something went wrong. Please try again.');
      });
    });
  }
  /* ── Cookie consent banner (essential cookies notice) ─────── */
  try {
    const COOKIE_KEY = 'im_cookie_consent_v1';
    if (window.localStorage.getItem(COOKIE_KEY)) return;

    const aside = document.createElement('aside');
    aside.className = 'cookie-banner';
    aside.setAttribute('role', 'dialog');
    aside.setAttribute('aria-modal', 'false');
    aside.setAttribute('aria-label', 'Cookie notice');
    aside.innerHTML =
      '<div class="cookie-banner__inner">' +
      '<p class="cookie-banner__text">We use essential cookies and similar technologies to run this site safely and reliably. By clicking Accept, you agree to our use of cookies as described in our <a href="./privacy-policy.html">Privacy Policy</a>.</p>' +
      '<button type="button" class="btn btn--primary cookie-banner__accept" data-cookie-accept>Accept</button>' +
      '</div>';

    document.body.appendChild(aside);

    requestAnimationFrame(() => {
      aside.classList.add('cookie-banner--visible');
      aside.querySelector('[data-cookie-accept]')?.focus();
    });

    aside.querySelector('[data-cookie-accept]')?.addEventListener('click', () => {
      try {
        window.localStorage.setItem(COOKIE_KEY, '1');
      } catch (_) {
        /* ignore */
      }
      aside.classList.remove('cookie-banner--visible');
      const remove = () => aside.remove();
      aside.addEventListener('transitionend', remove, { once: true });
      setTimeout(remove, 280);
    });
  } catch (_) {
    /* localStorage unavailable — banner skipped */
  }

});
