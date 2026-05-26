// Floating damage indicator event shape — kept in lib/ so multiple battle
// views can produce events without importing each other.
export interface DamageEvent {
  id: number
  x: number
  y: number
  value: number
  kind: 'damage' | 'heal' | 'crit' | 'miss' | 'shield'
}
