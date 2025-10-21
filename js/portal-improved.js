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
const appointmentModal = document.getElementById('appointment-details-modal');
const appointmentModalBody = document.getElementById('appointment-modal-body');
const appointmentModalTitle = document.getElementById('appointment-modal-title');
const appointmentModalCloseButton = document.getElementById('appointment-modal-close');
const appointmentModalCloseIcon = document.getElementById('appointment-modal-close-icon');
/** @type {number|null} Timeout ID for the portal toast. */
let toastTimeoutId = null;
/** @type {((event: KeyboardEvent) => void)|null} */
let modalEscapeHandler = null;

// --- INITIALIZATION ---
if (portalToast) {
  const closeBtn = portalToast.querySelector('.toast-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', hidePortalToast);
  }
}

if (appointmentModal) {
  const closeModal = () => {
    closeAppointmentDetails();
  };

  appointmentModal.addEventListener('click', (event) => {
    if (event.target === appointmentModal) {
      closeModal();
    }
  });

  if (appointmentModalCloseButton) {
    appointmentModalCloseButton.addEventListener('click', closeModal);
  }

  if (appointmentModalCloseIcon) {
    appointmentModalCloseIcon.addEventListener('click', closeModal);
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
    const servicesList = Array.isArray(appt.servicos_escolhidos)
      ? appt.servicos_escolhidos
          .filter((service) => service?.name)
          .map((service) => {
            const quantity = service.quantity && service.quantity > 1 ? ` (x${service.quantity})` : '';
            return `${escapeHtml(service.name)}${quantity}`;
          })
      : [];

    const servicesText = servicesList.length ? servicesList.join(', ') : 'Serviços não informados';

    const dataFormatada = appt.data_agendamento
      ? new Date(`${appt.data_agendamento}T00:00:00`).toLocaleDateString('pt-BR')
      : 'A definir';

    const horarioTexto = appt.hora_agendamento ? ` às ${escapeHtml(appt.hora_agendamento)}` : '';
    const statusClass = getStatusClass(appt.status_pagamento);
    const statusLabel = escapeHtml(appt.status_pagamento || 'Status não informado');
    const detailButton = `<button class="btn-small btn-details" data-appointment-id="${appt.id}" onclick="openAppointmentDetails('${appt.id}')">Ver detalhes</button>`;

    const actions = [`<span class="status-badge ${statusClass}">${statusLabel}</span>`, detailButton];

    if (isUpcoming) {
      const canCancel = ['Pendente (Pagar no Local)', 'Pago e Confirmado', 'Aguardando Execução'].includes(
        appt.status_pagamento
      );
      if (canCancel) {
        actions.push(`
          <button class="btn-small btn-cancel" data-appointment-id="${appt.id}" onclick="cancelAppointment('${appt.id}', this)">
            <span class="spinner" aria-hidden="true"></span>
            <span class="btn-label">Cancelar</span>
          </button>
        `);
      }
    } else if (appt.status_pagamento === 'Concluído') {
      const servicesData = encodeURIComponent(JSON.stringify(appt.servicos_escolhidos || []));
      actions.push(`<button class="btn-small btn-rebook" onclick="rebookAppointment('${servicesData}')">Agendar novamente</button>`);
    }

    const actionSection = `<div class="appointment-actions">${actions.join('')}</div>`;

    const cardHTML = `
      <div class="appointment-card">
        <div class="appointment-info">
          <h4>📅 ${dataFormatada}${horarioTexto}</h4>
          <p><strong>Serviços:</strong> ${servicesText}</p>
          <p><strong>Valor:</strong> ${formatCurrency(appt.valor_total)}</p>
        </div>
        ${actionSection}
      </div>
    `;
    element.insertAdjacentHTML('beforeend', cardHTML);
  });
}

/**
 * Builds the HTML markup for the appointment details modal.
 * @param {object} appointment - The appointment data.
 * @returns {string} The HTML markup for the modal body.
 */
