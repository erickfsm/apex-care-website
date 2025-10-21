import './promocoes-manager.js';

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
});

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
});

function formatDate(dateString) {
    if (!dateString) {
        return 'Sem data definida';
    }

    try {
        const date = new Date(dateString);
        if (Number.isNaN(date.getTime())) {
            return 'Sem data definida';
        }
        return dateFormatter.format(date);
    } catch (error) {
        console.warn('Não foi possível formatar a data da promoção:', error);
        return 'Sem data definida';
    }
}

function formatCurrency(value) {
    if (value === null || value === undefined || Number.isNaN(Number(value))) {
        return null;
    }

    return currencyFormatter.format(Number(value));
}

function calculateDaysLeft(dateString) {
    if (!dateString) {
        return null;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const endDate = new Date(dateString);
    if (Number.isNaN(endDate.getTime())) {
        return null;
    }
    endDate.setHours(0, 0, 0, 0);

    const diffMs = endDate.getTime() - today.getTime();
    return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

function resolveBenefits(promocao) {
    const beneficios = promocao?.beneficios;

    if (Array.isArray(beneficios)) {
        return beneficios
            .map(String)
            .map(text => text.trim())
            .filter(Boolean);
    }

    if (typeof beneficios === 'string') {
        const normalized = beneficios
            .split(/\r?\n|[•\-]|;/)
            .map(text => text.trim())
            .filter(Boolean);

        if (normalized.length) {
            return normalized;
        }
    }

    if (beneficios && typeof beneficios === 'object') {
        const values = Object.values(beneficios)
            .map(String)
            .map(text => text.trim())
            .filter(Boolean);

        if (values.length) {
            return values;
        }
    }

    if (promocao?.descricao) {
        return [String(promocao.descricao)];
    }

    return [];
}

function describeDiscount(promocao) {
    const tipo = promocao?.tipo_desconto;
    const valor = Number(promocao?.valor_desconto);
    const combo = promocao?.combo_config;

    if (tipo === 'percentual' && valor) {
        return `${valor}% OFF`; // percentual direto
    }

    if (tipo === 'valor_fixo' && valor) {
        const formatted = formatCurrency(valor);
        return formatted ? `Economize ${formatted}` : 'Desconto aplicado';
    }

    if (tipo === 'combo' && combo) {
        if (combo?.descricao) {
            return combo.descricao;
        }

        if (combo?.tipo === 'buy_x_get_y') {
            const buy = combo?.comprar || combo?.quantidade_compra || combo?.buy || combo?.buyQuantity;
            const get = combo?.ganhar || combo?.quantidade_ganha || combo?.get || combo?.getQuantity;
            if (buy && get) {
                return `Leve ${buy}, pague ${Math.max(1, buy - get)}`;
            }
        }

        if (combo?.tipo === 'percentual_progressivo' && Array.isArray(combo?.faixas)) {
            const melhorFaixa = [...combo.faixas].sort((a, b) => (Number(b?.percentual) || 0) - (Number(a?.percentual) || 0))[0];
            if (melhorFaixa) {
                return `${melhorFaixa.percentual}% OFF progressivo`;
            }
        }

        return 'Condições especiais em combo';
    }

    return promocao?.mensagem_destaque || 'Desconto especial';
}

function buildDetailList(promocao) {
    const items = [];

    if (promocao?.data_fim) {
        items.push(`<li><strong>Válido até:</strong> ${formatDate(promocao.data_fim)}</li>`);
    }

    if (promocao?.data_inicio) {
        items.push(`<li><strong>Disponível desde:</strong> ${formatDate(promocao.data_inicio)}</li>`);
    }

    if (promocao?.quantidade_minima) {
        items.push(`<li><strong>Qtd. mínima de serviços:</strong> ${promocao.quantidade_minima}</li>`);
    }

    if (promocao?.uso_por_cliente) {
        items.push(`<li><strong>Limite por cliente:</strong> ${promocao.uso_por_cliente} uso(s)</li>`);
    }

    if (promocao?.combo_config?.valor_minimo) {
        const formatted = formatCurrency(promocao.combo_config.valor_minimo);
        if (formatted) {
            items.push(`<li><strong>Valor mínimo:</strong> ${formatted}</li>`);
        }
    }

    if (promocao?.servicos_ids?.length) {
        items.push('<li><strong>Serviços elegíveis:</strong> Consulte no orçamento os serviços marcados como promocionais.</li>');
    }

    return items.join('');
}

function renderCards(promocoes) {
    return `
        <div class="promocoes-grid">
            ${promocoes.map(promocao => {
                const benefits = resolveBenefits(promocao);
                const details = buildDetailList(promocao);
                const daysLeft = calculateDaysLeft(promocao?.data_fim);
                const discountLabel = describeDiscount(promocao);

                return `
                    <article class="promocao-card">
                        <header class="promocao-card-header">
                            <span class="promocao-badge">${discountLabel}</span>
                            ${daysLeft !== null ? `<span class="promocao-deadline">${daysLeft === 0 ? 'Último dia!' : `Faltam ${daysLeft} dia(s)`}</span>` : ''}
                        </header>
                        <h3>${promocao?.nome || 'Promoção especial'}</h3>
                        <p class="promocao-resumo">${promocao?.descricao || 'Aproveite condições diferenciadas para manter seus estofados impecáveis.'}</p>
                        ${benefits.length ? `
                            <ul class="promocao-beneficios">
                                ${benefits.map(item => `<li>${item}</li>`).join('')}
                            </ul>
                        ` : ''}
                        ${details ? `<ul class="promocao-detalhes">${details}</ul>` : ''}
                        <footer class="promocao-card-footer">
                            <a href="orcamento.html" class="promocao-cta">Quero aproveitar</a>
                        </footer>
                    </article>
                `;
            }).join('')}
        </div>
    `;
}

function renderCompact(promocoes) {
    return `
        <div class="promocoes-compact-grid">
            ${promocoes.map(promocao => {
                const daysLeft = calculateDaysLeft(promocao?.data_fim);
                const discountLabel = describeDiscount(promocao);
                return `
                    <article class="promocao-card-compact">
                        <div class="promocao-compact-main">
                            <h4>${promocao?.nome || 'Promoção especial'}</h4>
                            <p>${promocao?.descricao || 'Benefícios exclusivos para clientes Apex Care.'}</p>
                            <div class="promocao-compact-tags">
                                <span class="promocao-badge">${discountLabel}</span>
                                ${daysLeft !== null ? `<span class="promocao-deadline">${daysLeft === 0 ? 'Último dia!' : `${daysLeft} dia(s) restantes`}</span>` : ''}
                            </div>
                        </div>
                        <a class="promocao-compact-cta" href="orcamento.html">Aproveitar</a>
                    </article>
                `;
            }).join('')}
        </div>
    `;
}

function renderPromocoes(promocoes, layout) {
    if (!promocoes.length) {
        return '<p class="promocoes-empty">No momento não temos promoções ativas, mas novas ofertas chegam em breve. 💙</p>';
    }

    if (layout === 'compact') {
        return renderCompact(promocoes);
    }

    return renderCards(promocoes);
}

async function carregarPromocoes() {
    const containers = document.querySelectorAll('[data-promocoes-list]');
    if (!containers.length) {
        return;
    }

    let manager;
    try {
        manager = new window.PromocoesManager();
        await manager.carregarPromocoesAtivas();
    } catch (error) {
        console.error('Erro ao carregar promoções:', error);
        containers.forEach(container => {
            container.innerHTML = '<p class="promocoes-empty">Não foi possível carregar as promoções agora. Tente novamente em instantes.</p>';
        });
        return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const promocoes = (manager.promocoesAtivas || [])
        .filter(promocao => {
            if (!promocao?.ativo) {
                return false;
            }
            if (!promocao?.data_fim) {
                return true;
            }
            const endDate = new Date(promocao.data_fim);
            if (Number.isNaN(endDate.getTime())) {
                return true;
            }
            endDate.setHours(23, 59, 59, 999);
            return endDate.getTime() >= today.getTime();
        })
        .sort((a, b) => {
            const dateA = a?.data_fim ? new Date(a.data_fim).getTime() : Infinity;
            const dateB = b?.data_fim ? new Date(b.data_fim).getTime() : Infinity;
            return dateA - dateB;
        });

    containers.forEach(container => {
        const layout = container.dataset.promocoesLayout || 'cards';
        container.innerHTML = renderPromocoes(promocoes, layout);
    });
}

document.addEventListener('DOMContentLoaded', carregarPromocoes);
