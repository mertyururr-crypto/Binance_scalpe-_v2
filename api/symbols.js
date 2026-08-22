export default async function handler(req, res) {
  try {
    const r = await fetch("https://fapi.binance.com/fapi/v1/exchangeInfo");
    if (!r.ok) return res.status(502).json({ error: "Binance parite listesi alınamadı." });
    const data = await r.json();
    const symbols = data.symbols
      .filter(s => s.contractType === "PERPETUAL" && s.quoteAsset === "USDT" && s.status === "TRADING")
      .map(s => ({ symbol: s.symbol, baseAsset: s.baseAsset, quoteAsset: s.quoteAsset }))
      .sort((a,b) => a.symbol.localeCompare(b.symbol));
    res.setHeader("Cache-Control","s-maxage=300, stale-while-revalidate=600");
    return res.status(200).json({ count:symbols.length, symbols });
  } catch (e) {
    return res.status(500).json({ error:e?.message || "Sunucu hatası." });
  }
}