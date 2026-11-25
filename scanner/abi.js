'use strict';
// FabReceipt — TapeOut ABIs, reverse-engineered 2026-11-25 (see ABI.md for the
// discovery method and evidence). Only read functions used by the scanner are listed.
module.exports = {
  factory: [
    'function cpuCount() view returns (uint256)',
    'function cpuAt(uint256) view returns (address)',
    'function cpus(uint256) view returns (address)',
    'function isCPU(address) view returns (bool)',
    'function createCPU(string,string,string,uint256,uint256)',
    'function deployFee() view returns (uint256)',
    'function protocolFee() view returns (uint256)',
    'function protocolWallet() view returns (address)',
    'function bem() view returns (address)',
    'function transistorBeacon() view returns (address)',
    'function circuitBeacon() view returns (address)',
    'function owner() view returns (address)',
    'function isSealed() view returns (bool)',
    'function owed(address) view returns (uint256)',
  ],
  market: [
    'function feeBps() view returns (uint256)',
    'function nextListingId() view returns (uint256)',
    // listings(uint256) / listingView(uint256) return 5- / 6-word structs (raw-probed,
    // listing 0 is all-zero); field order not fully decoded — not needed by the census.
    'function listingOf(address,uint256) view returns (uint256)',
    'function owner() view returns (address)',
    'function isSealed() view returns (bool)',
    'function protocolWallet() view returns (address)',
  ],
  // A "CPU" (processor) is an ERC-721 contract behind a BeaconProxy on circuitBeacon.
  cpu: [
    'function name() view returns (string)',
    'function symbol() view returns (string)',
    'function nextId() view returns (uint256)',
    'function transistors() view returns (address)',
    'function ownerOf(uint256) view returns (address)',
    'function tokenURI(uint256) view returns (string)',
    'function circuitInfo(uint256) view returns (uint256,uint256,uint256,uint256)',
    'function TAPEOUT_FEE() view returns (uint256)',
    'function TREASURY() view returns (address)',
  ],
  // Each CPU has its own ERC-1155 transistor contract behind a BeaconProxy on
  // transistorBeacon. Token id 0 = NAND, id 1 = LATCH.
  transistor: [
    'function creator() view returns (address)',
    'function mintPrice() view returns (uint256)',
    'function minted() view returns (uint256)',
    'function supplyCap() view returns (uint256)',
    'function cpuName() view returns (string)',
    'function cpuSymbol() view returns (string)',
    'function story() view returns (string)',
    'function NAND() view returns (uint256)',
    'function LATCH() view returns (uint256)',
    'function protocolFee() view returns (uint256)',
  ],
  beacon: ['function implementation() view returns (address)'],
  multicall3: [
    // Declared view so ethers issues eth_call; aggregate3 is read-safe for this use.
    'function aggregate3(tuple(address target, bool allowFailure, bytes callData)[] calls) view returns (tuple(bool success, bytes returnData)[] returnData)',
  ],
  multicall3Address: '0xcA11bde05977b3631167028862bE2a173976CA11',
};
