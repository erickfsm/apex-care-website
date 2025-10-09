import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// Configura a conexão
const SUPABASE_URL = 'https://xrajjehettusnbvjielf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhyYWpqZWhldHR1c25idmppZWxmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5NjE2NzMsImV4cCI6MjA3NTUzNzY3M30.LIl1PcGEA31y2TVYmA7zH7mnCPjot-s02LcQmu79e_U';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// HORÁRIOS DE TRABALHO PADRÃO DA APEX CARE
const WORKING_HOURS = ["09:00", "11:00", "14:00", "16:00"];

// Variáveis globais
// Variáveis globais
let currentUser = null;
let pendingAppointment = null;
let selectedDate = null;
let selectedTime = null;
let currentDate = new Date();

// Elementos do DOM
const calendarDays = document.getElementById('calendar-days');
const timeSlotsDiv = document.getElementById('time-slots');
const confirmBtn = document.getElementById('confirm-btn');
const summaryText = document.getElementById('summary-text');
const currentMonthDisplay = document.getElementById('current-month');

// --- PONTO DE ENTRADA PRINCIPAL ---
// Fica "ouvindo" o estado da autenticação
supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'INITIAL_SESSION' && session && session.user) {
        // Disparado quando a página carrega e uma sessão válida é encontrada
        console.log("Sessão válida encontrada!", session.user.email);
        currentUser = session.user;
        findPendingAppointment();
    } else if (event === 'SIGNED_IN') {
        // Disparado quando o usuário faz login na mesma página (não nosso caso agora)
        console.log("Usuário acabou de logar!", session.user.email);
        currentUser = session.user;
        findPendingAppointment();
    } else if (event === 'SIGNED_OUT') {
        // Disparado quando o usuário faz logout
        redirectToLogin();
    }
});

// Verifica a sessão inicial também
async function checkInitialSession() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session || !session.user) {
        // Se após um pequeno atraso ainda não houver sessão, redireciona
        setTimeout(() => {
            if (!currentUser) redirectToLogin();
        }, 500);
    }
}

function redirectToLogin() {
    alert("Sessão não encontrada ou expirada. Por favor, faça o login.");
    window.location.href = 'login.html';
}

async function findPendingAppointment() {
    if (!currentUser) return;

    const { data, error } = await supabase
        .from('agendamentos')
        .select('*')
        .eq('cliente_id', currentUser.id)
        .is('data_agendamento', null)
        .single();

    if (error || !data) {
        alert("Não encontramos um orçamento pendente. Por favor, faça um novo orçamento.");
        window.location.href = 'orcamento.html';
        return;
    }
    pendingAppointment = data;
    console.log("Agendamento pendente encontrado:", pendingAppointment);
    generateCalendar(); 
}

// --- FUNÇÕES DO CALENDÁRIO ---
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

        // Desabilita dias passados
        if (fullDate < today.setHours(0,0,0,0)) {
            dayDiv.classList.add('unavailable');
        } else {
            dayDiv.classList.add('available');
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            dayDiv.dataset.date = dateStr;
            dayDiv.addEventListener('click', () => handleDayClick(dayDiv, dateStr));
        }
        calendarDays.appendChild(dayDiv);
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


// --- FUNÇÕES DE SELEÇÃO DE HORÁRIO ---
async function handleDayClick(dayElement, dateStr) {
    selectedDate = dateStr;
    selectedTime = null; // Reseta a hora selecionada
    updateSummary();

    timeSlotsDiv.innerHTML = "<p>Verificando disponibilidade...</p>";

    document.querySelectorAll('.days .selected').forEach(el => el.classList.remove('selected'));
    dayElement.classList.add('selected');

    const { data: bookedAppointments, error } = await supabase
        .from('agendamentos')
        .select('hora_agendamento')
        .eq('data_agendamento', dateStr);

    if (error) {
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
        confirmBtn.disabled = false;
        confirmBtn.classList.remove('disabled');
    } else {
        summaryText.textContent = 'Nenhum horário selecionado.';
        confirmBtn.disabled = true;
        confirmBtn.classList.add('disabled');
    }
}

// --- AÇÃO FINAL: CONFIRMAR AGENDAMENTO ---
confirmBtn.addEventListener('click', async () => {
    if (!selectedDate || !selectedTime || !pendingAppointment || !currentUser) return;

    confirmBtn.disabled = true;
    confirmBtn.textContent = "Gerando Pagamento...";

    try {
        // 1. Atualiza o agendamento no banco de dados com a data e hora
        const { data: updatedAppointment, error: updateError } = await supabase
            .from('agendamentos')
            .update({ 
                data_agendamento: selectedDate,
                hora_agendamento: selectedTime,
            })
            .eq('id', pendingAppointment.id)
            .select()
            .single(); // .single() é importante para garantir que temos o objeto atualizado

        if (updateError) throw updateError;
        console.log("Agendamento atualizado com data/hora:", updatedAppointment);

        // 2. Chama a Edge Function para criar o link de pagamento
        console.log("Invocando a função 'create-payment'...");
        const { data: functionData, error: functionError } = await supabase.functions.invoke('create-payment', {
            body: {
                appointmentId: updatedAppointment.id,
                items: updatedAppointment.servicos_escolhidos,
                clientEmail: currentUser.email
            }
        });

        if (functionError) {
          // Se der erro na função, mostra a mensagem específica
          const errorMsg = await functionError.context.json();
          throw new Error(errorMsg.error);
        }
        
        console.log("Link de pagamento recebido:", functionData.checkoutUrl);

        // 3. Redireciona o cliente para o checkout do Mercado Pago
        window.location.href = functionData.checkoutUrl;

    } catch (error) {
        alert(`Erro ao gerar o link de pagamento:\n\n${error.message}`);
        console.error("Erro completo:", error);
        confirmBtn.disabled = false;
        confirmBtn.textContent = "Confirmar Agendamento";
    }
});

// --- INICIALIZAÇÃO DA PÁGINA ---
initializePage();