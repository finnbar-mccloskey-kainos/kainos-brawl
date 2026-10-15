export default interface Attackable {
    attack(damage: number, knockback: { x: number, y: number; }, stunTime: number): boolean;
}

export function isAttackable(entity: any): entity is Attackable {
    return typeof entity.attack === "function";
}