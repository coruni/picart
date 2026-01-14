/**
 * WebSocket 客户端测试脚本
 * 
 * 使用方法：
 * 1. 安装依赖: npm install socket.io-client
 * 2. 替换 TOKEN 为实际的 JWT Token
 * 3. 运行: node test-websocket-client.js
 */

const io = require('socket.io-client');

// ==================== 配置 ====================
const WS_URL = 'ws://localhost:3000/ws-message';
const TOKEN = 'your_jwt_token_here'; // 替换为实际的 JWT Token

// ==================== 颜色输出 ====================
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`${colors[color]}[${timestamp}] ${message}${colors.reset}`);
}

// ==================== 创建连接 ====================
log('正在连接 WebSocket...', 'cyan');

const socket = io(WS_URL, {
  auth: { token: TOKEN },
  transports: ['websocket', 'polling']
});

// ==================== 事件监听 ====================

// 连接成功
socket.on('connected', (data) => {
  log('✅ 连接成功!', 'green');
  log(`用户信息: ${JSON.stringify(data.user)}`, 'blue');
  
  // 连接成功后执行的操作
  setTimeout(() => {
    log('获取历史消息...', 'cyan');
    socket.emit('getHistory', { page: 1, limit: 10 });
  }, 1000);
  
  setTimeout(() => {
    log('获取未读消息数量...', 'cyan');
    socket.emit('getUnreadCount');
  }, 2000);
});

// 连接错误
socket.on('error', (error) => {
  log(`❌ 错误: ${error.message} (${error.code})`, 'red');
});

// 连接断开
socket.on('disconnect', (reason) => {
  log(`❌ 连接断开: ${reason}`, 'red');
});

// 接收新消息
socket.on('newMessage', (message) => {
  log('📨 收到新消息:', 'green');
  console.log({
    id: message.id,
    sender: message.sender?.nickname || message.sender?.username || '系统',
    content: message.content,
    type: message.type,
    isBroadcast: message.isBroadcast,
    createdAt: message.createdAt,
  });
});

// 接收历史消息
socket.on('history', (data) => {
  log(`📜 历史消息 (共 ${data.total} 条):`, 'blue');
  data.items.forEach((msg, index) => {
    console.log(`  ${index + 1}. [${msg.type}] ${msg.sender?.nickname || '系统'}: ${msg.content}`);
  });
});

// 接收未读数量
socket.on('unreadCount', (count) => {
  log(`🔔 未读消息数量:`, 'yellow');
  console.log(`  个人消息: ${count.personal}`);
  console.log(`  广播消息: ${count.broadcast}`);
  console.log(`  总计: ${count.total}`);
});

// 加入房间成功
socket.on('joined', (data) => {
  log(`✅ 已加入房间: ${data.room}`, 'green');
});

// 离开房间成功
socket.on('leaved', (data) => {
  log(`✅ 已离开房间: ${data.room}`, 'green');
});

// 消息已读确认
socket.on('read', (data) => {
  log(`✅ 消息 ${data.messageId} 已标记为已读`, 'green');
});

// 全部已读确认
socket.on('allMarkedAsRead', (data) => {
  log('✅ 所有消息已标记为已读', 'green');
});

// 批量操作结果
socket.on('batchOperationResult', (data) => {
  log(`✅ 批量操作完成: ${data.message}`, 'green');
});

// 用户信息
socket.on('profile', (profile) => {
  log('👤 用户信息:', 'blue');
  console.log(profile);
});

// Pong 响应
socket.on('pong', (data) => {
  log(`🏓 Pong: ${data.timestamp}`, 'cyan');
});

// ==================== 测试函数 ====================

// 发送消息
function sendMessage(toUserId, content, type = 'private') {
  log(`发送消息给用户 ${toUserId || '所有人'}: ${content}`, 'magenta');
  
  const data = {
    content,
    type,
    isBroadcast: !toUserId
  };
  
  if (toUserId) {
    data.toUserId = toUserId;
  }
  
  socket.emit('sendMessage', data, (response) => {
    if (response && response.success) {
      log('✅ 消息发送成功', 'green');
    } else {
      log('❌ 消息发送失败', 'red');
    }
  });
}

// 标记消息为已读
function markAsRead(messageId) {
  log(`标记消息 ${messageId} 为已读`, 'magenta');
  socket.emit('readMessage', { messageId });
}

