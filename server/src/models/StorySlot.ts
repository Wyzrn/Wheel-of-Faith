import mongoose, { Schema, type Document } from 'mongoose'

export interface IStorySlot extends Document {
  shareId: string
  userId?: mongoose.Types.ObjectId
  slotData: object
  // `isAutosave` rows are upserted by /story-slots/autosave and there is at
  // most one per (userId, slotId). `share` rows are immutable snapshots
  // created by POST /story-slots — their shareId is a permanent public URL.
  isAutosave: boolean
  // Logical slot id (1..4) — only meaningful for autosave rows so the upsert
  // can target the right one. Share rows leave it undefined.
  slotId?: number
  created_at: Date
  updated_at: Date
}

const StorySlotSchema = new Schema<IStorySlot>({
  shareId:   { type: String, required: true, unique: true, index: true },
  userId:    { type: Schema.Types.ObjectId, ref: 'User', index: true, sparse: true },
  slotData:  { type: Schema.Types.Mixed, required: true },
  isAutosave: { type: Boolean, default: false, index: true },
  slotId:    { type: Number, min: 1, max: 4 },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
}, {
  collection: 'story_slots',
  versionKey: false,
})

// One autosave row per (userId, slotId). Partial index so it only applies to
// autosave rows — share rows ignore this constraint.
StorySlotSchema.index(
  { userId: 1, slotId: 1 },
  { unique: true, partialFilterExpression: { isAutosave: true } },
)

export const StorySlot = mongoose.model<IStorySlot>('StorySlot', StorySlotSchema)
