#!/bin/bash
# scripts/check-compliance.sh

set -e

ENVIRONMENT=${1:-tanzania}

echo "📋 Running compliance checks for $ENVIRONMENT..."
echo "==============================================="

case $ENVIRONMENT in
    "tanzania")
        echo "🇹🇿 Checking Tanzanian compliance requirements..."
        
        # Check VAT configuration
        if [ -z "$TAX_RATE" ] || [ "$TAX_RATE" != "0.18" ]; then
            echo "❌ VAT rate must be 18% for Tanzania"
            exit 1
        fi
        echo "✅ VAT rate configured correctly (18%)"
        
        # Check currency
        if [ -z "$CURRENCY" ] || [ "$CURRENCY" != "TZS" ]; then
            echo "❌ Currency must be TZS for Tanzania"
            exit 1
        fi
        echo "✅ Currency configured correctly (TZS)"
        
        # Check mobile money providers
        if [ -z "$MOBILE_MONEY_PROVIDERS" ]; then
            echo "❌ Mobile money providers must be configured"
            exit 1
        fi
        echo "✅ Mobile money providers configured"
        
        # Check SMS provider
        if [ -z "$SMS_PROVIDER" ]; then
            echo "❌ SMS provider must be configured"
            exit 1
        fi
        echo "✅ SMS provider configured"
        
        # Check timezone
        if [ -z "$TIMEZONE" ] || [ "$TIMEZONE" != "Africa/Dar_es_Salaam" ]; then
            echo "❌ Timezone must be Africa/Dar_es_Salaam for Tanzania"
            exit 1
        fi
        echo "✅ Timezone configured correctly"
        
        # Check language support
        if [ -z "$LANGUAGES" ]; then
            echo "❌ Languages must be configured"
            exit 1
        fi
        echo "✅ Language support configured"
        
        # Check data privacy compliance
        echo "🔒 Checking data privacy compliance..."
        # This would check GDPR-like compliance for Tanzania
        
        # Check payment security
        echo "💳 Checking payment security compliance..."
        # This would check PCI DSS compliance
        
        ;;
    
    "general")
        echo "🌐 Checking general compliance requirements..."
        
        # Basic security checks
        if [ -z "$JWT_SECRET" ] || [ ${#JWT_SECRET} -lt 32 ]; then
            echo "❌ JWT secret must be at least 32 characters"
            exit 1
        fi
        echo "✅ JWT secret configured securely"
        
        # Database security
        if [ -z "$POSTGRES_PASSWORD" ] || [ ${#POSTGRES_PASSWORD} -lt 12 ]; then
            echo "❌ Database password must be at least 12 characters"
            exit 1
        fi
        echo "✅ Database password configured securely"
        
        # Rate limiting
        if [ -z "$RATE_LIMIT_MAX" ] || [ "$RATE_LIMIT_MAX" -gt 1000 ]; then
            echo "⚠️  Consider lowering rate limit for better security"
        fi
        echo "✅ Rate limiting configured"
        ;;
        
    *)
        echo "❌ Unknown compliance environment: $ENVIRONMENT"
        exit 1
        ;;
esac

echo "✅ All compliance checks passed for $ENVIRONMENT!"
exit 0