import tensorflow as tf
from tensorflow.keras.applications import ResNet50
from tensorflow.keras.layers import Conv2D, MaxPooling2D, Flatten, Dense
from tensorflow.keras.models import Sequential
from tensorflow.keras import layers, Model

def build_resnet18(input_shape=(32, 32, 3), num_classes=10):
    def basic_block(x, filters, stride=1):
        # First convolution layer
        y = layers.Conv2D(filters, (3, 3), strides=stride, padding='same')(x)
        y = layers.BatchNormalization()(y)
        y = layers.ReLU()(y)
        
        # Second convolution layer
        y = layers.Conv2D(filters, (3, 3), padding='same')(y)
        y = layers.BatchNormalization()(y)
        
        # Shortcut connection
        if stride != 1 or x.shape[-1] != filters:
            shortcut = layers.Conv2D(filters, (1, 1), strides=stride)(x)
            shortcut = layers.BatchNormalization()(shortcut)
        else:
            shortcut = x
        
        y = layers.add([y, shortcut])
        y = layers.ReLU()(y)
        return y

    input_tensor = layers.Input(shape=input_shape)
    
    # Initial convolution layer
    x = layers.Conv2D(64, (7, 7), strides=2, padding='same')(input_tensor)
    x = layers.BatchNormalization()(x)
    x = layers.ReLU()(x)
    x = layers.MaxPooling2D((3, 3), strides=2, padding='same')(x)
    
    # Residual blocks
    x = basic_block(x, 64)
    x = basic_block(x, 64)
    x = basic_block(x, 128, stride=2)
    x = basic_block(x, 128)
    x = basic_block(x, 256, stride=2)
    x = basic_block(x, 256)
    x = basic_block(x, 512, stride=2)
    x = basic_block(x, 512)
    
    # Global average pooling
    x = layers.GlobalAveragePooling2D()(x)
    
    # Fully connected layer
    x = layers.Dense(num_classes, activation='softmax')(x)
    
    model = Model(inputs=input_tensor, outputs=x)
    return model

# Create a custom CNN model
def create_custom_cnn():
    model = Sequential()
    model.add(Conv2D(32, kernel_size=(3, 3), activation='relu', input_shape=(28, 28, 1)))
    model.add(MaxPooling2D(pool_size=(2, 2)))
    model.add(Conv2D(64, kernel_size=(3, 3), activation='relu'))
    model.add(MaxPooling2D(pool_size=(2, 2)))
    model.add(Flatten())
    model.add(Dense(128, activation='relu'))
    model.add(Dense(10, activation='softmax'))  # Adjust the number of output classes as needed

    return model

# Create and save the models
resnet18_model = build_resnet18(input_shape=(32, 32, 3), num_classes=10)
custom_cnn_model = create_custom_cnn()

resnet18_json = resnet18_model.to_json()
# Write the JSON data to the file
with open('resnet18_model.json', 'w') as json_file:
    json_file.write(resnet18_json)

custom_cnn_json = custom_cnn_model.to_json()
# Write the JSON data to the file
with open('cnn_model.json', 'w') as json_file:
    json_file.write(custom_cnn_json)
