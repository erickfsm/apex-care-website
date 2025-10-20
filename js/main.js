import { renderHomepagePlans } from './pricing-renderer.js';
/**
 * @fileoverview Main script for the homepage, handles smooth scrolling, header styling, and plan rendering.
 */
// --- SMOOTH SCROLLING FOR MENU LINKS ---
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    /**
     * @listens click
     * @description Handles the click event on menu links to enable smooth scrolling.
     */
    anchor.addEventListener('click', function (e) {
        const href = this.getAttribute('href');

        if (!href || href === '#') {
            return;
        }

        const target = document.querySelector(href);

        if (!target) {
            return;
        }

        e.preventDefault();

        target.scrollIntoView({
            behavior: 'smooth'
        });
    });
});

// --- HEADER STYLING ON SCROLL ---
const header = document.querySelector('.main-header');
/**
 * @listens scroll
 * @description Adds or removes the 'scrolled' class from the header based on the scroll position.
 */
window.addEventListener('scroll', () => {
    if (window.scrollY > 50) { // If scrolled more than 50 pixels
        header.classList.add('scrolled');
    } else {
        header.classList.remove('scrolled');
    }
});
// --- DYNAMIC PLAN RENDERING ---
/**
 * Renders the homepage plans dynamically.
 */
renderHomepagePlans();
