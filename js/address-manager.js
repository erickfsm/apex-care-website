// address-manager.js - Sistema de Gerenciamento de Endereços
import { supabase } from './supabase-client.js';
/**
 * @class AddressManager
 * @description Manages user addresses, including loading, creating, updating, and deleting addresses.
 */
class AddressManager {
    /**
     * @constructor
     */
    constructor() {
        /** @type {Array} */
        this.addresses = [];
        /** @type {string|null} */
        this.currentUser = null;
    }
    /**
     * @method init
     * @description Initializes the address manager for a specific user.
     * @param {string} userId - The ID of the user.
     */
    async init(userId) {
        this.currentUser = userId;
        await this.loadAddresses();
    }

    /**
     * @method loadAddresses
     * @description Loads all addresses for the current user from the database.
     * @returns {Promise<Array>} A promise that resolves to an array of addresses.
     */
    async loadAddresses() {
        try {
            const { data, error } = await supabase
                .from('enderecos')
                .select('*')
                .eq('user_id', this.currentUser)
                .order('is_principal', { ascending: false })
                .order('created_at', { ascending: false });

            if (error) throw error;

            this.addresses = data || [];
            console.log('📍 Endereços carregados:', this.addresses.length);
            return this.addresses;
        } catch (error) {
            console.error('Erro ao carregar endereços:', error);
            return [];
        }
    }

    /**
     * @method getPrincipalAddress
     * @description Gets the principal address of the user.
     * @returns {Object|null} The principal address object or null if not found.
     */
    getPrincipalAddress() {
        return this.addresses.find(addr => addr.is_principal) || this.addresses[0] || null;
    }

    /**
     * @method createAddress
     * @description Creates a new address for the current user.
     * @param {Object} addressData - The data for the new address.
     * @returns {Promise<Object>} A promise that resolves to the newly created address object.
     */
    async createAddress(addressData) {
        try {
            const { data, error } = await supabase
                .from('enderecos')
                .insert({
                    user_id: this.currentUser,
                    nome_endereco: addressData.nome_endereco,
                    tipo_imovel: addressData.tipo_imovel,
                    cep: addressData.cep,
                    rua: addressData.rua,
                    numero: addressData.numero,
                    complemento: addressData.complemento || null,
                    bairro: addressData.bairro,
                    cidade: addressData.cidade,
                    estado: addressData.estado,
                    is_principal: addressData.is_principal || false,
                    latitude: addressData.latitude || null,
                    longitude: addressData.longitude || null
                })
                .select()
                .single();

            if (error) throw error;

            console.log('✅ Endereço criado:', data.id);
            await this.loadAddresses();
            return data;
        } catch (error) {
            console.error('Erro ao criar endereço:', error);
            throw error;
        }
    }
    /**
     * @method updateAddress
     * @description Updates an existing address for the current user.
     * @param {string} addressId - The ID of the address to update.
     * @param {Object} addressData - The new data for the address.
     * @returns {Promise<Object>} A promise that resolves to the updated address object.
     */
    async updateAddress(addressId, addressData) {
        try {
            const { data, error } = await supabase
                .from('enderecos')
                .update({
                    nome_endereco: addressData.nome_endereco,
                    tipo_imovel: addressData.tipo_imovel,
                    cep: addressData.cep,
                    rua: addressData.rua,
                    numero: addressData.numero,
                    complemento: addressData.complemento || null,
                    bairro: addressData.bairro,
                    cidade: addressData.cidade,
                    estado: addressData.estado,
                    is_principal: addressData.is_principal || false,
                    latitude: addressData.latitude || null,
                    longitude: addressData.longitude || null
                })
                .eq('id', addressId)
                .select()
                .single();

            if (error) throw error;

            console.log('✅ Endereço atualizado:', addressId);
            await this.loadAddresses();
            return data;
        } catch (error) {
            console.error('Erro ao atualizar endereço:', error);
            throw error;
        }
    }

    /**
     * @method deleteAddress
     * @description Deletes an address for the current user.
     * @param {string} addressId - The ID of the address to delete.
     * @returns {Promise<void>} A promise that resolves when the address is deleted.
     */
    async deleteAddress(addressId) {
        try {
            const { error } = await supabase
                .from('enderecos')
                .delete()
                .eq('id', addressId);

            if (error) throw error;

            console.log('✅ Endereço deletado:', addressId);
            await this.loadAddresses();
        } catch (error) {
            console.error('Erro ao deletar endereço:', error);
            throw error;
        }
    }

