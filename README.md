# Sistema de Vendas com Comissões

API REST em Node.js, Express e MySQL para cadastro de vendedores, registro de vendas, cálculo de comissões e relatório de desempenho.

## Requisitos

- Node.js 18 ou superior
- MySQL 8 (ou versão compatível com `CHECK` constraints)

## Instalação e configuração

1. Crie o banco, as tabelas e a massa inicial de teste:

   ```sh
   mysql -u root -p < database/schema.sql
   ```

   O script cria o banco `db_vendas`, quatro regiões, cinco vendedores e quinze vendas de outubro de 2026. Pode ser executado novamente sem duplicar esses registros.
2. Instale as dependências:

   ```sh
   npm install
   ```
3. Copie `.env.example` para `.env` e informe os dados locais do MySQL. O arquivo `.env` está ignorado pelo Git.
4. Inicie a API:

   ```sh
   npm start
   ```

   Em desenvolvimento, use `npm run dev`. A API inicia em `http://localhost:3000`.

## Regras de comissão

- Bônus do cliente: PF = 2%; PJ = 3%.
- Bônus regional: Norte = 1%; Nordeste = 1%; Sudeste = 0%; Sul = 0,5%.
- Comissão = valor da venda × (percentual base + bônus do cliente + bônus regional) ÷ 100.

Exemplo: R$ 2.000,00, vendedor com base de 5%, cliente PJ e região Norte resultam em R$ 180,00. O cálculo fica centralizado em `src/comissao.js`.

## Endpoints

| Método | Caminho | Uso |
| --- | --- | --- |
| GET | `/health` | Verifica API e conexão ao banco |
| POST | `/vendedores` | Cadastra `{ "nome", "meta_mensal", "percentual_base" }` |
| GET | `/vendedores` | Lista vendedores |
| GET | `/vendedores/:id` | Consulta vendedor |
| PUT | `/vendedores/:id` | Atualiza `{ "meta_mensal", "percentual_base" }` |
| PATCH | `/vendedores/:id/desativar` | Desativa sem apagar o histórico |
| POST | `/vendas` | Registra venda e calcula comissão |
| GET | `/vendas` | Lista vendas com vendedor e região |
| GET | `/vendas/vendedor/:id` | Filtra por vendedor |
| GET | `/vendas/regiao/:id` | Filtra por região |
| DELETE | `/vendas/:id` | Exclui uma venda existente |
| GET | `/relatorios/performance?inicio=2026-10-01&fim=2026-10-31` | Consolida indicadores do período |

Exemplo de corpo para venda:

```json
{
  "id_venda": 2001,
  "id_vendedor": 1,
  "id_regiao": 1,
  "data_venda": "2026-10-25 10:00:00",
  "valor_venda": 2000,
  "tipo_cliente": "PJ"
}
```

`data_venda` pode ser omitida; nesse caso, a data e hora atuais são usadas. Códigos duplicados retornam HTTP 409; dados inválidos retornam 400; entidades inexistentes, 404; falhas de banco indisponível, 503. As demais falhas não previstas retornam 500.

O relatório aceita um único mês de referência por chamada para comparar corretamente as vendas acumuladas no mês com a meta mensal. Ele mostra quantidade e valor das vendas, comissões, distribuição por região e tipo de cliente, desempenho por vendedor e quantidade de vendedores que atingiram a meta.

## Verificações da atividade

Importe `postman/collection.json` no Postman. Ela contém requisições para listar e cadastrar vendedores, atualizar a meta, registrar venda com comissão de R$ 180, testar código duplicado e vendedor inexistente, consultar por vendedor/região, gerar o relatório, desativar e excluir venda. Rode `GET /health` primeiro e execute a inclusão de venda antes das chamadas de erro duplicado. Para completar os cenários obrigatórios, chame `PATCH /vendedores/5/desativar` e depois envie uma venda com `id_vendedor: 5` (espera HTTP 400); para validar vendedor inexistente, use um código que não esteja cadastrado (espera HTTP 404). Os IDs de teste no SQL vão de 1001 a 1015. Atualize a meta com `PUT /vendedores/1` e confirme no relatório mensal. Para observar o tratamento de falha de conexão, pare o MySQL e consulte `GET /health` (espera HTTP 503); depois reinicie o banco.

As capturas de tela das requisições e respostas precisam ser feitas com a API e o MySQL em execução no Postman/Insomnia local. As respostas não são pré-fabricadas neste projeto; os dados de teste e coleção permitem gerar evidências reais no ambiente configurado.
