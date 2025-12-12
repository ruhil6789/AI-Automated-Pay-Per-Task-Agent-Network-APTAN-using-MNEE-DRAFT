# APTAN Architecture

## System Overview

APTAN is a decentralized AI agent network that combines smart contracts, AI automation, and web3 technologies to create an autonomous task marketplace.

## Components

### 1. Smart Contracts (Solidity)

**APTAN.sol** - Main escrow contract
- Manages task lifecycle
- Handles MNEE token escrow
- Releases payments upon completion
- Emits events for frontend tracking

**MockMNEE.sol** - ERC20 token for testing
- Standard ERC20 implementation
- Mintable for testing purposes

### 2. Backend (Node.js/Express)

**server.js** - Main backend service
- RESTful API endpoints
- SQLite database for task storage
- AI agent polling service
- Blockchain interaction via ethers.js
- OpenAI API integration

**Key Features:**
- Task CRUD operations
- AI agent automation loop
- Blockchain event monitoring
- Database synchronization

### 3. Frontend (React)

**Components:**
- `Navbar` - Wallet connection and navigation
- `Home` - Landing page with features
- `CreateTask` - Task creation form
- `Tasks` - Task listing page
- `TaskDetail` - Individual task view

**Features:**
- MetaMask integration
- Real-time task updates
- Transaction status tracking
- Responsive design

## Data Flow

### Task Creation Flow

```
User → Frontend → MetaMask → Smart Contract
                              ↓
                         Escrow Locked
                              ↓
                         Backend API → Database
```

### Task Completion Flow

```
Backend Polling → Pending Tasks → OpenAI API
                                      ↓
                                 Solution Generated
                                      ↓
                         Smart Contract → Payment Released
                                      ↓
                         Database Updated → Frontend Updated
```

## Security Considerations

1. **Smart Contract Security**
   - Reentrancy protection
   - Access control
   - Input validation
   - Deadline enforcement

2. **Backend Security**
   - Private key management
   - API rate limiting
   - Input sanitization
   - Error handling

3. **Frontend Security**
   - Wallet connection validation
   - Transaction confirmation
   - Error boundaries

## Scalability

- **Database**: SQLite for MVP, can migrate to PostgreSQL
- **Blockchain**: Optimized for gas efficiency
- **AI Agent**: Polling can be replaced with event listeners
- **Frontend**: React optimizations and lazy loading

## Future Improvements

- Multi-chain support
- Layer 2 integration
- Advanced AI models
- Reputation system
- Task verification mechanisms

