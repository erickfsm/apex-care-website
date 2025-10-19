import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'https://xrajjehettusnbvjielf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhyYWpqZWhldHR1c25idmppZWxmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5NjE2NzMsImV4cCI6MjA3NTUzNjM30.LIl1PcGEA31y2TVYmA7zH7mnCPjot-s02LcQmu79e_U';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;
let allAppointments = [];

const userNameSpan = document.getElementById('user-name');
const upcomingAppointmentsDiv = document.getElementById('upcoming-appointments');
const pastAppointmentsDiv = document.getElementById('past-appointments');
const logoutBtn = document.getElementById('logout-btn');
const statsDiv = document.getElementById('stats-container');

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
    if (!currentUser) return;

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
            .order('data_agendamento', { ascending: false });

        if (error) {
            console.error('Erro ao buscar agendamentos:', error);
            return;
        }

        allAppointments = Array.isArray(appointments) ? appointments : [];
        separateAndRender();
        updateStats();
    } catch (error) {
        console.error('Erro ao carregar dados:', error);
    }
}

function separateAndRender() {
    const today = new Date().setHours(0, 0, 0, 0);

    const upcoming = allAppointments.filter((appt) => {
        if (!appt?.data_agendamento) return false;
        const apptDate = new Date(`${appt.data_agendamento}T00:00:00`);
        return apptDate >= today && appt.status_pagamento !== 'Cancelado';
    });

    const past = allAppointments.filter((appt) => {
        if (!appt?.data_agendamento) return true;
        const apptDate = new Date(`${appt.data_agendamento}T00:00:00`);
        return apptDate < today || appt.status_pagamento === 'Cancelado';
    });

    renderAppointments(upcoming, upcomingAppointmentsDiv, true);
    renderAppointments(past, pastAppointmentsDiv, false);
}

