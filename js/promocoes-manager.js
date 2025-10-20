// js/promocoes-manager.js - Sistema de Promoções
import { supabase } from './supabase-client.js';

/**
 * @class PromocoesManager
 * @description Manages promotions, including loading, calculating, and registering their use.
 */
class PromocoesManager {
    /**
     * @constructor
     */
    constructor() {
        /** @type {Array<object>} */
        this.promocoesAtivas = [];
        /** @type {string|null} */
        this.userId = null;
    }

    /**
     * Initializes the promotions manager for a specific user.
     * @param {string} userId - The ID of the user.
     */
    async init(userId) {
        this.userId = userId;
        await this.carregarPromocoesAtivas();
    }

    /**
     * Sets the user ID for the manager.
     * @param {string} userId - The ID of the user.
     */
    setUser(userId) {
        this.userId = userId;
    }

    /**
     * Loads active promotions from the database.
     */
    async carregarPromocoesAtivas() {
        try {
            const hoje = new Date().toISOString().split('T')[0];

            const { data, error } = await supabase
                .from('promocoes')
                .select('*')
                .eq('ativo', true)
                .lte('data_inicio', hoje)
                .gte('data_fim', hoje);

            if (error) throw error;

            this.promocoesAtivas = data || [];
            console.log('✅ Promoções ativas carregadas:', this.promocoesAtivas.length);
        } catch (error) {
            console.error('Erro ao carregar promoções:', error);
            this.promocoesAtivas = [];
        }
    }

    /**
     * Calculates the best promotion for the given services and subtotal.
     * @param {Array<object>} servicos - The list of selected services.
     * @param {number} subtotal - The subtotal of the services.
     * @returns {Promise<object>} An object with the discount, promotion, and message.
     */
    async calcularMelhorPromocao(servicos, subtotal) {
        if (!this.promocoesAtivas.length) {
            return { desconto: 0, promocao: null, mensagem: null };
        }

        let melhorDesconto = 0;
        let melhorPromocao = null;

        const usosPorPromocao = new Map();
        if (this.userId) {
            const promocoesComLimite = this.promocoesAtivas
                .filter(promo => promo.uso_por_cliente)
                .map(promo => promo.id);

            if (promocoesComLimite.length) {
                try {
                    const { data, error } = await supabase
                        .from('promocoes_uso')
                        .select('promocao_id')
                        .eq('cliente_id', this.userId)
                        .in('promocao_id', promocoesComLimite);

                    if (error) {
                        throw error;
                    }

                    (data || []).forEach(({ promocao_id }) => {
                        const usoAtual = usosPorPromocao.get(promocao_id) || 0;
                        usosPorPromocao.set(promocao_id, usoAtual + 1);
                    });
                } catch (error) {
                    console.error('Erro ao buscar usos de promoções:', error);
                    throw error;
                }
            }
        }

        for (const promo of this.promocoesAtivas) {
            if (promo.uso_por_cliente && this.userId) {
                const usosRegistrados = usosPorPromocao.get(promo.id) || 0;

                if (usosRegistrados >= promo.uso_por_cliente) {
                    continue;
                }
            }

            if (!this.servicosElegiveis(servicos, promo)) {
                continue;
            }

            const desconto = this.calcularDesconto(servicos, subtotal, promo);

            if (desconto > melhorDesconto) {
                melhorDesconto = desconto;
                melhorPromocao = promo;
            }
        }

        return {
            desconto: melhorDesconto,
            promocao: melhorPromocao,
            mensagem: melhorPromocao ? this.gerarMensagem(melhorPromocao, melhorDesconto) : null
        };
    }

    /**
     * Checks if the selected services are eligible for a promotion.
     * @param {Array<object>} servicos - The list of selected services.
     * @param {object} promocao - The promotion object.
     * @returns {boolean} True if the services are eligible, false otherwise.
     */
    servicosElegiveis(servicos, promocao) {
        if (!promocao.servicos_ids || promocao.servicos_ids.length === 0) {
            return true;
        }

        const servicosElegiveis = servicos.filter(s =>
            promocao.servicos_ids.includes(s.id)
        );

        if (servicosElegiveis.length < (promocao.quantidade_minima || 1)) {
            return false;
        }

        return true;
    }

    /**
     * Calculates the discount for a promotion.
     * @param {Array<object>} servicos - The list of selected services.
     * @param {number} subtotal - The subtotal of the services.
     * @param {object} promocao - The promotion object.
     * @returns {number} The calculated discount amount.
     */
    calcularDesconto(servicos, subtotal, promocao) {
        const { tipo_desconto, valor_desconto, combo_config } = promocao;

        if (tipo_desconto === 'percentual' && valor_desconto) {
            let valorElegivel = subtotal;

            if (promocao.servicos_ids && promocao.servicos_ids.length > 0) {
                valorElegivel = servicos
                    .filter(s => promocao.servicos_ids.includes(s.id))
                    .reduce((sum, s) => sum + (s.price * s.quantity), 0);
            }

            return (valorElegivel * valor_desconto) / 100;
        }

        if (tipo_desconto === 'valor_fixo' && valor_desconto) {
            if (combo_config?.valor_minimo && subtotal < combo_config.valor_minimo) {
                return 0;
            }
            return valor_desconto;
        }

        if (tipo_desconto === 'combo' && combo_config) {
            return this.calcularDescontoCombo(servicos, subtotal, promocao);
        }

        return 0;
    }

