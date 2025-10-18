import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// Configura a conexão
const SUPABASE_URL = 'https://xrajjehettusnbvjielf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhyYWpqZWhldHR1c25idmppZWxmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5NjE2NzMsImV4cCI6MjA3NTUzNzY3M30.LIl1PcGEA31y2TVYmA7zH7mnCPjot-s02LcQmu79e_U';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const RESUME_STATE_KEY = 'apexCareResumeState';

function getResumeState() {
    try {
        const stored = localStorage.getItem(RESUME_STATE_KEY);
        return stored ? JSON.parse(stored) : null;
    } catch (error) {
        console.warn('Não foi possível ler o estado de retomada do orçamento.', error);
        return null;
    }
}

function clearResumeState() {
    localStorage.removeItem(RESUME_STATE_KEY);
}

// --- LÓGICA DE CADASTRO ---
const registerForm = document.getElementById('register-form');

if (registerForm) { 
    const errorMessage = document.getElementById('error-message');

    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const nome = document.getElementById('name').value;
        const whatsapp = document.getElementById('whatsapp').value;
        const endereco = document.getElementById('address').value;
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        
        errorMessage.textContent = '';

        try {
            console.log("🔐 Iniciando cadastro para:", email);

            // ✅ PASSO 1: Cria o usuário na autenticação
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: email,
                password: password,
                options: {
                    data: {
                        nome_completo: nome,
                        whatsapp: whatsapp,
                        endereco: endereco,
                        user_type: 'cliente' // Por padrão, cadastro é sempre cliente
                    }
                }
            });

            if (authError) {
                console.error("❌ Erro na autenticação:", authError);
                throw authError;
            }
            
            if (!authData.user) {
                throw new Error("Usuário não foi criado, tente novamente.");
            }

            const userId = authData.user.id;
            console.log("✅ Usuário criado com ID:", userId);

            // ✅ PASSO 2: Aguarda um pouco para o trigger criar o profile
            await new Promise(resolve => setTimeout(resolve, 1000));

            // ✅ PASSO 3: Atualiza o profile com os dados completos
            const { error: profileError } = await supabase
                .from('profiles')
                .update({
                    nome_completo: nome,
                    whatsapp: whatsapp,
                    endereco: endereco,
                    user_type: 'cliente'
                })
                .eq('id', userId);

            if (profileError) {
                console.warn("⚠️ Aviso ao atualizar profile:", profileError);
            } else {
                console.log("✅ Perfil do usuário atualizado");
            }
                    
            // ✅ PASSO 4: Recupera o orçamento e salva em 'agendamentos'
            const orcamentoSalvo = localStorage.getItem('apexCareOrcamento');
            
            if (orcamentoSalvo) {
                try {
                    const orcamentoData = JSON.parse(orcamentoSalvo);
                    const servicosParaSalvar = orcamentoData.servicos;

                    console.log("💾 Tentando salvar agendamento com os serviços:", servicosParaSalvar);

                    const { data: agendamentoData, error: agendamentoError } = await supabase
                        .from('agendamentos')
                        .insert({
                            cliente_id: userId,
                            servicos_escolhidos: servicosParaSalvar,
                            valor_total: orcamentoData.valor_total,
                            status_pagamento: 'Pendente'
                        })
                        .select();

                    if (agendamentoError) {
                        console.error("❌ ERRO ao inserir agendamento:", agendamentoError);
                        throw agendamentoError;
                    }
                    
                    console.log("✅ Agendamento salvo com sucesso!");
                    localStorage.removeItem('apexCareOrcamento');

                } catch (insertError) {
                    console.error("❌ Falha ao salvar o agendamento:", insertError);
                    alert(`Ocorreu um erro ao salvar seu orçamento: ${insertError.message}`);
                    return; 
                }
            } else {
                console.warn("⚠️ Nenhum orçamento encontrado em localStorage");
            }
                    
            // ✅ PASSO 5: Redireciona com sucesso
            const temOrcamento = orcamentoSalvo && orcamentoSalvo.length > 0;
            const resumeState = getResumeState();

            if (resumeState) {
                alert("✅ Conta criada com sucesso! Retomando seu orçamento.");
                const targetUrl = resumeState.returnUrl || (resumeState.stage === 'schedule' ? 'agendamento.html' : 'orcamento.html');
                clearResumeState();
                window.location.href = targetUrl;
            } else if (temOrcamento) {
                alert("✅ Conta criada com sucesso! Agora, vamos escolher a melhor data e horário.");
                window.location.href = 'agendamento.html';
            } else {
                alert("✅ Conta criada com sucesso! Bem-vindo à Apex Care.");
                window.location.href = 'portal-cliente.html';
            }

        } catch (error) {
            console.error("❌ ERRO DETALHADO NO CADASTRO:", error);
            errorMessage.textContent = `Erro: ${error.message}`;
            alert(`Ocorreu um erro no cadastro:\n\n${error.message}`);
        }
    });
}

// --- LÓGICA DE LOGIN COM SUPORTE A TÉCNICOS ---
const loginForm = document.getElementById('login-form');

if (loginForm) { 
    const errorMessage = document.getElementById('error-message');

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const userType = document.getElementById('user-type').value; // cliente ou tecnico
        
        errorMessage.textContent = '';

        try {
            console.log("🔐 Tentando login para:", email, "Tipo:", userType);

            // ✅ PASSO 1: Faz o login
            const { data, error } = await supabase.auth.signInWithPassword({
                email: email,
                password: password,
            });

            if (error) throw error;

            console.log("✅ Login bem-sucedido!");

            // ✅ PASSO 2: Verifica o tipo de usuário no profile
            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('user_type')
                .eq('id', data.user.id)
                .single();

            if (profileError) {
                console.warn("⚠️ Erro ao buscar profile, usando tipo padrão");
            }

            const userTypeFromDB = profile?.user_type || 'cliente';

            console.log("👤 Tipo de usuário no banco:", userTypeFromDB);
            console.log("👤 Tipo selecionado no login:", userType);

            // ✅ PASSO 3: Valida se o tipo selecionado corresponde ao cadastrado
            if (userType === 'tecnico' && userTypeFromDB !== 'tecnico') {
                // Usuário tentou logar como técnico, mas não é
                await supabase.auth.signOut();
                errorMessage.textContent = "Esta conta não é de técnico. Selecione 'Cliente' para entrar.";
                return;
            }

            if (userType === 'cliente' && userTypeFromDB === 'tecnico') {
                // Técnico tentou logar como cliente
                await supabase.auth.signOut();
                errorMessage.textContent = "Esta é uma conta de técnico. Selecione 'Técnico' para entrar.";
                return;
            }

            // ✅ PASSO 4: Redireciona para a página correta
            alert("Login efetuado com sucesso!");

            const resumeState = getResumeState();
            if (resumeState && userTypeFromDB !== 'tecnico') {
                const targetUrl = resumeState.returnUrl || (resumeState.stage === 'schedule' ? 'agendamento.html' : 'orcamento.html');
                clearResumeState();
                window.location.href = targetUrl;
                return;
            }

            if (userTypeFromDB === 'tecnico') {
                window.location.href = 'tecnico-dashboard.html'; // ← NOVA ROTA PARA TÉCNICOS
            } else {
                window.location.href = 'index.html';
            }

        } catch (error) {
            console.error("❌ Erro no login:", error);
            errorMessage.textContent = "E-mail ou senha inválidos. Tente novamente.";
        }
    });
}