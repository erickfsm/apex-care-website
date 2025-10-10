import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

console.log("Função 'send-email' iniciada.");

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
    const { to, subject, emailType, appointmentData } = await req.json();
    
    console.log("Enviando email para:", to);
    console.log("Tipo de email:", emailType);

    // Gera o HTML do email baseado no tipo
    const emailHTML = generateEmailHTML(emailType, appointmentData);

    // Envia o email usando Resend
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Apex Care <contato@apexcare.com.br>",
        to: [to],
        subject: subject,
        html: emailHTML,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Erro ao enviar email:", data);
      throw new Error(data.message || "Erro ao enviar email");
    }

    console.log("Email enviado com sucesso:", data);

    return new Response(
      JSON.stringify({ success: true, emailId: data.id }),
      { 
        headers: { 
          "Content-Type": "application/json", 
          "Access-Control-Allow-Origin": "*" 
        } 
      }
    );

  } catch (error) {
    console.error("Erro na função send-email:", error);
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

function generateEmailHTML(emailType: string, data: any): string {
  const { clienteNome, dataAgendamento, horaAgendamento, servicos, valorTotal, osId } = data;

  const baseStyle = `
    <style>
      body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f6f9; margin: 0; padding: 0; }
      .container { max-width: 600px; margin: 30px auto; background-color: white; border-radius: 10px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.1); }
      .header { background: linear-gradient(135deg, #00A99D 0%, #008f83 100%); color: white; padding: 30px; text-align: center; }
      .header h1 { margin: 0; font-size: 24px; }
      .content { padding: 30px; }
      .info-box { background-color: #f4f6f9; padding: 20px; border-radius: 8px; margin: 20px 0; }
      .info-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px dashed #ddd; }
      .info-label { color: #666; font-weight: 600; }
      .info-value { color: #2c3e50; font-weight: 700; }
      .btn { display: inline-block; background-color: #00A99D; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: 700; margin: 20px 0; }
      .footer { background-color: #2c3e50; color: rgba(255,255,255,0.7); padding: 20px; text-align: center; font-size: 14px; }
      ul { list-style: none; padding: 0; }
      li { padding: 8px 0; padding-left: 25px; position: relative; }
      li:before { content: "✓"; position: absolute; left: 0; color: #00A99D; font-weight: bold; }
    </style>
  `;

  // CONFIRMAÇÃO DE AGENDAMENTO
  if (emailType === "confirmation") {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        ${baseStyle}
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✅ Agendamento Confirmado!</h1>
          </div>
          <div class="content">
            <p>Olá, <strong>${clienteNome}</strong>!</p>
            <p>Seu agendamento foi confirmado com sucesso! Estamos ansiosos para cuidar dos seus estofados.</p>
            
            <div class="info-box">
              <h3 style="margin-top: 0;">📋 Detalhes do Agendamento</h3>
              <div class="info-row">
                <span class="info-label">Data:</span>
                <span class="info-value">${dataAgendamento}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Horário:</span>
                <span class="info-value">${horaAgendamento}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Valor Total:</span>
                <span class="info-value">R$ ${valorTotal}</span>
              </div>
            </div>

            <h4>Serviços Agendados:</h4>
            <ul>
              ${servicos.map(s => `<li>${s.name} ${s.quantity > 1 ? `(x${s.quantity})` : ''}</li>`).join('')}
            </ul>

            <p><strong>Próximos Passos:</strong></p>
            <ul>
              <li>Você receberá um lembrete 24h antes do serviço</li>
              <li>Prepare o ambiente no horário agendado</li>
              <li>Nosso técnico entrará em contato antes de chegar</li>
            </ul>

            <a href="https://seusite.com/portal-cliente.html" class="btn">Ver Meu Agendamento</a>
          </div>
          <div class="footer">
            <p>&copy; 2025 Apex Care - Performance que traz tranquilidade</p>
            <p>contato@apexcare.com.br | WhatsApp: (31) XXXXX-XXXX</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // LEMBRETE 24H ANTES
  if (emailType === "reminder") {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        ${baseStyle}
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⏰ Lembrete: Serviço Amanhã!</h1>
          </div>
          <div class="content">
            <p>Olá, <strong>${clienteNome}</strong>!</p>
            <p>Este é um lembrete amigável de que seu serviço Apex Care está agendado para <strong>amanhã</strong>!</p>
            
            <div class="info-box">
              <h3 style="margin-top: 0;">📅 Informações do Serviço</h3>
              <div class="info-row">
                <span class="info-label">Data:</span>
                <span class="info-value">${dataAgendamento}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Horário:</span>
                <span class="info-value">${horaAgendamento}</span>
              </div>
            </div>

            <h4>📝 Checklist de Preparação:</h4>
            <ul>
              <li>Remova objetos soltos dos estofados</li>
              <li>Garanta acesso ao local</li>
              <li>Se tiver pets, mantenha-os em local seguro</li>
              <li>Tenha um ponto de água disponível</li>
            </ul>

            <p><strong>Nosso técnico entrará em contato antes de chegar!</strong></p>

            <a href="https://wa.me/55SEUDDDSEUNUMERO" class="btn">Falar no WhatsApp</a>
          </div>
          <div class="footer">
            <p>&copy; 2025 Apex Care</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // SERVIÇO INICIADO
  if (emailType === "started") {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        ${baseStyle}
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔧 Serviço Iniciado!</h1>
          </div>
          <div class="content">
            <p>Olá, <strong>${clienteNome}</strong>!</p>
            <p>Nosso técnico acabou de iniciar o serviço no seu endereço. Estamos trabalhando com todo cuidado e atenção!</p>
            
            <div class="info-box">
              <h3 style="margin-top: 0;">📋 Ordem de Serviço #${osId}</h3>
              <p>Você poderá acompanhar o progresso em tempo real através do seu Portal do Cliente.</p>
            </div>

            <p>Em breve você receberá fotos do antes e depois do tratamento!</p>

            <a href="https://seusite.com/portal-cliente.html" class="btn">Acompanhar Serviço</a>
          </div>
          <div class="footer">
            <p>&copy; 2025 Apex Care</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // SERVIÇO CONCLUÍDO
  if (emailType === "completed") {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        ${baseStyle}
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Serviço Concluído!</h1>
          </div>
          <div class="content">
            <p>Olá, <strong>${clienteNome}</strong>!</p>
            <p>Seu serviço foi concluído com sucesso! Esperamos que esteja satisfeito com o resultado.</p>
            
            <div class="info-box">
              <h3 style="margin-top: 0;">✅ OS #${osId} - Finalizada</h3>
              <p>Confira as fotos do resultado no seu Portal do Cliente.</p>
            </div>

            <h4>💡 Dicas de Manutenção:</h4>
            <ul>
              <li>Aspirar regularmente (1-2x por semana)</li>
              <li>Evitar exposição direta ao sol</li>
              <li>Limpar manchas imediatamente</li>
            </ul>

            <p><strong>Sua opinião é muito importante!</strong> Avalie nosso serviço:</p>

            <a href="https://seusite.com/portal-cliente.html" class="btn">Avaliar Serviço</a>
          </div>
          <div class="footer">
            <p>&copy; 2025 Apex Care - Obrigado pela confiança!</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  return "<p>Email inválido</p>";
}