// Importa a biblioteca do Supabase
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// Configura a conexão
const SUPABASE_URL = 'https://xrajjehettusnbvjielf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhyYWpqZWhldHR1c25idmppZWxmIiwi\ncm9sZSI6ImFub24iLCJpYXQiOjE3NTk5NjE2NzMsImV4cCI6MjA3NTUzNzY3M30.LIl1PcGEA31y2TVYmA7zH7mnCPjot-s02LcQmu79e_U';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Variável que vai guardar nossos preços vindos do banco de dados
let priceTable = [];

const RESUME_STATE_KEY = 'apexCareResumeState';

// Elementos do DOM
const stepSections = Array.from(document.querySelectorAll('.step-section'));
const progressSteps = Array.from(document.querySelectorAll('.progress-step'));
const progressBarFill = document.getElementById('progress-bar-fill');
const stepsWrapper = document.querySelector('.steps-wrapper');
const serviceSelectionDiv = document.getElementById('service-selection');
const summaryItemsDiv = document.getElementById('summary-items');
const summaryChargesDiv = document.getElementById('summary-charges');
const distanceInfoDiv = document.getElementById('distance-info');
const totalPriceSpan = document.getElementById('total-price');
const scheduleBtn = document.getElementById('next-step-btn');

// Campos de endereço
const cepInput = document.getElementById('cep-input');
const numeroInput = document.getElementById('numero-input');
const complementoInput = document.getElementById('complemento-input');
const ruaInput = document.getElementById('rua-input');
const bairroInput = document.getElementById('bairro-input');
const cidadeInput = document.getElementById('cidade-input');
const estadoInput = document.getElementById('estado-input');

// Configurações de deslocamento
const BASE_LOCATION = {
    address: 'Rua São Sebastião, 100 - Ibirité, MG', // Pode ser alterado conforme a filial
    latitude: null,
    longitude: null
};
const DISTANCE_THRESHOLD_KM = 10;
const DISTANCE_FEE_PER_KM = 5;

let customerCoordinates = null;
let baseCoordinates = null;
let distanceKm = null;
let distanceSurcharge = 0;
let serviceSubtotal = 0;
let lastCepData = null;

function formatCurrency(value) {
    return `R$ ${value.toFixed(2).replace('.', ',')}`;
}

function sanitizeCep(value) {
    return value.replace(/\D/g, '');
}

function clearAddressFields() {
    ruaInput.value = '';
    bairroInput.value = '';
    cidadeInput.value = '';
    estadoInput.value = '';
    lastCepData = null;
    customerCoordinates = null;
    distanceKm = null;
    refreshTotals();
}

async function fetchAddressByCep() {
    const cep = sanitizeCep(cepInput.value);
    if (cep.length !== 8) {
        clearAddressFields();
        return;
    }

    try {
        const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        if (!response.ok) throw new Error('Falha ao consultar o CEP');
        const data = await response.json();
        if (data.erro) {
            alert('CEP não encontrado. Verifique e tente novamente.');
            clearAddressFields();
            return;
        }

        ruaInput.value = data.logradouro || '';
        bairroInput.value = data.bairro || '';
        cidadeInput.value = data.localidade || '';
        estadoInput.value = data.uf || '';
        lastCepData = data;

        await updateCustomerCoordinates();
    } catch (error) {
        console.error('Erro ao buscar CEP:', error);
        alert('Não foi possível buscar o endereço pelo CEP informado.');
        clearAddressFields();
    }
}

