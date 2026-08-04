# 容器内运行的开发环境镜像
FROM node:20-alpine

# 使用 pnpm(硬链接快、离线更稳)
RUN corepack enable && corepack prepare pnpm@9 --activate

WORKDIR /app

# 1) 先把 agent 代码放进去
COPY package.json /app/package.json
COPY index.js     /app/index.js
RUN npm install --omit=dev --no-audit --no-fund

# 2) 预装 workspace 模板依赖(react/vite/antd)——写入镜像层,冷启动就不必再联网装
COPY workspace-template /workspace-template
RUN cd /workspace-template \
    && pnpm install --prefer-offline --reporter=silent \
    && pnpm store prune || true

# 3) 容器启动时把模板拷进 /workspace(若已挂 volume 且非空则跳过)
ENV AGENT_PORT=8000
ENV VITE_PORT=5173
EXPOSE 8000 5173
CMD ["node", "/app/index.js"]