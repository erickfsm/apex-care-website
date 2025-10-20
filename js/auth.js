import { supabase } from './supabase-client.js';
/**
 * @fileoverview Handles user registration and login functionality.
 */

// --- REGISTRATION LOGIC ---
const registerForm = document.getElementById('register-form');

if (registerForm) {
    const errorMessage = document.getElementById('error-message');
    /**
     * @listens submit
     * @description Handles the submission of the registration form.
     */
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Collect form data
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
                        endereco: endereco
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
                    endereco: endereco
                })
                .eq('id', userId);

            if (profileError) {
                console.warn("⚠️ Aviso ao atualizar profile:", profileError);
                // Non-blocking error, user is already created
            } else {
                console.log("✅ Perfil do usuário atualizado");
            }

            // Retrieve and save the budget
            const orcamentoSalvo = localStorage.getItem('apexCareOrcamento');

            if (orcamentoSalvo) {
                try {
                    const orcamentoData = JSON.parse(orcamentoSalvo);

                    if (orcamentoData?.alreadyPersisted && orcamentoData?.agendamento_id) {
                        console.log("📦 Orçamento já persistido. Atualizando titularidade do registro existente.");
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
            alert("✅ Conta criada com sucesso! Agora, vamos escolher a melhor data e horário.");
            window.location.href = 'agendamento.html';

        } catch (error) {
            console.error("❌ ERRO DETALHADO NO CADASTRO:", error);
            errorMessage.textContent = `Erro: ${error.message}`;
            alert(`Ocorreu um erro no cadastro:\n\n${error.message}`);
        }
    });
}

// --- LOGIN LOGIC ---
const loginForm = document.getElementById('login-form');

if (loginForm) {
    const errorMessage = document.getElementById('error-message');
    /**
     * @listens submit
     * @description Handles the submission of the login form.
     */
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        errorMessage.textContent = '';

        try {
            console.log("🔐 Tentando login para:", email);

            const { data, error } = await supabase.auth.signInWithPassword({
                email: email,
                password: password,
            });

            if (error) throw error;

            console.log("✅ Login bem-sucedido!");
            alert("Login efetuado com sucesso!");
            window.location.href = 'index.html';

        } catch (error) {
            console.error("❌ Erro no login:", error);
            errorMessage.textContent = "E-mail ou senha inválidos. Tente novamente.";
        }
    });
}
