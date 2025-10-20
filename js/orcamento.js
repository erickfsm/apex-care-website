import { supabase } from "./supabase-client.js";
/**
 * @fileoverview Manages the multi-step budgeting and scheduling process for cleaning services.
 * @module orcamento
 */

// --- CONSTANTS ---
/** @constant {string} Key for storing the budget state in localStorage. */
const RESUME_STATE_KEY = "apexCareResumeState";
/** @constant {object} The base location of the company for distance calculations. */
const BASE_LOCATION = {
  address: "Rua Parecis, 28 - Canoas, Ibirité - MG, 32145-736, Brasil",
  latitude: null,
  longitude: null,
};
/** @constant {number} The distance in KM before a surcharge is applied. */
const DISTANCE_THRESHOLD_KM = 20;
/** @constant {number} The fee per KM for distances exceeding the threshold. */
const DISTANCE_FEE_PER_KM = 1;
/** @constant {number} The final step number in the form process. */
const FINAL_STEP = 6;

// --- DOM ELEMENT REFERENCES ---
const stepSections = Array.from(document.querySelectorAll(".step-section"));
const progressSteps = Array.from(document.querySelectorAll(".progress-step"));
const progressBarFill = document.getElementById("progress-bar-fill");
const stepIndicator = document.getElementById("step-indicator");
const stepsWrapper = document.querySelector(".steps-wrapper");
const loginWarning = document.getElementById("login-warning");

const serviceSelectionDiv = document.getElementById("service-selection");
const summaryItemsDiv = document.getElementById("summary-items");
const summaryChargesDiv = document.getElementById("summary-charges");
const distanceInfoDiv = document.getElementById("distance-info");
const totalPriceSpan = document.getElementById("total-price");
const summaryTotalContainer = document.querySelector(".summary-total");
const summaryLockedMessage = document.getElementById("summary-total-locked");
const scheduleBtn = document.getElementById("finalize-budget-btn");

const extremeConditionsForm = document.getElementById(
  "extreme-conditions-form"
);
const extremeDetailsInput = document.getElementById("extreme-details");
const resumeExtremeNotes = document.getElementById("resume-extreme-notes");

const cepInput = document.getElementById("cep-input");
const numeroInput = document.getElementById("numero-input");
const complementoInput = document.getElementById("complemento-input");
const ruaInput = document.getElementById("rua-input");
const bairroInput = document.getElementById("bairro-input");
const cidadeInput = document.getElementById("cidade-input");
const estadoInput = document.getElementById("estado-input");
const senhaInput = document.getElementById("senha-input");
const passwordWrapper = document.querySelector("[data-password-wrapper]");

const resumeFields = {
  nome: document.getElementById("resume-nome"),
  email: document.getElementById("resume-email"),
  telefone: document.getElementById("resume-telefone"),
  tipoImovel: document.getElementById("resume-tipo-imovel"),
  distancia: document.getElementById("resume-distancia"),
  cep: document.getElementById("resume-cep"),
  rua: document.getElementById("resume-rua"),
  numero: document.getElementById("resume-numero"),
  complemento: document.getElementById("resume-complemento"),
  bairro: document.getElementById("resume-bairro"),
  cidadeEstado: document.getElementById("resume-cidade-estado"),
};

const stepForms = {
  1: document.getElementById("step-1-form"),
  2: document.getElementById("step-2-form"),
  4: extremeConditionsForm,
};

// --- STATE VARIABLES ---
/** @type {object} Holds data for each step of the form. */
const stepData = {
  step1: {},
  step2: {},
  services: [],
  extremeConditions: {
    selections: [],
    observations: "",
  },
};

/** @type {Array<object>} The list of available services fetched from the database. */
let priceTable = [];
/** @type {object|null} The current Supabase session object. */
let currentSession = null;
/** @type {object|null} The geocoded coordinates of the customer's address. */
let customerCoordinates = null;
/** @type {object|null} The geocoded coordinates of the company's base location. */
let baseCoordinates = null;
/** @type {object|null} The last successfully fetched address data from ViaCEP. */
let lastCepData = null;
/** @type {number} The subtotal of selected services. */
let serviceSubtotal = 0;
/** @type {number|null} The calculated distance in kilometers. */
let distanceKm = null;
/** @type {number} The surcharge for distance. */
let distanceSurcharge = 0;
/** @type {number} The current active step in the form. */
let currentStep = 1;
/** @type {Array<object>|null} Temporary storage for service selections when restoring state. */
let pendingServiceSelection = null;
/** @type {number} A counter to manage asynchronous CEP lookups. */
let latestCepLookupId = 0;
/** @type {number} A counter to manage asynchronous distance calculations. */
let latestDistanceLookupId = 0;
/** @type {boolean} Flag to indicate if the resume state has been applied. */
let resumeStateRestored = false;
/** @type {object|null} The pending resume state object. */
let pendingResumeState = null;
/** @type {string} The password entered in step 1 for new user creation. */
let step1Password = "";
/** @type {boolean} Flag to indicate if auto-signup has been completed. */
let autoSignupCompleted = false;
/** @type {boolean} Flag to indicate if a distance calculation is in progress. */
let isCalculatingDistance = false;
/** @type {object|null} A cache for the user's profile data. */
let profileCache = null;
/** @type {boolean} Flag to determine if the form should auto-advance after authentication. */
let shouldAutoAdvanceAfterAuth = false;
/** @type {object|null} The promotions manager instance. */
let promocoesManager = null;
/** @type {number} The total charge for extreme conditions. */
let extremeConditionChargesTotal = 0;
/** @type {number} The last calculated total price. */
let lastCalculatedTotal = 0;
/** @type {number} The last calculated promotion discount. */
let lastPromotionDiscount = 0;
/** @type {object|null} Information about the last applied promotion. */
let lastPromotionInfo = null;


/**
 * Initializes the promotions manager if it hasn't been already.
 * @returns {Promise<object|null>} The promotions manager instance.
 */
async function ensurePromocoesManagerInitialized() {
  if (!currentSession?.user?.id) {
    return null;
  }

  if (!promocoesManager) {
    promocoesManager = new window.PromocoesManager();
    await promocoesManager.init(currentSession.user.id);
    promocoesManager.renderBannerPromocoes("promocoes-banner");
  }

  return promocoesManager;
}

/**
 * Formats a number as a Brazilian currency string.
 * @param {number} value - The number to format.
 * @returns {string} The formatted currency string.
 */
function formatCurrency(value) {
  return `R$ ${Number(value || 0)
    .toFixed(2)
    .replace(".", ",")}`;
}
/**
 * Sanitizes a CEP string by removing non-digit characters.
 * @param {string} value - The CEP string to sanitize.
 * @returns {string} The sanitized CEP string.
 */
function sanitizeCep(value) {
  return value.replace(/\D/g, "");
}
/**
 * Applies a mask to a CEP string (e.g., "12345-678").
 * @param {string} value - The CEP string to mask.
 * @returns {string} The masked CEP string.
 */
function applyCepMask(value) {
  const digits = sanitizeCep(value);
  if (digits.length <= 5) {
    return digits;
  }
  return `${digits.slice(0, 5)}-${digits.slice(5, 8)}`;
}
/**
 * Gets the current CEP value from the input or stored data.
 * @returns {string} The sanitized CEP value.
 */
