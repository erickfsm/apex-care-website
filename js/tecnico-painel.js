// js/tecnico-painel.js
import { supabase } from './supabase-client.js';
/**
 * @fileoverview Manages the technician panel for handling service orders.
 * @module tecnico-painel
 */

// --- GLOBAL STATE ---
/** @type {object|null} The current authenticated user object. */
let currentUser = null;
/** @type {object|null} The current service order being viewed. */
let currentOS = null;
/** @type {string|null} The role of the current user. */
let currentRole = null;
/** @type {object|null} The profile of the current user. */
let currentProfile = null;
/** @type {boolean} A flag to prevent multiple activity submissions at once. */
let isSavingActivity = false;
/** @type {object} An object to store uploaded photo URLs. */
let uploadedPhotos = {
    antes: null,
    durante: [],
    depois: null
};

// --- INITIALIZATION ---
/**
 * Initializes the technician panel.
 */
async function init() {
    try {
        // Verify authentication
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            alert('Sessão não encontrada. Faça login novamente.');
            window.location.href = 'login.html';
            return;
        }

        currentUser = user;

        // Verify if user is a technician
        const { data: profile } = await supabase
            .from('profiles')
            .select('user_type, nome_completo')
            .eq('id', user.id)
            .single();

        const allowedRoles = ['tecnico', 'tecnico_master'];
        if (!allowedRoles.includes(profile?.user_type)) {
            alert('Acesso negado. Apenas técnicos autorizados podem acessar esta página.');
            window.location.href = 'index.html';
            return;
        }

        currentRole = profile?.user_type || 'tecnico';
        currentProfile = profile;

        // Load service order from URL
        const urlParams = new URLSearchParams(window.location.search);
        const osId = urlParams.get('os');

        if (!osId) {
            alert('ID da Ordem de Serviço não fornecido.');
            window.location.href = 'tecnico-dashboard.html';
            return;
        }

        await loadOS(osId);
        setupEventListeners();

    } catch (error) {
        console.error('Erro na inicialização:', error);
        alert('Erro ao carregar a Ordem de Serviço.');
    }
}
/**
 * Loads a service order from the database.
 * @param {string} osId - The ID of the service order to load.
 */
async function loadOS(osId) {
    try {
        const { data, error } = await supabase
            .from('agendamentos')
            .select(`
                *,
                cliente:profiles!cliente_id (
                    nome_completo,
                    whatsapp,
                    endereco,
                    email
                )
            `)
            .eq('id', osId)
            .single();

        if (error) throw error;

        currentOS = data;
        renderOSDetails();
        await loadActivities();

    } catch (error) {
        console.error('Erro ao carregar OS:', error);
        alert('Erro ao carregar OS: ' + error.message);
    }
}
/**
 * Renders the details of the service order.
 */
function renderOSDetails() {
    // Update header
    document.getElementById('os-id').textContent = `OS #${currentOS.id}`;

    const dataFormatada = currentOS.data_agendamento
        ? new Date(currentOS.data_agendamento + 'T00:00:00').toLocaleDateString('pt-BR', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        })
        : 'Data não definida';

    document.getElementById('os-date').textContent = dataFormatada;
    document.getElementById('os-time').textContent = currentOS.hora_agendamento || '--:--';

    // Client information
    document.getElementById('cliente-nome').textContent = currentOS.cliente?.nome_completo || 'N/A';
    document.getElementById('cliente-telefone').textContent = currentOS.cliente?.whatsapp || 'N/A';
    document.getElementById('cliente-endereco').textContent = currentOS.cliente?.endereco || 'N/A';

    // Render services
    const servicosContainer = document.getElementById('servicos-list');
    servicosContainer.innerHTML = '';

    currentOS.servicos_escolhidos.forEach((servico, index) => {
        const item = document.createElement('div');
        item.className = 'checklist-item';
        item.innerHTML = `
            <input type="checkbox" id="servico-${index}">
            <label for="servico-${index}">
                <strong>${servico.name}</strong> ${servico.quantity > 1 ? `(x${servico.quantity})` : ''}
            </label>
        `;
        servicosContainer.appendChild(item);
    });

    // Total value
    const valorTotalElement = document.getElementById('valor-total');
    if (valorTotalElement) {
        if (currentRole === 'tecnico') {
            valorTotalElement.textContent = 'Disponível apenas para o administrativo';
        } else {
            const valorFormatado = Number(currentOS?.valor_total || 0)
                .toFixed(2)
                .replace('.', ',');
            valorTotalElement.textContent = `R$ ${valorFormatado}`;
        }
    }
}
/**
 * Loads the activities for the current service order.
 * @param {boolean} [showLoader=true] - Whether to show a loading indicator.
 */
