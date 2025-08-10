const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

// 测试微信支付SDK集成
async function testWechatPaymentSDK() {
  console.log('🧪 测试微信支付SDK集成...\n');

  try {
    // 1. 获取当前支付配置
    console.log('1. 获取当前支付配置...');
    const configResponse = await axios.get(`${BASE_URL}/config/group/payment`);
    console.log('当前支付配置数量:', configResponse.data.length);

    // 2. 更新微信支付配置（模拟真实配置）
    console.log('\n2. 更新微信支付配置...');
    const wechatConfigs = [
      {
        key: 'payment_wechat_enabled',
        value: 'true',
      },
      {
        key: 'payment_wechat_app_id',
        value: 'wx1234567890abcdef',
      },
      {
        key: 'payment_wechat_mch_id',
        value: '1234567890',
      },
      {
        key: 'payment_wechat_api_key',
        value: 'test_api_key_123456',
      },
      {
        key: 'payment_wechat_private_key',
        value: '-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...\n-----END PRIVATE KEY-----',
      },
      {
        key: 'payment_wechat_public_key',
        value: '-----BEGIN CERTIFICATE-----\nMIIDXTCCAkWgAwIBAgIJAKoK...\n-----END CERTIFICATE-----',
      },
      {
        key: 'payment_wechat_serial_no',
        value: '1234567890ABCDEF',
      },
    ];

    // 获取需要更新的配置项
    const configsToUpdate = [];
    for (const wechatConfig of wechatConfigs) {
      const existingConfig = configResponse.data.find(c => c.key === wechatConfig.key);
      if (existingConfig) {
        configsToUpdate.push({
          id: existingConfig.id,
          value: wechatConfig.value,
        });
      }
    }

    console.log('准备更新的微信支付配置:', configsToUpdate.map(c => ({ id: c.id, value: c.value })));

    if (configsToUpdate.length > 0) {
      const updateResponse = await axios.put(`${BASE_URL}/config/update-all`, configsToUpdate);
      console.log('微信支付配置更新成功，更新了', updateResponse.data.length, '个配置');
    }

    // 3. 等待SDK重新初始化
    console.log('\n3. 等待SDK重新初始化...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 4. 验证配置已更新
    console.log('\n4. 验证配置已更新...');
    const updatedConfigResponse = await axios.get(`${BASE_URL}/config/group/payment`);
    const wechatConfigs = updatedConfigResponse.data.filter(config =>
      config.key.includes('wechat')
    );

    console.log('更新后的微信支付配置:');
    wechatConfigs.forEach(config => {
      console.log(`  ${config.key}: ${config.value}`);
    });

    console.log('\n✅ 微信支付SDK集成测试完成！');
    console.log('📝 请检查服务器日志，应该看到以下信息：');
    console.log('   - "检测到支付配置更新，重新获取配置并初始化SDK"');
    console.log('   - "开始初始化支付SDK..."');
    console.log('   - "微信支付SDK初始化成功"');
    console.log('   - "支付SDK初始化完成"');

  } catch (error) {
    console.error('❌ 测试失败:', error.response?.data || error.message);
  }
}

// 测试微信支付创建（需要先创建订单）
async function testWechatPaymentCreation() {
  console.log('\n🧪 测试微信支付创建...\n');

  try {
    // 注意：这个测试需要先创建订单，然后创建支付
    // 这里只是展示流程，实际使用时需要先调用订单创建接口
    
    console.log('📝 微信支付创建流程：');
    console.log('1. 创建订单: POST /order/article');
    console.log('2. 创建支付: POST /payment/create');
    console.log('3. 获取支付二维码');
    console.log('4. 用户扫码支付');
    console.log('5. 接收支付回调: POST /payment/notify/wechat');

    console.log('\n✅ 微信支付创建测试说明完成！');

  } catch (error) {
    console.error('❌ 测试失败:', error.response?.data || error.message);
  }
}

// 运行测试
async function runTests() {
  console.log('🚀 开始测试微信支付SDK集成\n');

  await testWechatPaymentSDK();
  await testWechatPaymentCreation();

  console.log('\n🎉 所有测试完成！');
  console.log('\n📋 微信支付配置说明：');
  console.log('- app_id: 微信支付应用ID');
  console.log('- mch_id: 微信支付商户号');
  console.log('- api_key: 微信支付API密钥');
  console.log('- private_key: 微信支付私钥（PEM格式）');
  console.log('- public_key: 微信支付公钥（PEM格式）');
  console.log('- serial_no: 微信支付证书序列号');
}

// 如果直接运行此脚本
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = {
  testWechatPaymentSDK,
  testWechatPaymentCreation,
  runTests,
};