function buildAppointmentDetailsMarkup(appointment) {
  const dataFormatada = appointment.data_agendamento
    ? new Date(`${appointment.data_agendamento}T00:00:00`).toLocaleDateString('pt-BR')
    : 'A definir';
  const horarioTexto = appointment.hora_agendamento
    ? ` às ${escapeHtml(appointment.hora_agendamento)}`
    : '';
  const statusLabel = escapeHtml(appointment.status_pagamento || 'Status não informado');

  const generalItems = [
    `<li><strong>Status:</strong> ${statusLabel}</li>`,
    `<li><strong>Data:</strong> ${dataFormatada}${horarioTexto}</li>`,
    `<li><strong>Valor total:</strong> ${formatCurrency(appointment.valor_total)}</li>`,
  ];

  const descontoAplicado = Number(appointment.desconto_aplicado);
  if (!Number.isNaN(descontoAplicado) && descontoAplicado > 0) {
    generalItems.push(
      `<li><strong>Desconto aplicado:</strong> ${formatCurrency(-Math.abs(descontoAplicado))}</li>`
    );
  }

  const servicesList = Array.isArray(appointment.servicos_escolhidos)
    ? appointment.servicos_escolhidos
        .filter((service) => service?.name)
        .map((service) => {
          const quantity = service.quantity && service.quantity > 1 ? ` (x${service.quantity})` : '';
          return `${escapeHtml(service.name)}${quantity}`;
        })
    : [];

  const servicesSectionContent = servicesList.length
    ? `<ul class="appointment-details-list">${servicesList.map((item) => `<li>${item}</li>`).join('')}</ul>`
    : '<p class="appointment-details-empty">Nenhum serviço informado.</p>';

  const additionalItems = [];
  const distanciaValue = Number(appointment.distancia_km);
  if (Number.isFinite(distanciaValue) && distanciaValue > 0) {
    additionalItems.push(
      `<li><strong>Distância estimada:</strong> ${distanciaValue.toFixed(1).replace('.', ',')} km</li>`
    );
  }

  const taxaDeslocamento = Number(appointment.taxa_deslocamento);
  if (!Number.isNaN(taxaDeslocamento) && taxaDeslocamento !== 0) {
    additionalItems.push(
      `<li><strong>Taxa de deslocamento:</strong> ${formatCurrency(taxaDeslocamento)}</li>`
    );
  }

  const adicionaisCondicoes = Number(appointment.adicionais_condicoes);
  if (!Number.isNaN(adicionaisCondicoes) && adicionaisCondicoes !== 0) {
    additionalItems.push(
      `<li><strong>Adicionais por condições:</strong> ${formatCurrency(adicionaisCondicoes)}</li>`
    );
  }

  const additionalSection = additionalItems.length
    ? `<div class="appointment-details-section">
        <h4>Adicionais</h4>
        <ul class="appointment-details-list">${additionalItems.join('')}</ul>
      </div>`
    : '';

  const condicoesLabels = Array.isArray(appointment.condicoes_extremas?.selections)
    ? appointment.condicoes_extremas.selections
        .map((item) => item?.label || item?.id)
        .filter(Boolean)
    : [];

  const condicoesSection = condicoesLabels.length
    ? `<div class="appointment-details-section">
        <h4>Condições especiais</h4>
        <div class="appointment-details-tags">
          ${condicoesLabels
            .map((label) => `<span class="appointment-details-tag">${escapeHtml(label)}</span>`)
            .join('')}
        </div>
      </div>`
    : '';

  const observacoesText = appointment.observacoes?.trim();
  const observacoesSection = observacoesText
    ? `<div class="appointment-details-section">
        <h4>Notas do cliente</h4>
        <p>${escapeHtml(observacoesText).replace(/\n/g, '<br>')}</p>
      </div>`
    : '';

  return `
    <div class="appointment-details-section">
      <h4>Resumo geral</h4>
      <ul class="appointment-details-list">${generalItems.join('')}</ul>
    </div>
    <div class="appointment-details-section">
      <h4>Serviços selecionados</h4>
      ${servicesSectionContent}
    </div>
    ${additionalSection}
    ${condicoesSection}
    ${observacoesSection}
  `;
}

/**
 * Opens the appointment details modal with the provided appointment data.
 * This function is exposed to the global window object.
 * @param {string|number} appointmentId - The identifier of the appointment to display.
 */
function openAppointmentDetails(appointmentId) {
  if (!appointmentModal || !appointmentModalBody || !appointmentModalTitle) {
    return;
  }

  const normalizedId = decodeURIComponent(String(appointmentId));
  const appointment = allAppointments.find((item) => String(item.id) === normalizedId);

  if (!appointment) {
    showPortalToast('Não foi possível localizar os detalhes deste agendamento.', 'error');
    return;
  }

  appointmentModalTitle.textContent = `Agendamento #${appointment.id}`;
  appointmentModalBody.innerHTML = buildAppointmentDetailsMarkup(appointment);
  appointmentModal.classList.add('active');
  appointmentModal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');

  if (modalEscapeHandler) {
    document.removeEventListener('keydown', modalEscapeHandler);
  }

  modalEscapeHandler = (event) => {
    if (event.key === 'Escape') {
      closeAppointmentDetails();
    }
  };

  document.addEventListener('keydown', modalEscapeHandler);
}

/**
 * Closes the appointment details modal.
 */
function closeAppointmentDetails() {
  if (!appointmentModal) return;

  appointmentModal.classList.remove('active');
  appointmentModal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('modal-open');

  if (appointmentModalBody) {
    appointmentModalBody.innerHTML = '';
  }

  if (appointmentModalTitle) {
    appointmentModalTitle.textContent = 'Detalhes do agendamento';
  }

  if (modalEscapeHandler) {
    document.removeEventListener('keydown', modalEscapeHandler);
    modalEscapeHandler = null;
  }
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
window.openAppointmentDetails = openAppointmentDetails;

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
renderPortalPlanComparison();
initPortal();
