const jwt = require('jsonwebtoken');

// 测试 JWT 配置
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

console.log('=== JWT 调试信息 ===');
console.log(`JWT_SECRET: ${JWT_SECRET ? '已设置' : '未设置'}`);
console.log(`JWT_EXPIRES_IN: ${JWT_EXPIRES_IN}`);

// 测试生成 token
const testPayload = {
  username: 'testuser',
  sub: 1
};

try {
  const token = jwt.sign(testPayload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  console.log('✅ JWT Token 生成成功');
  console.log(`Token: ${token}`);
  
  // 测试解析 token
  const decoded = jwt.verify(token, JWT_SECRET);
  console.log('✅ JWT Token 解析成功');
  console.log(`Payload: ${JSON.stringify(decoded, null, 2)}`);
  
  // 测试过期时间
  const header = jwt.decode(token, { complete: true });
  console.log(`Token 过期时间: ${new Date(header.payload.exp * 1000)}`);
  
} catch (error) {
  console.error('❌ JWT 测试失败:', error.message);
}

console.log('\n=== 使用说明 ===');
console.log('1. 确保设置了正确的 JWT_SECRET 环境变量');
console.log('2. 检查 JWT_EXPIRES_IN 格式是否正确');
console.log('3. 确保前端发送的 Authorization 头格式为: Bearer <token>');
console.log('4. 检查缓存是否正常工作'); 