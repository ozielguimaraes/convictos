export function fmt(v) {
  return "R$ " + Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function priceToStr(v) {
  return Number(v || 0).toFixed(2).replace(".", ",");
}

export function strToPrice(s) {
  // Com vírgula decimal, pontos são separador de milhar (ex.: "1.234,56").
  const raw = String(s).includes(",")
    ? String(s).replace(/\./g, "").replace(",", ".")
    : String(s);
  const n = parseFloat(raw.replace(/[^0-9.]/g, ""));
  return isNaN(n) ? 0 : n;
}
