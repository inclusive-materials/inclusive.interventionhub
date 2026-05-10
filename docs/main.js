/* ============================================================
   Inclusive Materials — main.js
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {

  /* ── Shop Dropdown ──────────────────────────────────────── */
  const shopDropdown = document.getElementById('shopDropdown');
  const dropdownToggle = shopDropdown?.querySelector('.navbar__dropdown-toggle');

  if (dropdownToggle) {
    dropdownToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = shopDropdown.classList.toggle('open');
      dropdownToggle.setAttribute('aria-expanded', isOpen);
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (!shopDropdown.contains(e.target)) {
        shopDropdown.classList.remove('open');
        dropdownToggle.setAttribute('aria-expanded', false);
      }
    });

    // Close on Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        shopDropdown.classList.remove('open');
        dropdownToggle.setAttribute('aria-expanded', false);
      }
    });
  }

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
      const cards = productsGrid.querySelectorAll('.product-card');
      let visibleCount = 0;

      cards.forEach(card => {
        const cardAudience = (card.dataset.audience || '').toLowerCase();
        const cardCategory = (card.dataset.category || '').toLowerCase();
        const cardTitle = (card.dataset.title || '').toLowerCase();

        const audienceMatch =
          activeAudience === 'all' ||
          cardAudience === 'all' ||
          cardAudience.split(/\s+/).filter(Boolean).includes(activeAudience);
        const categoryMatch =
          activeCategory === 'all' || cardCategory === 'all' || cardCategory === activeCategory;
        const searchMatch = searchQuery === '' || cardTitle.includes(searchQuery);

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
      const catParam = params.get('cat');
      if (catParam) {
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
      const message = contactForm.querySelector('#message').value.trim();

      if (!name || !email || !message) {
        // Simple validation highlight
        [contactForm.querySelector('#name'), contactForm.querySelector('#email'), contactForm.querySelector('#message')]
          .forEach(field => {
            if (!field.value.trim()) {
              field.style.borderColor = '#e05a5a';
              field.addEventListener('input', () => { field.style.borderColor = ''; }, { once: true });
            }
          });
        return;
      }

      // Simulate sending (replace with your real form handler / Formspree endpoint)
      const submitBtn = contactForm.querySelector('[type="submit"]');
      submitBtn.textContent = 'Sending…';
      submitBtn.disabled = true;

      setTimeout(() => {
        contactForm.reset();
        submitBtn.textContent = 'Send Message';
        submitBtn.innerHTML = 'Send Message <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 8h12M9 4l5 4-5 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
        submitBtn.disabled = false;
        if (formSuccess) formSuccess.classList.remove('hidden');
        setTimeout(() => formSuccess?.classList.add('hidden'), 5000);
      }, 900);
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
