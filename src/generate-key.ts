import { getHSM } from './utils';
import { KeyAlgorithm } from './IVigilHSM';

async function main() {
    const label = process.argv[2];
    const hsmType = (process.argv[3] || 'vault') as 'vault' | 'softhsm';
    const algorithm = (process.argv[4] || 'rsa') as KeyAlgorithm;

    if (!label) {
        console.error('Usage: npx ts-node src/generate-key.ts <label> [vault|softhsm] [rsa|ecdsa|ed25519]');
        process.exit(1);
    }

    const hsm = getHSM(hsmType);

    try {
        await hsm.initialize();
        console.log(`Generating key pair with label: ${label} on ${hsmType} using ${algorithm}...`);

        const result = await hsm.generateKeyPair(label, algorithm);

        console.log('\n✅ Key Generation Successful');
        console.log(`Label: ${label}`);
        console.log(`Key ID: ${result.keyId}`);
        console.log(`Public Key (hex): ${result.publicKey}`);
    } catch (error: any) {
        console.error('❌ Error generating key:', error.message);
    } finally {
        await hsm.close();
    }
}

main().catch(console.error);
