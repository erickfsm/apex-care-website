import { renderPortalPlanComparison } from './pricing-renderer.js';
import { showSuccess, showError, showLoading } from './feedback.js';
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
/**
 * @fileoverview Manages the client portal, displaying appointments, stats, and handling user actions.
 * @module portal-improved
 */

// --- CONSTANTS ---
/** @constant {string} The URL of the Supabase project. */
const SUPABASE_URL = 'https://xrajjehettusnbvjielf.supabase.co';
/** @constant {string} The anonymous key for the Supabase project. */
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhyYWpqZWhldHR1c25idmppZWxmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5NjE2NzMsImV4cCI6MjA3NTUzNzY3M30.LIl1PcGEA31y2TVYmA7zH7mnCPjot-s02LcQmu79e_U';
/** @constant {object} The Supabase client instance. */
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- STATE VARIABLES ---
/** @type {object|null} The current authenticated user object. */
let currentUser = null;
/** @type {Array<object>} A list of all appointments for the current user. */
let allAppointments = [];

// --- DOM ELEMENT REFERENCES ---
const userNameSpan = document.getElementById('user-name');
const statsDiv = document.getElementById('stats-container');
const upcomingAppointmentsDiv = document.getElementById('upcoming-appointments');
const pastAppointmentsDiv = document.getElementById('past-appointments');
const logoutBtn = document.getElementById('logout-btn');
const portalToast = document.getElementById('portal-status-toast');
const portalToastMessage = portalToast?.querySelector('.toast-message');
const portalToastIcon = portalToast?.querySelector('.toast-icon');
const infoAccordionContainer = document.getElementById('info-sections');
/** @type {number|null} Timeout ID for the portal toast. */
let toastTimeoutId = null;

// --- PORTAL CONTENT DATA ---
const postServiceGuides = [
  {
    title: 'Primeiras 24 horas',
    icon: '⏱️',
    items: [
      'Evite usar o estofado por até 6 horas após o serviço',
      'Garanta circulação de ar para acelerar a secagem',
      'Não coloque objetos ou pesos sobre a superfície',
      'Mantenha distância de roupas ou tecidos úmidos',
    ],
  },
  {
    title: 'Manutenção semanal',
    icon: '🧹',
    items: [
      'Aspire com escova macia 1 a 2 vezes por semana',
      'Vire almofadas para distribuir o desgaste',
      'Remova migalhas e poeira assim que notar',
      'Bata as almofadas para manter o volume',
    ],
  },
  {
    title: 'Proteção diária',
    icon: '🛡️',
    items: [
      'Use mantas ou protetores em casas com pets e crianças',
      'Evite exposição direta ao sol para não desbotar',
      'Aja rápido com líquidos, pressionando com papel toalha',
      'Limpe manchas de fora para dentro, sem esfregar',
    ],
  },
];

const emergencyGuide = {
  title: 'Socorro rápido para líquidos',
  icon: '🚨',
  steps: [
    'Pressione com papel absorvente sem esfregar',
    'Utilize água fria e limpa, evitando água quente',
    'Repita até retirar o excesso de líquido',
    'Chame a equipe Apex Care se a mancha persistir',
  ],
  cta: {
    label: 'Falar com o suporte emergencial',
    href: 'https://wa.me/55SEUDDDSEUNUMERO',
  },
};

const hygieneFacts = [
  {
    value: '10x',
    title: 'Redução de ácaros',
    description: 'Um colchão pode abrigar até 10 milhões de ácaros. Higienização técnica reduz até 99% desses microrganismos.',
  },
  {
    value: '2-3 anos',
    title: 'Vida útil estendida',
    description: 'A manutenção periódica aumenta a durabilidade média de estofados entre dois e três anos.',
  },
  {
    value: '70%',
    title: 'Menos alergias',
    description: 'Clientes relatam até 70% de redução de sintomas respiratórios após limpezas regulares.',
  },
  {
    value: 'R$ 5.000+',
    title: 'Economia real',
    description: 'Cuidados preventivos evitam gastos elevados com substituições prematuras de móveis.',
  },
];

