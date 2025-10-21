import { supabase } from './supabase-client.js';
import { sanitizeCep, applyCepMask, fetchCepData } from './cep-utils.js';
import './address-manager.js';

/**
 * @fileoverview Handles profile configuration actions such as updating personal data,
 * managing addresses, changing passwords and deleting the account.
 */

const successBox = document.getElementById('success-msg');
const errorBox = document.getElementById('error-msg');
const tabButtons = Array.from(document.querySelectorAll('.tab-btn'));
const tabPanels = Array.from(document.querySelectorAll('.tab-panel'));

const profileForm = document.getElementById('perfil-form');
const profileCancelBtn = document.getElementById('perfil-cancelar-btn');
const passwordForm = document.getElementById('senha-form');
const deleteAccountBtn = document.getElementById('delete-account-btn');
const addAddressBtn = document.getElementById('add-address-btn');
const addressForm = document.getElementById('address-form');
const cancelAddressBtn = document.getElementById('cancel-address-btn');

const profileFields = {
  nome: document.getElementById('nome'),
  whatsapp: document.getElementById('whatsapp'),
  email: document.getElementById('email'),
  cep: document.getElementById('perfil-cep'),
  rua: document.getElementById('perfil-rua'),
  numero: document.getElementById('perfil-numero'),
  complemento: document.getElementById('perfil-complemento'),
  bairro: document.getElementById('perfil-bairro'),
  cidade: document.getElementById('perfil-cidade'),
  estado: document.getElementById('perfil-estado'),
};

const addressFields = {
  id: document.getElementById('address-id'),
  nome: document.getElementById('address-nome'),
  tipo: document.getElementById('address-tipo'),
  cep: document.getElementById('address-cep'),
  rua: document.getElementById('address-rua'),
  numero: document.getElementById('address-numero'),
  complemento: document.getElementById('address-complemento'),
  bairro: document.getElementById('address-bairro'),
  cidade: document.getElementById('address-cidade'),
  estado: document.getElementById('address-estado'),
};

let currentUser = null;
let currentProfile = null;
let addressManager = null;
let editingAddress = null;

/**
 * Initializes the tab switching interactions.
 */
function initTabs() {
  tabButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const target = button.dataset.tabTarget;
      tabButtons.forEach((btn) => {
        const isActive = btn === button;
        btn.classList.toggle('active', isActive);
        btn.setAttribute('aria-selected', String(isActive));
      });
      tabPanels.forEach((panel) => {
        const isActive = panel.dataset.tab === target;
        panel.classList.toggle('active', isActive);
        panel.setAttribute('aria-hidden', String(!isActive));
      });
    });
  });
}

/**
 * Displays a success message to the user.
 * @param {string} message - Message to display.
 */
function showSuccess(message) {
  if (successBox) {
    successBox.textContent = message;
    successBox.classList.add('is-visible');
  }
  if (errorBox) {
    errorBox.classList.remove('is-visible');
    errorBox.textContent = '';
  }
}

/**
 * Displays an error message to the user.
 * @param {string} message - Message to display.
 */
function showError(message) {
  if (errorBox) {
    errorBox.textContent = message;
    errorBox.classList.add('is-visible');
  }
  if (successBox) {
    successBox.classList.remove('is-visible');
    successBox.textContent = '';
  }
}

/**
 * Clears the currently visible feedback messages.
 */
function clearFeedback() {
  if (successBox) {
    successBox.classList.remove('is-visible');
    successBox.textContent = '';
  }
  if (errorBox) {
    errorBox.classList.remove('is-visible');
    errorBox.textContent = '';
  }
}

/**
 * Populates the personal data form with profile information.
 * @param {object|null} profile - Profile data from the database.
 * @param {object} metadata - Auth metadata fallback values.
 */
