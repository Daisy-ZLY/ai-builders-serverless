// 人物档案维护规范：
// 1. title 只写稳定身份，不写当天观点或事件。
// 2. bio 只写长期定位，不写短期热点描述。
// 3. personTags 只描述“这个人是谁”，不要混入当天内容标签。
// 4. handle 必须和 feed 中的 handle 对齐，新增后请运行 npm run debug:validate-profiles。
const DEFAULT_TITLE = 'AI Builder';
const DEFAULT_STATUS = 'active';
const DEFAULT_PRIORITY = 50;

export const REQUIRED_PROFILE_FIELDS = [
  'handle',
  'name',
  'title',
  'bio',
  'personTags',
  'org',
  'priority',
  'aliases',
  'status'
];

export function normalizeHandle(value = '') {
  return String(value).trim().replace(/^@/, '').toLowerCase();
}

function normalizeTags(tags = []) {
  const seen = new Set();
  return tags
    .map(tag => String(tag || '').trim())
    .filter(Boolean)
    .filter(tag => {
      const key = tag.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function normalizeAliases(handle, name, aliases = []) {
  const seen = new Set();
  return [name, ...aliases]
    .map(alias => String(alias || '').trim())
    .filter(Boolean)
    .filter(alias => {
      const key = alias.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .filter(alias => normalizeHandle(alias) !== handle);
}

function defineProfile(handle, name, config = {}) {
  const normalizedHandle = normalizeHandle(handle);
  return [
    normalizedHandle,
    {
      handle: normalizedHandle,
      name: String(name || '').trim() || normalizedHandle,
      title: String(config.title || DEFAULT_TITLE).trim(),
      bio: String(config.bio || '').trim(),
      personTags: normalizeTags(config.personTags || ['AI']),
      org: String(config.org || '').trim(),
      priority: Number.isFinite(config.priority) ? config.priority : DEFAULT_PRIORITY,
      aliases: normalizeAliases(normalizedHandle, name, config.aliases || []),
      status: String(config.status || DEFAULT_STATUS).trim() || DEFAULT_STATUS
    }
  ];
}

function createFallbackProfile(builder = {}) {
  const handle = normalizeHandle(builder.handle || builder.name || '');
  const name = String(builder.name || handle || 'Unknown Builder').trim();
  return {
    handle,
    name,
    title: DEFAULT_TITLE,
    bio: '',
    personTags: ['AI'],
    org: '',
    priority: 10,
    aliases: normalizeAliases(handle, name, []),
    status: 'watchlist'
  };
}

const BUILDER_PROFILES = Object.fromEntries([
  defineProfile('karpathy', 'Andrej Karpathy', {
    title: '前 OpenAI 联创、前特斯拉 AI 负责人',
    bio: '顶级 AI 研究者与工程实践者，长期关注模型能力、训练范式与开发体验。',
    personTags: ['研究', '模型', '工程'],
    org: 'OpenAI / Tesla',
    priority: 100
  }),
  defineProfile('swyx', 'Swyx', {
    title: 'Latent Space 主播、AI Engineer 创始人',
    bio: '活跃于 AI 开发者社区，擅长连接模型能力、开发者工具与内容传播。',
    personTags: ['社区', '开发者', '内容'],
    org: 'Latent Space / AI Engineer',
    priority: 96,
    aliases: ['Shawn Wang', 'Latent Space']
  }),
  defineProfile('joshwoodward', 'Josh Woodward', {
    title: 'Google Labs 副总裁',
    bio: '代表大厂产品视角，常释放 Google Labs 在 AI 产品化上的新动作。',
    personTags: ['Google', '产品', '平台'],
    org: 'Google Labs',
    priority: 90
  }),
  defineProfile('kevinweil', 'Kevin Weil', {
    title: 'OpenAI CPO',
    bio: '站在平台与产品交叉口，常谈模型能力如何变成可用的用户产品。',
    personTags: ['产品', '平台', 'OpenAI'],
    org: 'OpenAI',
    priority: 95
  }),
  defineProfile('petergyang', 'Peter Yang', {
    title: 'Roblox 产品负责人',
    bio: '擅长从产品与增长视角拆解 AI 行业机会、组织节奏与市场判断。',
    personTags: ['产品', '增长', '策略'],
    org: 'Roblox',
    priority: 88
  }),
  defineProfile('thenanyu', 'Nan Yu', {
    title: 'Linear 产品负责人',
    bio: '关注高密度产品决策、团队效率和工具如何重塑现代软件工作流。',
    personTags: ['产品', '效率', '团队'],
    org: 'Linear',
    priority: 86
  }),
  defineProfile('realmadhuguru', 'Madhu Guru', {
    title: 'AI Builder',
    bio: '长期关注 AI 产品体验与应用落地，常分享一线工具实践。',
    personTags: ['AI', '产品'],
    org: '',
    priority: 60,
    aliases: ['Madhuguru']
  }),
  defineProfile('amandaaskell', 'Amanda Askell', {
    title: 'Anthropic 研究员',
    bio: '代表安全与对齐视角，常讨论模型行为、价值边界与解释方式。',
    personTags: ['安全', '研究', '对齐'],
    org: 'Anthropic',
    priority: 92
  }),
  defineProfile('_catwu', 'Cat Wu', {
    title: 'AI Builder',
    bio: '关注 AI 工具、工作流与个人表达，常从实践者角度给出轻量观察。',
    personTags: ['AI', '工具'],
    org: '',
    priority: 55
  }),
  defineProfile('trq212', 'Thariq', {
    title: 'AI Builder',
    bio: '偏向实验型 builder，常分享新工具、新界面和个人使用体验。',
    personTags: ['AI', '实验'],
    org: '',
    priority: 55
  }),
  defineProfile('googlelabs', 'Google Labs', {
    title: 'Google Labs 官方账号',
    bio: '用于观察 Google 最新 AI 产品实验和面向用户的能力发布。',
    personTags: ['Google', '产品', '实验室'],
    org: 'Google Labs',
    priority: 84
  }),
  defineProfile('amasad', 'Amjad Masad', {
    title: 'Replit CEO',
    bio: '代表 AI 编程与开发工具创业者视角，关注软件生产方式的重构。',
    personTags: ['创业', '开发工具', 'Agent'],
    org: 'Replit',
    priority: 94
  }),
  defineProfile('rauchg', 'Guillermo Rauch', {
    title: 'Vercel CEO',
    bio: '前端平台与产品工程代表人物，常分享框架、体验和开发者平台思考。',
    personTags: ['前端', '平台', '产品工程'],
    org: 'Vercel',
    priority: 94
  }),
  defineProfile('alexalbert__', 'Alex Albert', {
    title: 'Anthropic 开发者关系负责人',
    bio: '连接模型能力与开发者生态，适合观察 Anthropic 的对外产品节奏。',
    personTags: ['Anthropic', '开发者', '生态'],
    org: 'Anthropic',
    priority: 82
  }),
  defineProfile('levie', 'Aaron Levie', {
    title: 'Box CEO',
    bio: '企业软件老兵，常从商业化与组织效率角度判断 AI 对工作的影响。',
    personTags: ['企业软件', 'AI', '商业化'],
    org: 'Box',
    priority: 90,
    aliases: ['Aaron Levie']
  }),
  defineProfile('ryolu_', 'Ryo Lu', {
    title: 'AI Builder',
    bio: '关注 AI 工具和内容表达，常分享个人实践与产品观察。',
    personTags: ['AI', '内容'],
    org: '',
    priority: 55
  }),
  defineProfile('garrytan', 'Garry Tan', {
    title: 'Y Combinator CEO',
    bio: '代表创业与投资视角，适合观察 AI 创业机会、市场节奏与融资判断。',
    personTags: ['创业', '投资', '市场'],
    org: 'Y Combinator',
    priority: 90
  }),
  defineProfile('mattturck', 'Matt Turck', {
    title: 'FirstMark 合伙人',
    bio: '长期跟踪 AI 市场地图与创业趋势，是投资视角的重要观察对象。',
    personTags: ['投资', 'AI', '市场'],
    org: 'FirstMark',
    priority: 88,
    aliases: ['Data Driven NYC']
  }),
  defineProfile('zarazhangrui', 'Zara Zhang', {
    title: 'AI 内容研究者',
    bio: '持续观察 builders 与 AI 产品演进，擅长把复杂信息转成可读内容。',
    personTags: ['AI', '内容', '研究'],
    org: '',
    priority: 70
  }),
  defineProfile('nikunj', 'Nikunj Kothari', {
    title: 'FPV Ventures 合伙人',
    bio: '偏投资与生态视角，适合观察资本市场对 AI 方向的判断。',
    personTags: ['投资', 'AI', '生态'],
    org: 'FPV Ventures',
    priority: 78
  }),
  defineProfile('steipete', 'Peter Steinberger', {
    title: '资深开发者、AI 工具实验者',
    bio: '长期从开发者与工具实验视角观察 AI 应用真实可用性。',
    personTags: ['开发者', 'AI', '工具'],
    org: '',
    priority: 76,
    aliases: ['Peter Steinberger']
  }),
  defineProfile('danshipper', 'Dan Shipper', {
    title: 'Every CEO',
    bio: '兼具媒体和创业者视角，擅长把 AI 变化翻译成大众可理解的叙事。',
    personTags: ['媒体', 'AI', '创业'],
    org: 'Every',
    priority: 84,
    aliases: ['Dan Shipper', 'AI & I by Every', 'AI & I']
  }),
  defineProfile('adityaag', 'Aditya Agarwal', {
    title: 'AI Builder、投资人',
    bio: '常从技术、医疗和投资交叉视角分享 AI 行业判断与应用机会。',
    personTags: ['AI', '医疗科技', '投资'],
    org: '',
    priority: 72,
    aliases: ['Aditya Agarwal']
  }),
  defineProfile('sama', 'Sam Altman', {
    title: 'OpenAI CEO',
    bio: 'OpenAI 的核心公开窗口之一，适合观察行业方向、产品节奏和战略信号。',
    personTags: ['OpenAI', 'AI', '战略'],
    org: 'OpenAI',
    priority: 100,
    aliases: ['Sam Altman']
  }),
  defineProfile('claudeai', 'Claude', {
    title: 'Claude 官方账号',
    bio: '用于观察 Anthropic 在产品能力、品牌叙事和面向用户发布上的节奏。',
    personTags: ['Anthropic', '产品', '品牌'],
    org: 'Anthropic',
    priority: 80,
    aliases: ['Claude AI']
  }),
  defineProfile('trainingdata', 'Training Data', {
    title: 'AI 播客',
    bio: '由重量级 AI 创业者和从业者参与的深度对话播客。',
    personTags: ['播客', 'AI', '访谈'],
    org: '',
    priority: 80
  }),
  defineProfile('nopriors', 'No Priors', {
    title: 'AI 播客',
    bio: '由 Sarah Guo 和 Elad Gil 主持的顶级 AI 投资与技术播客。',
    personTags: ['播客', '投资', '访谈'],
    org: '',
    priority: 85,
    aliases: ['No Priors Podcast']
  }),
  defineProfile('unsupervisedlearning', 'Unsupervised Learning', {
    title: '安全与技术播客',
    bio: '关注 AI、安全与技术的深度播客，由 Daniel Miessler 主持。',
    personTags: ['播客', '安全', '技术'],
    org: '',
    priority: 75
  })
]);

export function getBuilderProfile(handle, builder = {}) {
  const normalizedHandle = normalizeHandle(handle || builder.handle);
  if (!normalizedHandle) return null;
  return BUILDER_PROFILES[normalizedHandle] || createFallbackProfile({ ...builder, handle: normalizedHandle });
}

export function findBuilderProfileByName(name) {
  if (!name) return null;
  const normalizedSearchName = String(name).trim().toLowerCase();
  
  for (const profile of Object.values(BUILDER_PROFILES)) {
    if (profile.name.toLowerCase() === normalizedSearchName) {
      return profile;
    }
    if (profile.aliases && profile.aliases.some(alias => alias.toLowerCase() === normalizedSearchName)) {
      return profile;
    }
  }
  return null;
}

export function listBuilderProfiles() {
  return Object.values(BUILDER_PROFILES);
}

export { BUILDER_PROFILES };
