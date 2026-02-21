

export interface IVigilHSM {
    initialize(): Promise<void>;
    isInitialized(): boolean;
    generateKeyPair(keyLabel: string): Promise<{ publicKey: string; keyId: string }>;
    sign(keyLabel: string, payload: string): Promise<string>;
    verify(keyLabel: string, payload: string, signature: string): Promise<boolean>;
    deleteKeyPair(keyLabel: string): Promise<void>;
    close(): Promise<void>;
}