function populateProfileForm(profile, metadata = {}) {
  if (!profileFields.nome || !profileFields.whatsapp) {
    return;
  }

  profileFields.nome.value = profile?.nome_completo || metadata.nome_completo || metadata.full_name || '';
  profileFields.whatsapp.value = profile?.whatsapp || metadata.whatsapp || metadata.telefone || '';
  profileFields.email.value = currentUser?.email || metadata.email || '';

  profileFields.cep.value = profile?.cep ? applyCepMask(profile.cep) : '';
  profileFields.rua.value = profile?.rua || '';
  profileFields.numero.value = profile?.numero || '';
  profileFields.complemento.value = profile?.complemento || '';
  profileFields.bairro.value = profile?.bairro || '';
  profileFields.cidade.value = profile?.cidade || '';
  profileFields.estado.value = profile?.estado || '';

  if (profile?.cep) {
    profileFields.cep.dataset.lastCep = sanitizeCep(profile.cep);
  } else {
    delete profileFields.cep.dataset.lastCep;
  }
}

/**
 * Fetches the authenticated session and profile information.
 */
async function loadUserData() {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    showError('Não foi possível verificar sua sessão. Faça login novamente.');
    throw error;
  }

  const session = data?.session || null;
  if (!session?.user) {
    window.location.href = 'login.html';
    return;
  }

  currentUser = session.user;
  const metadata = currentUser.user_metadata || {};

  try {
    const { data: profileRows, error: profileError } = await supabase
      .from('profiles')
      .select('nome_completo, whatsapp, cep, rua, numero, complemento, bairro, cidade, estado')
      .eq('id', currentUser.id)
      .limit(1);

    if (profileError) {
      throw profileError;
    }

    currentProfile = profileRows?.[0] || null;
    populateProfileForm(currentProfile, metadata);
  } catch (profileErr) {
    console.error('Erro ao carregar perfil:', profileErr);
    currentProfile = null;
    populateProfileForm(null, metadata);
    showError('Não foi possível carregar seus dados de perfil. Tente novamente.');
  }
}

/**
 * Instantiates and renders the address manager for the authenticated user.
 */
async function initAddressManager() {
  if (!currentUser) return;
  const AddressManagerClass = window.AddressManager;
  if (!AddressManagerClass) {
    console.warn('AddressManager não foi carregado.');
    return;
  }

  addressManager = new AddressManagerClass();
  await addressManager.init(currentUser.id);

  // Wrap deleteAddress to show feedback on success.
  const originalDelete = addressManager.deleteAddress.bind(addressManager);
  addressManager.deleteAddress = async (addressId) => {
    await originalDelete(addressId);
    showSuccess('Endereço removido com sucesso.');
  };

  renderAddressList();
}

/**
 * Renders the list of addresses using AddressManager helpers.
 */
function renderAddressList() {
  if (!addressManager) return;

  addressManager.renderAddressList(
    'addresses-list',
    handleSelectAddress,
    handleEditAddress,
    () => true
  );
}

/**
 * Handles CEP input masking and automatic ViaCEP lookup.
 * @param {HTMLInputElement|null} cepInput - CEP input field.
 * @param {object} fields - Mapping of fields to auto-fill.
 * @param {() => void} [onError] - Callback when lookup fails.
 */
function setupCepAutoFill(cepInput, fields, onError) {
  if (!cepInput) return;

  let lookupId = 0;

  const runLookup = async () => {
    const sanitized = sanitizeCep(cepInput.value);
    if (sanitized.length !== 8) {
      delete cepInput.dataset.lastCep;
      return;
    }
    if (cepInput.dataset.lastCep === sanitized) {
      return;
    }

    const currentLookup = ++lookupId;

    try {
      const data = await fetchCepData(sanitized);
      if (currentLookup !== lookupId) {
        return;
      }
      cepInput.dataset.lastCep = sanitized;
      if (fields.rua && !fields.rua.value) fields.rua.value = data.logradouro || '';
      if (fields.bairro && !fields.bairro.value) fields.bairro.value = data.bairro || '';
      if (fields.cidade && !fields.cidade.value) fields.cidade.value = data.localidade || '';
      if (fields.estado && !fields.estado.value) fields.estado.value = data.uf || '';
    } catch (error) {
      if (currentLookup !== lookupId) {
        return;
      }
      console.error('Erro ao consultar CEP:', error);
      delete cepInput.dataset.lastCep;
      if (typeof onError === 'function') {
        onError(error);
      } else {
        showError(error instanceof Error ? error.message : 'Não foi possível buscar o CEP informado.');
      }
    }
  };

  const handleInput = (event) => {
    const masked = applyCepMask(event.target.value);
    if (masked !== event.target.value) {
      event.target.value = masked;
    }
    runLookup();
  };

  const handleBlur = () => {
    runLookup();
  };

  cepInput.addEventListener('input', handleInput);
  cepInput.addEventListener('blur', handleBlur);
}

