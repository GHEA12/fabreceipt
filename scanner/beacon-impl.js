const { ethers } = require('ethers');
const config = require('../config');
(async () => {
  const p = new ethers.JsonRpcProvider(config.chains.mainnet.rpc);
  for (const b of process.argv.slice(2)) {
    const c = new ethers.Contract(b, ['function implementation() view returns (address)'], p);
    console.log(b, '-> impl', await c.implementation());
  }
})();