function renderAppointments(appointments, element, isUpcoming) {
    if (!element) return;

    if (!Array.isArray(appointments) || appointments.length === 0) {
        element.innerHTML = '<p style="text-align: center; color: #999; padding: 30px;">Nenhum serviço encontrado.</p>';
        return;
    }

    element.innerHTML = '';

    appointments.forEach((appt) => {
        const services = Array.isArray(appt?.servicos_escolhidos) ? appt.servicos_escolhidos : [];
        const servicesText = services
            .map((service) => {
                const quantity = service.quantity && service.quantity > 1 ? ` (x${service.quantity})` : '';
                return `${service.name || 'Serviço'}${quantity}`;
            })
            .join(', ');

        const dataFormatada = appt?.data_agendamento
            ? new Date(`${appt.data_agendamento}T00:00:00`).toLocaleDateString('pt-BR')
            : 'Data a definir';

        const hora = appt?.hora_agendamento ? `às ${appt.hora_agendamento}` : '';
        const valorTotal = Number(appt?.valor_total) || 0;

        let actionButton = '';
        const statusClass = getStatusClass(appt?.status_pagamento);

        if (isUpcoming) {
            actionButton = `
                <div class="appointment-actions">
                    <span class="status-badge ${statusClass}">${appt?.status_pagamento || 'Pendente'}</span>
                    <button class="btn-small btn-cancel" onclick="cancelAppointment('${appt?.id}')">Cancelar</button>
                </div>
            `;
        } else {
            let extraButtons = '';

            if (appt?.status_pagamento === 'Concluído' || appt?.status_pagamento === 'Pago e Confirmado') {
                const servicesData = encodeURIComponent(JSON.stringify(services));
                extraButtons += `<button class="btn-small btn-rebook" onclick="rebookAppointment('${servicesData}')">Agendar Novamente</button>`;
            }

            if (appt?.status_pagamento === 'Pendente' || appt?.status_pagamento === 'Pendente (Pagar no Local)') {
                extraButtons += `<button class="btn-small btn-pay" onclick="payAppointment('${appt?.id}')">Pagar Agora</button>`;
            }

            actionButton = `
                <div class="appointment-actions">
                    <span class="status-badge ${statusClass}">${appt?.status_pagamento || 'Pendente'}</span>
                    ${extraButtons}
                </div>
            `;
        }

        const cardHTML = `
            <div class="appointment-card">
                <div class="appointment-info">
                    <h4>📅 ${dataFormatada} ${hora}</h4>
                    <p><strong>Serviços:</strong> ${servicesText || 'Não informado'}</p>
                    <p><strong>Valor:</strong> R$ ${valorTotal.toFixed(2).replace('.', ',')}</p>
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

    const today = new Date().setHours(0, 0, 0, 0);

    const upcoming = allAppointments.filter(appt =>
        appt?.data_agendamento &&
        new Date(`${appt.data_agendamento}T00:00:00`) >= today &&
        appt?.status_pagamento !== 'Cancelado'
    ).length;

    const completed = allAppointments.filter(appt =>
        appt?.status_pagamento === 'Concluído'
    ).length;

    const economiaTotalPromo = allAppointments
        .filter(appt => appt?.status_pagamento !== 'Cancelado' && appt?.desconto_aplicado)
        .reduce((sum, appt) => sum + (Number(appt?.desconto_aplicado) || 0), 0);

    const pontosFidelidade = completed * 10;

    const ultimoServico = allAppointments
        .filter(appt => appt?.status_pagamento === 'Concluído' && appt?.data_agendamento)
        .sort((a, b) => new Date(`${b.data_agendamento}T00:00:00`) - new Date(`${a.data_agendamento}T00:00:00`))[0];

    let diasDesdeUltimo = 'N/A';
    if (ultimoServico) {
        const dataUltimo = new Date(`${ultimoServico.data_agendamento}T00:00:00`);
        const diffTime = Date.now() - dataUltimo.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        diasDesdeUltimo = diffDays;
    }

    const planoAtivo = allAppointments.some(appt =>
        appt?.plano_id && appt?.status_pagamento !== 'Cancelado'
    );

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
            <div class="stat-card" style="background: linear-gradient(135deg, #4caf50 0%, #388e3c 100%); color: white;">
                <div class="stat-icon">💰</div>
                <div class="stat-value" style="color: white;">R$ ${economiaTotalPromo.toFixed(2).replace('.', ',')}</div>
                <div class="stat-label" style="color: rgba(255,255,255,0.9);">Economia em Promoções</div>
            </div>
            <div class="stat-card" style="background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%); color: white;">
                <div class="stat-icon">⭐</div>
                <div class="stat-value" style="color: white;">${pontosFidelidade}</div>
                <div class="stat-label" style="color: rgba(255,255,255,0.9);">Pontos Apex Club</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">📆</div>
                <div class="stat-value">${diasDesdeUltimo}</div>
                <div class="stat-label">${diasDesdeUltimo === 'N/A' ? 'Sem Histórico' : 'Dias Desde Último Serviço'}</div>
            </div>
            <div class="stat-card" ${planoAtivo ? 'style="border: 2px solid var(--color-cyan);"' : ''}>
                <div class="stat-icon">${planoAtivo ? '🛡️' : '💳'}</div>
                <div class="stat-value">${planoAtivo ? 'ATIVO' : 'NENHUM'}</div>
                <div class="stat-label">Plano de Cuidado</div>
            </div>
        </div>
        ${diasDesdeUltimo > 90 && diasDesdeUltimo !== 'N/A' ? `
            <div class="alert-box" style="
                background-color: #fff3cd;
                border-left: 4px solid #ffc107;
                padding: 20px;
                border-radius: 8px;
                margin-top: 20px;
                display: flex;
                align-items: center;
                gap: 15px;
            ">
                <span style="font-size: 2em;">⏰</span>
                <div>
                    <strong>Hora de cuidar novamente!</strong>
                    <p style="margin: 5px 0 0 0; color: #666;">
                        Já faz ${diasDesdeUltimo} dias desde seu último serviço.
                        Recomendamos higienização a cada 3-6 meses para manter seus estofados sempre novos.
                    </p>
                </div>
                <a href="orcamento.html" class="btn" style="
                    background-color: var(--color-cyan);
                    color: white;
                    padding: 10px 20px;
                    border-radius: 5px;
                    text-decoration: none;
                    white-space: nowrap;
                ">Agendar Agora</a>
            </div>
        ` : ''}
        ${!planoAtivo && completed >= 2 ? `
            <div class="alert-box" style="
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 20px;
                border-radius: 8px;
                margin-top: 20px;
                display: flex;
                align-items: center;
                gap: 15px;
            ">
                <span style="font-size: 2em;">🎁</span>
                <div>
                    <strong>Economize com um Plano de Cuidado!</strong>
                    <p style="margin: 5px 0 0 0; opacity: 0.95;">
                        Você já fez ${completed} serviços. Com um plano, você economiza até 15% + descontos exclusivos!
                    </p>
                </div>
                <a href="#planos" class="btn" style="
                    background-color: white;
                    color: #667eea;
                    padding: 10px 20px;
                    border-radius: 5px;
                    text-decoration: none;
                    white-space: nowrap;
                    font-weight: 700;
                ">Ver Planos</a>
            </div>
        ` : ''}
    `;
}

async function cancelAppointment(appointmentId) {
    if (!appointmentId) return;
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
    if (!servicesDataString) return;

    try {
        const servicesToRebook = JSON.parse(decodeURIComponent(servicesDataString));
        const valor_total = Array.isArray(servicesToRebook)
            ? servicesToRebook.reduce((total, service) => {
                const price = Number(service.price) || 0;
                const quantity = Number(service.quantity) || 1;
                return total + price * quantity;
            }, 0)
            : 0;

        const orcamentoData = {
            servicos: servicesToRebook,
            valor_total
        };

        localStorage.setItem('apexCareOrcamento', JSON.stringify(orcamentoData));
        window.location.href = 'orcamento.html';
    } catch (error) {
        console.error('Erro ao reagendar:', error);
    }
}

function payAppointment(appointmentId) {
    if (!appointmentId) return;
    alert('Redirecionando para pagamento...');
    window.location.href = `agendamento.html?appointmentId=${appointmentId}&action=pay`;
}

if (logoutBtn) {
    logoutBtn.addEventListener('click', async (event) => {
        event.preventDefault();
        await supabase.auth.signOut();
        window.location.href = 'index.html';
    });
}

initPortal();

window.cancelAppointment = cancelAppointment;
window.rebookAppointment = rebookAppointment;
window.payAppointment = payAppointment;
window.portalFunctions = {
    cancelAppointment,
    rebookAppointment,
    payAppointment,
    loadPortalData
};
