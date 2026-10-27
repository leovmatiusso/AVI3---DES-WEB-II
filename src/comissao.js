const BONUS_CLIENTE = Object.freeze({ PF: 2, PJ: 3 });

function calcularComissao(valorVenda, percentualBase, percentualCliente, percentualRegiao) {
  const valores = [valorVenda, percentualBase, percentualCliente, percentualRegiao].map(Number);
  if (valores.some((valor) => !Number.isFinite(valor))) {
    throw new TypeError('Os valores usados no cálculo da comissão devem ser numéricos.');
  }
  const [valor, base, cliente, regiao] = valores;
  return Number((valor * (base + cliente + regiao) / 100).toFixed(2));
}

module.exports = { BONUS_CLIENTE, calcularComissao };
