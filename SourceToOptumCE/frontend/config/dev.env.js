'use strict'
const merge = require('webpack-merge')
const prodEnv = require('./prod.env')

module.exports = merge(prodEnv, {
  NODE_ENV: '"development"',
  API_URL: '"http://localhost:8000"',
  STATS_ENDPOINT: '"https://localhost:7259"',
  STRIPE_PUBLISHABLE_KEY: '"pk_test_51SNbPHJA7hjfzXaRHNf7Wmephedh7kaNsiMiNCasGyNF4PuMM0IEp7pry2MLIembZObeMkEH478P8DhYGvWOfj1m00g55FHJJ9"'
})
