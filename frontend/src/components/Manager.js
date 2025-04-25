import React, { useState, useEffect, useRef } from 'react';
import * as tf from '@tensorflow/tfjs';
import ContractArtifact from "./EncFederatedLearningDeployment#EncFederatedLearningContract.json";

import { waitForTransaction, saveWeight, loadWeight, aggregate, loadMNISTDataset, evaluateModel, storeWeightsOnIPFS, loadWeightsFromIPFS, storeModelOnIPFS, exportModelToBytes, encStoreModelOnIPFS, encStoreWeightsOnIPFS, decLoadWeightsFromIPFS, generateRandomKey, loadPrivateKeyFromHex, loadPublicKeyFromHex, encryptMessage, decryptMessage, dtree, generateECDHKeyPair } from './utils';
import ModelUploader from './ModelUploader';
import CryptoJS, { enc } from 'crypto-js';
import{ Mutex } from 'async-mutex';
const { ethers } = require('ethers');

const Manager = () => {
    const provider = new ethers.WebSocketProvider(process.env.REACT_APP_WEB3_PROVIDER_URL);
    const signer = new ethers.Wallet(process.env.REACT_APP_PRIVATE_KEY, provider);
    const contractABI = ContractArtifact.abi;
    const contractAddress = process.env.REACT_APP_CONTRACT_ADDRESS;
    const contract = new ethers.Contract(contractAddress, contractABI, signer);

    const [currentContract, setCurrentContract] = useState(contract);
    const contractRef = useRef(contract);

    // 每次状态更新时也更新 ref
    useEffect(() => {
      contractRef.current = currentContract;
    }, [currentContract]);

    const [projectId, setprojectId] = useState(null);
    const [projectIdTxt, setprojectIdTxt] = useState("");
    const [isLoopRunning, setIsLoopRunning] = useState(false);
    const [loopIntervalId, setLoopIntervalId] = useState(null);
    const [model, setModel] = useState(null);
    const [local_model, setLocalModel] = useState(null);
    const [keyList, setKeyList] = useState(new Map());
    const mutex = new Mutex();

    const [ECDHPrivateKeyString, ECDHPublicKeyString] = generateECDHKeyPair();
    const ECDHPrivateKey = loadPrivateKeyFromHex(ECDHPrivateKeyString);

    const testingDataset = loadMNISTDataset('test');

    const [aesKey, setAesKey] = useState(null);

    const projectIdRef = useRef();
    useEffect(() => {
      projectIdRef.current = projectId;
    }, [projectId]);

    const modelRef = useRef();
    useEffect(() => {
      modelRef.current = model;
    }, [model]);

    const local_modelRef = useRef();
    useEffect(() => {
      local_modelRef.current = local_model;
    }, [local_model]);

    const isLoopRunningRef = useRef();
    useEffect(() => {
      isLoopRunningRef.current = isLoopRunning;
    }, [isLoopRunning]);

    const aesKeyRef = useRef();
    useEffect(() => {
      aesKeyRef.current = aesKey;
    }, [aesKey]);

    const keyListRef = useRef();
    useEffect(() => {
      keyListRef.current = keyList;
    }, [keyList]);

    const handleCreate = async () => {
      console.log("ECDHPrivateKeyString: ", ECDHPrivateKeyString);
      console.log("ECDHPublicKeyString: ", ECDHPublicKeyString);
      const aesKeyStr = generateRandomKey();
      console.log('AES key is ', typeof aesKeyStr, aesKeyStr)
      const aesKey = CryptoJS.enc.Hex.parse(aesKeyStr);
      setAesKey(aesKey);

      // console.log(modelRef.current);
      const modelBytes = await exportModelToBytes(modelRef.current);
    
      console.log('Storing model architecture on IPFS...');
      // const archIPFSHash = await storeModelOnIPFS(modelBytes);
      const archIPFSHash = await encStoreModelOnIPFS(modelBytes, aesKeyRef.current);
      console.log('Done. Model architecture IPFS hash:', archIPFSHash);

      console.log('Storing model weights on IPFS...');
      // const weightIPFSHash = await storeWeightsOnIPFS(modelRef.current);
      const weightIPFSHash = await encStoreWeightsOnIPFS(modelRef.current, aesKeyRef.current);
      console.log('Done. Model weights IPFS hash:', weightIPFSHash);
      var PID = null;
      try {
        setprojectIdTxt("Creating Project...");
        console.log('Creating project on blockchain...');
        const tx = await contract.create(archIPFSHash, weightIPFSHash, 10, ECDHPublicKeyString, {gaslimit: 2000000, gasPrice: ethers.parseUnits('10', 'gwei')}); //value: ethers.parseEther('1', 'ether'), 
        await waitForTransaction(tx);
        console.log('Done. Project created on blockchain.');       

        const pid = await contract.createReturn();
        PID = parseInt(pid.toString());
        // console.log(PID);
        setprojectId(PID);
        setprojectIdTxt("Created Project ID is: "+ PID);
        console.log('Done. Project Id is: ', PID);
      } catch (error) {
        console.log(`Failed: ${error.message}`);
      }
      return PID;
    };
        
    const Aggregate = async () => {
      var weightsArrList = [];
      var ll_model = local_modelRef.current;

      const startTime_1 = performance.now(); // Get the current time in milliseconds
      console.log("Getting client IPFS hashes...");
      const clientIPFSHashes = await contract.getLocalModels(projectIdRef.current);
      const clientAddresses = await contract.getTrainers(projectIdRef.current);
      console.log(clientIPFSHashes.length, 'client IPFS hashes found.');
      const endTime_1 = performance.now(); // Get the current time again
      const elapsedTime_1 = endTime_1 - startTime_1; // Calculate the elapsed time
      console.log('Get client CIDs from blockchain time: ', elapsedTime_1);

      // var ll_model = local_modelRef.current;
      console.log('Downloading local model weights from IPFS...');


      const startTime_2 = performance.now(); // Get the current time in milliseconds
      const scale_tree = [];

      // Create an array of promises for parallel execution
      const promises = clientIPFSHashes.map(async (ipfsHash, index) => {
        const clientAddress = clientAddresses[index];
        const loadedModel = await decLoadWeightsFromIPFS(ll_model, ipfsHash, keyListRef.current.get(clientAddress));
        // const loadedModel = await loadWeightsFromIPFS(ll_model, ipfsHash);
        if (!loadedModel._built) {
          await loadedModel.build();
        }
        const weightsArr = await saveWeight(loadedModel);
        return weightsArr;
      });

      const results = await Promise.all(promises);
      weightsArrList.push(...results);
      scale_tree.push(...Array(results.length).fill(50000));

      const endTime_2 = performance.now(); // Get the current time again
      const elapsedTime_2 = endTime_2 - startTime_2; // Calculate the elapsed time
      console.log('Download local model weights from IPFS time: ', elapsedTime_2);
      

      // for (const weightsArr of weightsArrList) {
      //   console.log(weightsArr);
      // }
  
      console.log('Aggregating model weights...');
      const startTime_3 = performance.now(); // Get the current time in milliseconds
      const aggregatedWeightsArr = aggregate(weightsArrList);
      const endTime_3 = performance.now(); // Get the current time again
      const elapsedTime_3 = endTime_3 - startTime_3; // Calculate the elapsed time
      console.log('Aggregating model weights time: ', elapsedTime_3);

      // const startTime_4 = performance.now(); // Get the current time in milliseconds
      // ll_model = modelRef.current;
      // const shapleyValue = await dtree(testingDataset, ll_model, weightsArrList, scale_tree);
      // console.log('Shapley value:', shapleyValue);
      // const endTime_4 = performance.now(); // Get the current time again
      // const elapsedTime_4 = endTime_4 - startTime_4; // Calculate the elapsed time
      // console.log('Shapley value time: ', elapsedTime_4);

      const startTime_45 = performance.now(); // Get the current time in milliseconds
      ll_model = local_modelRef.current;
      ll_model = await loadWeight(aggregatedWeightsArr, ll_model);
      const acc = await evaluateModel(ll_model, testingDataset);
      console.log('Testing accuracy:', acc);
      setModel(ll_model);
      const endTime_45 = performance.now(); // Get the current time again
      const elapsedTime_45 = endTime_45 - startTime_45; // Calculate the elapsed time
      console.log('Evaluate model time: ', elapsedTime_45);
      
      console.log('Storing new global model weights on IPFS...');
      // const weightIPFSHash = await storeWeightsOnIPFS(ll_model);
      
      const startTime_5 = performance.now(); // Get the current time in milliseconds
      //Dynamic key
      const aesKeyStr = generateRandomKey();
      console.log('AES key is ', typeof aesKeyStr, aesKeyStr)
      const aesKey = CryptoJS.enc.Hex.parse(aesKeyStr);
      setAesKey(aesKey);

      const weightIPFSHash = await encStoreWeightsOnIPFS(ll_model, aesKey);
      console.log('Done. New global model weights IPFS hash:', weightIPFSHash);
      const endTime_5 = performance.now(); // Get the current time again
      const elapsedTime_5 = endTime_5 - startTime_5; // Calculate the elapsed time
      console.log('Encrypt and store new global model weights on IPFS time: ', elapsedTime_5);

      const startTime_6 = performance.now(); // Get the current time in milliseconds
      console.log("Updating global model on blockchain...");
      const incentiveFees = Array(clientIPFSHashes.length).fill(1);
      const tx = await contract.updateGlobalModel(projectIdRef.current, weightIPFSHash, incentiveFees);
      await waitForTransaction(tx);
      const endTime_6 = performance.now(); // Get the current time again
      const elapsedTime_6 = endTime_6 - startTime_6; // Calculate the elapsed time
      console.log('Done. Update global model on blockchain time: ', elapsedTime_6);
      return acc;
    }

    const Continue = async (continueFlag) => {
      const tx = await contract.whetherContinue(projectIdRef.current, continueFlag);
      await waitForTransaction(tx);
      console.log('Done.');
    };

    const handleSettling = async () => {
      console.log('Settling...');
      const totalBilling = await contract.billingsReturn(projectIdRef.current);
      const ince = 0.1* parseInt(totalBilling.toString());
      console.log("Billing is ", totalBilling);
      const tx = await contract.whetherContinue(projectIdRef.current, false);
      await waitForTransaction(tx);
      console.log('Done.');

      const tx_2 = await contract.settleBillings(projectIdRef.current, {value: ethers.parseEther(ince.toString())});
      await waitForTransaction(tx_2);
      console.log('Done.');
    };

    const handleUploadedModel = async(fileContent) => {
      // Use the uploaded model here
      const ll_model = await tf.models.modelFromJSON(JSON.parse(fileContent));
      ll_model.compile({
        optimizer: 'adam',
        loss: 'categoricalCrossentropy',
        metrics: ['accuracy'],
      });
      setModel(ll_model);
      setLocalModel(ll_model);
    };

    const handleEncryptKey = async (contract, clientAddress, clientPK) => {
      // const aesKey = aesKeyRef.current;
      var sharedKey = null;
      if (keyListRef.current.has(clientAddress)){
        sharedKey = keyListRef.current.get(clientAddress);
        console.log(clientAddress, 'Shared key is ', sharedKey.toString());
      } else {
        var newKeyList = keyListRef.current;
        const clientPublicKey = loadPublicKeyFromHex(clientPK);
        const sharedSecret = ECDHPrivateKey.derive(clientPublicKey.getPublic());
        sharedKey = CryptoJS.enc.Hex.parse(sharedSecret.toString(16));
        newKeyList.set(clientAddress, sharedKey);
        setKeyList(newKeyList);
      }
      console.log('Shared key is ', sharedKey.toString());
      console.log('Be encrypted key is ', aesKeyRef.current.toString());
      const encryptedKey = encryptMessage(aesKeyRef.current.toString(), sharedKey);
      console.log('Encrypted key is ', encryptedKey);

      try {
        console.log('Updating encrypted key on blockchain...');
        const tx = await contract.updateEncryptedKey(projectIdRef.current, clientAddress, encryptedKey);
        await waitForTransaction(tx);
        console.log('Done. Encrypted key updated on blockchain.');
      } finally {
        // release();
      }
    };


    const handleStartLoop = () => {
      setIsLoopRunning(true);
      startLoop();
    };
  
    const handleStopLoop = () => {
      setIsLoopRunning(false);
      clearInterval(loopIntervalId);
    };

    const startLoop = async () => {
      const PID = await handleCreate();
      console.log('Listening started. PID: ', PID);
      let test_acc = 0;
      
      contract.on('LocalTrainingFinished', async (_, projId, it) => {
        console.log('Event: LocalTrainingFinished');
      
        if (Number(projId) !== PID) {
          console.log('Event is not for this project', projId);
          return;
        }
      
        test_acc = await Aggregate();
        console.log('Testing acc: ', test_acc);
      
        if (!isLoopRunningRef.current) {
          await Continue(false);
          await handleSettling();
        } else {
          await Continue(true);
        }
      });

      contract.on('AchieveKey', async (clientAddr, projId, _, clientPK) => {
        console.log('Event: AchieveKey');
      
        if (Number(projId) !== PID) {
          console.log('Event is not for this project', projId);
          return;
        }
      
        const release = await mutex.acquire(); // 确保只有一个回调函数能执行
        console.log('Mutex acquired');
        try {
            const startTime = performance.now();
            console.log("Encrypting key...");
            await handleEncryptKey(contractRef.current, clientAddr, clientPK);
            console.log('Done. Encrypted key updated on blockchain.');
            const endTime = performance.now();
            const elapsedTime = endTime - startTime;
            console.log('Encrypt key time: ', elapsedTime);
            setCurrentContract(contract);
        } finally {
            release(); // 释放锁
            console.log('Mutex released');
        }
      });
    };

    return (
      <div>
      <h1>FL Project Owner</h1>
      <h2>Create an FL project</h2>
      <div className="upload">
      <h3>TensorFlow Model Upload</h3>
      <ModelUploader onFilesLoaded={handleUploadedModel} />
      </div>
      <div className="container">
        <div className="left">
          {/* <button onClick={handleCreate}>Create</button> */}
          {/* Add Start Loop button */}
          <button onClick={handleStartLoop} disabled={isLoopRunning}>
            Start Loop
          </button>
          {/* Add Stop Loop button */}
          <button onClick={handleStopLoop} disabled={!isLoopRunning}>
            Stop Loop
          </button>
        </div>
        <div className="right">
          <p>{projectIdTxt}</p>
        </div>
      </div>
      </div>
    );
};

export default Manager;

