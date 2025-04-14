import * as tf from '@tensorflow/tfjs';
import { create } from 'ipfs-http-client';
import CryptoJS from 'crypto-js';
import elliptic from 'elliptic';
export const IPFS = create({ url: '/ip4/127.0.0.1/tcp/5001' })
export const ec = new elliptic.ec('secp256k1');

export function loadPrivateKeyFromPEM(privateKeyPEM) {
  const keyPEM = privateKeyPEM.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, '');
  const keyBytes = Uint8Array.from(atob(keyPEM), c => c.charCodeAt(0));
  const privateKey = ec.keyFromPrivate(keyBytes.slice(33, 65));
  return privateKey;
}

export function loadPublicKeyFromPEM(publicKeyPEM) {
  const keyPEM = publicKeyPEM.replace(/-----BEGIN PUBLIC KEY-----|-----END PUBLIC KEY-----|\s/g, '');
  const keyBytes = Uint8Array.from(atob(keyPEM), c => c.charCodeAt(0));
  var x = keyBytes.slice(24).slice(0, 32);
  var y = keyBytes.slice(24).slice(32, 64);
  const publicKey = ec.keyFromPublic({x: x, y: y}, 'hex');
  return publicKey;
}

export function generateECDHKeyPair() {
  const keyPair = ec.genKeyPair();
  const PrivateKeyString = keyPair.getPrivate('hex');
  const PublicKeyString = keyPair.getPublic('hex');
  return [PrivateKeyString, PublicKeyString];
}

export function loadPrivateKeyFromHex(privateKeyHexString) {
  const privateKey = ec.keyFromPrivate(privateKeyHexString, 'hex');
  return privateKey;
}

export function loadPublicKeyFromHex(publicKeyHexString) {
  const publicKey = ec.keyFromPublic(publicKeyHexString, 'hex');
  return publicKey;
}

export function encryptMessage(message, aesKey) {
  const cipherText = CryptoJS.AES.encrypt(message, aesKey, {mode:CryptoJS.mode.ECB}).toString();
  return cipherText;
}

export function decryptMessage(cipherText, aesKey) {
  const message = CryptoJS.AES.decrypt(cipherText, aesKey, {mode:CryptoJS.mode.ECB}).toString(CryptoJS.enc.Utf8);
  return message;
}

// Generate a random AES key
export function generateRandomKey() {
  const keyArray = new Uint8Array(32); // 256 bits
  window.crypto.getRandomValues(keyArray);
  // const aesKey = Array.from(keyArray, byte => String.fromCharCode(byte)).join('');
  const aesKeyHex = Array.from(keyArray).map(byte => ('0' + byte.toString(16)).slice(-2)).join('');
  return aesKeyHex;
}

export async function encStoreModelOnIPFS(modelBytes, aesKey) {
  // Encrypt data
  // const encryptedData = CryptoJS.AES.encrypt(modelBytes, aesKey,{mode:CryptoJS.mode.ECB}).toString();
  const encryptedData = encryptMessage(modelBytes, aesKey);

  const result = await IPFS.add(encryptedData);
  const ipfsHash = result.cid.toString();
  return ipfsHash;
}

export async function encStoreWeightsOnIPFS(model, aesKey) {
  const weightsArr = await saveWeight(model);
  const serializedData = weightsArr.map(arr => Array.from(arr));
  const jsonData = JSON.stringify(serializedData);

  // Encrypt data
  // const encryptedData = CryptoJS.AES.encrypt(jsonData, aesKey,{mode:CryptoJS.mode.ECB}).toString();
  const start_time = performance.now();
  const encryptedData = encryptMessage(jsonData, aesKey);
  const end_time = performance.now();
  console.log("Encryption time is ", end_time - start_time);

  const result = await IPFS.add(encryptedData);
  const ipfsHash = result.cid.toString();
  return ipfsHash;
}