async function loadActivities(showLoader = true) {
    const timeline = document.querySelector('.timeline');
    if (!timeline || !currentOS) return;

    if (showLoader) {
        timeline.innerHTML = '<div class="timeline-empty">Carregando atividades...</div>';
    }

    try {
        const { data, error } = await supabase
            .from('os_atividades')
            .select('id, descricao, created_at, tecnico_id, tecnico_nome')
            .eq('agendamento_id', currentOS.id)
            .order('created_at', { ascending: true });

        if (error) throw error;

        renderTimeline(data || []);
    } catch (error) {
        console.error('Erro ao carregar atividades:', error);
        showToast('Não foi possível carregar o histórico de atividades.', 'error');
        timeline.innerHTML = '<div class="timeline-empty">Erro ao carregar atividades.</div>';
    }
}
/**
 * Renders the timeline of activities.
 * @param {Array<object>} activities - A list of activities to render.
 */
function renderTimeline(activities) {
    const timeline = document.querySelector('.timeline');
    if (!timeline) return;

    if (!activities.length) {
        timeline.innerHTML = '<div class="timeline-empty">Nenhuma atividade registrada até o momento.</div>';
        return;
    }

    timeline.innerHTML = '';

    activities.forEach(activity => {
        const item = document.createElement('div');
        item.className = 'timeline-item';

        const timeElement = document.createElement('div');
        timeElement.className = 'timeline-time';
        timeElement.textContent = formatActivityTime(activity.created_at);

        const descElement = document.createElement('div');
        descElement.className = 'timeline-desc';
        descElement.innerHTML = `
            <p>${escapeHtml(activity.descricao).replace(/\n/g, '<br>')}</p>
            <span class="timeline-meta">${activity.tecnico_nome ? escapeHtml(activity.tecnico_nome) : 'Técnico'}</span>
        `;

        item.appendChild(timeElement);
        item.appendChild(descElement);
        timeline.appendChild(item);
    });
}
/**
 * Formats a date string for display in the timeline.
 * @param {string} dateString - The date string to format.
 * @returns {string} The formatted date string.
 */