// 标记所有消息为已读
function markAllAsRead() {
  log('标记所有消息为已读', 'magenta');
  socket.emit('markAllAsRead', {});
}

// 获取历史消息
function getHistory(page = 1, limit = 20) {
  log(`获取历史消息 (第 ${page} 页, 每页 ${limit} 条)`, 'magenta');
  socket.emit('getHistory', { page, limit });
}

// 获取未读数量
function getUnreadCount() {
  log('获取未读消息数量', 'magenta');
  socket.emit('getUnreadCount');
}

// 获取用户信息
function getProfile() {
  log('获取用户信息', 'magenta');
  socket.emit('getProfile');
}

// Ping 测试
function ping() {
  log('发送 Ping', 'magenta');
  socket.emit('ping');
}

// 批量操作
function batchOperation(messageIds, action) {
  log(`批量操作: ${action} 消息 [${messageIds.join(', ')}]`, 'magenta');
  socket.emit('batchOperation', { messageIds, action });
}

// ==================== 交互式命令 ====================

// 监听键盘输入
const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// 显示帮助信息
function showHelp() {
  console.log('\n' + colors.bright + '可用命令:' + colors.reset);
  console.log('  send <userId> <content>  - 发送消息给指定用户');
  console.log('  broadcast <content>      - 发送广播消息');
  console.log('  history [page] [limit]   - 获取历史消息');
  console.log('  unread                   - 获取未读数量');
  console.log('  read <messageId>         - 标记消息为已读');
  console.log('  readall                  - 标记所有消息为已读');
  console.log('  profile                  - 获取用户信息');
  console.log('  ping                     - Ping 测试');
  console.log('  help                     - 显示帮助');
  console.log('  exit                     - 退出程序');
  console.log('');
}

// 处理命令
function handleCommand(input) {
  const parts = input.trim().split(' ');
  const command = parts[0].toLowerCase();
  
  switch (command) {
    case 'send':
      if (parts.length < 3) {
        log('用法: send <userId> <content>', 'yellow');
      } else {
        const userId = parseInt(parts[1]);
        const content = parts.slice(2).join(' ');
        sendMessage(userId, content);
      }
      break;
      
    case 'broadcast':
      if (parts.length < 2) {
        log('用法: broadcast <content>', 'yellow');
      } else {
        const content = parts.slice(1).join(' ');
        sendMessage(null, content);
      }
      break;
      
    case 'history':
      const page = parseInt(parts[1]) || 1;
      const limit = parseInt(parts[2]) || 20;
      getHistory(page, limit);
      break;
      
    case 'unread':
      getUnreadCount();
      break;
      
    case 'read':
      if (parts.length < 2) {
        log('用法: read <messageId>', 'yellow');
      } else {
        const messageId = parseInt(parts[1]);
        markAsRead(messageId);
      }
      break;
      
    case 'readall':
      markAllAsRead();
      break;
      
    case 'profile':
      getProfile();
      break;
      
    case 'ping':
      ping();
      break;
      
    case 'help':
      showHelp();
      break;
      
    case 'exit':
      log('正在退出...', 'cyan');
      socket.close();
      rl.close();
      process.exit(0);
      break;
      
    default:
      log(`未知命令: ${command}`, 'red');
      log('输入 "help" 查看可用命令', 'yellow');
  }
}

// 启动交互式命令行
setTimeout(() => {
  showHelp();
  
  rl.on('line', (input) => {
    if (input.trim()) {
      handleCommand(input);
    }
  });
  
  rl.setPrompt('> ');
  rl.prompt();
  
  rl.on('close', () => {
    log('再见!', 'cyan');
    process.exit(0);
  });
}, 3000);

// ==================== 心跳检测 ====================
setInterval(() => {
  if (socket.connected) {
    socket.emit('ping');
  }
}, 30000); // 每30秒发送一次心跳

// ==================== 错误处理 ====================
process.on('uncaughtException', (error) => {
  log(`未捕获的异常: ${error.message}`, 'red');
  console.error(error);
});

process.on('unhandledRejection', (reason, promise) => {
  log('未处理的 Promise 拒绝:', 'red');
  console.error(reason);
});

// ==================== 优雅退出 ====================
process.on('SIGINT', () => {
  log('\n正在关闭连接...', 'cyan');
  socket.close();
  rl.close();
  process.exit(0);
});