export async function decLoadModelFromIPFS(ipfsHash, aesKey) {
  
  // Fetch the encrypted data from IPFS
  const chunks = [];
  for await (const chunk of IPFS.cat(ipfsHash)) {
    chunks.push(chunk);
  }

  // Concatenate the chunks into a single Uint8Array
  const combinedData = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
  let offset = 0;
  for (const chunk of chunks) {
    combinedData.set(chunk, offset);
    offset += chunk.length;
  }
  const encryptedData = new TextDecoder().decode(combinedData);

  // Decrypt the data using the AES key
  // const decryptedData = CryptoJS.AES.decrypt(encryptedData, aesKey, {mode:CryptoJS.mode.ECB}).toString(CryptoJS.enc.Utf8);
  const decryptedData = decryptMessage(encryptedData, aesKey);

  // Decode the Uint8Array as text
  const modelJSON = new TextDecoder().decode(decryptedData);
  const model = await tf.models.modelFromJSON(JSON.parse(modelJSON));
  return model;
}

export async function decLoadWeightsFromIPFS(model, ipfsHash, aesKey) {
  // Fetch the encrypted data from IPFS
  const chunks = [];
  for await (const chunk of IPFS.cat(ipfsHash)) {
    chunks.push(chunk);
  }

  // Concatenate the chunks into a single Uint8Array
  const combinedData = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
  let offset = 0;
  for (const chunk of chunks) {
    combinedData.set(chunk, offset);
    offset += chunk.length;
  }
  const encryptedData = new TextDecoder().decode(combinedData);

  // Decrypt the data using the AES key
  // const decryptedData = CryptoJS.AES.decrypt(encryptedData, aesKey, {mode:CryptoJS.mode.ECB}).toString(CryptoJS.enc.Utf8);
  const start_time = performance.now();
  const decryptedData = decryptMessage(encryptedData, aesKey);
  const end_time = performance.now();
  console.log("Decryption time is ", end_time - start_time);

  // Parse the decrypted JSON data
  const restoredSerializedData = JSON.parse(decryptedData);
  const downloadedWeightsArr = restoredSerializedData.map(arr => new Float32Array(arr));

  // Load the weights into the model
  model = await loadWeight(downloadedWeightsArr, model);
  
  return model;
}


export async function saveWeight(model) {
    let weightsArr = [];
    model.trainableWeights.forEach(layer => weightsArr.push(layer.val.dataSync()));
    return weightsArr;
}
  
export async function loadWeight(weightsArr, model) {
    
    model.trainableWeights.forEach((layer, idx) => layer.val.assign(tf.tensor(weightsArr[idx], layer.val.shape, 'float32')));
    return model;
}

export function sumModel(weightsArrList, scaleList) {
  // Check if there are weights to aggregate
  if (weightsArrList.length === 0) {
      console.error('No weights to aggregate.');
      return;
  }

  console.log("Sum number is ", weightsArrList.length);
  const sumweight = scaleList.reduce((a, b) => a + b, 0);

  // Assuming all arrays in 'weightsArrList' have the same shape
  const numLayers = weightsArrList[0].length;
  const numWeightsPerLayers = Array.from({ length: numLayers }, (_, i) => weightsArrList[0][i].length);
  
  // Initialize an array to store the aggregated weights
  const aggregatedWeightsArr = new Array(numLayers);
  
  // Initialize the aggregatedWeightsArr with zeros
  for (let i = 0; i < numLayers; i++) {
      aggregatedWeightsArr[i] = new Float32Array(numWeightsPerLayers[i]);
  }
  
  // Perform FedAvg: compute the element-wise mean of the weights
  for (let k = 0; k < weightsArrList.length; k++) {
      const weightsArr = weightsArrList[k];
      const scale = scaleList[k] / sumweight;
      for (let i = 0; i < numLayers; i++) {
        for (let j = 0; j < numWeightsPerLayers[i]; j++) {
            aggregatedWeightsArr[i][j] += weightsArr[i][j] * scale;
        }
      }
  }
  
  // Compute the mean by dividing by the number of clients
  // const numClients = weightsArrList.length;
  // for (let i = 0; i < numLayers; i++) {
  //     for (let j = 0; j < numWeightsPerLayers[i]; j++) {
  //     aggregatedWeightsArr[i][j] /= numClients;
  //     }
  // }
  
  return aggregatedWeightsArr;
}

// get a weighted average model from models
// export async function summodel(models = [], scale = []) {
//   const sumweight = scale.reduce((a, b) => a + b, 0);
//   let averagedModel = _.cloneDeep(models[0]);

//   const weights = averagedModel.getWeights();
//   const scaledWeightsList = models.map((model, index) => {
//     const rawWeights = model.getWeights();
//     const scaledWeights = rawWeights.map((weight) => tf.mul(weight, scale[index] / sumweight));
//     return scaledWeights;
//   });

