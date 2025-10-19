// Adicionar em js/portal-improved.js (substituir função updateStats)

function updateStats() {
    if (!statsDiv) return;

    const today = new Date().setHours(0, 0, 0, 0);

    // 1. PRÓXIMOS AGENDAMENTOS (mantém)
    const upcoming = allAppointments.filter(appt => 
        appt.data_agendamento && 
        new Date(appt.data_agendamento + 'T00:00:00') >= today && 
        appt.status_pagamento !== 'Cancelado'
    ).length;

    // 2. SERVIÇOS CONCLUÍDOS (mantém)
    const completed = allAppointments.filter(appt => 
        appt.status_pagamento === 'Concluído'
    ).length;

    // 3. ECONOMIA TOTAL (NOVO - substitui "Total Investido")
    const economiaTotalPromo = allAppointments
        .filter(appt => appt.status_pagamento !== 'Cancelado' && appt.desconto_aplicado)
        .reduce((sum, appt) => sum + (appt.desconto_aplicado || 0), 0);

    // 4. PONTOS DE FIDELIDADE (NOVO - gamificação)
    const pontosFidelidade = completed * 10; // 10 pontos por serviço concluído

    // 5. DIAS DESDE ÚLTIMO SERVIÇO (NOVO)
    const ultimoServico = allAppointments
        .filter(appt => appt.status_pagamento === 'Concluído' && appt.data_agendamento)
        .sort((a, b) => new Date(b.data_agendamento) - new Date(a.data_agendamento))[0];

    let diasDesdeUltimo = 'N/A';
    if (ultimoServico) {
        const dataUltimo = new Date(ultimoServico.data_agendamento + 'T00:00:00');
        const diffTime = new Date() - dataUltimo;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        diasDesdeUltimo = diffDays;
    }

    // 6. STATUS DO PLANO (se tiver)
    const planoAtivo = allAppointments.some(appt => 
        appt.plano_id && appt.status_pagamento !== 'Cancelado'
    );

    statsDiv.innerHTML = `
        <div class="stats-grid">
            <!-- Card 1: Próximos Agendamentos -->
            <div class="stat-card">
                <div class="stat-icon">📅</div>
                <div class="stat-value">${upcoming}</div>
                <div class="stat-label">Próximos Agendamentos</div>
            </div>

            <!-- Card 2: Serviços Concluídos -->
            <div class="stat-card">
                <div class="stat-icon">✅</div>
                <div class="stat-value">${completed}</div>
                <div class="stat-label">Serviços Concluídos</div>
            </div>

            <!-- Card 3: Economia Total (NOVO) -->
            <div class="stat-card" style="background: linear-gradient(135deg, #4caf50 0%, #388e3c 100%); color: white;">
                <div class="stat-icon">💰</div>
                <div class="stat-value" style="color: white;">R$ ${economiaTotalPromo.toFixed(2).replace('.', ',')}</div>
                <div class="stat-label" style="color: rgba(255,255,255,0.9);">Economia em Promoções</div>
            </div>

            <!-- Card 4: Pontos de Fidelidade (NOVO) -->
            <div class="stat-card" style="background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%); color: white;">
                <div class="stat-icon">⭐</div>
                <div class="stat-value" style="color: white;">${pontosFidelidade}</div>
                <div class="stat-label" style="color: rgba(255,255,255,0.9);">Pontos Apex Club</div>
            </div>

            <!-- Card 5: Dias Desde Último Serviço (NOVO) -->
            <div class="stat-card">
                <div class="stat-icon">📆</div>
                <div class="stat-value">${diasDesdeUltimo}</div>
                <div class="stat-label">${diasDesdeUltimo === 'N/A' ? 'Sem Histórico' : 'Dias Desde Último Serviço'}</div>
            </div>

            <!-- Card 6: Status do Plano (NOVO) -->
            <div class="stat-card" ${planoAtivo ? 'style="border: 2px solid var(--color-cyan);"' : ''}>
                <div class="stat-icon">${planoAtivo ? '🛡️' : '💳'}</div>
                <div class="stat-value">${planoAtivo ? 'ATIVO' : 'NENHUM'}</div>
                <div class="stat-label">Plano de Cuidado</div>
            </div>
        </div>

        ${diasDesdeUltimo > 90 && diasDesdeUltimo !== 'N/A' ? `
            <div class="alert-box" style="
                background-color: #fff3cd;
                border-left: 4px solid #ffc107;
                padding: 20px;
                border-radius: 8px;
                margin-top: 20px;
                display: flex;
                align-items: center;
                gap: 15px;
            ">
                <span style="font-size: 2em;">⏰</span>
                <div>
                    <strong>Hora de cuidar novamente!</strong>
                    <p style="margin: 5px 0 0 0; color: #666;">
                        Já faz ${diasDesdeUltimo} dias desde seu último serviço. 
                        Recomendamos higienização a cada 3-6 meses para manter seus estofados sempre novos.
                    </p>
                </div>
                <a href="orcamento.html" class="btn" style="
                    background-color: var(--color-cyan);
                    color: white;
                    padding: 10px 20px;
                    border-radius: 5px;
                    text-decoration: none;
                    white-space: nowrap;
                ">Agendar Agora</a>
            </div>
        ` : ''}

        ${!planoAtivo && completed >= 2 ? `
            <div class="alert-box" style="
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 20px;
                border-radius: 8px;
                margin-top: 20px;
                display: flex;
                align-items: center;
                gap: 15px;
            ">
                <span style="font-size: 2em;">🎁</span>
                <div>
                    <strong>Economize com um Plano de Cuidado!</strong>
                    <p style="margin: 5px 0 0 0; opacity: 0.95;">
                        Você já fez ${completed} serviços. Com um plano, você economiza até 15% + descontos exclusivos!
                    </p>
                </div>
                <a href="#planos" class="btn" style="
                    background-color: white;
                    color: #667eea;
                    padding: 10px 20px;
                    border-radius: 5px;
                    text-decoration: none;
                    white-space: nowrap;
                    font-weight: 700;
                ">Ver Planos</a>
            </div>
        ` : ''}
    `;
}