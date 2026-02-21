import NodeVault from 'node-vault';
import { IVigilHSM, KeyAlgorithm } from './IVigilHSM';

export interface VaultConfig {
    endpoint: string;
    token: string;
}

/**
 * VigilHSM implementation using HashiCorp Vault Transit Secrets Engine.
 * 
 * This class provides the exact same API as the PKCS#11 implementation, 
 * but routes the cryptographic operations (generate, sign, verify) to Vault.
 */
export class VigilHSMVault implements IVigilHSM {
    private config: VaultConfig;
    private vault: NodeVault.client;
    private initialized: boolean = false;

    constructor(config: VaultConfig) {
        this.config = config;
        this.vault = NodeVault({
            apiVersion: 'v1',
            endpoint: this.config.endpoint,
            token: this.config.token,
        });
    }

    public async initialize(): Promise<void> {
        if (this.initialized) return;

        try {
            // Check health to verify connection
            await this.vault.health();
            this.initialized = true;
        } catch (error: any) {
            throw new Error(`Failed to initialize Vault connection: ${error.message}`);
        }
    }

    public isInitialized(): boolean {
        return this.initialized;
    }

    public async generateKeyPair(keyLabel: string, algorithm: KeyAlgorithm = 'ed25519'): Promise<{ publicKey: string; keyId: string }> {
        await this.initialize();

        let vaultType: string;
        switch (algorithm) {
            case 'rsa':
                vaultType = 'rsa-2048';
                break;
            case 'ecdsa':
                vaultType = 'ecdsa-p256';
                break;
            case 'ed25519':
                vaultType = 'ed25519';
                break;
            default:
                throw new Error(`Unsupported algorithm: ${algorithm}`);
        }

        try {
            // Create a named key in Vault Transit engine
            await this.vault.write(`transit/keys/${keyLabel}`, {
                type: vaultType,
                exportable: true // Allows us to retrieve the public key
            });

            // Generate a synthetic ID similar to the PKCS#11 behavior
            const keyId = Buffer.from(Date.now().toString()).toString('hex');

            // Read back the public key to return it
            const pubKeyInfo = await this.vault.read(`transit/keys/${keyLabel}`);
            const keys = pubKeyInfo.data.keys;
            const latestVersion = Math.max(...Object.keys(keys).map(Number));
            const pubKey = keys[latestVersion].public_key;

            // Convert PEM/Base64 to hex to match PKCS#11 behavior format if needed
            // For RSA/ECDSA, Vault returns PEM strings. 
            // We'll keep it as simple hex for consistent interface if possible, or just return the raw string.
            const publicKeyHex = Buffer.from(pubKey).toString('hex');

            return {
                publicKey: publicKeyHex,
                keyId
            };
        } catch (error: any) {
            throw new Error(`Failed to generate key pair in Vault: ${error.message}`);
        }
    }

    public async sign(keyLabel: string, payload: string, _algorithm?: KeyAlgorithm): Promise<string> {
        await this.initialize();

        // Vault Transit requires base64 encoded input
        const base64Payload = Buffer.from(payload).toString('base64');

        try {
            const response = await this.vault.write(`transit/sign/${keyLabel}`, {
                input: base64Payload
            });

            // Return Vault's signature string (looks like 'vault:v1:base64...')
            return response.data.signature;
        } catch (error: any) {
            throw new Error(`Failed to sign with Vault: ${error.message}`);
        }
    }

    public async verify(keyLabel: string, payload: string, signature: string, _algorithm?: KeyAlgorithm): Promise<boolean> {
        await this.initialize();

        const base64Payload = Buffer.from(payload).toString('base64');

        try {
            const response = await this.vault.write(`transit/verify/${keyLabel}`, {
                input: base64Payload,
                signature: signature // Passing back the exact 'vault:v1:...' string
            });

            return response.data.valid === true;
        } catch (error: any) {
            return false;
        }
    }

    public async deleteKeyPair(keyLabel: string): Promise<void> {
        await this.initialize();

        try {
            // Vault requires keys to specifically allow deletion
            await this.vault.write(`transit/keys/${keyLabel}/config`, {
                deletion_allowed: true
            });

            await this.vault.delete(`transit/keys/${keyLabel}`);
        } catch (error: any) {
            throw new Error(`Failed to delete key pair in Vault: ${error.message}`);
        }
    }

    public async close(): Promise<void> {
        this.initialized = false;
        // Node Vault client doesn't require explicit teardown
    }
}
