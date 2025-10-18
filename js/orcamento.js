import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'https://xrajjehettusnbvjielf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhyYWpqZWhldHR1c25idmppZWxmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5NjE2NzMsImV4cCI6MjA3NTUzNzY3M30.LIl1PcGEA31y2TVYmA7zH7mnCPjot-s02LcQmu79e_U';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const RESUME_STATE_KEY = 'apexCareResumeState';
const BASE_LOCATION = {
    address: 'Rua Parecis, 28 - Canoas, Ibirité - MG, 32145-736, Brasil',
    latitude: null,
    longitude: null
};
const DISTANCE_THRESHOLD_KM = 20;
const DISTANCE_FEE_PER_KM = 1;

const stepSections = Array.from(document.querySelectorAll('.step-section'));
const progressSteps = Array.from(document.querySelectorAll('.progress-step'));
const progressBarFill = document.getElementById('progress-bar-fill');
const stepsWrapper = document.querySelector('.steps-wrapper');
const loginWarning = document.getElementById('login-warning');

const serviceSelectionDiv = document.getElementById('service-selection');
const summaryItemsDiv = document.getElementById('summary-items');
const summaryChargesDiv = document.getElementById('summary-charges');
const distanceInfoDiv = document.getElementById('distance-info');
const totalPriceSpan = document.getElementById('total-price');
const scheduleBtn = document.getElementById('finalize-budget-btn');

const cepInput = document.getElementById('cep-input');
const numeroInput = document.getElementById('numero-input');
const complementoInput = document.getElementById('complemento-input');
const ruaInput = document.getElementById('rua-input');
const bairroInput = document.getElementById('bairro-input');
const cidadeInput = document.getElementById('cidade-input');
const estadoInput = document.getElementById('estado-input');
const senhaInput = document.getElementById('senha-input');
const passwordWrapper = document.querySelector('[data-password-wrapper]');

const resumeFields = {
    nome: document.getElementById('resume-nome'),
    email: document.getElementById('resume-email'),
    telefone: document.getElementById('resume-telefone'),
    tipoImovel: document.getElementById('resume-tipo-imovel'),
    distancia: document.getElementById('resume-distancia'),
    cep: document.getElementById('resume-cep'),
    rua: document.getElementById('resume-rua'),
    numero: document.getElementById('resume-numero'),
    complemento: document.getElementById('resume-complemento'),
    bairro: document.getElementById('resume-bairro'),
    cidadeEstado: document.getElementById('resume-cidade-estado')
};

const stepForms = {
    1: document.getElementById('step-1-form'),
    2: document.getElementById('step-2-form')
};

const stepData = {
    step1: {},
    step2: {},
    services: []
};

let priceTable = [];
let currentSession = null;
let customerCoordinates = null;
let baseCoordinates = null;
let lastCepData = null;
let serviceSubtotal = 0;
let distanceKm = null;
let distanceSurcharge = 0;
let currentStep = 1;
let pendingServiceSelection = null;
let latestCepLookupId = 0;
let latestDistanceLookupId = 0;
let resumeStateRestored = false;
let pendingResumeState = null;
let step1Password = '';
let autoSignupCompleted = false;
let isCalculatingDistance = false;
let addressManager = null;
let selectedAddressId = null;

// ============= FUNÇÕES AUXILIARES =============

function formatCurrency(value) {
    return `R$ ${Number(value || 0).toFixed(2).replace('.', ',')}`;
}

function sanitizeCep(value) {
    return value.replace(/\D/g, '');
}

function applyCepMask(value) {
    const digits = sanitizeCep(value);
    if (digits.length <= 5) {
        return digits;
    }
    return `${digits.slice(0, 5)}-${digits.slice(5, 8)}`;
}

function setLoginWarningVisible(visible) {
    if (!loginWarning) return;
    loginWarning.classList.toggle('hidden', !visible);
}

function updatePasswordRequirement() {
    if (!senhaInput) return;
    const shouldHide = Boolean(currentSession);
    senhaInput.required = !shouldHide;
    senhaInput.disabled = shouldHide;
    senhaInput.setAttribute('autocomplete', shouldHide ? 'off' : 'new-password');

    if (shouldHide) {
        senhaInput.value = '';
        senhaInput.setCustomValidity('');
        passwordWrapper?.classList.add('is-hidden');
    } else {
        passwordWrapper?.classList.remove('is-hidden');
    }
}

function updateProgressBar(step) {
    const totalSteps = progressSteps.length || 1;
    const progressPercent = ((step - 1) / (totalSteps - 1)) * 100;
    if (progressBarFill) {
        progressBarFill.style.width = `${Math.max(0, Math.min(100, progressPercent))}%`;
    }

    progressSteps.forEach((progressStep) => {
        const stepNumber = Number(progressStep.dataset.step);
        progressStep.classList.toggle('active', stepNumber === step);
        progressStep.classList.toggle('completed', stepNumber < step);
    });
}

function prefillStepForms(step) {
    if (step === 1 && stepForms[1]) {
        const formElements = stepForms[1].elements;
        if (formElements.namedItem('nome')) formElements.namedItem('nome').value = stepData.step1.nome ?? '';
        if (formElements.namedItem('email')) formElements.namedItem('email').value = stepData.step1.email ?? '';
        if (formElements.namedItem('telefone')) formElements.namedItem('telefone').value = stepData.step1.telefone ?? '';
        if (senhaInput) senhaInput.value = '';
    }

    if (step === 2 && stepForms[2]) {
        const formElements = stepForms[2].elements;
        if (formElements.namedItem('tipo-imovel')) formElements.namedItem('tipo-imovel').value = stepData.step2.tipoImovel ?? '';
        if (cepInput) cepInput.value = stepData.step2.cep ? applyCepMask(stepData.step2.cep) : '';
        if (numeroInput) numeroInput.value = stepData.step2.numero ?? '';
        if (complementoInput) complementoInput.value = stepData.step2.complemento ?? '';
        if (ruaInput) ruaInput.value = stepData.step2.rua ?? '';
        if (bairroInput) bairroInput.value = stepData.step2.bairro ?? '';
        if (cidadeInput) cidadeInput.value = stepData.step2.cidadeDetalhe ?? '';
        if (estadoInput) estadoInput.value = stepData.step2.estado ?? '';
    }
}

