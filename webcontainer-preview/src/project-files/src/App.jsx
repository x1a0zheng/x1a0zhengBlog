import React, { useState } from 'react';

export default function App() {
  const [count, setCount] = useState(0);
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      marginTop: '50px',
      fontFamily: 'sans-serif',
    }}>
      <h1>🎉 WebContainer + React 成功运行！</h1>
      <p>计数器：{count}</p>
      <button
        onClick={() => setCount(count + 1)}
        style={{ padding: '10px 20px', fontSize: '16px', cursor: 'pointer' }}
      >
        点我 +1
      </button>
    </div>
  );
}