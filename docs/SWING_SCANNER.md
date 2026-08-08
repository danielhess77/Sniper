# Swing Scanner v1 — Locked Spec

**Edge:** Leadership (RS) + intact trend + disciplined pullback + reclaim trigger + structural geometry

## Horizons

| Parameter | Short (1–3 day) | Intermediate (1–3 week) |
|-----------|-----------------|-------------------------|
| RS lookback | 10 sessions vs SPY | 20 sessions vs SPY |
| Trend | Daily close > rising 20 EMA | + soft filter: price > 50 EMA or 50 flat/rising |
| Pullback TF | 30–60 min context on daily structure | Daily pullback into 20 EMA / prior swing low |
| Trigger | 15–30 min reclaim | Daily close reclaim or strong 60 min reclaim |
| Min R:R | 1.5 | 1.8 |
| Min risk | $0.50 or 0.15% | $0.75 or 0.25% |

## Hard filters (all must pass)

1. Trend (see above)
2. RS in **top 30%** of watchlist vs SPY
3. Valid pullback into demand without breaking trend
4. Trigger = reclaim with intent
5. Structural stop under pullback low
6. Measured-move target from prior impulse
7. Min risk + min R:R

## Soft quality

- RVOL on trigger preferred ≥ 1.0–1.2× (score boost, not hard reject in v1)
- Gap against setup > ~1.5–2% requires full reclaim
- Optional: SPY not in freefall (above its 20 EMA or not aggressively lower-lowing)

## States

`watching` → `triggered` → `qualified` / `invalid`

## v1 scope

- Longs only
- No indicator soup (no RSI/MACD/stoch/Bollinger)
- Earnings / IV module separate later
