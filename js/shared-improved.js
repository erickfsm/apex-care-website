// js/shared-improved.js - VERSÃO COMPLETA CORRIGIDA
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'https://xrajjehettusnbvjielf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhyYWpqZWhldHR1c25idmppZWxmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5NjE2NzMsImV4cCI6MjA3NTUzNzY3M30.LIl1PcGEA31y2TVYmA7zH7mnCPjot-s02LcQmu79e_U';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const authContainer = document.getElementById('auth-container-header') || document.getElementById('auth-container');

// Ouve mudanças de autenticação
supabase.auth.onAuthStateChange((event, session) => {
    console.log('🔐 Auth event:', event);
    if (session && session.user) {
        loadUserProfile(session.user.id);
    } else {
        renderLoggedOutState();
    }
});

function renderLoggedOutState() {
    if (!authContainer) return;
    
    authContainer.innerHTML = `
        <a href="login.html" class="auth-link-login">Login</a>
        <a href="orcamento.html" class="cta-button-nav">Orçamento</a>
    `;
}

async function loadUserProfile(userId) {
    if (!authContainer) return;

    try {
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('nome_completo, user_type')
            .eq('id', userId)
            .single();

        if (error) {
            console.error("Erro ao carregar perfil:", error);
        }

        const userName = profile?.nome_completo?.split(' ')[0] || 'Usuário';
        const userType = profile?.user_type || 'cliente';
        
        console.log('👤 Tipo de usuário detectado:', userType);
        console.log('📋 Dados do perfil:', profile);
        
        renderLoggedInState(userName, userType);
    } catch (error) {
        console.error("Erro ao carregar perfil:", error);
        renderLoggedInState('Usuário', 'cliente');
    }
}

function renderLoggedInState(userName, userType) {
    let dropdownLinks = '';
    let userIcon = userType === 'tecnico' ? '🔧' : '👤';
    
    if (userType === 'tecnico') {
        dropdownLinks = `
            <a href="tecnico-dashboard.html">🔧 Meu Dashboard</a>
            <a href="config-perfil.html">⚙️ Configurações</a>
            <a href="index.html">🏠 Site Apex Care</a>
            <a href="#" id="logout-btn">🚪 Sair</a>
        `;
    } else {
        dropdownLinks = `
            <a href="portal-cliente.html">📊 Portal do Cliente</a>
            <a href="config-perfil.html">⚙️ Meu Perfil</a>
            <a href="orcamento.html">📋 Novo Orçamento</a>
            <a href="#" id="logout-btn">🚪 Sair</a>
        `;
    }

    authContainer.innerHTML = `
        <div class="auth-dropdown">
            <button class="auth-dropdown-btn" id="auth-dropdown-btn">
                ${userIcon} ${userName}
                <span>▼</span>
            </button>
            <div class="auth-dropdown-menu" id="auth-dropdown-menu">
                ${dropdownLinks}
            </div>
        </div>
    `;

    // Setup do dropdown
    const dropdownBtn = document.getElementById('auth-dropdown-btn');
    const dropdownMenuEl = document.getElementById('auth-dropdown-menu');
    const logoutBtn = document.getElementById('logout-btn');

    dropdownBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdownMenuEl.classList.toggle('active');
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.auth-dropdown')) {
            dropdownMenuEl.classList.remove('active');
        }
    });

    logoutBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        await supabase.auth.signOut();
        window.location.href = 'index.html';
    });
}

window.authHelpers = {
    supabase,
    loadUserProfile
};