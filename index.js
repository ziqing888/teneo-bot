const axios = require('axios');
const chalk = require('chalk');
const WebSocket = require('ws');
const { HttpsProxyAgent } = require('https-proxy-agent');
const fs = require('fs');
const readline = require('readline'); 

let sockets = [];
let pingIntervals = [];
let countdownIntervals = [];
let potentialPoints = [];
let countdowns = [];
let pointsTotals = [];
let pointsToday = [];
let lastUpdateds = [];
let messages = [];
let accessTokens = [];
let proxies = [];
let accounts = [];
let emails = [];
let proxyIndex = 0;
let accountProxies = {};
let useProxy = false; // 默认不使用代理

const headers = {
  "Accept": "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9,id;q=0.8",
  "Origin": "https://dashboard.teneo.pro",
  "Referer": "https://dashboard.teneo.pro/",
  "Sec-Fetch-Dest": "empty",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Site": "same-site",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36"
};
const apiKey = "OwAG3kib1ivOJG4Y0OCZ8lJETa6ypvsDtGmdhcjB";

function loadAccountsAndTokens() {
  if (fs.existsSync('account.txt')) {
    try {
      const data = fs.readFileSync('account.txt', 'utf8');
      accounts = data.split('\n').map(line => {
        const [email, password] = line.split(',');
        return email && password ? { email: email.trim(), password: password.trim() } : null;
      }).filter(acc => acc);
      console.log(chalk.green(`成功加载 ${accounts.length} 个账户`));
    } catch (err) {
      console.error(chalk.red('加载 account.txt 失败:'), err);
      process.exit(1);
    }
  }

  if (fs.existsSync('bearer.txt')) {
    try {
      const data = fs.readFileSync('bearer.txt', 'utf8');
      accessTokens = data.split('\n').map(token => token.trim()).filter(token => token);
      console.log(chalk.green(`成功加载 ${accessTokens.length} 个 Bearer Token`));
    } catch (err) {
      console.error(chalk.red('加载 bearer.txt 失败:'), err);
    }
  }
}

function loadProxies() {
  if (!fs.existsSync('proxy.txt')) {
    console.log(chalk.yellow('proxy.txt 未找到，默认不使用代理。'));
    proxies = [];
    return;
  }
  try {
    const data = fs.readFileSync('proxy.txt', 'utf8');
    proxies = data.split('\n').map(line => line.trim()).filter(line => line);
    console.log(chalk.green(`成功加载 ${proxies.length} 个代理`));
  } catch (err) {
    console.error(chalk.red('加载 proxy.txt 失败:'), err);
    process.exit(1);
  }
}

function normalizeProxyUrl(proxy) {
  if (!proxy.startsWith('http://') && !proxy.startsWith('https://')) {
    proxy = 'http://' + proxy;
  }
  return proxy;
}

function getNextProxyForAccount(index) {
  if (!accountProxies[index]) {
    if (!proxies.length) return null;
    accountProxies[index] = normalizeProxyUrl(proxies[proxyIndex]);
    proxyIndex = (proxyIndex + 1) % proxies.length;
  }
  return accountProxies[index];
}

function rotateProxyForAccount(index) {
  if (!proxies.length) return null;
  accountProxies[index] = normalizeProxyUrl(proxies[proxyIndex]);
  proxyIndex = (proxyIndex + 1) % proxies.length;
  return accountProxies[index];
}

function promptUseProxy() {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    rl.question('是否使用代理？(Do you want to use a proxy?) (y/n): ', (answer) => {
      useProxy = answer.toLowerCase() === 'y';
      console.log(chalk.green(useProxy ? '已选择使用代理' : '已选择不使用代理'));
      rl.close();
      resolve();
    });
  });
}

function displayHeader() {
  process.stdout.write('\x1Bc');
  console.log(chalk.yellow('╔════════════════════════════════════════╗'));
  console.log(chalk.yellow('║      🚀  TENEO节点机器人  🚀           ║'));
  console.log(chalk.yellow('║  👤    脚本编写：@qklxsqf              ║'));
  console.log(chalk.yellow('║  📢  电报频道：https://t.me/ksqxszq    ║'));
  console.log(chalk.yellow('╚════════════════════════════════════════╝'));
  console.log();
}

function displayAccountData(index) {
  console.log(chalk.cyan(`================= 账户 ${index + 1} =================`));
  console.log(chalk.whiteBright(`Email: ${emails[index] || '未知'}`));
  console.log(chalk.whiteBright(`Token: ${accessTokens[index].slice(0, 20)}...`));
  console.log(chalk.green(`总积分: ${pointsTotals[index]}`));
  console.log(chalk.green(`今日积分: ${pointsToday[index]}`));
  console.log(chalk.whiteBright(`消息: ${messages[index]}`));
  const proxy = accountProxies[index];
  if (useProxy && proxy) {
    console.log(chalk.hex('#FFA500')(`代理: ${proxy}`));
  } else {
    console.log(chalk.hex('#FFA500')('代理: 未使用'));
  }
  console.log(chalk.cyan(`_____________________________________________`));
}