    /**
     * Calculates the discount for a combo promotion.
     * @param {Array<object>} servicos - The list of selected services.
     * @param {number} subtotal - The subtotal of the services.
     * @param {object} promocao - The promotion object.
     * @returns {number} The calculated discount amount.
     */
    calcularDescontoCombo(servicos, subtotal, promocao) {
        const { combo_config } = promocao;

        if (combo_config.tipo === 'buy_x_get_y') {
            const servicosElegiveis = servicos.filter(s =>
                promocao.servicos_ids.includes(s.id)
            );

            const totalItens = servicosElegiveis.reduce((sum, s) => sum + s.quantity, 0);
            const { compre, ganhe } = combo_config;

            if (totalItens >= compre) {
                const itensMaisBaratos = servicosElegiveis
                    .sort((a, b) => a.price - b.price)
                    .slice(0, ganhe);

                return itensMaisBaratos.reduce((sum, item) => sum + item.price, 0);
            }
        }

        if (combo_config.faixas) {
            const totalItens = servicos.reduce((sum, s) => sum + s.quantity, 0);

            const faixaAplicavel = combo_config.faixas.find(f =>
                totalItens >= f.min && totalItens <= f.max
            );

            if (faixaAplicavel) {
                return (subtotal * faixaAplicavel.desconto) / 100;
            }
        }

        if (combo_config.tipo === 'primeira_compra') {
            if (subtotal >= combo_config.valor_minimo) {
                return promocao.valor_desconto;
            }
        }

        return 0;
    }

    /**
     * Generates a message for the applied promotion.
     * @param {object} promocao - The promotion object.
     * @param {number} valorDesconto - The discount amount.
     * @returns {string} The promotion message.
     */
    gerarMensagem(promocao, valorDesconto) {
        const valorFormatado = valorDesconto.toFixed(2).replace('.', ',');
        return `🎉 Promoção "${promocao.nome}" aplicada! Você economizou R$ ${valorFormatado}`;
    }

    /**
     * Registers the use of a promotion.
     * @param {string} promocaoId - The ID of the promotion.
     * @param {string} agendamentoId - The ID of the appointment.
     * @param {number} valorDesconto - The discount amount.
     * @param {object} [options={}] - Additional options.
     * @returns {Promise<object>} An object indicating if the registration was successful.
     */
    async registrarUso(promocaoId, agendamentoId, valorDesconto, options = {}) {
        const clienteId = options?.clienteId || this.userId;
        const descontoNumerico = Math.abs(Number(valorDesconto || 0));

        if (!clienteId || !promocaoId || !agendamentoId || descontoNumerico <= 0) {
            console.warn('Informações insuficientes para registrar uso de promoção.');
            return { inserted: false };
        }

        try {
            const { count, error: countError } = await supabase
                .from('promocoes_uso')
                .select('id', { count: 'exact', head: true })
                .eq('promocao_id', promocaoId)
                .eq('agendamento_id', agendamentoId)
                .eq('cliente_id', clienteId);

            if (countError) throw countError;

            if (count && count > 0) {
                console.log('⚠️ Uso de promoção já registrado anteriormente.');
                return { inserted: false, alreadyExists: true };
            }

            const { error } = await supabase
                .from('promocoes_uso')
                .insert({
                    promocao_id: promocaoId,
                    cliente_id: clienteId,
                    agendamento_id: agendamentoId,
                    valor_desconto: descontoNumerico
                });

            if (error) throw error;
            console.log('✅ Uso de promoção registrado');
            return { inserted: true };
        } catch (error) {
            console.error('Erro ao registrar uso:', error);
            throw error;
        }
    }

    /**
     * Renders a banner of active promotions.
     * @param {string} containerId - The ID of the container element.
     */
    renderBannerPromocoes(containerId) {
        const container = document.getElementById(containerId);
        if (!container || !this.promocoesAtivas.length) return;

        const bannersHTML = this.promocoesAtivas
            .filter(p => p.descricao)
            .slice(0, 3)
            .map(promo => {
                const diasRestantes = this.calcularDiasRestantes(promo.data_fim);

                return `
                    <div class="promo-banner" style="
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        color: white;
                        padding: 20px;
                        border-radius: 8px;
                        margin: 15px 0;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
                    ">
                        <div>
                            <h4 style="margin: 0 0 8px 0; font-size: 1.2em;">
                                🎁 ${promo.nome}
                            </h4>
                            <p style="margin: 0; opacity: 0.9; font-size: 0.95em;">
                                ${promo.descricao}
                            </p>
                        </div>
                        <div style="text-align: right;">
                            <div style="
                                background-color: rgba(255, 255, 255, 0.2);
                                padding: 8px 15px;
                                border-radius: 20px;
                                font-size: 0.85em;
                                font-weight: 700;
                            ">
                                ⏰ ${diasRestantes} dias restantes
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

        container.innerHTML = bannersHTML;
    }

    /**
     * Calculates the remaining days for a promotion.
     * @param {string} dataFim - The end date of the promotion.
     * @returns {number} The number of remaining days.
     */
    calcularDiasRestantes(dataFim) {
        const hoje = new Date();
        const fim = new Date(dataFim);
        const diff = fim - hoje;
        return Math.ceil(diff / (1000 * 60 * 60 * 24));
    }
}

// Exportar instância global
window.PromocoesManager = PromocoesManager;
