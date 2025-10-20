/**
 * @fileoverview Utility functions for handling promotions.
 * @module promocoes-helpers
 */

/**
 * Parses the `servicos_escolhidos` field from an appointment.
 * @param {*} servicos - The `servicos_escolhidos` field.
 * @returns {Array} An array of service items.
 */
function parseServicosEscolhidos(servicos) {
    if (!servicos) return [];

    if (Array.isArray(servicos)) {
        return servicos;
    }

    if (typeof servicos === 'string') {
        try {
            const parsed = JSON.parse(servicos);
            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            console.warn('Não foi possível converter servicos_escolhidos:', error);
            return [];
        }
    }

    if (typeof servicos === 'object') {
        if (Array.isArray(servicos?.items)) {
            return servicos.items;
        }

        return Object.values(servicos);
    }

    return [];
}

/**
 * Extracts promotion details from an appointment.
 * @param {object} appointment - The appointment object.
 * @returns {object|null} An object with promotion details or null if not found.
 */
export function extractPromotionFromAppointment(appointment) {
    if (!appointment) return null;

    const itens = parseServicosEscolhidos(appointment.servicos_escolhidos);
    if (!Array.isArray(itens) || itens.length === 0) {
        return null;
    }

    const descontoItem = itens.find((item) => {
        if (!item) return false;
        if (item.type === 'discount' && (item.promotion_id || item.promotionId || item.promocao_id)) {
            return true;
        }
        if (item.id === 'promotion-discount' && (item.promotion_id || item.promotionId)) {
            return true;
        }
        return false;
    });

    if (!descontoItem) {
        return null;
    }

    const promocaoId = descontoItem.promotion_id || descontoItem.promotionId || descontoItem.promocao_id;
    if (!promocaoId) {
        return null;
    }

    const valorBruto =
        descontoItem.valor_desconto ??
        descontoItem.valor ??
        descontoItem.amount ??
        descontoItem.line_total ??
        descontoItem.price ??
        appointment.desconto_aplicado ??
        0;

    const valorDesconto = Math.abs(Number(valorBruto)) || 0;
    if (valorDesconto <= 0) {
        return null;
    }

    return {
        promocaoId,
        valorDesconto,
        promocaoNome: descontoItem.promotion_nome || descontoItem.nome || null,
    };
}

/**
 * Registers the use of a promotion if applicable.
 * @param {object} promocoesManager - The promotions manager instance.
 * @param {object} appointment - The appointment object.
 * @param {object} [options={}] - Additional options.
 * @param {string} [options.clienteId] - The client ID.
 * @returns {Promise<object>} An object indicating if the registration was successful.
 */
export async function registrarUsoPromocaoSeAplicavel(promocoesManager, appointment, options = {}) {
    const promocao = extractPromotionFromAppointment(appointment);

    if (!promocao || !appointment?.id) {
        return { registered: false };
    }

    const clienteId = options?.clienteId || appointment.cliente_id || null;

    let managerInstance = promocoesManager;

    if (!managerInstance) {
        if (!window?.PromocoesManager) {
            throw new Error('PromocoesManager não disponível no escopo global.');
        }
        managerInstance = new window.PromocoesManager();
    }

    if (typeof managerInstance.setUser === 'function' && clienteId) {
        managerInstance.setUser(clienteId);
    }

    await managerInstance.registrarUso(promocao.promocaoId, appointment.id, promocao.valorDesconto, {
        clienteId,
    });

    return {
        registered: true,
        promotion: promocao,
        manager: managerInstance,
    };
}