function showStep(step) {
    currentStep = step;
    stepSections.forEach((section) => {
        const sectionStep = Number(section.dataset.step);
        const isActive = sectionStep === step;
        section.classList.toggle('active', isActive);
        section.classList.toggle('hidden', !isActive);
    });

    updateProgressBar(step);
    prefillStepForms(step);
    if (step === 1) {
        updatePasswordRequirement();
    }

    if (step === 4) {
        populateResume();
    }

    updateScheduleButtonState();

    if (stepsWrapper) {
        stepsWrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

function populateResume() {
    const { step1, step2 } = stepData;
    if (resumeFields.nome) resumeFields.nome.textContent = step1.nome || '-';
    if (resumeFields.email) resumeFields.email.textContent = step1.email || '-';
    if (resumeFields.telefone) resumeFields.telefone.textContent = step1.telefone || '-';

    const tipoLabels = {
        residencial: 'Residencial',
        comercial: 'Comercial',
        condominio: 'Condomínio'
    };

    if (resumeFields.tipoImovel) resumeFields.tipoImovel.textContent = tipoLabels[step2.tipoImovel] || '-';
    if (resumeFields.distancia) {
        resumeFields.distancia.textContent = Number.isFinite(distanceKm)
            ? `${distanceKm.toFixed(1)} km`
            : '-';
    }

    if (resumeFields.cep) resumeFields.cep.textContent = step2.cep ? applyCepMask(step2.cep) : '-';
    if (resumeFields.rua) resumeFields.rua.textContent = step2.rua || '-';
    if (resumeFields.numero) resumeFields.numero.textContent = step2.numero || '-';
    if (resumeFields.complemento) resumeFields.complemento.textContent = step2.complemento || '-';
    if (resumeFields.bairro) resumeFields.bairro.textContent = step2.bairro || '-';

    const cidadeEstadoText = step2.cidadeDetalhe && step2.estado
        ? `${step2.cidadeDetalhe} / ${step2.estado}`
        : step2.cidadeDetalhe || '-';
    if (resumeFields.cidadeEstado) resumeFields.cidadeEstado.textContent = cidadeEstadoText;
}

// ============= VALIDAÇÃO DOS STEPS =============

function validateStep(step) {
    console.log('🔍 Validando step:', step);

    if (step === 1) {
        const form = stepForms[1];
        if (!form) {
            console.error('❌ Formulário do step 1 não encontrado');
            return false;
        }

        const elements = form.elements;
        const nomeInput = elements.namedItem('nome');
        const emailInput = elements.namedItem('email');
        const telefoneInput = elements.namedItem('telefone');
        const passwordInput = elements.namedItem('senha');

        // Validar campos básicos
        if (!nomeInput?.value?.trim()) {
            alert('Por favor, preencha seu nome completo.');
            nomeInput?.focus();
            return false;
        }

        if (!emailInput?.value?.trim()) {
            alert('Por favor, preencha seu e-mail.');
            emailInput?.focus();
            return false;
        }

        if (!telefoneInput?.value?.trim()) {
            alert('Por favor, preencha seu telefone.');
            telefoneInput?.focus();
            return false;
        }

        // Validar senha APENAS se não estiver logado
        if (!currentSession && passwordInput) {
            const passwordValue = passwordInput.value ?? '';
            if (passwordValue.length < 6) {
                alert('Por favor, crie uma senha com pelo menos 6 caracteres.');
                passwordInput.focus();
                return false;
            }
            step1Password = passwordValue;
            console.log('✅ Senha capturada:', step1Password.length, 'caracteres');
        } else {
            step1Password = '';
            console.log('✅ Usuário já logado, senha não necessária');
        }

        // Salvar dados do step 1
        stepData.step1 = {
            nome: nomeInput.value.trim(),
            email: emailInput.value.trim(),
            telefone: telefoneInput.value.trim()
        };

        console.log('✅ Step 1 validado com sucesso');
        console.log('Dados:', stepData.step1);
        return true;
    }

    if (step === 2) {
        const form = stepForms[2];
        if (!form) return false;

        const nomeEnderecoInput = document.getElementById('nome-endereco');
        const tipoImovelSelect = document.getElementById('tipo-imovel');

        // Validar nome do endereço
        if (!nomeEnderecoInput?.value?.trim()) {
            alert('Por favor, dê um nome para este endereço (ex: Casa, Trabalho).');
            nomeEnderecoInput?.focus();
            switchAddressTab('new');
            return false;
        }

        // Validar tipo de imóvel
        if (!tipoImovelSelect?.value) {
            alert('Por favor, selecione o tipo de imóvel.');
            tipoImovelSelect?.focus();
            switchAddressTab('new');
            return false;
        }

        // Validar CEP
        if (cepInput) {
            const sanitizedCep = sanitizeCep(cepInput.value);
            if (sanitizedCep.length !== 8) {
                alert('Informe um CEP válido com 8 dígitos.');
                cepInput.focus();
                switchAddressTab('new');
                return false;
            }
        }

        // Validar número
        if (!numeroInput?.value?.trim()) {
            alert('Por favor, informe o número do endereço.');
            numeroInput?.focus();
            switchAddressTab('new');
            return false;
        }

        const cidadeValue = (cidadeInput?.value || lastCepData?.localidade || '').trim();

        if (!ruaInput?.value.trim() || !cidadeValue) {
            alert('Confirme um CEP válido e aguarde o preenchimento do endereço.');
            switchAddressTab('new');
            return false;
        }

        if (isCalculatingDistance) {
            alert('Estamos calculando a distância. Aguarde alguns segundos.');
            return false;
        }

        if (!Number.isFinite(distanceKm)) {
            alert('Aguarde o cálculo de distância antes de prosseguir.');
            return false;
        }

        const elements = form.elements;
        stepData.step2 = {
            nomeEndereco: nomeEnderecoInput.value.trim(),
            tipoImovel: tipoImovelSelect.value,
            cep: sanitizeCep(cepInput?.value || ''),
            numero: numeroInput?.value.trim() ?? '',
            complemento: complementoInput?.value.trim() ?? '',
            rua: ruaInput?.value.trim() ?? '',
            bairro: (bairroInput?.value || lastCepData?.bairro || '').trim(),
            cidadeDetalhe: cidadeValue,
            estado: estadoInput?.value.trim() ?? ''
        };

        // Salvar endereço se checkbox estiver marcado
        const saveAddressCheckbox = document.getElementById('save-address-checkbox');
        const isPrincipalCheckbox = document.getElementById('principal-address-checkbox');

        if (saveAddressCheckbox?.checked && currentSession?.user?.id) {
            saveNewAddress(
                stepData.step2,
                customerCoordinates,
                isPrincipalCheckbox?.checked || false
            );
        }

        return true;
    }


    if (step === 3) {
        if (!stepData.services.length) {
            alert('Selecione pelo menos um serviço para continuar.');
            return false;
        }
        return true;
    }

    return true;
}

async function saveNewAddress(addressData, coordinates, isPrincipal) {
    if (!addressManager) return;

    try {
        console.log('💾 Salvando novo endereço...');

        await addressManager.createAddress({
            nome_endereco: addressData.nomeEndereco,
            tipo_imovel: addressData.tipoImovel,
            cep: addressData.cep,
            rua: addressData.rua,
            numero: addressData.numero,
            complemento: addressData.complemento,
            bairro: addressData.bairro,
            cidade: addressData.cidadeDetalhe,
            estado: addressData.estado,
            latitude: coordinates?.latitude || null,
            longitude: coordinates?.longitude || null,
            is_principal: isPrincipal
        });

        console.log('✅ Endereço salvo com sucesso!');
        
        // Atualizar lista de endereços
        renderSavedAddresses();

    } catch (error) {
        console.error('Erro ao salvar endereço:', error);
        // Não bloqueia o fluxo, apenas loga o erro
    }
}

// ============= CRIAÇÃO AUTOMÁTICA DE CONTA =============

async function ensureCustomerAccount() {
    console.log('🔐 Verificando necessidade de criar conta...');
    console.log('currentSession:', !!currentSession);
    console.log('autoSignupCompleted:', autoSignupCompleted);

    // Se já está logado OU já criou conta, não precisa criar novamente
    if (currentSession || autoSignupCompleted) {
        console.log('✅ Conta já existe ou usuário já logado');
        return true;
    }

    const { step1 } = stepData;
    
    console.log('Dados step1:', step1);
    console.log('step1Password:', step1Password);

    if (!step1?.email || !step1Password) {
        alert('Erro: Dados incompletos. Por favor, preencha todos os campos.');
        return false;
    }

    console.log('🚀 Tentando criar conta automaticamente...');

    try {
        const { data, error } = await supabase.auth.signUp({
            email: step1.email,
            password: step1Password,
            options: {
                data: {
                    nome_completo: step1.nome || '',
                    whatsapp: step1.telefone || ''
                }
            }
        });

        if (error) {
            const message = error.message?.toLowerCase() ?? '';
            const alreadyExists = message.includes('already') || message.includes('exist');
            if (alreadyExists) {
                alert('Já existe uma conta com esse e-mail. Redirecionando para login...');
                setResumeState({ targetStep: 2 });
                window.location.href = 'login.html';
                return false;
            }

            console.error('❌ Erro ao criar conta:', error);
            alert('Não foi possível criar sua conta. Tente novamente.');
            return false;
        }

        let session = data?.session ?? null;
        const userId = data?.user?.id;

        // Se não tem sessão, tentar fazer login
        if (!session) {
            console.log('📝 Conta criada, fazendo login...');
            const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
                email: step1.email,
                password: step1Password
            });

            if (signInError) {
                console.warn('⚠️ Conta criada mas não foi possível autenticar automaticamente');
                alert('Enviamos um e-mail de confirmação. Após confirmar, faça login para continuar.');
                setResumeState({ targetStep: 2 });
                window.location.href = 'login.html';
                return false;
            }

            session = signInData?.session ?? null;
        }

        currentSession = session;
        autoSignupCompleted = true;
        step1Password = '';
        
        setLoginWarningVisible(false);
        updatePasswordRequirement();
        updateScheduleButtonState();

        console.log('✅ Conta criada e autenticada com sucesso!');

        // Atualizar perfil
        if (userId) {
            await supabase
                .from('profiles')
                .upsert({
                    id: userId,
                    nome_completo: step1.nome || null,
                    whatsapp: step1.telefone || null
                }, { onConflict: 'id' });
        }

        return true;

    } catch (error) {
        console.error('❌ Erro inesperado:', error);
        alert('Ocorreu um erro ao criar sua conta. Tente novamente.');
        return false;
    }
}

