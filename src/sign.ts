import { getHSM } from './utils';
import { KeyAlgorithm } from './IVigilHSM';

async function main() {
    const label = process.argv[2];
    const base64Data = process.argv[3];
    const hsmType = (process.argv[4] || 'vault') as 'vault' | 'softhsm';
    const algorithm = (process.argv[5] || 'rsa') as KeyAlgorithm;

    if (!label || !base64Data) {
        console.error('Usage: npx ts-node src/sign.ts <label> <base64-data> [vault|softhsm] [rsa|ecdsa|ed25519]');
        process.exit(1);
    }

    const hsm = getHSM(hsmType);

    try {
        await hsm.initialize();
        console.log(`Signing data with key label: ${label} on ${hsmType} using ${algorithm}...`);

        // The API currently takes a string payload.
        // We can decode the base64 input or just pass it directly.
        // If the data is truly raw binary encoded as base64, we might want to sign the binary data.
        // Since VigilHSM interface currently expects `payload: string`, we'll pass the base64 directly or decode it?
        // Let's decode the base64. Wait, the `demo.ts` just sends "Hello from VigilHSM!".
        // If the user wants to sign base64 data, we can just pass the decoded string, or pass the base64 as the string payload depending on their use case.
        // Let's pass the decoded base64 payload.
        const payload = Buffer.from(base64Data, 'base64').toString('utf8');

        const signature = await hsm.sign(label, payload, algorithm);

        console.log('\n✅ Signing Successful');
        console.log(`Signature: ${signature}`);
    } catch (error: any) {
        console.error('❌ Error signing data:', error.message);
    } finally {
        await hsm.close();
    }
}

main().catch(console.error);
