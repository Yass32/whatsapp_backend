'use strict'
/**
 * New Relic agent configuration.
 *
 * See lib/config/default.js in the agent distribution for a more complete
 * description of configuration variables and their potential values.
 */
exports.config = {
  app_name: process.env.NEW_RELIC_APP_NAME || 'WhatsApp-Elearning',
  license_key: process.env.NEW_RELIC_LICENSE_KEY,
  
  // Disable problematic native metrics
  coda_ssl: false,
  ssl: false,
  allow_all_headers: true,
  
  logging: {
    level: 'info',
    filepath: 'newrelic_agent.log'
  },
  
  // Application performance monitoring
  application_logging: {
    forwarding: {
      enabled: true
    }
  },
  
  // Disable problematic instrumentation
  instrumentation: {
    timers: {
      enabled: false
    },
    // Disable native metrics that cause Node.js version conflicts
    native_metrics: {
      enabled: false
    }
  },
  /**
   * When true, all request headers except for those listed in attributes.exclude
   * will be captured for all traces, unless otherwise specified in a destination's
   * attributes include/exclude lists.
   */
  allow_all_headers: true,
  // Security: Exclude sensitive headers and data
  attributes: {
    exclude: [
      'request.headers.cookie',
      'request.headers.authorization',
      'request.headers.proxyAuthorization',
      'request.headers.setCookie*',
      'request.headers.x*',
      'request.body.password',
      'request.body.token',
      'response.headers.cookie',
      'response.headers.authorization',
      'response.headers.proxyAuthorization',
      'response.headers.setCookie*',
      'response.headers.x*',
      'response.body.token',
      'response.body.refreshToken'
    ]
  }
}
