// supabase/functions/send-reminders/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

console.log("Função 'send-reminders' iniciada.");

serve(async (req) => {
  
  try {
    // Criar cliente Supabase com service role (permissões admin)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("🔍 Buscando agendamentos para amanhã...");

    // Calcular data de amanhã
    const amanha = new Date();
    amanha.setDate(amanha.getDate() + 1);
    const amanhaStr = amanha.toISOString().split('T')[0]; // YYYY-MM-DD

    // Buscar agendamentos para amanhã que ainda não foram lembrados
    const { data: agendamentos, error } = await supabase
      .from('agendamentos')
      .select(`
        *,
        cliente:profiles!cliente_id (
          nome_completo,
          email,
          whatsapp
        )
      `)
      .eq('data_agendamento', amanhaStr)
      .in('status_pagamento', ['Pago e Confirmado', 'Pendente (Pagar no Local)'])
      .is('lembrete_enviado', false);

    if (error) {
      console.error("Erro ao buscar agendamentos:", error);
      throw error;
    }

    console.log(`📊 Encontrados ${agendamentos?.length || 0} agendamentos para lembrar`);

    if (!agendamentos || agendamentos.length === 0) {
      return new Response(
        JSON.stringify({ message: "Nenhum agendamento para lembrar hoje", count: 0 }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    // Enviar lembretes para cada agendamento
    let successCount = 0;
    let errorCount = 0;

    for (const agendamento of agendamentos) {
      try {
        console.log(`📤 Enviando lembrete para: ${agendamento.cliente.email}`);

        const dataFormatada = new Date(agendamento.data_agendamento + 'T00:00:00')
          .toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

        // 1. ENVIAR EMAIL
        const emailData = {
          to: agendamento.cliente.email,
          subject: '⏰ Lembrete: Seu serviço é amanhã!',
          emailType: 'reminder',
          appointmentData: {
            clienteNome: agendamento.cliente.nome_completo,
            dataAgendamento: dataFormatada,
            horaAgendamento: agendamento.hora_agendamento,
            servicos: agendamento.servicos_escolhidos,
            valorTotal: agendamento.valor_total.toFixed(2).replace('.', ','),
            osId: agendamento.id
          }
        };

        await fetch(`${supabaseUrl}/functions/v1/send-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`
          },
          body: JSON.stringify(emailData)
        });

        // 2. ENVIAR WHATSAPP
        let whatsappNumber = agendamento.cliente.whatsapp?.replace(/\D/g, '');
        if (whatsappNumber) {
          if (!whatsappNumber.startsWith('55')) {
            whatsappNumber = '55' + whatsappNumber;
          }

          const whatsappMessage = `⏰ *Lembrete - Apex Care*

Olá, ${agendamento.cliente.nome_completo}!

Seu serviço está agendado para *AMANHÃ*:

📅 *Data:* ${dataFormatada}
⏰ *Horário:* ${agendamento.hora_agendamento}

*Checklist:*
✅ Remova objetos dos estofados
✅ Garanta acesso ao local
✅ Tenha água disponível

Nosso técnico entrará em contato antes!`;

          const whatsappData = {
            to: `whatsapp:+${whatsappNumber}`,
            message: whatsappMessage,
            messageType: 'reminder'
          };

          await fetch(`${supabaseUrl}/functions/v1/send-whatsapp`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`
            },
            body: JSON.stringify(whatsappData)
          });
        }

        // 3. MARCAR COMO LEMBRADO
        await supabase
          .from('agendamentos')
          .update({ lembrete_enviado: true })
          .eq('id', agendamento.id);

        successCount++;
        console.log(`✅ Lembrete enviado para agendamento #${agendamento.id}`);

      } catch (error) {
        errorCount++;
        console.error(`❌ Erro ao enviar lembrete para agendamento #${agendamento.id}:`, error);
      }
    }

    console.log(`📊 Resumo: ${successCount} enviados, ${errorCount} erros`);

    return new Response(
      JSON.stringify({ 
        message: "Lembretes processados", 
        total: agendamentos.length,
        success: successCount,
        errors: errorCount
      }),
      { headers: { "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Erro na função send-reminders:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});