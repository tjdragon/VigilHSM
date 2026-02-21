#!/bin/bash

# Configuration
export VAULT_ADDR='http://127.0.0.1:8200'
export VAULT_TOKEN='dev-token'

# Wait for Vault to start properly
sleep 2

# Enable Transit secrets engine
docker compose exec -e VAULT_ADDR='http://127.0.0.1:8200' -e VAULT_TOKEN='dev-token' vault vault secrets enable transit

echo "HashiCorp Vault Transit engine has been enabled!"
echo "Vault is ready to process HSM operations."
