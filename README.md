# Web3.0 AI

## Requirements

### NodeJS
[Node.js](https://nodejs.org/en/download) version `>=22.14.0`

```
cd ./hardhat/
npm install
cd ../frontend/
npm install
```


### IPFS

**IPFS Installation**: https://docs.ipfs.tech/install/ipfs-desktop/

Modify the configuration and restart IPFS service.
```
"API": {
  "HTTPHeaders": {
   "Access-Control-Allow-Headers": [
    "Authorization",
    "Content-Type"
   ],
   "Access-Control-Allow-Methods": [
    "PUT",
    "POST",
    "GET"
   ],
   "Access-Control-Allow-Origin": [
    "http://localhost:3000",
    "https://webui.ipfs.io",
    "http://webui.ipfs.io.ipns.localhost:8080"
   ]
  }
 },
```

### Ganache 
**Ganache installation**: https://archive.trufflesuite.com/ganache/

According to ganache configuration, complete the `.env` file in `hardhat/`:

```
# This file is used to set environment variables for the Hardhat project.
# Ganache RPC Server URL
GANACHE_URL=

# Ganache Account Private Key
GANACHE_ACCOUNT=

# Ganache Network ID
GANACHE_NETWORK_ID=
```

## Deployment of Smart Contract

```
npx hardhat ignition deploy ./ignition/modules/deploy.js --network ganache
```

## DApp Frontend

Copy json file in `./hardhat/ignition/deployments/xxx/artifacts/` to directory `./frontend/src/componets/`.

Download and move MNIST datasets `mnist_train.csv` and `mnist_test.csv` to `./frontend/public/`

Complete the `.env` file in `frontend/`:
```
# Web3 provider URL
REACT_APP_WEB3_PROVIDER_URL=ws://10.181.219.135:7545

# Contract address
REACT_APP_CONTRACT_ADDRESS=

# Chain ID
REACT_APP_CHAIN_ID=

# Wallet address
REACT_APP_WALLET_ADDRESS=

# Private key
REACT_APP_PRIVATE_KEY=
```

Run with `npm start`.

*Notice: Do not forget to add your testnet account in MetaMask, otherwise you cannot work as a client.*