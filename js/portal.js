import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// Configura a conexão (COLE SUAS CHAVES AQUI)
const SUPABASE_URL = 'https://xrajjehettusnbvjielf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhyYWpqZWhldHR1c25idmppZWxmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5NjE2NzMsImV4cCI6MjA3NTUzNzY3M30.LIl1PcGEA31y2TVYmA7zH7mnCPjot-s02LcQmu79e_U';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Elementos do DOM
const userNameSpan = document.getElementById('user-name');
const upcomingAppointmentsDiv = document.getElementById('upcoming-appointments');
const pastAppointmentsDiv = document.getElementById('past-appointments');
const logoutBtn = document.getElementById('logout-btn');

async function loadPortalData() {
    // 1. Verifica a sessão do usuário
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        window.location.href = 'login.html';
        return;
    }

    // 2. Busca o nome do perfil do usuário
    const { data: profile } = await supabase.from('profiles').select('nome_completo').eq('id', user.id).single();
    if (profile) {
        userNameSpan.textContent = profile.nome_completo.split(' ')[0]; // Mostra só o primeiro nome
    }

    // 3. Busca TODOS os agendamentos do usuário
    const { data: appointments, error } = await supabase
        .from('agendamentos')
        .select('*')
        .eq('cliente_id', user.id)
        .order('data_agendamento', { ascending: false }); // Do mais recente para o mais antigo

    if (error) {
        console.error("Erro ao buscar agendamentos:", error);
        return;
    }

    // 4. Separa os agendamentos em futuros e passados
    const today = new Date().setHours(0,0,0,0);
    const upcoming = appointments.filter(appt => new Date(appt.data_agendamento) >= today && appt.status_pagamento !== 'Cancelado');
    const past = appointments.filter(appt => new Date(appt.data_agendamento) < today || appt.status_pagamento === 'Cancelado');

    renderAppointments(upcoming, upcomingAppointmentsDiv, true);
    renderAppointments(past, pastAppointmentsDiv, false);
}

function renderAppointments(appointments, element, isUpcoming) {
    if (appointments.length === 0) {
        element.innerHTML = '<p>Nenhum serviço encontrado.</p>';
        return;
    }

    element.innerHTML = '';
    appointments.forEach(appt => {
        const servicesText = appt.servicos_escolhidos.map(s => `${s.name} (x${s.quantity})`).join(', ');
        
        let actionButton = `<span class="status-${appt.status_pagamento?.toLowerCase().replace(' ', '-')}">${appt.status_pagamento}</span>`;
        
        if (isUpcoming) {
            actionButton = `<button class="cancel-btn" data-id="${appt.id}">Cancelar</button>`;
        } else if (appt.status_pagamento === 'Concluído' || appt.status_pagamento === 'Pago e Confirmado') {
             // Botão "Agendar Novamente" só aparece para serviços concluídos
             const servicesData = encodeURIComponent(JSON.stringify(appt.servicos_escolhidos));
             actionButton = `<button class="rebook-btn" data-services="${servicesData}">Agendar Novamente</button>`;
        }

        const cardHTML = `
            <div class="appointment-card">
                <div>
                    <h4>${appt.data_agendamento ? new Date(appt.data_agendamento).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : 'Data a definir'} às ${appt.hora_agendamento || ''}</h4>
                    <p>${servicesText} - R$ ${appt.valor_total.toFixed(2)}</p>
                </div>
                <div>${actionButton}</div>
            </div>
        `;
        element.innerHTML += cardHTML;
    });
}

// --- LÓGICAS DOS BOTÕES ---

document.body.addEventListener('click', async (e) => {
     // Lógica de Cancelamento
    if (e.target.classList.contains('cancel-btn')) {
        const appointmentId = e.target.dataset.id;
        
        const isSure = confirm("Tem certeza que deseja cancelar este agendamento?");
        if (!isSure) return;

        e.target.disabled = true;
        e.target.textContent = 'Cancelando...';

        const { error } = await supabase
            .from('agendamentos')
            .update({ status_pagamento: 'Cancelado' }) // Atualiza o status
            .eq('id', appointmentId);

        if (error) {
            alert("Erro ao cancelar. Por favor, tente novamente.");
            console.error(error);
        } else {
            alert("Agendamento cancelado com sucesso.");
            loadPortalData(); // Recarrega os dados para atualizar a tela
        }
    }
    // NOVA LÓGICA: AGENDAR NOVAMENTE
    if (e.target.classList.contains('rebook-btn')) {
        const servicesDataString = e.target.dataset.services;
        if (!servicesDataString) return;

        const servicesToRebook = JSON.parse(decodeURIComponent(servicesDataString));
        
        // Simula a estrutura do 'orcamentoData' que a outra página espera
        const orcamentoData = {
            servicos: servicesToRebook,
            valor_total: servicesToRebook.reduce((total, service) => total + (service.price * service.quantity), 0)
        };

        // Salva na memória e redireciona para a calculadora
        localStorage.setItem('apexCareOrcamento', JSON.stringify(orcamentoData));
        window.location.href = 'orcamento.html';
    }
});

// Inicializa a página
loadPortalData();