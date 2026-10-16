/* ============================================
   RESTORAN - Main JavaScript
   No frameworks, vanilla JS only
   ============================================ */

(function () {
  'use strict';

  /* --- Navbar scroll effect --- */
  const navbar = document.querySelector('.navbar');
  if (navbar) {
    const onScroll = () => {
      navbar.classList.toggle('navbar--scrolled', window.scrollY > 60);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* --- Mobile menu toggle --- */
  const toggle = document.querySelector('.navbar__toggle');
  const menu = document.querySelector('.navbar__menu');
  if (toggle && menu) {
    toggle.addEventListener('click', () => {
      toggle.classList.toggle('active');
      menu.classList.toggle('open');
      document.body.style.overflow = menu.classList.contains('open') ? 'hidden' : '';
    });

    // Close menu on link click
    menu.querySelectorAll('.navbar__link').forEach(link => {
      link.addEventListener('click', () => {
        toggle.classList.remove('active');
        menu.classList.remove('open');
        document.body.style.overflow = '';
      });
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (menu.classList.contains('open') && !menu.contains(e.target) && !toggle.contains(e.target)) {
        toggle.classList.remove('active');
        menu.classList.remove('open');
        document.body.style.overflow = '';
      }
    });
  }

  /* --- Scroll reveal --- */
  const revealElements = document.querySelectorAll('.reveal');
  if (revealElements.length) {
    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            revealObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
    );
    revealElements.forEach(el => revealObserver.observe(el));
  }

  /* --- Active nav link highlight --- */
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.navbar__link').forEach(link => {
    const href = link.getAttribute('href');
    if (href === currentPage || (currentPage === '' && href === 'index.html')) {
      link.classList.add('navbar__link--active');
    }
  });

  /* --- Menu page: category filter --- */
  const categoryBtns = document.querySelectorAll('.menu-category-btn');
  const menuItems = document.querySelectorAll('.menu-item');
  if (categoryBtns.length && menuItems.length) {
    categoryBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        // Update active button
        categoryBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const filter = btn.dataset.category;

        menuItems.forEach(item => {
          if (filter === 'all' || item.dataset.category === filter) {
            item.style.display = 'flex';
            item.style.opacity = '0';
            item.style.transform = 'translateY(12px)';
            requestAnimationFrame(() => {
              item.style.transition = 'opacity 0.35s ease, transform 0.35s ease';
              item.style.opacity = '1';
              item.style.transform = 'translateY(0)';
            });
          } else {
            item.style.display = 'none';
          }
        });
      });
    });
  }

  /* --- Contact form handling --- */
  const contactForm = document.getElementById('contact-form');
  if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
      e.preventDefault();

      const formData = new FormData(contactForm);
      const data = Object.fromEntries(formData.entries());

      // Basic validation
      let valid = true;
      contactForm.querySelectorAll('[required]').forEach(field => {
        if (!field.value.trim()) {
          field.style.borderColor = '#DC2626';
          valid = false;
        } else {
          field.style.borderColor = '';
        }
      });

      if (valid) {
        const btn = contactForm.querySelector('button[type="submit"]');
        const originalText = btn.textContent;
        btn.textContent = 'Sending...';
        btn.disabled = true;

        // Simulate send (replace with real endpoint)
        setTimeout(() => {
          btn.textContent = 'Message Sent!';
          btn.style.background = '#16A34A';
          contactForm.reset();

          setTimeout(() => {
            btn.textContent = originalText;
            btn.style.background = '';
            btn.disabled = false;
          }, 2500);
        }, 1200);
      }
    });

    // Clear error on input
    contactForm.querySelectorAll('[required]').forEach(field => {
      field.addEventListener('input', () => {
        field.style.borderColor = '';
      });
    });
  }

  /* --- Smooth scroll for anchor links --- */
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
      const target = document.querySelector(anchor.getAttribute('href'));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  /* --- Current year in footer --- */
  const yearEl = document.querySelector('.footer-year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

})();
