import Ajv from 'ajv';

const ajv = new Ajv({
  allErrors: true,
  strict: false
});

const stringArray = {
  type: 'array',
  items: { type: 'string' }
};

const DIGEST_SCHEMA = {
  type: 'object',
  required: ['date', 'title', 'intro', 'builders', 'blogs', 'podcasts', 'roleSuggestions'],
  properties: {
    date: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
    title: { type: 'string' },
    intro: { type: 'string' },
    builders: {
      type: 'array',
      items: {
        type: 'object',
        required: [
          'name',
          'title',
          'originalText',
          'chineseInterpretation',
          'tldr',
          'proView',
          'conView',
          'clue',
          'relevance',
          'links',
          'topicTags',
          'personTags'
        ],
        properties: {
          name: { type: 'string' },
          title: { type: 'string' },
          originalText: { type: 'string' },
          chineseInterpretation: { type: 'string' },
          tldr: { type: 'string' },
          proView: { type: 'string' },
          conView: { type: 'string' },
          clue: { type: 'string' },
          relevance: { type: 'string' },
          links: stringArray,
          topicTags: stringArray,
          personTags: stringArray
        }
      }
    },
    blogs: {
      type: 'array',
      items: {
        type: 'object',
        required: ['name', 'title', 'chineseInterpretation', 'tldr', 'links', 'topicTags'],
        properties: {
          name: { type: 'string' },
          title: { type: 'string' },
          chineseInterpretation: { type: 'string' },
          tldr: { type: 'string' },
          links: stringArray,
          topicTags: stringArray
        }
      }
    },
    podcasts: {
      type: 'array',
      items: {
        type: 'object',
        required: ['name', 'title', 'chineseInterpretation', 'tldr', 'links', 'topicTags'],
        properties: {
          name: { type: 'string' },
          title: { type: 'string' },
          chineseInterpretation: { type: 'string' },
          tldr: { type: 'string' },
          links: stringArray,
          topicTags: stringArray
        }
      }
    },
    roleSuggestions: {
      type: 'array',
      items: {
        type: 'object',
        required: ['roleId', 'roleLabel', 'items', 'actions'],
        properties: {
          roleId: { type: 'string' },
          roleLabel: { type: 'string' },
          actions: stringArray,
          items: {
            type: 'array',
            items: {
              type: 'object',
              required: ['title', 'summary', 'implication', 'sourceUrl'],
              properties: {
                title: { type: 'string' },
                summary: { type: 'string' },
                implication: { type: 'string' },
                sourceUrl: { type: 'string' }
              }
            }
          }
        }
      }
    }
  }
};

const validateDigest = ajv.compile(DIGEST_SCHEMA);

function formatDigestValidationErrors(errors = []) {
  return errors
    .map(error => `${error.instancePath || '/'} ${error.message}`.trim())
    .slice(0, 8)
    .join('; ');
}

export function validateDigestSchema(digest) {
  const valid = validateDigest(digest);
  return {
    valid,
    errors: validateDigest.errors || [],
    summary: valid ? '' : formatDigestValidationErrors(validateDigest.errors || [])
  };
}
