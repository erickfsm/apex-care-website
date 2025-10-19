// js/promocoes-manager.js - Sistema de Promoções
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'https://xrajjehettusnbvjielf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhyYWpqZWhldHR1c25idmppZWxmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5NjE2NzMsImV4cCI6MjA3NTUzNzY3M30.LIl1PcGEA31y2TVYmA7zH7mnCPjot-s02LcQmu79e_U';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

class PromocoesManager {
    constructor() {
        this.promocoesAtivas = [];
        this.userId = null;
    }

    async init(userId) {
        this.userId = userId;
        await this.carregarPromocoesAtivas();
    }

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

    // Calcular melhor promoção para o carrinho
    async calcularMelhorPromocao(servicos, subtotal) {
        if (!this.promocoesAtivas.length) {
            return { desconto: 0, promocao: null, mensagem: null };
        }

        let melhorDesconto = 0;
        let melhorPromocao = null;

        // Verificar cada promoção
        for (const promo of this.promocoesAtivas) {
            // Verificar se já usou (se tiver limite por cliente)
            if (promo.uso_por_cliente && this.userId) {
                const { count } = await supabase
                    .from('promocoes_uso')
                    .select('id', { count: 'exact', head: true })
                    .eq('promocao_id', promo.id)
                    .eq('cliente_id', this.userId);

                if (count >= promo.uso_por_cliente) {
                    continue; // Já usou o máximo permitido
                }
            }

            // Verificar elegibilidade
            if (!this.servicosElegiveis(servicos, promo)) {
                continue;
            }

            // Calcular desconto
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

    servicosElegiveis(servicos, promocao) {
        // Se servicos_ids é null, todos são elegíveis
        if (!promocao.servicos_ids || promocao.servicos_ids.length === 0) {
            return true;
        }

        // Verificar se pelo menos um serviço está na lista
        const servicosElegiveis = servicos.filter(s => 
            promocao.servicos_ids.includes(s.id)
        );

        // Verificar quantidade mínima
        if (servicosElegiveis.length < (promocao.quantidade_minima || 1)) {
            return false;
        }

        return true;
    }

    calcularDesconto(servicos, subtotal, promocao) {
        const { tipo_desconto, valor_desconto, combo_config } = promocao;

        // DESCONTO PERCENTUAL SIMPLES
        if (tipo_desconto === 'percentual' && valor_desconto) {
            // Calcular apenas sobre serviços elegíveis
            let valorElegivel = subtotal;
            
            if (promocao.servicos_ids && promocao.servicos_ids.length > 0) {
                valorElegivel = servicos
                    .filter(s => promocao.servicos_ids.includes(s.id))
                    .reduce((sum, s) => sum + (s.price * s.quantity), 0);
            }

            return (valorElegivel * valor_desconto) / 100;
        }

        // DESCONTO VALOR FIXO
        if (tipo_desconto === 'valor_fixo' && valor_desconto) {
            // Verificar valor mínimo se existir
            if (combo_config?.valor_minimo && subtotal < combo_config.valor_minimo) {
                return 0;
            }
            return valor_desconto;
        }

        // COMBOS ESPECIAIS
        if (tipo_desconto === 'combo' && combo_config) {
            return this.calcularDescontoCombo(servicos, subtotal, promocao);
        }

        return 0;
    }

    calcularDescontoCombo(servicos, subtotal, promocao) {
        const { combo_config } = promocao;

        // TIPO: Buy X Get Y (Leve 3 Pague 2)
        if (combo_config.tipo === 'buy_x_get_y') {
            const servicosElegiveis = servicos.filter(s => 
                promocao.servicos_ids.includes(s.id)
            );

            const totalItens = servicosElegiveis.reduce((sum, s) => sum + s.quantity, 0);
            const { compre, ganhe } = combo_config;

            if (totalItens >= compre) {
                // Dar de graça o item mais barato
                const itensMaisBaratos = servicosElegiveis
                    .sort((a, b) => a.price - b.price)
                    .slice(0, ganhe);

                return itensMaisBaratos.reduce((sum, item) => sum + item.price, 0);
            }
        }

        // TIPO: Desconto Progressivo (quanto mais itens, maior desconto)
        if (combo_config.faixas) {
            const totalItens = servicos.reduce((sum, s) => sum + s.quantity, 0);
            
            const faixaAplicavel = combo_config.faixas.find(f => 
                totalItens >= f.min && totalItens <= f.max
            );

            if (faixaAplicavel) {
                return (subtotal * faixaAplicavel.desconto) / 100;
            }
        }

        // TIPO: Primeira Compra
        if (combo_config.tipo === 'primeira_compra') {
            // Verificar se é primeira compra (feito no backend)
            if (subtotal >= combo_config.valor_minimo) {
                return promocao.valor_desconto;
            }
        }

        return 0;
    }

    gerarMensagem(promocao, valorDesconto) {
        const valorFormatado = valorDesconto.toFixed(2).replace('.', ',');
        return `🎉 Promoção "${promocao.nome}" aplicada! Você economizou R$ ${valorFormatado}`;
    }

    // Registrar uso de promoção após confirmação do agendamento
    async registrarUso(promocaoId, agendamentoId, valorDesconto) {
        if (!this.userId) return;

        try {
            const { error } = await supabase
                .from('promocoes_uso')
                .insert({
                    promocao_id: promocaoId,
                    cliente_id: this.userId,
                    agendamento_id: agendamentoId,
                    valor_desconto: valorDesconto
                });

            if (error) throw error;
            console.log('✅ Uso de promoção registrado');
        } catch (error) {
            console.error('Erro ao registrar uso:', error);
        }
    }

    // Renderizar banner de promoções ativas
    renderBannerPromocoes(containerId) {
        const container = document.getElementById(containerId);
        if (!container || !this.promocoesAtivas.length) return;

        const bannersHTML = this.promocoesAtivas
            .filter(p => p.descricao) // Apenas com descrição
            .slice(0, 3) // Máximo 3
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

    calcularDiasRestantes(dataFim) {
        const hoje = new Date();
        const fim = new Date(dataFim);
        const diff = fim - hoje;
        return Math.ceil(diff / (1000 * 60 * 60 * 24));
    }
}

// Exportar instância global
window.PromocoesManager = PromocoesManager;