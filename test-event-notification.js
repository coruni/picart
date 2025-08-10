const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

// 测试轻量级事件通知机制
async function testEventNotification() {
  console.log('🧪 测试轻量级事件通知机制...\n');

  try {
    // 1. 获取当前支付配置
    console.log('1. 获取当前支付配置...');
    const configResponse = await axios.get(`${BASE_URL}/config/group/payment`);
    console.log('当前支付配置数量:', configResponse.data.length);

    // 2. 使用 updateAll 接口批量更新配置
    console.log('\n2. 使用 updateAll 接口批量更新配置...');
    
    // 获取需要更新的配置项
    const configsToUpdate = configResponse.data
      .filter(config => config.key.includes('alipay'))
      .slice(0, 2) // 只更新前2个支付宝配置
      .map(config => ({
        id: config.id,
        value: config.value + '_updated_' + Date.now(),
      }));

    console.log('准备更新的配置:', configsToUpdate.map(c => ({ id: c.id, value: c.value })));

    const updateResponse = await axios.put(`${BASE_URL}/config/update-all`, configsToUpdate);
    console.log('批量更新成功，更新了', updateResponse.data.length, '个配置');

    // 3. 等待事件通知和SDK重新初始化
    console.log('\n3. 等待事件通知和SDK重新初始化...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 4. 验证配置已更新
    console.log('\n4. 验证配置已更新...');
    const updatedConfigResponse = await axios.get(`${BASE_URL}/config/group/payment`);
    const updatedConfigs = updatedConfigResponse.data.filter(config => 
      configsToUpdate.some(update => update.id === config.id)
    );
    
    console.log('更新后的配置:');
    updatedConfigs.forEach(config => {
      console.log(`  ${config.key}: ${config.value}`);
    });

    console.log('\n✅ 测试完成！');
    console.log('📝 请检查服务器日志，应该看到以下信息：');
    console.log('   - "检测到支付配置更新，重新获取配置并初始化SDK"');
    console.log('   - "开始初始化支付SDK..."');
    console.log('   - "支付SDK初始化完成"');

  } catch (error) {
    console.error('❌ 测试失败:', error.response?.data || error.message);
  }
}

// 测试单个配置更新
async function testSingleConfigUpdate() {
  console.log('\n🧪 测试单个配置更新...\n');

  try {
    // 1. 更新单个配置
    console.log('1. 更新单个配置...');
    const updateResponse = await axios.put(`${BASE_URL}/config/key/payment_alipay_gateway`, {
      value: 'https://test-gateway-' + Date.now() + '.com',
    });
    console.log('单个配置更新成功:', updateResponse.data);

    // 2. 等待事件通知
    console.log('\n2. 等待事件通知...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('\n✅ 单个配置更新测试完成！');

  } catch (error) {
    console.error('❌ 单个配置更新测试失败:', error.response?.data || error.message);
  }
}

// 运行测试
async function runTests() {
  console.log('🚀 开始测试轻量级事件通知机制\n');
  
  await testEventNotification();
  await testSingleConfigUpdate();
  
  console.log('\n🎉 所有测试完成！');
}

// 如果直接运行此脚本
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = {
  testEventNotification,
  testSingleConfigUpdate,
  runTests,
};
