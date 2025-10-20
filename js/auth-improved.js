import { supabase } from './supabase-client.js';

// Configura a conexão compartilhada

const RESUME_STATE_KEY = 'apexCareResumeState';
/**
 * @function getResumeState
 * @description Retrieves the resume state from local storage.
 * @returns {Object|null} The parsed resume state object or null if not found or on error.
 */
function getResumeState() {
    try {
        const stored = localStorage.getItem(RESUME_STATE_KEY);
        return stored ? JSON.parse(stored) : null;
    } catch (error) {
        console.warn('Não foi possível ler o estado de retomada do orçamento.', error);
        return null;
    }
}
/**
 * @function clearResumeState
 * @description Clears the resume state from local storage.
 */
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

            // Create user in Supabase auth
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: email,
                password: password,
                options: {
                    data: {
                        nome_completo: nome,
                        whatsapp: whatsapp,
                        endereco: endereco,
                        user_type: 'cliente' // Default user type is 'cliente'
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

            // Wait for the trigger to create the profile
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Update the profile with complete data
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

            // Retrieve and save the budget
            const orcamentoSalvo = localStorage.getItem('apexCareOrcamento');

            if (orcamentoSalvo) {
                try {
                    const orcamentoData = JSON.parse(orcamentoSalvo);

                    if (orcamentoData?.alreadyPersisted && orcamentoData?.agendamento_id) {
                        console.log("📦 Orçamento já persistido. Reatribuindo para o novo usuário.");
                        const { error: updateError } = await supabase
                            .from('agendamentos')
                            .update({ cliente_id: userId })
                            .eq('id', orcamentoData.agendamento_id);

                        if (updateError) {
                            throw updateError;
                        }
                    } else {
                        const servicosParaSalvar = orcamentoData.servicos || [];

                        console.log("💾 Criando registro de orçamento em aprovação:", servicosParaSalvar);

                        const { error: agendamentoError } = await supabase
                            .from('agendamentos')
                            .insert({
                                cliente_id: userId,
                                servicos_escolhidos: servicosParaSalvar,
                                valor_total: orcamentoData.valor_total,
                                desconto_aplicado: orcamentoData.desconto_promocional || 0,
                                status_pagamento: 'Em Aprovação',
                                data_agendamento: null,
                                hora_agendamento: null
                            });

                        if (agendamentoError) {
                            console.error("❌ ERRO ao inserir agendamento:", agendamentoError);
                            throw agendamentoError;
                        }
                    }

                    console.log("✅ Dados do orçamento vinculados com sucesso!");
                    localStorage.removeItem('apexCareOrcamento');

                } catch (insertError) {
                    console.error("❌ Falha ao salvar o agendamento:", insertError);
                    alert(`Ocorreu um erro ao salvar seu orçamento: ${insertError.message}`);
                    return;
                }
            } else {
                console.warn("⚠️ Nenhum orçamento encontrado em localStorage");
            }

            // Redirect on success
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
        const userType = document.getElementById('user-type').value; // 'cliente' or 'tecnico'

        errorMessage.textContent = '';

        try {
            console.log("🔐 Tentando login para:", email, "Tipo:", userType);

            // Sign in the user
            const { data, error } = await supabase.auth.signInWithPassword({
                email: email,
                password: password,
            });

            if (error) throw error;

            console.log("✅ Login bem-sucedido!");

            // Check the user type in the profile
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

            // Validate if the selected type matches the registered type
            if (userType === 'tecnico' && userTypeFromDB !== 'tecnico') {
                await supabase.auth.signOut();
                errorMessage.textContent = "Esta conta não é de técnico. Selecione 'Cliente' para entrar.";
                return;
            }

            if (userType === 'cliente' && userTypeFromDB === 'tecnico') {
                await supabase.auth.signOut();
                errorMessage.textContent = "Esta é uma conta de técnico. Selecione 'Técnico' para entrar.";
                return;
            }

            // Redirect to the correct page
            alert("Login efetuado com sucesso!");

            const resumeState = getResumeState();
            if (resumeState && userTypeFromDB !== 'tecnico') {
                const targetUrl = resumeState.returnUrl || (resumeState.stage === 'schedule' ? 'agendamento.html' : 'orcamento.html');
                clearResumeState();
                window.location.href = targetUrl;
                return;
            }

            if (userTypeFromDB === 'tecnico') {
                window.location.href = 'tecnico-dashboard.html';
            } else {
                window.location.href = 'index.html';
            }

        } catch (error) {
            console.error("❌ Erro no login:", error);
            errorMessage.textContent = "E-mail ou senha inválidos. Tente novamente.";
        }
    });
}