async function geocodeAddress(address) {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address)}`;
    const response = await fetch(url, {
        headers: {
            'Accept': 'application/json',
            'User-Agent': 'apex-care-orcamento/1.0'
        }
    });
    if (!response.ok) {
        throw new Error('Falha na geocodificação');
    }
    const results = await response.json();
    if (!results || results.length === 0) {
        throw new Error('Endereço não encontrado');
    }
    return {
        latitude: parseFloat(results[0].lat),
        longitude: parseFloat(results[0].lon)
    };
}

function haversineDistance(coord1, coord2) {
    const toRad = (value) => (value * Math.PI) / 180;
    const R = 6371; // km
    const dLat = toRad(coord2.latitude - coord1.latitude);
    const dLon = toRad(coord2.longitude - coord1.longitude);
    const lat1 = toRad(coord1.latitude);
    const lat2 = toRad(coord2.latitude);

    const a = Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

async function fetchDistance(origin, destination) {
    try {
        const url = `https://router.project-osrm.org/route/v1/driving/${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}?overview=false`;
        const response = await fetch(url);
        if (response.ok) {
            const data = await response.json();
            if (data.routes && data.routes.length > 0) {
                return data.routes[0].distance / 1000; // metros para km
            }
        }
        throw new Error('Sem rotas disponíveis');
    } catch (error) {
        console.warn('Falha ao consultar serviço de rotas, usando distância em linha reta.', error);
        return haversineDistance(origin, destination);
    }
}

async function initializeBaseCoordinates() {
    if (BASE_LOCATION.latitude && BASE_LOCATION.longitude) {
        baseCoordinates = {
            latitude: BASE_LOCATION.latitude,
            longitude: BASE_LOCATION.longitude
        };
        return;
    }

    try {
        baseCoordinates = await geocodeAddress(BASE_LOCATION.address);
    } catch (error) {
        console.error('Não foi possível obter as coordenadas da filial base:', error);
        baseCoordinates = null;
    }
}

async function updateCustomerCoordinates() {
    if (!lastCepData) {
        return;
    }

    const numero = numeroInput.value.trim();
    if (!numero) {
        customerCoordinates = null;
        distanceKm = null;
        refreshTotals();
        return;
    }

    const addressParts = [
        ruaInput.value,
        numero,
        bairroInput.value,
        `${cidadeInput.value} - ${estadoInput.value}`,
        'Brasil'
    ].filter(Boolean);

    try {
        customerCoordinates = await geocodeAddress(addressParts.join(', '));
        if (!baseCoordinates) {
            await initializeBaseCoordinates();
        }
        if (baseCoordinates) {
            const calculatedDistance = await fetchDistance(baseCoordinates, customerCoordinates);
            distanceKm = Number.isFinite(calculatedDistance) ? Number(calculatedDistance.toFixed(2)) : null;
        } else {
            distanceKm = null;
        }
    } catch (error) {
        console.error('Não foi possível calcular a distância:', error);
        customerCoordinates = null;
        distanceKm = null;
    }

    refreshTotals();
}

function renderChargesSummary() {
    const charges = [];
    charges.push({ label: 'Subtotal de serviços', amount: serviceSubtotal });

    if (distanceKm !== null) {
        const kmFormatted = distanceKm.toFixed(1);
        const exceedingKm = Math.max(0, distanceKm - DISTANCE_THRESHOLD_KM);
        if (exceedingKm > 0) {
            distanceSurcharge = Math.ceil(exceedingKm) * DISTANCE_FEE_PER_KM;
            charges.push({
                label: `Taxa de deslocamento (${kmFormatted} km)`,
                amount: distanceSurcharge
            });
            distanceInfoDiv.textContent = `Distância estimada até a filial: ${kmFormatted} km.`;
        } else {
            distanceSurcharge = 0;
            charges.push({
                label: `Deslocamento (${kmFormatted} km, sem taxa adicional)`,
                amount: 0
            });
            distanceInfoDiv.textContent = `Distância estimada até a filial: ${kmFormatted} km (dentro da área de cobertura).`;
        }
    } else {
        distanceSurcharge = 0;
        distanceInfoDiv.textContent = 'Informe CEP e número para calcular a distância até a filial.';
    }

    summaryChargesDiv.innerHTML = charges.map(charge => `
        <div class="summary-charge">
            <span>${charge.label}</span>
            <span>${formatCurrency(charge.amount)}</span>
        </div>
    `).join('');
}

