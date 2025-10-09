import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// Configura a conexão (COLE SUAS CHAVES AQUI)
const SUPABASE_URL = 'SEU_URL_AQUI';
const SUPABASE_ANON_KEY = 'SUA_CHAVE_ANON_AQUI';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Elementos do DOM
const userNameSpan = document.getElementById('user-name');
const upcomingAppointmentsDiv = document.getElementById('upcoming-appointments');
const pastAppointmentsDiv = document.getElementById('past-appointments');

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
        const servicesText = appt.servicos_escolhidos.map(s => s.name).join(', ');
        const cardHTML = `
            <div class="appointment-card">
                <div>
                    <h4>${new Date(appt.data_agendamento).toLocaleDateString('pt-BR', { timeZone: 'UTC' })} às ${appt.hora_agendamento}</h4>
                    <p>${servicesText} - R$ ${appt.valor_total.toFixed(2)}</p>
                </div>
                ${isUpcoming ? `<button class="cancel-btn" data-id="${appt.id}">Cancelar</button>` : `<span>${appt.status_pagamento}</span>`}
            </div>
        `;
        element.innerHTML += cardHTML;
    });
}

// LÓGICA DE CANCELAMENTO
document.body.addEventListener('click', async (e) => {
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
});


// Inicializa a página
loadPortalData();