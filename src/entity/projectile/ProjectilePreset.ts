export default interface ProjectilePreset {
    get damage(): number;
    get knockback(): number;
    get stunTime(): number;
    get maxLifetime(): number;
    get drag(): number;
    get gravity(): number;
}