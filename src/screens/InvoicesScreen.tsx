import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  Alert, 
  TouchableOpacity, 
  ActivityIndicator, 
  Modal, 
  ScrollView,
  Dimensions,
  TextInput,
  Linking,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import * as Print from 'expo-print';
import api from '../utils/api';
import { Image, Platform } from "react-native";

const { width } = Dimensions.get('window');

type PaymentRecord = {
  amount: number;
  paymentReference: string;
  provider: string;
  paidAt: string;
  transactionId: string;
};

type InvoiceItem = {
  name?: string;
  unit?: string;
  quantity?: number;
  price?: number;
};

type Invoice = {
  _id?: string;
  invoiceNo?: string;
  totalAmount?: number;
  amountPaid?: number;
  outstandingAmount?: number;
  status?: string;
  service?: string;
  createdAt?: string;
  billTo?: { name?: string; attn?: string; phone?: string };
  projectDescription?: string;
  items?: InvoiceItem[];
  paymentTerms?: string;
  deliveryTerms?: string;
  notes?: string;
  payments?: PaymentRecord[];
  paymentProvider?: string;
  includeVat?: boolean;
  includeDiscount?: boolean;
  discountPercent?: number;
};

const logoSource =
  Platform.OS === "web"
    ? { uri: "/images/logo.png" }
    : require("../../assets/logo.png");

const signaturePreparedSource =
  Platform.OS === "web"
    ? { uri: "/images/signature-prepared.png" }
    : require("../../assets/signature-prepared.png");

const signatureApprovedSource =
  Platform.OS === "web"
    ? { uri: "/images/signature-approved.png" }
    : require("../../assets/signature-approved.png");

