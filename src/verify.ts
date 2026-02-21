import { getHSM } from './utils';

async function main() {
    const label = process.argv[2];
    const base64Data = process.argv[3];
    const signature = process.argv[4];
    const hsmType = (process.argv[5] || 'vault') as 'vault' | 'softhsm';

    if (!label || !base64Data || !signature) {
        console.error('Usage: npx ts-node src/verify.ts <label> <base64-data> <signature> [vault|softhsm]');
        process.exit(1);
    }

    const hsm = getHSM(hsmType);

    try {
        await hsm.initialize();
        console.log(`Verifying signature for key label: ${label} on ${hsmType}...`);

        const payload = Buffer.from(base64Data, 'base64').toString('utf8');

        const isValid = await hsm.verify(label, payload, signature);

        if (isValid) {
            console.log('\n✅ Signature is VALID');
        } else {
            console.log('\n❌ Signature is INVALID');
        }
    } catch (error: any) {
        console.error('❌ Error verifying signature:', error.message);
    } finally {
        await hsm.close();
    }
}

main().catch(console.error);
