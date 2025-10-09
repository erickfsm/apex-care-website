import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// Configura a conexão
const SUPABASE_URL = 'https://xrajjehettusnbvjielf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhyYWpqZWhldHR1c25idmppZWxmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5NjE2NzMsImV4cCI6MjA3NTUzNzY3M30.LIl1PcGEA31y2TVYmA7zH7mnCPjot-s02LcQmu79e_U';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- LÓGICA DE CADASTRO ---
const registerForm = document.getElementById('register-form');

if (registerForm) { 
    const errorMessage = document.getElementById('error-message');

    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Coleta os dados do formulário
        const nome = document.getElementById('name').value;
        const whatsapp = document.getElementById('whatsapp').value;
        const endereco = document.getElementById('address').value;
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        
        errorMessage.textContent = '';

        try {
            console.log("🔐 Iniciando cadastro para:", email);

            // PASSO 1: Cria o usuário na autenticação
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: email,
                password: password,
            });

            if (authError) throw authError;
            if (!authData.user) throw new Error("Usuário não foi criado, tente novamente.");

            const userId = authData.user.id;
            console.log("✅ Usuário criado com ID:", userId);

            // PASSO 2: Salva os dados adicionais na tabela 'profiles'
            const { error: profileError } = await supabase.from('profiles').insert({
                id: userId,
                nome_completo: nome,
                whatsapp: whatsapp,
                endereco: endereco
            });

            if (profileError) throw profileError;
            console.log("✅ Perfil do usuário salvo");
                    
            // PASSO 3: Recupera o orçamento e salva em 'agendamentos'
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
                    
            // PASSO 4: Redireciona com sucesso
            alert("✅ Conta criada com sucesso! Agora, vamos escolher a melhor data e horário.");
            window.location.href = 'agendamento.html';

        } catch (error) {
            console.error("❌ ERRO DETALHADO NO CADASTRO:", error);
            errorMessage.textContent = `Erro: ${error.message}`;
            alert(`Ocorreu um erro no cadastro:\n\n${error.message}`);
        }
    });
}

// --- LÓGICA DE LOGIN ---
const loginForm = document.getElementById('login-form');

if (loginForm) { 
    const errorMessage = document.getElementById('error-message');

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