const comboPackages = [
  {
    icon: '🛋️',
    name: 'Combo sala completa',
    description: 'Sofá + tapete + poltronas',
    savings: 'Economize até R$ 120',
    benefits: ['Higienização completa', 'Impermeabilização básica', 'Fragrância especial'],
  },
  {
    icon: '🛏️',
    name: 'Combo dormitório',
    description: 'Colchão + travesseiros + carpete',
    savings: 'Economize até R$ 95',
    benefits: ['Tratamento antiácaro', 'Desinfecção profunda', 'Aromatização relaxante'],
  },
  {
    icon: '🪑',
    name: 'Combo jantar',
    description: '6 cadeiras estofadas',
    savings: 'Leve 6, pague 5',
    benefits: ['Limpeza técnica', 'Proteção contra manchas', 'Realce das cores'],
  },
  {
    icon: '🏠',
    name: 'Combo casa inteira',
    description: 'Todos os ambientes',
    savings: 'Economize até R$ 350',
    benefits: ['Higienização geral', 'Impermeabilização premium', 'Manutenção trimestral', 'Atendimento prioritário'],
    featured: true,
  },
];

const supportChannels = [
  {
    icon: '💬',
    label: 'WhatsApp',
    value: '(31) XXXXX-XXXX',
    action: 'Iniciar conversa',
    href: 'https://wa.me/55SEUDDDSEUNUMERO',
    description: 'Resposta em minutos durante o horário comercial.',
  },
  {
    icon: '✉️',
    label: 'E-mail',
    value: 'contato@apexcare.com.br',
    action: 'Enviar mensagem',
    href: 'mailto:contato@apexcare.com.br',
    description: 'Suporte detalhado para dúvidas e orçamentos.',
  },
  {
    icon: '📸',
    label: 'Instagram',
    value: '@apex.higienizacao',
    action: 'Seguir perfil',
    href: 'https://instagram.com/apex.higienizacao',
    description: 'Acompanhe bastidores, resultados e promoções.',
  },
  {
    icon: '🕒',
    label: 'Horários de atendimento',
    value: 'Segunda a sexta: 8h às 18h',
    extra: 'Sábados: 8h às 12h',
    description: 'Nossa equipe está pronta para ajudar dentro desses períodos.',
  },
];

// --- INITIALIZATION ---
if (portalToast) {
  const closeBtn = portalToast.querySelector('.toast-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', hidePortalToast);
  }
}
/**
 * Shows a toast notification within the portal.
 * @param {string} message - The message to display.
 * @param {string} [type='info'] - The type of toast ('info', 'success', 'error').
 */
function showPortalToast(message, type = 'info') {
  if (!portalToast || !portalToastMessage || !portalToastIcon) return;

  const iconMap = {
    success: '✅',
    error: '⚠️',
    info: 'ℹ️',
  };

  portalToastMessage.textContent = message;
  portalToastIcon.textContent = iconMap[type] || iconMap.info;
  portalToast.className = `portal-status-toast ${type}`;
  portalToast.classList.add('visible');

  if (toastTimeoutId) {
    clearTimeout(toastTimeoutId);
  }

  toastTimeoutId = setTimeout(() => {
    hidePortalToast();
  }, 5000);
}
/**
 * Hides the portal toast notification.
 */
function hidePortalToast() {
  if (!portalToast) return;
  portalToast.classList.remove('visible');
  if (toastTimeoutId) {
    clearTimeout(toastTimeoutId);
    toastTimeoutId = null;
  }
}
/**
 * Sets the loading state of a button, disabling it and showing a spinner.
 * @param {HTMLElement} button - The button element to modify.
 * @param {boolean} isLoading - Whether to set the button to a loading state.
 */
