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

## Como usar
Não precisa de instalação nem servidor próprio: é só publicar a pasta (ex.: GitHub Pages, Netlify, Vercel) e abrir no celular.
No iPhone: Safari → Compartilhar → **Adicionar à Tela de Início** para usar como app.

Para testar localmente:
```bash
python3 -m http.server 8000
# abra http://localhost:8000
```

> Os dados ficam salvos no próprio aparelho (navegador). Use **Configurações → Baixar backup** com frequência e restaure o arquivo para levar os dados a outro aparelho.
