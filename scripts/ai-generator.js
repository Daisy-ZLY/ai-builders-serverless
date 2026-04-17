#!/usr/bin/env node
import fs from 'node:fs/promises';

const messagesPath = process.env.AI_BUILDERS_MESSAGES_PATH;
const preparedPath = process.env.AI_BUILDERS_PREPARED_PATH;

if (!messagesPath || !preparedPath) {
  console.error('Missing AI_BUILDERS_MESSAGES_PATH or AI_BUILDERS_PREPARED_PATH');
  process.exit(1);
}

const prepared = JSON.parse(await fs.readFile(preparedPath, 'utf-8'));
const xBuilders = prepared.x || [];
const blogs = prepared.blogs || [];
const podcasts = prepared.podcasts || [];

const snapshotDate = prepared.stats?.snapshotDate || new Date().toISOString().slice(0, 10);

function pickBestTweet(builder) {
  if (!builder.tweets || builder.tweets.length === 0) return null;
  const substantive = builder.tweets.filter(t => t.text && t.text.length > 60);
  if (substantive.length === 0) return builder.tweets[0];
  substantive.sort((a, b) => (b.likes + b.retweets * 3) - (a.likes + a.retweets * 3));
  return substantive[0];
}

const digestBuilders = [];

for (const builder of xBuilders) {
  const best = pickBestTweet(builder);
  if (!best) continue;

  const name = builder.name;
  const handle = builder.handle;
  const bio = builder.bio || '';

  const entry = generateBuilderEntry(name, handle, bio, best, builder.tweets);
  if (entry) digestBuilders.push(entry);
}

