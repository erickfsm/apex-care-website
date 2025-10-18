// Importa a biblioteca do Supabase
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// Configura a conexão
const SUPABASE_URL = 'https://xrajjehettusnbvjielf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhyYWpqZWhldHR1c25idmppZWxmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5NjE2NzMsImV4cCI6MjA3NTUzNzY3M30.LIl1PcGEA31y2TVYmA7zH7mnCPjot-s02LcQmu79e_U';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Variável que vai guardar nossos preços vindos do banco de dados
let priceTable = [];

// Elementos do DOM
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
}

// =================================================================================
// FUNÇÃO: BUSCAR OS SERVIÇOS DO SUPABASE
// =================================================================================
async function loadServices() {
    serviceSelectionDiv.innerHTML = '<p>Carregando serviços...</p>';

    let { data: servicos, error } = await supabase
        .from('servicos')
        .select('*')
        .eq('is_active', true) // Pega apenas os serviços ativos
        .order('id'); // Ordena pelo ID

    if (error) {
        console.error('Erro ao buscar serviços:', error);
        serviceSelectionDiv.innerHTML = '<p>Erro ao carregar os serviços. Tente novamente mais tarde.</p>';
    } else {
        priceTable = servicos; // Salva os serviços na nossa variável global
        renderServices(); // Chama a função que desenha na tela
    }
}

// =================================================================================
// FUNÇÃO DE RENDERIZAR
// =================================================================================
function renderServices() {
    serviceSelectionDiv.innerHTML = '';
    priceTable.forEach(service => {

        let quantityInputHTML = '';
        if (service.type === 'quantity') {
            quantityInputHTML = `
                <input type="number" class="quantity-input" min="${service.min_quantity || 1}" value="${service.min_quantity || 1}" data-service-id="${service.id}" disabled>
                <span>${service.unit || ''}</span>
            `;
        }

        const serviceHTML = `
            <div class="service-item">
                <input type="checkbox" id="service-${service.id}" data-service-id="${service.id}">
                <label for="service-${service.id}">${service.name}</label>
                ${quantityInputHTML}
            </div>
        `;
        serviceSelectionDiv.innerHTML += serviceHTML;
    });
}

// =================================================================================
// MOTOR DE CÁLCULO
// =================================================================================
function updateSummary() {
    serviceSubtotal = 0;
    let summaryHTML = '';
    const inputs = serviceSelectionDiv.querySelectorAll('input[type="checkbox"]');

    inputs.forEach(input => {
        if (input.checked) {
            const serviceId = parseInt(input.dataset.serviceId);
            const service = priceTable.find(s => s.id === serviceId);
            if (!service) return;

            let itemPrice = service.price;
            let quantity = 1;

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
    });

    if (summaryHTML === '') {
        summaryItemsDiv.innerHTML = '<p>Nenhum item selecionado.</p>';
    } else {
        summaryItemsDiv.innerHTML = summaryHTML;
    }

    refreshTotals();
}

// =================================================================================
// LÓGICA DE EVENTOS
// =================================================================================
serviceSelectionDiv.addEventListener('change', (e) => {
    if (e.target.matches('input[type="checkbox"]')) {
        const quantityInput = e.target.parentElement.querySelector('.quantity-input');
        if (quantityInput) {
            quantityInput.disabled = !e.target.checked;
        }
    }
    updateSummary();
});

// Também atualiza o resumo quando muda a quantidade
serviceSelectionDiv.addEventListener('input', (e) => {
    if (e.target.classList.contains('quantity-input')) {
        updateSummary();
    }
});

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

// =================================================================================
// BOTÃO "AGENDAR VISITA" - CORRIGIDO ✅
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
    const orcamentoData = {
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
        // Se TEM uma sessão (usuário logado), vai direto para o agendamento
        console.log('Usuário logado. Redirecionando para agendamento...');
        window.location.href = 'agendamento.html';
    } else {
        // Se NÃO TEM sessão, vai para o cadastro
        console.log('Usuário não logado. Redirecionando para cadastro...');
        window.location.href = 'cadastro.html';
    }
});
