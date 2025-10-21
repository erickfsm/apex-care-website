import { supabase } from './supabase-client.js';
/**
 * @fileoverview Manages the client portal, displaying appointments and statistics.
 * @module portal
 */
// --- GLOBAL STATE ---
/** @type {object|null} The current authenticated user object. */
let currentUser = null;
/** @type {Array<object>} A list of all appointments for the current user. */
let allAppointments = [];
/** @type {number} The current loyalty points balance for the user. */
let loyaltyPoints = 0;
// --- DOM ELEMENT REFERENCES ---
const userNameSpan = document.getElementById('user-name');
const upcomingAppointmentsDiv = document.getElementById('upcoming-appointments');
const pastAppointmentsDiv = document.getElementById('past-appointments');
const logoutBtn = document.getElementById('logout-btn');
const statsDiv = document.getElementById('stats-container');
/**
 * Initializes the client portal, authenticates the user, and loads data.
 */
async function initPortal() {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        window.location.href = 'login.html';
        return;
    }

    currentUser = user;
    await loadPortalData();
}
/**
 * Loads all portal data, including profile and appointments.
 */
async function loadPortalData() {
    try {
        // Load profile
        const { data: profile } = await supabase
            .from('profiles')
            .select('nome_completo, pontos_fidelidade')
            .eq('id', currentUser.id)
            .single();

        if (profile && userNameSpan) {
            userNameSpan.textContent = profile.nome_completo.split(' ')[0];
        }

        const rawPoints = profile ? profile.pontos_fidelidade : null;
        loyaltyPoints = Number(rawPoints) || 0;

        // Load appointments
        const { data: appointments, error } = await supabase
            .from('agendamentos')
            .select('*')
            .eq('cliente_id', currentUser.id)
            .order('data_agendamento', { ascending: false });

        if (error) {
            console.error("Erro ao buscar agendamentos:", error);
            return;
        }

        allAppointments = appointments || [];
        separateAndRender();
        updateStats();

    } catch (error) {
        console.error("Erro ao carregar dados:", error);
    }
}
/**
 * Separates appointments into upcoming and past, and renders them.
 */
function separateAndRender() {
    const today = new Date().setHours(0, 0, 0, 0);

    const upcoming = allAppointments.filter(appt =>
        appt.data_agendamento &&
        new Date(appt.data_agendamento) >= today &&
        appt.status_pagamento !== 'Cancelado'
    );

    const past = allAppointments.filter(appt =>
        !appt.data_agendamento ||
        new Date(appt.data_agendamento) < today ||
        appt.status_pagamento === 'Cancelado'
    );

    renderAppointments(upcoming, upcomingAppointmentsDiv, true);
    renderAppointments(past, pastAppointmentsDiv, false);
}
/**
 * Renders a list of appointments in a given element.
 * @param {Array<object>} appointments - The list of appointments to render.
 * @param {HTMLElement} element - The element to render the appointments in.
 * @param {boolean} isUpcoming - Whether the appointments are upcoming or past.
 */