function logAllAccounts() {
  console.clear();
  displayHeader();
  for (let i = 0; i < accessTokens.length; i++) {
    displayAccountData(i);
  }
  console.log("\n状态:");
  for (let i = 0; i < accessTokens.length; i++) {
    console.log(`账户 ${i + 1}: 潜在积分: ${potentialPoints[i]}, 倒计时: ${countdowns[i]}`);
  }
}

async function refreshToken(index) {
  if (!accounts[index]) {
    console.error(chalk.red(`账户 ${index + 1} 没有可用的邮箱和密码，无法刷新 Token`));
    return;
  }
  const loginUrl = "https://auth.teneo.pro/api/login";
  const proxy = getNextProxyForAccount(index);
  const agent = useProxy && proxy ? new HttpsProxyAgent(proxy) : null;

  try {
    const response = await axios.post(loginUrl, {
      email: accounts[index].email,
      password: accounts[index].password
    }, {
      httpsAgent: agent,
      headers: {
        'Content-Type': 'application/json',
        'authority': 'auth.teneo.pro',
        'x-api-key': apiKey,
        'accept': 'application/json, text/plain, */*',
        'user-agent': headers['User-Agent']
      }
    });
    accessTokens[index] = response.data.access_token;
    emails[index] = accounts[index].email;
    fs.writeFileSync('bearer.txt', accessTokens.join('\n'));
    console.log(chalk.green(`账户 ${index + 1} Token 已刷新`));
    restartAccountProcess(index);
  } catch (error) {
    console.error(chalk.red(`账户 ${index + 1} 刷新 Token 失败:`), error.message);
    messages[index] = `Refresh failed: ${error.message}`;
  }
}

async function getUserData(index) {
  const url = "https://auth.teneo.pro/api/user";
  const proxy = getNextProxyForAccount(index);
  const agent = useProxy && proxy ? new HttpsProxyAgent(proxy) : null;

  try {
    const response = await axios.get(url, {
      headers: {
        ...headers,
        "Authorization": `Bearer ${accessTokens[index]}`,
        "X-Api-Key": apiKey
      },
      httpsAgent: agent
    });
    emails[index] = response.data.email;
    console.log(chalk.green(`账户 ${index + 1} 获取用户信息成功: ${emails[index]}`));
  } catch (error) {
    console.error(chalk.red(`账户 ${index + 1} 获取用户信息失败:`), error.message);
    if (error.response?.status === 401) await refreshToken(index);
  }
}

async function getCampaignStatus(index, type) {
  const url = `https://api.teneo.pro/api/campaigns/${type}/status`;
  const proxy = getNextProxyForAccount(index);
  const agent = useProxy && proxy ? new HttpsProxyAgent(proxy) : null;

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const response = await axios.get(url, {
        headers: {
          ...headers,
          "Authorization": `Bearer ${accessTokens[index]}`
        },
        httpsAgent: agent
      });
      return response.data;
    } catch (error) {
      if (attempt === 4) {
        console.error(chalk.red(`账户 ${index + 1} 获取 ${type} 活动状态失败:`), error.message);
        if (error.response?.status === 401) await refreshToken(index);
      }
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}

async function claimCampaign(index, campaignId, type, title) {
  const url = `https://api.teneo.pro/api/campaigns/${campaignId}/claim`;
  const proxy = getNextProxyForAccount(index);
  const agent = useProxy && proxy ? new HttpsProxyAgent(proxy) : null;

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const response = await axios.post(url, {}, {
        headers: {
          ...headers,
          "Authorization": `Bearer ${accessTokens[index]}`,
          "Content-Length": "0"
        },
        httpsAgent: agent
      });
      console.log(chalk.green(`账户 ${index + 1} 领取 ${type} 活动 ${title} 奖励成功`));
      return response.data;
    } catch (error) {
      if (attempt === 4) {
        console.error(chalk.red(`账户 ${index + 1} 领取 ${type} 活动 ${title} 奖励失败:`), error.message);
        if (error.response?.status === 401) await refreshToken(index);
      }
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}

async function processCampaigns(index) {
  while (true) {
    for (const type of ['heartbeat', 'referral']) {
      const campaigns = await getCampaignStatus(index, type);
      if (campaigns) {
        for (const campaign of campaigns) {
          if (campaign && campaign.status === 'claimable') {
            await claimCampaign(index, campaign.id, type, campaign.title);
          }
        }
      }
    }
    await new Promise(resolve => setTimeout(resolve, 24 * 60 * 60 * 1000)); 
  }
}

async function getReferralsStatus(index) {
  const url = "https://api.teneo.pro/api/users/referrals";
  const proxy = getNextProxyForAccount(index);
  const agent = useProxy && proxy ? new HttpsProxyAgent(proxy) : null;

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const response = await axios.get(url, {
        headers: {
          ...headers,
          "Authorization": `Bearer ${accessTokens[index]}`
        },
        httpsAgent: agent
      });
      return response.data;
    } catch (error) {
      if (attempt === 4) {
        console.error(chalk.red(`账户 ${index + 1} 获取推荐人状态失败:`), error.message);
        if (error.response?.status === 401) await refreshToken(index);
      }
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}

