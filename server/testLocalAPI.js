fetch('http://localhost:3002/api/market/sectors/top-changes')
  .then(r => r.text())
  .then(d => console.log(d.slice(0, 300)))
  .catch(console.error);
