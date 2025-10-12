// js/tecnico-painel.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'https://xrajjehettusnbvjielf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhyYWpqZWhldHR1c25idmppZWxmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5NjE2NzMsImV4cCI6MjA3NTUzNzY3M30.LIl1PcGEA31y2TVYmA7zH7mnCPjot-s02LcQmu79e_U';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;
let currentOS = null;
let uploadedPhotos = {
    antes: null,
    durante: [],
    depois: null
};

// Inicialização
async function init() {
    try {
        // Verificar autenticação
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
            alert('Sessão não encontrada. Faça login novamente.');
            window.location.href = 'login.html';
            return;
        }

        currentUser = user;

        // Verificar se é técnico
        const { data: profile } = await supabase
            .from('profiles')
            .select('user_type')
            .eq('id', user.id)
            .single();

        if (profile?.user_type !== 'tecnico') {
            alert('Acesso negado. Apenas técnicos podem acessar esta página.');
            window.location.href = 'index.html';
            return;
        }

        // Carregar OS da URL
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

    } catch (error) {
        console.error('Erro ao carregar OS:', error);
        alert('Erro ao carregar OS: ' + error.message);
    }
}

function renderOSDetails() {
    // Atualizar cabeçalho
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

    // Informações do cliente
    document.getElementById('cliente-nome').textContent = currentOS.cliente?.nome_completo || 'N/A';
    document.getElementById('cliente-telefone').textContent = currentOS.cliente?.whatsapp || 'N/A';
    document.getElementById('cliente-endereco').textContent = currentOS.cliente?.endereco || 'N/A';

    // Renderizar serviços
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

    // Valor total
    document.getElementById('valor-total').textContent = 
        `R$ ${currentOS.valor_total.toFixed(2).replace('.', ',')}`;
}

function setupEventListeners() {
    // Checkboxes de serviços
    document.querySelectorAll('.checklist-item input[type="checkbox"]').forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            if (this.checked) {
                this.parentElement.classList.add('completed');
            } else {
                this.parentElement.classList.remove('completed');
            }
        });
    });

    // Upload de fotos
    document.getElementById('upload-antes').addEventListener('change', (e) => handlePhotoUpload(e, 'antes'));
    document.getElementById('upload-durante').addEventListener('change', (e) => handlePhotoUpload(e, 'durante'));
    document.getElementById('upload-depois').addEventListener('change', (e) => handlePhotoUpload(e, 'depois'));

    // Botões de ação
    document.getElementById('btn-iniciar-servico').addEventListener('click', iniciarServico);
    document.getElementById('btn-concluir-servico').addEventListener('click', concluirServico);
}

async function handlePhotoUpload(event, tipo) {
    const file = event.target.files[0];
    if (!file) return;

    // Validar tamanho (máx 5MB)
    if (file.size > 5 * 1024 * 1024) {
        alert('Arquivo muito grande. Máximo 5MB.');
        return;
    }

    // Validar tipo
    if (!file.type.startsWith('image/')) {
        alert('Apenas imagens são permitidas.');
        return;
    }

    try {
        // Mostrar loading
        const preview = document.getElementById(`preview-${tipo}`);
        preview.innerHTML = '<p>Enviando...</p>';

        // Upload para o Supabase Storage
        const fileName = `${currentOS.id}_${tipo}_${Date.now()}.${file.name.split('.').pop()}`;
        const { data, error } = await supabase.storage
            .from('os-photos')
            .upload(fileName, file);

        if (error) throw error;

        // Obter URL pública
        const { data: urlData } = supabase.storage
            .from('os-photos')
            .getPublicUrl(fileName);

        // Armazenar no estado
        if (tipo === 'durante') {
            uploadedPhotos.durante.push(urlData.publicUrl);
        } else {
            uploadedPhotos[tipo] = urlData.publicUrl;
        }

        // Atualizar preview
        preview.innerHTML = `<img src="${urlData.publicUrl}" alt="Foto ${tipo}" style="max-width: 100%; border-radius: 5px;">`;

        console.log('Foto enviada:', urlData.publicUrl);

    } catch (error) {
        console.error('Erro no upload:', error);
        alert('Erro ao enviar foto: ' + error.message);
    }
}

async function iniciarServico() {
    if (!confirm('Deseja iniciar este serviço agora?')) return;

    try {
        // Atualizar status no banco
        const { error } = await supabase
            .from('agendamentos')
            .update({ 
                status_pagamento: 'Em Andamento',
                data_inicio: new Date().toISOString()
            })
            .eq('id', currentOS.id);

        if (error) throw error;

        // Enviar email para o cliente
        await sendEmail('started');

        alert('✅ Serviço iniciado! Cliente notificado por email.');
        
        // Atualizar interface
        document.getElementById('os-status').textContent = '🔄 Em Andamento';
        document.getElementById('btn-iniciar-servico').disabled = true;

    } catch (error) {
        console.error('Erro ao iniciar serviço:', error);
        alert('Erro ao iniciar serviço: ' + error.message);
    }
}

async function concluirServico() {
    // Validações
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
        // Atualizar no banco
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

        // Enviar email de conclusão
        await sendEmail('completed');

        alert('✅ Ordem de Serviço concluída com sucesso! Cliente notificado.');
        window.location.href = 'tecnico-dashboard.html';

    } catch (error) {
        console.error('Erro ao concluir serviço:', error);
        alert('Erro ao concluir serviço: ' + error.message);
    }
}

