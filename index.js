const axios = require('axios');
const chalk = require('chalk');
const WebSocket = require('ws');
const { HttpsProxyAgent } = require('https-proxy-agent');
const readline = require('readline');
const accounts = require('./account.js');
const proxies = require('./proxy.js');
const { useProxy } = require('./config.js');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

let sockets = [];
let pingIntervals = [];
let countdownIntervals = [];
let potentialPoints = [];
let countdowns = [];
let pointsTotals = [];
let pointsToday = [];
let lastUpdateds = [];
let messages = [];
let userIds = [];

const authorization = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlra25uZ3JneHV4Z2pocGxicGV5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjU0MzgxNTAsImV4cCI6MjA0MTAxNDE1MH0.DRAvf8nH1ojnJBc3rD_Nw6t1AV8X_g6gmY_HByG2Mag";
const apikey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlra25uZ3JneHV4Z2pocGxicGV5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjU0MzgxNTAsImV4cCI6MjA0MTAxNDE1MH0.DRAvf8nH1ojnJBc3rD_Nw6t1AV8X_g6gmY_HByG2Mag";

function displayHeader() {
  process.stdout.write('\x1Bc');
  console.log(chalk.yellow('╔════════════════════════════════════════╗'));
  console.log(chalk.yellow('║      🚀  Nodepay节点机器人  🚀         ║'));
  console.log(chalk.yellow('║  👤    脚本编写：@qklxsqf              ║'));
  console.log(chalk.yellow('║  📢  电报频道：https://t.me/ksqxszq    ║'));
  console.log(chalk.yellow('╚════════════════════════════════════════╝'));
  console.log();
}

function displayAccountData(index) {
  console.log(chalk.cyan(`================= 账户 ${index + 1} =================`));
  console.log(chalk.whiteBright(`邮箱: ${accounts[index].email}`));
  console.log(`用户ID: ${userIds[index]}`);
  console.log(chalk.green(`总积分: ${pointsTotals[index]}`));
  console.log(chalk.green(`今日积分: ${pointsToday[index]}`));
  console.log(chalk.whiteBright(`消息: ${messages[index]}`));
  const proxy = proxies[index % proxies.length];
  if (useProxy) {
    console.log(chalk.hex('#FFA500')(`代理: ${proxy.host}:${proxy.port} (用户: ${proxy.username})`));
  }
  console.log(chalk.cyan(`_____________________________________________`));
}

function logAllAccounts() {
  console.clear();
  displayHeader();
  for (let i = 0; i < accounts.length; i++) {
    displayAccountData(i);
  }
  console.log("\n状态:");
  for (let i = 0; i < accounts.length; i++) {
    console.log(`账户 ${i + 1}: 潜在积分: ${potentialPoints[i]}, 倒计时: ${countdowns[i]}`);
  }
}

async function connectWebSocket(index) {
  if (sockets[index]) return;
  const version = "v0.2";
  const url = "wss://secure.ws.teneo.pro";
  const wsUrl = `${url}/websocket?userId=${encodeURIComponent(userIds[index])}&version=${encodeURIComponent(version)}`;

  const proxy = proxies[index % proxies.length];
  const agent = useProxy ? new HttpsProxyAgent(`http://${proxy.username}:${proxy.password}@${proxy.host}:${proxy.port}`) : null;

  sockets[index] = new WebSocket(wsUrl, { agent });

  sockets[index].onopen = async () => {
    lastUpdateds[index] = new Date().toISOString();
    console.log(`账户 ${index + 1} 已连接`, lastUpdateds[index]);
    startPinging(index);
    startCountdownAndPoints(index);
  };

  sockets[index].onmessage = async (event) => {
    const data = JSON.parse(event.data);
    if (data.pointsTotal !== undefined && data.pointsToday !== undefined) {
      lastUpdateds[index] = new Date().toISOString();
      pointsTotals[index] = data.pointsTotal;
      pointsToday[index] = data.pointsToday;
      messages[index] = data.message;

      logAllAccounts();
    }

    if (data.message === "服务器发送的心跳") {
      console.log(`收到账户 ${index + 1} 的服务器心跳。开始发送心跳...`);
      setTimeout(() => {
        startPinging(index);
      }, 10000);
    }
  };

  sockets[index].onclose = () => {
    stopPinging(index);
    sockets[index] = null;
    console.log(`账户 ${index + 1} 已断开连接`);
    restartAccountProcess(index);
  };

  sockets[index].onerror = (error) => {
    stopPinging(index);
    sockets[index] = null;
    console.error(`账户 ${index + 1} 的 WebSocket 错误:`, error);
    restartAccountProcess(index);
  };
}

