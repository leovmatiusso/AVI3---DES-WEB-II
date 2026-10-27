const express = require('express');
const pool = require('./db');
const { BONUS_CLIENTE, calcularComissao } = require('./comissao');

const app = express();
app.use(express.json());

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function validarId(value, campo = 'código') {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, `${campo} deve ser um inteiro positivo.`);
  return id;
}

function validarData(value, campo) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '') || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
    throw new HttpError(400, `${campo} deve estar no formato YYYY-MM-DD.`);
  }
  return value;
}

async function requireVendedor(id, { ativo = false } = {}) {
  const [rows] = await pool.execute('SELECT id_vendedor, ativo FROM vendedores WHERE id_vendedor = ?', [id]);
  if (!rows.length) throw new HttpError(404, 'Vendedor não encontrado.');
  if (ativo && !rows[0].ativo) throw new HttpError(400, 'Não é possível registrar venda para vendedor inativo.');
  return rows[0];
}

async function requireRegiao(id) {
  const [rows] = await pool.execute('SELECT id_regiao FROM regioes WHERE id_regiao = ?', [id]);
  if (!rows.length) throw new HttpError(400, 'Região não encontrada.');
  return rows[0];
}

app.get('/health', asyncRoute(async (_req, res) => {
  await pool.execute('SELECT 1');
  res.json({ status: 'ok', banco: 'conectado' });
}));

app.post('/vendedores', asyncRoute(async (req, res) => {
  const { nome, meta_mensal, percentual_base } = req.body;
  if (typeof nome !== 'string' || !nome.trim()) throw new HttpError(400, 'nome é obrigatório.');
  if (!Number.isFinite(Number(meta_mensal)) || Number(meta_mensal) <= 0) throw new HttpError(400, 'meta_mensal deve ser positiva.');
  if (!Number.isFinite(Number(percentual_base)) || Number(percentual_base) < 0 || Number(percentual_base) > 100) throw new HttpError(400, 'percentual_base deve estar entre 0 e 100.');
  const [result] = await pool.execute(
    'INSERT INTO vendedores (nome, meta_mensal, percentual_base) VALUES (?, ?, ?)',
    [nome.trim(), Number(meta_mensal), Number(percentual_base)],
  );
  const [rows] = await pool.execute('SELECT * FROM vendedores WHERE id_vendedor = ?', [result.insertId]);
  res.status(201).json(rows[0]);
}));

app.get('/vendedores', asyncRoute(async (_req, res) => {
  const [rows] = await pool.execute('SELECT * FROM vendedores ORDER BY id_vendedor');
  res.json(rows);
}));

app.get('/vendedores/:id', asyncRoute(async (req, res) => {
  const id = validarId(req.params.id, 'id');
  const [rows] = await pool.execute('SELECT * FROM vendedores WHERE id_vendedor = ?', [id]);
  if (!rows.length) throw new HttpError(404, 'Vendedor não encontrado.');
  res.json(rows[0]);
}));

app.put('/vendedores/:id', asyncRoute(async (req, res) => {
  const id = validarId(req.params.id, 'id');
  await requireVendedor(id);
  const { meta_mensal, percentual_base } = req.body;
  if (!Number.isFinite(Number(meta_mensal)) || Number(meta_mensal) <= 0) throw new HttpError(400, 'meta_mensal deve ser positiva.');
  if (!Number.isFinite(Number(percentual_base)) || Number(percentual_base) < 0 || Number(percentual_base) > 100) throw new HttpError(400, 'percentual_base deve estar entre 0 e 100.');
  await pool.execute('UPDATE vendedores SET meta_mensal = ?, percentual_base = ? WHERE id_vendedor = ?', [Number(meta_mensal), Number(percentual_base), id]);
  const [rows] = await pool.execute('SELECT * FROM vendedores WHERE id_vendedor = ?', [id]);
  res.json(rows[0]);
}));

app.patch('/vendedores/:id/desativar', asyncRoute(async (req, res) => {
  const id = validarId(req.params.id, 'id');
  await requireVendedor(id);
  await pool.execute('UPDATE vendedores SET ativo = 0 WHERE id_vendedor = ?', [id]);
  res.json({ mensagem: 'Vendedor desativado.', id_vendedor: id });
}));