function getCurrentCepValue() {
  const inputCep = cepInput?.value ? sanitizeCep(cepInput.value) : "";
  if (inputCep.length === 8) {
    return inputCep;
  }
  return stepData.step2?.cep ? sanitizeCep(stepData.step2.cep) : "";
}
/**
 * Gets the current address number value from the input or stored data.
 * @returns {string} The address number.
 */
function getCurrentNumeroValue() {
  const inputNumero = numeroInput?.value?.trim();
  if (inputNumero) {
    return inputNumero;
  }
  const storedNumero = stepData.step2?.numero;
  return typeof storedNumero === "string" ? storedNumero.trim() : "";
}
/**
 * Checks if a valid address is present to calculate totals.
 * @returns {boolean} True if the address is valid, false otherwise.
 */
function hasValidAddressForTotals() {
  const cepValue = getCurrentCepValue();
  const numeroValue = getCurrentNumeroValue();
  const ruaValue = (ruaInput?.value || stepData.step2?.rua || "").trim();
  const cidadeValue =
    (cidadeInput?.value || stepData.step2?.cidadeDetalhe || "").trim();
  const estadoValue = (estadoInput?.value || stepData.step2?.estado || "").trim();
  const hasAddressDetails = Boolean(
    lastCepData || (ruaValue && (cidadeValue || estadoValue))
  );

  return (
    cepValue.length === 8 &&
    numeroValue.length > 0 &&
    hasAddressDetails &&
    Number.isFinite(distanceKm)
  );
}
/**
 * Renders a status message with an optional spinner.
 * @param {HTMLElement} element - The element to render the message in.
 * @param {string} message - The message to display.
 * @param {object} [options={}] - Options for the status message.
 * @param {boolean} [options.isLoading=false] - Whether to show a spinner.
 */
function renderStatusMessage(element, message, { isLoading = false } = {}) {
  if (!element) return;

  element.textContent = "";
  const wrapper = document.createElement("span");
  wrapper.className = "status-indicator";

  if (isLoading) {
    const spinner = document.createElement("span");
    spinner.className = "status-indicator__spinner";
    spinner.setAttribute("aria-hidden", "true");
    wrapper.appendChild(spinner);
  }

  const textSpan = document.createElement("span");
  textSpan.className = "status-indicator__text";
  textSpan.textContent = message;
  wrapper.appendChild(textSpan);

  element.appendChild(wrapper);
}
/**
 * Sets the visibility of the login warning message.
 * @param {boolean} visible - Whether the warning should be visible.
 */
function setLoginWarningVisible(visible) {
  if (!loginWarning) return;
  loginWarning.classList.toggle("hidden", !visible);
}
/**
 * Updates the password input field based on the user's session state.
 */
function updatePasswordRequirement() {
  if (!senhaInput) return;
  const shouldHide = Boolean(currentSession);
  senhaInput.required = !shouldHide;
  senhaInput.disabled = shouldHide;
  senhaInput.setAttribute("autocomplete", shouldHide ? "off" : "new-password");

  if (shouldHide) {
    senhaInput.value = "";
    senhaInput.setCustomValidity("");
    passwordWrapper?.classList.add("is-hidden");
  } else {
    passwordWrapper?.classList.remove("is-hidden");
  }
}
/**
 * Updates the progress bar to reflect the current step.
 * @param {number} step - The current step number.
 */
function updateProgressBar(step) {
  const totalSteps = progressSteps.length || FINAL_STEP;
  const progressPercent = ((step - 1) / (totalSteps - 1)) * 100;
  if (progressBarFill) {
    progressBarFill.style.width = `${Math.max(
      0,
      Math.min(100, progressPercent)
    )}%`;
  }

  progressSteps.forEach((progressStep) => {
    const stepNumber = Number(progressStep.dataset.step);
    progressStep.classList.toggle("active", stepNumber === step);
    progressStep.classList.toggle("completed", stepNumber < step);
  });

  updateStepIndicator(step, totalSteps);
}
/**
 * Updates the step indicator text.
 * @param {number} step - The current step number.
 * @param {number} [totalSteps=FINAL_STEP] - The total number of steps.
 */
function updateStepIndicator(step, totalSteps = FINAL_STEP) {
  if (!stepIndicator) return;

  const section = stepSections.find(
    (item) => Number(item.dataset.step) === step
  );
  const headingText =
    section?.querySelector("h2")?.textContent?.trim() ||
    `Etapa ${step}`;

  stepIndicator.innerHTML = `
    <strong>Etapa ${step} de ${totalSteps}</strong>
    <span>${headingText}</span>
  `;
}
/**
 * Prefills the form for a given step with data from the state.
 * @param {number} step - The step number to prefill.
 */
function prefillStepForms(step) {
  if (step === 1 && stepForms[1]) {
    const formElements = stepForms[1].elements;
    if (formElements.namedItem("nome"))
      formElements.namedItem("nome").value = stepData.step1.nome ?? "";
    if (formElements.namedItem("email"))
      formElements.namedItem("email").value = stepData.step1.email ?? "";
    if (formElements.namedItem("telefone"))
      formElements.namedItem("telefone").value = stepData.step1.telefone ?? "";
    if (senhaInput) senhaInput.value = "";
  }

  if (step === 2 && stepForms[2]) {
    const formElements = stepForms[2].elements;
    if (formElements.namedItem("tipo-imovel"))
      formElements.namedItem("tipo-imovel").value =
        stepData.step2.tipoImovel ?? "";
    if (cepInput)
      cepInput.value = stepData.step2.cep
        ? applyCepMask(stepData.step2.cep)
        : "";
    if (numeroInput) numeroInput.value = stepData.step2.numero ?? "";
    if (complementoInput)
      complementoInput.value = stepData.step2.complemento ?? "";
    if (ruaInput) ruaInput.value = stepData.step2.rua ?? "";
    if (bairroInput) bairroInput.value = stepData.step2.bairro ?? "";
    if (cidadeInput) cidadeInput.value = stepData.step2.cidadeDetalhe ?? "";
    if (estadoInput) estadoInput.value = stepData.step2.estado ?? "";
  }

  if (step === 4 && stepForms[4]) {
    const selections = stepData.extremeConditions?.selections ?? [];
    const selectedIds = new Set(selections.map((item) => item.id));
    stepForms[4]
      .querySelectorAll('input[name="extreme-condition"]')
      .forEach((input) => {
        input.checked = selectedIds.has(input.value);
      });
    if (extremeDetailsInput) {
      extremeDetailsInput.value =
        stepData.extremeConditions?.observations ?? "";
    }
  }
}
/**
 * Displays a specific step of the form.
 * @param {number} step - The step number to show.
 */
