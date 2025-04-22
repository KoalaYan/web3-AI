
from utils.ml import load_mnist_dataset, train_model, evaluate_model
from utils.crypto import generate_key, load_private_key_from_hex, load_public_key_from_hex, encrypt, decrypt, load_private_key_from_pem, load_public_key_from_pem, achieve_shared_secret
from utils.ipfs import enc_upload_weight_to_ipfs, dec_load_weight_from_ipfs, dec_load_model_from_ipfs, load_model_from_ipfs
import json
from web3 import Web3
import argparse
import binascii
import asyncio
import logging
import time
import configparser

def create_logger(ID):
    logger = logging.getLogger("my_logger")
    logger.setLevel(logging.DEBUG)
    log_filename = f"./res/{ID}.log"
    file_handler = logging.FileHandler(log_filename)
    formatter = logging.Formatter("%(asctime)s - %(name)s - %(levelname)s - %(message)s")
    file_handler.setFormatter(formatter)
    logger.addHandler(file_handler)
    return logger

def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument('--id', type=int, default=0, help='Wallet ID')
    parser.add_argument('--projectID', type=int, default=0, help='Project ID')
    parser.add_argument('--contrac_address', type=str, default='0x269b67838C6c63bE752c4Aa71682D481817Bec45', help='Contract address')

    return parser.parse_args()

async def filter_GlobalModelUpdated(event_filter, poll_interval, projectID):
    flag = False  # Initialize the flag
    while not flag:  # Continue looping until flag becomes True
        for event in event_filter.get_new_entries():
            manager_address = event['args']['managerAddress']
            project_id = event['args']['projectId']
            iteration = event['args']['iteration']

            if project_id == projectID:
                print(f"Condition met: projectId={project_id}, iteration={iteration}")
                flag = True  # Set flag to True to exit the loop
                break  # Exit the for loop
        await asyncio.sleep(poll_interval)
    return

async def filter_EncryptedKey(event_filter, poll_interval, projectID, wallet_address, sharedKey):
    flag = False  # Initialize the flag
    while not flag:  # Continue looping until flag becomes True
        for event in event_filter.get_new_entries():
            clientAddress = event['args']['clientAddress']
            project_id = event['args']['projectId']
            iteration = event['args']['iteration']
            encryptedKey = event['args']['encryptedKey']

            if project_id == projectID and clientAddress == wallet_address:
                print(f"Condition met: projectId={project_id}, iteration={iteration}")
                aesKeyStr = decrypt(encryptedKey, sharedKey)
                print('Dynamic AES key is: ', aesKeyStr)
                aesKey = binascii.unhexlify(aesKeyStr)
                flag = True  # Set flag to True to exit the loop
                break  # Exit the for loop
        await asyncio.sleep(poll_interval)
    return aesKey

