# Verification Guide

## Manual Verification

1. Run `docker compose up -d` in the `vault` directory to start Vault.
2. Run `vault/setup-vault.sh` to enable the Transit engine.
3. Install SoftHSM2 (`sudo apt-get install softhsm2` on Linux) and initialize a test token for the PKCS#11 side:
   `softhsm2-util --init-token --slot 0 --label "vigil-token" --so-pin 1234 --pin 1234`
4. Execute `npx ts-node src/demo.ts` to verify that both implementations successfully generate keys, sign payloads, and verify signatures seamlessly.

## CLI Scripts

You can also test individual HSM operations using the provided CLI scripts. Each script accepts a target HSM as its final argument (`vault` or `softhsm`). Defaults to `vault` if not provided.

### 1. Generate Key Pair
```bash
npx ts-node src/generate-key.ts <label> [vault|softhsm]
```
Example: `npx ts-node src/generate-key.ts my-key vault`

### 2. Sign Data
Accepts base64 encoded data to sign.
```bash
npx ts-node src/sign.ts <label> <base64-data> [vault|softhsm]
```
Example: `npx ts-node src/sign.ts my-key SGVsbG8gVmF1bHQh softhsm`

### 3. Verify Signature
Accepts base64 encoded data and the signature returned from the sign step.
```bash
npx ts-node src/verify.ts <label> <base64-data> <signature> [vault|softhsm]
```
Example: `npx ts-node src/verify.ts my-key SGVsbG8gVmF1bHQh <signature> vault`

## How to encode/decode on Ubuntu to/from B64:

```bash
echo -n "Hello World" | base64

echo "SGVsbG8gV29ybGQ=" | base64 --decode
```

## Local Testing

```bash
tj@dragon:~/Code/VigilHSM$ npx ts-node src/generate-key.ts TJ vault
Generating key pair with label: TJ on vault...

✅ Key Generation Successful
Label: TJ
Key ID: 31373731363731303136313230
Public Key (hex): 4d2f47396c4c414458457947686b4f6c684c4738306d6c333865694e6b777843453876364a6f345931456b3d
tj@dragon:~/Code/VigilHSM$ npx ts-node src/sign.ts TJ SGVsbG8K vault
Signing data with key label: TJ on vault...

✅ Signing Successful
Signature: vault:v1:V2NTba6IANa26PNElWwdV0s62wjtOST2qawci8685zAWID4PR67m6daCz9jkTPeGCO6qK+c/Mt73ENJvMyceAg==
tj@dragon:~/Code/VigilHSM$ npx ts-node src/verify.ts TJ SGVsbG8K V2NTba6IANa26PNElWwdV0s62wjtOST2qawci8685zAWID4PR67m6daCz9jkTPeGCO6qK+c/Mt73ENJvMyceAg== vault
Verifying signature for key label: TJ on vault...

❌ Signature is INVALID
tj@dragon:~/Code/VigilHSM$ npx ts-node src/verify.ts TJ SGVsbG8K vault:v1:V2NTba6IANa26PNElWwdV0s62wjtOST2qawci8685zAWID4PR67m6daCz9jkTPeGCO6qK+c/Mt73ENJvMyceAg== vault
Verifying signature for key label: TJ on vault...

✅ Signature is VALID
```