/**
 * Handles address card selection to set the principal address.
 * @param {object} address - Selected address data.
 */
async function handleSelectAddress(address) {
  if (!addressManager || !address) return;
  if (address.is_principal) {
    showSuccess('Este endereço já é o principal.');
    return;
  }
  const confirmed = window.confirm(`Definir "${address.nome_endereco}" como endereço principal?`);
  if (!confirmed) return;

  try {
    await addressManager.setPrincipal(address.id);
    showSuccess('Endereço principal atualizado com sucesso.');
    await addressManager.loadAddresses();
    renderAddressList();
  } catch (error) {
    console.error('Erro ao definir endereço principal:', error);
    showError('Não foi possível atualizar o endereço principal.');
  }
}

/**
 * Opens the address form for creation or edition.
 * @param {object|null} address - Address data to edit, or null for creation.
 */
function openAddressForm(address = null) {
  editingAddress = address;
  if (!addressForm) return;

  addressForm.classList.remove('hidden');
  const title = document.getElementById('address-form-title');
  if (title) {
    title.textContent = address ? 'Editar endereço' : 'Novo endereço';
  }

  if (address) {
    addressFields.id.value = address.id;
    addressFields.nome.value = address.nome_endereco || '';
    addressFields.tipo.value = address.tipo_imovel || 'residencial';
    addressFields.cep.value = address.cep ? applyCepMask(address.cep) : '';
    addressFields.rua.value = address.rua || '';
    addressFields.numero.value = address.numero || '';
    addressFields.complemento.value = address.complemento || '';
    addressFields.bairro.value = address.bairro || '';
    addressFields.cidade.value = address.cidade || '';
    addressFields.estado.value = address.estado || '';
    if (address.cep) {
      addressFields.cep.dataset.lastCep = sanitizeCep(address.cep);
    }
  } else {
    addressForm.reset();
    addressFields.tipo.value = 'residencial';
    addressFields.id.value = '';
    delete addressFields.cep.dataset.lastCep;
  }
}

/**
 * Resets and hides the address form.
 */
function closeAddressForm() {
  editingAddress = null;
  if (!addressForm) return;
  addressForm.classList.add('hidden');
  addressForm.reset();
  addressFields.tipo.value = 'residencial';
  delete addressFields.cep.dataset.lastCep;
}

/**
 * Callback invoked when the user chooses to edit an address.
 * @param {object} address - The address to edit.
 */
function handleEditAddress(address) {
  clearFeedback();
  openAddressForm(address);
}

/**
 * Normalizes string values by trimming whitespace.
 * @param {string|null} value - Raw value.
 * @returns {string|null} Trimmed value or null.
 */
