import React, { useState } from 'react';

function ModelUploader({onFilesLoaded}) {
  const [modelInfo, setModelInfo] = useState('');
  // const [files, setFiles] = useState("");
  
  async function loadModel(event) {
    const modelFile = event.target.files[0];
    
    if (!modelFile) {
      return;
    }

    if (modelFile.type !== 'application/json') {
      setModelInfo('Invalid file format. Please select a JSON model file.');
      return;
    }

    try {
      const fileReader = new FileReader();
      fileReader.readAsText(event.target.files[0], "UTF-8");
      fileReader.onload = event => {
        // setFiles(event.target.result);
        const filesData = event.target.result;
        onFilesLoaded(filesData);
      };
    } catch (error) {
      console.error('Error loading the model:', error);
      setModelInfo('Error loading the model. Please check the file format and try again.');
    }
  }

  return (
    <div>
      <input type="file" accept=".json" onChange={loadModel} />
      <div id="modelInfo">{modelInfo}</div>
    </div>
  );
}

export default ModelUploader;