function renderAppointments(appointments, element, isUpcoming) {
    if (!element) return;

    if (appointments.length === 0) {
        element.innerHTML = '<p style="text-align: center; color: #999; padding: 30px;">Nenhum serviço encontrado.</p>';
        return;
    }

    element.innerHTML = '';
    appointments.forEach(appt => {
        const servicesText = appt.servicos_escolhidos
            .map(s => `${s.name} ${s.quantity > 1 ? `(x${s.quantity})` : ''}`)
            .join(', ');

        const dataFormatada = appt.data_agendamento
            ? new Date(appt.data_agendamento).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
            : 'Data a definir';

        let actionButton = '';
        let statusClass = getStatusClass(appt.status_pagamento);

        if (isUpcoming) {
            actionButton = `
                <div class="appointment-actions">
                    <span class="status-badge ${statusClass}">${appt.status_pagamento}</span>
                    <button class="btn-small btn-cancel" onclick="portalFunctions.cancelAppointment('${appt.id}')">Cancelar</button>
                </div>
            `;
        } else {
            let extraButtons = '';
            if (appt.status_pagamento === 'Concluído' || appt.status_pagamento === 'Pago e Confirmado') {
                const servicesData = encodeURIComponent(JSON.stringify(appt.servicos_escolhidos));
                extraButtons = `<button class="btn-small btn-rebook" onclick="portalFunctions.rebookAppointment('${servicesData}')">Agendar Novamente</button>`;
            }
            if (appt.status_pagamento === 'Pendente' || appt.status_pagamento === 'Pendente (Pagar no Local)') {
                extraButtons += `<button class="btn-small btn-pay" onclick="portalFunctions.payAppointment('${appt.id}')">Pagar Agora</button>`;
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
                    <h4>📅 ${dataFormatada} ${appt.hora_agendamento ? `às ${appt.hora_agendamento}` : ''}</h4>
                    <p><strong>Serviços:</strong> ${servicesText}</p>
                    <p><strong>Valor:</strong> R$ ${appt.valor_total.toFixed(2).replace('.', ',')}</p>
                </div>
                ${actionButton}
            </div>
        `;
        element.innerHTML += cardHTML;
    });
}
/**
 * Gets a CSS class based on the appointment status.
 * @param {string} status - The appointment status.
 * @returns {string} The corresponding CSS class.
 */
function getStatusClass(status) {
    const statusMap = {
        'Pendente': 'status-pendente',
        'Pendente (Pagar no Local)': 'status-pendente',
        'Pago': 'status-pago',
        'Pago e Confirmado': 'status-confirmado',
        'Cancelado': 'status-cancelado',
        'Concluído': 'status-concluido'
    };
    return statusMap[status] || 'status-pendente';
}
/**
 * Updates the statistics section of the portal.
 */
function updateStats() {
    if (!statsDiv) return;

    const upcoming = allAppointments.filter(appt =>
        appt.data_agendamento &&
        new Date(appt.data_agendamento) >= new Date().setHours(0, 0, 0, 0) &&
        appt.status_pagamento !== 'Cancelado'
    ).length;

    const totalValue = allAppointments
        .filter(appt => appt.status_pagamento !== 'Cancelado')
        .reduce((sum, appt) => sum + appt.valor_total, 0);

    const completed = allAppointments.filter(appt =>
        appt.status_pagamento === 'Concluído'
    ).length;

    statsDiv.innerHTML = `
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-icon">🎁</div>
                <div class="stat-value">${formatLoyaltyPoints(loyaltyPoints)} pts</div>
                <div class="stat-label">Pontos de fidelidade disponíveis</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">📅</div>
                <div class="stat-value">${upcoming}</div>
                <div class="stat-label">Próximos Agendamentos</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">✅</div>
                <div class="stat-value">${completed}</div>
                <div class="stat-label">Serviços Concluídos</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">💰</div>
                <div class="stat-value">R$ ${totalValue.toFixed(2).replace('.', ',')}</div>
                <div class="stat-label">Total Investido</div>
            </div>
        </div>
    `;
}

/**
 * Formats loyalty points using Brazilian number formatting.
 * @param {number} value - Points to format.
 * @returns {string} Formatted points string.
 */
function formatLoyaltyPoints(value) {
    const numericValue = Number(value);

    if (!Number.isFinite(numericValue)) {
        return '0';
    }

    const hasDecimals = Math.abs(numericValue % 1) > 0;

    return new Intl.NumberFormat('pt-BR', {
        minimumFractionDigits: hasDecimals ? 2 : 0,
        maximumFractionDigits: hasDecimals ? 2 : 0,
    }).format(Math.max(numericValue, 0));
}
/**
 * Cancels an appointment.
 * @param {string} appointmentId - The ID of the appointment to cancel.
 */
async function cancelAppointment(appointmentId) {
    if (!confirm('Tem certeza que deseja cancelar este agendamento?')) return;

    try {
        const { error } = await supabase
            .from('agendamentos')
            .update({ status_pagamento: 'Cancelado' })
            .eq('id', appointmentId);

        if (error) throw error;

        alert('Agendamento cancelado com sucesso.');
        await loadPortalData();
    } catch (error) {
        alert('Erro ao cancelar: ' + error.message);
    }
}
/**
 * Rebooks an appointment by creating a new budget with the same services.
 * @param {string} servicesDataString - A JSON string of the services to rebook.
 */
function rebookAppointment(servicesDataString) {
    const servicesToRebook = JSON.parse(decodeURIComponent(servicesDataString));
    const orcamentoData = {
        servicos: servicesToRebook,
        valor_total: servicesToRebook.reduce((total, service) =>
            total + (service.price * service.quantity), 0
        )
    };

    localStorage.setItem('apexCareOrcamento', JSON.stringify(orcamentoData));
    window.location.href = 'orcamento.html';
}
/**
 * Redirects the user to the payment page for a specific appointment.
 * @param {string} appointmentId - The ID of the appointment to pay for.
 */
function payAppointment(appointmentId) {
    alert('Redirecionando para pagamento...');
    // Implement payment flow
    window.location.href = `agendamento.html?appointmentId=${appointmentId}&action=pay`;
}

// --- EVENT LISTENERS ---
if (logoutBtn) {
    logoutBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        await supabase.auth.signOut();
        window.location.href = 'index.html';
    });
}

// --- INITIALIZE PORTAL ---
initPortal();

// --- EXPORT FUNCTIONS GLOBALLY ---
window.portalFunctions = {
    cancelAppointment,
    rebookAppointment,
    payAppointment,
    loadPortalData
};
