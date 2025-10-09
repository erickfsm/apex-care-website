import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// Configura a conexão
const SUPABASE_URL = 'https://xrajjehettusnbvjielf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhyYWpqZWhldHR1c25idmppZWxmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5NjE2NzMsImV4cCI6MjA3NTUzNzY3M30.LIl1PcGEA31y2TVYmA7zH7mnCPjot-s02LcQmu79e_U';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// HORÁRIOS DE TRABALHO PADRÃO DA APEX CARE
const WORKING_HOURS = ["09:00", "11:00", "14:00", "16:00"];

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

// Verificação de segurança (timeout)
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

    const { data, error } = await supabase
        .from('agendamentos')
        .select('*')
        .eq('cliente_id', currentUser.id)
        .is('data_agendamento', null)
        .single();

    if (error || !data) {
        console.warn("⚠️ Nenhum agendamento pendente encontrado");
        alert("Não encontramos um orçamento pendente. Por favor, faça um novo orçamento.");
        window.location.href = 'orcamento.html';
        return;
    }
    
    pendingAppointment = data;
    console.log("✅ Agendamento pendente encontrado:", pendingAppointment);
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
    selectedTime = null;
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
    if (!selectedDate || !selectedTime || !pendingAppointment || !currentUser) {
        alert("❌ Erro: dados incompletos");
        return;
    }

    confirmBtn.disabled = true;
    confirmBtn.textContent = "Processando...";

    try {
        console.log("📅 Atualizando agendamento com data e hora...");
        
        // ✅ PASSO 1: Atualiza a data e hora do agendamento
        const { error: updateError } = await supabase
            .from('agendamentos')
            .update({
                data_agendamento: selectedDate,
                hora_agendamento: selectedTime
            })
            .eq('id', pendingAppointment.id);

        if (updateError) {
            console.error("❌ Erro ao atualizar agendamento:", updateError);
            throw updateError;
        }
        console.log("✅ Data e hora atualizadas!");

        // ✅ PASSO 2: Invoca a função para criar o pagamento
        console.log("💳 Criando link de pagamento no Mercado Pago...");
        
        const { data: functionData, error: functionError } = await supabase.functions.invoke('create-payment', {
            body: {
                appointmentId: pendingAppointment.id,
                items: pendingAppointment.servicos_escolhidos,
                clientEmail: currentUser.email
            }
        });

        if (functionError) {
            console.error("❌ Erro na função create-payment:", functionError);
            throw functionError;
        }
        
        if (!functionData || !functionData.checkoutUrl) {
            throw new Error("Nenhuma URL de checkout retornada");
        }

        console.log("✅ Link de pagamento recebido!");
        console.log("🔗 Redirecionando para:", functionData.checkoutUrl);

        // ✅ PASSO 3: Redireciona o cliente para o checkout
        window.location.href = functionData.checkoutUrl;

    } catch (error) {
        console.error("❌ Erro completo:", error);
        alert(`❌ Erro ao processar agendamento:\n\n${error.message}`);
        confirmBtn.disabled = false;
        confirmBtn.textContent = "Confirmar Agendamento";
    }
});