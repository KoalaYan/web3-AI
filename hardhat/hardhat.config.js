require("@nomicfoundation/hardhat-toolbox");
/** @type import('hardhat/config').HardhatUserConfig */
require('@nomicfoundation/hardhat-ethers');
require('@nomicfoundation/hardhat-ignition-ethers');
require('dotenv').config();

module.exports = {
  solidity: '0.8.28',
  networks: {
    ganache: {
      url: process.env.GANACHE_URL,
      accounts: [process.env.GANACHE_ACCOUNT],
      network_id: parseInt(process.env.GANACHE_NETWORK_ID),
    },
  },
};