function setButtonLoadingState(button, isLoading) {
  if (!button) return;

  const labelEl = button.querySelector('.btn-label');

  if (isLoading) {
    if (!button.dataset.originalLabel) {
      button.dataset.originalLabel = labelEl ? labelEl.textContent : button.textContent;
    }
    button.disabled = true;
    button.classList.add('is-loading');
    button.setAttribute('aria-busy', 'true');
    if (labelEl) {
      labelEl.textContent = 'Cancelando...';
    } else {
      button.textContent = 'Cancelando...';
    }
  } else {
    button.disabled = false;
    button.classList.remove('is-loading');
    button.removeAttribute('aria-busy');
    const originalLabel = button.dataset.originalLabel;
    if (labelEl && originalLabel) {
      labelEl.textContent = originalLabel;
    } else if (!labelEl && originalLabel) {
      button.textContent = originalLabel;
    }
    delete button.dataset.originalLabel;
  }
}
/**
 * Formats a number as a Brazilian currency string.
 * @param {number} value - The number to format.
 * @returns {string} The formatted currency string.
 */
function formatCurrency(value) {
  return `R$ ${(Number(value) || 0).toFixed(2).replace('.', ',')}`;
}
/**
 * Escapes HTML special characters in a string.
 * @param {*} value - The value to escape.
 * @returns {string} The escaped string.
 */
function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return value
    .toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function createAccordionItem({ id, icon, title, subtitle, content }) {
  return `
    <details class="info-accordion-item" data-section="${escapeHtml(id)}">
      <summary class="info-summary">
        <span class="info-icon" aria-hidden="true">${escapeHtml(icon)}</span>
        <span class="info-text">
          <span class="info-title">${escapeHtml(title)}</span>
          ${subtitle ? `<span class="info-subtitle">${escapeHtml(subtitle)}</span>` : ''}
        </span>
        <span class="info-toggle" aria-hidden="true"></span>
      </summary>
      <div class="info-content">
        ${content}
      </div>
    </details>
  `;
}

function createCareSection() {
  const guides = postServiceGuides
    .map(
      (guide) => `
        <article class="info-card">
          <header class="info-card-header">
            <span class="info-card-icon" aria-hidden="true">${escapeHtml(guide.icon)}</span>
            <h3>${escapeHtml(guide.title)}</h3>
          </header>
          <ul class="info-card-list">
            ${guide.items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
          </ul>
        </article>
      `
    )
    .join('');

  const emergency = `
    <article class="info-card info-card-highlight">
      <header class="info-card-header">
        <span class="info-card-icon" aria-hidden="true">${escapeHtml(emergencyGuide.icon)}</span>
        <h3>${escapeHtml(emergencyGuide.title)}</h3>
      </header>
      <ol class="info-card-steps">
        ${emergencyGuide.steps.map((step) => `<li>${escapeHtml(step)}</li>`).join('')}
      </ol>
      <a class="info-card-cta" href="${escapeHtml(emergencyGuide.cta.href)}" target="_blank" rel="noopener noreferrer">
        ${escapeHtml(emergencyGuide.cta.label)}
      </a>
    </article>
  `;

  return createAccordionItem({
    id: 'care',
    icon: '🧺',
    title: 'Cuidados pós-serviço',
    subtitle: 'Preserve os resultados conquistados',
    content: `<div class="info-card-grid">${guides}${emergency}</div>`,
  });
}

function createFactsSection() {
  const facts = hygieneFacts
    .map(
      (fact) => `
        <article class="info-fact">
          <span class="info-fact-value">${escapeHtml(fact.value)}</span>
          <div class="info-fact-text">
            <h3>${escapeHtml(fact.title)}</h3>
            <p>${escapeHtml(fact.description)}</p>
          </div>
        </article>
      `
    )
    .join('');

  return createAccordionItem({
    id: 'facts',
    icon: '💡',
    title: 'Curiosidades sobre higienização',
    subtitle: 'Dados rápidos para ajudar nas decisões',
    content: `<div class="info-facts">${facts}</div>`,
  });
}

