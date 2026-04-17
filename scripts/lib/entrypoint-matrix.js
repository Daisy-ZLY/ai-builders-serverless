const ENTRYPOINT_MATRIX = {
  formalSopScripts: [
    'workflow:run-production',
    'workflow:generate-draft',
    'workflow:publish-reviewed',
    'workflow:auto-publish'
  ],
  debugScripts: [
    'debug:prepare-editorial',
    'debug:generate-digest',
    'debug:run-local-digest',
    'debug:review-digest',
    'debug:validate-profiles'
  ],
  publishScripts: [
    'publish:latest',
    'publish:truncate-wecom',
    'publish:html',
    'publish:site',
    'publish:wecom'
  ],
  serveScripts: [
    'serve'
  ],
  deprecatedEntrypoints: [
    'daily',
    'start',
    'prepare:editorial',
    'generate:digest',
    'run:local-digest',
    'review:digest',
    'truncate',
    'html',
    'build',
    'validate:profiles',
    'push'
  ]
};

export function readEntrypointMatrix() {
  return {
    formalSopScripts: [...ENTRYPOINT_MATRIX.formalSopScripts],
    debugScripts: [...ENTRYPOINT_MATRIX.debugScripts],
    publishScripts: [...ENTRYPOINT_MATRIX.publishScripts],
    serveScripts: [...ENTRYPOINT_MATRIX.serveScripts],
    deprecatedEntrypoints: [...ENTRYPOINT_MATRIX.deprecatedEntrypoints]
  };
}
