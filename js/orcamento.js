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
const totalPriceSpan = document.getElementById('total-price');
const scheduleBtn = document.getElementById('next-step-btn');

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
    let totalPrice = 0;
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
            
            totalPrice += itemPrice;
            summaryHTML += `
                <div class="summary-item">
                    <span>${service.name} ${service.type === 'quantity' ? `(x${quantity})` : ''}</span>
                    <span>R$ ${itemPrice.toFixed(2).replace('.', ',')}</span>
                </div>
            `;
        }
    });

    if (summaryHTML === '') {
        summaryItemsDiv.innerHTML = '<p>Nenhum item selecionado.</p>';
    } else {
        summaryItemsDiv.innerHTML = summaryHTML;
    }

    totalPriceSpan.textContent = `R$ ${totalPrice.toFixed(2).replace('.', ',')}`;
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

// --- INICIALIZAÇÃO ---
loadServices();

// =================================================================================
// BOTÃO "AGENDAR VISITA" - CORRIGIDO ✅
// =================================================================================
scheduleBtn.addEventListener('click', () => {
    
    const inputs = serviceSelectionDiv.querySelectorAll('input[type="checkbox"]:checked');

    if (inputs.length === 0) {
        alert("Por favor, selecione pelo menos um serviço.");
        return;
    }

    // ✅ CORREÇÃO: Coletar os serviços corretamente
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

    const totalPrice = parseFloat(totalPriceSpan.textContent.replace('R$ ', '').replace(',', '.'));

    // ✅ Cria o objeto do orçamento com os dados corretos
    const orcamentoData = {
        servicos: selectedServices,
        valor_total: totalPrice,
        criado_em: new Date().toISOString()
    };

    console.log("✅ Orçamento pronto para salvar:", orcamentoData);

    // Salva na memória e redireciona
    localStorage.setItem('apexCareOrcamento', JSON.stringify(orcamentoData));
    window.location.href = 'cadastro.html';
});