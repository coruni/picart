// 支付功能测试脚本
// 使用方法: node test-payment.js

const axios = require('axios');

// 配置
const BASE_URL = 'http://localhost:3000';
const JWT_TOKEN = 'your-jwt-token-here'; // 请替换为实际的JWT token

// 设置请求头
const headers = {
  'Authorization': `Bearer ${JWT_TOKEN}`,
  'Content-Type': 'application/json'
};

/**
 * 测试完整的支付流程（新版本）
 * 1. 创建文章订单
 * 2. 创建支付
 * 3. 模拟支付成功
 * 4. 查询支付记录
 */
async function testCompletePaymentFlow() {
  try {
    console.log('=== 测试完整支付流程（新版本）===');
    
    // 1. 创建文章订单
    console.log('\n1. 创建文章订单...');
    const orderResponse = await axios.post(`${BASE_URL}/order/article`, {
      articleId: 1, // 假设文章ID为1
      remark: '测试购买文章'
    }, { headers });
    
    const order = orderResponse.data;
    console.log('订单创建成功:', {
      orderId: order.id,
      orderNo: order.orderNo,
      amount: order.amount,
      title: order.title
    });

    // 2. 创建支付（不再需要前端发送金额）
    console.log('\n2. 创建支付...');
    const paymentResponse = await axios.post(`${BASE_URL}/payment/create`, {
      orderId: order.id,
      paymentMethod: 'ALIPAY'
    }, { headers });
    
    const payment = paymentResponse.data;
    console.log('支付创建成功:', {
      paymentId: payment.paymentId,
      paymentMethod: payment.paymentMethod,
      paymentUrl: payment.paymentUrl
    });

    // 3. 模拟支付成功
    console.log('\n3. 模拟支付成功...');
    const successResponse = await axios.post(`${BASE_URL}/payment/simulate/${payment.paymentId}/success`, {}, { headers });
    console.log('支付成功:', successResponse.data);

    // 4. 查询支付记录
    console.log('\n4. 查询支付记录...');
    const recordResponse = await axios.get(`${BASE_URL}/payment/record/${payment.paymentId}`, { headers });
    console.log('支付记录:', recordResponse.data);

    // 5. 查询订单状态
    console.log('\n5. 查询订单状态...');
    const orderStatusResponse = await axios.get(`${BASE_URL}/order/${order.id}`, { headers });
    console.log('订单状态:', orderStatusResponse.data);

  } catch (error) {
    console.error('测试失败:', error.response?.data || error.message);
  }
}

/**
 * 测试余额支付流程
 */
async function testBalancePaymentFlow() {
  try {
    console.log('\n=== 测试余额支付流程 ===');
    
    // 1. 创建文章订单
    console.log('\n1. 创建文章订单...');
    const orderResponse = await axios.post(`${BASE_URL}/order/article`, {
      articleId: 2, // 假设文章ID为2
      remark: '余额支付测试'
    }, { headers });
    
    const order = orderResponse.data;
    console.log('订单创建成功:', {
      orderId: order.id,
      amount: order.amount
    });

    // 2. 创建余额支付
    console.log('\n2. 创建余额支付...');
    const paymentResponse = await axios.post(`${BASE_URL}/payment/create`, {
      orderId: order.id,
      paymentMethod: 'BALANCE'
    }, { headers });
    
    const payment = paymentResponse.data;
    console.log('余额支付结果:', payment);

  } catch (error) {
    console.error('余额支付测试失败:', error.response?.data || error.message);
  }
}

/**
 * 测试微信支付流程
 */
async function testWechatPaymentFlow() {
  try {
    console.log('\n=== 测试微信支付流程 ===');
    
    // 1. 创建文章订单
    console.log('\n1. 创建文章订单...');
    const orderResponse = await axios.post(`${BASE_URL}/order/article`, {
      articleId: 3, // 假设文章ID为3
      remark: '微信支付测试'
    }, { headers });
    
    const order = orderResponse.data;
    console.log('订单创建成功:', {
      orderId: order.id,
      amount: order.amount
    });

    // 2. 创建微信支付
    console.log('\n2. 创建微信支付...');
    const paymentResponse = await axios.post(`${BASE_URL}/payment/create`, {
      orderId: order.id,
      paymentMethod: 'WECHAT'
    }, { headers });
    
    const payment = paymentResponse.data;
    console.log('微信支付创建成功:', {
      paymentId: payment.paymentId,
      codeUrl: payment.codeUrl
    });

  } catch (error) {
    console.error('微信支付测试失败:', error.response?.data || error.message);
  }
}

/**
 * 测试错误情况
 */
async function testErrorCases() {
  try {
    console.log('\n=== 测试错误情况 ===');
    
    // 测试1: 尝试为不存在的文章创建订单
    console.log('\n1. 测试不存在的文章...');
    try {
      await axios.post(`${BASE_URL}/order/article`, {
        articleId: 99999,
        remark: '不存在的文章'
      }, { headers });
    } catch (error) {
      console.log('预期错误:', error.response?.data?.message);
    }

    // 测试2: 尝试为免费文章创建订单
    console.log('\n2. 测试免费文章...');
    try {
      await axios.post(`${BASE_URL}/order/article`, {
        articleId: 0, // 假设ID为0的文章是免费的
        remark: '免费文章'
      }, { headers });
    } catch (error) {
      console.log('预期错误:', error.response?.data?.message);
    }

    // 测试3: 尝试重复购买同一篇文章
    console.log('\n3. 测试重复购买...');
    try {
      await axios.post(`${BASE_URL}/order/article`, {
        articleId: 1, // 假设已经购买过文章ID为1
        remark: '重复购买'
      }, { headers });
    } catch (error) {
      console.log('预期错误:', error.response?.data?.message);
    }

  } catch (error) {
    console.error('错误测试失败:', error.response?.data || error.message);
  }
}

// 运行测试
async function runTests() {
  console.log('开始支付系统测试...\n');
  
  await testCompletePaymentFlow();
  await testBalancePaymentFlow();
  await testWechatPaymentFlow();
  await testErrorCases();
  
  console.log('\n测试完成！');
}

// 如果直接运行此脚本
if (require.main === module) {
  if (JWT_TOKEN === 'your-jwt-token-here') {
    console.error('请先设置有效的JWT token！');
    process.exit(1);
  }
  runTests();
}

module.exports = {
  testCompletePaymentFlow,
  testBalancePaymentFlow,
  testWechatPaymentFlow,
  testErrorCases
};
