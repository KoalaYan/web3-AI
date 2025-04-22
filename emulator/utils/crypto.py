from Crypto.Util.Padding import pad,unpad
from Crypto.Cipher import AES
import base64
import json
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.primitives import serialization

import binascii

def encrypt(message, key):
    raw = pad(message, 16)
    cipher = AES.new(key, AES.MODE_ECB)
    ciphertext = base64.b64encode(cipher.encrypt(raw))
    return ciphertext

def decrypt(ciphertext, key):
    enc = base64.b64decode(ciphertext)
    cipher = AES.new(key, AES.MODE_ECB)
    message = unpad(cipher.decrypt(enc),16).decode("utf-8", "ignore")
    return message

def generate_key():
    # Generate Alice's private and public key pair
    private_key = ec.generate_private_key(ec.SECP256K1(), default_backend())
    public_key = private_key.public_key()

    # Convert private key to hex
    private_hex = format(private_key.private_numbers().private_value, '064x')

    # Convert public key to uncompressed hex format
    public_numbers = public_key.public_numbers()
    public_hex = '04' + format(public_numbers.x, '064x') + format(public_numbers.y, '064x')
    print(f"Private key: {private_hex}")
    print(f"Public key: {public_hex}")
    return private_hex, public_hex


def load_public_key_from_pem(public_key_pem):
    public_key = serialization.load_pem_public_key(public_key_pem.encode("utf-8"), backend=default_backend())
    return public_key

def load_private_key_from_pem(private_key_pem):
    private_key = serialization.load_pem_private_key(private_key_pem.encode("utf-8"), password=None, backend=default_backend())
    return private_key

def load_private_key_from_hex(hex_str):
    private_value = int(hex_str, 16)
    private_key = ec.derive_private_key(private_value, ec.SECP256K1(), default_backend())
    return private_key

def load_public_key_from_hex(hex_str):
    if not hex_str.startswith("04"):
        raise ValueError("Public key must be in uncompressed format (starts with '04').")
    
    public_key_bytes = bytes.fromhex(hex_str)
    x = int.from_bytes(public_key_bytes[1:33], byteorder="big")
    y = int.from_bytes(public_key_bytes[33:], byteorder="big")
    
    public_numbers = ec.EllipticCurvePublicNumbers(x, y, ec.SECP256K1())
    public_key = public_numbers.public_key(default_backend())
    return public_key

def achieve_shared_secret(a_private_key, b_public_key):
    shared_secret = a_private_key.exchange(ec.ECDH(), b_public_key)
    return shared_secret

def test_ECDH():
    private_hex = '21cbd91a442f3c877cff66ed4adf6650dc70ad7cd629be11d6bd9af9c5ce1696'
    public_hex = '047809a7cfe0e2f33c30bce5e65f08e23b1d9d7f8c0aa3653d8a935edd5d565725103dfc72c8ba5788d28646d2339ff7058dd1274a008c5cbcb7333533c64fe173'
    
    private_hex, public_hex = generate_key()
    # exit()
    rec_alice_private_key = load_private_key_from_hex(private_hex)
    rec_alice_public_key = load_public_key_from_hex(public_hex)


    # Generate Alice's private and public key pair
    alice_private_key = ec.generate_private_key(ec.SECP256K1(), default_backend())
    alice_public_key = alice_private_key.public_key()

    # Generate Bob's private and public key pair
    bob_private_key = ec.generate_private_key(ec.SECP256K1(), default_backend())
    bob_public_key = bob_private_key.public_key()

    # Serialize and exchange public keys
    alice_private_key_bytes = alice_private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption()
    )

    alice_public_key_bytes = alice_public_key.public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo
    )
    print(len(alice_private_key_bytes.hex()), alice_private_key_bytes.hex())
    print(len(alice_public_key_bytes), alice_public_key_bytes.hex())
    print(alice_private_key_bytes)
    print(alice_public_key_bytes)
    # exit()

    bob_private_key_bytes = bob_private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption()
    )

    bob_public_key_bytes = bob_public_key.public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo
    )
    # print(len(bob_private_key_bytes), bob_private_key_bytes.hex())
    # print(len(bob_public_key_bytes), bob_public_key_bytes.hex())
    print(bob_private_key_bytes)
    print(bob_public_key_bytes)
    # exit()

    # rec_alice_private_key = serialization.load_pem_private_key(alice_private_key_bytes, password=None, backend=default_backend())
    # rec_bob_private_key = serialization.load_pem_private_key(bob_private_key_bytes, password=None, backend=default_backend())
    
    # rec_alice_private_key = load_private_key_from_pem(alice_private_key_bytes.decode("utf-8"))
    rec_bob_private_key = load_private_key_from_pem(bob_private_key_bytes.decode("utf-8"))

    # Load serialized public keys
    # rec_bob_public_key = serialization.load_pem_public_key(bob_public_key_bytes, backend=default_backend())
    # rec_alice_public_key = serialization.load_pem_public_key(alice_public_key_bytes, backend=default_backend())
    
    rec_bob_public_key = load_public_key_from_pem(bob_public_key_bytes.decode("utf-8"))
    # rec_alice_public_key = load_public_key_from_pem(alice_public_key_bytes.decode("utf-8"))

    # Calculate shared secret using Alice's private key and Bob's public key
    alice_shared_secret = rec_alice_private_key.exchange(ec.ECDH(), rec_bob_public_key)
    bob_shared_secret = bob_private_key.exchange(ec.ECDH(), rec_alice_public_key)

    print(len(alice_shared_secret), alice_shared_secret.hex())
    print(len(bob_shared_secret), bob_shared_secret.hex())
    # exit()
    # Perform symmetric encryption and decryption using the shared secret
    message_to_encrypt = b"Hello, ECDH encryption!"

    # Use the shared secret as a key to perform encryption
    cipher_algorithm = hashes.SHA256()
    key_length = 32
    kdf = HKDF(
        algorithm=hashes.SHA256(),
        length=key_length,
        salt=b"",  # 如果没有盐值，可以传递空字节串
        info=None,  # 如果没有上下文信息，可以传递 None
        backend=default_backend()
    )
    key = kdf.derive(alice_shared_secret)

    kdf2 = HKDF(
        algorithm=hashes.SHA256(),
        length=key_length,
        salt=b"",  # 如果没有盐值，可以传递空字节串
        info=None,  # 如果没有上下文信息，可以传递 None
        backend=default_backend()
    )
    another_key = kdf2.derive(bob_shared_secret)
    # print(len(key), key)
    # print(len(another_key), another_key)
    # exit()

    # Encrypt the message
    cipher_text = encrypt(message_to_encrypt, key)

    print(type(cipher_text), cipher_text)
    # Decrypt the message
    plain_text = decrypt(cipher_text, key)

    print(f"Original message: {message_to_encrypt}")
    print(f"Decrypted message: {plain_text}")