function disconnectWebSocket(index) {
  if (sockets[index]) {
    stopPinging(index);
    sockets[index].close();
    sockets[index] = null;
  }
}
function startPinging(index) {
  pingIntervals[index] = setInterval(() => {
    if (sockets[index] && sockets[index].readyState === WebSocket.OPEN) {
      sockets[index].send(JSON.stringify({ type: "PING" }));
      logAllAccounts();
    }
  }, 10000);
}

function stopPinging(index) {
  if (pingIntervals[index]) {
    clearInterval(pingIntervals[index]);
    pingIntervals[index] = null;
  }
}

process.on('SIGINT', () => {
  console.log('正在停止...');
  for (let i = 0; i < accounts.length; i++) {
    stopPinging(i);
    disconnectWebSocket(i);
  }
  process.exit(0);
});

function startCountdownAndPoints(index) {
  clearInterval(countdownIntervals[index]);
  updateCountdownAndPoints(index);
  countdownIntervals[index] = setInterval(() => updateCountdownAndPoints(index), 1000);
}

async function updateCountdownAndPoints(index) {
  const restartThreshold = 60000;
  const now = new Date();

  if (!lastUpdateds[index]) {
    lastUpdateds[index] = {};
  }

  if (countdowns[index] === "计算中...") {
    const lastCalculatingTime = lastUpdateds[index].calculatingTime || now;
    const calculatingDuration = now.getTime() - lastCalculatingTime.getTime();

    if (calculatingDuration > restartThreshold) {
      restartAccountProcess(index);
      return;
    }
  }

  if (lastUpdateds[index]) {
    const nextHeartbeat = new Date(lastUpdateds[index]);
    nextHeartbeat.setMinutes(nextHeartbeat.getMinutes() + 15);
    const diff = nextHeartbeat.getTime() - now.getTime();

    if (diff > 0) {
      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      countdowns[index] = `${minutes}分 ${seconds}秒`;

      const maxPoints = 25;
      const timeElapsed = now.getTime() - new Date(lastUpdateds[index]).getTime();
      const timeElapsedMinutes = timeElapsed / (60 * 1000);
      let newPoints = Math.min(maxPoints, (timeElapsedMinutes / 15) * maxPoints);
      newPoints = parseFloat(newPoints.toFixed(2));

      if (Math.random() < 0.1) {
        const bonus = Math.random() * 2;
        newPoints = Math.min(maxPoints, newPoints + bonus);
        newPoints = parseFloat(newPoints.toFixed(2));
      }

      potentialPoints[index] = newPoints;
    } else {
      countdowns[index] = "计算中，可能需要一分钟启动...";
      potentialPoints[index] = 25;

      lastUpdateds[index].calculatingTime = now;
    }
  } else {
    countdowns[index] = "计算中，可能需要一分钟启动...";
    potentialPoints[index] = 0;

    lastUpdateds[index].calculatingTime = now;
  }

  logAllAccounts();
}

function restartAccountProcess(index) {
  disconnectWebSocket(index);
  connectWebSocket(index);
  console.log(`WebSocket已重新启动，索引: ${index}`);
}

async function getUserId(index) {
  const loginUrl = "https://ikknngrgxuxgjhplbpey.supabase.co/auth/v1/token?grant_type=password";

  const proxy = proxies[index % proxies.length];
  const agent = useProxy ? new HttpsProxyAgent(`http://${proxy.username}:${proxy.password}@${proxy.host}:${proxy.port}`) : null;

  try {
    const response = await axios.post(loginUrl, {
      email: accounts[index].email,
      password: accounts[index].password
    }, {
      headers: {
        'Authorization': authorization,
        'apikey': apikey
      },
      httpsAgent: agent
    });

    userIds[index] = response.data.user.id;
    logAllAccounts();

    const profileUrl = `https://ikknngrgxuxgjhplbpey.supabase.co/rest/v1/profiles?select=personal_code&id=eq.${userIds[index]}`;
    const profileResponse = await axios.get(profileUrl, {
      headers: {
        'Authorization': authorization,
        'apikey': apikey
      },
      httpsAgent: agent
    });

    console.log(`账户 ${index + 1} 的资料数据:`, profileResponse.data);
    startCountdownAndPoints(index);
    await connectWebSocket(index);
  } catch (error) {
    console.error(`账户 ${index + 1} 出错:`, error.response ? error.response.data : error.message);
  }
}

displayHeader();

for (let i = 0; i < accounts.length; i++) {
  potentialPoints[i] = 0;
  countdowns[i] = "计算中...";
  pointsTotals[i] = 0;
  pointsToday[i] = 0;
  lastUpdateds[i] = null;
  messages[i] = '';
  userIds[i] = null;
  getUserId(i);
}
