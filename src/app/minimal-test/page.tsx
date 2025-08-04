'use client'

import React, { useState } from 'react'

export default function MinimalTestPage() {
  const [count, setCount] = useState(0)

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>Minimal Test Page</h1>
      <p>Testing basic React functionality</p>
      
      <div style={{ margin: '20px 0' }}>
        <p>Counter: {count}</p>
        <button 
          onClick={() => setCount(c => c + 1)}
          style={{ 
            padding: '10px 20px', 
            marginRight: '10px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Click me (+1)
        </button>
        <button 
          onClick={() => setCount(0)}
          style={{ 
            padding: '10px 20px',
            backgroundColor: '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Reset
        </button>
      </div>
      
      <p style={{ color: 'green', fontWeight: 'bold' }}>
        ✅ If you can see this and the buttons work, React is functioning properly!
      </p>
    </div>
  )
}