export default function InvoicesScreen() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [showPaymentHistory, setShowPaymentHistory] = useState(false);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const res = await api.get('/invoices');
      const invoiceList: Invoice[] = (res.data || []).map((inv: any) => ({
        _id: inv._id,
        invoiceNo: inv.invoiceNo,
        totalAmount: inv.totalAmount || 0,
        amountPaid: inv.amountPaid || 0,
        outstandingAmount: inv.outstandingAmount || inv.totalAmount || 0,
        status: inv.status || 'draft',
        service: inv.serviceType || 'Service',
        createdAt: inv.createdAt,
        billTo: inv.billTo,
        projectDescription: inv.projectDescription,
        items: inv.items,
        paymentTerms: inv.paymentTerms || '100% payment',
        deliveryTerms: inv.deliveryTerms || '10 working days after payment',
        notes: inv.note,
        payments: inv.payments || [],
        paymentProvider: inv.paymentProvider,
        includeVat: inv.includeVat !== false,
        includeDiscount: inv.includeDiscount || false,
        discountPercent: inv.discountPercent || 0,
      }));
      setInvoices(invoiceList);
    } catch (err: any) {
      console.error('Fetch invoices error:', err.response?.data || err.message);
      Alert.alert('Error', 'Failed to load invoices');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, []);

  const calculateTotals = (invoice: Invoice) => {
    const items = Array.isArray(invoice.items) ? invoice.items : [];
    const subtotal = items.reduce((sum, item) => {
      const itemTotal = (item.quantity || 0) * (item.price || 0);
      return sum + itemTotal;
    }, 0);
    
    const includeVat = invoice.includeVat !== false;
    const vat = includeVat ? subtotal * 0.075 : 0;
    const totalBeforeDiscount = subtotal + vat;
    
    const includeDiscount = invoice.includeDiscount || false;
    const discountPercent = invoice.discountPercent || 0;
    const discount = includeDiscount ? (totalBeforeDiscount * (discountPercent / 100)) : 0;
    const grandTotal = totalBeforeDiscount - discount;

    return { subtotal, vat, totalBeforeDiscount, discount, discountPercent, includeDiscount, grandTotal, includeVat };
  };

  const handlePayment = async () => {
    if (!selectedInvoice || !paymentAmount) {
      Alert.alert('Error', 'Please enter a valid payment amount');
      return;
    }

    const amount = parseFloat(paymentAmount);
    const outstanding = selectedInvoice.outstandingAmount || 0;

    if (amount <= 0) {
      Alert.alert('Error', 'Payment amount must be greater than 0');
      return;
    }

    if (amount > outstanding) {
      Alert.alert('Error', `Payment amount cannot exceed outstanding amount of ₦${outstanding.toLocaleString()}`);
      return;
    }

    try {
      setPaymentLoading(true);
      
      console.log('Payment request data:', {
        invoiceId: selectedInvoice._id,
        amount: amount,
        outstanding: outstanding,
        status: selectedInvoice.status
      });
      
      const response = await api.post(`/invoices/${selectedInvoice._id}/pay`, { amount });
      
      if (response.data.paymentUrl) {
        const canOpen = await Linking.canOpenURL(response.data.paymentUrl);
        if (canOpen) {
          await Linking.openURL(response.data.paymentUrl);
          setShowPaymentModal(false);
          setPaymentAmount('');
          
          setTimeout(() => {
            fetchInvoices();
          }, 2000);
        } else {
          Alert.alert('Error', 'Cannot open payment link');
        }
      }
    } catch (error: any) {
      console.error('Payment error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        statusText: error.response?.statusText,
      });
      
      const errorMessage = error.response?.data?.message || 
                          error.response?.data?.error || 
                          error.message || 
                          'Failed to initiate payment';
      
      Alert.alert('Payment Error', errorMessage);
    } finally {
      setPaymentLoading(false);
    }
  };

  const openPaymentModal = (invoice: Invoice) => {
    if (!['final', 'partial-payment'].includes(invoice.status || '')) {
      Alert.alert('Error', 'This invoice cannot be paid in its current status');
      return;
    }
    setSelectedInvoice(invoice);
    setPaymentAmount(invoice.outstandingAmount?.toString() || '');
    setShowPaymentModal(true);
  };

  const viewPaymentHistory = async (invoice: Invoice) => {
    try {
      const response = await api.get(`/invoices/${invoice._id}/payments`);
      setSelectedInvoice({ ...invoice, payments: response.data.payments });
      setShowPaymentHistory(true);
    } catch (error: any) {
      Alert.alert('Error', 'Failed to load payment history');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return '#28a745';
      case 'partial-payment': return '#fd7e14';
      case 'final': return '#007bff';
      case 'draft': return '#6c757d';
      default: return '#ffc107';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'partial-payment': return 'PARTIAL';
      default: return status?.toUpperCase() || 'PENDING';
    }
  };

  const generateInvoiceHTML = (invoice: Invoice) => {
    const { subtotal, vat, totalBeforeDiscount, discount, discountPercent, includeDiscount, grandTotal, includeVat } = calculateTotals(invoice);

    const paymentHistoryHTML = invoice.payments && invoice.payments.length > 0 ? `
      <div class="payments-section">
        <h3 style="color: #007bff; margin-bottom: 15px; font-size: 16px; border-bottom: 1px solid #007bff; padding-bottom: 5px;">Payment History</h3>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px;">
          <thead>
            <tr style="background-color: #f8f9fa;">
              <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Date</th>
              <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Reference</th>
              <th style="padding: 8px; border: 1px solid #ddd; text-align: right;">Amount (₦)</th>
              <th style="padding: 8px; border: 1px solid #ddd; text-align: center;">Provider</th>
            </tr>
          </thead>
          <tbody>
            ${invoice.payments.map(payment => `
              <tr>
                <td style="padding: 8px; border: 1px solid #ddd;">${new Date(payment.paidAt).toLocaleDateString('en-GB')}</td>
                <td style="padding: 8px; border: 1px solid #ddd; font-family: monospace; font-size: 10px;">${payment.paymentReference}</td>
                <td style="padding: 8px; border: 1px solid #ddd; text-align: right; font-weight: bold;">${payment.amount.toLocaleString()}</td>
                <td style="padding: 8px; border: 1px solid #ddd; text-align: center; text-transform: uppercase;">${payment.provider}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    ` : '';

    const paymentSummaryHTML = `
      <div class="payment-summary">
        <table style="width: 100%; max-width: 400px; margin: 0 auto 20px auto; border-collapse: collapse;">
          <tr style="background-color: #f8f9fa;">
            <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">Total Invoice Amount:</td>
            <td style="padding: 10px; border: 1px solid #ddd; text-align: right; font-weight: bold;">₦${grandTotal.toLocaleString()}</td>
          </tr>
          <tr style="background-color: #d4edda;">
            <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold; color: #155724;">Amount Paid:</td>
            <td style="padding: 10px; border: 1px solid #ddd; text-align: right; font-weight: bold; color: #155724;">₦${(invoice.amountPaid || 0).toLocaleString()}</td>
          </tr>
          <tr style="background-color: ${(invoice.outstandingAmount || 0) > 0 ? '#f8d7da' : '#d4edda'};">
            <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold; color: ${(invoice.outstandingAmount || 0) > 0 ? '#721c24' : '#155724'};">Outstanding Amount:</td>
            <td style="padding: 10px; border: 1px solid #ddd; text-align: right; font-weight: bold; color: ${(invoice.outstandingAmount || 0) > 0 ? '#721c24' : '#155724'};">₦${(invoice.outstandingAmount || 0).toLocaleString()}</td>
          </tr>
        </table>
      </div>
    `;

    const notesHTML = invoice.notes && invoice.notes.trim() ? `
      <div class="terms-row">
        <div class="terms-label">Notes:</div>
        <div class="terms-value">${invoice.notes.replace(/\n/g, '<br>')}</div>
      </div>
    ` : '';

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Invoice ${invoice.invoiceNo}</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: Arial, sans-serif; line-height: 1.4; color: #333; background: white; }
            .invoice-container { max-width: 800px; margin: 20px auto; padding: 40px; background: white; }
            .invoice-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; border-bottom: 2px solid #007bff; padding-bottom: 20px; }
            .company-info h1 { color: #007bff; font-size: 24px; font-weight: bold; margin-bottom: 5px; }
            .company-info .tagline { color: #666; font-size: 14px; font-style: italic; }
            .logo-placeholder { width: 120px; height: 80px; border: 2px solid #007bff; border-radius: 8px; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #007bff 0%, #0056b3 100%); color: white; font-weight: bold; font-size: 14px; text-align: center; }
            .invoice-title { text-align: center; margin: 20px 0; }
            .invoice-title h2 { font-size: 28px; font-weight: bold; color: #333; letter-spacing: 2px; }
            .invoice-details { display: flex; justify-content: space-between; margin-bottom: 30px; }
            .invoice-info, .bill-to { flex: 1; }
            .invoice-info { margin-right: 40px; }
            .invoice-info p, .bill-to p { margin-bottom: 8px; font-size: 14px; }
            .bill-to h3 { font-size: 16px; margin-bottom: 10px; color: #007bff; border-bottom: 1px solid #007bff; padding-bottom: 5px; }
            .project-description { margin-bottom: 30px; padding: 15px; background-color: #f8f9fa; border-left: 4px solid #007bff; border-radius: 4px; }
            .project-description h3 { color: #007bff; margin-bottom: 10px; font-size: 16px; }
            .items-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 12px; }
            .items-table th { background-color: #007bff; color: white; padding: 12px 8px; text-align: left; font-weight: bold; border: 1px solid #007bff; }
            .items-table td { padding: 10px 8px; border: 1px solid #ddd; vertical-align: top; }
            .items-table tr:nth-child(even) { background-color: #f8f9fa; }
            .items-table .number-cell { text-align: center; font-weight: bold; }
            .items-table .amount-cell { text-align: right; font-weight: bold; }
            .totals-section { display: flex; justify-content: flex-end; margin-bottom: 30px; }
            .totals-table { border-collapse: collapse; min-width: 300px; }
            .totals-table td { padding: 8px 15px; border: 1px solid #ddd; }
            .totals-table .label-cell { background-color: #f8f9fa; font-weight: bold; text-align: right; }
            .totals-table .amount-cell { text-align: right; font-weight: bold; }
            .totals-table .grand-total { background-color: #007bff; color: white; font-size: 16px; }
            .totals-table .discount-row { background-color: #fff3cd; }
            .totals-table .final-total { background-color: #28a745; color: white; font-size: 16px; }
            .terms-section { margin-bottom: 40px; }
            .terms-row { display: flex; margin-bottom: 15px; }
            .terms-label { font-weight: bold; min-width: 180px; color: #007bff; }
            .terms-value { flex: 1; }
            .signature-section { display: flex; justify-content: space-between; margin-top: 50px; padding-top: 30px; border-top: 1px solid #ddd; }
            .signature-box { text-align: center; width: 200px; }
            .signature-line { border-top: 1px solid #333; margin-bottom: 5px; height: 40px; }
            .payments-section { margin-bottom: 30px; }
            .payment-summary { margin-bottom: 30px; }
          </style>
        </head>
        <body>
          <div class="invoice-container">
            <div class="invoice-header">
              <div class="company-info">
                <h1>DARLYN-ALT GLOBAL</h1>
                <div class="tagline">Smart Living Starts Here</div>
              </div>
              <div class="logo-placeholder">COMPANY LOGO</div>
            </div>
            
            <div class="invoice-title">
              <h2>INVOICE</h2>
            </div>
            
            <div class="invoice-details">
              <div class="invoice-info">
                <p><strong>Invoice No:</strong> ${invoice.invoiceNo || invoice._id?.slice(-8)}</p>
                <p><strong>Date:</strong> ${invoice.createdAt ? new Date(invoice.createdAt).toLocaleDateString('en-GB') : '-'}</p>
                <p><strong>Status:</strong> ${getStatusText(invoice.status || 'pending')}</p>
              </div>
              <div class="bill-to">
                <h3>Bill To:</h3>
                <p>${invoice.billTo?.name || '-'}</p>
                <p><strong>Attn:</strong> ${invoice.billTo?.attn || '-'}</p>
                <p>${invoice.billTo?.phone || '-'}</p>
              </div>
            </div>
            
            ${invoice.projectDescription ? `
              <div class="project-description">
                <h3>Project Description:</h3>
                <p>${invoice.projectDescription}</p>
              </div>
            ` : ''}
            
            <table class="items-table">
              <thead>
                <tr>
                  <th class="number-cell">S/N</th>
                  <th>Item Description</th>
                  <th>Unit</th>
                  <th class="number-cell">Qty</th>
                  <th class="amount-cell">Unit Price (₦)</th>
                  <th class="amount-cell">Total Price (₦)</th>
                </tr>
              </thead>
              <tbody>
                ${(invoice.items || []).map((item, idx) => `
                  <tr>
                    <td class="number-cell">${idx + 1}</td>
                    <td>${item.name || '-'}</td>
                    <td>${item.unit || 'pcs'}</td>
                    <td class="number-cell">${item.quantity || 0}</td>
                    <td class="amount-cell">${(item.price || 0).toLocaleString()}</td>
                    <td class="amount-cell">${((item.quantity || 0) * (item.price || 0)).toLocaleString()}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            
            <div class="totals-section">
              <table class="totals-table">
                <tbody>
                  <tr>
                    <td class="label-cell">Subtotal (₦):</td>
                    <td class="amount-cell">${subtotal.toLocaleString()}</td>
                  </tr>
                  ${includeVat ? ` 
                  <tr>
                    <td class="label-cell">VAT (7.5%) (₦):</td>
                    <td class="amount-cell">${vat.toLocaleString()}</td>
                  </tr>
                  ` : ''}
                  <tr class="grand-total">
                    <td class="label-cell grand-total">Grand Total (₦):</td>
                    <td class="amount-cell grand-total">${totalBeforeDiscount.toLocaleString()}</td>
                  </tr>
                  ${includeDiscount ? `
                  <tr class="discount-row">
                    <td class="label-cell" style="background-color: #fff3cd; color: #856404;">Discount (${discountPercent}%):</td>
                    <td class="amount-cell" style="background-color: #fff3cd; color: #856404;">-${discount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                  </tr>
                  <tr class="final-total">
                    <td class="label-cell" style="background-color: #28a745; color: white;">Final Total (₦):</td>
                    <td class="amount-cell" style="background-color: #28a745; color: white;">${grandTotal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                  </tr>
                  ` : ''}
                </tbody>
              </table>
            </div>

            ${paymentSummaryHTML}
            ${paymentHistoryHTML}
            
            <div class="terms-section">
              <div class="terms-row">
                <div class="terms-label">Payment Terms:</div>
                <div class="terms-value">${invoice.paymentTerms || '100% payment'}</div>
              </div>
              <div class="terms-row">
                <div class="terms-label">Delivery & Installation:</div>
                <div class="terms-value">${invoice.deliveryTerms || '10 working days after payment'}</div>
              </div>
              ${notesHTML}
            </div>
            
            <div class="signature-section">
              <div class="signature-box">
                <div class="signature-line" style="display: flex; align-items: center; justify-content: center; border: none;">
                  <img src="/images/signature-prepared.png" alt="Prepared By Signature" style="max-width: 180px; max-height: 50px; object-fit: contain;" />
                </div>
                <div style="border-top: 1px solid #333; padding-top: 5px; font-weight: bold;">Prepared By</div>
              </div>
              <div class="signature-box">
                <div class="signature-line" style="display: flex; align-items: center; justify-content: center; border: none;">
                  <img src="/images/signature-approved.png" alt="Approved By Signature" style="max-width: 180px; max-height: 50px; object-fit: contain;" />
                </div>
                <div style="border-top: 1px solid #333; padding-top: 5px; font-weight: bold;">Approved By</div>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;
  };

  const printInvoice = async (invoice: Invoice) => {
    try {
      const html = generateInvoiceHTML(invoice);
      await Print.printAsync({ html });
    } catch (err) {
      Alert.alert('Error', 'Failed to print invoice');
      console.error(err);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#007bff" />
      </View>
    );
  }

  const renderInvoice = ({ item }: { item: Invoice }) => (
    <TouchableOpacity style={styles.invoiceCard} onPress={() => setSelectedInvoice(item)}>
      <View style={styles.invoiceHeader}>
        <View style={styles.iconContainer}>
          <Icon name="file-text" size={18} color="#007bff" />
        </View>
        <View style={styles.invoiceContent}>
          <Text style={styles.invoiceTitle}>{item.service || 'Invoice'}</Text>
          <Text style={styles.invoiceNumber}>#{item.invoiceNo || item._id?.slice(-8)}</Text>
          <Text style={styles.invoiceMeta}>
            {item.createdAt ? new Date(item.createdAt).toLocaleDateString('en-GB') : '-'} • {item.status}
          </Text>
          {(item.amountPaid || 0) > 0 && (
            <Text style={styles.paymentProgress}>
              Paid: ₦{(item.amountPaid || 0).toLocaleString()} / ₦{calculateTotals(item).grandTotal.toLocaleString()}
            </Text>
          )}
        </View>
        <View style={styles.amountContainer}>
          <Text style={styles.invoiceAmount}>
            ₦{calculateTotals(item).grandTotal.toLocaleString()}
          </Text>
          {(item.outstandingAmount || 0) > 0 && (
            <Text style={styles.outstandingAmount}>
              Outstanding: ₦{(item.outstandingAmount || 0).toLocaleString()}
            </Text>
          )}
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status || 'pending') }]}>
            <Text style={styles.statusText}>{getStatusText(item.status || 'pending')}</Text>
          </View>
        </View>
      </View>
      
      {['final', 'partial-payment'].includes(item.status || '') && (item.outstandingAmount || 0) > 0 && (
        <View style={styles.actionButtons}>
          <TouchableOpacity 
            style={styles.payButton} 
            onPress={(e) => {
              e.stopPropagation();
              openPaymentModal(item);
            }}
          >
            <Icon name="credit-card" size={16} color="white" />
            <Text style={styles.payButtonText}>Pay Now</Text>
          </TouchableOpacity>
          
          {(item.payments?.length || 0) > 0 && (
            <TouchableOpacity 
              style={styles.historyButton}
              onPress={(e) => {
                e.stopPropagation();
                viewPaymentHistory(item);
              }}
            >
              <Icon name="clock" size={16} color="#007bff" />
              <Text style={styles.historyButtonText}>Payment History</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </TouchableOpacity>
  );

  const InvoicePreview = ({ invoice }: { invoice: Invoice }) => {
    const { subtotal, vat, totalBeforeDiscount, discount, discountPercent, includeDiscount, grandTotal, includeVat } = calculateTotals(invoice);

    return (
      <ScrollView style={styles.previewContainer}>
        <View style={styles.previewHeader}>
          <View style={styles.companyInfo}>
            <Text style={styles.companyName}>DARLYN-ALT GLOBAL</Text>
            <Text style={styles.companyTagline}>Smart Living Starts Here</Text>
          </View>
          <View style={styles.logoPlaceholder}>
            <Image
              source={logoSource}
              style={{ width: 100, height: 100, resizeMode: "contain" }}
            />
          </View>
        </View>

        <View style={styles.invoiceTitleContainer}>
          <Text style={styles.invoiceMainTitle}>INVOICE</Text>
        </View>

        <View style={styles.invoiceDetailsContainer}>
          <View style={styles.invoiceInfoSection}>
            <Text style={styles.detailText}>
              <Text style={styles.boldText}>Invoice No:</Text> {invoice.invoiceNo || invoice._id?.slice(-8)}
            </Text>
            <Text style={styles.detailText}>
              <Text style={styles.boldText}>Date:</Text> {invoice.createdAt ? new Date(invoice.createdAt).toLocaleDateString('en-GB') : '-'}
            </Text>
            <Text style={styles.detailText}>
              <Text style={styles.boldText}>Status:</Text> {getStatusText(invoice.status || 'pending')}
            </Text>
          </View>
          
          <View style={styles.billToSection}>
            <Text style={styles.billToTitle}>Bill To:</Text>
            <Text style={styles.detailText}>{invoice.billTo?.name || '-'}</Text>
            <Text style={styles.detailText}>
              <Text style={styles.boldText}>Attn:</Text> {invoice.billTo?.attn || '-'}
            </Text>
            <Text style={styles.detailText}>{invoice.billTo?.phone || '-'}</Text>
          </View>
        </View>

        {invoice.projectDescription && (
          <View style={styles.projectDescriptionContainer}>
            <Text style={styles.projectDescriptionTitle}>Project Description:</Text>
            <Text style={styles.projectDescriptionText}>{invoice.projectDescription}</Text>
          </View>
        )}

        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderText, { flex: 0.8 }]}>S/N</Text>
          <Text style={[styles.tableHeaderText, { flex: 3 }]}>Item Description</Text>
          <Text style={[styles.tableHeaderText, { flex: 1 }]}>Unit</Text>
          <Text style={[styles.tableHeaderText, { flex: 1 }]}>Qty</Text>
          <Text style={[styles.tableHeaderText, { flex: 1.5 }]}>Unit Price (₦)</Text>
          <Text style={[styles.tableHeaderText, { flex: 1.5 }]}>Total (₦)</Text>
        </View>

        {(invoice.items || []).map((item, index) => (
          <View key={index} style={[styles.tableRow, { backgroundColor: index % 2 === 1 ? '#f8f9fa' : 'white' }]}>
            <Text style={[styles.tableCellText, styles.numberCell, { flex: 0.8 }]}>{index + 1}</Text>
            <Text style={[styles.tableCellText, { flex: 3 }]}>{item.name || '-'}</Text>
            <Text style={[styles.tableCellText, styles.centerText, { flex: 1 }]}>{item.unit || 'pcs'}</Text>
            <Text style={[styles.tableCellText, styles.centerText, { flex: 1 }]}>{item.quantity || 0}</Text>
            <Text style={[styles.tableCellText, styles.amountText, { flex: 1.5 }]}>{(item.price || 0).toLocaleString()}</Text>
            <Text style={[styles.tableCellText, styles.amountText, { flex: 1.5 }]}>
              {((item.quantity || 0) * (item.price || 0)).toLocaleString()}
            </Text>
          </View>
        ))}

        <View style={styles.totalsContainer}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal (₦):</Text>
            <Text style={styles.totalValue}>{subtotal.toLocaleString()}</Text>
          </View>
          {includeVat && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>VAT (7.5%) (₦):</Text>
              <Text style={styles.totalValue}>{vat.toLocaleString()}</Text>
            </View>
          )}
          <View style={[styles.totalRow, styles.grandTotalRow]}>
            <Text style={styles.grandTotalLabel}>Grand Total (₦):</Text>
            <Text style={styles.grandTotalValue}>{totalBeforeDiscount.toLocaleString()}</Text>
          </View>
          {includeDiscount && (
            <>
              <View style={[styles.totalRow, styles.discountRow]}>
                <Text style={styles.discountLabel}>Discount ({discountPercent}%):</Text>
                <Text style={styles.discountValue}>
                  -{discount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                </Text>
              </View>
              <View style={[styles.totalRow, styles.finalTotalRow]}>
                <Text style={styles.finalTotalLabel}>Final Total (₦):</Text>
                <Text style={styles.finalTotalValue}>
                  {grandTotal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                </Text>
              </View>
            </>
          )}
        </View>

        <View style={styles.paymentSummaryContainer}>
          <Text style={styles.paymentSummaryTitle}>Payment Summary</Text>
          <View style={styles.paymentSummaryRow}>
            <Text style={styles.paymentSummaryLabel}>Total Amount:</Text>
            <Text style={styles.paymentSummaryValue}>₦{(invoice.totalAmount || 0).toLocaleString()}</Text>
          </View>
          <View style={[styles.paymentSummaryRow, styles.paidAmountRow]}>
            <Text style={[styles.paymentSummaryLabel, styles.paidAmountLabel]}>Amount Paid:</Text>
            <Text style={[styles.paymentSummaryValue, styles.paidAmountValue]}>₦{(invoice.amountPaid || 0).toLocaleString()}</Text>
          </View>
          <View style={[styles.paymentSummaryRow, (invoice.outstandingAmount || 0) > 0 ? styles.outstandingAmountRow : styles.paidAmountRow]}>
            <Text style={[styles.paymentSummaryLabel, (invoice.outstandingAmount || 0) > 0 ? styles.outstandingAmountLabel : styles.paidAmountLabel]}>Outstanding:</Text>
            <Text style={[styles.paymentSummaryValue, (invoice.outstandingAmount || 0) > 0 ? styles.outstandingAmountValue : styles.paidAmountValue]}>₦{(invoice.outstandingAmount || 0).toLocaleString()}</Text>
          </View>
        </View>

        {(invoice.payments?.length || 0) > 0 && (
          <View style={styles.paymentHistoryContainer}>
            <Text style={styles.paymentHistoryTitle}>Payment History</Text>
            {invoice.payments?.map((payment, index) => (
              <View key={index} style={styles.paymentHistoryItem}>
                <View style={styles.paymentHistoryLeft}>
                  <Text style={styles.paymentHistoryDate}>
                    {new Date(payment.paidAt).toLocaleDateString('en-GB')}
                  </Text>
                  <Text style={styles.paymentHistoryRef}>{payment.paymentReference}</Text>
                </View>
                <View style={styles.paymentHistoryRight}>
                  <Text style={styles.paymentHistoryAmount}>₦{payment.amount.toLocaleString()}</Text>
                  <Text style={styles.paymentHistoryProvider}>{payment.provider.toUpperCase()}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {['final', 'partial-payment'].includes(invoice.status || '') && (invoice.outstandingAmount || 0) > 0 && (
          <View style={styles.previewActionButtons}>
            <TouchableOpacity 
              style={styles.previewPayButton}
              onPress={() => {
                setShowPaymentModal(true);
                setPaymentAmount(invoice.outstandingAmount?.toString() || '');
              }}
            >
              <Icon name="credit-card" size={20} color="white" />
              <Text style={styles.previewPayButtonText}>Make Payment</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.termsContainer}>
          <View style={styles.termRow}>
            <Text style={styles.termLabel}>Payment Terms:</Text>
            <Text style={styles.termValue}>{invoice.paymentTerms || '100% payment'}</Text>
          </View>
          <View style={styles.termRow}>
            <Text style={styles.termLabel}>Delivery & Installation:</Text>
            <Text style={styles.termValue}>{invoice.deliveryTerms || '10 working days after payment'}</Text>
          </View>
          {invoice.notes && invoice.notes.trim() && (
            <View style={styles.termRow}>
              <Text style={styles.termLabel}>Notes:</Text>
              <Text style={styles.termValue}>{invoice.notes}</Text>
            </View>
          )}
        </View>

        <View style={styles.signatureContainer}>
          <View style={styles.signatureBox}>
            <View style={styles.signatureImageContainer}>
              <Image
                source={signaturePreparedSource}
                style={styles.signatureImage}
                resizeMode="contain"
              />
            </View>
            <View style={styles.signatureLineBottom} />
            <Text style={styles.signatureLabel}>Prepared By</Text>
          </View>
          <View style={styles.signatureBox}>
            <View style={styles.signatureImageContainer}>
              <Image
                source={signatureApprovedSource}
                style={styles.signatureImage}
                resizeMode="contain"
              />
            </View>
            <View style={styles.signatureLineBottom} />
            <Text style={styles.signatureLabel}>Approved By</Text>
          </View>
        </View>
      </ScrollView>
    );
  };

  return (
    <View style={styles.container}>
      {invoices.length === 0 ? (
        <View style={styles.emptyState}>
          <Icon name="file-text" size={48} color="#d1d5db" />
          <Text style={styles.emptyText}>No invoices found</Text>
          <Text style={styles.emptySubtext}>Create your first invoice to get started</Text>
        </View>
      ) : (
        <FlatList
          data={invoices}
          renderItem={renderInvoice}
          keyExtractor={item => item._id || Math.random().toString()}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        />
      )}

      <Modal 
        visible={!!selectedInvoice && !showPaymentModal && !showPaymentHistory} 
        animationType="slide" 
        onRequestClose={() => setSelectedInvoice(null)}
        statusBarTranslucent={false}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setSelectedInvoice(null)} style={styles.closeButton}>
              <Icon name="arrow-left" size={24} color="#007bff" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Invoice Preview</Text>
            <TouchableOpacity 
              onPress={() => selectedInvoice && printInvoice(selectedInvoice)}
              style={styles.printButton}
            >
              <Icon name="download" size={20} color="white" />
              <Text style={styles.printButtonText}>Export PDF</Text>
            </TouchableOpacity>
          </View>
          {selectedInvoice && <InvoicePreview invoice={selectedInvoice} />}
        </View>
      </Modal>

      <Modal
        visible={showPaymentModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowPaymentModal(false)}
      >
        <View style={styles.paymentModalOverlay}>
          <View style={styles.paymentModalContainer}>
            <View style={styles.paymentModalHeader}>
              <Text style={styles.paymentModalTitle}>Make Payment</Text>
              <TouchableOpacity onPress={() => setShowPaymentModal(false)}>
                <Icon name="x" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <View style={styles.paymentModalContent}>
              <Text style={styles.invoiceNumberText}>
                Invoice: {selectedInvoice?.invoiceNo || selectedInvoice?._id?.slice(-8)}
              </Text>
              
              <View style={styles.paymentAmountInfo}>
                <Text style={styles.paymentInfoLabel}>Total Amount:</Text>
                <Text style={styles.paymentInfoValue}>₦{(selectedInvoice?.totalAmount || 0).toLocaleString()}</Text>
              </View>
              
              <View style={styles.paymentAmountInfo}>
                <Text style={styles.paymentInfoLabel}>Amount Paid:</Text>
                <Text style={styles.paymentInfoValue}>₦{(selectedInvoice?.amountPaid || 0).toLocaleString()}</Text>
              </View>
              
              <View style={styles.paymentAmountInfo}>
                <Text style={styles.paymentInfoLabel}>Outstanding:</Text>
                <Text style={[styles.paymentInfoValue, styles.outstandingText]}>
                  ₦{(selectedInvoice?.outstandingAmount || 0).toLocaleString()}
                </Text>
              </View>

              <View style={styles.paymentInputContainer}>
                <Text style={styles.paymentInputLabel}>Enter Payment Amount (₦)</Text>
                <TextInput
                  style={styles.paymentInput}
                  value={paymentAmount}
                  onChangeText={setPaymentAmount}
                  placeholder="0.00"
                  keyboardType="numeric"
                  maxLength={12}
                />
                <Text style={styles.paymentInputHint}>
                  You can pay any amount up to ₦{(selectedInvoice?.outstandingAmount || 0).toLocaleString()}
                </Text>
              </View>

              <View style={styles.paymentQuickAmounts}>
                <Text style={styles.quickAmountsLabel}>Quick amounts:</Text>
                <View style={styles.quickAmountsButtons}>
                  <TouchableOpacity 
                    style={styles.quickAmountButton}
                    onPress={() => setPaymentAmount((selectedInvoice?.outstandingAmount || 0).toString())}
                  >
                    <Text style={styles.quickAmountText}>Full</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.quickAmountButton}
                    onPress={() => setPaymentAmount(Math.round((selectedInvoice?.outstandingAmount || 0) * 0.5).toString())}
                  >
                    <Text style={styles.quickAmountText}>50%</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.quickAmountButton}
                    onPress={() => setPaymentAmount(Math.round((selectedInvoice?.outstandingAmount || 0) * 0.25).toString())}
                  >
                    <Text style={styles.quickAmountText}>25%</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity 
                style={[styles.proceedPaymentButton, paymentLoading && styles.disabledButton]}
                onPress={handlePayment}
                disabled={paymentLoading}
              >
                {paymentLoading ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <>
                    <Icon name="credit-card" size={20} color="white" />
                    <Text style={styles.proceedPaymentText}>
                      Pay ₦{parseFloat(paymentAmount || '0').toLocaleString()}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showPaymentHistory}
        animationType="slide"
        onRequestClose={() => setShowPaymentHistory(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowPaymentHistory(false)} style={styles.closeButton}>
              <Icon name="arrow-left" size={24} color="#007bff" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Payment History</Text>
            <View style={styles.printButton} />
          </View>

          <ScrollView style={styles.paymentHistoryScroll}>
            <View style={styles.paymentHistoryHeader}>
              <Text style={styles.paymentHistoryInvoiceNo}>
                Invoice: {selectedInvoice?.invoiceNo || selectedInvoice?._id?.slice(-8)}
              </Text>
              
              <View style={styles.paymentHistorySummary}>
                <View style={styles.paymentHistorySummaryRow}>
                  <Text style={styles.paymentHistorySummaryLabel}>Total Amount:</Text>
                  <Text style={styles.paymentHistorySummaryValue}>₦{(selectedInvoice?.totalAmount || 0).toLocaleString()}</Text>
                </View>
                <View style={styles.paymentHistorySummaryRow}>
                  <Text style={styles.paymentHistorySummaryLabel}>Amount Paid:</Text>
                  <Text style={[styles.paymentHistorySummaryValue, styles.paidColor]}>₦{(selectedInvoice?.amountPaid || 0).toLocaleString()}</Text>
                </View>
                <View style={styles.paymentHistorySummaryRow}>
                  <Text style={styles.paymentHistorySummaryLabel}>Outstanding:</Text>
                  <Text style={[styles.paymentHistorySummaryValue, (selectedInvoice?.outstandingAmount || 0) > 0 ? styles.outstandingColor : styles.paidColor]}>
                    ₦{(selectedInvoice?.outstandingAmount || 0).toLocaleString()}
                  </Text>
                </View>
              </View>
            </View>

            {(selectedInvoice?.payments?.length || 0) > 0 ? (
              <View style={styles.paymentsList}>
                <Text style={styles.paymentsListTitle}>Payment Records</Text>
                {selectedInvoice?.payments?.map((payment, index) => (
                  <View key={index} style={styles.paymentRecord}>
                    <View style={styles.paymentRecordHeader}>
                      <View style={styles.paymentRecordLeft}>
                        <Text style={styles.paymentRecordAmount}>₦{payment.amount.toLocaleString()}</Text>
                        <Text style={styles.paymentRecordDate}>
                          {new Date(payment.paidAt).toLocaleDateString('en-GB')} at {new Date(payment.paidAt).toLocaleTimeString('en-GB')}
                        </Text>
                      </View>
                      <View style={styles.paymentRecordRight}>
                        <View style={[styles.paymentProviderBadge, { backgroundColor: payment.provider === 'paystack' ? '#00C851' : '#ff6b6b' }]}>
                          <Text style={styles.paymentProviderText}>{payment.provider.toUpperCase()}</Text>
                        </View>
                      </View>
                    </View>
                    <Text style={styles.paymentRecordRef}>Ref: {payment.paymentReference}</Text>
                    {payment.transactionId && (
                      <Text style={styles.paymentRecordTxId}>TX: {payment.transactionId}</Text>
                    )}
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.noPaymentsContainer}>
                <Icon name="credit-card" size={48} color="#d1d5db" />
                <Text style={styles.noPaymentsText}>No payments made yet</Text>
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContainer: {
    padding: 16,
  },
  invoiceCard: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  invoiceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    marginRight: 12,
  },
  invoiceContent: {
    flex: 1,
  },
  invoiceTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  invoiceNumber: {
    fontSize: 14,
    color: '#007bff',
    fontWeight: '500',
    marginBottom: 2,
  },
  invoiceMeta: {
    fontSize: 12,
    color: '#6b7280',
  },
  paymentProgress: {
    fontSize: 11,
    color: '#28a745',
    fontWeight: '500',
    marginTop: 2,
  },
  amountContainer: {
    alignItems: 'flex-end',
  },
  invoiceAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#007bff',
    marginBottom: 4,
  },
  outstandingAmount: {
    fontSize: 12,
    fontWeight: '600',
    color: '#dc3545',
    marginBottom: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    color: 'white',
  },
  actionButtons: {
    flexDirection: 'row',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  payButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#28a745',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    marginRight: 8,
  },
  payButtonText: {
    color: 'white',
    fontWeight: '600',
    marginLeft: 4,
    fontSize: 12,
  },
  historyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#007bff',
  },
  historyButtonText: {
    color: '#007bff',
    fontWeight: '600',
    marginLeft: 4,
    fontSize: 12,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 18,
    color: '#374151',
    marginTop: 16,
    fontWeight: '600',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  closeButton: {
    padding: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  printButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#28a745',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  printButtonText: {
    color: 'white',
    fontWeight: '600',
    marginLeft: 4,
    fontSize: 12,
  },
  previewContainer: {
    flex: 1,
    backgroundColor: 'white',
    margin: 16,
    borderRadius: 8,
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 20,
    borderBottomWidth: 2,
    borderBottomColor: '#007bff',
  },
  companyInfo: {
    flex: 1,
  },
  companyName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007bff',
    marginBottom: 4,
  },
  companyTagline: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  logoPlaceholder: {
    width: 100,
    height: 70,
    backgroundColor: 'none',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 12,
    textAlign: 'center',
  },
  invoiceTitleContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  invoiceMainTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    letterSpacing: 2,
  },
  invoiceDetailsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  invoiceInfoSection: {
    flex: 1,
    marginRight: 20,
  },
  billToSection: {
    flex: 1,
  },
  billToTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#007bff',
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#007bff',
    paddingBottom: 4,
  },
  detailText: {
    fontSize: 14,
    marginBottom: 6,
    color: '#333',
  },
  boldText: {
    fontWeight: 'bold',
  },
  projectDescriptionContainer: {
    margin: 20,
    marginTop: 0,
    padding: 15,
    backgroundColor: '#f8f9fa',
    borderLeftWidth: 4,
    borderLeftColor: '#007bff',
    borderRadius: 4,
  },
  projectDescriptionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#007bff',
    marginBottom: 8,
  },
  projectDescriptionText: {
    fontSize: 14,
    color: '#333',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#007bff',
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  tableHeaderText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 12,
    textAlign: 'left',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  tableCellText: {
    fontSize: 12,
    color: '#333',
  },
  numberCell: {
    textAlign: 'center',
    fontWeight: 'bold',
  },
  centerText: {
    textAlign: 'center',
  },
  amountText: {
    textAlign: 'right',
    fontWeight: 'bold',
  },
  totalsContainer: {
    alignItems: 'flex-end',
    padding: 20,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    minWidth: 250,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#f8f9fa',
  },
  totalLabel: {
    fontWeight: 'bold',
    fontSize: 14,
  },
  totalValue: {
    fontWeight: 'bold',
    fontSize: 14,
  },
  grandTotalRow: {
    backgroundColor: '#007bff',
  },
  grandTotalLabel: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  grandTotalValue: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  discountRow: {
    backgroundColor: '#fff3cd',
  },
  discountLabel: {
    color: '#856404',
    fontWeight: 'bold',
    fontSize: 14,
  },
  discountValue: {
    color: '#856404',
    fontWeight: 'bold',
    fontSize: 14,
  },
  finalTotalRow: {
    backgroundColor: '#28a745',
  },
  finalTotalLabel: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  finalTotalValue: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  paymentSummaryContainer: {
    padding: 20,
    backgroundColor: '#f8f9fa',
    margin: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  paymentSummaryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#007bff',
    marginBottom: 12,
    textAlign: 'center',
  },
  paymentSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#dee2e6',
    backgroundColor: 'white',
  },
  paymentSummaryLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  paymentSummaryValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  paidAmountRow: {
    backgroundColor: '#d4edda',
  },
  paidAmountLabel: {
    color: '#155724',
  },
  paidAmountValue: {
    color: '#155724',
  },
  outstandingAmountRow: {
    backgroundColor: '#f8d7da',
  },
  outstandingAmountLabel: {
    color: '#721c24',
  },
  outstandingAmountValue: {
    color: '#721c24',
  },
  paymentHistoryContainer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#dee2e6',
  },
  paymentHistoryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#007bff',
    marginBottom: 12,
  },
  paymentHistoryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 6,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  paymentHistoryLeft: {
    flex: 1,
  },
  paymentHistoryDate: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  paymentHistoryRef: {
    fontSize: 11,
    color: '#666',
    fontFamily: 'monospace',
  },
  paymentHistoryRight: {
    alignItems: 'flex-end',
  },
  paymentHistoryAmount: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#28a745',
  },
  paymentHistoryProvider: {
    fontSize: 10,
    color: '#666',
    marginTop: 2,
  },
  previewActionButtons: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#dee2e6',
  },
  previewPayButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#28a745',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  previewPayButtonText: {
    color: 'white',
    fontWeight: 'bold',
    marginLeft: 8,
    fontSize: 16,
  },
  termsContainer: {
    padding: 20,
    paddingTop: 0,
  },
  termRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  termLabel: {
    fontWeight: 'bold',
    color: '#007bff',
    minWidth: 140,
    fontSize: 14,
  },
  termValue: {
    flex: 1,
    fontSize: 14,
    color: '#333',
  },
  signatureContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 20,
    paddingTop: 40,
    borderTopWidth: 1,
    borderTopColor: '#ddd',
  },
  signatureBox: {
    alignItems: 'center',
    width: 150,
  },
  signatureImageContainer: {
    height: 60,
    width: 180,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 5,
  },
  signatureImage: {
    width: 180,
    height: 50,
  },
  signatureLineBottom: {
    borderTopWidth: 1,
    borderTopColor: '#333',
    width: '100%',
    marginBottom: 5,
  },
  signatureLine: {
    borderTopWidth: 1,
    borderTopColor: '#333',
    width: '100%',
    height: 40,
    marginBottom: 8,
  },
  signatureLabel: {
    fontWeight: 'bold',
    fontSize: 14,
    color: '#333',
  },
  paymentModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  paymentModalContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 0,
    width: width * 0.9,
    maxWidth: 400,
  },
  paymentModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  paymentModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  paymentModalContent: {
    padding: 20,
  },
  invoiceNumberText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007bff',
    marginBottom: 20,
    textAlign: 'center',
  },
  paymentAmountInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f8f9fa',
    marginBottom: 2,
  },
  paymentInfoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  paymentInfoValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  outstandingText: {
    color: '#dc3545',
  },
  paymentInputContainer: {
    marginTop: 20,
    marginBottom: 20,
  },
  paymentInputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  paymentInput: {
    borderWidth: 2,
    borderColor: '#007bff',
    borderRadius: 8,
    padding: 12,
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'right',
    backgroundColor: 'white',
  },
  paymentInputHint: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    textAlign: 'center',
  },
  paymentQuickAmounts: {
    marginBottom: 20,
  },
  quickAmountsLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  quickAmountsButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  quickAmountButton: {
    backgroundColor: '#e9ecef',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    minWidth: 60,
    alignItems: 'center',
  },
  quickAmountText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#007bff',
  },
  proceedPaymentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#28a745',
    paddingVertical: 14,
    borderRadius: 8,
  },
  disabledButton: {
    backgroundColor: '#6c757d',
  },
  proceedPaymentText: {
    color: 'white',
    fontWeight: 'bold',
    marginLeft: 8,
    fontSize: 16,
  },
  paymentHistoryScroll: {
    flex: 1,
    backgroundColor: 'white',
  },
  paymentHistoryHeader: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  paymentHistoryInvoiceNo: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#007bff',
    marginBottom: 15,
    textAlign: 'center',
  },
  paymentHistorySummary: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  paymentHistorySummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#dee2e6',
  },
  paymentHistorySummaryLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  paymentHistorySummaryValue: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  paidColor: {
    color: '#28a745',
  },
  outstandingColor: {
    color: '#dc3545',
  },
  paymentsList: {
    padding: 20,
  },
  paymentsListTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#007bff',
    marginBottom: 16,
    textAlign: 'center',
  },
  paymentRecord: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  paymentRecordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  paymentRecordLeft: {
    flex: 1,
  },
  paymentRecordAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#28a745',
    marginBottom: 2,
  },
  paymentRecordDate: {
    fontSize: 12,
    color: '#333',
  },
  paymentRecordRight: {
    alignItems: 'flex-end',
  },
  paymentProviderBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 2,
  },
  paymentProviderText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 10,
    textTransform: 'uppercase',
  },
  paymentRecordRef: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'monospace',
    marginTop: 4,
  },
  paymentRecordTxId: {
    fontSize: 11,
    color: '#888',
    fontFamily: 'monospace',
    marginTop: 2,
  },
  noPaymentsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  noPaymentsText: {
    fontSize: 16,
    color: '#6b7280',
    marginTop: 16,
    fontWeight: '600',
    textAlign: 'center',
  }
});