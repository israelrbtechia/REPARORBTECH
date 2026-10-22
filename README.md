# RB Tech Celulares — Sistema da Assistência

App web (PWA) para gestão da assistência técnica **RB Tech Celulares**: tema preto, textos brancos e destaques em dourado.

## Funcionalidades
- **Dashboard**: faturamento do dia x meta diária, lucro líquido, OS por status, últimos 7 dias, OS prontas para retirada.
- **Ordens de Serviço**: abertura em 3 passos (cliente → aparelho → serviço), checklist de entrada, senha, acessórios, técnico, previsão; troca de status rápida; peças do estoque na OS; pagamento com forma/desconto; impressão da OS (2 vias), etiqueta e **termo de garantia** com assinatura do técnico e do cliente; WhatsApp em um toque; lixeira e auditoria.
- **Bancada**: quadro por etapa (Em Análise, Aguardando Peça, Em Serviço, Concluído).
- **Orçamentos**: itens, validade, envio por WhatsApp, impressão e conversão em OS.
- **Clientes e Aparelhos**: cadastro com CPF/CNPJ, WhatsApp, origem, vários aparelhos (IMEI/serial), histórico e total gasto.
- **Peças (estoque)**: custo, mínimo, fornecedores, entrada em lote, histórico de movimentação, etiquetas, CSV.
- **Venda de Produtos (PDV)**: carrinho, desconto, formas de pagamento, recibo, cancelamento com estorno de estoque.
- **Pós-Venda**: acompanhamento após o serviço, aparelhos não retirados, garantias vencendo, aniversariantes.
- **Serviços**: catálogo com preço e garantia padrão.
- **Financeiro**: receitas, custos, taxas de cartão, despesas, lucro e margem por período.
- **Caixa**: abertura, sangria, suprimento e fechamento com conferência.
- **Relatórios** e **Configurações** (dados da loja, metas, termos, técnicos/assinaturas, backup/restauração).

## Acompanhamento do cliente e garantias
- **Link de acompanhamento**: ao cadastrar a OS, o botão **Enviar link pelo WhatsApp** manda ao cliente um link (`/acompanhar/<código>`) onde ele vê o status em tempo real, a previsão e o histórico. O link usa um código secreto e mostra só aquela OS (sem telefone, CPF ou IMEI). Requer a nuvem (Supabase) ligada.
- **Garantia em PDF**: ao marcar a OS como **Concluído**, o app gera o termo de garantia em PDF (baixar ou compartilhar no WhatsApp). O cliente também baixa o PDF pelo link de acompanhamento.
- **Prazos fixos**: reparos **3 meses** (a partir da conclusão) · aparelhos **seminovos 6 meses** (a partir da venda). Marque o produto como "Aparelho seminovo" para gerar o termo de 6 meses na venda, com IMEI.

## Importar do sistema antigo
**Configurações → Importar do sistema antigo** lê o *Dossiê de auditoria (CSV)* e importa clientes (só nomes), OS em aberto, vendas do período (opcionalmente no financeiro), estoque e serviços. Não duplica se importado de novo. O dossiê não traz telefones/CPF nem o histórico completo de OS e recebimentos de serviços.

## Como usar
Site estático, sem build. Publicação na **Vercel**:
1. Em vercel.com → **Add New → Project** → importe o repositório `REPARORBTECH`.
2. Framework Preset: **Other**. Deixe *Build Command* e *Output Directory* vazios (raiz).
3. **Deploy**. Cada push na branch `master` publica uma nova versão automaticamente.

O `vercel.json` garante que o service worker (modo offline) seja sempre atualizado.
No iPhone: Safari → Compartilhar → **Adicionar à Tela de Início** para usar como app.

Para testar localmente:
```bash
python3 -m http.server 8000
# abra http://localhost:8000
```

## Nuvem (Supabase)
Com o Supabase ligado, os dados ficam na nuvem e sincronizam **em tempo real** entre celular, computador e funcionários. O app continua funcionando sem internet: salva no aparelho e envia quando a conexão volta.

1. Crie um projeto grátis em [supabase.com](https://supabase.com).
2. No projeto, abra **SQL Editor → New query**, cole todo o conteúdo de [`supabase/schema.sql`](supabase/schema.sql) e clique em **Run**.
3. Em **Project Settings → API**, copie a **Project URL** e a chave **anon public** e cole em [`js/config.js`](js/config.js).
4. Em **Authentication → URL Configuration**, coloque o endereço do app na Vercel em **Site URL** (ex.: `https://reparorbtech.vercel.app`). É para onde vão os links de confirmação de e-mail e de "esqueci a senha".
5. Faça o commit/push — a Vercel publica sozinha.

> Atualizou o app? Rode o `supabase/schema.sql` de novo no SQL Editor (é seguro repetir) para criar as funções novas, como a do link de acompanhamento.

No primeiro acesso: **Criar conta → Criar minha loja**. Se o aparelho já tiver dados salvos (modo local), o app oferece enviá-los para a nuvem.
Funcionários: criam a própria conta no app e entram com o **código de convite** mostrado em **Configurações → Equipe e nuvem**. O dono pode remover funcionários e gerar um novo código.

Segurança: cada loja só enxerga os próprios dados (Row Level Security no Postgres). A chave *anon* é pública por natureza e pode ficar no código.

Sem `js/config.js` preenchido, o app funciona em **modo local** (dados só no aparelho; use **Configurações → Baixar backup**).
