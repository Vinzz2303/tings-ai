fetch('http://localhost:3002/api/market/insider-radar?symbol=AAPL')
  .then(r => r.json())
  .then(d => console.log(d.ok ? 'SUCCESS: ' + d.data.length : 'FAILED'))
  .catch(console.error);
