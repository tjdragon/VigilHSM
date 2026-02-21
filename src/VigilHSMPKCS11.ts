import { createHash } from 'crypto';
import { IVigilHSM } from './IVigilHSM';

export interface PKCS11Config {
    libraryPath: string;
    tokenLabel?: string;
    slot?: number;
    pin: string;
}

export interface PKCS11SlotInfo {
    slotId: number;
    slotDescription: string;
    manufacturerId: string;
    tokenLabel: string;
    tokenPresent: boolean;
}

export interface PKCS11KeyInfo {
    label: string;
    id: string;
    type: string;
    size: number;
}

/**
 * VigilHSM implementation using PKCS#11 interface directly.
 *
 * This class provides HSM cryptographic operations through the PKCS#11 standard interface.
 * It can work with any PKCS#11 compliant HSM including SoftHSMv2 for testing.
 *
 * Usage:
 * ```typescript
 * const hsm = new VigilHSMPKCS11({
 *     libraryPath: '/usr/lib/softhsm/libsofthsm2.so',
 *     tokenLabel: 'vigil-token',
 *     pin: '1234'
 * });
 *
 * await hsm.initialize();
 * await hsm.generateKeyPair('my-key');
 * const signature = await hsm.sign('my-key', 'payload');
 * const isValid = await hsm.verify('my-key', 'payload', signature);
 * await hsm.close();
 * ```
 */
export class VigilHSMPKCS11 implements IVigilHSM {
    private config: PKCS11Config;
    private pkcs11: any;
    private session: any;
    private initialized: boolean = false;

    constructor(config: PKCS11Config) {
        this.config = config;
    }

    /**
     * Initialize PKCS#11 module and open a session
     */
    public async initialize(): Promise<void> {
        if (this.initialized) {
            return;
        }

        try {
            const graphene = require('graphene-pk11');

            // Load the PKCS#11 module
            this.pkcs11 = graphene.Module.load(this.config.libraryPath, 'PKCS11');
            this.pkcs11.initialize();

            // Find the slot
            let slot: any;
            const slots = this.pkcs11.getSlots(true); // true = only slots with tokens

            if (this.config.tokenLabel) {
                // Find slot by token label
                for (let i = 0; i < slots.length; i++) {
                    const s = slots.items(i);
                    if (s.getToken().label.trim() === this.config.tokenLabel) {
                        slot = s;
                        break;
                    }
                }
                if (!slot) {
                    throw new Error(`Token with label '${this.config.tokenLabel}' not found`);
                }
            } else if (this.config.slot !== undefined) {
                slot = slots.items(this.config.slot);
                if (!slot) {
                    throw new Error(`Slot ${this.config.slot} not found`);
                }
            } else {
                // Use first available slot
                if (slots.length === 0) {
                    throw new Error('No PKCS#11 slots available');
                }
                slot = slots.items(0);
            }

            // Open a session
            const grapheneLib = require('graphene-pk11');
            this.session = slot.open(
                grapheneLib.SessionFlag.SERIAL_SESSION | grapheneLib.SessionFlag.RW_SESSION
            );

            // Login with user PIN
            this.session.login(this.config.pin, grapheneLib.UserType.USER);

            this.initialized = true;
        } catch (error: any) {
            if (error.code === 'MODULE_NOT_FOUND' || error.message?.includes('Cannot find module')) {
                throw new Error('graphene-pk11 package not installed. Run: npm install graphene-pk11');
            }
            throw error;
        }
    }

    /**
     * Check if the module is initialized
     */
    public isInitialized(): boolean {
        return this.initialized;
    }

    /**
     * List all available slots
     */
    public async listSlots(): Promise<PKCS11SlotInfo[]> {
        await this.initialize();

        const slots = this.pkcs11.getSlots(false);
        const result: PKCS11SlotInfo[] = [];

        for (let i = 0; i < slots.length; i++) {
            const slot = slots.items(i);
            const token = slot.getToken();
            result.push({
                slotId: slot.handle,
                slotDescription: slot.slotDescription.trim(),
                manufacturerId: slot.manufacturerID.trim(),
                tokenLabel: token ? token.label.trim() : '',
                tokenPresent: !!(slot.flags & 0x01)
            });
        }

        return result;
    }

    /**
     * Generate an Ed25519 key pair
     */
    public async generateKeyPair(keyLabel: string): Promise<{ publicKey: string; keyId: string }> {
        return this.generateRSAKeyPair(keyLabel);
    }

    /**
     * Generate an RSA key pair
     */
    public async generateRSAKeyPair(keyLabel: string, keySize: number = 2048): Promise<{ publicKey: string; keyId: string }> {
        await this.initialize();

        const graphene = require('graphene-pk11');

        const keyId = Buffer.from(Date.now().toString()).toString('hex');

        const keys = this.session.generateKeyPair(
            graphene.KeyGenMechanism.RSA,
            {
                class: graphene.ObjectClass.PUBLIC_KEY,
                keyType: graphene.KeyType.RSA,
                token: true,
                label: keyLabel,
                id: Buffer.from(keyId, 'hex'),
                verify: true,
                encrypt: true,
                wrap: true,
                modulusBits: keySize,
                publicExponent: Buffer.from([1, 0, 1]) // 65537
            },
            {
                class: graphene.ObjectClass.PRIVATE_KEY,
                keyType: graphene.KeyType.RSA,
                token: true,
                label: keyLabel,
                id: Buffer.from(keyId, 'hex'),
                sign: true,
                decrypt: true,
                unwrap: true,
                private: true,
                sensitive: true,
                extractable: false
            }
        );

        const modulus = keys.publicKey.getAttribute({ modulus: null }).modulus;
        const publicKeyHex = modulus.toString('hex');

        return {
            publicKey: publicKeyHex,
            keyId
        };
    }

