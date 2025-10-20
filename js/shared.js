import { supabase } from './supabase-client.js';
/**
 * @fileoverview Manages the shared authentication state and renders the user profile dropdown in the header.
 * @module shared
 */

const authContainer = document.getElementById('auth-container-header') || document.getElementById('auth-container');
let dropdownMenu = null;

// Listens for authentication changes
supabase.auth.onAuthStateChange((event, session) => {
    if (session && session.user) {
        // User is logged in
        loadUserProfile(session.user.id);
    } else {
        // User is not logged in
        renderLoggedOutState();
    }
});

/**
 * Renders the header in a logged-out state.
 */
function renderLoggedOutState() {
    if (!authContainer) return;

    authContainer.innerHTML = `
        <a href="login.html" class="auth-link-login">Login</a>
        <a href="cadastro.html" class="cta-button-nav">Criar conta</a>
    `;
}

/**
 * Loads the user profile from the database.
 * @param {string} userId - The ID of the user.
 */
async function loadUserProfile(userId) {
    if (!authContainer) return;

    try {
        const { data: profile } = await supabase
            .from('profiles')
            .select('nome_completo')
            .eq('id', userId)
            .single();

        const userName = profile?.nome_completo?.split(' ')[0] || 'Cliente';
        renderLoggedInState(userName);
    } catch (error) {
        console.error("Erro ao carregar perfil:", error);
        renderLoggedInState('Cliente');
    }
}

/**
 * Renders the header in a logged-in state.
 * @param {string} userName - The name of the user.
 */
function renderLoggedInState(userName) {
    authContainer.innerHTML = `
        <div class="auth-dropdown">
            <button class="auth-dropdown-btn" id="auth-dropdown-btn">
                👤 ${userName}
                <span>▼</span>
            </button>
            <div class="auth-dropdown-menu" id="auth-dropdown-menu">
                <a href="portal-cliente.html">📊 Portal do Cliente</a>
                <a href="orcamento.html">📋 Novo Orçamento</a>
                <a href="#" id="logout-btn">🚪 Sair</a>
            </div>
        </div>
    `;

    // Setup dropdown
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

/**
 * @global
 * @property {object} authHelpers - A global object for authentication helpers.
 * @property {object} authHelpers.supabase - The Supabase client instance.
 * @property {function} authHelpers.loadUserProfile - A function to load the user profile.
 */
window.authHelpers = {
    supabase,
    loadUserProfile
};
