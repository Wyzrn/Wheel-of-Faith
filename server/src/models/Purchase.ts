import mongoose, { Schema, Document } from 'mongoose'

export type PurchaseType = 'shard_pack' | 'gamepass'
export type PurchaseStatus = 'pending' | 'completed' | 'failed'

export interface IPurchase extends Document {
  userId: mongoose.Types.ObjectId
  stripeSessionId: string
  stripePaymentIntentId?: string
  type: PurchaseType
  productId: string          // shard pack ID or gamepass ID
  shardsAwarded: number      // 0 for gamepasses
  priceUsd: number           // in cents
  status: PurchaseStatus
  createdAt: Date
  completedAt?: Date
}

const PurchaseSchema = new Schema<IPurchase>({
  userId:                 { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  stripeSessionId:        { type: String, required: true, unique: true },
  stripePaymentIntentId:  { type: String },
  type:                   { type: String, enum: ['shard_pack', 'gamepass'], required: true },
  productId:              { type: String, required: true },
  shardsAwarded:          { type: Number, default: 0 },
  priceUsd:               { type: Number, required: true },
  status:                 { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' },
  createdAt:              { type: Date, default: Date.now },
  completedAt:            { type: Date },
})

export const Purchase = mongoose.model<IPurchase>('Purchase', PurchaseSchema)
