# Teneo Node Bot

## 简介
这是一个用于自动化管理 Teneo 平台账户的 Node.js 脚本（Teneo 节点机器人）。它通过 WebSocket 连接和 HTTP API 与 Teneo 平台交互，支持多账户管理、积分监控、心跳活动、推荐活动和推荐人奖励的自动领取，并提供代理支持和详细日志输出。

## 功能
- **多账户支持**：从 `account.txt` 或 `bearer.txt` 加载多个账户或 Token。
- **WebSocket 监控**：每 10 秒发送心跳（PING）保持连接，每秒更新账户状态（如积分和倒计时）。
- **奖励自动领取**：
  - 心跳活动 (`heartbeat`) 奖励：每 24 小时检查并领取。
  - 推荐活动 (`referral`) 奖励：每 24 小时检查并领取。
  - 推荐人 (`referrals`) 奖励：每 24 小时检查并领取。
- **代理支持**：可选使用代理（从 `proxy.txt` 加载），支持动态分配和轮换。


## 安装
### 克隆仓库
```bash
git clone https://github.com/ziqing888/teneo-bot.git
cd teneo-bot
```
### 依赖
确保你的系统中安装了 Node.js（建议版本 16.x 或更高）。安装依赖项：

```bash
npm install
```
### 运行脚本
```bash
node index.js
```