//   const averagedWeights = [];

//   for(let i=0; i<weights.length; i++) {
//     let weightSum = scaledWeightsList[0][i];
//     for(let j=1; j<scaledWeightsList.length; j++) {
//       weightSum = tf.add(weightSum, scaledWeightsList[j][i]);
//     }
//     averagedWeights.push(weightSum.reshape(weights[i].shape));
//   }

//   averagedModel.setWeights(averagedWeights);
//   return averagedModel;
// }

// calculate the shapley value List
export async function dtree(flattenedDataset, originModel, models_tree, scale_tree, divide = 2, weight = 1) {
  const scale = scale_tree.slice();
  const models = models_tree.slice();
  let num_client = models.length;
  const sv = [];
  let num_group = Math.floor(num_client / divide);

  const originmodel = await saveWeight(originModel);
  const originscale = scale[num_client - 1];
  let lll_model = originModel;

  let left = 0;
  if (num_client > num_group * divide && num_group >= 1) {
      left = num_client - num_group * divide;
      const add = divide - left;

      for (let c = 0; c < add; c++) {
          models.push(originmodel);
          scale.push(originscale);
      }

      num_group += 1;
      num_client += add;
  }


  // END CONDITION
  if (num_group === 1) {
      const Pow2_Numclient = tf.pow(2, num_client).dataSync()[0];
      const res = Array(Pow2_Numclient).fill(0);
      res[0] = await evaluateModel(originModel, flattenedDataset);

      console.log(res[0]);

      for (let x = 1; x < Pow2_Numclient; x++) {
        const flag = Array(num_client).fill(false);
        for (let p = 0; p < num_client; p++) {
          if ((x >> p) % 2 === 1) {
              flag[p] = true;
          } else {
              flag[p] = false;
          }
        }


        let modelsLegal = [];
        let scalesLegal = [];
        for (let c = 0; c < num_client; c++) {
          if (flag[c]) {
            modelsLegal.push(models[c]);
            scalesLegal.push(scale[c]);
          }
        }
        console.log('Number of client:', modelsLegal.length);
        // const ll_aggregatedWeightsArr = sumModel(models.slice(0, num_client), scale.slice(0, num_client))
        const ll_aggregatedWeightsArr = aggregate(modelsLegal);
        // console.log(ll_aggregatedWeightsArr)
        lll_model = await loadWeight(ll_aggregatedWeightsArr, lll_model);
        res[x] = await evaluateModel(lll_model, flattenedDataset);
      }

      console.log(res)

      for (let c = 0; c < num_client; c++) {
        let sumweight = 0;
        const sym = tf.pow(2, c).dataSync()[0];
        for (let s = 0; s < tf.pow(2, num_client).dataSync()[0]; s++) {
            if ((s >> c) % 2 === 1) {
                sumweight += (res[s] - res[s - sym]);
            }
        }

        sv.push(sumweight / tf.pow(2, num_client - 1).dataSync()[0]);
      }

      for (let c = 0; c < num_client; c++) {
          sv[c] *= weight;
      }
      return sv;
     } else if (num_group > 1) {
      const groupmodel = [];
      const groupscale = [];
      let groupsv = [];
      for (let x = 0; x < num_group; x++) {
          const groupModels = models.slice(x * divide, (x + 1) * divide);
          const groupScale = scale.slice(x * divide, (x + 1) * divide);
          // groupmodel.push(sumModel(groupModels, groupScale));
          groupmodel.push(aggregate(groupModels));
          groupscale.push(tf.sum(groupScale));
      }

      groupsv = await dtree(flattenedDataset, originModel, groupmodel, groupscale, divide, weight);

      for (let c = 0; c < num_group; c++) {
          const tmpsv = await dtree(flattenedDataset, originModel, models.slice(c * divide, (c + 1) * divide), scale.slice(c * divide, (c + 1) * divide), divide, groupsv[c]);
          for (let x = 0; x < tmpsv.length; x++) {
              sv.push(tmpsv[x]);
          }
      }

      if (left > 0) {
          const added = tf.sum(sv.slice((num_group - left) * divide + left));
          const yita = 1 / (1 - added);
          for (let c = 0; c < sv.length; c++) {
              sv[c] *= yita;
          }
          return sv.slice(0, (num_group - left) * divide + left);
      } else {
          return sv;
      }
  }
}

