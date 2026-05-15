# Wallet and Money Request System - Implementation Guide

## Overview

This document describes the complete implementation of the Wallet and Money Request system for the Darlyn Alt mobile application. The system allows workers to request money for materials or wages, enables negotiation between workers and admins, and handles automatic fund transfers upon approval.

## Features Implemented

### 1. Wallet System
- **Balance Display**: Shows current wallet balance in Nigerian Naira (₦)
- **Fund Wallet** (Admin only): Admins can add funds to their wallet
- **Withdraw Funds**: Both admins and workers can withdraw to bank accounts
- **Transaction History**: Complete history of all wallet transactions with status indicators

### 2. Money Request Types

#### Material Requests
- Workers can list multiple items with name, quantity, and price
- Automatic total calculation
- Supports negotiation between worker and admin
- Back-and-forth negotiation until both parties agree
- Admin can approve, reject, or negotiate

#### Wage/Salary Requests
- Workers can request once per day
- Worker proposes an amount
- Admin sets the final approval amount
- No negotiation - direct approve/reject only

### 3. Request Management
- **For Workers**: View all their requests with status tracking
- **For Admins**: Manage all incoming requests from all workers
- **Status Tracking**: pending, negotiating, approved, rejected
- **Negotiation History**: Complete message thread for material requests

## File Structure

```
src/
├── screens/
│   ├── WalletScreen.tsx              # Wallet balance, fund, withdraw
│   ├── MoneyRequestScreen.tsx        # Create new money requests
│   ├── RequestListScreen.tsx         # Worker's request history
│   ├── RequestDetailsScreen.tsx      # View/negotiate individual requests
│   └── RequestManagementScreen.tsx   # Admin request management dashboard
├── navigation/
│   ├── AppNavigator.tsx              # Updated with new stack screens
│   ├── Tabs.tsx                      # Updated with Wallet and Requests tabs
│   └── types.ts                      # Updated navigation types
└── utils/
    └── api.ts                        # API configuration (already exists)
```

## Navigation Structure

### Tab Navigation

**Admin (Customer) Tabs:**
1. Home
2. Jobs
3. Invoices
4. Wallet
5. Requests (Management)
6. Chat
7. Profile

**Worker Tabs:**
1. Home
2. Wallet
3. Requests (List)
4. Chat
5. Profile

### Stack Navigation
- `MoneyRequest` - Create new request screen
- `RequestDetails` - View and interact with specific request

## API Endpoints Required

The following backend endpoints need to be implemented:

### Wallet Endpoints

```typescript
// Get wallet balance and transactions
GET /wallet
Response: {
  balance: number;
  transactions: Transaction[];
}

// Fund wallet (Admin only)
POST /wallet/fund
Body: { amount: number }
Response: { success: boolean; newBalance: number }

// Withdraw funds
POST /wallet/withdraw
Body: { amount: number; bankAccount: string }
Response: { success: boolean; message: string }
```

### Money Request Endpoints

```typescript
// Create new money request
POST /money-requests
Body: {
  type: 'material' | 'wage';
  // For material requests:
  items?: Array<{ name: string; quantity: number; price: number }>;
  totalAmount?: number;
  description?: string;
  // For wage requests:
  requestedAmount?: number;
  description?: string;
}
Response: { _id: string; status: string; ... }

// Get all requests (filtered by user role)
GET /money-requests
Response: MoneyRequest[]

// Get specific request details
GET /money-requests/:id
Response: MoneyRequest

// Approve request (Admin only)
PUT /money-requests/:id/approve
Body: { approvedAmount?: number }
Response: { success: boolean; message: string }

// Reject request (Admin only)
PUT /money-requests/:id/reject
Response: { success: boolean; message: string }

// Send negotiation message (Material requests only)
POST /money-requests/:id/negotiate
Body: { message: string; proposedAmount?: number }
Response: { success: boolean; negotiation: NegotiationMessage }

// Accept negotiation terms
POST /money-requests/:id/accept-negotiation
Response: { success: boolean; message: string }
```

## Data Models

### Transaction
```typescript
interface Transaction {
  _id: string;
  type: 'credit' | 'debit' | 'withdrawal' | 'deposit';
  amount: number;
  description: string;
  createdAt: string;
  status: 'pending' | 'completed' | 'failed';
}
```

### MoneyRequest
```typescript
interface MoneyRequest {
  _id: string;
  type: 'material' | 'wage';
  status: 'pending' | 'approved' | 'rejected' | 'negotiating';
  worker: {
    _id: string;
    name: string;
    email: string;
  };
  // Material request fields
  items?: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
  totalAmount?: number;
  // Wage request fields
  requestedAmount?: number;
  approvedAmount?: number;
  // Common fields
  description?: string;
  negotiations?: NegotiationMessage[];
  createdAt: string;
  updatedAt: string;
}
```

### NegotiationMessage
```typescript
interface NegotiationMessage {
  _id: string;
  sender: 'worker' | 'admin';
  message: string;
  proposedAmount?: number;
  createdAt: string;
}
```

