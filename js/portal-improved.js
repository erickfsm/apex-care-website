import { renderPortalPlanComparison } from './pricing-renderer.js';

// Adicionar em js/portal-improved.js (substituir função updateStats)

const SUPABASE_URL = 'https://xrajjehettusnbvjielf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhyYWpqZWhldHR1c25idmppZWxmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5NjE2NzMsImV4cCI6MjA3NTUzNzY3M30.LIl1PcGEA31y2TVYmA7zH7mnCPjot-s02LcQmu79e_U';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;
let allAppointments = [];

const userNameSpan = document.getElementById('user-name');
const statsDiv = document.getElementById('stats-container');
const upcomingAppointmentsDiv = document.getElementById('upcoming-appointments');
const pastAppointmentsDiv = document.getElementById('past-appointments');
const logoutBtn = document.getElementById('logout-btn');
const portalToast = document.getElementById('portal-status-toast');
const portalToastMessage = portalToast?.querySelector('.toast-message');
const portalToastIcon = portalToast?.querySelector('.toast-icon');
let toastTimeoutId = null;

if (portalToast) {
  const closeBtn = portalToast.querySelector('.toast-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', hidePortalToast);
  }
}

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

function hidePortalToast() {
  if (!portalToast) return;
  portalToast.classList.remove('visible');
  if (toastTimeoutId) {
    clearTimeout(toastTimeoutId);
    toastTimeoutId = null;
  }
}

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

function formatCurrency(value) {
  return `R$ ${(Number(value) || 0).toFixed(2).replace('.', ',')}`;
}

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

async function initPortal() {
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

  await loadPortalData();

  supabase.auth.onAuthStateChange(async (event) => {
    if (event === 'SIGNED_OUT') {
      window.location.href = 'login.html';
    }
  });
}

async function loadPortalData() {
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
      return;
    }

    allAppointments = appointments || [];
    separateAndRender();
    updateStats();
  } catch (error) {
    console.error('Erro ao carregar dados do portal:', error);
  }
}

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
}

window.cancelAppointment = async function cancelAppointment(appointmentId, buttonEl) {
  if (!confirm('Tem certeza que deseja cancelar este agendamento?')) return;

  const button = buttonEl || document.querySelector(`.btn-cancel[data-appointment-id="${appointmentId}"]`);
  setButtonLoadingState(button, true);

  try {
    const { error } = await supabase
      .from('agendamentos')
      .update({ status_pagamento: 'Cancelado' })
      .eq('id', appointmentId)
      .eq('cliente_id', currentUser.id);

    if (error) throw error;

    showPortalToast('Agendamento cancelado com sucesso.', 'success');
    await loadPortalData();
  } catch (error) {
    console.error('Erro ao cancelar agendamento:', error);
    showPortalToast('Não foi possível cancelar agora. Tente novamente.', 'error');
  } finally {
    setButtonLoadingState(button, false);
  }
};

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
    alert('Não foi possível preparar um novo orçamento com esses serviços.');
  }
};

renderPortalPlanComparison();
