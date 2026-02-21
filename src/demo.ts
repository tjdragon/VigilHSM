import { VigilHSMVault } from './VigilHSMVault';
import { VigilHSMPKCS11 } from './VigilHSMPKCS11';
import { IVigilHSM } from './IVigilHSM';

async function testHSM(hsm: IVigilHSM, name: string) {
    console.log(`\n--- Testing ${name} ---`);
    const keyLabel = `demo-key-${Date.now()}`;
    const payload = 'Hello from VigilHSM!';

    try {
        await hsm.initialize();
        console.log('✅ Initialized successfully');

        await hsm.generateKeyPair(keyLabel);
        console.log(`✅ Key pair generated: ${keyLabel}`);

        const signature = await hsm.sign(keyLabel, payload);
        console.log(`✅ Payload signed, signature length: ${signature.length}`);
        // console.log(`   Signature: ${signature}`);

        const isValid = await hsm.verify(keyLabel, payload, signature);
        console.log(`✅ Signature verified: ${isValid}`);

        await hsm.deleteKeyPair(keyLabel);
        console.log('✅ Key pair deleted');

        await hsm.close();
        console.log('✅ Connection closed');
    } catch (error: any) {
        console.error(`❌ Error testing ${name}:`, error.message);
    }
}

async function main() {
    console.log('Starting HSM Abstraction Demo...');

    // 1. Test HashiCorp Vault Implementation
    const vaultHSM = new VigilHSMVault({
        endpoint: 'http://127.0.0.1:8200',
        token: 'dev-token'
    });

    await testHSM(vaultHSM, 'HashiCorp Vault HSM');

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

    await testHSM(pkcs11HSM, 'SoftHSM2 (PKCS#11)');
}

main().catch(console.error);
