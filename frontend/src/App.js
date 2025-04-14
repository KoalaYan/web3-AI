// src/App.js
import React, { useState } from 'react';
import './App.css';
import Login from './components/Login';
import Manager from './components/Manager'; // 更新引用
import Client from './components/Client'; // 更新引用
// import ECDHExample from './components/Cryption';
import CounterApp from './components/Cryption';
function App() {
  const [currentPage, setCurrentPage] = useState('login');

  const handleButtonClick = (page) => {
    setCurrentPage(page);
  };

  return (
    <div className="App">
      {currentPage === 'login' && <Login onButtonClick={handleButtonClick} />}
      {currentPage === 'manager' && <Manager />} {/* 更新引用 */}
      {currentPage === 'client' && <Client />} {/* 更新引用 */}
      {currentPage === 'crypto' && <CounterApp />} {/* 更新引用 */}
    </div>
  );
}

export default App;