function createPlansSection() {
  const content = `
    <p class="info-description">Compare planos com valores atualizados automaticamente pelo time Apex Care.</p>
    <div class="plans-comparison" data-portal-pricing>
      <noscript>
        <p class="info-noscript">Ative o JavaScript para visualizar a comparação de planos.</p>
      </noscript>
    </div>
    <div class="plans-cta">
      <a href="orcamento.html" class="btn-cta-large">
        🎯 Contratar plano agora
      </a>
      <p class="cta-subtitle">Cancele quando quiser. Sem taxas escondidas.</p>
    </div>
  `;

  return createAccordionItem({
    id: 'plans',
    icon: '🎯',
    title: 'Planos de cuidado contínuo',
    subtitle: 'Economize até 25% em serviços recorrentes',
    content,
  });
}

function createPackagesSection() {
  const packages = comboPackages
    .map((combo) => {
      const badge = combo.featured ? '<span class="info-package-badge">Mais vendido</span>' : '';
      return `
        <article class="info-package-card${combo.featured ? ' is-featured' : ''}">
          ${badge}
          <span class="info-package-icon" aria-hidden="true">${escapeHtml(combo.icon)}</span>
          <h3>${escapeHtml(combo.name)}</h3>
          <p class="info-package-description">${escapeHtml(combo.description)}</p>
          <span class="info-package-savings">${escapeHtml(combo.savings)}</span>
          <ul class="info-package-benefits">
            ${combo.benefits.map((benefit) => `<li>${escapeHtml(benefit)}</li>`).join('')}
          </ul>
        </article>
      `;
    })
    .join('');

  return createAccordionItem({
    id: 'packages',
    icon: '📦',
    title: 'Combos favoritos dos clientes',
    subtitle: 'Combine serviços e aumente sua economia',
    content: `<div class="info-packages">${packages}</div>`,
  });
}

function createSupportSection() {
  const channels = supportChannels
    .map((channel) => {
      const hasExternalTarget = typeof channel.href === 'string' && channel.href.startsWith('http');
      const action = channel.action && channel.href
        ? `<a class="info-support-action" href="${escapeHtml(channel.href)}"${
            hasExternalTarget ? ' target="_blank" rel="noopener noreferrer"' : ''
          }>${escapeHtml(channel.action)}</a>`
        : '';
      const value = channel.value ? `<p class="info-support-value">${escapeHtml(channel.value)}</p>` : '';
      const extra = channel.extra ? `<p class="info-support-extra">${escapeHtml(channel.extra)}</p>` : '';
      const description = channel.description
        ? `<p class="info-support-description">${escapeHtml(channel.description)}</p>`
        : '';

      return `
        <article class="info-support-card">
          <div class="info-support-main">
            <span class="info-support-icon" aria-hidden="true">${escapeHtml(channel.icon)}</span>
            <div class="info-support-text">
              <h3>${escapeHtml(channel.label)}</h3>
              ${value}
              ${extra}
              ${description}
            </div>
          </div>
          ${action ? `<div class="info-support-actions">${action}</div>` : ''}
        </article>
      `;
    })
    .join('');

  return createAccordionItem({
    id: 'support',
    icon: '🤝',
    title: 'Canais de suporte e contato',
    subtitle: 'Fale com a equipe Apex Care quando precisar',
    content: `<div class="info-support-grid">${channels}</div>`,
  });
}

