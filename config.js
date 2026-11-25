'use strict';
// FabReceipt — shared config. All addresses verified on-chain 2026-11-25 (see ../RESEARCH.md).
module.exports = {
  chains: {
    mainnet: {
      name: 'X Layer mainnet',
      chainId: 196,
      rpc: 'https://rpc.xlayer.tech',
      rpcAlt: 'https://xlayerrpc.okx.com',
      explorer: 'https://www.okx.com/web3/explorer/xlayer',
    },
    testnet: {
      name: 'X Layer testnet',
      chainId: 1952,
      rpc: 'https://testrpc.xlayer.tech/terigon',
      rpcAlt: 'https://xlayertestrpc.okx.com/terigon',
      explorer: 'https://www.okx.com/web3/explorer/xlayer-test',
      faucet: 'https://www.okx.com/xlayer/faucet',
    },
  },
  // TapeOut protocol on X Layer mainnet (chain 196). Both are proxies (130 bytes of code,
  // EIP-1967 implementation slots read by the scanner). NOT deployed on testnet.
  tapeout: {
    factory: '0x1f09daefa827f02cbb40967cc91b259763760761', // CPU (processor) factory
    market: '0xd89f358c48a7B632c9845af2a02A32eB90DD75DB', // transistor/circuit market
  },
  // EIP-1967 storage slots
  slots: {
    implementation: '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc',
    admin: '0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103',
    beacon: '0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50',
  },
};
