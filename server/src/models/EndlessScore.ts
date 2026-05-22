import mongoose, { Schema, Document } from 'mongoose'

export interface IEndlessScore extends Document {
  userId: mongoose.Types.ObjectId
  username: string
  characterName: string
  race: string
  archetype: string
  tier: string
  wave: number
  achievedAt: Date
}

const EndlessScoreSchema = new Schema<IEndlessScore>({
  userId:        { type: Schema.Types.ObjectId, ref: 'User', required: true },
  username:      { type: String, required: true },
  characterName: { type: String, default: 'Unknown' },
  race:          { type: String, default: '' },
  archetype:     { type: String, default: '' },
  tier:          { type: String, default: '' },
  wave:          { type: Number, required: true },
  achievedAt:    { type: Date, default: Date.now },
})

EndlessScoreSchema.index({ wave: -1 })
EndlessScoreSchema.index({ userId: 1, wave: -1 })

export const EndlessScore = mongoose.model<IEndlessScore>('EndlessScore', EndlessScoreSchema)