function refreshTotals() {
    renderChargesSummary();
    const totalPrice = serviceSubtotal + distanceSurcharge;
    totalPriceSpan.textContent = formatCurrency(totalPrice);
const resumeFields = {
    nome: document.getElementById('resume-nome'),
    email: document.getElementById('resume-email'),
    telefone: document.getElementById('resume-telefone'),
    tipoImovel: document.getElementById('resume-tipo-imovel'),
    metragem: document.getElementById('resume-metragem'),
    cidade: document.getElementById('resume-cidade')
};

const stepForms = {
    1: document.getElementById('step-1-form'),
    2: document.getElementById('step-2-form')
};

const stepData = {
    currentStep: 1,
    step1: {},
    step2: {},
    services: []
};

function updateProgressBar(step) {
    const totalSteps = progressSteps.length;
    const progressPercent = ((step - 1) / (totalSteps - 1)) * 100;
    if (progressBarFill) {
        progressBarFill.style.width = `${progressPercent}%`;
    }

    progressSteps.forEach((progressStep) => {
        const stepNumber = Number(progressStep.dataset.step);
        progressStep.classList.toggle('active', stepNumber === step);
        progressStep.classList.toggle('completed', stepNumber < step);
    });
}

function prefillStepForms(step) {
    if (step === 1 && stepForms[1]) {
        const { nome = '', email = '', telefone = '' } = stepData.step1;
        const formElements = stepForms[1].elements;
        if (formElements.namedItem('nome')) formElements.namedItem('nome').value = nome;
        if (formElements.namedItem('email')) formElements.namedItem('email').value = email;
        if (formElements.namedItem('telefone')) formElements.namedItem('telefone').value = telefone;
    }

    if (step === 2 && stepForms[2]) {
        const { tipoImovel = '', metragem = '', cidade = '' } = stepData.step2;
        const formElements = stepForms[2].elements;
        if (formElements.namedItem('tipo-imovel')) formElements.namedItem('tipo-imovel').value = tipoImovel;
        if (formElements.namedItem('metragem')) formElements.namedItem('metragem').value = metragem;
        if (formElements.namedItem('cidade')) formElements.namedItem('cidade').value = cidade;
    }
}

function showStep(step) {
    stepSections.forEach((section) => {
        const sectionStep = Number(section.dataset.step);
        const isActive = sectionStep === step;
        section.classList.toggle('active', isActive);
        section.classList.toggle('hidden', !isActive);
    });

    updateProgressBar(step);
    prefillStepForms(step);

    if (step === 4) {
        populateResume();
    }

    if (stepsWrapper) {
        stepsWrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

function validateStep(step) {
    if (step === 1) {
        const form = stepForms[1];
        if (!form) return false;
        if (!form.reportValidity()) {
            return false;
        }
        const formElements = form.elements;
        stepData.step1 = {
            nome: formElements.namedItem('nome')?.value.trim() ?? '',
            email: formElements.namedItem('email')?.value.trim() ?? '',
            telefone: formElements.namedItem('telefone')?.value.trim() ?? ''
        };
        return true;
    }

    if (step === 2) {
        const form = stepForms[2];
        if (!form) return false;
        if (!form.reportValidity()) {
            return false;
        }
        const formElements = form.elements;
        stepData.step2 = {
            tipoImovel: formElements.namedItem('tipo-imovel')?.value ?? '',
            metragem: formElements.namedItem('metragem')?.value.trim() ?? '',
            cidade: formElements.namedItem('cidade')?.value.trim() ?? ''
        };
        return true;
    }

    if (step === 3) {
        const selectedServices = getSelectedServices();
        if (selectedServices.length === 0) {
            alert('Selecione ao menos um serviço para continuar.');
            return false;
        }
        stepData.services = selectedServices;
        return true;
    }

    return true;
}

function handleNavigation(action) {
    if (action === 'next') {
        if (!validateStep(stepData.currentStep)) {
            return;
        }
        if (stepData.currentStep < stepSections.length) {
            stepData.currentStep += 1;
            showStep(stepData.currentStep);
        }
    }

    if (action === 'prev') {
        if (stepData.currentStep > 1) {
            stepData.currentStep -= 1;
            showStep(stepData.currentStep);
        }
    }
}

function populateResume() {
    const { step1, step2 } = stepData;
    if (resumeFields.nome) resumeFields.nome.textContent = step1.nome || '-';
    if (resumeFields.email) resumeFields.email.textContent = step1.email || '-';
    if (resumeFields.telefone) resumeFields.telefone.textContent = step1.telefone || '-';

    if (resumeFields.tipoImovel) {
        const labels = {
            residencial: 'Residencial',
            comercial: 'Comercial',
            condominio: 'Condomínio'
        };
        resumeFields.tipoImovel.textContent = labels[step2.tipoImovel] || '-';
    }
    if (resumeFields.metragem) resumeFields.metragem.textContent = step2.metragem ? `${step2.metragem} m²` : '-';
    if (resumeFields.cidade) resumeFields.cidade.textContent = step2.cidade || '-';
}

function getSelectedServices() {
    const selectedServices = [];
    const inputs = serviceSelectionDiv?.querySelectorAll('input[type="checkbox"]:checked') ?? [];

    inputs.forEach((input) => {
        const serviceId = Number(input.dataset.serviceId);
        const service = priceTable.find((s) => s.id === serviceId);
        if (!service) return;

        let quantity = 1;
        if (service.type === 'quantity') {
            const quantityInput = serviceSelectionDiv.querySelector(`.quantity-input[data-service-id="${service.id}"]`);
            if (quantityInput) {
                quantity = Number(quantityInput.value) || service.min_quantity || 1;
            }
        }

        selectedServices.push({
            id: service.id,
            name: service.name,
            price: service.price,
            quantity
        });
    });

    return selectedServices;
}

function loadNavigationListeners() {
    const actionButtons = document.querySelectorAll('.step-actions button[data-action]');
    actionButtons.forEach((button) => {
        button.addEventListener('click', (event) => {
            event.preventDefault();
            const action = button.dataset.action;
            handleNavigation(action);
        });
    });
function setResumeState(state) {
    try {
        localStorage.setItem(RESUME_STATE_KEY, JSON.stringify({
            ...state,
            timestamp: new Date().toISOString()
        }));
    } catch (error) {
        console.warn('Não foi possível salvar o estado de retomada do orçamento.', error);
    }
}

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

// =================================================================================
// FUNÇÃO: BUSCAR OS SERVIÇOS DO SUPABASE
// =================================================================================
async function loadServices() {
    if (!serviceSelectionDiv) return;

    serviceSelectionDiv.innerHTML = '<p>Carregando serviços...</p>';

    const { data: servicos, error } = await supabase
        .from('servicos')
        .select('*')
        .eq('is_active', true)
        .order('id');

    if (error) {
        console.error('Erro ao buscar serviços:', error);
        serviceSelectionDiv.innerHTML = '<p>Erro ao carregar os serviços. Tente novamente mais tarde.</p>';
    } else {
        priceTable = servicos ?? [];
        renderServices();
    }
}

// =================================================================================
// FUNÇÃO DE RENDERIZAR
// =================================================================================
function renderServices() {
    if (!serviceSelectionDiv) return;

    serviceSelectionDiv.innerHTML = '';

    priceTable.forEach((service) => {
        let quantityInputHTML = '';
        if (service.type === 'quantity') {
            const minQuantity = service.min_quantity || 1;
            quantityInputHTML = `
                <div class="service-quantity">
                    <input type="number" class="quantity-input" min="${minQuantity}" value="${minQuantity}" data-service-id="${service.id}" disabled>
                    <span>${service.unit || ''}</span>
                </div>
            `;
        }

        const serviceHTML = `
            <div class="service-item">
                <input type="checkbox" id="service-${service.id}" data-service-id="${service.id}">
                <label for="service-${service.id}">
                    <strong>${service.name}</strong>
                    ${service.description ? `<small>${service.description}</small>` : ''}
                </label>
                ${quantityInputHTML}
            </div>
        `;
        serviceSelectionDiv.insertAdjacentHTML('beforeend', serviceHTML);
    });

    updateSummary();
}

// =================================================================================
// MOTOR DE CÁLCULO
// =================================================================================
function updateSummary() {
    serviceSubtotal = 0;
    let summaryHTML = '';
    const inputs = serviceSelectionDiv.querySelectorAll('input[type="checkbox"]');
    if (!serviceSelectionDiv || !summaryItemsDiv || !totalPriceSpan) return;

    const selectedServices = getSelectedServices();
    stepData.services = selectedServices;

    let totalPrice = 0;
    let summaryHTML = '';

            if (service.type === 'quantity') {
                const quantityInput = serviceSelectionDiv.querySelector(`.quantity-input[data-service-id="${service.id}"]`);
                quantity = parseInt(quantityInput.value);
                itemPrice = service.price * quantity;
            }

            serviceSubtotal += itemPrice;
            summaryHTML += `
                <div class="summary-item">
                    <span>${service.name} ${service.type === 'quantity' ? `(x${quantity})` : ''}</span>
                    <span>${formatCurrency(itemPrice)}</span>
                </div>
            `;
        }
    selectedServices.forEach((service) => {
        const quantityInfo = service.quantity > 1 ? `(x${service.quantity})` : '';
        const itemPrice = service.price * service.quantity;
        totalPrice += itemPrice;
        summaryHTML += `
            <div class="summary-item">
                <span>${service.name} ${quantityInfo}</span>
                <span>R$ ${itemPrice.toFixed(2).replace('.', ',')}</span>
            </div>
        `;
    });

    if (!summaryHTML) {
        summaryItemsDiv.innerHTML = '<p>Nenhum item selecionado.</p>';
    } else {
        summaryItemsDiv.innerHTML = summaryHTML;
    }

    refreshTotals();
}

// =================================================================================
// LÓGICA DE EVENTOS
// =================================================================================
if (serviceSelectionDiv) {
    serviceSelectionDiv.addEventListener('change', (event) => {
        if (event.target.matches('input[type="checkbox"]')) {
            const quantityInput = event.target.closest('.service-item')?.querySelector('.quantity-input');
            if (quantityInput) {
                quantityInput.disabled = !event.target.checked;
                if (!quantityInput.disabled && quantityInput.value === '') {
                    quantityInput.value = quantityInput.getAttribute('min') || 1;
                }
            }
        }
        updateSummary();
    });

    serviceSelectionDiv.addEventListener('input', (event) => {
        if (event.target.classList.contains('quantity-input')) {
            updateSummary();
        }
    });
}

loadNavigationListeners();
loadServices();
showStep(stepData.currentStep);
// --- INICIALIZAÇÃO ---
(async () => {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session || !session.user) {
        setResumeState({ stage: 'select-services', returnUrl: 'orcamento.html' });
        window.location.href = 'login.html';
        return;
    }

    const resumeState = getResumeState();
    if (resumeState?.stage === 'select-services') {
        clearResumeState();
    }

cepInput.addEventListener('input', () => {
    const digits = sanitizeCep(cepInput.value);
    if (digits.length <= 5) {
        cepInput.value = digits;
    } else {
        cepInput.value = `${digits.slice(0, 5)}-${digits.slice(5, 8)}`;
    }
});

cepInput.addEventListener('blur', fetchAddressByCep);
numeroInput.addEventListener('blur', updateCustomerCoordinates);
numeroInput.addEventListener('input', () => {
    if (lastCepData) {
        updateCustomerCoordinates();
    }
});

// --- INICIALIZAÇÃO ---
loadServices();
initializeBaseCoordinates();
renderChargesSummary();
    loadServices();
})();

// =================================================================================
// BOTÃO "AGENDAR VISITA"
// =================================================================================
scheduleBtn.addEventListener('click', async () => {

    const inputs = serviceSelectionDiv.querySelectorAll('input[type="checkbox"]:checked');
    if (inputs.length === 0) {
        alert('Por favor, selecione pelo menos um serviço.');
        return;
    }

    if (!cepInput.value.trim() || !numeroInput.value.trim()) {
        alert('Informe o CEP e o número do endereço para continuarmos.');
        return;
    }

    if (!ruaInput.value.trim() || !cidadeInput.value.trim()) {
        alert('Não foi possível validar o endereço informado. Confira o CEP digitado.');
        return;
    }

    if (distanceKm === null) {
        alert('Estamos calculando a distância até a filial. Aguarde um instante e tente novamente.');
        return;
    }

    const selectedServices = [];
    inputs.forEach(input => {
        const serviceId = parseInt(input.dataset.serviceId);
        const service = priceTable.find(s => s.id === serviceId);

        if (service) {
            let quantity = 1;
            if (service.type === 'quantity') {
                const quantityInput = serviceSelectionDiv.querySelector(
                    `.quantity-input[data-service-id="${service.id}"]`
                );
                quantity = parseInt(quantityInput.value);
            }

            selectedServices.push({
                id: service.id,
                name: service.name,
                price: service.price,
                quantity: quantity
            });
        }
    });

    const totalPrice = serviceSubtotal + distanceSurcharge;
scheduleBtn?.addEventListener('click', async () => {
    const selectedServices = getSelectedServices();
    if (selectedServices.length === 0) {
        alert('Por favor, selecione pelo menos um serviço.');
        return;
    }

    const totalPriceText = totalPriceSpan.textContent.replace(/R\$|\s/g, '').replace(/\./g, '').replace(',', '.');
    const totalPrice = parseFloat(totalPriceText) || 0;

    const orcamentoData = {
        cliente: stepData.step1,
        imovel: stepData.step2,
        servicos: selectedServices,
        subtotal_servicos: serviceSubtotal,
        distancia_km: distanceKm,
        taxa_deslocamento: distanceSurcharge,
        valor_total: totalPrice,
        endereco: {
            cep: sanitizeCep(cepInput.value),
            numero: numeroInput.value.trim(),
            complemento: complementoInput.value.trim(),
            rua: ruaInput.value,
            bairro: bairroInput.value,
            cidade: cidadeInput.value,
            estado: estadoInput.value
        },
        criado_em: new Date().toISOString()
    };
    localStorage.setItem('apexCareOrcamento', JSON.stringify(orcamentoData));

    // --- LÓGICA DE REDIRECIONAMENTO INTELIGENTE ---
    console.log('Verificando sessão do usuário...');
    const { data: { session } } = await supabase.auth.getSession();

    if (session && session.user) {
        console.log('Usuário logado. Redirecionando para agendamento...');
        window.location.href = 'agendamento.html';
    } else {
        console.log('Usuário não logado. Redirecionando para cadastro...');
        clearResumeState();
        // Se TEM uma sessão (usuário logado), vai direto para o agendamento
        console.log('Usuário logado. Redirecionando para agendamento...');
        window.location.href = 'agendamento.html';
    } else {
        // Se NÃO TEM sessão, vai para o cadastro
        console.log('Usuário não logado. Redirecionando para cadastro...');
        // Se NÃO TEM sessão, salva estado para retomar após autenticação e vai para o cadastro
        console.log("Usuário não logado. Redirecionando para cadastro...");
        setResumeState({ stage: 'schedule', returnUrl: 'agendamento.html' });
        window.location.href = 'cadastro.html';
    }
});