async function sendEmail(tipo) {
    try {
        const dataFormatada = currentOS.data_agendamento 
            ? new Date(currentOS.data_agendamento + 'T00:00:00').toLocaleDateString('pt-BR')
            : 'N/A';

        const emailData = {
            to: currentOS.cliente.email,
            subject: tipo === 'started' ? '🔧 Seu serviço foi iniciado!' : '🎉 Serviço concluído!',
            emailType: tipo,
            appointmentData: {
                clienteNome: currentOS.cliente.nome_completo,
                dataAgendamento: dataFormatada,
                horaAgendamento: currentOS.hora_agendamento,
                servicos: currentOS.servicos_escolhidos,
                valorTotal: currentOS.valor_total.toFixed(2).replace('.', ','),
                osId: currentOS.id
            }
        };

        const { error } = await supabase.functions.invoke('send-email', {
            body: emailData
        });

        if (error) {
            console.error('Erro ao enviar email:', error);
            // Não bloqueia o fluxo se o email falhar
        }

    } catch (error) {
        console.error('Erro na função de email:', error);
    }
}

// Funções globais
window.addActivity = function() {
    const now = new Date();
    const time = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const activity = prompt('Descreva a atividade realizada:');
    
    if (activity) {
        const timeline = document.querySelector('.timeline');
        const newActivity = document.createElement('div');
        newActivity.className = 'timeline-item';
        newActivity.innerHTML = `
            <div class="timeline-time">${time}</div>
            <div class="timeline-desc">${activity}</div>
        `;
        timeline.appendChild(newActivity);
    }
};

// Adicionar no js/tecnico-painel.js

async function sendNotifications(tipo) {
    try {
        const dataFormatada = currentOS.data_agendamento 
            ? new Date(currentOS.data_agendamento + 'T00:00:00').toLocaleDateString('pt-BR')
            : 'N/A';

        const notificationData = {
            clienteNome: currentOS.cliente.nome_completo,
            dataAgendamento: dataFormatada,
            horaAgendamento: currentOS.hora_agendamento,
            servicos: currentOS.servicos_escolhidos,
            valorTotal: currentOS.valor_total.toFixed(2).replace('.', ','),
            osId: currentOS.id,
            endereco: currentOS.cliente.endereco
        };

        // 1. ENVIAR EMAIL
        const emailData = {
            to: currentOS.cliente.email,
            subject: tipo === 'started' ? '🔧 Seu serviço foi iniciado!' : '🎉 Serviço concluído!',
            emailType: tipo,
            appointmentData: notificationData
        };

        const emailPromise = supabase.functions.invoke('send-email', {
            body: emailData
        });

        // 2. ENVIAR WHATSAPP
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

        // Formatar número de WhatsApp (remover caracteres especiais e adicionar código do país)
        let whatsappNumber = currentOS.cliente.whatsapp.replace(/\D/g, '');
        if (!whatsappNumber.startsWith('55')) {
            whatsappNumber = '55' + whatsappNumber; // Adiciona código do Brasil
        }

        const whatsappData = {
            to: `whatsapp:+${whatsappNumber}`,
            message: whatsappMessage,
            messageType: tipo
        };

        const whatsappPromise = supabase.functions.invoke('send-whatsapp', {
            body: whatsappData
        });

        // 3. AGUARDAR AMBOS (mas não bloquear se algum falhar)
        const [emailResult, whatsappResult] = await Promise.allSettled([
            emailPromise,
            whatsappPromise
        ]);

        // Log dos resultados
        if (emailResult.status === 'fulfilled') {
            console.log('✅ Email enviado com sucesso');
        } else {
            console.error('❌ Erro ao enviar email:', emailResult.reason);
        }

        if (whatsappResult.status === 'fulfilled') {
            console.log('✅ WhatsApp enviado com sucesso');
        } else {
            console.error('❌ Erro ao enviar WhatsApp:', whatsappResult.reason);
        }

        // Retornar sucesso se pelo menos uma notificação foi enviada
        return emailResult.status === 'fulfilled' || whatsappResult.status === 'fulfilled';

    } catch (error) {
        console.error('Erro geral ao enviar notificações:', error);
        return false;
    }
}

// Atualizar função iniciarServico
async function iniciarServico() {
    if (!confirm('Deseja iniciar este serviço agora?')) return;

    try {
        // Atualizar status no banco
        const { error } = await supabase
            .from('agendamentos')
            .update({ 
                status_pagamento: 'Em Andamento',
                data_inicio: new Date().toISOString()
            })
            .eq('id', currentOS.id);

        if (error) throw error;

        // Enviar notificações (email + WhatsApp)
        const notificationsSent = await sendNotifications('started');
        
        if (notificationsSent) {
            alert('✅ Serviço iniciado! Cliente notificado.');
        } else {
            alert('⚠️ Serviço iniciado, mas houve erro ao enviar notificações.');
        }
        
        // Atualizar interface
        document.getElementById('os-status').textContent = '🔄 Em Andamento';
        document.getElementById('btn-iniciar-servico').disabled = true;

    } catch (error) {
        console.error('Erro ao iniciar serviço:', error);
        alert('Erro ao iniciar serviço: ' + error.message);
    }
}

// Atualizar função concluirServico
async function concluirServico() {
    // ... validações existentes ...

    try {
        // Atualizar no banco
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

        // Enviar notificações (email + WhatsApp)
        await sendNotifications('completed');

        alert('✅ Ordem de Serviço concluída com sucesso! Cliente notificado.');
        window.location.href = 'tecnico-dashboard.html';

    } catch (error) {
        console.error('Erro ao concluir serviço:', error);
        alert('Erro ao concluir serviço: ' + error.message);
    }
}

// Iniciar
init();