// ============= NAVEGAÇÃO ENTRE STEPS =============

async function handleNavigation(action) {
    console.log('🔄 Navegação:', action, 'Step atual:', currentStep);

    if (action === 'next') {
        // Validar step atual
        console.log('Validando step...');
        if (!validateStep(currentStep)) {
            console.log('❌ Validação falhou');
            return;
        }
        console.log('✅ Validação passou');

        // Se é step 1, verificar/criar conta
        if (currentStep === 1) {
            console.log('Step 1: verificando conta...');
            const accountReady = await ensureCustomerAccount();
            if (!accountReady) {
                console.log('❌ Conta não está pronta');
                return;
            }
            console.log('✅ Conta pronta');
        }

        const nextStep = Math.min(currentStep + 1, stepSections.length);
        
        // Verificar se precisa de login para steps 3+
        if (nextStep >= 3 && !currentSession) {
            alert('Para continuar, faça login. Suas informações foram salvas.');
            setResumeState({ targetStep: nextStep });
            window.location.href = 'login.html';
            return;
        }

        console.log('➡️ Avançando para step', nextStep);
        showStep(nextStep);
        return;
    }

    if (action === 'prev') {
        const prevStep = Math.max(1, currentStep - 1);
        console.log('⬅️ Voltando para step', prevStep);
        showStep(prevStep);
    }
}

