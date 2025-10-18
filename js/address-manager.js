// address-manager.js - Sistema de Gerenciamento de Endereços
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'https://xrajjehettusnbvjielf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhyYWpqZWhldHR1c25idmppZWxmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5NjE2NzMsImV4cCI6MjA3NTUzNzY3M30.LIl1PcGEA31y2TVYmA7zH7mnCPjot-s02LcQmu79e_U';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

class AddressManager {
    constructor() {
        this.addresses = [];
        this.currentUser = null;
    }

    async init(userId) {
        this.currentUser = userId;
        await this.loadAddresses();
    }

    // Carregar todos os endereços do usuário
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

    // Obter endereço principal
    getPrincipalAddress() {
        return this.addresses.find(addr => addr.is_principal) || this.addresses[0] || null;
    }

    // Criar novo endereço
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

    // Atualizar endereço
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

    // Deletar endereço
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

    // Definir endereço como principal
    async setPrincipal(addressId) {
        try {
            const { error } = await supabase
                .from('enderecos')
                .update({ is_principal: true })
                .eq('id', addressId);

            if (error) throw error;

            console.log('✅ Endereço definido como principal:', addressId);
            await this.loadAddresses();
        } catch (error) {
            console.error('Erro ao definir endereço principal:', error);
            throw error;
        }
    }

    // Renderizar lista de endereços (HTML)
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