# RB Tech Celulares — Sistema da Assistência

App web (PWA) para gestão da assistência técnica **RB Tech Celulares**: tema preto, textos brancos e destaques em dourado.

## Funcionalidades
- **Dashboard**: faturamento do dia x meta diária, lucro líquido, OS por status, últimos 7 dias, OS prontas para retirada.
- **Ordens de Serviço**: abertura em 3 passos (cliente → aparelho → serviço), checklist de entrada, senha, acessórios, técnico, previsão; troca de status rápida; peças do estoque na OS; pagamento com forma/desconto; impressão da OS (2 vias), etiqueta e **termo de garantia** com assinatura do técnico e do cliente; WhatsApp em um toque; lixeira e auditoria.
- **Bancada**: quadro por etapa (Em Análise, Aguardando Peça, Em Serviço, Concluído).
- **Orçamentos**: itens, validade, envio por WhatsApp, impressão e conversão em OS.
- **Clientes e Aparelhos**: cadastro com CPF/CNPJ, WhatsApp, origem, vários aparelhos (IMEI/serial), histórico e total gasto.
- **Peças (estoque)**: custo, mínimo, fornecedores, entrada em lote, histórico de movimentação, etiquetas, CSV.
- **Venda de Produtos (PDV)**: **Nova venda** com produtos do estoque ou cadastrados na hora (celular ou acessório), cliente cadastrado ou novo, troca, desconto, recibo em PDF e cancelamento com estorno.
- **Pós-Venda**: acompanhamento após o serviço, aparelhos não retirados, garantias vencendo, aniversariantes.
- **Serviços**: catálogo com preço e garantia padrão.
- **Financeiro**: receitas, custos, taxas de cartão, despesas, lucro e margem por período.
- **Caixa**: abertura, sangria, suprimento e fechamento com conferência.
- **Relatórios** e **Configurações** (dados da loja, metas, termos, técnicos/assinaturas, backup/restauração).

## Acompanhamento do cliente e garantias
- **Link de acompanhamento**: ao cadastrar a OS, o botão **Enviar link pelo WhatsApp** manda ao cliente um link (`/acompanhar/<código>`) onde ele vê o status em tempo real, a previsão e o histórico. O link usa um código secreto e mostra só aquela OS (sem telefone, CPF ou IMEI). Requer a nuvem (Supabase) ligada.
- **Garantia em PDF**: ao marcar a OS como **Concluído**, o app gera o termo de garantia em PDF (baixar ou compartilhar no WhatsApp). O cliente também baixa o PDF pelo link de acompanhamento.
- **Prazos fixos**: reparos **3 meses** (a partir da conclusão) · aparelhos **seminovos 6 meses** (a partir da venda). Marque o produto como "Aparelho seminovo" para gerar o termo de 6 meses na venda, com IMEI.

## Pedido de orçamento pelo cliente
Link público `/pedido/<id da loja>` (copie em **Configurações** ou em **OS → Pedidos**): o cliente informa nome, WhatsApp, marca, modelo, defeito e urgência. O pedido chega na hora com **pop-up e som**, aparece na aba **OS → Pedidos** (não lidos em destaque) e no Dashboard. Ao abrir: **Aceitar e criar orçamento** (já preenchido) → enviar o orçamento pelo WhatsApp. Requer a nuvem e o `schema.sql` atualizado.

### Aviso de pedidos por e-mail
Quando o cliente envia um pedido pelo link, além do aviso no app de todos da equipe, o Supabase manda um e-mail para cada membro com o sino ligado (Configurações → Equipe). O envio usa o Brevo (grátis até 300/dia): crie a conta em brevo.com, gere a chave de API (SMTP & API → API Keys) e cole em **Configurações → Aviso de pedidos por e-mail**. A chave fica só no banco, nunca no código.

### Funcionário com loja separada
Se o funcionário entrou no app antes de ser adicionado e criou uma loja própria, ao ser adicionado (ou ao rodar o `schema.sql` de novo) os dados dessa loja são juntados automaticamente na loja da equipe.

## Metas
Aba **Metas** com dashboard do mês: metas de quantidade ligadas a produtos do cadastro (ex.: 20 fones bluetooth, 10 capas premium), meta de celulares (qualquer novo ou seminovo vendido conta) e **lucro mínimo por aparelho** (ex.: R$ 400), com média, vendas que bateram/ficaram abaixo, ritmo diário e projeção. A Nova venda avisa quando o lucro do aparelho fica abaixo da meta.

## Aparelhos (estoque de celulares)
Aba **Aparelhos**: celulares seminovos e novos à venda, com custo, preço, lucro, dias parado e status (disponível / reservado / em revisão). Edição rápida de preço e status, anúncio pronto para WhatsApp, **venda com troca** (o aparelho do cliente abate do valor e entra no estoque em revisão) e **compra de aparelho** de cliente. Compras de estoque saem do caixa mas só entram no lucro como custo quando o item é vendido.

## Importar do sistema antigo
**Configurações → Importar do sistema antigo → Lista de clientes (PDF)** lê o PDF da base de clientes do Reparo Pro (nome, telefone, e-mail, total gasto, última visita) e completa/cadastra os clientes. O botão **Dossiê de auditoria (CSV)** lê o *Dossiê de auditoria (CSV)* e importa clientes (só nomes), OS em aberto, vendas do período (opcionalmente no financeiro), estoque e serviços. Não duplica se importado de novo. O dossiê não traz telefones/CPF nem o histórico completo de OS e recebimentos de serviços.

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
Funcionários: o dono cria o login (nome, e-mail e senha) em **Configurações → Equipe e nuvem → Adicionar funcionário**. O funcionário entra com esse e-mail e senha e vê as mesmas telas e dados. O dono pode remover o acesso a qualquer momento. (Também dá para usar o código de convite.)

> Recomendado: em **Authentication → Sign In / Providers → Email**, desligue **Confirm email** para o funcionário entrar na hora, sem precisar clicar em link no e-mail.

Segurança: cada loja só enxerga os próprios dados (Row Level Security no Postgres). A chave *anon* é pública por natureza e pode ficar no código.

Sem `js/config.js` preenchido, o app funciona em **modo local** (dados só no aparelho; use **Configurações → Baixar backup**).
