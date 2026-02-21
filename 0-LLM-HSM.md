# LLM HSM and HashiCorp

- Use /home/tj/Code/Vigil/backend/sources/core/security/VigilHSMPKCS11.ts as a template for a PKCS#11 HSM implementation
- Use HashiCorp Vault to abstract VigilHSMPKCS11
- The idea is that I interface with HashiCorp Vault, which then interfaces with the HSM so that I can subsitute the VigilHSMPKCS11 with another PKCS11 compliant HSM for ex.
- The code needs to be written in TypeScript
- Show me how to run both the Vault and PKCS11 implementation
- Any question just ask