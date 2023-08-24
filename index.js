// External Libraries
const agent = require('agentkeepalive')
const asyncRetry = require('async').retry
const request = require('request')
const zlib = require('zlib')
const parseStreamComponents = require('./lib/parser')

// Constants
const MAX_REQUEST_TIMEOUT_MS = parseInt(process.env.LOGDNA_MAX_REQUEST_TIMEOUT) || 30000
const FREE_SOCKET_TIMEOUT_MS = parseInt(process.env.LOGDNA_FREE_SOCKET_TIMEOUT) || 300000
const LOGDNA_URL = process.env.LOGDNA_URL || 'https://logs.logdna.com/logs/ingest'
const MAX_REQUEST_RETRIES = parseInt(process.env.LOGDNA_MAX_REQUEST_RETRIES) || 5
const REQUEST_RETRY_INTERVAL_MS = parseInt(process.env.LOGDNA_REQUEST_RETRY_INTERVAL) || 100
const INTERNAL_SERVER_ERROR = 500
const DEFAULT_HTTP_ERRORS = [
  'ECONNRESET',
  'EHOSTUNREACH',
  'ETIMEDOUT',
  'ESOCKETTIMEDOUT',
  'ECONNREFUSED',
  'ENOTFOUND'
]

const pkg = require('./package.json')

// Get Configuration from Environment Variables
const getConfig = () => {
  const config = {
    log_raw_event: false,
    UserAgent: `${pkg.name}/${pkg.version}`
  }

  if (process.env.LOGDNA_KEY) config.key = process.env.LOGDNA_KEY
  if (process.env.LOGDNA_HOSTNAME) config.hostname = process.env.LOGDNA_HOSTNAME
  if (process.env.LOGDNA_TAGS && process.env.LOGDNA_TAGS.length > 0) {
    config.tags = process.env.LOGDNA_TAGS.split(',').map((tag) => tag.trim())
  }

  if (process.env.LOG_RAW_EVENT) {
    config.log_raw_event = process.env.LOG_RAW_EVENT.toLowerCase()
    config.log_raw_event = config.log_raw_event === 'yes' || config.log_raw_event === 'true'
  }

  return config
}

// Parse the GZipped Log Data
const parseEvent = (event) => {
  return JSON.parse(zlib.unzipSync(Buffer.from(event.awslogs.data, 'base64')))
}

// Prepare the Messages and Options
const prepareLogs = (eventData, logRawEvent) => {
  return eventData.logEvents.map((event) => {
    const components = parseStreamComponents(eventData.logStream, eventData.logGroup)
    const { platform, environment, project, app, task, revision } = components

    const eventMetadata = {
      event: {
        type: eventData.messageType,
        id: event.id,
        tags: [environment],
        components
      },
      log: {
        group: project,
        stream: eventData.logStream
      }
    }

    const eventLog = {
      timestamp: event.timestamp,
      app: `${app}-${task}`,
      file: eventData.logStream,
      meta: {
        owner: project,
        filters: eventData.subscriptionFilters
      },
      line: Object.assign(
        {},
        {
          message: event.message
        },
        eventMetadata
      )
    }

    if (logRawEvent) {
      let logObj = event.message
      if (typeof logObj === 'string') {
        if (logObj[0] === '{') {
          // looks like JSON
          try {
            logObj = JSON.parse(logObj)
          } catch (err) {
            eventLog.line = `[${environment}] [log-parsing-failed] ${logObj}`
          }
        } else {
          eventLog.line = `[${environment}] ${logObj}`
        }
      }
      if (typeof logObj === 'object') {
        if (typeof logObj.msg === 'string') {
          logObj.message = `[${environment}] ${logObj.msg}`
          delete logObj.msg
        } else if (typeof logObj.message === 'string') {
          logObj.message = `[${environment}] ${logObj.message}`
        } else if (typeof logObj.event === 'string') {
          logObj.message = `[${environment}] ${logObj.event}`
          delete logObj.event
        } else {
          logObj.message = `[${environment}] [expand-to-see-details]`
        }
        eventLog.line = logObj
      }
    }
    // eventMetadata.rawLine = event.message
    eventMetadata.logShipperVersion = pkg.version

    if (typeof eventLog.line === 'object') {
      eventLog.line = JSON.stringify(eventLog.line)
    }
    eventLog.meta = Object.assign({}, eventLog.meta, eventMetadata)
    return eventLog
  })
}

// Ship the Logs
const sendLine = (payload, config, callback) => {
  // Check for Ingestion Key
  if (!config.key) return callback('Missing LogDNA Ingestion Key')

  // Set Hostname
  const logGroup = config.log_raw_event
    ? payload[0].meta.log.group
    : JSON.parse(payload[0].line).log.group
  const hostname = config.hostname || logGroup
  const tags = [...(config.tags || []), ...payload[0].meta.event.tags].join(',')
  const qs = { tags, hostname }

  // Prepare HTTP Request Options
  const options = {
    url: LOGDNA_URL,
    qs,
    method: 'POST',
    body: JSON.stringify({
      e: 'ls',
      ls: payload
    }),
    auth: { username: config.key },
    headers: {
      'Content-Type': 'application/json; charset=UTF-8',
      'user-agent': config.UserAgent
    },
    timeout: MAX_REQUEST_TIMEOUT_MS,
    withCredentials: false,
    agent: new agent.HttpsAgent({
      freeSocketTimeout: FREE_SOCKET_TIMEOUT_MS
    })
  }

  // Flush the Log
  asyncRetry(
    {
      times: MAX_REQUEST_RETRIES,
      interval: (retryCount) => {
        return REQUEST_RETRY_INTERVAL_MS * Math.pow(2, retryCount)
      },
      errorFilter: (errCode) => {
        return DEFAULT_HTTP_ERRORS.includes(errCode) || errCode === 'INTERNAL_SERVER_ERROR'
      }
    },
    (reqCallback) => {
      return request(options, (error, response, body) => {
        if (error) {
          return reqCallback(error.code)
        }
        if (response.statusCode >= INTERNAL_SERVER_ERROR) {
          return reqCallback('INTERNAL_SERVER_ERROR')
        }
        return reqCallback(null, body)
      })
    },
    (error, result) => {
      if (error) return callback(error)
      return callback(null, result)
    }
  )
}

// Main Handler
const handler = (event, context, callback) => {
  const config = getConfig()
  return sendLine(prepareLogs(parseEvent(event), config.log_raw_event), config, callback)
}

module.exports = {
  getConfig,
  handler,
  parseEvent,
  prepareLogs,
  sendLine
}
