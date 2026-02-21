export type KeyAlgorithm = 'rsa' | 'ecdsa' | 'ed25519';

export interface IVigilHSM {
    initialize(): Promise<void>;
    isInitialized(): boolean;
    generateKeyPair(keyLabel: string, algorithm?: KeyAlgorithm): Promise<{ publicKey: string; keyId: string }>;
    sign(keyLabel: string, payload: string, algorithm?: KeyAlgorithm): Promise<string>;
    verify(keyLabel: string, payload: string, signature: string, algorithm?: KeyAlgorithm): Promise<boolean>;
    deleteKeyPair(keyLabel: string): Promise<void>;
    close(): Promise<void>;
}
