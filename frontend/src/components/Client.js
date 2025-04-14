import React, { useState } from 'react';
import ContractArtifact from "./EncFederatedLearningDeployment#EncFederatedLearningContract.json";
import { loadMNISTDataset, trainModel, loadModelFromIPFS, storeWeightsOnIPFS, loadWeightsFromIPFS, loadPrivateKeyFromHex, generateECDHKeyPair } from './utils';

const Client = () => {

    const [message, setMessage] = useState("");
    const [myAccount, setAccount] = useState("");
    const [projectId, setInputValue_1] = useState('');
    const ethers = require('ethers');

    const [provider, setProvider] = useState(null);
    const [contract, setContract] = useState(null);

    const [model, setModel] = useState(null);
    const [IPFSHash, setIPFSHash] = useState(null);

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
      try {
        console.log("Joining project...");
        const project = projectId;

        if(model==null){
          const fee = await contract.beforeJoin(projectId);
          const fees = ethers.parseUnits((Number(fee) * 0.1).toString(), 'ether');
          const tx = await contract.join(project, ECDHPublicKeyString, {value: fees});
          const rc = await tx.wait();
        }
        else{
          // const tx = await contract.join(project);
          const tx = await contract.join(project, ECDHPublicKeyString);
          const rc = await tx.wait();
        }
        // console.log(rc);

        var local_model = model;
        if(model==null){
          console.log('Loading model architecture from IPFS...');
          const archIPFSHash = await contract.participateReturn(project);
          local_model = await loadModelFromIPFS(archIPFSHash);
          setModel(local_model);
          console.log('Done.');
        }

        console.log('Loading model weights from IPFS...');
        const weightsIPFSHash = await contract.joinReturn(project);
        console.log(weightsIPFSHash);
        local_model = await loadWeightsFromIPFS(local_model, weightsIPFSHash);
        console.log('Done.');
        // setModel(local_model);
        // console.log(local_model);
      

        if (!local_model) {
          console.error('No model to train.');
          return;
        }

        console.log("Training model...");
        local_model = await trainModel(local_model, trainingDataset);
        console.log('Done.');

        console.log('Storing local model weights on IPFS...');
        const weightIPFSHash = await storeWeightsOnIPFS(local_model);
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
        const rc = await tx.wait();
        // console.log(rc);
        // console.log("Local model uploading finished.");
        console.log('Done.');

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