    /**
     * @method setPrincipal
     * @description Sets an address as the principal address for the current user.
     * @param {string} addressId - The ID of the address to set as principal.
     * @returns {Promise<void>} A promise that resolves when the address is set as principal.
     */
    async setPrincipal(addressId) {
        try {
            // Inicia uma transação para garantir a consistência dos dados
            const { error: transactionError } = await supabase.rpc('set_principal_address', {
                user_id_param: this.currentUser,
                address_id_param: addressId
            });
            if (transactionError) throw transactionError;
            console.log('✅ Endereço definido como principal:', addressId);
            await this.loadAddresses();
        } catch (error) {
            console.error('Erro ao definir endereço principal:', error);
            throw error;
        }
    }

    /**
     * @method renderAddressList
     * @description Renders the list of addresses in the specified container.
     * @param {string} containerId - The ID of the container element.
     * @param {Function|null} onSelect - The callback function to execute when an address is selected.
     * @param {Function|null} onEdit - The callback function to execute when an address is edited.
     * @param {Function|null} onDelete - The callback function to execute when an address is deleted.
     */
    renderAddressList(containerId, onSelect = null, onEdit = null, onDelete = null) {
        const container = document.getElementById(containerId);
        if (!container) return;

        if (this.addresses.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 30px; background-color: #f4f6f9; border-radius: 8px;">
                    <p style="color: #666; margin-bottom: 15px;">📍 Você ainda não tem endereços salvos.</p>
                    <p style="color: #999; font-size: 0.9em;">Adicione um endereço para facilitar futuros agendamentos.</p>
                </div>
            `;
            return;
        }

        const addressesHTML = this.addresses.map(addr => {
            const isPrincipal = addr.is_principal ? '<span style="background-color: #00A99D; color: white; padding: 3px 8px; border-radius: 12px; font-size: 0.75em; font-weight: 700; margin-left: 8px;">PRINCIPAL</span>' : '';

            return `
                <div class="address-item" data-address-id="${addr.id}" style="background-color: white; padding: 20px; border-radius: 8px; margin-bottom: 15px; border: 2px solid ${addr.is_principal ? '#00A99D' : '#e5e7eb'}; cursor: pointer; transition: all 0.2s;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
                        <div style="flex: 1;">
                            <h4 style="margin: 0 0 5px 0; font-size: 1.1em; color: #2c3e50;">
                                ${addr.nome_endereco} ${isPrincipal}
                            </h4>
                            <p style="margin: 5px 0; color: #666; font-size: 0.9em;">
                                <strong>Tipo:</strong> ${addr.tipo_imovel === 'residencial' ? 'Residencial' : addr.tipo_imovel === 'comercial' ? 'Comercial' : 'Condomínio'}
                            </p>
                        </div>
                        <div class="address-actions" style="display: flex; gap: 8px;">
                            ${onEdit ? `<button class="btn-edit-address" data-id="${addr.id}" style="padding: 6px 12px; background-color: #f59e0b; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 0.85em;">✏️ Editar</button>` : ''}
                            ${onDelete && !addr.is_principal ? `<button class="btn-delete-address" data-id="${addr.id}" style="padding: 6px 12px; background-color: #ef4444; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 0.85em;">🗑️ Excluir</button>` : ''}
                        </div>
                    </div>
                    <div style="background-color: #f4f6f9; padding: 12px; border-radius: 5px; font-size: 0.9em; color: #555;">
                        <p style="margin: 3px 0;"><strong>CEP:</strong> ${addr.cep}</p>
                        <p style="margin: 3px 0;"><strong>Endereço:</strong> ${addr.rua}, ${addr.numero}${addr.complemento ? ' - ' + addr.complemento : ''}</p>
                        <p style="margin: 3px 0;"><strong>Bairro:</strong> ${addr.bairro}</p>
                        <p style="margin: 3px 0;"><strong>Cidade:</strong> ${addr.cidade} - ${addr.estado}</p>
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = addressesHTML;

        // Event listeners
        if (onSelect) {
            container.querySelectorAll('.address-item').forEach(item => {
                item.addEventListener('click', (e) => {
                    // Não disparar se clicar nos botões de ação
                    if (e.target.classList.contains('btn-edit-address') ||
                        e.target.classList.contains('btn-delete-address')) {
                        return;
                    }
                    const addressId = item.dataset.addressId;
                    const address = this.addresses.find(a => a.id === addressId);
                    onSelect(address);
                });
            });
        }

        if (onEdit) {
            container.querySelectorAll('.btn-edit-address').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const addressId = btn.dataset.id;
                    const address = this.addresses.find(a => a.id === addressId);
                    onEdit(address);
                });
            });
        }

        if (onDelete) {
            container.querySelectorAll('.btn-delete-address').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const addressId = btn.dataset.id;
                    if (confirm('Tem certeza que deseja excluir este endereço?')) {
                        this.deleteAddress(addressId).then(() => {
                            this.renderAddressList(containerId, onSelect, onEdit, onDelete);
                        });
                    }
                });
            });
        }
    }
}

// Exportar para uso global
window.AddressManager = AddressManager;
