// External Modules
const { test } = require('tap')
const parseStreamComponents = require('../lib/parser')

test('test back-compat parser with all known variants', (t) => {
  const variants = {
    '/ecs/veritas-td': {
      platform: 'ecs',
      environment: 'prod',
      project: 'veritas',
      app: 'main',
      task: 'web',
      revision: 'unknown'
    },
    '/ecs/veritas-dev-td': {
      platform: 'ecs',
      environment: 'dev',
      project: 'veritas',
      app: 'main',
      task: 'web',
      revision: 'unknown'
    },
    '/ecs/ciphertrace-nginx-td': {
      platform: 'ecs',
      environment: 'prod',
      project: 'ciphertrace-nginx',
      app: 'main',
      task: 'web',
      revision: 'unknown'
    },
    '/ecs/ciphertrace-nginx-dev-td': {
      platform: 'ecs',
      environment: 'dev',
      project: 'ciphertrace-nginx',
      app: 'main',
      task: 'web',
      revision: 'unknown'
    },
    '/ecs/alta-customer-manager-td': {
      platform: 'ecs',
      environment: 'prod',
      project: 'alta-customer-manager',
      app: 'main',
      task: 'web',
      revision: 'unknown'
    },
    '/ecs/alta-customer-manager-worker-td': {
      platform: 'ecs',
      environment: 'prod',
      project: 'alta-customer-manager',
      app: 'main',
      task: 'worker',
      revision: 'unknown'
    },
    '/ecs/alta-customer-manager-staging-worker-td': {
      platform: 'ecs',
      environment: 'staging',
      project: 'alta-customer-manager',
      app: 'main',
      task: 'worker',
      revision: 'unknown'
    },
    '/ecs/alta-customer-manager-worker-staging-td': {
      platform: 'ecs',
      environment: 'staging',
      project: 'alta-customer-manager',
      app: 'main',
      task: 'worker',
      revision: 'unknown'
    }
  }

  Object.keys(variants).forEach((groupString) => {
    const componentString = 'ecs'
    const expected = variants[groupString]
    t.same(
      { ...parseStreamComponents(componentString, groupString), groupString },
      { ...expected, groupString }
    )
  })
  t.end()
})

test('test primary parser with all known variants', (t) => {
  const variants = {
    'ecs/dev/net-messenger/main/web/4831a7cdac1248548c8ecbe2aeef4de3': {
      platform: 'ecs',
      environment: 'dev',
      project: 'net-messenger',
      app: 'main',
      task: 'web',
      revision: '4831a7cdac1248548c8ecbe2aeef4de3'
    },
    'ecs/prod/alta-customer-manager/web/12345': {
      platform: 'ecs',
      environment: 'prod',
      project: 'alta-customer-manager',
      app: 'main',
      task: 'web',
      revision: '12345'
    }
  }

  Object.keys(variants).forEach((componentString) => {
    const expected = variants[componentString]
    t.same(
      { ...parseStreamComponents(componentString, 'ecs/nothing'), componentString },
      { ...expected, componentString }
    )
  })
  t.end()
})
