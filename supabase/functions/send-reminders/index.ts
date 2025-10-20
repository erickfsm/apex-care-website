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
      const channelErrors: Record<string, string> = {};
      let emailSuccess = false;
      let whatsappSuccess = false;

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

        try {
          const emailResponse = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`
            },
            body: JSON.stringify(emailData)
          });

          if (!emailResponse.ok) {
            let errorDetails = 'Sem detalhes';
            try {
              const responseText = await emailResponse.text();
              if (responseText) {
                errorDetails = responseText;
              }
            } catch (_) {
              // Ignorar falha ao ler corpo de erro
            }
            throw new Error(`Falha ao enviar email (${emailResponse.status} ${emailResponse.statusText}): ${errorDetails}`);
          }

          emailSuccess = true;
        } catch (emailError) {
          const message = emailError instanceof Error ? emailError.message : String(emailError);
          channelErrors.email = message;
          console.error(`❌ Erro ao enviar email para agendamento #${agendamento.id}:`, emailError);
        }

        // 2. ENVIAR WHATSAPP
        let whatsappNumber = agendamento.cliente.whatsapp?.replace(/\D/g, '');
        if (whatsappNumber) {
          if (!whatsappNumber.startsWith('55')) {
            whatsappNumber = '55' + whatsappNumber;
          }

          const whatsappMessage = `⏰ *Lembrete - Apex Care*\n\nOlá, ${agendamento.cliente.nome_completo}!\n\nSeu serviço está agendado para *AMANHÃ*:\n\n📅 *Data:* ${dataFormatada}\n⏰ *Horário:* ${agendamento.hora_agendamento}\n\n*Checklist:*\n✅ Remova objetos dos estofados\n✅ Garanta acesso ao local\n✅ Tenha água disponível\n\nNosso técnico entrará em contato antes!`;

          const whatsappData = {
            to: `whatsapp:+${whatsappNumber}`,
            message: whatsappMessage,
            messageType: 'reminder'
          };

          try {
            const whatsappResponse = await fetch(`${supabaseUrl}/functions/v1/send-whatsapp`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseServiceKey}`
              },
              body: JSON.stringify(whatsappData)
            });

            if (!whatsappResponse.ok) {
              let errorDetails = 'Sem detalhes';
              try {
                const responseText = await whatsappResponse.text();
                if (responseText) {
                  errorDetails = responseText;
                }
              } catch (_) {
                // Ignorar falha ao ler corpo de erro
              }
              throw new Error(`Falha ao enviar WhatsApp (${whatsappResponse.status} ${whatsappResponse.statusText}): ${errorDetails}`);
            }

            whatsappSuccess = true;
          } catch (whatsappError) {
            const message = whatsappError instanceof Error ? whatsappError.message : String(whatsappError);
            channelErrors.whatsapp = message;
            console.error(`❌ Erro ao enviar WhatsApp para agendamento #${agendamento.id}:`, whatsappError);
          }
        } else {
          channelErrors.whatsapp = 'Número de WhatsApp não disponível ou inválido.';
          console.warn(`⚠️ WhatsApp não enviado para agendamento #${agendamento.id}: número indisponível.`);
        }

        if (emailSuccess || whatsappSuccess) {
          const { error: updateError } = await supabase
            .from('agendamentos')
            .update({ lembrete_enviado: true })
            .eq('id', agendamento.id);

          if (updateError) {
            channelErrors.database = updateError.message;
            throw new Error(`Falha ao atualizar lembrete para agendamento #${agendamento.id}: ${updateError.message}`);
          }

          successCount++;
          console.log(`✅ Lembrete enviado para agendamento #${agendamento.id} (Email: ${emailSuccess ? 'sucesso' : 'falha'}, WhatsApp: ${whatsappSuccess ? 'sucesso' : 'falha'})`);
        } else {
          throw new Error(`Nenhum canal de lembrete teve sucesso para agendamento #${agendamento.id}`);
        }

        if (Object.keys(channelErrors).length > 0 && !(emailSuccess && whatsappSuccess)) {
          console.log(`ℹ️ Resumo de erros parciais para agendamento #${agendamento.id}:`, channelErrors);
        }

      } catch (error) {
        errorCount++;
        console.error(`❌ Erro ao processar lembrete para agendamento #${agendamento.id}:`, error);
        if (Object.keys(channelErrors).length > 0) {
          console.error('Detalhes dos erros por canal:', channelErrors);
        }
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
