# Migration Script: Old Architecture to SOLID Architecture

This script provides step-by-step instructions to migrate from the old monolithic architecture to the new SOLID-based architecture.

## Phase 1: Setup New Directory Structure

```bash
# Create new directory structure
mkdir -p src/{interfaces,services,contexts,components,pages,container,config}

# Move existing files to new structure
mv utils/walletContext.js src/contexts/WalletContext.js
mv utils/web3.js src/services/Web3Service.js
mv pages/index.js src/pages/HomePage.js
mv components/* src/components/
```

## Phase 2: Update Package.json

```json
{
  "scripts": {
    "migrate": "node scripts/migrate.js",
    "test:solid": "jest --config jest.solid.config.js",
    "build:solid": "next build",
    "dev:solid": "next dev"
  }
}
```

## Phase 3: Update Import Statements

### 3.1 Update _app.js

```javascript
// Old
import { WalletProvider } from '../utils/walletContext';

// New
import { WalletProvider } from '../src/contexts/WalletContext';
```

### 3.2 Update All Component Files

```javascript
// Old
import { useWallet } from '../utils/walletContext';
import web3Service from '../utils/web3';

// New
import { useWallet } from '../src/contexts/WalletContext';
// web3Service is now available through useWallet hook
```

### 3.3 Update Page Files

```javascript
// Old
import { useWallet } from '../utils/walletContext';

// New
import { useWallet } from '../src/contexts/WalletContext';
```

## Phase 4: Update Component Usage

### 4.1 Update Investment Logic

```javascript
// Old
const handleInvestment = async () => {
  const tx = await web3Service.invest(investmentAmount);
  // ... rest of logic
};

// New
const { web3Service } = useWallet();
const handleInvestment = async (amount) => {
  const tx = await web3Service.invest(amount);
  // ... rest of logic
};
```

### 4.2 Update Balance Checking

```javascript
// Old
const balance = await web3Service.getEthBalance(account);

// New
const { web3Service } = useWallet();
const balance = await web3Service.getEthBalance(account);
```

## Phase 5: Update Network Configuration

### 5.1 Use Constants

```javascript
// Old
const expectedChainId = '0xaa36a7';

// New
import { NETWORK_CONFIG } from '../src/config/constants';
const expectedChainId = NETWORK_CONFIG.SEPOLIA.chainId;
```

### 5.2 Use Error Messages

```javascript
// Old
setError('MetaMask не установлен');

// New
import { ERROR_MESSAGES } from '../src/config/constants';
setError(ERROR_MESSAGES.METAMASK_NOT_INSTALLED);
```

## Phase 6: Test Migration

### 6.1 Run Tests

```bash
# Test new architecture
npm run test:solid

# Test build
npm run build:solid

# Test development server
npm run dev:solid
```

### 6.2 Verify Functionality

- [ ] Wallet connection works
- [ ] Network switching works
- [ ] Balance checking works
- [ ] Contract interactions work
- [ ] Investment process works

## Phase 7: Cleanup Old Files

```bash
# Remove old files after successful migration
rm -rf utils/walletContext.js
rm -rf utils/web3.js
rm -rf pages/index.js

# Keep backup for reference
mkdir backup
mv utils backup/
mv pages/index.js backup/
```

## Phase 8: Update Documentation

### 8.1 Update README.md

```markdown
# DEFIMON Investment Platform

This project follows SOLID architecture principles. See [SOLID_ARCHITECTURE_README.md](./SOLID_ARCHITECTURE_README.md) for details.

## Quick Start

```bash
npm install
npm run dev:solid
```
```

### 8.2 Update Component Documentation

```javascript
/**
 * InvestmentForm Component
 * 
 * Single Responsibility: Handle investment form logic
 * Dependencies: hasValidContracts, onInvestment, loading, amount, onAmountChange
 * 
 * @param {boolean} hasValidContracts - Whether contracts are deployed
 * @param {function} onInvestment - Investment handler function
 * @param {boolean} loading - Loading state
 * @param {string} amount - Investment amount
 * @param {function} onAmountChange - Amount change handler
 */
```

## Phase 9: Performance Optimization

### 9.1 Add Service Caching

```javascript
// In Web3FacadeService
class Web3FacadeService {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 30000; // 30 seconds
  }

  async getContractInfo() {
    const cacheKey = 'contractInfo';
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }

    const data = await this.contractService.getContractInfo();
    this.cache.set(cacheKey, { data, timestamp: Date.now() });
    return data;
  }
}
```

### 9.2 Add Error Boundaries

```javascript
// Create error boundary component
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <h1>Something went wrong. Please refresh the page.</h1>;
    }

    return this.props.children;
  }
}
```

## Phase 10: Final Verification

### 10.1 Checklist

- [ ] All imports updated
- [ ] All components migrated
- [ ] All functionality working
- [ ] Tests passing
- [ ] Build successful
- [ ] Documentation updated
- [ ] Performance optimized
- [ ] Error handling improved

### 10.2 Rollback Plan

If issues arise, rollback to backup:

```bash
# Restore backup
cp -r backup/* ./
git checkout HEAD -- utils/ pages/
```

## Troubleshooting

### Common Issues

1. **Import Errors**: Ensure all paths are correct
2. **Service Not Found**: Check service container registration
3. **Context Errors**: Verify WalletProvider wrapping
4. **Build Errors**: Check TypeScript/ESLint configuration

### Debug Commands

```bash
# Check service registration
console.log(serviceContainer.services);

# Check service instances
console.log(serviceContainer.singletons);

# Debug wallet context
console.log(useWallet());
```

## Conclusion

This migration transforms the codebase from a monolithic structure to a maintainable, testable, and extensible SOLID architecture. The benefits include:

- **Better code organization**
- **Easier testing**
- **Simple extension**
- **Professional structure**
- **Industry best practices**

After successful migration, the codebase will be ready for future enhancements and maintainable by any development team.