function renderInfoSections() {
  if (!infoAccordionContainer) return;

  const sections = [
    createCareSection(),
    createFactsSection(),
    createPlansSection(),
    createPackagesSection(),
    createSupportSection(),
  ];

  infoAccordionContainer.innerHTML = sections.join('');

  const detailItems = infoAccordionContainer.querySelectorAll('.info-accordion-item');
  detailItems.forEach((item, index) => {
    if (index === 0) {
      item.setAttribute('open', '');
      item.classList.add('is-open');
    }
    item.addEventListener('toggle', () => {
      if (item.open) {
        item.classList.add('is-open');
      } else {
        item.classList.remove('is-open');
      }
    });
  });

  renderPortalPlanComparison();
}
/**
 * Initializes the client portal, authenticates the user, and loads data.
 */
async function initPortal() {
  const dismissInitialLoading = showLoading('Carregando seu portal de serviços...');

  try {
    const { data } = await supabase.auth.getUser();

    if (!data?.user) {
      window.location.href = 'login.html';
      return;
    }

    currentUser = data.user;

    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        await supabase.auth.signOut();
        window.location.href = 'index.html';
      });
    }

    await loadPortalData({ skipLoading: true });

    supabase.auth.onAuthStateChange(async (event) => {
      if (event === 'SIGNED_OUT') {
        window.location.href = 'login.html';
      }
    });
  } catch (error) {
    console.error('Erro ao inicializar portal:', error);
    showError('Não foi possível carregar o portal agora. Tente novamente em instantes.');
  } finally {
    dismissInitialLoading();
  }
}
/**
 * Loads all portal data, including profile and appointments.
 * @param {object} [options={}] - Options for loading data.
 * @param {boolean} [options.skipLoading=false] - Whether to skip showing the loading indicator.
 */
async function loadPortalData({ skipLoading = false } = {}) {
  const dismissLoading = skipLoading ? null : showLoading('Atualizando seus agendamentos...');

  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('nome_completo')
      .eq('id', currentUser.id)
      .single();

    if (profile?.nome_completo && userNameSpan) {
      userNameSpan.textContent = profile.nome_completo.split(' ')[0];
    }

    const { data: appointments, error } = await supabase
      .from('agendamentos')
      .select('*')
      .eq('cliente_id', currentUser.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erro ao carregar agendamentos:', error);
      upcomingAppointmentsDiv.innerHTML =
        '<p style="text-align: center; color: #e53935; padding: 30px;">Não foi possível carregar seus dados agora.</p>';
      showError('Não foi possível carregar seus agendamentos. Tente novamente.');
      return;
    }

    allAppointments = appointments || [];
    separateAndRender();
    updateStats();
  } catch (error) {
    console.error('Erro ao carregar dados do portal:', error);
    showError('Enfrentamos um problema para carregar suas informações. Tente novamente em instantes.');
  } finally {
    if (dismissLoading) dismissLoading();
  }
}
/**
 * Separates appointments into different categories and renders them.
 */
function separateAndRender() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const pendingApprovals = allAppointments.filter(
    (appt) => appt.status_pagamento === 'Em Aprovação'
  );

  const awaitingScheduling = allAppointments.filter(
    (appt) =>
      ['Aprovado', 'Aguardando Agendamento'].includes(appt.status_pagamento) &&
      !appt.data_agendamento
  );

  const upcoming = allAppointments.filter((appt) => {
    if (!appt.data_agendamento) return false;
    if (['Cancelado', 'Concluído', 'Reprovado', 'Em Aprovação'].includes(appt.status_pagamento)) {
      return false;
    }
    const apptDate = new Date(`${appt.data_agendamento}T00:00:00`);
    return apptDate >= today;
  });

  const history = allAppointments.filter((appt) => {
    if (appt.status_pagamento === 'Em Aprovação') return false;
    if (['Aprovado', 'Aguardando Agendamento'].includes(appt.status_pagamento) && !appt.data_agendamento) {
      return false;
    }
    if (appt.data_agendamento) {
      const apptDate = new Date(`${appt.data_agendamento}T00:00:00`);
      if (apptDate >= today && !['Cancelado', 'Concluído'].includes(appt.status_pagamento)) {
        return false;
      }
    }
    return true;
  });

  renderApprovalCards(pendingApprovals, awaitingScheduling);
  renderAppointments(upcoming, upcomingAppointmentsDiv, true);
  renderAppointments(history, pastAppointmentsDiv, false);
}
/**
 * Ensures the alerts container element exists in the DOM.
 * @returns {HTMLElement|null} The alerts container element.
 */
