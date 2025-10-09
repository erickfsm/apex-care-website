import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { MercadoPagoConfig, Preference } from "npm:mercadopago";

console.log("Função 'create-payment' v2 iniciada.");

serve(async (req) => {
  
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" } });
  }

  try {
    // 1. Pega os segredos que guardamos no Supabase
    const MP_ACCESS_TOKEN = Deno.env.get("MP_ACCESS_TOKEN");
    const SITE_URL = Deno.env.get("SITE_URL"); 
    console.log("URL do site lida do segredo:", SITE_URL);

    // 2. Inicializa o cliente do Mercado Pago
    const client = new MercadoPagoConfig({ accessToken: MP_ACCESS_TOKEN! });
    
    // 3. Pega os dados que o seu site enviou
    const { appointmentId, items, clientEmail } = await req.json();
    
    // 4. Cria o corpo da preferência de pagamento
    const preferenceBody = {
      items: items.map(item => ({
        id: item.id.toString(),
        title: item.name,
        quantity: item.quantity,
        unit_price: item.price,
        category_id: 'services',
      })),
      payer: {
        email: clientEmail
      },
      back_urls: {
        // AGORA USAMOS A URL FIXA E SEGURA
        success: `${SITE_URL}/pagamento-sucesso.html`,
        failure: `${SITE_URL}/pagamento-falha.html`,
      },
      auto_return: "approved",
      external_reference: appointmentId.toString(),
    };

    // 5. Cria uma nova instância de Preferência e envia para o Mercado Pago
    const preference = new Preference(client);
    const result = await preference.create({ body: preferenceBody });
    const checkoutUrl = result.init_point;

    // 6. Retorna o link de checkout para o seu site
    return new Response(
      JSON.stringify({ checkoutUrl }),
      { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
    );

  } catch (error) {
    console.error("Erro ao criar preferência de pagamento:", error);
    const errorMessage = error.cause ? error.cause.message : error.message;
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
    );
  }
});
