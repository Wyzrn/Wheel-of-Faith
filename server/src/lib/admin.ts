import type { FastifyReply } from 'fastify'
import { User } from '../models/User.js'

// Hard-coded developer allowlist. Username comparison is case-insensitive so
// "wyzrn" and "Wyzrn" both unlock admin tools, but the canonical form lives
// here. Adding a developer means adding a new entry to this Set — there is no
// runtime mutation path so a compromised account cannot self-promote.
export const ADMIN_USERNAMES: ReadonlySet<string> = new Set(['wyzrn'])

export function isAdminUsername(username: string | undefined | null): boolean {
  if (!username) return false
  return ADMIN_USERNAMES.has(username.toLowerCase())
}

/** Guard handler: returns true if the caller is an admin, otherwise sends 403
 *  and returns false. Callers should `if (!(await requireAdmin(req, reply))) return`. */
export async function requireAdmin(req: any, reply: FastifyReply): Promise<boolean> {
  if (!req.userId) {
    reply.status(401).send({ error: 'login required' })
    return false
  }
  const user = await User.findById(req.userId).select('username').lean()
  if (!user || !isAdminUsername(user.username)) {
    reply.status(403).send({ error: 'admin only' })
    return false
  }
  return true
}