// ============= SERVIÇOS =============

function getSelectedServices() {
    if (!serviceSelectionDiv) return [];

    const selectedServices = [];
    const inputs = serviceSelectionDiv.querySelectorAll('input[type="checkbox"]:checked');

    inputs.forEach((input) => {
        const serviceId = Number(input.dataset.serviceId);
        const service = priceTable.find((item) => item.id === serviceId);
        if (!service) return;

        let quantity = 1;
        if (service.type === 'quantity') {
            const quantityInput = serviceSelectionDiv.querySelector(`.quantity-input[data-service-id="${service.id}"]`);
            const minQuantity = service.min_quantity || 1;
            quantity = Math.max(minQuantity, Number(quantityInput?.value) || minQuantity);
        }

        selectedServices.push({
            id: service.id,
            name: service.name,
            price: Number(service.price) || 0,
            quantity
        });
    });

    return selectedServices;
}

function renderServices() {
    if (!serviceSelectionDiv) return;

    serviceSelectionDiv.innerHTML = '';

    if (!priceTable.length) {
        serviceSelectionDiv.innerHTML = '<p>Carregando serviços...</p>';
        updateSummary();
        return;
    }

    priceTable.forEach((service) => {
        const minQuantity = service.min_quantity || 1;
        const quantityInputHTML = service.type === 'quantity'
            ? `
                <div class="service-quantity">
                    <input type="number" class="quantity-input" min="${minQuantity}" value="${minQuantity}" data-service-id="${service.id}" disabled>
                    <span>${service.unit || ''}</span>
                </div>
            `
            : '';

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

    attachServiceListeners();
    applyPendingServiceSelection();
    updateSummary();
}

function attachServiceListeners() {
    if (!serviceSelectionDiv) return;

    serviceSelectionDiv.querySelectorAll('input[type="checkbox"]').forEach((checkbox) => {
        checkbox.addEventListener('change', () => {
            const serviceId = Number(checkbox.dataset.serviceId);
            const quantityInput = serviceSelectionDiv.querySelector(`.quantity-input[data-service-id="${serviceId}"]`);
            if (quantityInput) {
                quantityInput.disabled = !checkbox.checked;
                if (checkbox.checked && !quantityInput.value) {
                    const service = priceTable.find((item) => item.id === serviceId);
                    quantityInput.value = service?.min_quantity || 1;
                }
            }
            updateSummary();
        });
    });

    serviceSelectionDiv.addEventListener('input', (event) => {
        if ((event.target).classList?.contains('quantity-input')) {
            updateSummary();
        }
    });
}

function applyPendingServiceSelection() {
    if (!pendingServiceSelection || !pendingServiceSelection.length) return;
    if (!serviceSelectionDiv) return;

    pendingServiceSelection.forEach((serviceState) => {
        const checkbox = serviceSelectionDiv.querySelector(`input[type="checkbox"][data-service-id="${serviceState.id}"]`);
        const quantityInput = serviceSelectionDiv.querySelector(`.quantity-input[data-service-id="${serviceState.id}"]`);
        if (checkbox) checkbox.checked = true;
        if (quantityInput) {
            quantityInput.disabled = false;
            quantityInput.value = serviceState.quantity;
        }
    });

    pendingServiceSelection = null;
}

function updateSummary() {
    const selectedServices = getSelectedServices();
    stepData.services = selectedServices;

    if (!selectedServices.length) {
        summaryItemsDiv.innerHTML = '<p>Nenhum item selecionado.</p>';
        serviceSubtotal = 0;
    } else {
        const itemsHTML = selectedServices.map((service) => {
            const itemTotal = service.price * service.quantity;
            return `
                <div class="summary-item">
                    <span>${service.name}${service.quantity > 1 ? ` (x${service.quantity})` : ''}</span>
                    <span>${formatCurrency(itemTotal)}</span>
                </div>
            `;
        }).join('');
        summaryItemsDiv.innerHTML = itemsHTML;
        serviceSubtotal = selectedServices.reduce((total, service) => total + service.price * service.quantity, 0);
    }

    renderChargesSummary();
}

function renderChargesSummary() {
    const charges = [];
    charges.push({ label: 'Subtotal de serviços', amount: serviceSubtotal });

    if (Number.isFinite(distanceKm)) {
        const exceedingKm = Math.max(0, distanceKm - DISTANCE_THRESHOLD_KM);
        if (exceedingKm > 0) {
            distanceSurcharge = Math.ceil(exceedingKm) * DISTANCE_FEE_PER_KM;
            charges.push({
                label: `Taxa de deslocamento (${distanceKm.toFixed(1)} km)`,
                amount: distanceSurcharge
            });
            if (distanceInfoDiv) {
                distanceInfoDiv.textContent = `Distância: ${distanceKm.toFixed(1)} km. Taxa: ${formatCurrency(DISTANCE_FEE_PER_KM)}/km acima de ${DISTANCE_THRESHOLD_KM} km.`;
            }
        } else {
            distanceSurcharge = 0;
            charges.push({
                label: `Deslocamento (${distanceKm.toFixed(1)} km, sem taxa)`,
                amount: 0
            });
            if (distanceInfoDiv) {
                distanceInfoDiv.textContent = `Distância: ${distanceKm.toFixed(1)} km (até ${DISTANCE_THRESHOLD_KM} km sem taxa).`;
            }
        }
    } else {
        distanceSurcharge = 0;
        if (distanceInfoDiv) {
            distanceInfoDiv.textContent = `Informe CEP e número para calcular distância (até ${DISTANCE_THRESHOLD_KM} km sem taxa).`;
        }
    }

    summaryChargesDiv.innerHTML = charges.map((charge) => `
        <div class="summary-charge">
            <span>${charge.label}</span>
            <span>${formatCurrency(charge.amount)}</span>
        </div>
    `).join('');

    const totalPrice = serviceSubtotal + distanceSurcharge;
    totalPriceSpan.textContent = formatCurrency(totalPrice);
    updateScheduleButtonState();
}

function updateScheduleButtonState() {
    if (!scheduleBtn) return;
    const hasServices = stepData.services.length > 0;
    const canFinish = currentStep === 4 && hasServices && Number.isFinite(distanceKm);
    scheduleBtn.disabled = !canFinish || !currentSession;
}

// ============= RESUME STATE =============

function setResumeState(state) {
    try {
        const payload = {
            ...state,
            step1: stepData.step1,
            step2: stepData.step2,
            services: stepData.services,
            distanceKm,
            distanceSurcharge,
            timestamp: new Date().toISOString()
        };
        localStorage.setItem(RESUME_STATE_KEY, JSON.stringify(payload));
    } catch (error) {
        console.warn('Não foi possível salvar estado:', error);
    }
}

function getResumeState() {
    try {
        const stored = localStorage.getItem(RESUME_STATE_KEY);
        return stored ? JSON.parse(stored) : null;
    } catch (error) {
        console.warn('Não foi possível ler estado:', error);
        return null;
    }
}

function clearResumeState() {
    localStorage.removeItem(RESUME_STATE_KEY);
}

function queueResumeState() {
    pendingResumeState = getResumeState();
    if (currentSession) {
        applyResumeState();
    }
}

function applyResumeState() {
    if (!pendingResumeState || resumeStateRestored) return;

    stepData.step1 = pendingResumeState.step1 || {};
    stepData.step2 = pendingResumeState.step2 || {};
    stepData.services = pendingResumeState.services || [];
    pendingServiceSelection = stepData.services;

    distanceKm = Number.isFinite(pendingResumeState.distanceKm)
        ? Number(pendingResumeState.distanceKm)
        : null;
    distanceSurcharge = Number(pendingResumeState.distanceSurcharge) || 0;

    if (stepData.step2?.cep) {
        lastCepData = {
            logradouro: stepData.step2.rua || '',
            bairro: stepData.step2.bairro || '',
            localidade: stepData.step2.cidadeDetalhe || '',
            uf: stepData.step2.estado || ''
        };
    }

    const targetStep = Math.min(pendingResumeState.targetStep || 1, stepSections.length);
    showStep(targetStep);
    renderChargesSummary();

    resumeStateRestored = true;
    pendingResumeState = null;
    clearResumeState();
}

// ============= CEP E ENDEREÇO =============

function clearAddressFields() {
    if (ruaInput) ruaInput.value = '';
    if (bairroInput) bairroInput.value = '';
    if (cidadeInput) cidadeInput.value = '';
    if (estadoInput) estadoInput.value = '';
    customerCoordinates = null;
    distanceKm = null;
    lastCepData = null;
    renderChargesSummary();
}

async function fetchAddressByCep() {
    if (!cepInput) return;

    const sanitizedCep = sanitizeCep(cepInput.value);
    if (sanitizedCep.length !== 8) {
        clearAddressFields();
        return;
    }

    const lookupId = ++latestCepLookupId;

    try {
        const response = await fetch(`https://viacep.com.br/ws/${sanitizedCep}/json/`);
        if (!response.ok) throw new Error('Falha ao consultar CEP.');
        const data = await response.json();
        if (lookupId !== latestCepLookupId) return;
        if (data.erro) {
            alert('CEP não encontrado. Verifique e tente novamente.');
            clearAddressFields();
            return;
        }

        lastCepData = data;
        if (ruaInput) ruaInput.value = data.logradouro || '';
        if (bairroInput) bairroInput.value = data.bairro || '';
        if (cidadeInput) cidadeInput.value = data.localidade || '';
        if (estadoInput) estadoInput.value = data.uf || '';

        await updateCustomerCoordinates();
    } catch (error) {
        console.error('Erro ao buscar CEP:', error);
        alert('Não foi possível buscar o endereço.');
        clearAddressFields();
    }
}

// ============= GEOCODING E DISTÂNCIA =============

async function geocodeAddress(address) {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address)}`;
    const response = await fetch(url, {
        headers: {
            'Accept': 'application/json',
            'User-Agent': 'apex-care-orcamento/1.0'
        }
    });

    if (!response.ok) throw new Error('Falha na geocodificação.');

    const results = await response.json();
    if (!results || !results.length) throw new Error('Endereço não encontrado.');

    return {
        latitude: parseFloat(results[0].lat),
        longitude: parseFloat(results[0].lon)
    };
}

function haversineDistance(coord1, coord2) {
    const toRad = (value) => (value * Math.PI) / 180;
    const R = 6371;
    const dLat = toRad(coord2.latitude - coord1.latitude);
    const dLon = toRad(coord2.longitude - coord1.longitude);
    const lat1 = toRad(coord1.latitude);
    const lat2 = toRad(coord2.latitude);

    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
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
                return data.routes[0].distance / 1000;
            }
        }
        throw new Error('Sem rotas disponíveis');
    } catch (error) {
        console.warn('Usando distância em linha reta:', error);
        return haversineDistance(origin, destination);
    }
}

async function ensureBaseCoordinates() {
    if (baseCoordinates) return;

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
        console.error('Erro ao obter coordenadas da base:', error);
        baseCoordinates = null;
    }
}

async function updateCustomerCoordinates() {
    if (!lastCepData) {
        customerCoordinates = null;
        distanceKm = null;
        isCalculatingDistance = false;
        renderChargesSummary();
        return;
    }

    const numero = numeroInput?.value.trim();
    if (!numero) {
        customerCoordinates = null;
        distanceKm = null;
        isCalculatingDistance = false;
        renderChargesSummary();
        return;
    }

    const addressParts = [
        lastCepData.logradouro,
        numero,
        lastCepData.bairro,
        `${lastCepData.localidade} - ${lastCepData.uf}`,
        'Brasil'
    ].filter(Boolean);

    const lookupId = ++latestDistanceLookupId;
    isCalculatingDistance = true;
    if (distanceInfoDiv) {
        distanceInfoDiv.textContent = 'Calculando distância...';
    }

    try {
        customerCoordinates = await geocodeAddress(addressParts.join(', '));
        await ensureBaseCoordinates();
        if (!baseCoordinates) throw new Error('Coordenadas da base indisponíveis.');
        
        const calculatedDistance = await fetchDistance(baseCoordinates, customerCoordinates);
        if (lookupId !== latestDistanceLookupId) return;
        
        distanceKm = Number.isFinite(calculatedDistance) ? Number(calculatedDistance.toFixed(2)) : null;
    } catch (error) {
        console.error('Erro ao calcular distância:', error);
        if (lookupId !== latestDistanceLookupId) return;
        distanceKm = null;
        alert('Não conseguimos calcular a distância. Confira os dados.');
    } finally {
        if (lookupId === latestDistanceLookupId) {
            isCalculatingDistance = false;
        }
    }

    renderChargesSummary();
    updateScheduleButtonState();
}

// ============= CARREGAMENTO DE SERVIÇOS =============

async function loadServices() {
    if (!serviceSelectionDiv) return;

    serviceSelectionDiv.innerHTML = '<p>Carregando serviços...</p>';

    const { data: services, error } = await supabase
        .from('servicos')
        .select('*')
        .eq('is_active', true)
        .order('id');

    if (error) {
        console.error('Erro ao carregar serviços:', error);
        serviceSelectionDiv.innerHTML = '<p>Erro ao carregar os serviços.</p>';
        return;
    }

    priceTable = services || [];
    renderServices();
}

// ============= AUTENTICAÇÃO =============

async function initializeAuth() {
    const { data } = await supabase.auth.getSession();
    currentSession = data?.session ?? null;
    setLoginWarningVisible(!currentSession);
    updatePasswordRequirement();

    // Se já está logado, carregar dados do usuário
    if (currentSession?.user?.id) {
        await loadUserData(currentSession.user.id);
        await initAddressManager(currentSession.user.id);
    }

    supabase.auth.onAuthStateChange(async (_event, session) => {
        currentSession = session;
        setLoginWarningVisible(!session);
        updatePasswordRequirement();
        updateScheduleButtonState();
        
        if (session?.user?.id) {
            await loadUserData(session.user.id);
            await initAddressManager(session.user.id);
            applyResumeState();
        }
    });
}

async function initAddressManager(userId) {
    try {
        console.log('📍 Inicializando gerenciador de endereços...');
        
        // Criar instância do AddressManager
        addressManager = new window.AddressManager();
        await addressManager.init(userId);

        // Renderizar endereços no Step 2
        renderSavedAddresses();

        console.log('✅ Gerenciador de endereços inicializado');
    } catch (error) {
        console.error('Erro ao inicializar gerenciador de endereços:', error);
    }
}

// ============= ADICIONAR NOVA FUNÇÃO: Renderizar endereços salvos =============

function renderSavedAddresses() {
    if (!addressManager) return;

    addressManager.renderAddressList(
        'saved-addresses-list',
        // onSelect: Quando usuário clica em um endereço
        (address) => {
            console.log('📍 Endereço selecionado:', address.nome_endereco);
            selectedAddressId = address.id;
            fillAddressForm(address);
            // Automaticamente mudar para a tab de novo endereço para mostrar os dados
            switchAddressTab('new');
            // Desabilitar edição dos campos (apenas visualização)
            setAddressFormReadonly(true);
        },
        // onEdit: Quando usuário clica em "Editar"
        (address) => {
            console.log('✏️ Editando endereço:', address.nome_endereco);
            selectedAddressId = address.id;
            fillAddressForm(address);
            switchAddressTab('new');
            setAddressFormReadonly(false);
        },
        // onDelete: Quando usuário clica em "Excluir"
        null // Já tratado dentro do AddressManager
    );
}

// ============= ADICIONAR NOVA FUNÇÃO: Preencher formulário com endereço =============

function fillAddressForm(address) {
    const nomeEnderecoInput = document.getElementById('nome-endereco');
    const tipoImovelSelect = document.getElementById('tipo-imovel');
    
    if (nomeEnderecoInput) nomeEnderecoInput.value = address.nome_endereco;
    if (tipoImovelSelect) tipoImovelSelect.value = address.tipo_imovel;
    if (cepInput) cepInput.value = applyCepMask(address.cep);
    if (numeroInput) numeroInput.value = address.numero;
    if (complementoInput) complementoInput.value = address.complemento || '';
    if (ruaInput) ruaInput.value = address.rua;
    if (bairroInput) bairroInput.value = address.bairro;
    if (cidadeInput) cidadeInput.value = address.cidade;
    if (estadoInput) estadoInput.value = address.estado;

    // Atualizar lastCepData
    lastCepData = {
        logradouro: address.rua,
        bairro: address.bairro,
        localidade: address.cidade,
        uf: address.estado
    };

    // Calcular distância
    if (address.latitude && address.longitude) {
        customerCoordinates = {
            latitude: parseFloat(address.latitude),
            longitude: parseFloat(address.longitude)
        };
        // Recalcular distância
        updateCustomerCoordinates();
    }

    // Salvar dados no stepData
    stepData.step2 = {
        tipoImovel: address.tipo_imovel,
        cep: address.cep,
        numero: address.numero,
        complemento: address.complemento || '',
        rua: address.rua,
        bairro: address.bairro,
        cidadeDetalhe: address.cidade,
        estado: address.estado
    };
}

// ============= ADICIONAR NOVA FUNÇÃO: Habilitar/Desabilitar edição =============

function setAddressFormReadonly(readonly) {
    const nomeEnderecoInput = document.getElementById('nome-endereco');
    const tipoImovelSelect = document.getElementById('tipo-imovel');
    
    if (nomeEnderecoInput) nomeEnderecoInput.readOnly = readonly;
    if (tipoImovelSelect) tipoImovelSelect.disabled = readonly;
    if (cepInput) cepInput.readOnly = readonly;
    if (numeroInput) numeroInput.readOnly = readonly;
    if (complementoInput) complementoInput.readOnly = readonly;
}

// ============= MODIFICAR A VALIDAÇÃO DO STEP 2 =============

function validateStep(step) {
    console.log('🔍 Validando step:', step);

    if (step === 1) {
        // ... código existente ...
    }

    if (step === 2) {
        const form = stepForms[2];
        if (!form) return false;

        const nomeEnderecoInput = document.getElementById('nome-endereco');
        const tipoImovelSelect = document.getElementById('tipo-imovel');

        // Validar nome do endereço
        if (!nomeEnderecoInput?.value?.trim()) {
            alert('Por favor, dê um nome para este endereço (ex: Casa, Trabalho).');
            nomeEnderecoInput?.focus();
            switchAddressTab('new');
            return false;
        }

        // Validar tipo de imóvel
        if (!tipoImovelSelect?.value) {
            alert('Por favor, selecione o tipo de imóvel.');
            tipoImovelSelect?.focus();
            switchAddressTab('new');
            return false;
        }

        // Validar CEP
        if (cepInput) {
            const sanitizedCep = sanitizeCep(cepInput.value);
            if (sanitizedCep.length !== 8) {
                alert('Informe um CEP válido com 8 dígitos.');
                cepInput.focus();
                switchAddressTab('new');
                return false;
            }
        }

        // Validar número
        if (!numeroInput?.value?.trim()) {
            alert('Por favor, informe o número do endereço.');
            numeroInput?.focus();
            switchAddressTab('new');
            return false;
        }

        const cidadeValue = (cidadeInput?.value || lastCepData?.localidade || '').trim();

        if (!ruaInput?.value.trim() || !cidadeValue) {
            alert('Confirme um CEP válido e aguarde o preenchimento do endereço.');
            switchAddressTab('new');
            return false;
        }

        if (isCalculatingDistance) {
            alert('Estamos calculando a distância. Aguarde alguns segundos.');
            return false;
        }

        if (!Number.isFinite(distanceKm)) {
            alert('Aguarde o cálculo de distância antes de prosseguir.');
            return false;
        }

        const elements = form.elements;
        stepData.step2 = {
            nomeEndereco: nomeEnderecoInput.value.trim(),
            tipoImovel: tipoImovelSelect.value,
            cep: sanitizeCep(cepInput?.value || ''),
            numero: numeroInput?.value.trim() ?? '',
            complemento: complementoInput?.value.trim() ?? '',
            rua: ruaInput?.value.trim() ?? '',
            bairro: (bairroInput?.value || lastCepData?.bairro || '').trim(),
            cidadeDetalhe: cidadeValue,
            estado: estadoInput?.value.trim() ?? ''
        };

        // Salvar endereço se checkbox estiver marcado
        const saveAddressCheckbox = document.getElementById('save-address-checkbox');
        const isPrincipalCheckbox = document.getElementById('principal-address-checkbox');

        if (saveAddressCheckbox?.checked && currentSession?.user?.id) {
            saveNewAddress(
                stepData.step2,
                customerCoordinates,
                isPrincipalCheckbox?.checked || false
            );
        }

        return true;
    }

    if (step === 3) {
        // ... código existente ...
    }

    return true;
}

// ============= ADICIONAR NOVA FUNÇÃO: Salvar novo endereço =============

async function saveNewAddress(addressData, coordinates, isPrincipal) {
    if (!addressManager) return;

    try {
        console.log('💾 Salvando novo endereço...');

        await addressManager.createAddress({
            nome_endereco: addressData.nomeEndereco,
            tipo_imovel: addressData.tipoImovel,
            cep: addressData.cep,
            rua: addressData.rua,
            numero: addressData.numero,
            complemento: addressData.complemento,
            bairro: addressData.bairro,
            cidade: addressData.cidadeDetalhe,
            estado: addressData.estado,
            latitude: coordinates?.latitude || null,
            longitude: coordinates?.longitude || null,
            is_principal: isPrincipal
        });

        console.log('✅ Endereço salvo com sucesso!');
        
        // Atualizar lista de endereços
        renderSavedAddresses();

    } catch (error) {
        console.error('Erro ao salvar endereço:', error);
        // Não bloqueia o fluxo, apenas loga o erro
    }
}

// Carregar dados do usuário logado
async function loadUserData(userId) {
    try {
        console.log('👤 Carregando dados do usuário:', userId);

        const { data: profile, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();

        if (error) {
            console.error('Erro ao carregar perfil:', error);
            return;
        }

        if (!profile) return;

        console.log('✅ Perfil carregado:', profile);

        // Preencher dados do Step 1 automaticamente
        if (stepForms[1]) {
            const formElements = stepForms[1].elements;
            if (formElements.namedItem('nome')) {
                formElements.namedItem('nome').value = profile.nome_completo || '';
            }
            if (formElements.namedItem('email')) {
                formElements.namedItem('email').value = currentSession.user.email || '';
                formElements.namedItem('email').readOnly = true; // Email não pode ser editado
            }
            if (formElements.namedItem('telefone')) {
                formElements.namedItem('telefone').value = profile.whatsapp || '';
            }
        }

        // Salvar no stepData
        stepData.step1 = {
            nome: profile.nome_completo || '',
            email: currentSession.user.email || '',
            telefone: profile.whatsapp || ''
        };

        // Se tem endereço salvo, preencher Step 2
        if (profile.endereco && stepForms[2]) {
            // Tentar parsear o endereço (se for um JSON ou string)
            const endereco = profile.endereco;
            
            // Por enquanto, apenas pré-preenche o campo de endereço completo
            // TODO: Implementar múltiplos endereços salvos
            console.log('📍 Endereço salvo:', endereco);
        }

    } catch (error) {
        console.error('Erro ao carregar dados do usuário:', error);
    }
}


// ============= EVENT LISTENERS =============

function registerNavigationListeners() {
    document.querySelectorAll('.step-actions button[data-action]').forEach((button) => {
        button.addEventListener('click', async (event) => {
            event.preventDefault();
            const action = button.dataset.action;
            await handleNavigation(action);
        });
    });
}

function registerAddressListeners() {
    if (!cepInput) return;

    cepInput.addEventListener('input', () => {
        cepInput.value = applyCepMask(cepInput.value);
    });

    cepInput.addEventListener('blur', fetchAddressByCep);

    numeroInput?.addEventListener('blur', updateCustomerCoordinates);
    numeroInput?.addEventListener('input', () => {
        if (lastCepData) {
            updateCustomerCoordinates();
        }
    });
}

function registerScheduleListener() {
    if (!scheduleBtn) return;

    scheduleBtn.addEventListener('click', async (event) => {
        event.preventDefault();

        if (scheduleBtn.disabled) {
            if (!currentSession) {
                alert('Faça login para concluir o orçamento.');
                setResumeState({ targetStep: 4 });
                window.location.href = 'login.html';
            }
            return;
        }

        const selectedServices = getSelectedServices();
        if (!selectedServices.length) {
            alert('Selecione pelo menos um serviço.');
            return;
        }

        if (!Number.isFinite(distanceKm)) {
            alert('Calcule a distância antes de finalizar.');
            return;
        }

        if (!currentSession?.user?.id) {
            alert('Sessão expirada. Faça login novamente.');
            window.location.href = 'login.html';
            return;
        }

        const totalPrice = serviceSubtotal + distanceSurcharge;

        // Desabilitar botão durante processamento
        scheduleBtn.disabled = true;
        scheduleBtn.textContent = 'Criando agendamento...';

        try {
            console.log('💾 Criando agendamento no banco de dados...');

            // Criar agendamento no Supabase    
            const { data: agendamento, error } = await supabase
              .from("agendamentos")
              .insert({
                cliente_id: currentSession.user.id,
                servicos_escolhidos: selectedServices,
                valor_total: totalPrice,
                status_pagamento: "Pendente",
                distancia_km: distanceKm,
                taxa_deslocamento: distanceSurcharge,
              })
              .select()
              .single();

            if (error) {
                console.error('❌ Erro ao criar agendamento:', error);
                throw error;
            }

            console.log('✅ Agendamento criado com sucesso! ID:', agendamento.id);

            // Salvar dados completos do orçamento no localStorage (inclui distância)
            const orcamentoData = {
                cliente: stepData.step1,
                imovel: stepData.step2,
                servicos: selectedServices,
                subtotal_servicos: serviceSubtotal,
                distancia_km: distanceKm,
                taxa_deslocamento: distanceSurcharge,
                valor_total: totalPrice,
                agendamento_id: agendamento.id,
                criado_em: new Date().toISOString()
            };

            localStorage.setItem('apexCareOrcamento', JSON.stringify(orcamentoData));
            clearResumeState();

            // Redirecionar para página de agendamento
            window.location.href = 'agendamento.html';

        } catch (error) {
            console.error('❌ Erro ao criar agendamento:', error);
            alert(`Erro ao criar agendamento:\n\n${error.message}\n\nTente novamente.`);
            
            // Reabilitar botão
            scheduleBtn.disabled = false;
            scheduleBtn.textContent = 'Agendar Visita';
        }
    });
}

function registerServiceSummaryWatcher() {
    if (!summaryItemsDiv) return;

    const observer = new MutationObserver(() => {
        updateScheduleButtonState();
    });

    observer.observe(summaryItemsDiv, { childList: true, subtree: true });
}

window.switchAddressTab = function(tabName) {
    // Atualizar botões
    document.querySelectorAll('.address-tab-btn').forEach(btn => {
        const isActive = btn.dataset.tab === tabName;
        btn.classList.toggle('active', isActive);
        btn.style.borderBottomColor = isActive ? '#00A99D' : 'transparent';
        btn.style.color = isActive ? '#00A99D' : '#666';
    });

    // Atualizar conteúdo
    document.querySelectorAll('.address-tab-content').forEach(content => {
        const isActive = content.dataset.tabContent === tabName;
        content.style.display = isActive ? 'block' : 'none';
        content.classList.toggle('active', isActive);
    });

    // Se mudou para "novo endereço" e não tem endereço selecionado, limpar form
    if (tabName === 'new' && !selectedAddressId) {
        setAddressFormReadonly(false);
    }
};

// Adicionar event listeners nas tabs quando o DOM carregar
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.address-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            window.switchAddressTab(btn.dataset.tab);
        });
    });
});

// ============= INICIALIZAÇÃO =============

async function init() {
    if (!stepsWrapper) return;

    await initializeAuth();
    queueResumeState();

    registerNavigationListeners();
    registerAddressListeners();
    registerScheduleListener();
    registerServiceSummaryWatcher();

    if (!resumeStateRestored) {
        showStep(1);
    } else {
        showStep(currentStep);
    }
    
    renderChargesSummary();
    await ensureBaseCoordinates();
    await loadServices();

    if (pendingResumeState && currentSession) {
        applyResumeState();
    }
}

init();