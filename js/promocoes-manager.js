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
    async calcularMelhorPromocao(servicos, subtotal, catalogoServicos = []) {
        if (!this.promocoesAtivas.length) {
            return { desconto: 0, promocao: null, mensagem: null, oportunidades: [] };
        }

        let melhorDesconto = 0;
        let melhorPromocao = null;
        const oportunidades = [];

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

            const atendeRequisitos = this.servicosElegiveis(servicos, promo);
            const desconto = atendeRequisitos
                ? this.calcularDesconto(servicos, subtotal, promo)
                : 0;

            if (desconto > melhorDesconto) {
                melhorDesconto = desconto;
                melhorPromocao = promo;
            }

            const oportunidade = this.calcularGapPromocional(
                servicos,
                subtotal,
                promo,
                catalogoServicos
            );

            if (oportunidade) {
                oportunidades.push({
                    promocaoId: promo.id,
                    promocaoNome: promo.nome,
                    mensagem: oportunidade.mensagem,
                    tipo: oportunidade.tipo,
                    faltaQuantidade: oportunidade.missingQuantity ?? null,
                    faltaValor: oportunidade.missingValue ?? null,
                    beneficio: oportunidade.beneficio,
                    prioridade: oportunidade.prioridade,
                });
            }
        }

        const oportunidadesOrdenadas = oportunidades
            .sort(
                (a, b) =>
                    (a.prioridade ?? Number.MAX_SAFE_INTEGER) -
                    (b.prioridade ?? Number.MAX_SAFE_INTEGER)
            )
            .map(({ prioridade, ...rest }) => rest);

        return {
            desconto: melhorDesconto,
            promocao: melhorPromocao,
            mensagem: melhorPromocao ? this.gerarMensagem(melhorPromocao, melhorDesconto) : null,
            oportunidades: oportunidadesOrdenadas
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

    calcularGapPromocional(servicos, subtotal, promocao, catalogoServicos = []) {
        if (!promocao) {
            return null;
        }

        const descontoAtual = this.calcularDesconto(servicos, subtotal, promocao);
        if (descontoAtual > 0) {
            return null;
        }

        const comboConfig = promocao.combo_config || {};
        const elegiveisSelecionados = this.obterServicosSelecionadosElegiveis(servicos, promocao);
        const quantidadeSelecionada = elegiveisSelecionados.reduce(
            (sum, item) => sum + (Number(item?.quantity) || 0),
            0
        );
        const valorSelecionado = elegiveisSelecionados.reduce(
            (sum, item) =>
                sum + (Number(item?.price) || 0) * (Number(item?.quantity) || 0),
            0
        );
        const nomesElegiveis = this.obterNomesServicosElegiveis(
            promocao,
            catalogoServicos,
            servicos
        );
        const labelServicos = this.montarRotuloServicos(nomesElegiveis);
        const beneficioPadrao = this.descreverBeneficio(promocao);

        const prepararResultado = (info) => {
            const enriquecido = {
                ...info,
                labelServicos,
                beneficio: info.beneficio || beneficioPadrao,
            };
            const mensagem = this.gerarMensagemOportunidade(promocao, enriquecido);
            if (!mensagem) {
                return null;
            }

            const prioridadeBase =
                typeof enriquecido.missingQuantity === 'number'
                    ? enriquecido.missingQuantity
                    : typeof enriquecido.missingValue === 'number'
                    ? enriquecido.missingValue
                    : Number.MAX_SAFE_INTEGER;

            return {
                ...enriquecido,
                mensagem,
                prioridade: prioridadeBase,
            };
        };

        if (comboConfig.tipo === 'buy_x_get_y') {
            const required = Number(comboConfig.compre) || 0;
            if (required && quantidadeSelecionada < required) {
                const missing = required - quantidadeSelecionada;
                if (this.isNearQuantity(missing, required)) {
                    return prepararResultado({
                        tipo: 'quantity',
                        missingQuantity: missing,
                        requiredQuantity: required,
                        beneficio: comboConfig.ganhe
                            ? `${comboConfig.ganhe} ${comboConfig.ganhe > 1 ? 'itens grátis' : 'item grátis'}`
                            : beneficioPadrao,
                    });
                }
            }
        }

        if (Array.isArray(comboConfig.faixas) && comboConfig.faixas.length) {
            const totalItens = servicos.reduce(
                (sum, item) => sum + (Number(item?.quantity) || 0),
                0
            );
            const faixasOrdenadas = [...comboConfig.faixas]
                .filter((faixa) => typeof faixa?.min === 'number')
                .sort((a, b) => a.min - b.min);

            const proximaFaixa = faixasOrdenadas.find((faixa) => totalItens < faixa.min);
            if (proximaFaixa) {
                const missing = proximaFaixa.min - totalItens;
                if (missing > 0 && this.isNearQuantity(missing, proximaFaixa.min)) {
                    return prepararResultado({
                        tipo: 'quantity',
                        missingQuantity: missing,
                        requiredQuantity: proximaFaixa.min,
                        beneficio: proximaFaixa.desconto
                            ? `${proximaFaixa.desconto}% de desconto`
                            : beneficioPadrao,
                    });
                }
            }
        }

        const valorMinimo = Number(
            promocao.valor_minimo ||
            comboConfig.valor_minimo ||
            comboConfig.valorMinimo ||
            0
        );

        if (valorMinimo) {
            const valorConsiderado = promocao.servicos_ids?.length
                ? valorSelecionado
                : subtotal;
            if (valorConsiderado < valorMinimo) {
                const missingValue = valorMinimo - valorConsiderado;
                if (this.isNearValue(missingValue, valorMinimo)) {
                    return prepararResultado({
                        tipo: 'value',
                        missingValue,
                        requiredValue: valorMinimo,
                    });
                }
            }
        }

        if (promocao.quantidade_minima) {
            if (quantidadeSelecionada < promocao.quantidade_minima) {
                const missing = promocao.quantidade_minima - quantidadeSelecionada;
                if (this.isNearQuantity(missing, promocao.quantidade_minima)) {
                    return prepararResultado({
                        tipo: 'quantity',
                        missingQuantity: missing,
                        requiredQuantity: promocao.quantidade_minima,
                    });
                }
            }
        }

        return null;
    }

    obterServicosSelecionadosElegiveis(servicos, promocao) {
        if (!Array.isArray(servicos) || !servicos.length) {
            return [];
        }

        if (!promocao?.servicos_ids?.length) {
            return servicos;
        }

        const idsElegiveis = new Set(promocao.servicos_ids);
        return servicos.filter((item) => idsElegiveis.has(item.id));
    }

    obterNomesServicosElegiveis(promocao, catalogoServicos = [], servicosSelecionados = []) {
        const catalogo = Array.isArray(catalogoServicos) ? catalogoServicos : [];
        const selecionados = Array.isArray(servicosSelecionados) ? servicosSelecionados : [];

        if (!promocao?.servicos_ids?.length) {
            return selecionados
                .map((item) => item?.name || item?.nome || item?.titulo)
                .filter(Boolean);
        }

        const idsElegiveis = new Set(promocao.servicos_ids);
        const nomes = [];
        const registrados = new Set();

        [...selecionados, ...catalogo].forEach((servico) => {
            if (!servico) {
                return;
            }
            const id = servico.id;
            if (!idsElegiveis.has(id) || registrados.has(id)) {
                return;
            }

            const nome = servico.name || servico.nome || servico.titulo;
            if (nome) {
                nomes.push(nome);
                registrados.add(id);
            }
        });

        return nomes;
    }

    montarRotuloServicos(nomes) {
        if (!Array.isArray(nomes) || !nomes.length) {
            return 'serviços elegíveis';
        }

        if (nomes.length === 1) {
            return nomes[0];
        }

        if (nomes.length === 2) {
            return `${nomes[0]} ou ${nomes[1]}`;
        }

        return `${nomes[0]}, ${nomes[1]} ou outros serviços elegíveis`;
    }

    descreverBeneficio(promocao) {
        if (!promocao) {
            return 'um benefício especial';
        }

        const tipo = promocao.tipo_desconto;
        const valor = Number(promocao.valor_desconto);

        if (tipo === 'percentual' && valor) {
            return `${valor}% de desconto`;
        }

        if (tipo === 'valor_fixo' && valor) {
            return `${this.formatCurrencyBR(valor)} de desconto`;
        }

        if (tipo === 'combo' && promocao.combo_config) {
            const config = promocao.combo_config;
            if (config.tipo === 'buy_x_get_y' && config.ganhe) {
                const ganhe = Number(config.ganhe) || 0;
                if (ganhe > 0) {
                    return `${ganhe} ${ganhe > 1 ? 'itens grátis' : 'item grátis'}`;
                }
            }

            if (Array.isArray(config.faixas) && config.faixas.length) {
                const maiorDesconto = Math.max(
                    ...config.faixas.map((faixa) => Number(faixa.desconto) || 0)
                );
                if (maiorDesconto > 0) {
                    return `${maiorDesconto}% de desconto`;
                }
            }
        }

        return 'um benefício especial';
    }

    gerarMensagemOportunidade(promocao, info) {
        if (!promocao || !info) {
            return null;
        }

        const beneficio = info.beneficio || this.descreverBeneficio(promocao);

        if (info.tipo === 'quantity' && info.missingQuantity > 0) {
            const label = info.labelServicos || 'serviços elegíveis';
            return `Adicione +${info.missingQuantity} ${label} para desbloquear ${beneficio} na promoção "${promocao.nome}".`;
        }

        if (info.tipo === 'value' && info.missingValue > 0) {
            const label = info.labelServicos || 'serviços';
            return `Faltam ${this.formatCurrencyBR(info.missingValue)} em ${label} para garantir ${beneficio} na promoção "${promocao.nome}".`;
        }

        return null;
    }

    formatCurrencyBR(valor) {
        return `R$ ${Number(valor || 0).toFixed(2).replace('.', ',')}`;
    }

    isNearQuantity(missing, required) {
        if (!(missing > 0)) {
            return false;
        }

        const base = required || missing;
        const threshold = Math.min(3, Math.max(1, Math.ceil(base * 0.4)));
        return missing <= threshold;
    }

    isNearValue(missingValue, requiredValue) {
        if (!(missingValue > 0)) {
            return false;
        }

        const base = requiredValue || missingValue;
        const threshold = Math.max(30, base * 0.25);
        return missingValue <= threshold;
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
