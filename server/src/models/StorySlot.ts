import mongoose, { Schema, type Document } from 'mongoose'

export interface IStorySlot extends Document {
  shareId: string
  userId?: mongoose.Types.ObjectId
  slotData: object
  created_at: Date
}

const StorySlotSchema = new Schema<IStorySlot>({
  shareId:   { type: String, required: true, unique: true, index: true },
  userId:    { type: Schema.Types.ObjectId, ref: 'User', index: true, sparse: true },
  slotData:  { type: Schema.Types.Mixed, required: true },
  created_at: { type: Date, default: Date.now },
}, {
  collection: 'story_slots',
  versionKey: false,
})

export const StorySlot = mongoose.model<IStorySlot>('StorySlot', StorySlotSchema)
