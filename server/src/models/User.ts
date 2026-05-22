import mongoose, { Schema, Document } from 'mongoose'
import bcrypt from 'bcryptjs'

export interface IUser extends Document {
  username: string
  email?: string
  passwordHash?: string
  rivalsWins: number
  rivalsLosses: number
  gamesPlayed: number
  shards: number              // account-level purchased shards (separate from slot shards)
  gamepasses: string[]        // owned gamepass IDs; stackable passes appear multiple times
  rerollInsuranceLastUsed?: Date
  createdAt: Date
  comparePassword(plain: string): Promise<boolean>
}

const UserSchema = new Schema<IUser>({
  username:     { type: String, required: true, unique: true, trim: true, minlength: 3, maxlength: 24 },
  email:        { type: String, unique: true, sparse: true, lowercase: true, trim: true },
  passwordHash: { type: String },
  rivalsWins:   { type: Number, default: 0 },
  rivalsLosses: { type: Number, default: 0 },
  gamesPlayed:  { type: Number, default: 0 },
  shards:                    { type: Number, default: 0 },
  gamepasses:                { type: [String], default: [] },
  rerollInsuranceLastUsed:   { type: Date },
  createdAt:                 { type: Date, default: Date.now },
})

UserSchema.index({ rivalsWins: -1 })

UserSchema.methods.comparePassword = async function (plain: string): Promise<boolean> {
  if (!this.passwordHash) return false
  return bcrypt.compare(plain, this.passwordHash)
}

export const User = mongoose.model<IUser>('User', UserSchema)