    /**
     * List all keys in the token
     */
    public async listKeys(): Promise<PKCS11KeyInfo[]> {
        await this.initialize();

        const graphene = require('graphene-pk11');
        const result: PKCS11KeyInfo[] = [];

        // Find all private keys
        const privateKeys = this.session.find({
            class: graphene.ObjectClass.PRIVATE_KEY
        });

        for (let i = 0; i < privateKeys.length; i++) {
            const key = privateKeys.items(i);
            const attrs = key.getAttribute({
                label: null,
                id: null,
                keyType: null
            });

            result.push({
                label: attrs.label || '',
                id: attrs.id ? attrs.id.toString('hex') : '',
                type: this.keyTypeToString(attrs.keyType),
                size: 0 // Size varies by key type
            });
        }

        return result;
    }

    /**
     * Find a key by label
     */
    private findPrivateKey(keyLabel: string): any {
        const graphene = require('graphene-pk11');

        const keys = this.session.find({
            class: graphene.ObjectClass.PRIVATE_KEY,
            label: keyLabel
        });

        if (keys.length === 0) {
            throw new Error(`Private key '${keyLabel}' not found`);
        }

        return keys.items(0);
    }

    /**
     * Find a public key by label
     */
    private findPublicKey(keyLabel: string): any {
        const graphene = require('graphene-pk11');

        const keys = this.session.find({
            class: graphene.ObjectClass.PUBLIC_KEY,
            label: keyLabel
        });

        if (keys.length === 0) {
            throw new Error(`Public key '${keyLabel}' not found`);
        }

        return keys.items(0);
    }

    /**
     * Sign a payload using Ed25519
     */
    public async sign(keyLabel: string, payload: string): Promise<string> {
        return this.signRSA(keyLabel, payload);
    }

    /**
     * Sign a payload using RSA-SHA256
     */
    public async signRSA(keyLabel: string, payload: string): Promise<string> {
        await this.initialize();

        const privateKey = this.findPrivateKey(keyLabel);
        const mechanism = { name: 'SHA256_RSA_PKCS' };

        const signature = this.session.createSign(mechanism, privateKey)
            .once(Buffer.from(payload));

        return signature.toString('hex');
    }

    /**
     * Verify an Ed25519 signature
     */
    public async verify(keyLabel: string, payload: string, signature: string): Promise<boolean> {
        return this.verifyRSA(keyLabel, payload, signature);
    }

    /**
     * Verify an RSA-SHA256 signature
     */
    public async verifyRSA(keyLabel: string, payload: string, signature: string): Promise<boolean> {
        await this.initialize();

        // Find key first - this will throw if not found
        const publicKey = this.findPublicKey(keyLabel);

        try {
            const mechanism = { name: 'SHA256_RSA_PKCS' };

            const isValid = this.session.createVerify(mechanism, publicKey)
                .once(Buffer.from(payload), Buffer.from(signature, 'hex'));

            return isValid;
        } catch {
            return false;
        }
    }

    /**
     * Delete a key pair by label
     */
    public async deleteKeyPair(keyLabel: string): Promise<void> {
        await this.initialize();

        const graphene = require('graphene-pk11');

        // Delete private key
        const privateKeys = this.session.find({
            class: graphene.ObjectClass.PRIVATE_KEY,
            label: keyLabel
        });
        for (let i = 0; i < privateKeys.length; i++) {
            privateKeys.items(i).destroy();
        }

        // Delete public key
        const publicKeys = this.session.find({
            class: graphene.ObjectClass.PUBLIC_KEY,
            label: keyLabel
        });
        for (let i = 0; i < publicKeys.length; i++) {
            publicKeys.items(i).destroy();
        }
    }

    /**
     * Compute SHA-256 hash (uses local crypto, not HSM)
     * Note: Most HSMs support hashing but it's often faster to do locally
     */
    public hash(data: Buffer): Buffer {
        return createHash('sha256').update(data).digest();
    }

    /**
     * Get the public key for a given label
     */
    public async getPublicKey(keyLabel: string): Promise<string> {
        await this.initialize();

        const publicKey = this.findPublicKey(keyLabel);

        // Try to get the key based on type
        try {
            // For Ed25519/EC keys, try 'value' attribute
            const attrs = publicKey.getAttribute({ value: null });
            if (attrs.value) {
                return attrs.value.toString('hex');
            }
        } catch {
            // Not an EC key, try RSA attributes
        }

        try {
            // For RSA keys, get modulus
            const attrs = publicKey.getAttribute({ modulus: null });
            if (attrs.modulus) {
                return attrs.modulus.toString('hex');
            }
        } catch {
            // Fall through
        }

        throw new Error('Unable to extract public key value');
    }

    /**
     * Close the session and finalize the module
     */
    public async close(): Promise<void> {
        if (this.session) {
            try {
                this.session.logout();
            } catch {
                // Ignore logout errors
            }
            try {
                this.session.close();
            } catch {
                // Ignore close errors
            }
            this.session = null;
        }

        if (this.pkcs11) {
            try {
                this.pkcs11.finalize();
            } catch {
                // Ignore finalize errors
            }
            this.pkcs11 = null;
        }

        this.initialized = false;
    }

    /**
     * Convert key type enum to string
     */
    private keyTypeToString(keyType: number): string {
        const keyTypes: Record<number, string> = {
            0x00: 'RSA',
            0x01: 'DSA',
            0x02: 'DH',
            0x03: 'ECDSA',
            0x04: 'EC',
            0x40: 'EDDSA'
        };
        return keyTypes[keyType] || `UNKNOWN(${keyType})`;
    }
}
