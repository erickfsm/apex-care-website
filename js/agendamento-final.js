import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'https://xrajjehettusnbvjielf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhyYWpqZWhldHR1c25idmppZWxmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5NjE2NzMsImV4cCI6MjA3NTUzNzY3M30.LIl1PcGEA31y2TVYmA7zH7mnCPjot-s02LcQmu79e_U';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const WORKING_HOURS = ["09:00", "11:00", "14:00", "16:00"];

let currentUser = null;
let pendingAppointment = null;
let selectedDate = null;
let selectedTime = null;
let currentDate = new Date();

const calendarDays = document.getElementById('calendar-days');
const timeSlotsDiv = document.getElementById('time-slots');
const payOnSiteBtn = document.getElementById('pay-on-site-btn');
const payOnlineBtn = document.getElementById('pay-online-btn');
const summaryText = document.getElementById('summary-text');
const currentMonthDisplay = document.getElementById('current-month');

// Fica "ouvindo" o estado da autenticação
supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'INITIAL_SESSION' && session?.user) {
        console.log("✅ Sessão válida encontrada!", session.user.email);
        currentUser = session.user;
        findPendingAppointment();
    } else if (event === 'SIGNED_IN') {
        console.log("✅ Usuário acabou de logar!", session.user.email);
        currentUser = session.user;
        findPendingAppointment();
    } else if (event === 'SIGNED_OUT') {
        redirectToLogin();
    }
});

setTimeout(() => {
    if (!currentUser) {
        console.warn("⚠️ Sessão não encontrada após timeout");
        redirectToLogin();
    }
}, 2000);

function redirectToLogin() {
    alert("Sessão não encontrada ou expirada. Por favor, faça o login.");
    window.location.href = 'login.html';
}

async function findPendingAppointment() {
    if (!currentUser) return;

    console.log("🔍 Procurando agendamento pendente para usuário:", currentUser.id);

    // BUSCA MAIS FLEXÍVEL - pega o último agendamento do usuário que NÃO está concluído
    const { data, error } = await supabase
        .from('agendamentos')
        .select('*')
        .eq('cliente_id', currentUser.id)
        .not('status_pagamento', 'eq', 'Concluído')
        .not('status_pagamento', 'eq', 'Cancelado')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (error || !data) {
        console.warn("⚠️ Nenhum agendamento pendente encontrado");
        alert("Não encontramos um orçamento pendente. Por favor, faça um novo orçamento.");
        window.location.href = 'orcamento.html';
        return;
    }
    
    pendingAppointment = data;
    console.log("✅ Agendamento encontrado:", pendingAppointment);
    
    // Se já tem data/hora, mostrar na tela
    if (data.data_agendamento && data.hora_agendamento) {
        selectedDate = data.data_agendamento;
        selectedTime = data.hora_agendamento;
        console.log("📅 Agendamento já tem data/hora definida");
    }
    
    generateCalendar(); 
}

function generateCalendar() {
    calendarDays.innerHTML = '';
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const today = new Date();

    currentMonthDisplay.textContent = `${currentDate.toLocaleString('pt-br', { month: 'long' })} ${year}`;

    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    for (let i = 0; i < firstDayOfMonth; i++) {
        calendarDays.innerHTML += `<div></div>`;
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const dayDiv = document.createElement('div');
        dayDiv.textContent = day;
        const fullDate = new Date(year, month, day);

        if (fullDate < today.setHours(0,0,0,0)) {
            dayDiv.classList.add('unavailable');
        } else {
            dayDiv.classList.add('available');
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            dayDiv.dataset.date = dateStr;
            
            // Se for a data já selecionada, marcar
            if (dateStr === selectedDate) {
                dayDiv.classList.add('selected');
            }
            
            dayDiv.addEventListener('click', () => handleDayClick(dayDiv, dateStr));
        }
        calendarDays.appendChild(dayDiv);
    }
    
    // Se já tem data selecionada, carregar horários
    if (selectedDate) {
        const selectedDayElement = document.querySelector(`[data-date="${selectedDate}"]`);
        if (selectedDayElement) {
            handleDayClick(selectedDayElement, selectedDate);
        }
    }
}

document.getElementById('prev-month-btn').addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    generateCalendar();
});

document.getElementById('next-month-btn').addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    generateCalendar();
});

