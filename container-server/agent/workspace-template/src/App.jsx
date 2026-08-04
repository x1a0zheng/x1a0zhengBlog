import React, { useState } from 'react';
import { Button, Card, Space, Input, Tag, message, Divider } from 'antd';

export default function App() {
  const [count, setCount] = useState(0);
  const [name, setName] = useState('antd');

  return (
    <div style={{ padding: 24, background: '#f5f5f5', minHeight: '100vh' }}>
      <Card
        title={<span>🐳 container-server (方案 C) + antd</span>}
        style={{ maxWidth: 560, margin: '0 auto' }}
        extra={<Tag color="geekblue">Vite HMR</Tag>}
      >
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <div>
            <div style={{ marginBottom: 6, color: '#666' }}>输入你的名字：</div>
            <Input value={name} onChange={(e) => setName(e.target.value)} allowClear />
          </div>
          <Divider style={{ margin: '8px 0' }} />
          <div>你好，<b>{name || '陌生人'}</b>！计数：<b>{count}</b></div>
          <Space wrap>
            <Button type="primary" onClick={() => setCount(count + 1)}>+1</Button>
            <Button onClick={() => setCount(count - 1)}>-1</Button>
            <Button danger onClick={() => setCount(0)}>reset</Button>
            <Button type="dashed" onClick={() => message.success(`hi ${name || 'friend'}!`)}>
              toast
            </Button>
          </Space>
          <div style={{ color: '#999', fontSize: 12 }}>
            容器内跑真 Vite dev — 改代码后触发 HMR,state 不会重置。
          </div>
        </Space>
      </Card>
    </div>
  );
}