function normalize(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

/**
 * Handles submission of the personal data form.
 * @param {Event} event - Submit event.
 */
async function handleProfileSubmit(event) {
  event.preventDefault();
  if (!currentUser) return;

  clearFeedback();

  const payload = {
    nome_completo: normalize(profileFields.nome.value),
    whatsapp: normalize(profileFields.whatsapp.value),
    cep: null,
    rua: normalize(profileFields.rua.value),
    numero: normalize(profileFields.numero.value),
    complemento: normalize(profileFields.complemento.value),
    bairro: normalize(profileFields.bairro.value),
    cidade: normalize(profileFields.cidade.value),
    estado: normalize(profileFields.estado.value?.toUpperCase()),
  };

  const sanitizedCep = sanitizeCep(profileFields.cep.value);
  if (sanitizedCep.length === 8) {
    payload.cep = sanitizedCep;
  }

  try {
    const { error } = await supabase
      .from('profiles')
      .upsert({ id: currentUser.id, ...payload }, { onConflict: 'id' });

    if (error) {
      throw error;
    }

    await supabase.auth.updateUser({
      data: {
        nome_completo: payload.nome_completo,
        whatsapp: payload.whatsapp,
      },
    });

    currentProfile = { ...payload };
    if (payload.cep) {
      currentProfile.cep = payload.cep;
      profileFields.cep.dataset.lastCep = payload.cep;
    } else {
      delete profileFields.cep.dataset.lastCep;
    }

    populateProfileForm(currentProfile, currentUser.user_metadata || {});

    showSuccess('Dados atualizados com sucesso!');
    if (typeof window.authHelpers?.loadUserProfile === 'function') {
      window.authHelpers.loadUserProfile(currentUser.id);
    }
  } catch (error) {
    console.error('Erro ao atualizar perfil:', error);
    showError('Não foi possível salvar suas alterações. Tente novamente.');
  }
}

/**
 * Handles submission of the address form for creation or edition.
 * @param {Event} event - Submit event.
 */
async function handleAddressSubmit(event) {
  event.preventDefault();
  if (!addressManager) return;

  clearFeedback();

  const payload = {
    nome_endereco: normalize(addressFields.nome.value),
    tipo_imovel: addressFields.tipo.value || 'residencial',
    cep: sanitizeCep(addressFields.cep.value),
    rua: normalize(addressFields.rua.value),
    numero: normalize(addressFields.numero.value),
    complemento: normalize(addressFields.complemento.value),
    bairro: normalize(addressFields.bairro.value),
    cidade: normalize(addressFields.cidade.value),
    estado: normalize(addressFields.estado.value?.toUpperCase()),
  };

  if (payload.cep.length !== 8) {
    showError('Informe um CEP válido com 8 dígitos.');
    return;
  }

  try {
    if (editingAddress) {
      payload.is_principal = Boolean(editingAddress.is_principal);
      await addressManager.updateAddress(editingAddress.id, payload);
      showSuccess('Endereço atualizado com sucesso!');
    } else {
      payload.is_principal = addressManager.addresses.length === 0;
      await addressManager.createAddress(payload);
      if (payload.is_principal) {
        showSuccess('Endereço cadastrado como principal.');
      } else {
        showSuccess('Endereço cadastrado com sucesso!');
      }
    }

    await addressManager.loadAddresses();
    renderAddressList();
    closeAddressForm();
  } catch (error) {
    console.error('Erro ao salvar endereço:', error);
    showError('Não foi possível salvar o endereço. Verifique os dados e tente novamente.');
  }
}

/**
 * Handles password change submission.
 * @param {Event} event - Submit event.
 */
async function handlePasswordSubmit(event) {
  event.preventDefault();
  if (!currentUser) return;

  clearFeedback();

  const currentPassword = passwordForm.senha_atual.value;
  const newPassword = passwordForm.senha_nova.value;
  const confirmPassword = passwordForm.senha_confirma.value;

  if (!currentPassword || !newPassword) {
    showError('Preencha a senha atual e a nova senha.');
    return;
  }

  if (newPassword !== confirmPassword) {
    showError('A confirmação de senha não confere.');
    return;
  }

  if (newPassword.length < 6) {
    showError('A nova senha deve ter pelo menos 6 caracteres.');
    return;
  }

  const submitBtn = passwordForm.querySelector('button[type="submit"]');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Atualizando...';
  }

  try {
    const { error: reauthError } = await supabase.auth.signInWithPassword({
      email: currentUser.email,
      password: currentPassword,
    });

    if (reauthError) {
      throw new Error('Senha atual incorreta.');
    }

    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    if (updateError) {
      throw updateError;
    }

    showSuccess('Senha alterada com sucesso! Você será desconectado.');
    setTimeout(async () => {
      await supabase.auth.signOut();
      window.location.href = 'login.html';
    }, 2000);
  } catch (error) {
    console.error('Erro ao atualizar senha:', error);
    showError(error instanceof Error ? error.message : 'Não foi possível alterar a senha.');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = '🔑 Alterar senha';
    }
  }
}

