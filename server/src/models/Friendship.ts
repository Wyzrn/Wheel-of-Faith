import mongoose, { Schema, Document } from 'mongoose'

export interface IFriendship extends Document {
  requesterId: mongoose.Types.ObjectId
  recipientId: mongoose.Types.ObjectId
  status: 'pending' | 'accepted'
  createdAt: Date
}

const FriendshipSchema = new Schema<IFriendship>({
  requesterId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  recipientId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  status:      { type: String, enum: ['pending', 'accepted'], default: 'pending' },
  createdAt:   { type: Date, default: Date.now },
})

FriendshipSchema.index({ requesterId: 1, recipientId: 1 }, { unique: true })

export const Friendship = mongoose.model<IFriendship>('Friendship', FriendshipSchema)
