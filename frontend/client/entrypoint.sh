#!/bin/sh
# frontend/client/entrypoint.sh

echo "Injecting runtime environment variables..."

# Define the list of variables to replace based on src/lib/env.ts
# Corrected: Include navigation URLs and fix potential typo
VARS="NEXT_PUBLIC_API_URL NEXT_PUBLIC_DEBUG NEXT_PUBLIC_ADMIN_URL NEXT_PUBLIC_DOCS_URL"

for varname in $VARS; do
    # Get the value from the environment
    eval varvalue=\$$varname
    
    # Only replace if the value is provided at runtime
    if [ -n "$varvalue" ]; then
        echo "Replacing __${varname}_PLACEHOLDER__ with $varvalue"
        # Search and replace in all relevant files
        find /app/.next -type f \( -name '*.js' -o -name '*.html' -o -name '*.json' \) -exec sed -i "s|__${varname}_PLACEHOLDER__|${varvalue}|g" {} +
        find /app -maxdepth 2 -type f \( -name '*.js' -o -name '*.html' -o -name '*.json' \) -exec sed -i "s|__${varname}_PLACEHOLDER__|${varvalue}|g" {} +
    fi
done

echo "Injection completed."
echo "Starting Next.js..."

# Execute the CMD passed as arguments
exec "$@"
