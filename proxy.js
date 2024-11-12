module.exports = [
  {
    host: "proxy1.example.com",
    port: 8080,
    username: "proxyuser1",  // 如果您的代理需要身份验证，请包含这些信息；如果不需要，请删除此部分
    password: "proxypass1" // 如果您的代理需要身份验证，请包含这些信息；如果不需要，请删除此部分
  },
  {
    host: "proxy2.example.com",
    port: 8080,
    username: "proxyuser2",
    password: "proxypass2"
  },
  // 根据需要添加更多代理
];
