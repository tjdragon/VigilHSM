import { getHSM } from './utils';

async function main() {
    const label = process.argv[2];
    const hsmType = (process.argv[3] || 'vault') as 'vault' | 'softhsm';

    if (!label) {
        console.error('Usage: npx ts-node src/generate-key.ts <label> [vault|softhsm]');
        process.exit(1);
    }

    const hsm = getHSM(hsmType);

    try {
        await hsm.initialize();
        console.log(`Generating key pair with label: ${label} on ${hsmType}...`);

        const result = await hsm.generateKeyPair(label);

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
