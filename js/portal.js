import { supabase } from './supabase-client.js';

// Estado global
let currentUser = null;
let allAppointments = [];

const userNameSpan = document.getElementById('user-name');
const upcomingAppointmentsDiv = document.getElementById('upcoming-appointments');
const pastAppointmentsDiv = document.getElementById('past-appointments');
const logoutBtn = document.getElementById('logout-btn');
const statsDiv = document.getElementById('stats-container');

// Inicialização
async function initPortal() {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
        window.location.href = 'login.html';
        return;
    }

    currentUser = user;
    await loadPortalData();
}

async function loadPortalData() {
    try {
        // Carregar perfil
        const { data: profile } = await supabase
            .from('profiles')
            .select('nome_completo')
            .eq('id', currentUser.id)
            .single();

        if (profile && userNameSpan) {
            userNameSpan.textContent = profile.nome_completo.split(' ')[0];
        }

        // Carregar agendamentos
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
                    <button class="btn-small btn-cancel" onclick="cancelAppointment('${appt.id}')">Cancelar</button>
                </div>
            `;
        } else {
            let extraButtons = '';
            if (appt.status_pagamento === 'Concluído' || appt.status_pagamento === 'Pago e Confirmado') {
                const servicesData = encodeURIComponent(JSON.stringify(appt.servicos_escolhidos));
                extraButtons = `<button class="btn-small btn-rebook" onclick="rebookAppointment('${servicesData}')">Agendar Novamente</button>`;
            }
            if (appt.status_pagamento === 'Pendente' || appt.status_pagamento === 'Pendente (Pagar no Local)') {
                extraButtons += `<button class="btn-small btn-pay" onclick="payAppointment('${appt.id}')">Pagar Agora</button>`;
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

// Funções de ações
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

function payAppointment(appointmentId) {
    alert('Redirecionando para pagamento...');
    // Implementar fluxo de pagamento
    window.location.href = `agendamento.html?appointmentId=${appointmentId}&action=pay`;
}

// Event Listeners
if (logoutBtn) {
    logoutBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        await supabase.auth.signOut();
        window.location.href = 'index.html';
    });
}

// Iniciar portal
initPortal();

// Exportar funções globalmente
window.portalFunctions = {
    cancelAppointment,
    rebookAppointment,
    payAppointment,
    loadPortalData
};