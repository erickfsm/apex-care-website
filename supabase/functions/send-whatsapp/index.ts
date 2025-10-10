// supabase/functions/send-whatsapp/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

console.log("Função 'send-whatsapp' iniciada.");

serve(async (req) => {
  
  if (req.method === "OPTIONS") {
    return new Response("ok", { 
      headers: { 
        "Access-Control-Allow-Origin": "*", 
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" 
      } 
    });
  }

  try {
    const { to, message, messageType } = await req.json();
    
    console.log("Enviando WhatsApp para:", to);
    console.log("Tipo de mensagem:", messageType);

    // Configurações do Twilio
    const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
    const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
    const TWILIO_WHATSAPP_NUMBER = Deno.env.get("TWILIO_WHATSAPP_NUMBER"); // Ex: whatsapp:+14155238886

    // Formatar número (adicionar whatsapp: prefix se necessário)
    const toNumber = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;

    // Criar credenciais Base64 para Basic Auth
    const credentials = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);

    // Enviar mensagem via Twilio API
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: "POST",
        headers: {
          "Authorization": `Basic ${credentials}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          From: TWILIO_WHATSAPP_NUMBER,
          To: toNumber,
          Body: message
        }).toString()
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Erro ao enviar WhatsApp:", data);
      throw new Error(data.message || "Erro ao enviar WhatsApp");
    }

    console.log("WhatsApp enviado com sucesso:", data.sid);

    return new Response(
      JSON.stringify({ success: true, messageSid: data.sid }),
      { 
        headers: { 
          "Content-Type": "application/json", 
          "Access-Control-Allow-Origin": "*" 
        } 
      }
    );

  } catch (error) {
    console.error("Erro na função send-whatsapp:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { 
          "Content-Type": "application/json", 
          "Access-Control-Allow-Origin": "*" 
        } 
      }
    );
  }
});

// Função auxiliar para gerar mensagens
function generateWhatsAppMessage(messageType: string, data: any): string {
  const { clienteNome, dataAgendamento, horaAgendamento, osId, endereco } = data;

  if (messageType === "confirmation") {
    return `🎉 *Agendamento Confirmado - Apex Care*

Olá, ${clienteNome}!

Seu agendamento foi confirmado com sucesso:

📅 *Data:* ${dataAgendamento}
⏰ *Horário:* ${horaAgendamento}
📍 *Local:* ${endereco}

Você receberá um lembrete 24h antes do serviço.

Em caso de dúvidas, responda esta mensagem!`;
  }

  if (messageType === "reminder") {
    return `⏰ *Lembrete - Serviço Amanhã!*

Olá, ${clienteNome}!

Seu serviço Apex Care está agendado para *amanhã*:

📅 *Data:* ${dataAgendamento}
⏰ *Horário:* ${horaAgendamento}
📍 *Local:* ${endereco}

*Checklist de Preparação:*
✅ Remova objetos soltos dos estofados
✅ Garanta acesso ao local
✅ Tenha um ponto de água disponível

Nosso técnico entrará em contato antes de chegar!`;
  }

  if (messageType === "started") {
    return `🔧 *Serviço Iniciado!*

Olá, ${clienteNome}!

Nosso técnico acabou de iniciar o serviço no seu endereço.

📋 *OS:* #${osId}

Estamos trabalhando com todo cuidado e atenção!`;
  }

  if (messageType === "completed") {
    return `🎉 *Serviço Concluído!*

Olá, ${clienteNome}!

Seu serviço foi concluído com sucesso!

📋 *OS:* #${osId}

Esperamos que esteja satisfeito com o resultado. 

⭐ Avalie nosso serviço: [LINK DA AVALIAÇÃO]

Obrigado pela confiança!`;
  }

  return message;
}