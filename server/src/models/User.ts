import mongoose, { Schema, Document } from 'mongoose'
import bcrypt from 'bcryptjs'

export interface IUser extends Document {
  username: string
  email?: string
  passwordHash?: string
  googleId?: string
  avatarUrl?: string
  rivalsWins: number
  rivalsLosses: number
  gamesPlayed: number
  createdAt: Date
  comparePassword(plain: string): Promise<boolean>
}

const UserSchema = new Schema<IUser>({
  username:     { type: String, required: true, unique: true, trim: true, minlength: 3, maxlength: 24 },
  email:        { type: String, unique: true, sparse: true, lowercase: true, trim: true },
  passwordHash: { type: String },
  googleId:     { type: String, unique: true, sparse: true },
  avatarUrl:    { type: String },
  rivalsWins:   { type: Number, default: 0 },
  rivalsLosses: { type: Number, default: 0 },
  gamesPlayed:  { type: Number, default: 0 },
  createdAt:    { type: Date, default: Date.now },
})

UserSchema.methods.comparePassword = async function (plain: string): Promise<boolean> {
  if (!this.passwordHash) return false
  return bcrypt.compare(plain, this.passwordHash)
}

export const User = mongoose.model<IUser>('User', UserSchema)