async function handleDayClick(dayElement, dateStr) {
    selectedDate = dateStr;
    // NÃO reseta selectedTime se já existir
    updateSummary();

    timeSlotsDiv.innerHTML = "<p>Verificando disponibilidade...</p>";

    document.querySelectorAll('.days .selected').forEach(el => el.classList.remove('selected'));
    dayElement.classList.add('selected');

    const { data: bookedAppointments, error } = await supabase
        .from('agendamentos')
        .select('hora_agendamento')
        .eq('data_agendamento', dateStr);

    if (error) {
        console.error("❌ Erro ao verificar horários:", error);
        timeSlotsDiv.innerHTML = "<p>Erro ao verificar horários.</p>";
        return;
    }

    const bookedTimes = bookedAppointments.map(appt => appt.hora_agendamento);
    const availableTimes = WORKING_HOURS.filter(time => !bookedTimes.includes(time));

    timeSlotsDiv.innerHTML = '';
    if (availableTimes.length === 0) {
        timeSlotsDiv.innerHTML = "<p>Nenhum horário disponível para este dia.</p>";
        return;
    }

    availableTimes.forEach(time => {
        const slotDiv = document.createElement('div');
        slotDiv.textContent = time;
        slotDiv.classList.add('time-slot');
        
        // Se for o horário já selecionado, marcar
        if (time === selectedTime) {
            slotDiv.classList.add('selected');
        }
        
        slotDiv.addEventListener('click', () => handleTimeClick(slotDiv, time));
        timeSlotsDiv.appendChild(slotDiv);
    });
}

function handleTimeClick(timeElement, timeStr) {
    selectedTime = timeStr;
    document.querySelectorAll('.time-slots .selected').forEach(el => el.classList.remove('selected'));
    timeElement.classList.add('selected');
    updateSummary();
}

function updateSummary() {
    if (selectedDate && selectedTime) {
        const [year, month, day] = selectedDate.split('-');
        summaryText.textContent = `Confirmar para ${day}/${month}/${year} às ${selectedTime}?`;
        payOnSiteBtn.disabled = false;
        payOnlineBtn.disabled = false;
    } else {
        summaryText.textContent = 'Nenhum horário selecionado.';
        payOnSiteBtn.disabled = true;
        payOnlineBtn.disabled = true;
    }
}

// BOTÃO 1: PAGAR NO LOCAL
payOnSiteBtn.addEventListener('click', async () => {
    if (!selectedDate || !selectedTime || !pendingAppointment) return;

    payOnSiteBtn.disabled = true;
    payOnlineBtn.disabled = true;
    payOnSiteBtn.textContent = "Agendando...";

    const { error } = await supabase
        .from('agendamentos')
        .update({ 
            data_agendamento: selectedDate,
            hora_agendamento: selectedTime,
            status_pagamento: 'Pendente (Pagar no Local)'
        })
        .eq('id', pendingAppointment.id);

    if (error) {
        alert("Erro ao confirmar o agendamento. Tente novamente.");
        console.error(error);
        payOnSiteBtn.disabled = false;
        payOnlineBtn.disabled = false;
        payOnSiteBtn.textContent = "Agendar e Pagar no Local";
    } else {
        alert("✅ Agendamento confirmado com sucesso! O pagamento será realizado no dia do serviço.");
        window.location.href = 'portal-cliente.html';
    }
});

// BOTÃO 2: PAGAR ONLINE
payOnlineBtn.addEventListener('click', async () => {
    if (!selectedDate || !selectedTime || !pendingAppointment || !currentUser) return;

    payOnSiteBtn.disabled = true;
    payOnlineBtn.disabled = true;
    payOnlineBtn.textContent = "Gerando Pagamento...";

    try {
        // Primeiro atualiza data/hora
        await supabase
            .from('agendamentos')
            .update({ 
                data_agendamento: selectedDate,
                hora_agendamento: selectedTime,
            })
            .eq('id', pendingAppointment.id);

        // Depois gera link de pagamento
        const { data: functionData, error: functionError } = await supabase.functions.invoke('create-payment', {
            body: {
                appointmentId: pendingAppointment.id,
                items: pendingAppointment.servicos_escolhidos,
                clientEmail: currentUser.email
            }
        });

        if (functionError) throw functionError;
        
        window.location.href = functionData.checkoutUrl;

    } catch (error) {
        alert(`Erro ao gerar o link de pagamento:\n\n${error.message}`);
        console.error("Erro completo:", error);
        payOnSiteBtn.disabled = false;
        payOnlineBtn.disabled = false;
        payOnlineBtn.textContent = "Pagar Online e Confirmar";
    }
});