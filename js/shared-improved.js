// js/shared-improved.js - VERSÃO COMPLETA CORRIGIDA
import { supabase } from './supabase-client.js';

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
    let userIcon = '👤';

    switch (userType) {
        case 'admin':
            userIcon = '🛡️';
            dropdownLinks = `
                <a href="admin-dashboard.html">📊 Painel Administrativo</a>
                <a href="admin-promocoes.html">🎯 Promoções & Campanhas</a>
                <a href="tecnico-dashboard.html">🔧 Painel Técnico</a>
                <a href="config-perfil.html">⚙️ Configurações</a>
                <a href="#" id="logout-btn">🚪 Sair</a>
            `;
            break;
        case 'tecnico_master':
            userIcon = '🛠️';
            dropdownLinks = `
                <a href="tecnico-dashboard.html">🔧 Meu Dashboard</a>
                <a href="config-perfil.html">⚙️ Configurações</a>
                <a href="index.html">🏠 Site Apex Care</a>
                <a href="admin-dashboard.html" class="stealth-admin-link">🛡️ Área Gerencial</a>
                <a href="admin-promocoes.html" class="stealth-admin-link">🎯 Promoções</a>
                <a href="#" id="logout-btn">🚪 Sair</a>
            `;
            break;
        case 'tecnico':
            userIcon = '🔧';
            dropdownLinks = `
                <a href="tecnico-dashboard.html">🔧 Meu Dashboard</a>
                <a href="config-perfil.html">⚙️ Configurações</a>
                <a href="index.html">🏠 Site Apex Care</a>
                <a href="#" id="logout-btn">🚪 Sair</a>
            `;
            break;
        default:
            dropdownLinks = `
                <a href="portal-cliente.html">📊 Portal do Cliente</a>
                <a href="config-perfil.html">⚙️ Meu Perfil</a>
                <a href="orcamento.html">📋 Novo Orçamento</a>
                <a href="#" id="logout-btn">🚪 Sair</a>
            `;
            break;
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