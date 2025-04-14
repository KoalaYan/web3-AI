import React, { Component } from 'react';
import elliptic from 'elliptic';
import CryptoJS, { enc } from 'crypto-js';
import { loadPrivateKeyFromHex, loadPublicKeyFromHex, encryptMessage, decryptMessage } from './utils';
class ECDHExample extends Component {
  constructor(props) {
    super(props);
    
    // Initialize the elliptic curve library
    this.ec = new elliptic.ec('secp256k1');

    // Alice's public key in string format
    const keyPair_alice = this.ec.genKeyPair();
    this.alicePrivateKeyString = keyPair_alice.getPrivate('hex');
    this.alicePublicKeyString = keyPair_alice.getPublic('hex');
    this.alicePrivateKey = loadPrivateKeyFromHex(this.alicePrivateKeyString);
    this.alicePublicKey = loadPublicKeyFromHex(this.alicePublicKeyString);

    // Bob's public key in string format
    const keyPair_bob = this.ec.genKeyPair();
    this.bobPrivateKeyString = keyPair_bob.getPrivate('hex');
    this.bobPublicKeyString = keyPair_bob.getPublic('hex');
    this.bobPrivateKey = loadPrivateKeyFromHex(this.bobPrivateKeyString);
    this.bobPublicKey = loadPublicKeyFromHex(this.bobPublicKeyString);

    // Calculate shared secret from Alice's private key and Bob's public key
    this.sharedSecretAlice = this.alicePrivateKey.derive(this.bobPublicKey.getPublic());
    this.sharedSecretBob = this.bobPrivateKey.derive(this.alicePublicKey.getPublic());

    this.sharedKey = CryptoJS.enc.Hex.parse(this.sharedSecretAlice.toString(16));
    console.log(this.sharedSecretAlice.toString(16).length, this.sharedSecretAlice.toString(16));
    console.log(this.sharedSecretBob.toString(16).length, this.sharedSecretBob.toString(16));
  }

  render() {
    const originalMessage = 'Hello, ECDH encryption!';
    const encryptedMessageAlice = encryptMessage(originalMessage, this.sharedKey);
    console.log(encryptedMessageAlice);
    const decryptedMessageBob = decryptMessage(encryptedMessageAlice, this.sharedKey);
    console.log(decryptedMessageBob);

    return (
      <div>
        <h1>ECDH Encryption and Decryption</h1>
        <p>Original Message: {originalMessage}</p>
        <p>Encrypted Message (Alice): {encryptedMessageAlice}</p>
        <p>Decrypted Message (Bob): {decryptedMessageBob}</p>
      </div>
    );
  }
}

export default ECDHExample;