function formatActivityTime(dateString) {
    try {
        const date = new Date(dateString);
        return date.toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (error) {
        return '--/-- --:--';
    }
}
/**
 * Escapes HTML special characters in a string.
 * @param {string} unsafe - The string to escape.
 * @returns {string} The escaped string.
 */
function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') return '';
    return unsafe
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
/**
 * Shows a toast notification.
 * @param {string} message - The message to display.
 * @param {string} [type='success'] - The type of toast ('success', 'error').
 */
function showToast(message, type = 'success') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.textContent = message;

    container.appendChild(toast);

    requestAnimationFrame(() => {
        toast.classList.add('toast--visible');
    });

    setTimeout(() => {
        toast.classList.remove('toast--visible');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}
/**
 * Sets up event listeners for the page.
 */
function setupEventListeners() {
    // Service checkboxes
    document.querySelectorAll('.checklist-item input[type="checkbox"]').forEach(checkbox => {
        checkbox.addEventListener('change', function () {
            if (this.checked) {
                this.parentElement.classList.add('completed');
            } else {
                this.parentElement.classList.remove('completed');
            }
        });
    });

    // Photo uploads
    document.getElementById('upload-antes').addEventListener('change', (e) => handlePhotoUpload(e, 'antes'));
    document.getElementById('upload-durante').addEventListener('change', (e) => handlePhotoUpload(e, 'durante'));
    document.getElementById('upload-depois').addEventListener('change', (e) => handlePhotoUpload(e, 'depois'));

    // Action buttons
    document.getElementById('btn-iniciar-servico').addEventListener('click', iniciarServico);
    document.getElementById('btn-concluir-servico').addEventListener('click', concluirServico);
}
/**
 * Handles the photo upload process.
 * @param {Event} event - The file input change event.
 * @param {string} tipo - The type of photo ('antes', 'durante', 'depois').
 */
async function handlePhotoUpload(event, tipo) {
    const file = event.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
        alert('Arquivo muito grande. Máximo 5MB.');
        return;
    }

    if (!file.type.startsWith('image/')) {
        alert('Apenas imagens são permitidas.');
        return;
    }

    try {
        const preview = document.getElementById(`preview-${tipo}`);
        preview.innerHTML = '<p>Enviando...</p>';

        const fileName = `${currentOS.id}_${tipo}_${Date.now()}.${file.name.split('.').pop()}`;
        const { data, error } = await supabase.storage
            .from('os-photos')
            .upload(fileName, file);

        if (error) throw error;

        const { data: urlData } = supabase.storage
            .from('os-photos')
            .getPublicUrl(fileName);

        if (tipo === 'durante') {
            uploadedPhotos.durante.push(urlData.publicUrl);
        } else {
            uploadedPhotos[tipo] = urlData.publicUrl;
        }

        preview.innerHTML = `<img src="${urlData.publicUrl}" alt="Foto ${tipo}" style="max-width: 100%; border-radius: 5px;">`;

        console.log('Foto enviada:', urlData.publicUrl);

    } catch (error) {
        console.error('Erro no upload:', error);
        alert('Erro ao enviar foto: ' + error.message);
    }
}
/**
 * Starts the service and updates the status.
 */
async function iniciarServico() {
    if (!confirm('Deseja iniciar este serviço agora?')) return;

    try {
        const { error } = await supabase
            .from('agendamentos')
            .update({
                status_pagamento: 'Em Andamento',
                data_inicio: new Date().toISOString()
            })
            .eq('id', currentOS.id);

        if (error) throw error;

        const notificationsSent = await sendNotifications('started');

        if (notificationsSent) {
            alert('✅ Serviço iniciado! Cliente notificado.');
        } else {
            alert('⚠️ Serviço iniciado, mas houve erro ao enviar notificações.');
        }

        document.getElementById('os-status').textContent = '🔄 Em Andamento';
        document.getElementById('btn-iniciar-servico').disabled = true;

    } catch (error) {
        console.error('Erro ao iniciar serviço:', error);
        alert('Erro ao iniciar serviço: ' + error.message);
    }
}
/**
 * Concludes the service and updates the status.
 */
async function concluirServico() {
    if (!uploadedPhotos.antes || !uploadedPhotos.depois) {
        alert('Por favor, envie pelo menos as fotos de ANTES e DEPOIS.');
        return;
    }

    const observacoes = document.getElementById('observacoes').value;

    if (!observacoes || observacoes.length < 20) {
        alert('Por favor, adicione observações detalhadas (mínimo 20 caracteres).');
        return;
    }

    if (!confirm('Tem certeza que deseja CONCLUIR esta Ordem de Serviço?')) return;

    try {
        const { error } = await supabase
            .from('agendamentos')
            .update({
                status_pagamento: 'Concluído',
                data_conclusao: new Date().toISOString(),
                fotos_antes: uploadedPhotos.antes,
                fotos_durante: uploadedPhotos.durante,
                fotos_depois: uploadedPhotos.depois,
                observacoes_tecnico: observacoes
            })
            .eq('id', currentOS.id);

        if (error) throw error;

        const notificationsSent = await sendNotifications('completed');

        if (notificationsSent) {
            alert('✅ Ordem de Serviço concluída com sucesso! Cliente notificado.');
        } else {
            alert('⚠️ Ordem de Serviço concluída, mas houve erro ao enviar notificações.');
        }

        window.location.href = 'tecnico-dashboard.html';

    } catch (error) {
        console.error('Erro ao concluir serviço:', error);
        alert('Erro ao concluir serviço: ' + error.message);
    }
}
/**
 * Adds an activity to the service order.
 * @global
 */
window.addActivity = async function () {
    if (!currentOS || !currentUser) {
        showToast('Ordem de serviço não carregada.', 'error');
        return;
    }

    if (isSavingActivity) {
        return;
    }

    const descricao = prompt('Descreva a atividade realizada:');
    if (!descricao || !descricao.trim()) {
        return;
    }

    const payload = {
        agendamento_id: currentOS.id,
        descricao: descricao.trim(),
        tecnico_id: currentUser.id,
        tecnico_nome: currentProfile?.nome_completo || currentUser.email || 'Técnico',
        created_at: new Date().toISOString()
    };

    try {
        isSavingActivity = true;
        const { error } = await supabase
            .from('os_atividades')
            .insert(payload);

        if (error) throw error;

        showToast('Atividade registrada com sucesso.');
        await loadActivities(false);
    } catch (error) {
        console.error('Erro ao salvar atividade:', error);
        showToast('Erro ao registrar atividade. Tente novamente.', 'error');
    } finally {
        isSavingActivity = false;
    }
};
/**
 * Sends notifications to the client.
 * @param {string} tipo - The type of notification ('started' or 'completed').
 * @returns {Promise<boolean>} True if at least one notification was sent successfully, false otherwise.
 */
async function sendNotifications(tipo) {
    try {
        const dataFormatada = currentOS.data_agendamento
            ? new Date(currentOS.data_agendamento + 'T00:00:00').toLocaleDateString('pt-BR')
            : 'N/A';

        const notificationData = {
            clienteNome: currentOS.cliente?.nome_completo,
            dataAgendamento: dataFormatada,
            horaAgendamento: currentOS.hora_agendamento,
            servicos: currentOS.servicos_escolhidos,
            valorTotal: Number(currentOS?.valor_total || 0).toFixed(2).replace('.', ','),
            osId: currentOS.id,
            endereco: currentOS.cliente?.endereco
        };

        const emailData = {
            to: currentOS.cliente.email,
            subject: tipo === 'started' ? '🔧 Seu serviço foi iniciado!' : '🎉 Serviço concluído!',
            emailType: tipo,
            appointmentData: notificationData
        };

        const emailPromise = supabase.functions.invoke('send-email', {
            body: emailData
        });

        let whatsappMessage = '';

        if (tipo === 'started') {
            whatsappMessage = `🔧 *Serviço Iniciado - Apex Care*

Olá, ${notificationData.clienteNome}!

Nosso técnico acabou de iniciar o serviço no seu endereço.

📋 *OS:* #${notificationData.osId}
📅 *Data:* ${notificationData.dataAgendamento}
⏰ *Horário:* ${notificationData.horaAgendamento}

Estamos trabalhando com todo cuidado e atenção!`;
        } else if (tipo === 'completed') {
            whatsappMessage = `🎉 *Serviço Concluído - Apex Care*

Olá, ${notificationData.clienteNome}!

Seu serviço foi concluído com sucesso!

📋 *OS:* #${notificationData.osId}

⭐ Avalie nosso serviço:
${window.location.origin}/avaliacao.html?os=${notificationData.osId}

Obrigado pela confiança!`;
        }

        const promises = [{ channel: 'email', promise: emailPromise }];
        let whatsappResult;

        const rawWhatsapp = currentOS.cliente?.whatsapp;
        if (rawWhatsapp) {
            let whatsappNumber = rawWhatsapp.replace(/\D/g, '');

            if (whatsappNumber.length > 0) {
                if (!whatsappNumber.startsWith('55')) {
                    whatsappNumber = '55' + whatsappNumber;
                }

                const whatsappData = {
                    to: `whatsapp:+${whatsappNumber}`,
                    message: whatsappMessage,
                    messageType: tipo
                };

                const whatsappPromise = supabase.functions.invoke('send-whatsapp', {
                    body: whatsappData
                });

                promises.push({ channel: 'whatsapp', promise: whatsappPromise });
            } else {
                console.warn('⚠️ Número de WhatsApp inválido fornecido:', rawWhatsapp);
            }
        } else {
            console.info('ℹ️ Cliente sem número de WhatsApp cadastrado. Notificação enviada apenas por email.');
        }

        const settledResults = await Promise.allSettled(promises.map(item => item.promise));

        let emailResult;
        settledResults.forEach((result, index) => {
            const channel = promises[index].channel;
            if (channel === 'email') {
                emailResult = result;
            } else if (channel === 'whatsapp') {
                whatsappResult = result;
            }
        });

        if (emailResult?.status === 'fulfilled') {
            console.log('✅ Email enviado com sucesso');
        } else {
            console.error('❌ Erro ao enviar email:', emailResult?.reason);
        }

        if (whatsappResult) {
            if (whatsappResult.status === 'fulfilled') {
                console.log('✅ WhatsApp enviado com sucesso');
            } else {
                console.error('❌ Erro ao enviar WhatsApp:', whatsappResult.reason);
            }
        }

        const emailSuccess = emailResult?.status === 'fulfilled';
        const whatsappSuccess = whatsappResult?.status === 'fulfilled';

        return emailSuccess || whatsappSuccess;

    } catch (error) {
        console.error('Erro geral ao enviar notificações:', error);
        return false;
    }
}
// --- START ---
init();