export function aggregate(weightsArrList) {
    // Check if there are weights to aggregate
    if (weightsArrList.length === 0) {
        console.error('No weights to aggregate.');
        return;
    }
    
    // Assuming all arrays in 'weightsArrList' have the same shape
    const numLayers = weightsArrList[0].length;
    const numWeightsPerLayers = Array.from({ length: numLayers }, (_, i) => weightsArrList[0][i].length);
    
    // Initialize an array to store the aggregated weights
    const aggregatedWeightsArr = new Array(numLayers);
    
    // Initialize the aggregatedWeightsArr with zeros
    for (let i = 0; i < numLayers; i++) {
        aggregatedWeightsArr[i] = new Float32Array(numWeightsPerLayers[i]);
    }
    
    // Perform FedAvg: compute the element-wise mean of the weights
    for (const weightsArr of weightsArrList) {
        for (let i = 0; i < numLayers; i++) {
          for (let j = 0; j < numWeightsPerLayers[i]; j++) {
              aggregatedWeightsArr[i][j] += weightsArr[i][j];
          }
        }
    }
    
    // Compute the mean by dividing by the number of clients
    const numClients = weightsArrList.length;
    for (let i = 0; i < numLayers; i++) {
        for (let j = 0; j < numWeightsPerLayers[i]; j++) {
        aggregatedWeightsArr[i][j] /= numClients;
        }
    }
    
    return aggregatedWeightsArr;
}

// export async function aggregate(weightsArrList) {
//   // Check if there are weights to aggregate
//   if (weightsArrList.length === 0) {
//       console.error('No weights to aggregate.');
//       return;
//   }
  
//   // Assuming all arrays in 'weightsArrList' have the same shape
//   const numLayers = weightsArrList[0].length;
//   const numWeightsPerLayer = [];
//   for (let i = 0; i < numLayers; ++i) {
//     numWeightsPerLayer.push(weightsArrList[0][i].length);
//   }
  
//   const aggregatedWeightsArr = new Array(numLayers);
//   for (let i = 0; i < numLayers; i++) {
//     aggregatedWeightsArr[i] = tf.zerosLike(weightsArrList[0][i]);
//   }

//   // Perform FedAvg: compute the element-wise mean of the weights
//   for (const weightsArr of weightsArrList) {
//     for (let i = 0; i < numLayers; i++) {
//         aggregatedWeightsArr[i] = tf.add(aggregatedWeightsArr[i], weightsArr[i]);
//     }
//   }
  
//   // Compute the mean by dividing by the number of clients
//   const numClients = weightsArrList.length;
//   for (let i = 0; i < numLayers; i++) {
//       aggregatedWeightsArr[i] = tf.div(aggregatedWeightsArr[i], numClients);
//   }

//   return aggregatedWeightsArr;
// }

export function createModel() {
  const model = tf.sequential();

  model.add(
      tf.layers.conv2d({
      inputShape: [28, 28, 1],
      filters: 32,
      kernelSize: 3,
      activation: 'relu',
      })
  );
  model.add(tf.layers.maxPooling2d({ poolSize: 2, strides: 2 }));

  model.add(
      tf.layers.conv2d({
      filters: 64,
      kernelSize: 3,
      activation: 'relu',
      })
  );
  model.add(tf.layers.maxPooling2d({ poolSize: 2, strides: 2 }));

  model.add(tf.layers.flatten());

  model.add(tf.layers.dense({ units: 128, activation: 'relu' }));

  model.add(tf.layers.dense({ units: 10, activation: 'softmax' }));

  model.compile({
      optimizer: 'adam',
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy'],
  });

  return model;
}

export function loadMNISTDataset(stage) {
  
  const csvUrl = 'mnist_'+stage+'.csv';

  const list = Array.from({ length: 784 }, (_, index) => index + 1);

  const mnist = tf.data.csv(
      csvUrl, {
      hasHeader: false,
      columnNames: ['label',...list],
      columnConfigs: {
          'label': { isLabel: true },
      }
      }
  );

  const flattenedDataset = mnist.map(
      ({ xs, ys }) => {
      // Get the label value
      const label = Object.values(ys)[0];
      
      // Convert the label value to a tensor
      const labelTensor = tf.tensor1d([label], 'int32');
      
      // One-hot encode the label
      const oneHotYs = tf.oneHot(labelTensor, 10).arraySync()[0];

      return { xs: Object.values(xs), ys: oneHotYs };
      }
  );

  return flattenedDataset;
}

