# Web3.0 AI

## Requirements

### NodeJS
[Node.js](https://nodejs.org/en/download) version `>=22.14.0`

```
cd ./hardhat/
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

According to ganache configuration, complete the `.env` file in `hardhat/`.

## Deployment of Smart Contract

```
npx hardhat ignition deploy ./ignition/modules/deploy.js --network ganache
```