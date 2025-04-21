import React, { useState, useEffect, useRef } from 'react';
import ContractArtifact from "./EncFederatedLearningDeployment#EncFederatedLearningContract.json";
import { waitForTransaction, loadMNISTDataset, trainModel, loadModelFromIPFS, storeWeightsOnIPFS, loadWeightsFromIPFS, decLoadModelFromIPFS, encStoreWeightsOnIPFS, decLoadWeightsFromIPFS, loadPrivateKeyFromHex, loadPublicKeyFromHex, generateECDHKeyPair, decryptMessage } from './utils';
import CryptoJS, { enc } from 'crypto-js';
const { ethers } = require('ethers');

const Client = () => {

    const [message, setMessage] = useState("");
    const [myAccount, setAccount] = useState("");
    const [projectId, setInputValue_1] = useState('');

    const [provider, setProvider] = useState(null);
    const [contract, setContract] = useState(null);

    const [model, setModel] = useState(null);
    const [IPFSHash, setIPFSHash] = useState(null);

    const [sharedKey, setSharedKey] = useState(null);

    const [ECDHPrivateKeyString, ECDHPublicKeyString] = generateECDHKeyPair();
    const ECDHPrivateKey = loadPrivateKeyFromHex(ECDHPrivateKeyString);

    const contractABI = ContractArtifact.abi;
    const contractAddress = process.env.REACT_APP_CONTRACT_ADDRESS;
    const trainingDataset = loadMNISTDataset('train');

    const handleInputChange_1 = (event) => {
      setInputValue_1(event.target.value);
    };

    const detectProvider = async () => {
      const provider = new ethers.BrowserProvider(window.ethereum);
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      setProvider(provider);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(contractAddress, contractABI, signer);
      setContract(contract);

      setAccount(signer);
      console.log(window.ethereum.isConnected());
      if (window.ethereum.isConnected()) {
          setMessage('Connected to MetaMask');
      }
      else {
          setMessage("Not connected");
      }
    };

    const checkWallet = async () => {
      //check if MetaMask is installed in the browser
      if (window.ethereum) {
          setMessage("Wallet Found");
      } else {
          setMessage("Please Install MetaMask");
      }
    };

    const handleJoin = async () => {
      console.log("ECDHPrivateKeyString: ", ECDHPrivateKeyString);
      console.log("ECDHPublicKeyString: ", ECDHPublicKeyString);
      try {
        const projectIdCounter = await contract.projectIdCounter();
        console.log("Project ID Counter:", projectIdCounter);
        console.log("Joining project...");
        const project = projectId;
        const clientAddress = await myAccount.getAddress();
        console.log("Client Address:", clientAddress);

        var local_sharedKey = sharedKey;
        var aesKey = null;

        if(local_sharedKey==null){
          const serverPublicKeyString = await contract.getMainPK(project);
          console.log("serverPublicKeyString:", serverPublicKeyString);
          const serverPublicKey = loadPublicKeyFromHex(serverPublicKeyString);
          const sharedSecret = ECDHPrivateKey.derive(serverPublicKey.getPublic());
          local_sharedKey = CryptoJS.enc.Hex.parse(sharedSecret.toString(16));
          setSharedKey(local_sharedKey);
        }

        if(model==null){
          const fee = await contract.beforeJoin(projectId);
          const fees = ethers.parseUnits((Number(fee) * 0.1).toString(), 'ether');
          const tx = await contract.join(project, ECDHPublicKeyString, {value: fees});
          // await waitForTransaction(tx);
          // console.log("Join project finished.");
        }
        else{
          const tx = await contract.join(project, ECDHPublicKeyString);
          // await waitForTransaction(tx);
          // console.log("Join project finished.");
        }

        await new Promise((resolve) => {
          contract.on('EncryptedKey', async (clientAddr, projId, _, encryptedKey) => {
            console.log('EncryptedKey event received');
            if (String(clientAddr) !== String(clientAddress) || Number(projId) !== Number(project)) {
              console.log('Event is not for me or this project.', clientAddr, Number(projId));
              return;
            } else {
              console.log("sharedKey:", local_sharedKey.toString());
              console.log("encryptedKey:", encryptedKey);
              const aesKeyStr = decryptMessage(encryptedKey, local_sharedKey);
              console.log("aesKeyStr:", aesKeyStr);
              aesKey = CryptoJS.enc.Hex.parse(aesKeyStr);
              console.log('AES Key:', aesKey);
              contract.removeAllListeners('EncryptedKey');
              resolve();
            }
          });
        });

        var local_model = model;
        if(model==null){
          console.log('Loading model architecture from IPFS...');
          const archIPFSHash = await contract.participateReturn(project);
          // local_model = await loadModelFromIPFS(archIPFSHash);
          local_model = await decLoadModelFromIPFS(archIPFSHash, aesKey);
          setModel(local_model);
          console.log('Done.');
        }

        console.log('Loading model weights from IPFS...');
        const weightsIPFSHash = await contract.joinReturn(project);
        console.log(weightsIPFSHash);
        // local_model = await loadWeightsFromIPFS(local_model, weightsIPFSHash);
        local_model = await decLoadWeightsFromIPFS(local_model, weightsIPFSHash, aesKey);
        console.log('Done.');      

        if (!local_model) {
          console.error('No model to train.');
          return;
        }

        console.log("Training model...");
        local_model = await trainModel(local_model, trainingDataset);
        console.log('Done.');

        console.log('Storing local model weights on IPFS...');
        // const weightIPFSHash = await storeWeightsOnIPFS(local_model);
        const weightIPFSHash = await encStoreWeightsOnIPFS(local_model, local_sharedKey);
        console.log('Done. New model weights stored on IPFS with hash:', weightIPFSHash);
        setIPFSHash(weightIPFSHash);
        // setModel(local_model);
        
      } catch (error) {
        console.error(`Failed: ${error.message}`);
        console.log("Please try again.")
      }


    };
      
    const handleUpload = async () => {
      try {
        const project = projectId;
        // console.log('Loading MNIST dataset...');
        // const dataset = await loadMNISTDataset();
      
        // console.log('Training model...');
        // await trainModel(model, dataset.xs, dataset.ys);
        var weightIPFSHash = IPFSHash;
        // console.log(local_model);


        console.log("Upload local model to Blockchain...");
        const tx = await contract.local_upload(project, weightIPFSHash);
        await waitForTransaction(tx);
        console.log("Local model uploading finished.");

        // TODO : Use smart contract to send ipfs address
      } catch (error) {
        // console.log(`Transaction failed: ${error.message}`);
        console.log("Please try again.");
      }
    };



    const Connect2Wallet = async () => {
        if (window.ethereum) {
            detectProvider();
        } else {
            // If no Wallet
            alert("Get MetaMask to connect");
        }
    };

    return (
        <div>
            <h1>FL Project Participant</h1>
            <p>
            {/* If the Wallet is connected to an Account returns the message. Else show connect button */ }
              {myAccount ? (
                message
              ) : (
                <button onClick={Connect2Wallet}> Connect </button>
              )}
            </p>
            <input
              type="uint256"
              value={projectId}
              onChange={handleInputChange_1}
              placeholder="Enter the project ID..."
            />
            {/* <button onClick={handleSearchClick_1}>Upload</button> */}
            {/* {processedString_1 && (
              <p>Global Model Address: {processedString_1}</p>
            )} */}
            <button onClick={handleJoin}>Join</button>
            <button onClick={handleUpload}>Upload</button>
        </div>
    );
};

export default Client;
