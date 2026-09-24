const token = '659ef6c33264126c2cccbd3ecd936a8bea6d7224d2b743230fb4b3b0616f3dcd';
const urls = [
  'https://api.sectors.app/v2/companies/BBCA.JK/report/',
  'https://api.sectors.app/v2/companies/BBCA.JK/',
  'https://api.sectors.app/v2/companies/?sector=technology',
  'https://api.sectors.app/v2/companies/top-changes/'
];

Promise.all(urls.map(url => 
  fetch(url, { headers: { 'Authorization': token } })
    .then(r => r.json())
    .then(d => ({ url, data: JSON.stringify(d).slice(0, 200) }))
    .catch(err => ({ url, error: err.message }))
)).then(console.log);