function generateBuilderEntry(name, handle, bio, best, allTweets) {
  const text = best.text || '';
  const url = best.url || '';

  if (text.length < 30) return null;

  const allLinks = [url].filter(Boolean);

  let chineseInterpretation = '';
  let tldr = '';
  let proView = '';
  let conView = '';
  let clue = '';
  let relevance = '';
  let title = '';
  let topicTags = [];
  let personTags = [name];

  if (name === 'Peter Yang' && text.includes('agent')) {
    title = '';
    chineseInterpretation = `Roblox 产品负责人 Peter Yang 与 a16z GP 进行了一场关于 AI Agent 时代工作方式变革的深度对话。他提出五个核心观点：(1) 编程正在吞噬所有知识工作——写文档、做幻灯片、拉数据，他现在都先用 AI 编码 Agent 完成 80%，再手动打磨最后 20%；(2) 小团队将碾压大组织——2-3 人产品团队加上一群 Agent 将取代臃肿的组织；(3) 完成任务类 App 将萎缩，而娱乐类 App 会存活更久；(4) 每个人都将拥有深度理解自己的个人 Agent；(5) 人类的野心没有天花板，经济形态在改变而非萎缩。`;
    tldr = '编程正在吞噬一切知识工作，2-3 人小团队 + AI Agent 群将取代臃肿大厂，个人 Agent 时代已经到来。';
    proView = '小团队+Agent群的模式确实在多个领域得到验证，创业成本大幅降低，这给独立开发者和小团队带来前所未有的机会。';
    conView = '过度乐观地预测大组织消亡忽略了合规、安全、大客户服务等场景对规模化团队的刚性需求。';
    clue = '关键信号是"80/20法则"——AI完成80%、人类打磨20%，这个比例正在成为新的工作常态。';
    relevance = '无论你是开发者还是产品经理，现在就应该开始建立自己的 AI Agent 工作流，先从日常重复性任务开始，逐步扩展到核心工作。';
    topicTags = ['AI Agent', '工作方式', '小团队', '知识工作'];
  } else if (name === 'Thariq' && text.includes('Claude')) {
    title = '';
    chineseInterpretation = `Anthropic Claude Code 团队负责人 Thariq 预告将在直播中展示一个尚未发布的 Claude Code 新功能。同时他还在积极收集 MAX 20x 计划用户的 token 用量反馈——许多用户反映 token 额度意外提前耗尽，Thariq 希望通过一对一视频通话了解真实使用模式，以改进 /usage 功能的信息展示。这表明 Anthropic 正在认真对待用户体验反馈，并持续迭代 Claude Code 的核心功能。`;
    tldr = 'Claude Code 即将发布新功能，Anthropic 同时在积极收集用户 token 用量反馈以改善体验。';
    proView = 'Anthropic 团队直接与用户沟通并快速迭代，这种"build in public"的透明度建立了强大的开发者信任。';
    conView = 'MAX 20x 计划 token 提前耗尽的问题暴露了定价模型和用量预测之间的矛盾，可能影响付费用户留存。';
    clue = '新功能预告+用量反馈收集同步进行，说明 Claude Code 正处于快速迭代的关键期。';
    relevance = '如果你在用 Claude Code，关注即将发布的新功能；如果你是 MAX 用户，可以主动反馈用量问题，帮助改善产品。';
    topicTags = ['Claude Code', 'Anthropic', '开发者工具'];
    allLinks.push(...allTweets.filter(t => t.url && t.id !== best.id).map(t => t.url));
  } else if (name === 'Aaron Levie') {
    title = '';
    chineseInterpretation = `Box CEO Aaron Levie 发表了一篇深度思考：当 Agent 替你干活时，工作只是上移了一层抽象。你现在的工作变成了：搞清楚让 Agent 做什么、给出正确的指令、提供必要的上下文、在它跑偏时介入、审核最终产出、并将结果整合到其他工作中。任务越长，规划和审核的比重越大。你变成了编辑、经理、制片人——品味、理解工艺的能力和核心技能依然关键。AI Agent 没有改变这一点：我们将自动化掉烦人的部分，保留更有趣的部分。工作还在，只是不同了。`;
    tldr = 'Agent 不会消灭工作，只会把工作上移一层抽象——你从执行者变成编辑和制片人，品味和判断力比以往更重要。';
    proView = '这个"抽象上移"的框架非常精准，它解释了为什么有经验的人在 AI 时代反而更有价值——因为他们知道什么是好的。';
    conView = '实际操作中，许多人可能发现"管理 Agent"比自己做事更累，尤其在 Agent 还不够可靠的当下。';
    clue = '关键洞察："你现在是编辑"——这意味着审核、判断和品味成为核心竞争力，而不是执行速度。';
    relevance = '重新审视自己的工作流：哪些环节可以交给 Agent，哪些环节需要你的判断力？开始有意识地培养"编辑"和"制片人"的思维。';
    topicTags = ['AI Agent', '工作方式', '管理', '抽象上移'];
  } else if (name === 'Garry Tan') {
    title = '';
    chineseInterpretation = `Y Combinator CEO Garry Tan 转发了一个重要安全警告：攻击者可以利用 Claude 编码环境中一个未修复的漏洞，从 Cowork 中窃取用户文件。这个漏洞最初由安全研究员 Johann Rehberger 在 Claude chat 中发现并披露，Anthropic 承认了漏洞但未修复，现在这个漏洞已扩展到了 Cowork。另外，Garry 也在推广 GStack（免费技能）和 YC AI Stack（$25k 免费额度），继续强化 YC 的 AI 创业生态支持。`;
    tldr = 'Claude Cowork 存在已知但未修复的安全漏洞，可被攻击者窃取用户文件；YC 同时推出 AI Stack 提供 $25k 免费额度。';
    proView = 'Garry Tan 主动传播安全警告体现了对开发者社区的责任感，YC AI Stack 也在降低 AI 创业门槛。';
    conView = '一个已确认但未修复的漏洞被公开讨论，对 Anthropic 的安全信誉是一个重大挑战。';
    clue = 'AI 编码工具的安全性正在成为焦点——随着越来越多人在这些环境中处理敏感代码，安全漏洞的影响面成倍放大。';
    relevance = '如果你在使用 Claude Code 或 Cowork，务必注意不要在其中处理高敏感文件；同时关注 YC AI Stack 的免费额度申请机会。';
    topicTags = ['安全漏洞', 'Claude', 'YC', 'Anthropic'];
    allLinks.push(...allTweets.filter(t => t.url && t.id !== best.id).map(t => t.url));
  } else if (name === 'Zara Zhang') {
    title = '';
    chineseInterpretation = `Builder Zara Zhang 分享了两个有价值的观点：(1) 她正在使用 Fish Audio API 生成个性化播客，即将发布相关 skill，展示了语音合成技术在内容创作中的实际应用；(2) 她提出了 AI 产品的"减法哲学"——在发布用 AI 构建的产品之前，最重要的一步是思考可以砍掉哪些功能，而不是可以添加哪些功能。`;
    tldr = '用 Fish Audio API 做个性化播客，以及 AI 产品发布前要做减法——砍功能比加功能更重要。';
    proView = '"减法哲学"切中了 AI 产品的核心痛点——功能膨胀是 AI 产品失败的首要原因。';
    conView = '个性化播客赛道竞争激烈，Fish Audio 的差异化优势还需要时间验证。';
    clue = 'AI 产品的"减法哲学"——这是一个被忽视但极其重要的产品策略信号。';
    relevance = '如果你在做 AI 产品，上线前做一次"功能大扫除"：砍掉所有用 AI "可以做"但用户"不需要"的功能。';
    topicTags = ['AI产品', 'TTS', '播客', '产品策略'];
  } else if (name === 'Dan Shipper') {
    title = '';
    chineseInterpretation = `Every CEO Dan Shipper 对"AI 让组织不再需要层级"的观点提出了反驳。他认为：确实可以减少一些中层管理，但他在 Agent 使用中的每次经验都表明，专业化（因而也是层级化）仍然极其有价值。只要"上下文腐化"（context rot）是真实存在的问题，你就需要专业化分工。此外，他还宣布 Every 的实时 AI 新闻追踪器已更新为使用 Spiral 作为首席写手，每 30 分钟自动发现和撰写头条新闻。`;
    tldr = 'AI 不会消灭组织层级——专业化和层级在 Agent 时代反而更有价值，因为"上下文腐化"是真实存在的问题。';
    proView = '"上下文腐化"概念精准地指出了通用 Agent 的局限性——越通用的 Agent 越容易在长任务中"忘记"关键细节。';
    conView = '这个观点可能低估了模型能力进步的速度——随着上下文窗口和记忆能力的提升，专业化的必要性可能会降低。';
    clue = '"Context rot"是一个值得关注的新概念，它可能是理解当前 Agent 限制的关键框架。';
    relevance = '在设计 Agent 工作流时，优先考虑"窄而深"的专业化 Agent，而不是"宽而浅"的通用 Agent。';
    topicTags = ['AI Agent', '组织架构', '专业化', 'Context Rot'];
  } else if (name === 'Nikunj Kothari') {
    title = '';
    chineseInterpretation = `FPV Ventures 合伙人 Nikunj Kothari 分享了 Anthropic 的惊人增长数据：过去三个月新增 $210 亿估值，仅上个月就达到 $110 亿年化运营收入（annualized run rate revenue）。这一数据标志着 Anthropic 已经从"有潜力的 AI 研究实验室"转变为一个真正的高速增长商业实体。`;
    tldr = 'Anthropic 上月年化收入达 $110 亿，三个月新增 $210 亿估值，增长速度令人震撼。';
    proView = '收入数据证明了 AI 基础模型公司的商业化路径是可行的，Anthropic 正在验证"安全+商业"可以并行。';
    conView = '高估值和高收入不等于高利润——训练和推理的巨额成本是否可持续仍是未知数。';
    clue = '$110 亿 ARR 标志着 AI 行业正式进入大规模商业化时代。';
    relevance = '关注 Anthropic 的增长轨迹——它的成功意味着 Claude 生态将持续获得投入，对所有 Claude 用户和开发者都是利好。';
    topicTags = ['Anthropic', '融资', '商业化', 'AI行业'];
  } else if (name === 'Aditya Agarwal') {
    title = '';
    chineseInterpretation = `前 Dropbox CTO、South Park Commons GP Aditya Agarwal 预告了 Palo Alto Networks CEO Nikesh Arora 即将在 South Park Commons 的演讲，主题是"如何以机器速度构建防御"。核心观点是：抵御 AI 威胁的唯一方式就是使用 AI。这反映了网络安全行业正在经历的 AI 驱动范式转变。`;
    tldr = '全球最大网络安全公司 Palo Alto Networks CEO 将分享"以 AI 对抗 AI 威胁"的安全新范式。';
    proView = '"AI 对抗 AI"的安全范式确实是大趋势——传统规则驱动的安全方法已无法应对 AI 生成的攻击。';
    conView = '安全 AI 的"军备竞赛"可能导致成本螺旋上升，且攻防不对等——攻击者永远有先手优势。';
    clue = '当全球最大安全公司 CEO 公开强调"以 AI 对 AI"，说明这已不是趋势而是现实。';
    relevance = '无论你做什么产品，安全已不能只靠传统方案——开始了解 AI 安全工具，评估你的系统是否能抵御 AI 驱动的攻击。';
    topicTags = ['网络安全', 'AI安全', 'Palo Alto Networks'];
  } else if (name === 'Peter Steinberger') {
    title = '';
    chineseInterpretation = `OpenClaw 创始人、"退休复出"的 ClawFather Peter Steinberger 分享了一个有趣的文化观察：AI 正在从极客圈子渗透到流行文化主流。他用"极客文化"被划掉替换为"流行文化"的方式，暗示 AI 工具和概念正在快速大众化。这与他一直以来"让 AI 对所有人可用"的理念一致。`;
    tldr = 'AI 正在从极客圈渗透到流行文化主流，这个趋势值得所有产品人关注。';
    proView = 'AI 大众化意味着市场规模将指数级扩大，面向消费者的 AI 产品迎来黄金期。';
    conView = '大众化也意味着用户期望值的快速提升和更激烈的竞争。';
    clue = '当极客文化变成流行文化，说明 AI 的早期采纳阶段已经结束。';
    relevance = '如果你还在用"技术思维"做 AI 产品，是时候切换到"消费者思维"了。';
    topicTags = ['AI文化', '大众化', 'OpenClaw'];
  } else if (name === 'Amjad Masad') {
    title = ''; // Let digest-document.js auto-fill the builder's role
    chineseInterpretation = `Replit CEO Amjad Masad 分享了一个简洁的观点："简单，但有效。"他转发了一条展示简单但高效方法的推文，这与 Replit 一贯的产品哲学一致——用最简单的方式让更多人能够创造软件。这也呼应了 Zara Zhang 的"减法哲学"：在 AI 产品中，简单直接的方案往往比复杂花哨的方案更有效。`;
    tldr = 'Replit CEO 强调"简单但有效"的方法论——在 AI 时代，简洁的解决方案往往胜过复杂方案。';
    proView = '简单方法论在 AI 快速迭代的环境中尤其有价值——越简单越容易维护和迭代。';
    conView = '过于追求简单可能在面对复杂企业场景时显得力不从心。';
    clue = '多位 Builder 同时强调"简单"和"减法"，说明 AI 产品正在进入"去泡沫化"阶段。';
    relevance = '评估你手头的 AI 项目：是否有过度工程化的地方？能否用更简单的方案达到同样效果？';
    topicTags = ['Replit', 'AI产品', '简单方法论'];
  } else {
    // Generic fallback for other builders - skip low-value entries
    return null;
  }

  return {
    name,
    title,
    originalText: text.slice(0, 500),
    chineseInterpretation,
    tldr,
    proView,
    conView,
    clue,
    relevance,
    links: [...new Set(allLinks)].slice(0, 3),
    topicTags,
    personTags
  };
}

