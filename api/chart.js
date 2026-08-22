function ema(values, period) {
  const k = 2 / (period + 1);
  const out = [values[0]];
  for (let i = 1; i < values.length; i++) out.push(values[i] * k + out[i - 1] * (1 - k));
  return out;
}

export default async function handler(req, res) {
  try {
    const symbol = String(req.query.symbol || "BTCUSDT").toUpperCase();
    const interval = String(req.query.interval || "5m");
    const limit = Math.max(220, Math.min(500, parseInt(req.query.limit || "300", 10)));

    if (!/^[A-Z0-9]{5,20}$/.test(symbol)) {
      return res.status(400).json({ error: "Geçersiz sembol." });
    }
    if (!["1m","3m","5m","15m","1h"].includes(interval)) {
      return res.status(400).json({ error: "Geçersiz zaman dilimi." });
    }

    const r = await fetch(
      `https://fapi.binance.com/fapi/v1/klines?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(interval)}&limit=${limit}`
    );

    if (!r.ok) return res.status(502).json({ error: "Binance grafik verisi alınamadı." });

    const k = await r.json();
    const closed = k.slice(0, -1);
    const close = closed.map(x => +x[4]);
    const e20 = ema(close, 20);
    const e50 = ema(close, 50);
    const e200 = ema(close, 200);

    const candles = closed.map(x => ({
      time: Math.floor(+x[0] / 1000),
      open: +x[1],
      high: +x[2],
      low: +x[3],
      close: +x[4]
    }));

    const toLine = values => values.map((v, i) => ({
      time: Math.floor(+closed[i][0] / 1000),
      value: v
    }));

    res.setHeader("Cache-Control", "s-maxage=15, stale-while-revalidate=15");
    return res.status(200).json({
      symbol,
      interval,
      candles,
      ema20: toLine(e20),
      ema50: toLine(e50),
      ema200: toLine(e200),
      timestamp: new Date().toISOString()
    });
  } catch (e) {
    return res.status(500).json({ error: e?.message || "Grafik sunucu hatası." });
  }
}
