from ipfshttpclient import connect
import tensorflow as tf
import tensorflowjs as tfjs
import json
from tensorflow.keras.models import Sequential
from tensorflow.keras.saving import register_keras_serializable

from utils.crypto import encrypt, decrypt

def upload_weight_to_ipfs(model):
    weights = model.get_weights()
    weights_json = [w.ravel().tolist() for w in weights]
    client = connect()
    result = client.add_json(weights_json)
    return result

def enc_upload_weight_to_ipfs(model, aesKey):
    weights = model.get_weights()
    weights_list = [w.ravel().tolist() for w in weights]
    weights_json = json.dumps(weights_list)
    ciphertext = encrypt(weights_json.encode(), aesKey)
    client = connect()
    result = client.add_bytes(ciphertext)
    return result

def load_weight_from_ipfs(hash_value, local_model):
    client = connect()
    weightsArr_json = client.cat(hash_value)
    
    weightsArr = json.loads(weightsArr_json)
    for i, layer in enumerate(local_model.trainable_weights):
        layer.assign(tf.constant(weightsArr[i], shape=layer.shape, dtype='float32'))

    return local_model

def dec_load_weight_from_ipfs(hash_value, local_model, aesKey):
    register_keras_serializable()(Sequential)
    client = connect()
    enc = client.cat(hash_value).decode('utf-8')
    weightsArr_json = decrypt(enc, aesKey)
    weightsArr = json.loads(weightsArr_json)
    for i, layer in enumerate(local_model.trainable_weights):
        layer.assign(tf.constant(weightsArr[i], shape=layer.shape, dtype='float32'))

    return local_model

def upload_model_to_ipfs(model):
    # json_string = model.to_json()
    json_string = tfjs.converters.serialize_keras_model(model).decode('utf-8')
    client = connect()
    result = client.add_json(json_string)
    return result

def dec_load_model_from_ipfs(hash_value, aesKey):
    client = connect()
    enc = client.cat(hash_value).decode('utf-8')
    result = decrypt(enc, aesKey)
    # load model by tfjs.converters.deserialize_keras_model
    # loaded_model = tf.keras.models.model_from_json(result)
    custom_objects = {'Sequential': tf.keras.models.Sequential}
    # loaded_model = tfjs.converters.deserialize_keras_model(result)
    loaded_model = tf.keras.models.model_from_json(result, custom_objects=custom_objects)
    loaded_model.summary()
    return loaded_model

def load_model_from_ipfs(hash_value):
    client = connect()
    result = client.cat(hash_value)
    loaded_model = tf.keras.models.model_from_json(result)
    return loaded_model