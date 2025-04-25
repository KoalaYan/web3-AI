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
REACT_APP_WEB3_PROVIDER_URL=

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


## Python Emulator

### Environment

```
conda env create -f environment.yml
```


`ipfshttpclient` Unsupported daemon version Solution: https://github.com/ipfs-shipyard/py-ipfs-http-client/issues/329

Write `cfg/all.cfg` file as follows:
```
[global]
CONTRACT_ADDRESS=
HTTP_PROVIDER=

[0]
ACCOUNT_ADDRESS=
PRIVATE_KEY=

[1]
ACCOUNT_ADDRESS=
PRIVATE_KEY=

[2]
ACCOUNT_ADDRESS=
PRIVATE_KEY=

[3]
ACCOUNT_ADDRESS=
PRIVATE_KEY=

[4]
ACCOUNT_ADDRESS=
PRIVATE_KEY=

[5]
ACCOUNT_ADDRESS=
PRIVATE_KEY=

[6]
ACCOUNT_ADDRESS=
PRIVATE_KEY=

```


Copy json file in `./hardhat/ignition/deployments/xxx/artifacts/` to directory `./emulator/`.