function showStep(step) {
  currentStep = step;
  stepSections.forEach((section) => {
    const sectionStep = Number(section.dataset.step);
    const isActive = sectionStep === step;
    section.classList.toggle("active", isActive);
    section.classList.toggle("hidden", !isActive);
  });

  updateProgressBar(step);
  prefillStepForms(step);
  if (step === 1) {
    updatePasswordRequirement();
  }

  if (step >= 5) {
    populateResume();
    updateExtremeNotes();
  }

  updateSummaryVisibility();
  renderChargesSummary();

  if (stepsWrapper) {
    stepsWrapper.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}
/**
 * Populates the resume/summary section with data from the state.
 */
function populateResume() {
  const { step1, step2 } = stepData;
  if (resumeFields.nome) resumeFields.nome.textContent = step1.nome || "-";
  if (resumeFields.email) resumeFields.email.textContent = step1.email || "-";
  if (resumeFields.telefone)
    resumeFields.telefone.textContent = step1.telefone || "-";

  const tipoLabels = {
    residencial: "Residencial",
    comercial: "Comercial",
    condominio: "Condomínio",
  };

  if (resumeFields.tipoImovel)
    resumeFields.tipoImovel.textContent = tipoLabels[step2.tipoImovel] || "-";
  if (resumeFields.distancia) {
    resumeFields.distancia.textContent = Number.isFinite(distanceKm)
      ? `${distanceKm.toFixed(1)} km`
      : "-";
  }

  if (resumeFields.cep)
    resumeFields.cep.textContent = step2.cep ? applyCepMask(step2.cep) : "-";
  if (resumeFields.rua) resumeFields.rua.textContent = step2.rua || "-";
  if (resumeFields.numero)
    resumeFields.numero.textContent = step2.numero || "-";
  if (resumeFields.complemento)
    resumeFields.complemento.textContent = step2.complemento || "-";
  if (resumeFields.bairro)
    resumeFields.bairro.textContent = step2.bairro || "-";

  const cidadeEstadoText =
    step2.cidadeDetalhe && step2.estado
      ? `${step2.cidadeDetalhe} / ${step2.estado}`
      : step2.cidadeDetalhe || "-";
  if (resumeFields.cidadeEstado)
    resumeFields.cidadeEstado.textContent = cidadeEstadoText;
}
/**
 * Updates the extreme conditions notes in the resume section.
 */
function updateExtremeNotes() {
  if (!resumeExtremeNotes) return;

  const selections = stepData.extremeConditions?.selections ?? [];
  const observations = stepData.extremeConditions?.observations?.trim();

  if (observations) {
    resumeExtremeNotes.textContent = observations;
    return;
  }

  if (selections.length) {
    const labels = selections.map((item) => item.label).join(", ");
    resumeExtremeNotes.textContent = `Condições informadas: ${labels}.`;
    return;
  }

  resumeExtremeNotes.textContent = "Nenhuma observação adicional.";
}
/**
 * Captures the state of the extreme conditions form and updates the main state object.
 */
function captureExtremeConditionsState() {
  if (!extremeConditionsForm) return;

  const selectedInputs = Array.from(
    extremeConditionsForm.querySelectorAll(
      'input[name="extreme-condition"]:checked'
    )
  );

  const selections = selectedInputs.map((input) => ({
    id: input.value,
    label:
      input.dataset.label ||
      input.closest("label")?.textContent?.trim() ||
      input.value,
    amount: Number(input.dataset.additionalPrice) || 0,
  }));

  const observations = extremeDetailsInput?.value.trim() ?? "";

  stepData.extremeConditions = {
    selections,
    observations,
  };

  updateExtremeNotes();
  renderChargesSummary();
}

// ============= SERVICE SELECTION =============
/**
 * Gets the currently selected services and their quantities.
 * @returns {Array<object>} An array of selected service objects.
 */
function getSelectedServices() {
  if (!serviceSelectionDiv) {
    return [];
  }

  const selectedServices = [];
  const inputs = serviceSelectionDiv.querySelectorAll(
    'input[type="checkbox"]:checked'
  );

  inputs.forEach((input) => {
    const serviceId = Number(input.dataset.serviceId);
    const service = priceTable.find((item) => item.id === serviceId);
    if (!service) return;

    let quantity = 1;
    if (service.type === "quantity") {
      const quantityInput = serviceSelectionDiv.querySelector(
        `.quantity-input[data-service-id="${service.id}"]`
      );
      const minQuantity = service.min_quantity || 1;
      quantity = Math.max(
        minQuantity,
        Number(quantityInput?.value) || minQuantity
      );
    }

    selectedServices.push({
      id: service.id,
      name: service.name,
      price: Number(service.price) || 0,
      quantity,
    });
  });

  return selectedServices;
}
/**
 * Renders the list of available services in the DOM.
 */
function renderServices() {
  if (!serviceSelectionDiv) return;

  serviceSelectionDiv.innerHTML = "";

  if (!priceTable.length) {
    serviceSelectionDiv.innerHTML =
      "<p>Não encontramos serviços disponíveis no momento.</p>";
    updateSummary();
    return;
  }

  priceTable.forEach((service) => {
    const minQuantity = service.min_quantity || 1;
    const quantityInputHTML =
      service.type === "quantity"
        ? `
                <div class="service-quantity">
                    <input type="number" class="quantity-input" min="${minQuantity}" value="${minQuantity}" data-service-id="${
            service.id
          }" disabled>
                    <span>${service.unit || ""}</span>
                </div>
            `
        : "";

    const serviceHTML = `
            <div class="service-item">
                <input type="checkbox" id="service-${
                  service.id
                }" data-service-id="${service.id}">
                <label for="service-${service.id}">
                    <strong>${service.name}</strong>
                    ${
                      service.description
                        ? `<small>${service.description}</small>`
                        : ""
                    }
                </label>
                ${quantityInputHTML}
            </div>
        `;
    serviceSelectionDiv.insertAdjacentHTML("beforeend", serviceHTML);
  });

  attachServiceListeners();
  applyPendingServiceSelection();
  updateSummary();
}
/**
 * Attaches event listeners to the service selection inputs.
 */
function attachServiceListeners() {
  if (!serviceSelectionDiv) return;

  serviceSelectionDiv
    .querySelectorAll('input[type="checkbox"]')
    .forEach((checkbox) => {
      checkbox.addEventListener("change", () => {
        const serviceId = Number(checkbox.dataset.serviceId);
        const quantityInput = serviceSelectionDiv.querySelector(
          `.quantity-input[data-service-id="${serviceId}"]`
        );
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

  serviceSelectionDiv.addEventListener("input", (event) => {
    if (event.target.classList?.contains("quantity-input")) {
      updateSummary();
    }
  });
}
/**
 * Applies pending service selections from the resume state.
 */
function applyPendingServiceSelection() {
  if (!pendingServiceSelection || !pendingServiceSelection.length) return;
  if (!serviceSelectionDiv) return;

  pendingServiceSelection.forEach((serviceState) => {
    const checkbox = serviceSelectionDiv.querySelector(
      `input[type="checkbox"][data-service-id="${serviceState.id}"]`
    );
    const quantityInput = serviceSelectionDiv.querySelector(
      `.quantity-input[data-service-id="${serviceState.id}"]`
    );
    if (checkbox) {
      checkbox.checked = true;
    }
    if (quantityInput) {
      quantityInput.disabled = false;
      quantityInput.value = serviceState.quantity;
    }
  });

  pendingServiceSelection = null;
}

/**
 * Updates the summary section with the selected services and calculates the subtotal.
 */
function updateSummary() {
  const selectedServices = getSelectedServices();
  stepData.services = selectedServices;

  if (!selectedServices.length) {
    summaryItemsDiv.innerHTML = "<p>Nenhum item selecionado.</p>";
    serviceSubtotal = 0;
  } else {
    const itemsHTML = selectedServices
      .map((service) => {
        const itemTotal = service.price * service.quantity;
        return `
                <div class="summary-item">
                    <span>${service.name}${
          service.quantity > 1 ? ` (x${service.quantity})` : ""
        }</span>
                    <span>${formatCurrency(itemTotal)}</span>
                </div>
            `;
      })
      .join("");
    summaryItemsDiv.innerHTML = itemsHTML;
    serviceSubtotal = selectedServices.reduce(
      (total, service) => total + service.price * service.quantity,
      0
    );
  }

  renderChargesSummary();
}
/**
 * Renders the charges summary, including subtotal, distance fee, and promotions.
 */
async function renderChargesSummary() {
  const charges = [];
  const selectedServices = stepData.services || [];
  charges.push({ label: "Subtotal de serviços", amount: serviceSubtotal });

  const selections = stepData.extremeConditions?.selections ?? [];
  extremeConditionChargesTotal = selections.reduce(
    (total, selection) => total + (Number(selection.amount) || 0),
    0
  );

  selections.forEach((selection) => {
    charges.push({
      label: selection.label,
      amount: Number(selection.amount) || 0,
    });
  });

  if (Number.isFinite(distanceKm)) {
    const exceedingKm = Math.max(0, distanceKm - DISTANCE_THRESHOLD_KM);
    if (exceedingKm > 0) {
      distanceSurcharge = Math.ceil(exceedingKm) * DISTANCE_FEE_PER_KM;
      charges.push({
        label: `Taxa de deslocamento (${distanceKm.toFixed(
          1
        )} km, +${formatCurrency(
          DISTANCE_FEE_PER_KM
        )} por km acima de ${DISTANCE_THRESHOLD_KM} km)`,
        amount: distanceSurcharge,
      });
      if (distanceInfoDiv) {
        renderStatusMessage(
          distanceInfoDiv,
          `Distância estimada até a filial: ${distanceKm.toFixed(
            1
          )} km. Aplicamos ${formatCurrency(
            DISTANCE_FEE_PER_KM
          )} por quilômetro excedente após ${DISTANCE_THRESHOLD_KM} km.`
        );
      }
    } else {
      distanceSurcharge = 0;
      charges.push({
        label: `Deslocamento (${distanceKm.toFixed(1)} km, sem taxa adicional)`,
        amount: 0,
      });
      if (distanceInfoDiv) {
        renderStatusMessage(
          distanceInfoDiv,
          `Distância estimada até a filial: ${distanceKm.toFixed(
            1
          )} km (até ${DISTANCE_THRESHOLD_KM} km sem taxa adicional).`
        );
      }
    }
  } else {
    distanceSurcharge = 0;
    if (distanceInfoDiv) {
      renderStatusMessage(
        distanceInfoDiv,
        isCalculatingDistance
          ? "Calculando distância até a filial..."
          : `Informe CEP e número para calcular a distância (até ${DISTANCE_THRESHOLD_KM} km sem taxa adicional).`,
        { isLoading: isCalculatingDistance }
      );
    }
  }

  let descontoPromocao = 0;
  let mensagemPromocao = null;
  lastPromotionInfo = null;

  if (promocoesManager && selectedServices.length > 0) {
    try {
      const resultado = await promocoesManager.calcularMelhorPromocao(
        selectedServices,
        serviceSubtotal
      );
      descontoPromocao = resultado.desconto;
      mensagemPromocao = resultado.mensagem;
      if (resultado.promocao && descontoPromocao > 0) {
        lastPromotionInfo = {
          id: resultado.promocao.id,
          nome: resultado.promocao.nome,
          valor: descontoPromocao,
        };
      }
    } catch (error) {
      console.warn("Não foi possível calcular promoções:", error);
    }
  }

  if (descontoPromocao > 0) {
    charges.push({
      label: "✨ Desconto Promocional",
      amount: -descontoPromocao,
    });
  }

  if (summaryChargesDiv) {
    summaryChargesDiv.innerHTML = charges
      .map(
        (charge) => `
        <div class="summary-charge">
            <span>${charge.label}</span>
            <span>${formatCurrency(charge.amount)}</span>
        </div>
    `
      )
      .join("");

    if (mensagemPromocao) {
      summaryChargesDiv.innerHTML += `
            <div class="promo-message" style="
                background-color: #d4edda;
                border-left: 4px solid #28a745;
                padding: 12px;
                margin: 10px 0;
                border-radius: 5px;
                color: #155724;
                font-weight: 600;
            ">
                ${mensagemPromocao}
            </div>
        `;
    }
  }

  lastCalculatedTotal =
    serviceSubtotal + distanceSurcharge + extremeConditionChargesTotal -
    descontoPromocao;
  lastPromotionDiscount = descontoPromocao;

  if (totalPriceSpan) {
    totalPriceSpan.textContent = shouldRevealTotals()
      ? formatCurrency(lastCalculatedTotal)
      : "R$ --";
  }

  updateSummaryVisibility();
}
/**
 * Determines if the total price should be revealed.
 * @returns {boolean} True if totals should be shown, false otherwise.
 */
function shouldRevealTotals() {
  return stepData.services.length > 0 && hasValidAddressForTotals();
}
/**
 * Updates the visibility of summary elements based on the current state.
 */
function updateSummaryVisibility() {
  const revealTotals = shouldRevealTotals();
  const onFinalStep = currentStep >= FINAL_STEP;
  if (summaryTotalContainer) {
    summaryTotalContainer.classList.toggle("hidden", !revealTotals);
  }
  if (summaryLockedMessage) {
    summaryLockedMessage.classList.toggle("hidden", revealTotals);
  }
  if (scheduleBtn) {
    scheduleBtn.classList.toggle("hidden", !onFinalStep);
  }

  if (totalPriceSpan) {
    totalPriceSpan.textContent = revealTotals
      ? formatCurrency(lastCalculatedTotal)
      : "R$ --";
  }
  updateScheduleButtonState();
}
/**
 * Updates the state of the "finalize budget" button.
 */
function updateScheduleButtonState() {
  if (!scheduleBtn) return;
  const hasServices = stepData.services.length > 0;
  const totalsReady = shouldRevealTotals();
  const distanceReady = Number.isFinite(distanceKm);
  const canFinish =
    currentStep >= FINAL_STEP && totalsReady && hasServices && distanceReady;
  scheduleBtn.disabled = !canFinish || !currentSession;
}
/**
 * Saves the current state of the budget form to localStorage.
 * @param {object} state - Additional state to save.
 */
function setResumeState(state) {
  try {
    const payload = {
      ...state,
      step1: stepData.step1,
      step2: stepData.step2,
      services: stepData.services,
      extremeConditions: stepData.extremeConditions,
      distanceKm,
      distanceSurcharge,
      timestamp: new Date().toISOString(),
    };
    localStorage.setItem(RESUME_STATE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn("Não foi possível salvar o estado do orçamento.", error);
  }
}
/**
 * Retrieves the saved budget state from localStorage.
 * @returns {object|null} The saved state object, or null if not found.
 */
function getResumeState() {
  try {
    const stored = localStorage.getItem(RESUME_STATE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch (error) {
    console.warn("Não foi possível ler o estado salvo do orçamento.", error);
    return null;
  }
}
/**
 * Clears the saved budget state from localStorage.
 */
function clearResumeState() {
  localStorage.removeItem(RESUME_STATE_KEY);
}
/**
 * Queues the resume state to be applied once the session is initialized.
 */
async function queueResumeState() {
  pendingResumeState = getResumeState();
  if (currentSession) {
    await applyResumeState();
  }
}
/**
 * Applies the saved resume state to the form.
 */
async function applyResumeState() {
  if (!pendingResumeState || resumeStateRestored) return;

  stepData.step1 = pendingResumeState.step1 || {};
  stepData.step2 = pendingResumeState.step2 || {};
  stepData.services = pendingResumeState.services || [];
  stepData.extremeConditions =
    pendingResumeState.extremeConditions || {
      selections: [],
      observations: "",
    };
  pendingServiceSelection = stepData.services;

  distanceKm = Number.isFinite(pendingResumeState.distanceKm)
    ? Number(pendingResumeState.distanceKm)
    : null;
  distanceSurcharge = Number(pendingResumeState.distanceSurcharge) || 0;

  if (stepData.step2?.cep) {
    lastCepData = {
      logradouro: stepData.step2.rua || "",
      bairro: stepData.step2.bairro || "",
      localidade: stepData.step2.cidadeDetalhe || "",
      uf: stepData.step2.estado || "",
    };
  }

  const targetStep = Math.min(
    pendingResumeState.targetStep || 1,
    stepSections.length
  );
  if (currentSession) {
    await ensurePromocoesManagerInitialized();
  }
  showStep(targetStep);
  renderChargesSummary();

  resumeStateRestored = true;
  pendingResumeState = null;
  clearResumeState();
}
/**
 * Handles navigation between steps.
 * @param {string} action - The navigation action ('next' or 'prev').
 */
async function handleNavigation(action) {
  if (action === "next") {
    if (!validateStep(currentStep)) {
      return;
    }

    if (currentStep === 1) {
      const accountReady = await ensureCustomerAccount();
      if (!accountReady) {
        return;
      }
    }

    const nextStep = Math.min(currentStep + 1, stepSections.length);
    if (nextStep >= 3 && !currentSession) {
      alert(
        "Para continuar, faça login com sua conta. Estamos guardando suas informações."
      );
      setResumeState({ targetStep: nextStep });
      window.location.href = "login.html";
      return;
    }

    showStep(nextStep);
    return;
  }

  if (action === "prev") {
    const prevStep = Math.max(1, currentStep - 1);
    showStep(prevStep);
  }
}
/**
 * Validates the current step's form data.
 * @param {number} step - The step number to validate.
 * @returns {boolean} True if the step is valid, false otherwise.
 */
function validateStep(step) {
  if (step === 1) {
    const form = stepForms[1];
    if (!form) return false;
    const elements = form.elements;
    const passwordInput = elements.namedItem("senha");

    if (!currentSession && passwordInput) {
      const passwordValue = passwordInput.value ?? "";
      if (passwordValue.length < 6) {
        passwordInput.setCustomValidity(
          "Crie uma senha com pelo menos 6 caracteres."
        );
      } else {
        passwordInput.setCustomValidity("");
      }
    }

    if (!form.reportValidity()) {
      return false;
    }

    stepData.step1 = {
      nome: elements.namedItem("nome")?.value.trim() ?? "",
      email: elements.namedItem("email")?.value.trim() ?? "",
      telefone: elements.namedItem("telefone")?.value.trim() ?? "",
    };
    step1Password = currentSession
      ? ""
      : elements.namedItem("senha")?.value ?? "";
    return true;
  }

  if (step === 2) {
    const form = stepForms[2];
    if (!form) return false;

    if (cepInput) {
      const sanitizedCep = sanitizeCep(cepInput.value);
      if (sanitizedCep.length !== 8) {
        cepInput.setCustomValidity("Informe um CEP válido com 8 dígitos.");
      } else {
        cepInput.setCustomValidity("");
      }
    }

    if (!form.reportValidity()) {
      return false;
    }

    const cidadeValue = (
      cidadeInput?.value ||
      lastCepData?.localidade ||
      ""
    ).trim();

    if (!ruaInput?.value.trim() || !cidadeValue) {
      alert("Confirme um CEP válido e aguarde o preenchimento do endereço.");
      return false;
    }

    if (isCalculatingDistance) {
      alert(
        "Estamos calculando a distância. Aguarde alguns segundos e tente novamente."
      );
      return false;
    }

    if (!Number.isFinite(distanceKm)) {
      alert("Aguarde o cálculo de distância antes de prosseguir.");
      return false;
    }

    const elements = form.elements;
    stepData.step2 = {
      tipoImovel: elements.namedItem("tipo-imovel")?.value ?? "",
      cep: sanitizeCep(cepInput?.value || ""),
      numero: numeroInput?.value.trim() ?? "",
      complemento: complementoInput?.value.trim() ?? "",
      rua: ruaInput?.value.trim() ?? "",
      bairro: (bairroInput?.value || lastCepData?.bairro || "").trim(),
      cidadeDetalhe: cidadeValue,
      estado: estadoInput?.value.trim() ?? "",
    };

    return true;
  }

  if (step === 3) {
    if (!stepData.services.length) {
      alert("Selecione pelo menos um serviço para continuar.");
      return false;
    }
    return true;
  }

  if (step === 4) {
    captureExtremeConditionsState();
    return true;
  }

  return true;
}
/**
 * Fetches the user's profile from the database.
 * @param {string} userId - The ID of the user.
 * @returns {Promise<object|null>} The user profile object, or null if not found.
 */
async function fetchProfile(userId) {
  if (!userId) return null;

  if (
    profileCache?.id === userId &&
    Object.prototype.hasOwnProperty.call(profileCache, "data")
  ) {
    return profileCache.data;
  }

  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("nome_completo, whatsapp")
      .eq("id", userId)
      .single();

    if (error) {
      console.warn("Não foi possível buscar o perfil do cliente:", error);
      profileCache = { id: userId, data: null };
      return null;
    }

    profileCache = { id: userId, data };
    return data;
  } catch (error) {
    console.warn("Erro inesperado ao buscar o perfil do cliente:", error);
    profileCache = { id: userId, data: null };
    return null;
  }
}
/**
 * Applies contact data to the step 1 form.
 * @param {object} contactData - The contact data to apply.
 */
function applyStep1FormValues(contactData) {
  const form = stepForms[1];
  if (!form) return;

  const elements = form.elements;
  if (elements.namedItem("nome")) {
    elements.namedItem("nome").value = contactData.nome || "";
  }
  if (elements.namedItem("email")) {
    elements.namedItem("email").value = contactData.email || "";
  }
  if (elements.namedItem("telefone")) {
    elements.namedItem("telefone").value = contactData.telefone || "";
  }
}
/**
 * Hydrates the step 1 form with data from the current session.
 * @param {object} [options={}] - Options for hydration.
 * @param {boolean} [options.force=false] - Whether to force a re-fetch of the profile.
 * @returns {Promise<boolean>} True if the form was hydrated with required data, false otherwise.
 */
async function hydrateStep1FromSession({ force = false } = {}) {
  if (!currentSession?.user) {
    shouldAutoAdvanceAfterAuth = false;
    return false;
  }

  const user = currentSession.user;
  const existingData = stepData.step1 || {};

  let profile = profileCache?.id === user.id ? profileCache.data : null;
  if (force || profileCache?.id !== user.id) {
    profile = await fetchProfile(user.id);
  }

  const metadata = user.user_metadata || {};
  const contactData = {
    nome:
      existingData.nome ||
      profile?.nome_completo ||
      metadata.nome_completo ||
      metadata.full_name ||
      "",
    email: existingData.email || user.email || metadata.email || "",
    telefone:
      existingData.telefone ||
      profile?.whatsapp ||
      metadata.whatsapp ||
      metadata.telefone ||
      "",
  };

  stepData.step1 = contactData;
  applyStep1FormValues(contactData);

  const hasRequiredContact = Boolean(
    contactData.nome && contactData.email && contactData.telefone
  );
  shouldAutoAdvanceAfterAuth = hasRequiredContact;

  return hasRequiredContact;
}
/**
 * Ensures a customer account exists, creating one if necessary.
 * @returns {Promise<boolean>} True if an account is ready, false otherwise.
 */
async function ensureCustomerAccount() {
  if (currentSession || autoSignupCompleted) {
    return true;
  }

  const { step1 } = stepData;
  if (!step1?.email || !step1Password) {
    alert("Preencha seus dados de contato para criarmos sua conta.");
    return false;
  }

  try {
    const { data, error } = await supabase.auth.signUp({
      email: step1.email,
      password: step1Password,
      options: {
        data: {
          nome_completo: step1.nome || "",
          whatsapp: step1.telefone || "",
        },
      },
    });

    if (error) {
      const message = error.message?.toLowerCase() ?? "";
      const alreadyExists =
        message.includes("already") || message.includes("exist");
      if (alreadyExists) {
        alert(
          "Já existe uma conta com esse e-mail. Faça login para continuar."
        );
        setResumeState({ targetStep: 2 });
        window.location.href = "login.html";
        return false;
      }

      console.error("Erro ao criar conta automaticamente:", error);
      alert(
        "Não foi possível criar sua conta automaticamente. Tente novamente mais tarde ou utilize a página de cadastro."
      );
      return false;
    }

    let session = data?.session ?? null;
    const userId = data?.user?.id;

    if (!session) {
      const { data: signInData, error: signInError } =
        await supabase.auth.signInWithPassword({
          email: step1.email,
          password: step1Password,
        });

      if (signInError) {
        console.warn(
          "Conta criada, mas não foi possível autenticar automaticamente:",
          signInError
        );
        alert(
          "Enviamos um e-mail de confirmação. Após confirmar, faça login para continuar o orçamento."
        );
        setResumeState({ targetStep: 2 });
        window.location.href = "login.html";
        return false;
      }

      session = signInData?.session ?? null;
    }

    currentSession = session;
    autoSignupCompleted = true;
    step1Password = "";
    setLoginWarningVisible(false);
    updatePasswordRequirement();
    updateScheduleButtonState();

    if (userId) {
      const { error: profileError } = await supabase.from("profiles").upsert(
        {
          id: userId,
          nome_completo: step1.nome || null,
          whatsapp: step1.telefone || null,
        },
        { onConflict: "id" }
      );

      if (profileError) {
        console.warn(
          "Não foi possível atualizar o perfil automaticamente:",
          profileError
        );
      }
    }

    return true;
  } catch (error) {
    console.error("Erro inesperado ao tentar criar conta automática:", error);
    alert(
      "Ocorreu um erro ao criar sua conta. Tente novamente em instantes ou faça login manualmente."
    );
    return false;
  }
}
/**
 * Loads the list of services from the database.
 */
async function loadServices() {
  if (!serviceSelectionDiv) return;

  serviceSelectionDiv.innerHTML = "<p>Carregando serviços...</p>";

  const { data: services, error } = await supabase
    .from("servicos")
    .select("*")
    .eq("is_active", true)
    .order("id");

  if (error) {
    console.error("Erro ao carregar serviços:", error);
    serviceSelectionDiv.innerHTML =
      "<p>Erro ao carregar os serviços. Tente novamente mais tarde.</p>";
    return;
  }

  priceTable = services || [];
  renderServices();
}
/**
 * Clears the address fields in the form.
 */
function clearAddressFields() {
  if (ruaInput) ruaInput.value = "";
  if (bairroInput) bairroInput.value = "";
  if (cidadeInput) cidadeInput.value = "";
  if (estadoInput) estadoInput.value = "";
  customerCoordinates = null;
  distanceKm = null;
  lastCepData = null;
  renderChargesSummary();
}
/**
 * Fetches address details based on the entered CEP.
 */
async function fetchAddressByCep() {
  if (!cepInput) return;

  const sanitizedCep = sanitizeCep(cepInput.value);
  if (sanitizedCep.length !== 8) {
    clearAddressFields();
    return;
  }

  const lookupId = ++latestCepLookupId;

  try {
    const response = await fetch(
      `https://viacep.com.br/ws/${sanitizedCep}/json/`
    );
    if (!response.ok) throw new Error("Falha ao consultar CEP.");
    const data = await response.json();
    if (lookupId !== latestCepLookupId) {
      return;
    }
    if (data.erro) {
      alert("CEP não encontrado. Verifique e tente novamente.");
      clearAddressFields();
      return;
    }

    lastCepData = data;
    if (ruaInput) ruaInput.value = data.logradouro || "";
    if (bairroInput) bairroInput.value = data.bairro || "";
    if (cidadeInput) cidadeInput.value = data.localidade || "";
    if (estadoInput) estadoInput.value = data.uf || "";

    await updateCustomerCoordinates();
  } catch (error) {
    console.error("Erro ao buscar CEP:", error);
    alert("Não foi possível buscar o endereço pelo CEP informado.");
    clearAddressFields();
  }
}
/**
 * Geocodes an address string to get latitude and longitude.
 * @param {string} address - The address to geocode.
 * @returns {Promise<object>} An object with latitude and longitude.
 */
async function geocodeAddress(address) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(
    address
  )}`;
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "apex-care-orcamento/1.0",
    },
  });

  if (!response.ok) {
    throw new Error("Falha na geocodificação.");
  }

  const results = await response.json();
  if (!results || !results.length) {
    throw new Error("Endereço não encontrado.");
  }

  return {
    latitude: parseFloat(results[0].lat),
    longitude: parseFloat(results[0].lon),
  };
}
/**
 * Calculates the Haversine distance between two coordinates.
 * @param {object} coord1 - The first coordinate.
 * @param {object} coord2 - The second coordinate.
 * @returns {number} The distance in kilometers.
 */
function haversineDistance(coord1, coord2) {
  const toRad = (value) => (value * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(coord2.latitude - coord1.latitude);
  const dLon = toRad(coord2.longitude - coord1.longitude);
  const lat1 = toRad(coord1.latitude);
  const lat2 = toRad(coord2.latitude);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
/**
 * Fetches the driving distance between two coordinates using OSRM.
 * @param {object} origin - The origin coordinate.
 * @param {object} destination - The destination coordinate.
 * @returns {Promise<number>} The distance in kilometers.
 */
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
    throw new Error("Sem rotas disponíveis");
  } catch (error) {
    console.warn(
      "Falha ao consultar serviço de rotas, usando distância em linha reta.",
      error
    );
    return haversineDistance(origin, destination);
  }
}
/**
 * Ensures the base coordinates of the company are geocoded.
 */
async function ensureBaseCoordinates() {
  if (baseCoordinates) {
    return;
  }

  if (BASE_LOCATION.latitude && BASE_LOCATION.longitude) {
    baseCoordinates = {
      latitude: BASE_LOCATION.latitude,
      longitude: BASE_LOCATION.longitude,
    };
    return;
  }

  try {
    baseCoordinates = await geocodeAddress(BASE_LOCATION.address);
  } catch (error) {
    console.error(
      "Não foi possível obter as coordenadas da filial base:",
      error
    );
    baseCoordinates = null;
  }
}
/**
 * Updates the customer's coordinates and calculates the distance.
 */
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
    "Brasil",
  ].filter(Boolean);

  const lookupId = ++latestDistanceLookupId;
  distanceKm = null;
  isCalculatingDistance = true;
  if (distanceInfoDiv) {
    renderStatusMessage(distanceInfoDiv, "Calculando distância até a filial...", {
      isLoading: true,
    });
  }
  updateSummaryVisibility();

  try {
    customerCoordinates = await geocodeAddress(addressParts.join(", "));
    await ensureBaseCoordinates();
    if (!baseCoordinates) {
      throw new Error("Coordenadas da base indisponíveis.");
    }
    const calculatedDistance = await fetchDistance(
      baseCoordinates,
      customerCoordinates
    );
    if (lookupId !== latestDistanceLookupId) {
      return;
    }
    distanceKm = Number.isFinite(calculatedDistance)
      ? Number(calculatedDistance.toFixed(2))
      : null;
  } catch (error) {
    console.error("Não foi possível calcular a distância:", error);
    if (lookupId !== latestDistanceLookupId) {
      return;
    }
    distanceKm = null;
    alert(
      "Não conseguimos calcular a distância para o endereço informado. Confira os dados."
    );
  } finally {
    if (lookupId === latestDistanceLookupId) {
      isCalculatingDistance = false;
    }
  }

  renderChargesSummary();
}
/**
 * Initializes the authentication state and listeners.
 */
async function initializeAuth() {
  const { data } = await supabase.auth.getSession();
  currentSession = data?.session ?? null;
  setLoginWarningVisible(!currentSession);
  updatePasswordRequirement();

  if (currentSession) {
    await hydrateStep1FromSession({ force: true });
  } else {
    shouldAutoAdvanceAfterAuth = false;
  }

  supabase.auth.onAuthStateChange(async (_event, session) => {
    currentSession = session;
    setLoginWarningVisible(!session);
    updatePasswordRequirement();
    updateScheduleButtonState();

    if (session) {
      if (pendingResumeState) {
        await applyResumeState();
      }
      const contactReady = await hydrateStep1FromSession({ force: true });
      if (
        !pendingResumeState &&
        !resumeStateRestored &&
        currentStep === 1 &&
        contactReady
      ) {
        showStep(2);
      }
    } else {
      stepData.step1 = {};
      shouldAutoAdvanceAfterAuth = false;
      profileCache = null;
      if (currentStep !== 1) {
        showStep(1);
      }
    }
  });
}
/**
 * Registers event listeners for navigation buttons.
 */
function registerNavigationListeners() {
  document
    .querySelectorAll(".step-actions button[data-action]")
    .forEach((button) => {
      button.addEventListener("click", async (event) => {
        event.preventDefault();
        const action = button.dataset.action;
        await handleNavigation(action);
      });
    });
}
/**
 * Registers event listeners for address input fields.
 */
function registerAddressListeners() {
  if (!cepInput) return;

  cepInput.addEventListener("input", () => {
    cepInput.value = applyCepMask(cepInput.value);
  });

  cepInput.addEventListener("blur", fetchAddressByCep);

  numeroInput?.addEventListener("blur", updateCustomerCoordinates);
  numeroInput?.addEventListener("input", () => {
    if (lastCepData) {
      updateCustomerCoordinates();
    }
  });
}
/**
 * Registers event listeners for the extreme conditions form.
 */
function registerExtremeConditionsListeners() {
  if (!extremeConditionsForm) return;

  extremeConditionsForm.addEventListener("change", (event) => {
    if (event.target?.name === "extreme-condition") {
      captureExtremeConditionsState();
    }
  });

  extremeConditionsForm.addEventListener("input", (event) => {
    if (event.target === extremeDetailsInput) {
      captureExtremeConditionsState();
    }
  });
}
/**
 * Registers the event listener for the finalize budget button.
 */
function registerScheduleListener() {
  if (!scheduleBtn) return;

  scheduleBtn.addEventListener("click", async (event) => {
    event.preventDefault();

    if (scheduleBtn.disabled) {
      if (!currentSession) {
        alert("Faça login para concluir o orçamento.");
        setResumeState({ targetStep: FINAL_STEP });
        window.location.href = "login.html";
      }
      return;
    }

    const selectedServices = getSelectedServices();
    if (!selectedServices.length) {
      alert("Selecione ao menos um serviço.");
      return;
    }

    if (!Number.isFinite(distanceKm)) {
      alert("Calcule a distância antes de finalizar.");
      return;
    }

    const totalPrice = lastCalculatedTotal;

    const servicesPayload = selectedServices.map((service) => ({
      ...service,
      line_total: Number(service.price || 0) * Number(service.quantity || 1),
    }));

    const extremeSelections = stepData.extremeConditions?.selections ?? [];
    extremeSelections.forEach((selection) => {
      const amount = Number(selection.amount) || 0;
      servicesPayload.push({
        id: `extreme-${selection.id}`,
        name: selection.label,
        price: amount,
        quantity: 1,
        line_total: amount,
        type: "adjustment",
      });
    });

    if (distanceSurcharge > 0 && Number.isFinite(distanceKm)) {
      servicesPayload.push({
        id: "distance-surcharge",
        name: `Taxa de deslocamento (${distanceKm.toFixed(1)} km)`,
        price: distanceSurcharge,
        quantity: 1,
        line_total: distanceSurcharge,
        type: "adjustment",
      });
    }

    if (lastPromotionDiscount > 0) {
      servicesPayload.push({
        id: "promotion-discount",
        name: "Desconto Promocional",
        price: -lastPromotionDiscount,
        quantity: 1,
        line_total: -lastPromotionDiscount,
        type: "discount",
        promotion_id: lastPromotionInfo?.id || null,
        promotion_nome: lastPromotionInfo?.nome || null,
        promotion_valor: lastPromotionInfo?.valor || lastPromotionDiscount,
      });
    }

    const tipoImovelLabels = {
      residencial: "Residencial",
      comercial: "Comercial",
      condominio: "Condomínio",
    };

    if (stepData.step2) {
      const tipoImovel =
        tipoImovelLabels[stepData.step2.tipoImovel] ||
        stepData.step2.tipoImovel ||
        "Não informado";
      const cepFormatado = stepData.step2.cep
        ? applyCepMask(stepData.step2.cep)
        : "Não informado";
      const distanciaLabel = Number.isFinite(distanceKm)
        ? ` • Distância estimada ${distanceKm.toFixed(1)} km`
        : "";
      servicesPayload.push({
        id: "property-overview",
        name: `Dados do imóvel - ${tipoImovel} • CEP ${cepFormatado}${distanciaLabel}`,
        price: 0,
        quantity: 1,
        line_total: 0,
        type: "info",
        details: {
          cep: stepData.step2.cep || "",
          numero: stepData.step2.numero || "",
          complemento: stepData.step2.complemento || "",
          distanciaKm: distanceKm,
        },
      });
    }

    if (stepData.extremeConditions?.observations) {
      servicesPayload.push({
        id: "extreme-observations",
        name: `Observações adicionais: ${stepData.extremeConditions.observations}`,
        price: 0,
        quantity: 1,
        line_total: 0,
        type: "info",
      });
    }

    const extremeSelections = stepData.extremeConditions?.selections ?? [];
    const formattedExtremeSelections = extremeSelections
      .map((item) => item.label || item.id || "")
      .filter(Boolean)
      .join(", ");

    const backofficeAnnotations = [
      Number.isFinite(distanceKm)
        ? `Distância estimada: ${distanceKm.toFixed(1)} km`
        : null,
      Number.isFinite(distanceSurcharge)
        ? `Taxa de deslocamento: ${formatCurrency(distanceSurcharge)}`
        : null,
      Number.isFinite(extremeConditionChargesTotal)
        ? `Adicionais condições: ${formatCurrency(
            extremeConditionChargesTotal
          )}`
        : null,
      formattedExtremeSelections
        ? `Condições extremas selecionadas: ${formattedExtremeSelections}`
        : null,
      stepData.extremeConditions?.observations
        ? `Observações do cliente: ${stepData.extremeConditions.observations}`
        : null,
    ]
      .filter(Boolean)
      .join(" | ");

    const orcamentoData = {
      cliente: stepData.step1,
      imovel: stepData.step2,
      servicos: servicesPayload,
      subtotal_servicos: serviceSubtotal,
      distancia_km: distanceKm,
      taxa_deslocamento: distanceSurcharge,
      adicionais_condicoes: extremeConditionChargesTotal,
      condicoes_extremas: stepData.extremeConditions,
      observacoes: stepData.extremeConditions?.observations || "",
      anotacoes_backoffice: backofficeAnnotations,
      desconto_promocional: lastPromotionDiscount,
      promocao_aplicada: lastPromotionInfo,
      valor_total: totalPrice,
      criado_em: new Date().toISOString(),
    };

    try {
      const savedRecord = await persistBudgetForApproval(orcamentoData);
      const enrichedBudget = {
        ...orcamentoData,
        agendamento_id: savedRecord?.id || null,
        status_pagamento: savedRecord?.status_pagamento || "Em Aprovação",
        alreadyPersisted: true,
      };
      localStorage.setItem(
        "apexCareOrcamento",
        JSON.stringify(enrichedBudget)
      );
      clearResumeState();
      alert(
        "Orçamento enviado para aprovação! Nossa equipe revisará as informações e liberará o agendamento em seguida."
      );
      window.location.href = "portal-cliente.html";
    } catch (error) {
      console.error("Erro ao enviar orçamento para aprovação:", error);
      alert(
        "Não foi possível enviar seu orçamento para aprovação agora. Tente novamente em instantes ou fale com nosso atendimento."
      );
    }
  });
}
/**
 * Persists the budget data to the database for approval.
 * @param {object} orcamentoData - The budget data to persist.
 * @returns {Promise<object>} The saved record from the database.
 */
async function persistBudgetForApproval(orcamentoData) {
  if (!currentSession?.user?.id) {
    throw new Error("Sessão expirada. Faça login novamente.");
  }

  const clienteId = currentSession.user.id;

  const { data: existingList, error: fetchError } = await supabase
    .from("agendamentos")
    .select("id, status_pagamento, data_agendamento, hora_agendamento")
    .eq("cliente_id", clienteId)
    .in("status_pagamento", [
      "Em Aprovação",
      "Aprovado",
      "Aguardando Agendamento",
    ])
    .order("created_at", { ascending: false })
    .limit(1);

  if (fetchError) {
    throw fetchError;
  }

  const existingAppointment = existingList?.[0] || null;

  const sanitizedDistance = Number.isFinite(orcamentoData.distancia_km)
    ? Number(orcamentoData.distancia_km)
    : null;
  const sanitizedSurcharge = Number(orcamentoData.taxa_deslocamento) || 0;
  const sanitizedExtremeCharges = Number(
    orcamentoData.adicionais_condicoes
  ) || 0;

  const basePayload = {
    cliente_id: clienteId,
    servicos_escolhidos: orcamentoData.servicos,
    valor_total: orcamentoData.valor_total,
    status_pagamento: "Em Aprovação",
    desconto_aplicado: orcamentoData.desconto_promocional || 0,
    distancia_km: sanitizedDistance,
    taxa_deslocamento: sanitizedSurcharge,
    adicionais_condicoes: sanitizedExtremeCharges,
    condicoes_extremas: orcamentoData.condicoes_extremas || null,
    observacoes: orcamentoData.observacoes || "",
    anotacoes_backoffice: orcamentoData.anotacoes_backoffice || "",
    data_agendamento: null,
    hora_agendamento: null,
  };

  if (existingAppointment) {
    const updatePayload = { ...basePayload };

    if (
      ["Aprovado", "Aguardando Agendamento"].includes(
        existingAppointment.status_pagamento
      )
    ) {
      updatePayload.status_pagamento = existingAppointment.status_pagamento;
    }

    if (existingAppointment.data_agendamento) {
      updatePayload.data_agendamento = existingAppointment.data_agendamento;
    }

    if (existingAppointment.hora_agendamento) {
      updatePayload.hora_agendamento = existingAppointment.hora_agendamento;
    }

    const { data, error } = await supabase
      .from("agendamentos")
      .update(updatePayload)
      .eq("id", existingAppointment.id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  const { data, error } = await supabase
    .from("agendamentos")
    .insert(basePayload)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}
/**
 * Registers a MutationObserver to watch for changes in the service summary.
 */
function registerServiceSummaryWatcher() {
  if (!summaryItemsDiv) return;

  const observer = new MutationObserver(() => {
    updateScheduleButtonState();
  });

  observer.observe(summaryItemsDiv, { childList: true, subtree: true });
}
/**
 * Initializes the entire budgeting script.
 */
async function init() {
  if (!stepsWrapper) return;

  await initializeAuth();
  await queueResumeState();

  registerNavigationListeners();
  registerAddressListeners();
  registerExtremeConditionsListeners();
  registerScheduleListener();
  registerServiceSummaryWatcher();

  renderChargesSummary();
  await ensureBaseCoordinates();
  await loadServices();

  if (pendingResumeState && currentSession) {
    await applyResumeState();
    return;
  }

  if (resumeStateRestored) {
    if (currentSession) {
      await ensurePromocoesManagerInitialized();
    }
    showStep(currentStep);
    return;
  }

  let contactReady = false;
  if (currentSession) {
    contactReady = await hydrateStep1FromSession();
  }

  const initialStep =
    currentSession && shouldAutoAdvanceAfterAuth && contactReady ? 2 : 1;
  if (currentSession) {
    await ensurePromocoesManagerInitialized();
  }
  showStep(initialStep);
}

init();
