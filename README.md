# Apex Care - Sistema de Agendamento e Gestão

Este repositório contém o código-fonte do sistema de agendamento e gestão da Apex Care, uma empresa especializada em tratamento técnico para estofados.

##  Visão Geral

O projeto é uma aplicação web completa que permite aos clientes solicitar orçamentos, agendar serviços e acompanhar o histórico de atendimentos. Para a equipe interna, oferece um painel administrativo para gerenciar agendamentos, clientes, técnicos e promoções.

## Tecnologias Utilizadas

- **Frontend:** HTML5, CSS3, JavaScript (ESM - ECMAScript Modules)
- **Backend (BaaS):** [Supabase](https://supabase.io/) - Utilizado para autenticação, banco de dados (PostgreSQL) e armazenamento de arquivos.
- **Hospedagem:** O projeto é estático e pode ser hospedado em qualquer serviço de hospedagem de sites estáticos, como Netlify, Vercel ou GitHub Pages.

## Estrutura do Projeto

```
/
├── css/                  # Arquivos de estilo
│   ├── style.css         # Estilos globais
│   ├── auth.css          # Estilos para telas de login/cadastro
│   └── ...
├── js/                   # Scripts JavaScript
│   ├── supabase-client.js # Configuração do cliente Supabase
│   ├── auth.js           # Lógica de autenticação
│   ├── orcamento.js      # Lógica do formulário de orçamento
│   └── ...
├── assets/               # Imagens, ícones e outros recursos
├── *.html                # Páginas da aplicação (index, login, portal, etc.)
└── README.md             # Este arquivo
```

## Configuração do Ambiente

### Pré-requisitos

- Um projeto Supabase configurado.
- As credenciais do Supabase (URL e Chave Anônima).

### Passos para Configuração

1.  **Clone o repositório:**
    ```bash
    git clone https://github.com/seu-usuario/apex-care.git
    cd apex-care
    ```

2.  **Configure as credenciais do Supabase:**
    No arquivo `js/supabase-client.js`, substitua as credenciais de exemplo pelas suas:

    ```javascript
    const SUPABASE_URL = 'SUA_URL_SUPABASE';
    const SUPABASE_ANON_KEY = 'SUA_CHAVE_ANON_SUPABASE';
    ```

3.  **Abra o `index.html` em seu navegador:**
    Para desenvolvimento local, você pode usar uma extensão como o [Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer) no VS Code para servir os arquivos.

## Funcionalidades

### Para Clientes

-   **Orçamento Instantâneo:** Um formulário de múltiplas etapas para calcular o valor do serviço com base no tipo de estofado, endereço e condições especiais.
-   **Agendamento Online:** Após o orçamento, o cliente pode escolher a data e o horário para o serviço.
-   **Portal do Cliente:** Uma área logada para visualizar agendamentos futuros, histórico de serviços e informações úteis.
-   **Autenticação:** Sistema de cadastro e login.

### Para Administradores

-   **Dashboard Geral:** Visão completa com estatísticas de agendamentos, receita, clientes e técnicos.
-   **Gestão de Agendamentos:** Aprovação de orçamentos, atribuição de técnicos e acompanhamento do status de cada serviço.
-   **Gestão de Usuários:** Visualização de clientes e técnicos, com a possibilidade de alterar seus níveis de acesso.
-   **Gestão de Promoções:** Criação e edição de campanhas de desconto.

### Para Técnicos

-   **Dashboard do Técnico:** Lista de ordens de serviço atribuídas.
-   **Painel da Ordem de Serviço:** Detalhes do cliente, endereço, serviços a serem realizados, checklist de materiais e registro fotográfico.

## Uso

-   **Página Inicial (`index.html`):** Apresentação da empresa, serviços e planos.
-   **Orçamento (`orcamento.html`):** Início do fluxo para novos clientes.
-   **Login (`login.html`):** Página de acesso para clientes e técnicos.
-   **Portal do Cliente (`portal-cliente.html`):** Área logada para clientes.
-   **Dashboard do Técnico (`tecnico-dashboard.html`):** Área logada para técnicos.
-   **Dashboard Administrativo (`admin-dashboard.html`):** Área logada para administradores.
