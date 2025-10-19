import { planPricing } from './pricing-data.js';

const DEFAULT_BREAKDOWN_SUMMARY = 'Ver tabela de preços por categoria';

function createStartingPriceMarkup(startingFrom) {
    if (!startingFrom) {
        return '';
    }

    const { prefix, amount, suffix } = startingFrom;

    return `
        <div class="plan-price">
            <span class="price-prefix">${prefix}</span>
            <span class="price-amount">${amount}</span>
            <span class="price-suffix">${suffix}</span>
        </div>
    `;
}

function createPriceBreakdownMarkup(sofaPricing = [], summary = DEFAULT_BREAKDOWN_SUMMARY, options = {}) {
    if (!Array.isArray(sofaPricing) || sofaPricing.length === 0) {
        return '';
    }

    const { detailsClass = '', open = true } = options;
    const classNames = ['price-breakdown'];
    if (detailsClass) {
        classNames.push(detailsClass);
    }
    const openAttribute = open ? ' open' : '';

    const itemsMarkup = sofaPricing.map(item => `
        <li>
            <span>${item.category}</span>
            <span>${item.price}</span>
        </li>
    `).join('');

    return `
        <details class="${classNames.join(' ')}"${openAttribute}>
            <summary>${summary}</summary>
            <ul>
                ${itemsMarkup}
            </ul>
        </details>
    `;
}

function buildHomepageCard(plan) {
    const featuresMarkup = (plan.homepageFeatures || []).map(feature => {
        if (typeof feature === 'string') {
            return `<li><span class="check-icon">✓</span> ${feature}</li>`;
        }

        const highlight = feature?.highlight ? `<strong>${feature.highlight}</strong>` : '';
        const description = feature?.text ? `${feature.highlight ? ' ' : ''}${feature.text}` : '';

        return `<li><span class="check-icon">✓</span> ${highlight}${description}</li>`;
    }).join('');

    const billingNote = plan.billingNote ? `<p class="plan-price-note">${plan.billingNote}</p>` : '';
    const breakdown = createPriceBreakdownMarkup(
        plan.sofaPricing,
        plan.priceSummary || DEFAULT_BREAKDOWN_SUMMARY,
        { open: true }
    );
    const cardTitle = plan.homepageTitle || plan.name;

    return `
        <div class="pricing-card ${plan.homepage?.featured ? 'featured' : ''}">
            ${plan.homepage?.badge ? `<div class="featured-badge">${plan.homepage.badge}</div>` : ''}
            <h3 class="plan-title">${cardTitle}</h3>
            <p class="plan-tagline">${plan.tagline}</p>
            ${createStartingPriceMarkup(plan.startingFrom)}
            ${billingNote}
            ${breakdown}
            <ul class="plan-features">
                ${featuresMarkup}
            </ul>
            ${plan.homepage?.cta ? `<a href="${plan.homepage.cta.href}" class="${plan.homepage.cta.className}">${plan.homepage.cta.label}</a>` : ''}
        </div>
    `;
}

function buildPortalCard(plan) {
    const benefitsMarkup = (plan.portalBenefits || []).map(benefit => `
        <li>✅ ${benefit}</li>
    `).join('');

    const billingNote = plan.billingNote ? `<p class="plan-price-note">${plan.billingNote}</p>` : '';
    const breakdown = createPriceBreakdownMarkup(
        plan.sofaPricing,
        plan.priceSummary || DEFAULT_BREAKDOWN_SUMMARY,
        { detailsClass: 'compact', open: false }
    );
    const cardTitle = plan.portal?.title || plan.name;

    return `
        <div class="plan-card ${plan.portal?.featured ? 'featured' : ''}">
            ${plan.portal?.badge ? `<div class="plan-badge">${plan.portal.badge}</div>` : ''}
            <h3>${cardTitle}</h3>
            ${createStartingPriceMarkup(plan.startingFrom)}
            ${billingNote}
            ${breakdown}
            <ul class="plan-benefits">
                ${benefitsMarkup}
            </ul>
            ${plan.portal?.economyBadge ? `<div class="economy-badge">${plan.portal.economyBadge}</div>` : ''}
        </div>
    `;
}

export function renderHomepagePlans() {
    const container = document.querySelector('[data-pricing-grid]');
    if (!container) return;

    container.innerHTML = planPricing.map(buildHomepageCard).join('');
}

export function renderPortalPlanComparison() {
    const container = document.querySelector('[data-portal-pricing]');
    if (!container) return;

    container.innerHTML = planPricing.map(buildPortalCard).join('');
}