function ensureAlertsContainer() {
  let alertsWrapper = document.getElementById('budget-alerts');
  if (!alertsWrapper && upcomingAppointmentsDiv?.parentElement) {
    alertsWrapper = document.createElement('div');
    alertsWrapper.id = 'budget-alerts';
    alertsWrapper.className = 'budget-alerts';
    upcomingAppointmentsDiv.parentElement.insertBefore(
      alertsWrapper,
      upcomingAppointmentsDiv
    );
  }
  return alertsWrapper;
}
/**
 * Renders the approval and awaiting scheduling cards.
 * @param {Array<object>} pendingApprovals - A list of appointments pending approval.
 * @param {Array<object>} awaitingScheduling - A list of appointments awaiting scheduling.
 */
function renderApprovalCards(pendingApprovals, awaitingScheduling) {
  const alertsWrapper = ensureAlertsContainer();
  if (!alertsWrapper) return;

  if (pendingApprovals.length === 0 && awaitingScheduling.length === 0) {
    alertsWrapper.innerHTML = '';
    alertsWrapper.classList.add('hidden');
    return;
  }

  alertsWrapper.classList.remove('hidden');

  const cards = [];

  pendingApprovals.forEach((appt) => {
    cards.push(`
      <div class="budget-alert-card pending">
        <div class="budget-alert-header">
          <span class="budget-alert-icon">⏳</span>
          <div>
            <strong>Orçamento em aprovação</strong>
            <p>Estamos revisando o pedido #${appt.id}. Assim que for liberado, avisaremos por e-mail e WhatsApp.</p>
          </div>
        </div>
        <div class="budget-alert-meta">
          <span>Total estimado: ${formatCurrency(appt.valor_total)}</span>
        </div>
      </div>
    `);
  });

  awaitingScheduling.forEach((appt) => {
    cards.push(`
      <div class="budget-alert-card ready">
        <div class="budget-alert-header">
          <span class="budget-alert-icon">✅</span>
          <div>
            <strong>Orçamento aprovado!</strong>
            <p>Escolha o melhor dia e horário para concluir o agendamento do pedido #${appt.id}.</p>
          </div>
        </div>
        <div class="budget-alert-actions">
          <span>Total aprovado: ${formatCurrency(appt.valor_total)}</span>
          <a href="agendamento.html" class="budget-alert-btn">Agendar agora</a>
        </div>
      </div>
    `);
  });

  alertsWrapper.innerHTML = cards.join('');
}
/**
 * Renders a list of appointments in a given element.
 * @param {Array<object>} appointments - The list of appointments to render.
 * @param {HTMLElement} element - The element to render the appointments in.
 * @param {boolean} isUpcoming - Whether the appointments are upcoming or past.
 */