export async function trainModel(model, flattenedDataset) {
  const BATCH_SIZE = 256;
  const EPOCHS = 10;

  model.compile({
      optimizer: 'adam',
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy']
  });

  // Convert the dataset to an array
  const dataArray = await flattenedDataset.toArray();

  // Separate the features and labels
  const features = dataArray.map(data => data.xs);
  const labels = dataArray.map(data => data.ys);

  // Convert the features and labels to tensors
  const xs = tf.tensor(features);
  const xsReshaped = xs.reshape([-1, 28, 28, 1]);
  const ys = tf.tensor(labels);
  await model.fit(xsReshaped, ys, {
      batchSize: BATCH_SIZE,
      epochs: EPOCHS,
      shuffle: true,
      validationSplit: 0.15,
  });
  console.log('Model training completed.');
  return model;
}

export async function evaluateModel(model, flattenedDataset) {
  tf.ready()
  .then(() => {
    const backend = tf.getBackend();
    console.log(`TensorFlow.js is using the ${backend} backend.`);
  })
  .catch(err => console.error(err));
  
  // Convert the dataset to an array
  const dataArray = await flattenedDataset.toArray();

  // Separate the features and labels
  const features = dataArray.map(data => data.xs);
  const labels = dataArray.map(data => data.ys);

  // Convert the features and labels to tensors
  const xsTensor = (tf.tensor(features)).reshape([-1, 28, 28, 1]);
  const ysTensor = tf.tensor(labels);
  // Compile the model
  model.compile({
    optimizer: 'adam',
    loss: 'categoricalCrossentropy',
    metrics: ['accuracy']
  });

  // console.log(await saveWeight(model));
  const evaluation = await model.evaluate(xsTensor, ysTensor);
  const loss = evaluation[0].dataSync()[0];
  const accuracy = evaluation[1].dataSync()[0];
  console.log(`Accuracy: ${accuracy}`);
  return accuracy;
}

export async function exportModelToBytes(model) {
    // Get the JSON representation of the model
    const modelJSON = model.toJSON();
    return modelJSON;
}
  
export async function storeWeightsOnIPFS(model) {
    const weightsArr = await saveWeight(model);
    const serializedData = weightsArr.map(arr => Array.from(arr));
    const jsonData = JSON.stringify(serializedData);
    const result = await IPFS.add(jsonData);
    const ipfsHash = result.cid.toString();
    return ipfsHash;
}

export async function loadWeightsFromIPFS(model, ipfsHash) {
    // Fetch the JSON data from IPFS
    const chunks = [];
    for await (const chunk of IPFS.cat(ipfsHash)) {
      chunks.push(chunk);
    }

    // Concatenate the chunks into a single Uint8Array
    const combinedData = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
    let offset = 0;
    for (const chunk of chunks) {
      combinedData.set(chunk, offset);
      offset += chunk.length;
    }

    // Decode the Uint8Array as text
    const jsonData = new TextDecoder().decode(combinedData);
    const restoredSerializedData = JSON.parse(jsonData);
    const downloadedWeightsArr = restoredSerializedData.map(arr => new Float32Array(arr));
    model = await loadWeight(downloadedWeightsArr, model);
    return model;
}

export async function loadModelFromIPFS(ipfsHash) {
    const chunks = [];
    for await (const chunk of IPFS.cat(ipfsHash)) {
      chunks.push(chunk);
    }

    // Concatenate the chunks into a single Uint8Array
    const combinedData = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
    let offset = 0;
    for (const chunk of chunks) {
      combinedData.set(chunk, offset);
      offset += chunk.length;
    }

    // Decode the Uint8Array as text
    const modelJSON = new TextDecoder().decode(combinedData);
    const model = await tf.models.modelFromJSON(JSON.parse(modelJSON));
    return model;
}

export async function storeModelOnIPFS(modelBytes) {
  const result = await IPFS.add(modelBytes);
  const ipfsHash = result.cid.toString();

  return ipfsHash;
}
