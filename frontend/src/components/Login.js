// components/Login.js
import React from 'react';

const Login = ({ onButtonClick }) => {
  return (
    <div>
      <h1>Please choose your role</h1>
      <button onClick={() => onButtonClick('manager')}>I'm an FL Project Owner</button>
      <button onClick={() => onButtonClick('client')}>I'm an FL Project Participant</button>
      <button onClick={() => onButtonClick('crypto')}>Testing Crypto</button>
    </div>
  );
};

export default Login;