function renderAppointments(appointments, element, isUpcoming) {
  if (!element) return;

  if (!appointments.length) {
    element.innerHTML = '<p style="text-align: center; color: #999; padding: 30px;">Nenhum registro disponível.</p>';
    return;
  }

  element.innerHTML = '';

  appointments.forEach((appt) => {
    const servicesText = Array.isArray(appt.servicos_escolhidos)
      ? appt.servicos_escolhidos
          .filter((service) => service?.name)
          .map((service) => {
            const quantity = service.quantity && service.quantity > 1 ? ` (x${service.quantity})` : '';
            return `${service.name}${quantity}`;
          })
          .join(', ')
      : 'Serviços não informados';

    const dataFormatada = appt.data_agendamento
      ? new Date(`${appt.data_agendamento}T00:00:00`).toLocaleDateString('pt-BR')
      : 'A definir';

    const horario = appt.hora_agendamento ? ` às ${appt.hora_agendamento}` : '';
    const statusClass = getStatusClass(appt.status_pagamento);

    const metadata = [];
    if (Number.isFinite(Number(appt.distancia_km))) {
      const distanciaValue = Number(appt.distancia_km);
      metadata.push(
        `<li><strong>Distância estimada:</strong> ${distanciaValue.toFixed(1)} km</li>`
      );
    }

    if (!Number.isNaN(Number(appt.taxa_deslocamento))) {
      metadata.push(
        `<li><strong>Taxa de deslocamento:</strong> ${formatCurrency(
          appt.taxa_deslocamento
        )}</li>`
      );
    }

    if (!Number.isNaN(Number(appt.adicionais_condicoes))) {
      metadata.push(
        `<li><strong>Adicionais por condições:</strong> ${formatCurrency(
          appt.adicionais_condicoes
        )}</li>`
      );
    }

    const condicoesLabels = Array.isArray(appt.condicoes_extremas?.selections)
      ? appt.condicoes_extremas.selections
          .map((item) => item?.label || item?.id)
          .filter(Boolean)
      : [];

    if (condicoesLabels.length) {
      metadata.push(
        `<li><strong>Condições especiais:</strong> ${escapeHtml(
          condicoesLabels.join(', ')
        )}</li>`
      );
    }

    const observacoesText = appt.observacoes?.trim();
    if (observacoesText) {
      metadata.push(
        `<li><strong>Observações:</strong> ${escapeHtml(observacoesText)}</li>`
      );
    }

    const metaSection = metadata.length
      ? `<ul class="appointment-meta">${metadata.join('')}</ul>`
      : '';

    let actionButton = '';

    if (isUpcoming) {
      const canCancel = ['Pendente (Pagar no Local)', 'Pago e Confirmado', 'Aguardando Execução'].includes(
        appt.status_pagamento
      );
      if (canCancel) {
        actionButton = `
          <div class="appointment-actions">
            <span class="status-badge ${statusClass}">${appt.status_pagamento}</span>
            <button class="btn-small btn-cancel" data-appointment-id="${appt.id}" onclick="cancelAppointment('${appt.id}', this)">
              <span class="spinner" aria-hidden="true"></span>
              <span class="btn-label">Cancelar</span>
            </button>
          </div>
        `;
      } else {
        actionButton = `
          <div class="appointment-actions">
            <span class="status-badge ${statusClass}">${appt.status_pagamento}</span>
          </div>
        `;
      }
    } else {
      let extraButtons = '';

      if (appt.status_pagamento === 'Concluído') {
        const servicesData = encodeURIComponent(JSON.stringify(appt.servicos_escolhidos || []));
        extraButtons += `<button class="btn-small btn-rebook" onclick="rebookAppointment('${servicesData}')">Agendar novamente</button>`;
      }

      actionButton = `
        <div class="appointment-actions">
          <span class="status-badge ${statusClass}">${appt.status_pagamento}</span>
          ${extraButtons}
        </div>
      `;
    }

    const cardHTML = `
      <div class="appointment-card">
        <div class="appointment-info">
          <h4>📅 ${dataFormatada}${horario}</h4>
          <p><strong>Serviços:</strong> ${servicesText}</p>
          <p><strong>Valor:</strong> ${formatCurrency(appt.valor_total)}</p>
          ${metaSection}
        </div>
        ${actionButton}
      </div>
    `;
    element.insertAdjacentHTML('beforeend', cardHTML);
  });
}

/**
 * Updates the statistics section of the portal.
 */
