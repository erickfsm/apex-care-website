import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// Cole suas chaves do Supabase aqui
const SUPABASE_URL = 'https://xrajjehettusnbvjielf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhyYWpqZWhldHR1c25idmppZWxmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5NjE2NzMsImV4cCI6MjA3NTUzNzY3M30.LIl1PcGEA31y2TVYmA7zH7mnCPjot-s02LcQmu79e_U';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const authCta = document.getElementById('auth-cta');

// Ouve as mudanças de autenticação
supabase.auth.onAuthStateChange((event, session) => {
    if (session && session.user) {
        // --- USUÁRIO ESTÁ LOGADO ---
        authCta.innerHTML = `
            <a href="portal-cliente.html" class="cta-button-outline">Portal do Cliente</a>
            <a href="#" id="logout-link" style="margin-left: 15px; font-weight: 400; font-size: 0.9em;">Sair</a>
        `;
        
        const logoutLink = document.getElementById('logout-link');
        if (logoutLink) {
            logoutLink.addEventListener('click', async (e) => {
                e.preventDefault();
                await supabase.auth.signOut();
                window.location.href = 'index.html';
            });
        }

    } else {
        // --- USUÁRIO NÃO ESTÁ LOGADO ---
         authContainer.innerHTML = `
            <a href="login.html" style="margin-right: 15px; font-weight: 700;">Login</a>
            <a href="orcamento.html" class="cta-button-nav">Orçamento Instantâneo</a>
        `;
    }
});