def cryption_test():
    aesKey = binascii.unhexlify('1c28326c024cfe9a5e22ce43ffe9dc2a63ab044396314cf553987dba8c6ca8ad')
    print(len(aesKey), aesKey)
    # exit()
    enc = "Kg9o/+NrgKu6Ul7w4cbh9+F890bST5wYaCisJATJcmw="
    enc = base64.b64decode(enc)
    cipher = AES.new(aesKey, AES.MODE_ECB)
    decryptdata = unpad(cipher.decrypt(enc),16).decode("utf-8", "ignore")
    print(decryptdata)

# def load_public_key_from_pem(public_key_pem):
#     # Remove headers and whitespace from PEM-encoded string
#     public_key_pem = public_key_pem.replace(
#         "-----BEGIN PUBLIC KEY-----", ""
#     ).replace("-----END PUBLIC KEY-----", "").replace("\n", "")

#     # Decode the Base64-encoded PEM string to get key bytes
#     key_bytes = base64.b64decode(public_key_pem)
    
#     key = serialization.load_der_public_key(key_bytes, backend=default_backend())
#     return key

# def load_private_key_from_pem(private_key_pem):
#     # Remove the "-----BEGIN PRIVATE KEY-----" and "-----END PRIVATE KEY-----" lines
#     private_key_pem = private_key_pem.replace(
#         "-----BEGIN PRIVATE KEY-----", ""
#     ).replace("-----END PRIVATE KEY-----", "").replace("\n", "")

#     # Decode the Base64-encoded PEM string to get key bytes
#     key_bytes = base64.b64decode(private_key_pem)

#     print(len(key_bytes.hex()), key_bytes.hex())
#     # Import the private key
#     private_key = serialization.load_der_private_key(
#         key_bytes, password=None, backend=default_backend()
#     )

#     return private_key

def js_test():
    ciphertext = 'bGuOfIaj1YeROPwT3XSMc8Acr7EABBvr9rCgVmlQiho='
    id = 0
    with open('./wallet.json', 'r') as wallet_file:
        wallet_data = json.load(wallet_file)
    ecdh_private_key = wallet_data[str(id)]['ecdh_private_key']
    ecdh_public_key = wallet_data[str(id)]['ecdh_public_key']


    # private_key = load_private_key_from_pem(ecdh_private_key)
    private_key = serialization.load_pem_private_key(ecdh_private_key.encode("utf-8"), password=None, backend=default_backend())
    

    owner_private_key_str = wallet_data['owner']['ecdh_private_key']
    owner_public_key_str = wallet_data['owner']['ecdh_public_key']
    
    owner_private_key = serialization.load_pem_private_key(owner_private_key_str.encode("utf-8"), password=None, backend=default_backend())
    owner_public_key = serialization.load_pem_public_key(owner_public_key_str.encode("utf-8"), backend=default_backend())
    
    print(hex(owner_private_key.private_numbers().private_value))
    # exit()
    pn = owner_private_key.public_key().public_numbers()
    x_hex = hex(pn.x)
    y_hex = hex(pn.y)
    print(f"X: {x_hex}")
    print(f"Y: {y_hex}")
    # exit()

    shared_secret = private_key.exchange(ec.ECDH(), owner_public_key)
    another_shared_secret = owner_private_key.exchange(ec.ECDH(), private_key.public_key())

    print(len(shared_secret), shared_secret.hex())
    # print(len(another_shared_secret), another_shared_secret.hex())
    # exit()

    cipher_algorithm = hashes.SHA256()
    key_length = 32
    kdf = HKDF(
        algorithm=cipher_algorithm,
        salt=None,
        info=None,
        length=key_length
    )
    key = kdf.derive(shared_secret)
    key = shared_secret
    # print(len(key), key.hex())

    # exit()
    plain_text = decrypt(ciphertext, key)
    print(plain_text)

# test_ECDH()
# js_test()
# cryption_test()