## Business Logic

### Material Request Flow
1. Worker creates request with list of materials
2. Request status: `pending`
3. Admin can:
   - **Approve**: Funds transfer automatically, status → `approved`
   - **Reject**: Status → `rejected`
   - **Negotiate**: Send counter-offer, status → `negotiating`
4. During negotiation:
   - Both parties can send messages with proposed amounts
   - Either party can accept terms
   - Admin can approve at any time
5. Upon approval:
   - Funds deducted from admin wallet
   - Funds added to worker wallet
   - Transaction records created for both parties

### Wage Request Flow
1. Worker creates wage request (once per day limit)
2. Request status: `pending`
3. Admin reviews and:
   - Sets approval amount (can differ from requested)
   - Approves or rejects
4. Upon approval:
   - Funds transfer automatically
   - Status → `approved`
5. No negotiation allowed for wage requests

### Wallet Operations

#### Fund Wallet (Admin Only)
- Admin adds funds to their wallet
- Creates a `deposit` transaction
- Balance increases immediately

#### Withdraw Funds
- User requests withdrawal to bank account
- Creates a `withdrawal` transaction with `pending` status
- Backend processes withdrawal
- Status updates to `completed` or `failed`

## UI/UX Features

### Color Coding
- **Approved**: Green (#4ade80)
- **Rejected**: Red (#f87171)
- **Negotiating**: Yellow (#fbbf24)
- **Pending**: Gray (#6b7280)
- **Primary**: Purple (#7c8bff)

### Status Indicators
- Icon badges for request status
- Color-coded transaction types
- Attention badges for pending actions
- Negotiation message counters

### User Experience
- Pull-to-refresh on all list screens
- Loading states for all async operations
- Empty states with helpful messages
- Confirmation dialogs for destructive actions
- Real-time balance updates after transactions

## Security Considerations

### Backend Requirements
1. **Authentication**: All endpoints require valid JWT token
2. **Authorization**:
   - Workers can only view/create their own requests
   - Admins can view all requests
   - Only admins can approve/reject requests
   - Only admins can fund wallets
3. **Validation**:
   - Verify sufficient admin wallet balance before approval
   - Enforce once-per-day limit for wage requests
   - Validate all amounts are positive numbers
   - Prevent self-approval (if applicable)
4. **Transaction Safety**:
   - Use database transactions for fund transfers
   - Ensure atomic operations (debit + credit together)
   - Handle race conditions for concurrent requests

## Testing Checklist

### Wallet Testing
- [ ] Display correct balance
- [ ] Fund wallet (admin only)
- [ ] Withdraw funds with bank account
- [ ] View transaction history
- [ ] Handle insufficient balance errors
- [ ] Refresh wallet data

### Material Request Testing
- [ ] Create request with multiple items
- [ ] Calculate total correctly
- [ ] Submit request successfully
- [ ] Admin can view request
- [ ] Admin can approve request
- [ ] Admin can reject request
- [ ] Admin can send negotiation
- [ ] Worker can respond to negotiation
- [ ] Worker can accept negotiation
- [ ] Funds transfer on approval
- [ ] View negotiation history

### Wage Request Testing
- [ ] Create wage request
- [ ] Enforce once-per-day limit
- [ ] Admin can set approval amount
- [ ] Admin can approve/reject
- [ ] No negotiation option available
- [ ] Funds transfer on approval

### Navigation Testing
- [ ] Wallet tab visible for both roles
- [ ] Requests tab shows correct screen per role
- [ ] Navigate to create request
- [ ] Navigate to request details
- [ ] Back navigation works correctly

## Future Enhancements

1. **Push Notifications**
   - Notify worker when request is approved/rejected
   - Notify admin when new request is submitted
   - Notify both parties on negotiation messages

2. **Request Templates**
   - Save frequently requested materials
   - Quick request creation from templates

3. **Analytics Dashboard**
   - Total requests per worker
   - Average approval time
   - Most requested materials
   - Wallet balance trends

4. **Bulk Operations**
   - Approve multiple requests at once
   - Export request history

5. **Payment Integration**
   - Direct bank account linking
   - Automated withdrawal processing
   - Payment gateway integration for wallet funding

## Troubleshooting

### Common Issues

**Issue**: Requests not showing up
- Check API endpoint is correct
- Verify authentication token is valid
- Check user role permissions

**Issue**: Funds not transferring
- Verify admin has sufficient balance
- Check backend transaction logic
- Review error logs

**Issue**: Navigation errors
- Ensure all screens are properly imported
- Check navigation types match screen names
- Verify stack navigator includes all screens

## Support

For backend implementation questions or issues, coordinate with the backend team to ensure:
1. All API endpoints match the specifications
2. Response formats match the TypeScript interfaces
3. Error messages are user-friendly
4. Transaction safety is properly implemented

---

**Last Updated**: May 15, 2026
**Version**: 1.0.0
**Author**: Kiro AI Assistant