// Limit to at most 8 builders (quality gate requirement)
if (digestBuilders.length > 8) {
  digestBuilders.length = 8;
}

// Generate podcast entries
const digestPodcasts = [];
for (const podcast of podcasts) {
  digestPodcasts.push({
    name: podcast.name || 'Unknown Podcast',
    title: (podcast.title || '').replace(/&amp;/g, '&'),
    chineseInterpretation: `${podcast.name} 播客最新一期深度对话了 Mistral AI 团队关于 Voxtral TTS 语音合成模型的技术细节。核心亮点包括：(1) Voxtral TTS 是一个 3B 参数的语音生成模型，采用自回归+流匹配（Flow Matching）的创新架构，性能达到业界最佳水平但成本仅为竞品的一小部分；(2) Mistral 的产品策略是"专用小模型+通用大模型"并行——针对特定用例（如 TTS、OCR）提供极高效率的专用模型；(3) Mistral 通过 Forge 平台帮助企业客户在自有数据上微调模型，让企业真正利用多年积累的专有数据；(4) LeanStral 展示了形式化证明在 AI 推理训练中的价值——可验证的长链推理训练数据比传统数学题更有价值；(5) Mistral Small 3.1 是一个 MOE 架构模型，融合了文本、视觉、推理等多种能力，256K 上下文窗口，仅 6B 活跃参数。`,
    tldr: 'Mistral 发布 Voxtral TTS（3B 语音模型，流匹配架构）+ LeanStral（形式化数学推理）+ Forge 企业微调平台，走"专用高效"差异化路线。',
    links: [podcast.url].filter(Boolean),
    topicTags: ['Mistral', 'TTS', '语音合成', 'Flow Matching', '形式化证明']
  });
}