app.post('/vendas', asyncRoute(async (req, res) => {
  const { id_venda, id_vendedor: vendedorRaw, id_regiao: regiaoRaw, data_venda, valor_venda, tipo_cliente } = req.body;
  const id = validarId(id_venda, 'id_venda');
  const idVendedor = validarId(vendedorRaw, 'id_vendedor');
  const idRegiao = validarId(regiaoRaw, 'id_regiao');
  await requireVendedor(idVendedor, { ativo: true });
  await requireRegiao(idRegiao);
  if (!Number.isFinite(Number(valor_venda)) || Number(valor_venda) <= 0) throw new HttpError(400, 'valor_venda deve ser positivo.');
  if (!['PF', 'PJ'].includes(tipo_cliente)) throw new HttpError(400, 'tipo_cliente deve ser PF ou PJ.');
  const data = data_venda || new Date().toISOString().slice(0, 19).replace('T', ' ');
  if (Number.isNaN(Date.parse(data.replace(' ', 'T')))) throw new HttpError(400, 'data_venda inválida.');
  const [duplicates] = await pool.execute('SELECT id_venda FROM vendas WHERE id_venda = ?', [id]);
  if (duplicates.length) throw new HttpError(409, 'Código de venda já cadastrado.');
  const [[vendedor]] = await pool.execute('SELECT percentual_base FROM vendedores WHERE id_vendedor = ?', [idVendedor]);
  const [[regiao]] = await pool.execute('SELECT percentual_bonus FROM regioes WHERE id_regiao = ?', [idRegiao]);
  const comissao = calcularComissao(Number(valor_venda), vendedor.percentual_base, BONUS_CLIENTE[tipo_cliente], regiao.percentual_bonus);
  await pool.execute(
    'INSERT INTO vendas (id_venda, id_vendedor, id_regiao, data_venda, valor_venda, tipo_cliente, valor_comissao) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, idVendedor, idRegiao, data, Number(valor_venda), tipo_cliente, comissao],
  );
  const [rows] = await pool.execute('SELECT * FROM vendas WHERE id_venda = ?', [id]);
  res.status(201).json(rows[0]);
}));

app.get('/vendas', asyncRoute(async (_req, res) => {
  const [rows] = await pool.execute(`SELECT v.*, ve.nome AS vendedor, r.nome_regiao AS regiao
    FROM vendas v JOIN vendedores ve ON ve.id_vendedor = v.id_vendedor
    JOIN regioes r ON r.id_regiao = v.id_regiao ORDER BY v.data_venda DESC, v.id_venda`);
  res.json(rows);
}));

app.get('/vendas/vendedor/:id', asyncRoute(async (req, res) => {
  const id = validarId(req.params.id, 'id');
  await requireVendedor(id);
  const [rows] = await pool.execute(`SELECT v.*, ve.nome AS vendedor, r.nome_regiao AS regiao
    FROM vendas v JOIN vendedores ve ON ve.id_vendedor = v.id_vendedor
    JOIN regioes r ON r.id_regiao = v.id_regiao WHERE v.id_vendedor = ? ORDER BY v.data_venda DESC`, [id]);
  res.json(rows);
}));

app.get('/vendas/regiao/:id', asyncRoute(async (req, res) => {
  const id = validarId(req.params.id, 'id');
  await requireRegiao(id);
  const [rows] = await pool.execute(`SELECT v.*, ve.nome AS vendedor, r.nome_regiao AS regiao
    FROM vendas v JOIN vendedores ve ON ve.id_vendedor = v.id_vendedor
    JOIN regioes r ON r.id_regiao = v.id_regiao WHERE v.id_regiao = ? ORDER BY v.data_venda DESC`, [id]);
  res.json(rows);
}));

app.delete('/vendas/:id', asyncRoute(async (req, res) => {
  const id = validarId(req.params.id, 'id');
  const [rows] = await pool.execute('SELECT id_venda FROM vendas WHERE id_venda = ?', [id]);
  if (!rows.length) throw new HttpError(404, 'Venda não encontrada.');
  await pool.execute('DELETE FROM vendas WHERE id_venda = ?', [id]);
  res.status(200).json({ mensagem: 'Venda excluída.', id_venda: id });
}));

