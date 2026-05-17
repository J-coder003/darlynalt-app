import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useSelector } from 'react-redux';
import Icon from 'react-native-vector-icons/Ionicons';
import { RootState } from '../store/store';
import api, { bankAccountsAPI } from '../utils/api';

interface Transaction {
  _id: string;
  type: 'credit' | 'debit' | 'withdrawal' | 'deposit';
  amount: number;
  description: string;
  createdAt: string;
  status: 'pending' | 'completed' | 'failed';
}

interface WalletData {
  balance: number;
  transactions: Transaction[];
}

export default function WalletScreen() {
  const user = useSelector((state: RootState) => state.auth.user);
  const [wallet, setWallet] = useState<WalletData>({ balance: 0, transactions: [] });
  const [loading, setLoading] = useState(true);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [amount, setAmount] = useState('');
  const [processing, setProcessing] = useState(false);

  const [banks, setBanks] = useState<{ name: string; code: string; slug: string }[]>([]);
  const [savedAccounts, setSavedAccounts] = useState<{
    _id: string;
    accountNumber: string;
    accountName: string;
    bankName: string;
    bankCode: string;
    isPrimary: boolean;
  }[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [newAccountNumber, setNewAccountNumber] = useState('');
  const [selectedBankCode, setSelectedBankCode] = useState('');
  const [verifiedAccountName, setVerifiedAccountName] = useState('');
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    fetchWallet();
  }, []);

  useEffect(() => {
    if (showWithdrawModal) {
      fetchBanks();
      fetchSavedAccounts();
    }
  }, [showWithdrawModal]);

  const fetchWallet = async () => {
    try {
      setLoading(true);
      const res = await api.get('/wallet');
      setWallet(res.data);
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || 'Failed to load wallet';
      if (Platform.OS === 'web') {
        alert('Error: ' + errorMsg);
      } else {
        Alert.alert('Error', errorMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchBanks = async () => {
    try {
      const res = await bankAccountsAPI.getBanks();
      setBanks(res.data);
    } catch (error: any) {
      console.error('Failed to load banks:', error);
    }
  };

  const fetchSavedAccounts = async () => {
    try {
      const res = await bankAccountsAPI.getUserAccounts();
      setSavedAccounts(res.data);
      if (res.data.length > 0) {
        const primary = res.data.find((acc: any) => acc.isPrimary);
        setSelectedAccountId(primary?._id || res.data[0]._id);
      } else {
        setSelectedAccountId('');
      }
    } catch (error: any) {
      console.error('Failed to load saved bank accounts:', error);
    }
  };

  const handleVerifyAccount = async () => {
    if (newAccountNumber.length !== 10) {
      if (Platform.OS === 'web') {
        alert('Error: Enter a valid 10-digit account number');
      } else {
        Alert.alert('Error', 'Enter a valid 10-digit account number');
      }
      return;
    }

    if (!selectedBankCode) {
      if (Platform.OS === 'web') {
        alert('Error: Select a bank');
      } else {
        Alert.alert('Error', 'Select a bank');
      }
      return;
    }

    try {
      setVerifying(true);
      const res = await bankAccountsAPI.verifyAccount(newAccountNumber, selectedBankCode);
      setVerifiedAccountName(res.data.accountName);
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || 'Failed to verify account';
      if (Platform.OS === 'web') {
        alert('Error: ' + errorMsg);
      } else {
        Alert.alert('Error', errorMsg);
      }
      setVerifiedAccountName('');
    } finally {
      setVerifying(false);
    }
  };

  const handleAddAccount = async () => {
    if (!verifiedAccountName) {
      if (Platform.OS === 'web') {
        alert('Error: Verify account first');
      } else {
        Alert.alert('Error', 'Verify account first');
      }
      return;
    }

    try {
      setProcessing(true);
      await bankAccountsAPI.addAccount(newAccountNumber, selectedBankCode, savedAccounts.length === 0);
      if (Platform.OS === 'web') {
        alert('Bank account added successfully');
      } else {
        Alert.alert('Success', 'Bank account added successfully');
      }
      setShowAddAccount(false);
      setNewAccountNumber('');
      setSelectedBankCode('');
      setVerifiedAccountName('');
      fetchSavedAccounts();
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || 'Failed to add account';
      if (Platform.OS === 'web') {
        alert('Error: ' + errorMsg);
      } else {
        Alert.alert('Error', errorMsg);
      }
    } finally {
      setProcessing(false);
    }
  };

  const handleDeleteAccount = async (accountId: string) => {
    try {
      await bankAccountsAPI.deleteAccount(accountId);
      if (Platform.OS === 'web') {
        alert('Account deleted');
      } else {
        Alert.alert('Success', 'Account deleted');
      }
      fetchSavedAccounts();
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || 'Failed to delete account';
      if (Platform.OS === 'web') {
        alert('Error: ' + errorMsg);
      } else {
        Alert.alert('Error', errorMsg);
      }
    }
  };

  const handleWithdraw = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      if (Platform.OS === 'web') {
        alert('Error: Please enter a valid amount');
      } else {
        Alert.alert('Error', 'Please enter a valid amount');
      }
      return;
    }

    if (!selectedAccountId) {
      if (Platform.OS === 'web') {
        alert('Error: Select a saved bank account or add one first');
      } else {
        Alert.alert('Error', 'Select a saved bank account or add one first');
      }
      return;
    }

    if (parseFloat(amount) > wallet.balance) {
      if (Platform.OS === 'web') {
        alert('Error: Insufficient balance');
      } else {
        Alert.alert('Error', 'Insufficient balance');
      }
      return;
    }

    try {
      setProcessing(true);
      await api.post('/wallet/withdraw', {
        amount: parseFloat(amount),
        bankAccountId: selectedAccountId,
      });
      
      if (Platform.OS === 'web') {
        alert('Success: Withdrawal request submitted successfully');
      } else {
        Alert.alert('Success', 'Withdrawal request submitted successfully');
      }
      
      setShowWithdrawModal(false);
      setAmount('');
      fetchWallet();
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || 'Failed to withdraw';
      if (Platform.OS === 'web') {
        alert('Error: ' + errorMsg);
      } else {
        Alert.alert('Error', errorMsg);
      }
    } finally {
      setProcessing(false);
    }
  };

  const formatCurrency = (value: number) => {
    return `₦${value.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-NG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#7c8bff" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Wallet</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Balance Card */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Available Balance</Text>
          <Text style={styles.balanceAmount}>{formatCurrency(wallet.balance)}</Text>

          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.actionButton, styles.withdrawButton]}
              onPress={() => setShowWithdrawModal(true)}
            >
              <Icon name="arrow-up-circle-outline" size={20} color="#fff" />
              <Text style={styles.actionButtonText}>Withdraw</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Transactions */}
        <View style={styles.transactionsSection}>
          <Text style={styles.sectionTitle}>Recent Transactions</Text>

          {wallet.transactions.length === 0 ? (
            <View style={styles.emptyState}>
              <Icon name="wallet-outline" size={60} color="#4a4a6a" />
              <Text style={styles.emptyText}>No transactions yet</Text>
            </View>
          ) : (
            wallet.transactions.map((transaction) => (
              <View key={transaction._id} style={styles.transactionItem}>
                <View style={styles.transactionIcon}>
                  <Icon
                    name={
                      transaction.type === 'credit' || transaction.type === 'deposit'
                        ? 'arrow-down'
                        : 'arrow-up'
                    }
                    size={20}
                    color={
                      transaction.type === 'credit' || transaction.type === 'deposit'
                        ? '#4ade80'
                        : '#f87171'
                    }
                  />
                </View>

                <View style={styles.transactionDetails}>
                  <Text style={styles.transactionDescription}>{transaction.description}</Text>
                  <Text style={styles.transactionDate}>{formatDate(transaction.createdAt)}</Text>
                </View>

                <View style={styles.transactionRight}>
                  <Text
                    style={[
                      styles.transactionAmount,
                      transaction.type === 'credit' || transaction.type === 'deposit'
                        ? styles.creditAmount
                        : styles.debitAmount,
                    ]}
                  >
                    {transaction.type === 'credit' || transaction.type === 'deposit' ? '+' : '-'}
                    {formatCurrency(transaction.amount)}
                  </Text>
                  <Text
                    style={[
                      styles.transactionStatus,
                      transaction.status === 'completed' && styles.statusCompleted,
                      transaction.status === 'pending' && styles.statusPending,
                      transaction.status === 'failed' && styles.statusFailed,
                    ]}
                  >
                    {transaction.status}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Withdraw/Add Account Modal */}
      <Modal visible={showWithdrawModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {showAddAccount ? (
              <>
                <Text style={styles.modalTitle}>Add Bank Account</Text>

                <TextInput
                  style={styles.input}
                  placeholder="Account number"
                  placeholderTextColor="#6b7280"
                  keyboardType="numeric"
                  maxLength={10}
                  value={newAccountNumber}
                  onChangeText={(value) => {
                    setNewAccountNumber(value.replace(/\D/g, ''));
                    setVerifiedAccountName('');
                  }}
                />

                <View style={styles.selectWrapper}>
                  <Text style={styles.selectLabel}>Bank</Text>
                  <ScrollView style={styles.selectList}>
                    {banks.map((bank) => (
                      <TouchableOpacity
                        key={bank.code}
                        onPress={() => {
                          setSelectedBankCode(bank.code);
                          setVerifiedAccountName('');
                        }}
                        style={[
                          styles.selectItem,
                          selectedBankCode === bank.code && styles.selectItemSelected,
                        ]}
                      >
                        <Text style={styles.selectItemText}>{bank.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                {selectedBankCode && newAccountNumber.length === 10 && !verifiedAccountName && (
                  <TouchableOpacity
                    style={[styles.modalButton, styles.confirmButton, { marginBottom: 16 }]}
                    onPress={handleVerifyAccount}
                    disabled={verifying}
                  >
                    {verifying ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.confirmButtonText}>Verify Account</Text>
                    )}
                  </TouchableOpacity>
                )}

                {verifiedAccountName ? (
                  <View style={styles.verifiedBox}>
                    <Text style={styles.verifiedLabel}>Account name</Text>
                    <Text style={styles.verifiedText}>{verifiedAccountName}</Text>
                  </View>
                ) : null}

                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.cancelButton]}
                    onPress={() => {
                      setShowAddAccount(false);
                      setNewAccountNumber('');
                      setSelectedBankCode('');
                      setVerifiedAccountName('');
                    }}
                    disabled={processing}
                  >
                    <Text style={styles.cancelButtonText}>Back</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.confirmButton]}
                    onPress={handleAddAccount}
                    disabled={!verifiedAccountName || processing}
                  >
                    {processing ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.confirmButtonText}>Save Account</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <Text style={styles.modalTitle}>Withdraw Funds</Text>

                <TextInput
                  style={styles.input}
                  placeholder="Enter amount"
                  placeholderTextColor="#6b7280"
                  keyboardType="numeric"
                  value={amount}
                  onChangeText={setAmount}
                />

                {savedAccounts.length > 0 ? (
                  <View style={{ marginBottom: 16 }}>
                    <Text style={[styles.balanceInfo, { marginBottom: 12, color: '#e5e7eb' }]}>Select saved bank account</Text>
                    {savedAccounts.map((account) => (
                      <TouchableOpacity
                        key={account._id}
                        onPress={() => setSelectedAccountId(account._id)}
                        style={[
                          styles.accountCard,
                          selectedAccountId === account._id && styles.accountCardSelected,
                        ]}
                      >
                        <Text style={styles.accountBank}>{account.bankName}</Text>
                        <Text style={styles.accountDetails}>{account.accountNumber} • {account.accountName}</Text>
                        {account.isPrimary && <Text style={styles.primaryTag}>PRIMARY</Text>}
                      </TouchableOpacity>
                    ))}

                    {savedAccounts.length < 2 ? (
                      <TouchableOpacity
                        style={[styles.modalButton, styles.secondaryButton, { marginTop: 12 }]}
                        onPress={() => {
                          setShowAddAccount(true);
                          setVerifiedAccountName('');
                          setNewAccountNumber('');
                          setSelectedBankCode('');
                        }}
                      >
                        <Text style={styles.secondaryButtonText}>Add bank account</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                ) : (
                  <View style={{ marginBottom: 16 }}>
                    <Text style={[styles.balanceInfo, { marginBottom: 12, color: '#e5e7eb' }]}>No saved bank accounts yet.</Text>
                    <TouchableOpacity
                      style={[styles.modalButton, styles.secondaryButton]}
                      onPress={() => setShowAddAccount(true)}
                    >
                      <Text style={styles.secondaryButtonText}>Add bank account</Text>
                    </TouchableOpacity>
                  </View>
                )}

                <Text style={styles.balanceInfo}>
                  Available: {formatCurrency(wallet.balance)}
                </Text>

                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.cancelButton]}
                    onPress={() => {
                      setShowWithdrawModal(false);
                      setShowAddAccount(false);
                      setAmount('');
                      setNewAccountNumber('');
                      setSelectedBankCode('');
                      setVerifiedAccountName('');
                    }}
                    disabled={processing}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.modalButton, styles.confirmButton]}
                    onPress={handleWithdraw}
                    disabled={processing}
                  >
                    {processing ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.confirmButtonText}>Withdraw</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0a0a0f',
  },
  header: {
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#1a1a30',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  balanceCard: {
    backgroundColor: '#7c8bff',
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
  },
  balanceLabel: {
    fontSize: 14,
    color: '#e0e0ff',
    marginBottom: 8,
  },
  balanceAmount: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 24,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  fundButton: {
    backgroundColor: '#4ade80',
  },
  withdrawButton: {
    backgroundColor: '#1a1a30',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  transactionsSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    color: '#6b7280',
    fontSize: 16,
    marginTop: 16,
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a30',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  transactionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2a2a40',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  transactionDetails: {
    flex: 1,
  },
  transactionDescription: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  transactionDate: {
    fontSize: 12,
    color: '#6b7280',
  },
  transactionRight: {
    alignItems: 'flex-end',
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  creditAmount: {
    color: '#4ade80',
  },
  debitAmount: {
    color: '#f87171',
  },
  transactionStatus: {
    fontSize: 11,
    textTransform: 'capitalize',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusCompleted: {
    backgroundColor: '#4ade8020',
    color: '#4ade80',
  },
  statusPending: {
    backgroundColor: '#fbbf2420',
    color: '#fbbf24',
  },
  statusFailed: {
    backgroundColor: '#f8717120',
    color: '#f87171',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#1a1a30',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 20,
  },
  input: {
    backgroundColor: '#2a2a40',
    borderRadius: 8,
    padding: 14,
    color: '#fff',
    fontSize: 16,
    marginBottom: 16,
  },
  balanceInfo: {
    color: '#6b7280',
    fontSize: 14,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#2a2a40',
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButton: {
    backgroundColor: '#7c8bff',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: '#2d3748',
  },
  secondaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  accountCard: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#11121f',
    marginBottom: 12,
  },
  accountCardSelected: {
    borderWidth: 2,
    borderColor: '#7c8bff',
    backgroundColor: '#1f256a',
  },
  accountBank: {
    color: '#fff',
    fontWeight: '700',
    marginBottom: 4,
  },
  accountDetails: {
    color: '#cbd5e1',
    fontSize: 13,
    marginBottom: 6,
  },
  primaryTag: {
    color: '#7c8bff',
    fontSize: 12,
    fontWeight: '700',
  },
  selectWrapper: {
    marginBottom: 16,
  },
  selectLabel: {
    color: '#cbd5e1',
    marginBottom: 8,
  },
  selectList: {
    maxHeight: 200,
    backgroundColor: '#11121f',
    borderRadius: 12,
    padding: 8,
  },
  selectItem: {
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#1a1a30',
    marginBottom: 8,
  },
  selectItemSelected: {
    backgroundColor: '#2d3748',
  },
  selectItemText: {
    color: '#fff',
  },
  verifiedBox: {
    backgroundColor: '#1a372d',
    padding: 14,
    borderRadius: 12,
    marginBottom: 16,
  },
  verifiedLabel: {
    color: '#9ae6b4',
    fontSize: 12,
    marginBottom: 6,
  },
  verifiedText: {
    color: '#d1fae5',
    fontSize: 16,
    fontWeight: '700',
  },
});