function updateStats() {
  if (!statsDiv) return;

  const totalAppointments = allAppointments.filter(
    (a) => a.status_pagamento === 'Concluído'
  ).length;

  const totalSpent = allAppointments
    .filter((a) => a.status_pagamento === 'Concluído')
    .reduce((sum, a) => sum + (Number(a.valor_total) || 0), 0);

  const nextAppointment = allAppointments
    .filter((appt) => {
      if (!appt.data_agendamento) return false;
      const apptDate = new Date(`${appt.data_agendamento}T00:00:00`);
      return apptDate >= new Date().setHours(0, 0, 0, 0) && !['Cancelado', 'Concluído'].includes(appt.status_pagamento);
    })
    .sort((a, b) => new Date(a.data_agendamento) - new Date(b.data_agendamento))[0];

  const nextDate = nextAppointment
    ? new Date(`${nextAppointment.data_agendamento}T00:00:00`).toLocaleDateString('pt-BR')
    : 'Nenhum';

  statsDiv.innerHTML = `
    <div class="stat-card">
      <h4>Serviços concluídos</h4>
      <p>${totalAppointments}</p>
    </div>
    <div class="stat-card">
      <h4>Valor investido</h4>
      <p>${formatCurrency(totalSpent)}</p>
    </div>
    <div class="stat-card">
      <h4>Próximo agendamento</h4>
      <p>${nextDate}</p>
    </div>
  `;
}
/**
 * Gets a CSS class based on the appointment status.
 * @param {string} status - The appointment status.
 * @returns {string} The corresponding CSS class.
 */
function getStatusClass(status) {
  switch (status) {
    case 'Pago e Confirmado':
    case 'Concluído':
      return 'status-success';
    case 'Pendente (Pagar no Local)':
    case 'Aguardando Execução':
      return 'status-pending';
    case 'Cancelado':
    case 'Reprovado':
      return 'status-danger';
    case 'Em Aprovação':
    case 'Aguardando Agendamento':
    case 'Aprovado':
      return 'status-info';
    default:
      return 'status-default';
  }
}

/**
 * Cancels an appointment. This function is exposed to the global window object.
 * @param {string} appointmentId - The ID of the appointment to cancel.
 * @param {HTMLElement} buttonEl - The button element that was clicked.
 */
window.cancelAppointment = async function cancelAppointment(appointmentId, buttonEl) {
  if (!confirm('Tem certeza que deseja cancelar este agendamento?')) return;

  const dismissLoading = showLoading('Cancelando seu agendamento...');

  try {
    const { error } = await supabase
      .from('agendamentos')
      .update({ status_pagamento: 'Cancelado' })
      .eq('id', appointmentId)
      .eq('cliente_id', currentUser.id);

    if (error) throw error;

    showPortalToast('Agendamento cancelado com sucesso.', 'success');
    await loadPortalData();
    showSuccess('Agendamento cancelado com sucesso.');
  } catch (error) {
    console.error('Erro ao cancelar agendamento:', error);
    showError('Não foi possível cancelar agora. Tente novamente.');
  } finally {
    dismissLoading();
  }
};
/**
 * Rebooks an appointment by creating a new budget with the same services.
 * This function is exposed to the global window object.
 * @param {string} servicesData - A JSON string of the services to rebook.
 */
window.rebookAppointment = function rebookAppointment(servicesData) {
  try {
    const decoded = JSON.parse(decodeURIComponent(servicesData));
    const sanitizedServices = Array.isArray(decoded)
      ? decoded.filter((service) => typeof service?.id === 'number')
      : [];
    const payload = {
      servicos: sanitizedServices,
      origem: 'rebook',
    };
    localStorage.setItem('apexCareOrcamento', JSON.stringify(payload));
    window.location.href = 'orcamento.html';
  } catch (error) {
    console.error('Erro ao reagendar:', error);
    showError('Não foi possível preparar um novo orçamento com esses serviços.');
  }
};

// --- RENDER INITIAL COMPONENTS ---
renderInfoSections();
initPortal();