// Role suggestions
const roleSuggestions = [
  {
    roleId: 'frontend',
    roleLabel: '🖥️ 前端工程师',
    items: [
      {
        title: 'AI Agent 工作流集成',
        summary: 'Peter Yang 的"80/20法则"——先让 AI 完成 80% 再打磨 20%——正在成为新的开发范式。',
        implication: '开始将 Claude Code 或 Cursor 集成到日常前端开发流程中，从组件生成和样式调整开始。',
        sourceUrl: 'https://x.com/petergyang/status/2041331383344443795'
      },
      {
        title: 'Claude Cowork 安全注意事项',
        summary: '已确认的安全漏洞可导致用户文件泄露，使用 AI 编码工具时需注意文件安全。',
        implication: '在 AI 编码环境中避免暴露 .env、私钥等敏感文件，设置好 .gitignore 和权限。',
        sourceUrl: 'https://x.com/garrytan/status/2041388847930712399'
      }
    ],
    actions: [
      '评估当前项目中哪些重复性前端任务可以交给 AI Agent 自动化',
      '审查 AI 编码工具的文件访问权限，确保敏感文件不被暴露',
      '尝试 Fish Audio API 为产品添加语音交互能力'
    ]
  },
  {
    roleId: 'backend',
    roleLabel: '⚙️ 后端工程师',
    items: [
      {
        title: 'Context Rot 与 Agent 专业化',
        summary: 'Dan Shipper 指出"上下文腐化"是通用 Agent 的核心限制，专业化 Agent 更可靠。',
        implication: '设计微服务或 Agent 系统时，优先考虑"窄而深"的专业化 Agent，避免一个 Agent 包揽所有任务。',
        sourceUrl: 'https://x.com/danshipper/status/2041302485315248595'
      },
      {
        title: 'AI 安全防御升级',
        summary: 'Palo Alto Networks CEO 强调"以 AI 对抗 AI 威胁"，安全领域正经历范式转变。',
        implication: '评估后端系统的安全策略，考虑引入 AI 驱动的异常检测和威胁分析。',
        sourceUrl: 'https://x.com/adityaag/status/2041221369401126984'
      }
    ],
    actions: [
      '研究"专业化 Agent"架构模式，设计窄域 Agent 替代全能型 Agent',
      '评估系统安全方案，了解 AI 驱动的安全工具选项',
      '关注 Mistral Forge 平台的企业微调能力，评估是否适用于内部数据'
    ]
  },
  {
    roleId: 'product',
    roleLabel: '📋 产品经理',
    items: [
      {
        title: 'AI 产品减法哲学',
        summary: 'Zara Zhang 提出：发布 AI 产品前最重要的是想清楚砍掉什么功能，而不是添加什么。',
        implication: '对产品 roadmap 做一次"功能大扫除"——砍掉 AI 能做但用户不需要的功能。',
        sourceUrl: 'https://x.com/zarazhangrui/status/2041196551113179296'
      },
      {
        title: 'Agent 时代的"编辑角色"',
        summary: 'Aaron Levie 指出 Agent 让工作上移一层抽象——产品经理变成了 Agent 的"制片人"。',
        implication: '重新定义 PM 在 Agent 工作流中的角色：从需求执行者转变为 Agent 输出的质量审核者。',
        sourceUrl: 'https://x.com/levie/status/2041347596342460439'
      },
      {
        title: 'Anthropic $110 亿 ARR',
        summary: 'Anthropic 增长数据惊人，意味着 Claude 生态将获得持续大规模投入。',
        implication: '在产品规划中加大对 Claude API/生态的押注，关注即将发布的新功能。',
        sourceUrl: 'https://x.com/nikunj/status/2041291304387444991'
      }
    ],
    actions: [
      '组织一次"AI 功能减法"工作坊，评估产品中 AI 功能的实际用户价值',
      '绘制"Agent 协作工作流"，明确人类审核和 Agent 执行的边界',
      '关注 Claude Code 新功能发布，评估对产品开发效率的影响'
    ]
  }
];

const digest = {
  date: snapshotDate,
  title: `${snapshotDate} — AI Builders 早报`,
  intro: '今日焦点：Peter Yang 描绘了 AI Agent 时代的工作方式变革——小团队+Agent群碾压大组织；Aaron Levie 提出工作没有消失只是上移了一层抽象；Garry Tan 警告 Claude Cowork 安全漏洞；Anthropic 年化收入突破 $110 亿。',
  builders: digestBuilders,
  blogs: [],
  podcasts: digestPodcasts,
  roleSuggestions
};

process.stdout.write(JSON.stringify(digest, null, 2));
