/**
 * SmartPointage Landing Page - Main JavaScript
 * Handles:
 * - Sticky header on scroll
 * - Mobile menu toggle
 * - Smooth scroll for anchor links
 * - Contact form submission
 */

// =========================================
// DOM Ready Handler
// =========================================
document.addEventListener('DOMContentLoaded', () => {
  console.log('SmartPointage Landing Page initializing...');
  
  initStickyHeader();
  initMobileMenu();
  initSmoothScroll();
  initContactForm();
  initActiveNavHighlight();
  
  console.log('SmartPointage Landing Page initialized');
});

// =========================================
// Sticky Header
// =========================================
function initStickyHeader() {
  const header = document.getElementById('header');
  if (!header) return;
  
  function handleScroll() {
    if (window.scrollY > 50) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  }
  
  window.addEventListener('scroll', handleScroll, { passive: true });
  handleScroll(); // Initial check
}

// =========================================
// Mobile Menu Toggle
// =========================================
function initMobileMenu() {
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const navLinks = document.querySelector('.nav-links');
  
  if (!mobileMenuBtn || !navLinks) {
    console.warn('Mobile menu elements not found');
    return;
  }
  
  console.log('Mobile menu initialized');
  
  // Toggle menu on burger click
  mobileMenuBtn.addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();
    console.log('Burger menu clicked');
    
    mobileMenuBtn.classList.toggle('active');
    navLinks.classList.toggle('active');
  });
  
  // Close menu when clicking nav links
  navLinks.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      mobileMenuBtn.classList.remove('active');
      navLinks.classList.remove('active');
    });
  });
  
  // Close menu when clicking outside
  document.addEventListener('click', (e) => {
    if (navLinks.classList.contains('active')) {
      if (!navLinks.contains(e.target) && !mobileMenuBtn.contains(e.target)) {
        mobileMenuBtn.classList.remove('active');
        navLinks.classList.remove('active');
      }
    }
  });
}

// =========================================
// Smooth Scroll for Anchor Links
// =========================================
function initSmoothScroll() {
  const header = document.getElementById('header');
  
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      const targetId = this.getAttribute('href');
      if (targetId === '#' || !targetId) return;
      
      const targetElement = document.querySelector(targetId);
      if (targetElement) {
        e.preventDefault();
        
        const headerHeight = header ? header.offsetHeight : 0;
        const targetPosition = targetElement.getBoundingClientRect().top + window.scrollY - headerHeight;
        
        window.scrollTo({
          top: targetPosition,
          behavior: 'smooth'
        });
      }
    });
  });
  
  // Handle initial hash in URL
  if (window.location.hash) {
    const targetElement = document.querySelector(window.location.hash);
    if (targetElement && header) {
      setTimeout(() => {
        const headerHeight = header.offsetHeight;
        const targetPosition = targetElement.getBoundingClientRect().top + window.scrollY - headerHeight;
        window.scrollTo({
          top: targetPosition,
          behavior: 'smooth'
        });
      }, 100);
    }
  }
}

// =========================================
// Contact Form Handling
// =========================================
function initContactForm() {
  const contactForm = document.getElementById('contactForm');
  const formSuccess = document.getElementById('formSuccess');
  
  if (!contactForm) return;
  
  contactForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const formData = new FormData(contactForm);
    const data = {
      nom: formData.get('nom'),
      organisation: formData.get('organisation'),
      telephone: formData.get('telephone'),
      email: formData.get('email'),
      message: formData.get('message')
    };
    
    if (!validateForm(data)) {
      return;
    }
    
    const submitBtn = contactForm.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    
    submitBtn.disabled = true;
    submitBtn.textContent = 'Envoi en cours...';
    
    try {
      await simulateFormSubmission(data);
      
      contactForm.style.display = 'none';
      if (formSuccess) {
        formSuccess.classList.remove('hidden');
      }
      
      setTimeout(() => {
        contactForm.reset();
        contactForm.style.display = 'block';
        if (formSuccess) {
          formSuccess.classList.add('hidden');
        }
      }, 5000);
      
    } catch (error) {
      console.error('Form submission error:', error);
      alert('Une erreur est survenue. Veuillez réessayer ou nous contacter directement.');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  });
}

function validateForm(data) {
  if (!data.nom || !data.organisation || !data.telephone || !data.email) {
    alert('Veuillez remplir tous les champs obligatoires.');
    return false;
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(data.email)) {
    alert('Veuillez entrer une adresse email valide.');
    return false;
  }
  
  const phoneRegex = /^[\d\s\+\-\(\)]{8,20}$/;
  if (!phoneRegex.test(data.telephone)) {
    alert('Veuillez entrer un numéro de téléphone valide.');
    return false;
  }
  
  return true;
}

function simulateFormSubmission(data) {
  return new Promise((resolve) => {
    console.log('Form data submitted:', data);
    setTimeout(resolve, 1500);
  });
}

// =========================================
// Active Navigation Link Highlighting
// =========================================
function initActiveNavHighlight() {
  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.nav-links a');
  
  if (sections.length === 0) return;
  
  function highlightNavOnScroll() {
    const scrollY = window.scrollY;
    
    sections.forEach(section => {
      const sectionHeight = section.offsetHeight;
      const sectionTop = section.offsetTop - 100;
      const sectionId = section.getAttribute('id');
      
      if (scrollY > sectionTop && scrollY <= sectionTop + sectionHeight) {
        navLinks.forEach(link => {
          link.classList.remove('active');
          if (link.getAttribute('href') === `#${sectionId}`) {
            link.classList.add('active');
          }
        });
      }
    });
  }
  
  window.addEventListener('scroll', highlightNavOnScroll, { passive: true });
}