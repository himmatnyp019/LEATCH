/**
 * Verifies the MongoDB connection from this machine:  npm run db:check
 * Prints where it connected, round-trip latency and what exists in the database.
 */
import mongoose from 'mongoose'

import { buildMongoConfig, redactUri } from '../config/db.js'
import { env } from '../config/env.js'

const { uri, options } = buildMongoConfig(env)
console.log(`Connecting to ${redactUri(uri)} (database "${options.dbName}")…`)

try {
  const startedAt = performance.now()
  await mongoose.connect(uri, { ...options, autoIndex: false, serverSelectionTimeoutMS: 15_000 })
  const connectMs = Math.round(performance.now() - startedAt)

  const pingStart = performance.now()
  await mongoose.connection.db.admin().command({ ping: 1 })
  const pingMs = Math.round(performance.now() - pingStart)

  const info = await mongoose.connection.db.admin().command({ buildInfo: 1 })
  const collections = await mongoose.connection.db.listCollections().toArray()

  console.log(`✓ Connected in ${connectMs} ms — ping ${pingMs} ms`)
  console.log(`  host: ${mongoose.connection.host}   MongoDB ${info.version}`)
  console.log(`  database: ${mongoose.connection.name}   collections: ${collections.map((c) => c.name).sort().join(', ') || '(none yet)'}`)
  await mongoose.disconnect()
  process.exit(0)
} catch (err) {
  console.error(`✗ Could not connect: ${err.message}`)
  if (/ENOTFOUND|querySrv/.test(err.message)) console.error('  DNS lookup failed — check the cluster hostname and your network/DNS.')
  if (/whitelist|IP|ECONNREFUSED|timed out|Server selection/i.test(err.message)) {
    console.error('  In Atlas → Network Access, allow the public IP of this machine/server.')
  }
  if (/auth|Authentication/i.test(err.message)) console.error('  Check the database user and password (Atlas → Database Access).')
  process.exit(1)
}
