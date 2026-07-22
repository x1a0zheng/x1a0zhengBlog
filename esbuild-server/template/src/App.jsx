import React, { useState } from 'react';
import { Button, Card, Space, Input, Tag, message, Divider } from 'antd';
import 'antd/dist/reset.css';

export default function App() {
  const [count, setCount] = useState(0);
  const [name, setName] = useState('antd');

  return (
    <div style={{ padding: 24, background: '#f5f5f5', minHeight: '100vh' }}>
      <Card
        title={<span>🎨 esbuild + antd 演示</span>}
        style={{ maxWidth: 560, margin: '0 auto' }}
        extra={<Tag color="blue">demo</Tag>}
      >
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <div>
            <div style={{ marginBottom: 6, color: '#666' }}>输入你的名字：</div>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="输入名字"
              allowClear
            />
          </div>

          <Divider style={{ margin: '8px 0' }} />

          <div>你好，<b>{name || '陌生人'}</b>！计数：<b>{count}</b></div>

          <Space wrap>
            <Button type="primary" onClick={() => setCount(count + 1)}>+1</Button>
            <Button onClick={() => setCount(count - 1)}>-1</Button>
            <Button danger onClick={() => setCount(0)}>reset</Button>
            <Button
              type="dashed"
              onClick={() => message.success(`hi ${name || 'friend'}!`)}
            >
              toast
            </Button>
          </Space>

          <div style={{ color: '#999', fontSize: 12 }}>
            修改左侧 <code>src/App.jsx</code> 试试自动重编译。
          </div>
        </Space>
      </Card>
    </div>
  );
}