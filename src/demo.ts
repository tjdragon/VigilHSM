import { VigilHSMVault } from './VigilHSMVault';
import { VigilHSMPKCS11 } from './VigilHSMPKCS11';
import { IVigilHSM, KeyAlgorithm } from './IVigilHSM';

async function testHSM(hsm: IVigilHSM, name: string, algorithm: KeyAlgorithm) {
    console.log(`\n--- Testing ${name} (${algorithm}) ---`);
    const keyLabel = `demo-key-${algorithm}-${Date.now()}`;
    const payload = 'Hello from VigilHSM!';

    try {
        await hsm.initialize();
        console.log('✅ Initialized successfully');

        await hsm.generateKeyPair(keyLabel, algorithm);
        console.log(`✅ Key pair generated: ${keyLabel}`);

        const signature = await hsm.sign(keyLabel, payload, algorithm);
        console.log(`✅ Payload signed, signature length: ${signature.length}`);

        const isValid = await hsm.verify(keyLabel, payload, signature, algorithm);
        console.log(`✅ Signature verified: ${isValid}`);

        await hsm.deleteKeyPair(keyLabel);
        console.log('✅ Key pair deleted');

        await hsm.close();
        console.log('✅ Connection closed');
    } catch (error: any) {
        console.error(`❌ Error testing ${name} (${algorithm}):`, error.message);
    }
}

async function main() {
    console.log('Starting HSM Abstraction Demo (Multi-Algorithm Support)...');

    const algorithms: KeyAlgorithm[] = ['rsa', 'ecdsa'];

    // 1. Test HashiCorp Vault Implementation
    const vaultHSM = new VigilHSMVault({
        endpoint: 'http://127.0.0.1:8200',
        token: 'dev-token'
    });

    for (const alg of algorithms) {
        await testHSM(vaultHSM, 'HashiCorp Vault HSM', alg);
    }

    // 2. Test SoftHSM2 (PKCS11) Implementation
    if (!process.env.SOFTHSM2_CONF) {
        process.env.SOFTHSM2_CONF = require('path').resolve(__dirname, '../softhsm2.conf');
    }

    const pkcs11Path = process.platform === 'darwin'
        ? '/opt/homebrew/lib/softhsm/libsofthsm2.so'
        : '/usr/lib/softhsm/libsofthsm2.so';

    const pkcs11HSM = new VigilHSMPKCS11({
        libraryPath: pkcs11Path,
        tokenLabel: 'vigil-token',
        pin: '1234'
    });

    for (const alg of algorithms) {
        await testHSM(pkcs11HSM, 'SoftHSM2 (PKCS#11)', alg);
    }
}

main().catch(console.error);
