const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

// 测试配置更新和SDK重新初始化
async function testPaymentSDKReinitialization() {
  console.log('🧪 测试支付SDK动态配置功能...\n');

  try {
    // 1. 获取当前支付配置
    console.log('1. 获取当前支付配置...');
    const configResponse = await axios.get(`${BASE_URL}/config/group/payment`);
    console.log('当前支付配置:', configResponse.data);

    // 2. 更新支付宝配置
    console.log('\n2. 更新支付宝配置...');
    const alipayConfig = {
      key: 'payment_alipay_app_id',
      value: 'test_app_id_' + Date.now(),
      group: 'payment',
      type: 'string',
      description: '支付宝应用ID（测试）',
    };
    
    const updateResponse = await axios.put(`${BASE_URL}/config/key/${alipayConfig.key}`, {
      value: alipayConfig.value,
    });
    console.log('配置更新成功:', updateResponse.data);

    // 3. 等待SDK重新初始化（检查日志）
    console.log('\n3. 等待SDK重新初始化...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 4. 测试创建支付宝支付
    console.log('\n4. 测试创建支付宝支付...');
    
    // 先创建一个测试订单
    const orderResponse = await axios.post(`${BASE_URL}/order/article`, {
      articleId: 1,
      remark: '测试SDK重新初始化',
    }, {
      headers: {
        'Authorization': 'Bearer YOUR_JWT_TOKEN_HERE', // 需要替换为实际的JWT token
      }
    });
    
    if (orderResponse.data && orderResponse.data.id) {
      const paymentResponse = await axios.post(`${BASE_URL}/payment/create`, {
        orderId: orderResponse.data.id,
        paymentMethod: 'ALIPAY',
      }, {
        headers: {
          'Authorization': 'Bearer YOUR_JWT_TOKEN_HERE', // 需要替换为实际的JWT token
        }
      });
      
      console.log('支付创建结果:', paymentResponse.data);
    }

    console.log('\n✅ 测试完成！请检查服务器日志以确认SDK重新初始化。');

  } catch (error) {
    console.error('❌ 测试失败:', error.response?.data || error.message);
  }
}

// 测试配置哈希值检测
function testConfigHashDetection() {
  console.log('\n🔍 测试配置哈希值检测...');
  
  const config1 = {
    alipayEnabled: true,
    wechatEnabled: false,
    alipay: { appId: 'test1', gateway: 'https://test.com' },
    wechat: { appId: 'wx1', mchId: 'mch1' },
  };
  
  const config2 = {
    alipayEnabled: true,
    wechatEnabled: false,
    alipay: { appId: 'test2', gateway: 'https://test.com' }, // 不同的appId
    wechat: { appId: 'wx1', mchId: 'mch1' },
  };
  
  const config3 = {
    alipayEnabled: true,
    wechatEnabled: false,
    alipay: { appId: 'test1', gateway: 'https://test.com' },
    wechat: { appId: 'wx1', mchId: 'mch1' },
  };
  
  function generateConfigHash(config) {
    const configString = JSON.stringify({
      alipayEnabled: config.alipayEnabled,
      wechatEnabled: config.wechatEnabled,
      alipay: { appId: config.alipay.appId, gateway: config.alipay.gateway },
      wechat: { appId: config.wechat.appId, mchId: config.wechat.mchId },
    });
    return Buffer.from(configString).toString('base64');
  }
  
  const hash1 = generateConfigHash(config1);
  const hash2 = generateConfigHash(config2);
  const hash3 = generateConfigHash(config3);
  
  console.log('配置1哈希:', hash1);
  console.log('配置2哈希:', hash2);
  console.log('配置3哈希:', hash3);
  console.log('配置1 === 配置2:', hash1 === hash2); // 应该为 false
  console.log('配置1 === 配置3:', hash1 === hash3); // 应该为 true
}

// 运行测试
async function runTests() {
  console.log('🚀 开始支付SDK动态配置测试\n');
  
  testConfigHashDetection();
  await testPaymentSDKReinitialization();
}

// 如果直接运行此文件
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = {
  testPaymentSDKReinitialization,
  testConfigHashDetection,
};