async def main():
    aesKey = None
    serverPK = None
    args = parse_args()
    logger = create_logger(args.id)
    # Load the contract ABI and address from the JSON file
    with open('./EncFederatedLearningContract.json', 'r') as json_file:
        contract_data = json.load(json_file)
    contract_abi = contract_data['abi']

    # cfg_file = './cfg/'+str(args.id)+'.cfg'
    cfg_file = './cfg/all.cfg'
    # read configuration from .cfg file
    config = configparser.ConfigParser()
    config.read(cfg_file)
    contract_address = config['global']['CONTRACT_ADDRESS']    

    # Load the wallet address and private key from the JSON file
    with open('./wallet.json', 'r') as wallet_file:
        wallet_data = json.load(wallet_file)
    wallet_address = config[str(args.id)]['ACCOUNT_ADDRESS']
    wallet_private_key = config[str(args.id)]['PRIVATE_KEY']
    ecdh_private_key_hex_str, ecdh_public_key_hex_str = generate_key()
    ecdh_private_key = load_private_key_from_hex(ecdh_private_key_hex_str)
    ecdh_public_key = load_public_key_from_hex(ecdh_public_key_hex_str)

    sharedKey = None

    http_provider = config['global']['HTTP_PROVIDER']
    w3 = Web3(Web3.HTTPProvider(http_provider))
    if not w3.is_connected():
        print("Could not connect to Ethereum node.")
    else:
        print("Connected to Ethereum node.")

    # Create a contract instance
    contract = w3.eth.contract(address=contract_address, abi=contract_abi)
    # Prepare and sign transactions using the wallet's private key
    def sign_transaction(tx):
        signed_tx = w3.eth.account.sign_transaction(tx, private_key=wallet_private_key)
        return signed_tx.raw_transaction
    
    model = None
    projectID = args.projectID
    (x_train, y_train), (x_test, y_test) = load_mnist_dataset()

    niter = 0
    nlimit = 10


    first_join = True
    flag = False
        
    while True:
        if first_join:
            serverPK_pem = contract.functions.getMainPK(projectID).call({'from': wallet_address})
            serverPK = load_public_key_from_hex(serverPK_pem)
            sharedKey = achieve_shared_secret(ecdh_private_key, serverPK)
            flag = contract.functions.isTrainable(projectID).call({'from': wallet_address})
            first_join = False
        
        if not flag:
            print('Project is not trainable, waiting.')
            event_filter = contract.events.GlobalModelUpdated.create_filter(from_block='latest')
            await filter_GlobalModelUpdated(event_filter, 2, projectID)
        flag = False

        print('Start joining...')
        start_time_1 = time.time()
        if model is None:
            oneTimeFee = contract.functions.beforeJoin(projectID).call({'from': wallet_address}) * 0.1
            # oneTimeFee = 20
            print(f'One time fee: {oneTimeFee}')
            fees = w3.to_wei(oneTimeFee, 'ether')
            transaction = contract.functions.join(projectID, ecdh_public_key_hex_str).build_transaction({
                'chainId': 1337,  # Replace with the correct chain ID
                'gas': 2000000,    # Adjust gas limit as needed
                'gasPrice': w3.to_wei('2', 'gwei'),  # Adjust gas price as needed
                'nonce': w3.eth.get_transaction_count(wallet_address),
                'value': fees
            })
        else:
            transaction = contract.functions.join(projectID, ecdh_public_key_hex_str).build_transaction({
                'chainId': 1337,  # Replace with the correct chain ID
                'gas': 2000000,    # Adjust gas limit as needed
                'gasPrice': w3.to_wei('2', 'gwei'),  # Adjust gas price as needed
                'nonce': w3.eth.get_transaction_count(wallet_address)
            })

        # Sign and send the transaction
        signed_transaction = sign_transaction(transaction)
        tx_hash = w3.eth.send_raw_transaction(signed_transaction)

        event_filter = contract.events.EncryptedKey.create_filter(from_block='latest')
        aesKey = await filter_EncryptedKey(event_filter, 2, projectID, wallet_address, sharedKey)

        # Wait for the transaction receipt
        tx_receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
        end_time_1 = time.time()
        logger.info(f"Joining time: {end_time_1 - start_time_1}")

        if model is None:
            start_time_2 = time.time()
            print('Loading model architecture from IPFS...', 'Decrypt with key:', aesKey)
            arch_ipfs_hash = contract.functions.participateReturn(projectID).call({'from': wallet_address})
            end_time_2 = time.time()
            logger.info(f"Getting model arch CID time: {end_time_2 - start_time_2}")
            # model = load_model_from_ipfs(arch_ipfs_hash)
            start_time_2 = time.time()
            model = dec_load_model_from_ipfs(arch_ipfs_hash, aesKey)
            # model = load_model_from_ipfs(arch_ipfs_hash)
            model.compile(optimizer='adam', loss='categorical_crossentropy', metrics=['accuracy'])
            end_time_2 = time.time()
            logger.info(f"Loading model arch time: {end_time_2 - start_time_2}")
            
        start_time_3 = time.time()
        print('Loading model weights from IPFS...')
        weights_ipfs_hash = contract.functions.joinReturn(projectID).call({'from': wallet_address})
        end_time_3 = time.time()
        logger.info(f"Getting model weights CID time: {end_time_3 - start_time_3}")

        start_time_3 = time.time()
        # model = load_weight_from_ipfs(weights_ipfs_hash, model)
        model = dec_load_weight_from_ipfs(weights_ipfs_hash, model, aesKey)
        end_time_3 = time.time()
        logger.info(f"Loading model weights time: {end_time_3 - start_time_3}")


        start_time_4 = time.time()
        train_model(model, x_train, y_train, epochs=1)
        end_time_4 = time.time()
        logger.info(f"Training time: {end_time_4 - start_time_4}")

        evaluate_model(model, x_test, y_test)

        # upload_hash_value = upload_weight_to_ipfs(model)
        start_time_5 = time.time()
        upload_hash_value = enc_upload_weight_to_ipfs(model, sharedKey)
        end_time_5 = time.time()
        logger.info(f"Uploading model weights time: {end_time_5 - start_time_5}")
        print(f"Model uploaded to IPFS with hash: {upload_hash_value}")


        print('Upoading local model IPFS address to blockchain...')
        start_time_5 = time.time()
        transaction = contract.functions.local_upload(projectID, upload_hash_value).build_transaction({
            'chainId': 1337,  # Replace with the correct chain ID
            'gas': 2000000,    # Adjust gas limit as needed
            'gasPrice': w3.to_wei('2', 'gwei'),  # Adjust gas price as needed
            'nonce': w3.eth.get_transaction_count(wallet_address)
        })
        # Sign and send the transaction
        signed_transaction = sign_transaction(transaction)
        tx_hash = w3.eth.send_raw_transaction(signed_transaction)
        end_time_5 = time.time()
        logger.info(f"Uploading model weights CID time: {end_time_5 - start_time_5}")
        print('Finished.')
        
        niter += 1
        if niter >= nlimit:
            break

    print('Training completed.')
    
if __name__ == '__main__':
    asyncio.run(main())
    # main()
    # test_ECDH()
