const { LiveStrategyRunner } = require('./src/runner/live-strategy-runner');

async function gen() {
  const timeframes = ['180m', '120m', '240m'];
  for (const tf of timeframes) {
    const runner = new LiveStrategyRunner({ timeframe: tf });
    try {
      const result = await runner.run();
      console.log(tf, '- candles:', result.candles.length, 'strategy:', result.strategy?.signal);
    } catch (e) {
      console.error(tf, '- Error:', e.message);
    }
  }
}

gen();