/**
 * Handles account deletion with pending appointment validation.
 */
async function handleAccountDeletion() {
  if (!currentUser) return;

  clearFeedback();
  const confirmed = window.confirm('Tem certeza de que deseja excluir sua conta? Esta ação é irreversível.');
  if (!confirmed) return;

  try {
    const { data: appointments, error } = await supabase
      .from('agendamentos')
      .select('id, status, status_pagamento')
      .eq('cliente_id', currentUser.id);

    if (error) {
      throw error;
    }

    const blockedPaymentStatuses = new Set([
      'em aprovação',
      'aguardando agendamento',
      'aprovado',
      'pendente',
      'pendente (pagar no local)',
      'pago e confirmado',
      'confirmado',
      'agendado',
      'ativo',
    ]);
    const blockedStatuses = new Set(['pendente', 'ativo']);

    const hasBlocked = (appointments || []).some((appt) => {
      const status = (appt.status || '').toString().toLowerCase();
      const paymentStatus = (appt.status_pagamento || '').toString().toLowerCase();
      return blockedStatuses.has(status) || blockedPaymentStatuses.has(paymentStatus);
    });

    if (hasBlocked) {
      showError('Finalize ou cancele seus agendamentos pendentes antes de excluir a conta.');
      return;
    }

    await supabase.from('enderecos').delete().eq('user_id', currentUser.id);
    await supabase.from('profiles').delete().eq('id', currentUser.id);

    const { error: deleteError } = await supabase.auth.admin.deleteUser(currentUser.id);
    if (deleteError) {
      throw deleteError;
    }

    showSuccess('Conta excluída com sucesso. Você será redirecionado.');
    setTimeout(async () => {
      await supabase.auth.signOut();
      window.location.href = 'index.html';
    }, 2000);
  } catch (error) {
    console.error('Erro ao excluir conta:', error);
    const message =
      error instanceof Error && error.message.toLowerCase().includes('not authorized')
        ? 'Não foi possível excluir a conta automaticamente. Entre em contato com o suporte.'
        : 'Não foi possível excluir a conta. Tente novamente mais tarde.';
    showError(message);
  }
}

/**
 * Registers form and button event listeners.
 */
function registerEventListeners() {
  if (profileForm) {
    profileForm.addEventListener('submit', handleProfileSubmit);
  }
  if (profileCancelBtn) {
    profileCancelBtn.addEventListener('click', () => {
      populateProfileForm(currentProfile, currentUser?.user_metadata || {});
      clearFeedback();
    });
  }
  if (addressForm) {
    addressForm.addEventListener('submit', handleAddressSubmit);
  }
  if (cancelAddressBtn) {
    cancelAddressBtn.addEventListener('click', () => {
      closeAddressForm();
      clearFeedback();
    });
  }
  if (addAddressBtn) {
    addAddressBtn.addEventListener('click', () => {
      clearFeedback();
      openAddressForm();
    });
  }
  if (passwordForm) {
    passwordForm.addEventListener('submit', handlePasswordSubmit);
  }
  if (deleteAccountBtn) {
    deleteAccountBtn.addEventListener('click', handleAccountDeletion);
  }
}

/**
 * Initializes the profile configuration module.
 */
async function init() {
  initTabs();
  setupCepAutoFill(profileFields.cep, {
    rua: profileFields.rua,
    bairro: profileFields.bairro,
    cidade: profileFields.cidade,
    estado: profileFields.estado,
  });
  setupCepAutoFill(addressFields.cep, {
    rua: addressFields.rua,
    bairro: addressFields.bairro,
    cidade: addressFields.cidade,
    estado: addressFields.estado,
  });

  try {
    await loadUserData();
    await initAddressManager();
  } catch (error) {
    console.error('Erro durante a inicialização do perfil:', error);
    return;
  }

  registerEventListeners();
}

init();
