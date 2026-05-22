import mongoose, { Schema, Document } from 'mongoose'

export interface IClan extends Document {
  name: string
  tag: string
  description: string
  leaderId: mongoose.Types.ObjectId
  memberIds: mongoose.Types.ObjectId[]
  createdAt: Date
}

const ClanSchema = new Schema<IClan>({
  name:        { type: String, required: true, unique: true, trim: true, minlength: 3, maxlength: 32 },
  tag:         { type: String, required: true, unique: true, trim: true, minlength: 2, maxlength: 5, uppercase: true },
  description: { type: String, default: '', maxlength: 200 },
  leaderId:    { type: Schema.Types.ObjectId, ref: 'User', required: true },
  memberIds:   { type: [Schema.Types.ObjectId], ref: 'User', default: [] },
  createdAt:   { type: Date, default: Date.now },
})

ClanSchema.index({ name: 1 })

export const Clan = mongoose.model<IClan>('Clan', ClanSchema)