app.get('/relatorios/performance', asyncRoute(async (req, res) => {
  const inicio = validarData(req.query.inicio, 'inicio');
  const fim = validarData(req.query.fim, 'fim');
  if (inicio > fim) throw new HttpError(400, 'inicio deve ser anterior ou igual a fim.');
  const inicioMes = `${inicio.slice(0, 7)}-01`;
  const ultimoDiaMes = new Date(Date.UTC(Number(inicio.slice(0, 4)), Number(inicio.slice(5, 7)), 0)).toISOString().slice(0, 10);
  if (fim.slice(0, 7) !== inicio.slice(0, 7)) throw new HttpError(400, 'O período deve pertencer a um único mês para apuração das metas.');

  const params = [inicio, `${fim} 23:59:59`];
  const [totais] = await pool.execute(`SELECT COUNT(*) AS total_vendas, COALESCE(SUM(valor_venda), 0) AS valor_total,
    COALESCE(SUM(valor_comissao), 0) AS comissao_total, COALESCE(AVG(valor_comissao), 0) AS comissao_media
    FROM vendas WHERE data_venda BETWEEN ? AND ?`, params);
  const [porRegiao] = await pool.execute(`SELECT r.id_regiao, r.nome_regiao, COUNT(v.id_venda) AS quantidade_vendas,
    COALESCE(SUM(v.valor_venda), 0) AS valor_total, COALESCE(AVG(v.valor_comissao), 0) AS comissao_media
    FROM regioes r LEFT JOIN vendas v ON v.id_regiao = r.id_regiao AND v.data_venda BETWEEN ? AND ?
    GROUP BY r.id_regiao, r.nome_regiao ORDER BY valor_total DESC`, params);
  const [porCliente] = await pool.execute(`SELECT tipo_cliente, COUNT(*) AS quantidade_vendas, SUM(valor_venda) AS valor_total
    FROM vendas WHERE data_venda BETWEEN ? AND ? GROUP BY tipo_cliente ORDER BY tipo_cliente`, params);
  const [porVendedor] = await pool.execute(`SELECT ve.id_vendedor, ve.nome, ve.meta_mensal,
    COALESCE(SUM(CASE WHEN v.data_venda BETWEEN ? AND ? THEN v.valor_venda ELSE 0 END), 0) AS valor_vendido_periodo,
    COALESCE(SUM(CASE WHEN v.data_venda BETWEEN ? AND ? THEN v.valor_comissao ELSE 0 END), 0) AS comissao_periodo,
    CASE WHEN COALESCE(SUM(CASE WHEN v.data_venda BETWEEN ? AND ? THEN v.valor_venda ELSE 0 END), 0) >= ve.meta_mensal THEN 1 ELSE 0 END AS meta_atingida_mes
    FROM vendedores ve LEFT JOIN vendas v ON v.id_vendedor = ve.id_vendedor AND v.data_venda BETWEEN ? AND ?
    GROUP BY ve.id_vendedor, ve.nome, ve.meta_mensal ORDER BY valor_vendido_periodo DESC`,
  [inicioMes, `${ultimoDiaMes} 23:59:59`, inicioMes, `${ultimoDiaMes} 23:59:59`, inicioMes, `${ultimoDiaMes} 23:59:59`, inicioMes, `${ultimoDiaMes} 23:59:59`]);
  const [maiorComissao] = await pool.execute(`SELECT ve.id_vendedor, ve.nome, SUM(v.valor_comissao) AS comissao_total
    FROM vendedores ve JOIN vendas v ON v.id_vendedor = ve.id_vendedor WHERE v.data_venda BETWEEN ? AND ?
    GROUP BY ve.id_vendedor, ve.nome ORDER BY comissao_total DESC LIMIT 1`, params);
  const [atingimento] = await pool.execute(`SELECT COUNT(*) AS vendedores_com_meta_atingida FROM (
    SELECT ve.id_vendedor FROM vendedores ve LEFT JOIN vendas v ON v.id_vendedor = ve.id_vendedor
    AND v.data_venda BETWEEN ? AND ? GROUP BY ve.id_vendedor, ve.meta_mensal
    HAVING COALESCE(SUM(v.valor_venda), 0) >= ve.meta_mensal) AS metas`,
  [inicioMes, `${ultimoDiaMes} 23:59:59`]);

  res.json({ periodo: { inicio, fim, mes_referencia: inicio.slice(0, 7) }, resumo: totais[0], vendas_por_regiao: porRegiao,
    vendas_por_tipo_cliente: porCliente, desempenho_por_vendedor: porVendedor, vendedores_com_meta_atingida: atingimento[0].vendedores_com_meta_atingida,
    vendedor_com_maior_comissao: maiorComissao[0] || null });
}));

app.use((req, res) => res.status(404).json({ erro: 'Rota não encontrada.' }));

app.use((error, _req, res, _next) => {
  console.error('Erro na API:', error.message);
  if (error instanceof HttpError) return res.status(error.status).json({ erro: error.message });
  if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ erro: 'Código de venda já cadastrado.' });
  if (error.code === 'ER_NO_REFERENCED_ROW_2') return res.status(400).json({ erro: 'Vendedor ou região não encontrado.' });
  if (error.code === 'ECONNREFUSED' || error.code === 'PROTOCOL_CONNECTION_LOST') return res.status(503).json({ erro: 'Não foi possível conectar ao banco de dados.' });
  if (error instanceof SyntaxError && 'body' in error) return res.status(400).json({ erro: 'JSON inválido.' });
  return res.status(500).json({ erro: 'Erro interno do servidor.' });
});

module.exports = app;
