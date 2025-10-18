// Script para rolagem suave ao clicar nos links do menu
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
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

const header = document.querySelector('.main-header');
window.addEventListener('scroll', () => {
    if (window.scrollY > 50) { // Se rolar mais de 50 pixels
        header.classList.add('scrolled');
    } else {
        header.classList.remove('scrolled');
    }
});
// =================================================================================