export const ROLE_CONFIGS = [
  {
    id: 'frontend',
    key: 'frontendTl',
    label: '前端',
    shortLabel: '前端',
    aliases: ['frontend-tl', 'frontend-lead', 'frontend_tl', 'frontend', 'fe', 'frontendtl'],
    labels: ['前端', '前端工程师', '前端 TL', '前端TL', '前端负责人', '前端 Leader'],
    keywords: ['前端', '工具', 'UI', '设计', '效率', 'CSS', 'React', 'Vue'],
    promptFocus: '关注前端技术选型、工程效率、设计系统、体验一致性和团队协作。'
  },
  {
    id: 'backend',
    key: 'backendArchitect',
    label: '服务端',
    shortLabel: '服务端',
    aliases: ['backend-architect', 'backend-lead', 'backend_architect', 'backend', 'be', 'backendarchitect'],
    labels: ['服务端', '后端工程师', '服务端架构师', '后端架构师', '服务端负责人', '后端负责人'],
    keywords: ['后端', '架构', '安全', 'API', '数据库', '微服务', '性能'],
    promptFocus: '关注系统架构、可扩展性、稳定性、安全性、平台能力和工程风险。'
  },
  {
    id: 'product',
    key: 'seniorPm',
    label: '产品',
    shortLabel: '产品',
    aliases: ['senior-pm', 'product-lead', 'product_manager', 'product', 'pm', 'seniorpm'],
    labels: ['产品', '高级产品经理', '产品经理', '产品负责人', '高级 PM'],
    keywords: ['产品', '用户', '体验', '增长', '市场', '竞品'],
    promptFocus: '关注用户价值、需求优先级、商业化、竞争格局、增长机会和产品判断。'
  }
];

export const DEFAULT_ROLE_ID = ROLE_CONFIGS[0].id;
export const ROLE_STORAGE_KEY = 'ai-builders-role';

function slugifyRole(value = '') {
  return String(value).trim().toLowerCase().replace(/[\s_]+/g, '-');
}

export function normalizeRoleId(value) {
  if (!value) return DEFAULT_ROLE_ID;

  const normalized = slugifyRole(value);
  for (const role of ROLE_CONFIGS) {
    const candidates = [
      role.id,
      role.key,
      ...role.aliases,
      ...role.labels
    ].map(slugifyRole);
    if (candidates.includes(normalized)) {
      return role.id;
    }
  }

  return DEFAULT_ROLE_ID;
}

export function getRoleConfig(value) {
  const roleId = normalizeRoleId(value);
  return ROLE_CONFIGS.find(role => role.id === roleId) || ROLE_CONFIGS[0];
}

export function getRoleQueryParam(value) {
  return normalizeRoleId(value);
}

export function buildRoleUrl(baseUrl, roleId) {
  const normalizedRoleId = normalizeRoleId(roleId);
  const url = new URL(baseUrl);
  url.searchParams.set('role', normalizedRoleId);
  return url.toString();
}
