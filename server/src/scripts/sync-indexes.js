/**
 * Builds/updates all MongoDB indexes defined in the models:  npm run db:indexes
 * Run once per deploy when MONGODB_AUTO_INDEX=false (recommended for large production databases).
 */
import mongoose from 'mongoose'

import { connectDB } from '../config/db.js'
import AnalysisCache from '../modules/ai/analysis-cache.model.js'
import Lexicon from '../modules/ai/lexicon.model.js'
import User from '../modules/auth/user.model.js'
import Video from '../modules/videos/video.model.js'
import Word from '../modules/words/word.model.js'

await connectDB()
for (const model of [User, Video, Word, AnalysisCache, Lexicon]) {
  const dropped = await model.syncIndexes()
  const indexes = await model.listIndexes()
  console.log(`✓ ${model.modelName}: ${indexes.map((index) => index.name).join(', ')}${dropped.length ? ` (dropped: ${dropped.join(', ')})` : ''}`)
}
await mongoose.disconnect()
