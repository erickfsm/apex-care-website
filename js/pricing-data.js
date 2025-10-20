/**
 * @fileoverview This file contains the pricing and feature data for the subscription plans.
 * It exports a single constant, `planPricing`, which is an array of plan objects.
 * Each object defines the properties and content for a specific plan, used to render
 * pricing tables and feature lists on both the homepage and the client portal.
 *
 * @property {string} id - A unique identifier for the plan (e.g., 'trimestral').
 * @property {string} name - The display name of the plan.
 * @property {string} homepageTitle - The title used on the homepage pricing card.
 * @property {string} tagline - A short descriptive tagline for the plan.
 * @property {object} homepage - Configuration for the homepage pricing card.
 * @property {string|null} homepage.badge - A badge label (e.g., 'MAIS POPULAR').
 * @property {boolean} homepage.featured - Whether the card should be visually highlighted.
 * @property {object} homepage.cta - Call-to-action button configuration.
 * @property {object} portal - Configuration for the portal plan comparison card.
 * @property {string} portal.title - The title used in the portal.
 * @property {string} portal.badge - A badge label for the portal card.
 * @property {boolean} portal.featured - Whether the portal card is featured.
 * @property {string} portal.economyBadge - A badge highlighting cost savings.
 * @property {object} startingFrom - "Starting from" price details.
 * @property {string} billingNote - A note about the billing cycle and terms.
 * @property {string} priceSummary - A summary link for detailed pricing.
 * @property {Array<object>} sofaPricing - An array of pricing details per sofa category.
 * @property {Array<object>} homepageFeatures - A list of features for the homepage card.
 * @property {Array<string>} portalBenefits - A list of benefits for the portal card.
 */
export const planPricing = [
    {
        id: 'trimestral',
        name: 'Trimestral',
        homepageTitle: 'Trimestral',
        tagline: 'Manutenção Máxima',
        homepage: {
            badge: null,
            featured: false,
            cta: {
                label: 'Saber Mais',
                href: '#orcamento',
                className: 'cta-button-outline'
            }
        },
        portal: {
            title: '🔥 Plano Trimestral',
            badge: 'MAIS ECONOMIA',
            featured: false,
            economyBadge: 'Economize até R$ 400/ano'
        },
        startingFrom: {
            prefix: 'A partir de',
            amount: 'R$ 89',
            suffix: '/mês'
        },
        billingNote: 'Cobrança trimestral com ajuste para o tipo de sofá.',
        priceSummary: 'Ver tabela de preços por categoria',
        sofaPricing: [
            { category: 'Sofá 2 lugares', price: 'R$ 89/mês · R$ 267/trimestre' },
            { category: 'Sofá 3 lugares', price: 'R$ 109/mês · R$ 327/trimestre' },
            { category: 'Sofá com chaise', price: 'R$ 129/mês · R$ 387/trimestre' },
            { category: 'Sofá retrátil', price: 'R$ 149/mês · R$ 447/trimestre' }
        ],
        homepageFeatures: [
            { highlight: '4 Higienizações', text: 'por ano' },
            { text: 'Ideal para pets e crianças' },
            { text: 'Maior desconto por serviço' },
            { highlight: '15% OFF', text: 'serviços avulsos' },
            { highlight: '20% OFF', text: 'taxas adicionais' }
        ],
        portalBenefits: [
            '4 Higienizações por ano',
            '15% OFF em serviços avulsos',
            '20% OFF em taxas adicionais',
            'Prioridade no agendamento',
            '1 Emergência gratuita/ano'
        ]
    },
    {
        id: 'semestral',
        name: 'Semestral',
        homepageTitle: 'Semestral',
        tagline: 'Cuidado Proativo',
        homepage: {
            badge: 'MAIS POPULAR',
            featured: true,
            cta: {
                label: 'Quero Este Plano',
                href: '#orcamento',
                className: 'cta-button-hero'
            }
        },
        portal: {
            title: '⭐ Plano Semestral',
            badge: 'MAIS POPULAR',
            featured: true,
            economyBadge: 'Economize até R$ 250/ano'
        },
        startingFrom: {
            prefix: 'A partir de',
            amount: 'R$ 79',
            suffix: '/mês'
        },
        billingNote: 'Cobrança semestral com valores flexíveis por categoria.',
        priceSummary: 'Ver tabela de preços por categoria',
        sofaPricing: [
            { category: 'Sofá 2 lugares', price: 'R$ 79/mês · R$ 474/semestre' },
            { category: 'Sofá 3 lugares', price: 'R$ 94/mês · R$ 564/semestre' },
            { category: 'Sofá com chaise', price: 'R$ 114/mês · R$ 684/semestre' },
            { category: 'Sofá retrátil', price: 'R$ 134/mês · R$ 804/semestre' }
        ],
        homepageFeatures: [
            { highlight: '2 Higienizações', text: 'por ano' },
            { text: 'Equilíbrio perfeito custo-benefício' },
            { text: 'Mantém estofado sempre novo' },
            { highlight: '15% OFF', text: 'serviços avulsos' },
            { highlight: '20% OFF', text: 'taxas adicionais' }
        ],
        portalBenefits: [
            '2 Higienizações por ano',
            '15% OFF em serviços avulsos',
            '20% OFF em taxas adicionais',
            'Manutenção preventiva',
            'Desconto em impermeabilização'
        ]
    },
    {
        id: 'anual',
        name: 'Anual',
        homepageTitle: 'Anual',
        tagline: 'Tranquilidade Essencial',
        homepage: {
            badge: null,
            featured: false,
            cta: {
                label: 'Saber Mais',
                href: '#orcamento',
                className: 'cta-button-outline'
            }
        },
        portal: {
            title: '🛡️ Plano Anual',
            badge: 'TRANQUILIDADE',
            featured: false,
            economyBadge: 'Economize até R$ 150/ano'
        },
        startingFrom: {
            prefix: 'A partir de',
            amount: 'R$ 59',
            suffix: '/mês'
        },
        billingNote: 'Cobrança anual para quem deseja manutenção essencial.',
        priceSummary: 'Ver tabela de preços por categoria',
        sofaPricing: [
            { category: 'Sofá 2 lugares', price: 'R$ 59/mês · R$ 708/ano' },
            { category: 'Sofá 3 lugares', price: 'R$ 74/mês · R$ 888/ano' },
            { category: 'Sofá com chaise', price: 'R$ 89/mês · R$ 1.068/ano' },
            { category: 'Sofá retrátil', price: 'R$ 109/mês · R$ 1.308/ano' }
        ],
        homepageFeatures: [
            { highlight: '1 Higienização', text: 'por ano' },
            { highlight: '1 Suporte emergencial', text: 'para odores' },
            { text: 'Segurança contra imprevistos' },
            { highlight: '15% OFF', text: 'serviços avulsos' },
            { highlight: '20% OFF', text: 'taxas adicionais' }
        ],
        portalBenefits: [
            '1 Higienização por ano',
            '1 Suporte emergencial',
            '15% OFF em serviços avulsos',
            'Segurança contra imprevistos',
            'Parcelamento facilitado'
        ]
    }
];