async function claimReferral(index, referralId, referralEmail) {
  const url = "https://api.teneo.pro/api/users/referrals/claim";
  const proxy = getNextProxyForAccount(index);
  const agent = useProxy && proxy ? new HttpsProxyAgent(proxy) : null;

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const response = await axios.post(url, { referralId }, {
        headers: {
          ...headers,
          "Authorization": `Bearer ${accessTokens[index]}`,
          "Content-Type": "application/json"
        },
        httpsAgent: agent
      });
      console.log(chalk.green(`账户 ${index + 1} 领取推荐人奖励成功: ${referralEmail}`));
      return response.data;
    } catch (error) {
      if (attempt === 4) {
        console.error(chalk.red(`账户 ${index + 1} 领取推荐人奖励失败: ${referralEmail}:`), error.message);
        if (error.response?.status === 401) await refreshToken(index);
      }
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}

async function processReferrals(index) {
  while (true) {
    const referralsData = await getReferralsStatus(index);
    if (referralsData) {
      const unfiltered = referralsData.unfiltered?.refferals || [];
      const filtered = referralsData.filtered?.refferals || [];
      const referrals = [...unfiltered, ...filtered];

      for (const referral of referrals) {
        if (referral.canClaim) {
          await claimReferral(index, referral.id, referral.inviteeEmail);
        }
      }
    }
    await new Promise(resolve => setTimeout(resolve, 24 * 60 * 60 * 1000)); 
  }
}

async function connectWebSocket(index) {
  if (sockets[index]) return;
  const version = "v0.2";
  const url = `wss://secure.ws.teneo.pro/websocket?accessToken=${encodeURIComponent(accessTokens[index])}&version=${version}`;
  const proxy = getNextProxyForAccount(index);
  const agent = useProxy && proxy ? new HttpsProxyAgent(proxy) : null;

  sockets[index] = new WebSocket(url, { agent });

  sockets[index].onopen = () => {
    lastUpdateds[index] = new Date().toISOString();
    console.log(chalk.green(`账户 ${index + 1} WebSocket 已连接`));
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
    if (data.message === "Pulse from server") {
      console.log(chalk.blue(`账户 ${index + 1} 收到服务器心跳`));
    }
    if (data.message === "Invalid authentication token. Please log in again.") {
      console.error(chalk.red(`账户 ${index + 1} 的 Token 无效，正在尝试刷新...`));
      await refreshToken(index);
    }
  };

  sockets[index].onclose = () => {
    stopPinging(index);
    sockets[index] = null;
    console.log(chalk.red(`账户 ${index + 1} WebSocket 已断开`));
    restartAccountProcess(index);
  };

  sockets[index].onerror = (error) => {
    stopPinging(index);
    sockets[index] = null;
    console.error(chalk.red(`账户 ${index + 1} WebSocket 错误:`), error.message);
    rotateProxyForAccount(index);
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
      console.log(chalk.blue(`账户 ${index + 1} 发送 PING`));
      logAllAccounts();
    }
  }, 60000); 
}

function stopPinging(index) {
  if (pingIntervals[index]) {
    clearInterval(pingIntervals[index]);
    pingIntervals[index] = null;
  }
}

process.on('SIGINT', () => {
  console.log(chalk.yellow('正在停止...'));
  for (let i = 0; i < accessTokens.length; i++) {
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
  setTimeout(() => {
    connectWebSocket(index);
    console.log(chalk.yellow(`账户 ${index + 1} 的 WebSocket 已重新启动`));
  }, 5000);
}

async function initialize() {
  displayHeader();
  loadAccountsAndTokens();
  await promptUseProxy(); 
  loadProxies();

  if (accounts.length === 0 && accessTokens.length === 0) {
    console.error(chalk.red('未提供账户或 Token，请检查 account.txt 或 bearer.txt'));
    process.exit(1);
  }

  if (useProxy && proxies.length < Math.max(accounts.length, accessTokens.length)) {
    console.error(chalk.red('代理数量不足，请为每个账户提供足够的代理'));
    process.exit(1);
  }

  for (let i = 0; i < accounts.length; i++) {
    if (!accessTokens[i]) await refreshToken(i);
  }

  for (let i = 0; i < Math.max(accounts.length, accessTokens.length); i++) {
    potentialPoints[i] = 0;
    countdowns[i] = "计算中...";
    pointsTotals[i] = 0;
    pointsToday[i] = 0;
    lastUpdateds[i] = null;
    messages[i] = '';
    if (accessTokens[i]) {
      await getUserData(i);
      connectWebSocket(i);
      processCampaigns(i);
      processReferrals(i); 
    }
  }
}

initialize();
