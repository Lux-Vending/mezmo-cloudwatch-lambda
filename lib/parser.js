const ENVIRONMENT_MATCH = /-(dev|staging|canary|prod)-/
const ENVIRONMENT_SUBST = /.*-(dev|staging|canary|prod)-.*/
const TASK_MATCH = /-(web|migrate|worker)-/
const TASK_SUBST = /.*-(web|migrate|worker)-.*/

// group is the name of the task definition, eg. /ecs/veritas-td
const parseGroup = (group) => {
  group = group.replace('/ecs/', '').replace('-td', '-')
  let project
  let environment
  let task
  // veritas-dev-td, alta-customer-manager-staging-web-td, etc.
  if (ENVIRONMENT_MATCH.test(group)) {
    environment = group.replace(ENVIRONMENT_SUBST, '$1')
    group = group.replace(ENVIRONMENT_MATCH, '-')
  } else {
    // older prod taskdefs don't indicate environment in the name
    environment = 'prod'
  }
  if (TASK_MATCH.test(group)) {
    task = group.replace(TASK_SUBST, '$1')
    group = group.replace(TASK_MATCH, '-')
  } else {
    // older web taskdefs don't indicate task type
    task = 'web'
  }
  project = group.replace(/-+$/, '')
  return {
    platform: 'ecs',
    environment,
    project,
    app: 'main',
    task,
    revision: 'unknown'
  }
}

const parseStreamComponents = (componentString, groupString) => {
  const parsed = {}

  try {
    const idComponents = componentString.split('/')
    if (idComponents.length === 6) {
      parsed.platform = idComponents[0]
      parsed.environment = idComponents[1]
      parsed.project = idComponents[2]
      parsed.app = idComponents[3]
      parsed.task = idComponents[4]
      parsed.revision = idComponents[5]
    } else if (idComponents.length === 5) {
      parsed.platform = idComponents[0]
      parsed.environment = idComponents[1]
      parsed.project = idComponents[2]
      parsed.app = 'main'
      parsed.task = idComponents[3]
      parsed.revision = idComponents[4]
    } else {
      const groupComponents = parseGroup(groupString)
      parsed.platform = groupComponents.platform
      parsed.environment = groupComponents.environment
      parsed.project = groupComponents.project
      parsed.app = groupComponents.app
      parsed.task = groupComponents.task
      parsed.revision = groupComponents.revision
    }
  } catch (err) {
    parsed.platform = 'error'
    parsed.environment = 'error'
    parsed.project = componentString
    parsed.app = groupString
    parsed.task = 'error'
    parsed.revision = 'error'
  }

  return parsed
}

module.exports = parseStreamComponents
