const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

// 测试用户登录
async function login(email, password) {
  try {
    const response = await axios.post(`${BASE_URL}/auth/login`, {
      email: email,
      password: password
    });
    console.log('✅ 登录成功');
    return response.data.data.token;
  } catch (error) {
    console.error('❌ 登录失败:', error.response?.data || error.message);
    throw error;
  }
}

// 测试创建顶级评论
async function createTopLevelComment(token, articleId, content) {
  try {
    const response = await axios.post(
      `${BASE_URL}/comment`,
      {
        articleId: articleId,
        content: content
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('✅ 创建顶级评论成功:', {
      commentId: response.data.data.id,
      content: response.data.data.content,
      rootId: response.data.data.rootId
    });
    return response.data.data;
  } catch (error) {
    console.error('❌ 创建顶级评论失败:', error.response?.data || error.message);
    throw error;
  }
}

// 测试创建回复评论
async function createReplyComment(token, articleId, parentId, content) {
  try {
    const response = await axios.post(
      `${BASE_URL}/comment`,
      {
        articleId: articleId,
        parentId: parentId,
        content: content
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('✅ 创建回复评论成功:', {
      commentId: response.data.data.id,
      parentId: response.data.data.parentId,
      rootId: response.data.data.rootId,
      content: response.data.data.content
    });
    return response.data.data;
  } catch (error) {
    console.error('❌ 创建回复评论失败:', error.response?.data || error.message);
    throw error;
  }
}

// 测试获取直接回复
async function getReplies(token, commentId) {
  try {
    const response = await axios.get(
      `${BASE_URL}/comment/${commentId}/replies?page=1&limit=10`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );
    
    console.log('✅ 获取直接回复成功:', {
      total: response.data.data.total,
      replies: response.data.data.data.length
    });
    return response.data.data;
  } catch (error) {
    console.error('❌ 获取直接回复失败:', error.response?.data || error.message);
    throw error;
  }
}

// 测试获取评论详情（包含所有子评论）
async function getCommentDetail(token, commentId) {
  try {
    const response = await axios.get(
      `${BASE_URL}/comment/${commentId}?page=1&limit=20`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );
    
    console.log('✅ 获取评论详情成功:', {
      total: response.data.data.total,
      replies: response.data.data.data.length
    });
    return response.data.data;
  } catch (error) {
    console.error('❌ 获取评论详情失败:', error.response?.data || error.message);
    throw error;
  }
}

// 主测试流程
async function runTest() {
  console.log('🚀 开始测试评论 rootId 功能...\n');
  
  try {
    // 1. 用户登录
    const token = await login('test@example.com', '123456');
    
    // 2. 创建顶级评论
    console.log('\n📝 测试创建顶级评论...');
    const topComment = await createTopLevelComment(token, 1, '这是一个顶级评论');
    
    // 验证顶级评论的 rootId 应该是自己的 id
    if (topComment.rootId !== topComment.id) {
      throw new Error(`顶级评论的 rootId 应该是 ${topComment.id}，但实际是 ${topComment.rootId}`);
    }
    
    // 3. 创建第一层回复
    console.log('\n📝 测试创建第一层回复...');
    const reply1 = await createReplyComment(token, 1, topComment.id, '这是第一层回复');
    
    // 验证回复的 rootId 应该是顶级评论的 id
    if (reply1.rootId !== topComment.id) {
      throw new Error(`第一层回复的 rootId 应该是 ${topComment.id}，但实际是 ${reply1.rootId}`);
    }
    
    // 4. 创建第二层回复
    console.log('\n📝 测试创建第二层回复...');
    const reply2 = await createReplyComment(token, 1, reply1.id, '这是第二层回复');
    
    // 验证第二层回复的 rootId 也应该是顶级评论的 id
    if (reply2.rootId !== topComment.id) {
      throw new Error(`第二层回复的 rootId 应该是 ${topComment.id}，但实际是 ${reply2.rootId}`);
    }
    
    // 5. 创建第三层回复
    console.log('\n📝 测试创建第三层回复...');
    const reply3 = await createReplyComment(token, 1, reply2.id, '这是第三层回复');
    
    // 验证第三层回复的 rootId 也应该是顶级评论的 id
    if (reply3.rootId !== topComment.id) {
      throw new Error(`第三层回复的 rootId 应该是 ${topComment.id}，但实际是 ${reply3.rootId}`);
    }
    
    // 6. 测试获取直接回复
    console.log('\n📝 测试获取直接回复...');
    const directReplies = await getReplies(token, topComment.id);
    
    // 验证只获取到第一层回复
    if (directReplies.data.length !== 1) {
      throw new Error(`应该只有1个直接回复，但实际有 ${directReplies.data.length} 个`);
    }
    
    // 7. 测试获取评论详情（包含所有子评论）
    console.log('\n📝 测试获取评论详情...');
    const commentDetail = await getCommentDetail(token, topComment.id);
    
    // 验证获取到所有层级的回复
    if (commentDetail.data.length !== 3) {
      throw new Error(`应该有3个子评论，但实际有 ${commentDetail.data.length} 个`);
    }
    
    // 验证所有回复的 rootId 都是顶级评论的 id
    commentDetail.data.forEach((reply, index) => {
      if (reply.rootId !== topComment.id) {
        throw new Error(`第${index + 1}个回复的 rootId 应该是 ${topComment.id}，但实际是 ${reply.rootId}`);
      }
    });
    
    console.log('\n🎉 所有测试通过！');
    console.log('\n📝 测试总结:');
    console.log('- ✅ 顶级评论的 rootId 是自己的 id');
    console.log('- ✅ 所有子评论的 rootId 都是顶级评论的 id');
    console.log('- ✅ 直接回复接口只返回第一层回复');
    console.log('- ✅ 评论详情接口返回所有层级的回复');
    console.log('- ✅ 多层级评论结构正确');
    
  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
    process.exit(1);
  }
}

// 运行测试
runTest();
