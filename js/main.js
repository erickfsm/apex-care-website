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
const heroSection = document.querySelector('.hero-section');

/**
 * Updates header classes to keep a translucent look over the hero section and
 * switch to a solid background after scrolling past it.
 */
const updateHeaderStyles = () => {
    if (!header) {
        return;
    }

    const isHeroCoveringHeader = heroSection ? (() => {
        const heroBounds = heroSection.getBoundingClientRect();
        return heroBounds.top <= header.offsetHeight && heroBounds.bottom > 0;
    })() : false;

    if (isHeroCoveringHeader) {
        header.classList.add('is-transparent');
        header.classList.remove('scrolled');
        return;
    }

    header.classList.remove('is-transparent');

    if (window.scrollY > 50) {
        header.classList.add('scrolled');
    } else {
        header.classList.remove('scrolled');
    }
};

window.addEventListener('scroll', updateHeaderStyles);
window.addEventListener('load', updateHeaderStyles);
window.addEventListener('resize', updateHeaderStyles);
updateHeaderStyles();
// --- DYNAMIC PLAN RENDERING ---
/**
 * Renders the homepage plans dynamically.
 */
renderHomepagePlans();
