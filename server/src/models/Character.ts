import mongoose, { Schema, type Document, type Query, type Types } from 'mongoose'

export interface ICharacter extends Document {
  shareId: string
  userId?: mongoose.Types.ObjectId  // linked user (optional — anonymous saves allowed)
  name: string
  race: string
  archetype: string
  overall_score: number
  overall_tier: string
  spins: object              // full SpinResult[] JSON blob
  session_started_at: Date
  created_at: Date
  deleted_at: Date | null
  share_in_gallery: boolean
  rivals_wins: number
  elementWeaknesses: string[]  // elemental weakness tags (e.g. ['Fire', 'Ice'])
  // R2-hosted AI-generated portrait URL. null until POST /characters/:shareId/portrait
  // succeeds; the card and battle UIs fall back to the letter sigil while null.
  portraitUrl: string | null
  // Timestamp of the one allowed regenerate. Stays null until the owner uses
  // the "Regenerate portrait" button — once set, the endpoint rejects further
  // regenerate requests with 409.
  portraitRegeneratedAt: Date | null
}

const CharacterSchema = new Schema<ICharacter>({
  shareId:             { type: String, required: true, unique: true, index: true },
  userId:              { type: Schema.Types.ObjectId, ref: 'User', index: true, sparse: true },
  name:                { type: String, required: true },
  race:                { type: String, required: true, index: true },
  archetype:           { type: String, required: true, index: true },
  overall_score:       { type: Number, required: true, index: true },
  overall_tier:        { type: String, required: true },
  spins:               { type: Schema.Types.Mixed, required: true },
  session_started_at:  { type: Date, required: true },
  created_at:          { type: Date, default: Date.now },
  deleted_at:          { type: Date, default: null, index: true },
  share_in_gallery:    { type: Boolean, default: false },
  rivals_wins:         { type: Number, default: 0 },
  elementWeaknesses:   { type: [String], default: [], index: true },
  portraitUrl:         { type: String, default: null },
  portraitRegeneratedAt: { type: Date, default: null },
}, {
  collection: 'characters',
  versionKey: false,
})

// Soft-delete: exclude deleted documents from all find queries
// eslint-disable-next-line @typescript-eslint/no-explicit-any
CharacterSchema.pre(/^find/, function (this: Query<any, any>) {
  this.where({ deleted_at: null })
})

export const Character = mongoose.model<ICharacter>('Character', CharacterSchema)
