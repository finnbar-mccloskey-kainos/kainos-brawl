export type KnockbackProfile = { base: number; scaling: number; };

export default interface Attackable {
    attack(damage: number, knockback: { x: number, y: number; }, stunTime: number, knockbackProfile?: KnockbackProfile): boolean;
}

export function isAttackable(entity: any): entity is Attackable {
    return typeof entity.attack === "function";
}