import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
  Modal,
  TextInput,
  Switch,
  Image,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import api from '../utils/api';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '../store/store';
import CustomButton from '../components/CustomButton';
import * as ImagePicker from 'expo-image-picker'; 
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { ActivityIndicator, Button } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

const { width } = Dimensions.get('window');

const normalizeId = (id: string) =>
  /^[0-9a-fA-F]{24}$/.test(id) ? id : id.padStart(24, '0');



type Invoice = {
  id: string;
  amount: number;
  status: string;
  service?: string;
  date?: string;
};

type Notification = {
  id: string | number;
  title: string;
  message: string;
  time: string;
  type: string;
};

type Service = {
  name: string;
  icon: string;
  description: string;
};


type Job = {
  id: string;
  service: string;
  status: string;
  date: string;
  worker?: string | null;
  amount?: number;
  progress?: number;
  address?: string;
  description?: string;
  feedback?: {
    rating: number;
    comment?: string;
  };
  complaints?: {
    title: string;
    description: string;
    status: string;
  }[];
};

export default function CustomerHome({ navigation }: any) {
  const dispatch = useDispatch<AppDispatch>();
  const { user } = useSelector((s: RootState) => s.auth);

  const [profile, setProfile] = useState<any | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showJobForm, setShowJobForm] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [installmentMode, setInstallmentMode] = useState(false);
  
const [selectedJob, setSelectedJob] = useState<Job | null>(null);
const [showJobDetailsModal, setShowJobDetailsModal] = useState(false);

const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
const [showInvoiceDetailsModal, setShowInvoiceDetailsModal] = useState(false);

const [showComplaintModal, setShowComplaintModal] = useState(false);
const [showFeedbackModal, setShowFeedbackModal] = useState(false);
const [complaintTitle, setComplaintTitle] = useState('');
const [complaintText, setComplaintText] = useState('');
const [feedbackText, setFeedbackText] = useState('');
const [rating, setRating] = useState(0);
const [submitting, setSubmitting] = useState(false);
const [notifications, setNotifications] = useState<Notification[]>([]);
const [unreadCount, setUnreadCount] = useState(0);
const [prevJobs, setPrevJobs] = useState<Job[]>([]);
const [prevInvoices, setPrevInvoices] = useState<Invoice[]>([]);

  // Installmental Plan Form State
  const [installForm, setInstallForm] = useState({
    clientName: '',
    clientAddress: '',
    clientPhone: '',
    clientEmail: '',
    clientIdType: '',
    clientIdNo: '',
    projectDescription: '',
    totalCost: '',
    downPayment: '',
    balance: '',
    monthlyInstallment: '',
    passportPhoto: null as string | null,
    guarantor1: {
      name: '',
      address: '',
      phone: '',
      occupation: '',
      idType: '',
      idNo: '',
    },
    guarantor2: {
      name: '',
      address: '',
      phone: '',
      occupation: '',
      idType: '',
      idNo: '',
    },
  });

  const [paymentSchedule, setPaymentSchedule] = useState(
    Array.from({ length: 18 }, (_, i) => ({
      no: i + 1,
      dueDate: '',
      amount: '',
      balance: i === 17 ? '0.00' : '',
      initials: '',
    }))
  );

  const services: Service[] = [
    { name: 'Solar Energy', icon: 'sun', description: 'Complete solar installation' },
    { name: 'Smart Home', icon: 'home', description: 'Home automation systems' },
    { name: 'Security', icon: 'shield', description: 'Advanced security solutions' },
    { name: 'Audio Systems', icon: 'music', description: 'Digital audio & sound' },
  ];

  useEffect(() => {
  if (prevJobs.length > 0) {
    jobs.forEach(job => {
      const oldJob = prevJobs.find(j => j.id === job.id);
      if (oldJob && oldJob.status !== job.status) {
        setNotifications(n => [
          {
            id: Date.now(),
            title: 'Job Status Updated',
            message: `Your "${job.service}" job is now "${job.status}".`,
            time: new Date().toLocaleTimeString(),
            type: 'job',
            unread: true,
          },
          ...n,
        ]);
        setUnreadCount(c => c + 1);
      }
    });
    // Detect new jobs
    jobs.forEach(job => {
      if (!prevJobs.find(j => j.id === job.id)) {
        setNotifications(n => [
          {
            id: Date.now(),
            title: 'New Job Created',
            message: `Your "${job.service}" job has been created.`,
            time: new Date().toLocaleTimeString(),
            type: 'job',
            unread: true,
          },
          ...n,
        ]);
        setUnreadCount(c => c + 1);
      }
    });
  }
  setPrevJobs(jobs);
}, [jobs]);

// Detect new invoices
useEffect(() => {
  if (prevInvoices.length > 0) {
    invoices.forEach(inv => {
      if (!prevInvoices.find(i => i.id === inv.id)) {
        setNotifications(n => [
          {
            id: Date.now(),
            title: 'New Invoice',
            message: `Invoice for "${inv.service}" has been generated.`,
            time: new Date().toLocaleTimeString(),
            type: 'payment',
            unread: true,
          },
          ...n,
        ]);
        setUnreadCount(c => c + 1);
      }
    });
  }
  setPrevInvoices(invoices);
}, [invoices]);

// When notifications are opened, mark all as read
const handleOpenNotifications = () => {
  setShowNotifications(true);
  setNotifications(n => n.map(notif => ({ ...notif, unread: false })));
  setUnreadCount(0);
};

  const fetchAll = async () => {
    try {
      setLoading(true);
      const profileRes = await api.get('/users/me');
      setProfile(profileRes.data);

      const [jobsRes, invoicesRes] = await Promise.all([
        api.get('/jobs/my'),
        api.get('/invoices'),
      ]);

      const jobsWithProgress = (jobsRes.data || []).map((job: any) => ({
        id: job.id || job._id,
        service: job.serviceType || job.service || 'Service',
        status: job.status || 'pending',
        date: job.createdAt
          ? new Date(job.createdAt).toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0],
        worker: job.workerName || job.worker || null,
        amount: job.amount || 0,
        progress:
          job.status === 'ongoing'
            ? Math.floor(Math.random() * 80) + 10
            : job.status === 'completed'
            ? 100
            : 0,
      }));
      setJobs(jobsWithProgress);

      const invoiceList = (invoicesRes.data || []).map((invoice: any) => ({
        id: invoice.id || invoice._id,
        amount: invoice.amount || 0,
        status: invoice.status || 'pending',
        service: invoice.serviceType || 'Service',
        date: invoice.createdAt
          ? new Date(invoice.createdAt).toISOString().split('T')[0]
          : '',
      }));
      setInvoices(invoiceList);
    } catch (err: any) {
      console.error('Fetch error:', err.response?.data || err.message || err);
      Alert.alert('Error', err?.response?.data?.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAll();
    setRefreshing(false);
  }, []);

  useEffect(() => {
    fetchAll();
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return { bg: '#dcfce7', text: '#166534' };
      case 'ongoing':
        return { bg: '#dbeafe', text: '#1d4ed8' };
      case 'pending':
        return { bg: '#fef3c7', text: '#92400e' };
      default:
        return { bg: '#f3f4f6', text: '#374151' };
    }
  };

  const submitComplaint = async () => {
  if (!complaintTitle || !complaintText || !selectedJob) return;
  setSubmitting(true);
  try {
    const newComplaint = {
      title: complaintTitle,
      description: complaintText,
      status: 'pending',
    };
    setJobs(jobs =>
      jobs.map(job =>
        job.id === selectedJob.id
          ? {
              ...job,
              complaints: job.complaints
                ? [...job.complaints, newComplaint]
                : [newComplaint],
            }
          : job
      )
    );
    setSelectedJob(job =>
      job
        ? {
            ...job,
            complaints: job.complaints
              ? [...job.complaints, newComplaint]
              : [newComplaint],
          }
        : job
    );
    setComplaintTitle('');
    setComplaintText('');
    setShowComplaintModal(false);
  } catch (e) {
    Alert.alert('Error', 'Failed to submit complaint');
  }
  setSubmitting(false);
};

const submitFeedback = async () => {
  if (!feedbackText || !rating || !selectedJob) return;
  setSubmitting(true);
  try {
    const newFeedback = {
      rating,
      comment: feedbackText,
    };
    setJobs(jobs =>
      jobs.map(job =>
        job.id === selectedJob.id
          ? { ...job, feedback: newFeedback }
          : job
      )
    );
    setSelectedJob(job =>
      job ? { ...job, feedback: newFeedback } : job
    );
    setFeedbackText('');
    setRating(0);
    setShowFeedbackModal(false);
  } catch (e) {
    Alert.alert('Error', 'Failed to submit feedback');
  }
  setSubmitting(false);
};


  const handlePickPassport = async () => {
  let result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.7,
  });
  if (!result.canceled && result.assets && result.assets.length > 0) {
    setInstallForm(f => ({ ...f, passportPhoto: result.assets[0].uri }));
  }
};

  const handleGeneratePDF = async () => {
  // Build HTML from form data
  const html = `
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: Arial, sans-serif; color: #222; background: #f3f4f6; }
          h1 { color: #1d4ed8; margin-bottom: 0; }
          h2 { color: #1d4ed8; margin-top: 24px; }
          .section { margin-bottom: 18px; border-radius: 8px; padding: 16px; }
          .section-blue { background: #e0e7ff; }
          .section-white { background: #fff; }
          .label { font-weight: bold; color: #1d4ed8; }
          .note { color: #1d4ed8; font-weight: bold; margin-top: 12px; }
          table { width: 100%; border-collapse: collapse; margin-top: 8px; }
          th, td { border: 1px solid #d1d5db; padding: 4px; font-size: 12px; text-align: center; }
          .photo { margin: 16px 0; text-align: center; }
          .photo img { border-radius: 8px; width: 100px; height: 100px; object-fit: cover; }
        </style>
      </head>
      <body>
        <div class="section section-blue" style="text-align:center;">
          <h1>DARLYN ALT GLOBAL</h1>
          <div>📍 Address | 📞 Phone | ✉ Email | 🌐 Website</div>
          <h2>18-MONTH INSTALLMENT PAYMENT AGREEMENT FORM</h2>
        </div>
        <div class="photo">
          <span class="label">Client’s Passport Photograph:</span><br/>
          ${installForm.passportPhoto ? `<img src="${installForm.passportPhoto}" />` : '[Attach Here]'}
        </div>
        <div class="section section-blue">
          <span class="label">SECTION A – CLIENT INFORMATION</span><br/>
          <b>Full Name:</b> ${installForm.clientName}<br/>
          <b>Address:</b> ${installForm.clientAddress}<br/>
          <b>Phone Number:</b> ${installForm.clientPhone}<br/>
          <b>Email Address:</b> ${installForm.clientEmail}<br/>
          <b>ID Type & No.:</b> ${installForm.clientIdType} ${installForm.clientIdNo}
        </div>
        <div class="section section-white">
          <span class="label">SECTION B – PROJECT / SERVICE DESCRIPTION</span><br/>
          <b>Project Description:</b> ${installForm.projectDescription}<br/>
          <b>Total Project Cost (₦):</b> ${installForm.totalCost}<br/>
          <b>Down Payment (20%) (₦):</b> ${installForm.downPayment}<br/>
          <b>Balance (₦):</b> ${installForm.balance}<br/>
          <b>Installment Duration:</b> 18 Months<br/>
          <b>Monthly Installment (₦):</b> ${installForm.monthlyInstallment}
        </div>
        <div class="section section-blue">
          <span class="label">SECTION C – PAYMENT SCHEDULE</span>
          <table>
            <tr>
              <th>No.</th>
              <th>Due Date</th>
              <th>Amount (₦)</th>
              <th>Balance (₦)</th>
              <th>Client Initials</th>
            </tr>
            ${paymentSchedule.map(row => `
              <tr>
                <td>${row.no}</td>
                <td>${row.dueDate}</td>
                <td>${row.amount}</td>
                <td>${row.balance}</td>
                <td>${row.initials}</td>
              </tr>
            `).join('')}
          </table>
        </div>
        <div class="section section-white">
          <span class="label">SECTION D – GUARANTORS’ DETAILS</span><br/>
          <b>Guarantor 1</b><br/>
          Full Name: ${installForm.guarantor1.name}<br/>
          Address: ${installForm.guarantor1.address}<br/>
          Phone Number: ${installForm.guarantor1.phone}<br/>
          Occupation: ${installForm.guarantor1.occupation}<br/>
          ID Type & Number: ${installForm.guarantor1.idType} ${installForm.guarantor1.idNo}<br/>
          <b>Guarantor 2</b><br/>
          Full Name: ${installForm.guarantor2.name}<br/>
          Address: ${installForm.guarantor2.address}<br/>
          Phone Number: ${installForm.guarantor2.phone}<br/>
          Occupation: ${installForm.guarantor2.occupation}<br/>
          ID Type & Number: ${installForm.guarantor2.idType} ${installForm.guarantor2.idNo}
        </div>
        <div class="section section-blue">
          <span class="label">SECTION E – TERMS & CONDITIONS</span><br/>
          Client shall pay 20% down payment before installation commences.<br/>
          Balance is spread over 18 months, payable monthly.<br/>
          All payments must be made on or before the due date.<br/>
          Default of more than 2 consecutive payments may result in suspension or removal of installed equipment.<br/>
          Installed equipment remains the property of Darlyn Alt Global until full payment is completed.<br/>
          This agreement is binding with the client’s passport photograph, postal stamp, and guarantors’ signatures attached.
        </div>
        <div class="section section-white">
          <span class="label">SECTION F – SIGNATURES</span><br/>
          Client’s Signature: ___________________ Date: __________<br/>
          Darlyn Alt Global Rep: ________________ Date: __________<br/>
          Witness: ___________________ Date: __________<br/>
          <span class="label">Postal Stamp Here [Affix ₦100 Stamp Duty]</span>
        </div>
        <div class="note">
          This form is legally stronger with the postal stamp (stamp duty) and two guarantors, making it enforceable.<br/>
          This Document must be printed In coloured.
        </div>
      </body>
    </html>
  `;

  try {
    const { uri } = await Print.printToFileAsync({ html });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri);
    } else {
      Alert.alert('PDF Generated', 'PDF file created at: ' + uri);
    }
  } catch (err) {
    let message = 'Unknown error';
    if (err instanceof Error) {
      message = err.message;
    }
    Alert.alert('PDF Error', 'Failed to generate PDF: ' + message);
  }
};

  const NotificationModal = () => (
  <Modal
    visible={showNotifications}
    animationType="slide"
    presentationStyle="pageSheet"
    onRequestClose={() => setShowNotifications(false)}
  >
    <View style={styles.modalContainer}>
      <View style={styles.modalHeader}>
        <Text style={styles.modalTitle}>Notifications</Text>
        <TouchableOpacity onPress={() => setShowNotifications(false)}>
          <Icon name="x" size={24} color="#374151" />
        </TouchableOpacity>
      </View>
      <ScrollView style={styles.modalContent}>
        {notifications.length === 0 ? (
          <Text style={{ color: '#9ca3af', textAlign: 'center', marginTop: 40 }}>No notifications yet.</Text>
        ) : (
          notifications.map((notification) => (
            <View key={notification.id} style={styles.notificationItem}>
              <View
                style={[
                  styles.notificationIcon,
                  {
                    backgroundColor:
                      notification.type === 'job'
                        ? '#dbeafe'
                        : notification.type === 'payment'
                        ? '#fef3c7'
                        : '#dcfce7',
                  },
                ]}
              >
                <Icon
                  name={
                    notification.type === 'job'
                      ? 'briefcase'
                      : notification.type === 'payment'
                      ? 'credit-card'
                      : 'message-circle'
                  }
                  size={16}
                  color={
                    notification.type === 'job'
                      ? '#1d4ed8'
                      : notification.type === 'payment'
                      ? '#92400e'
                      : '#166534'
                  }
                />
              </View>
              <View style={styles.notificationContent}>
                <Text style={styles.notificationTitle}>{notification.title}</Text>
                <Text style={styles.notificationMessage}>{notification.message}</Text>
                <Text style={styles.notificationTime}>{notification.time}</Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  </Modal>
);

  // Installmental Plan Form UI
  const InstallmentalPlanForm = () => (
    <ScrollView style={{ flex: 1, backgroundColor: '#fff' }}>
      {/* Header */}
      <View style={{ backgroundColor: '#1d4ed8', padding: 16, alignItems: 'center' }}>
        <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 20 }}>DARLYN ALT GLOBAL</Text>
        <Text style={{ color: '#bfdbfe', marginTop: 2 }}>📍 Address | 📞 Phone | ✉ Email | 🌐 Website</Text>
        <Text style={{ color: '#fff', fontWeight: 'bold', marginTop: 8, fontSize: 16 }}>
          18-MONTH INSTALLMENT PAYMENT AGREEMENT FORM
        </Text>
      </View>
      {/* Passport Photo */}
      <View style={{ alignItems: 'center', marginTop: 16 }}>
        <TouchableOpacity
          style={{
            borderWidth: 2,
            borderColor: '#1d4ed8',
            borderRadius: 8,
            padding: 8,
            backgroundColor: '#e0e7ff',
            marginBottom: 8,
          }}
          onPress={handlePickPassport}
        >
          {installForm.passportPhoto ? (
            <Image source={{ uri: installForm.passportPhoto }} style={{ width: 100, height: 100, borderRadius: 8 }} />
          ) : (
            <Text style={{ color: '#1d4ed8' }}>Attach Passport Photograph</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* SECTION A */}
      <View style={styles.sectionBlue}>
        <Text style={styles.sectionTitleBlue}>SECTION A – CLIENT INFORMATION</Text>
        <TextInput style={styles.formInput} placeholder="Full Name" value={installForm.clientName} onChangeText={v => setInstallForm(f => ({ ...f, clientName: v }))} />
        <TextInput style={styles.formInput} placeholder="Address" value={installForm.clientAddress} onChangeText={v => setInstallForm(f => ({ ...f, clientAddress: v }))} />
        <TextInput style={styles.formInput} placeholder="Phone Number" value={installForm.clientPhone} onChangeText={v => setInstallForm(f => ({ ...f, clientPhone: v }))} keyboardType="phone-pad" />
        <TextInput style={styles.formInput} placeholder="Email Address" value={installForm.clientEmail} onChangeText={v => setInstallForm(f => ({ ...f, clientEmail: v }))} keyboardType="email-address" />
        <TextInput style={styles.formInput} placeholder="ID Type" value={installForm.clientIdType} onChangeText={v => setInstallForm(f => ({ ...f, clientIdType: v }))} />
        <TextInput style={styles.formInput} placeholder="ID Number" value={installForm.clientIdNo} onChangeText={v => setInstallForm(f => ({ ...f, clientIdNo: v }))} />
      </View>

      {/* SECTION B */}
      <View style={styles.sectionWhite}>
        <Text style={styles.sectionTitleBlue}>SECTION B – PROJECT / SERVICE DESCRIPTION</Text>
        <TextInput style={styles.formInput} placeholder="Project Description" value={installForm.projectDescription} onChangeText={v => setInstallForm(f => ({ ...f, projectDescription: v }))} />
        <TextInput style={styles.formInput} placeholder="Total Project Cost (₦)" value={installForm.totalCost} onChangeText={v => setInstallForm(f => ({ ...f, totalCost: v }))} keyboardType="numeric" />
        <TextInput style={styles.formInput} placeholder="Down Payment (20%) (₦)" value={installForm.downPayment} onChangeText={v => setInstallForm(f => ({ ...f, downPayment: v }))} keyboardType="numeric" />
        <TextInput style={styles.formInput} placeholder="Balance (₦)" value={installForm.balance} onChangeText={v => setInstallForm(f => ({ ...f, balance: v }))} keyboardType="numeric" />
        <Text style={{ color: '#1d4ed8', fontWeight: 'bold', marginTop: 8 }}>Installment Duration: 18 Months</Text>
        <TextInput style={styles.formInput} placeholder="Monthly Installment (₦)" value={installForm.monthlyInstallment} onChangeText={v => setInstallForm(f => ({ ...f, monthlyInstallment: v }))} keyboardType="numeric" />
      </View>

      {/* SECTION C */}
      <View style={styles.sectionBlue}>
        <Text style={styles.sectionTitleBlue}>SECTION C – PAYMENT SCHEDULE</Text>
        <View style={{ flexDirection: 'row', marginBottom: 8 }}>
          <Text style={styles.paymentHeader}>No.</Text>
          <Text style={styles.paymentHeader}>Due Date</Text>
          <Text style={styles.paymentHeader}>Amount</Text>
          <Text style={styles.paymentHeader}>Balance</Text>
          <Text style={styles.paymentHeader}>Initials</Text>
        </View>
        {paymentSchedule.map((row, idx) => (
          <View key={idx} style={{ flexDirection: 'row', marginBottom: 4 }}>
            <Text style={styles.paymentCell}>{row.no}</Text>
            <TextInput style={styles.paymentCellInput} placeholder="Due Date" value={row.dueDate} onChangeText={v => {
              const updated = [...paymentSchedule];
              updated[idx].dueDate = v;
              setPaymentSchedule(updated);
            }} />
            <TextInput style={styles.paymentCellInput} placeholder="Amount" value={row.amount} keyboardType="numeric" onChangeText={v => {
              const updated = [...paymentSchedule];
              updated[idx].amount = v;
              setPaymentSchedule(updated);
            }} />
            <TextInput style={styles.paymentCellInput} placeholder="Balance" value={row.balance} keyboardType="numeric" onChangeText={v => {
              const updated = [...paymentSchedule];
              updated[idx].balance = v;
              setPaymentSchedule(updated);
            }} />
            <TextInput style={styles.paymentCellInput} placeholder="Initials" value={row.initials} onChangeText={v => {
              const updated = [...paymentSchedule];
              updated[idx].initials = v;
              setPaymentSchedule(updated);
            }} />
          </View>
        ))}
      </View>

      {/* SECTION D */}
      <View style={styles.sectionWhite}>
        <Text style={styles.sectionTitleBlue}>SECTION D – GUARANTORS’ DETAILS</Text>
        <Text style={{ fontWeight: 'bold', color: '#1d4ed8', marginTop: 8 }}>Guarantor 1</Text>
        <TextInput style={styles.formInput} placeholder="Full Name" value={installForm.guarantor1.name} onChangeText={v => setInstallForm(f => ({ ...f, guarantor1: { ...f.guarantor1, name: v } }))} />
        <TextInput style={styles.formInput} placeholder="Address" value={installForm.guarantor1.address} onChangeText={v => setInstallForm(f => ({ ...f, guarantor1: { ...f.guarantor1, address: v } }))} />
        <TextInput style={styles.formInput} placeholder="Phone Number" value={installForm.guarantor1.phone} onChangeText={v => setInstallForm(f => ({ ...f, guarantor1: { ...f.guarantor1, phone: v } }))} keyboardType="phone-pad" />
        <TextInput style={styles.formInput} placeholder="Occupation" value={installForm.guarantor1.occupation} onChangeText={v => setInstallForm(f => ({ ...f, guarantor1: { ...f.guarantor1, occupation: v } }))} />
        <TextInput style={styles.formInput} placeholder="ID Type" value={installForm.guarantor1.idType} onChangeText={v => setInstallForm(f => ({ ...f, guarantor1: { ...f.guarantor1, idType: v } }))} />
        <TextInput style={styles.formInput} placeholder="ID Number" value={installForm.guarantor1.idNo} onChangeText={v => setInstallForm(f => ({ ...f, guarantor1: { ...f.guarantor1, idNo: v } }))} />

        <Text style={{ fontWeight: 'bold', color: '#1d4ed8', marginTop: 8 }}>Guarantor 2</Text>
        <TextInput style={styles.formInput} placeholder="Full Name" value={installForm.guarantor2.name} onChangeText={v => setInstallForm(f => ({ ...f, guarantor2: { ...f.guarantor2, name: v } }))} />
        <TextInput style={styles.formInput} placeholder="Address" value={installForm.guarantor2.address} onChangeText={v => setInstallForm(f => ({ ...f, guarantor2: { ...f.guarantor2, address: v } }))} />
        <TextInput style={styles.formInput} placeholder="Phone Number" value={installForm.guarantor2.phone} onChangeText={v => setInstallForm(f => ({ ...f, guarantor2: { ...f.guarantor2, phone: v } }))} keyboardType="phone-pad" />
        <TextInput style={styles.formInput} placeholder="Occupation" value={installForm.guarantor2.occupation} onChangeText={v => setInstallForm(f => ({ ...f, guarantor2: { ...f.guarantor2, occupation: v } }))} />
        <TextInput style={styles.formInput} placeholder="ID Type" value={installForm.guarantor2.idType} onChangeText={v => setInstallForm(f => ({ ...f, guarantor2: { ...f.guarantor2, idType: v } }))} />
        <TextInput style={styles.formInput} placeholder="ID Number" value={installForm.guarantor2.idNo} onChangeText={v => setInstallForm(f => ({ ...f, guarantor2: { ...f.guarantor2, idNo: v } }))} />
      </View>

      {/* SECTION E */}
      <View style={styles.sectionBlue}>
        <Text style={styles.sectionTitleBlue}>SECTION E – TERMS & CONDITIONS</Text>
        <Text style={{ color: '#374151', marginBottom: 8 }}>
          Client shall pay 20% down payment before installation commences.{"\n"}
          Balance is spread over 18 months, payable monthly.{"\n"}
          All payments must be made on or before the due date.{"\n"}
          Default of more than 2 consecutive payments may result in suspension or removal of installed equipment.{"\n"}
          Installed equipment remains the property of Darlyn Alt Global until full payment is completed.{"\n"}
          This agreement is binding with the client’s passport photograph, postal stamp, and guarantors’ signatures attached.
        </Text>
      </View>

      {/* SECTION F */}
      <View style={styles.sectionWhite}>
        <Text style={styles.sectionTitleBlue}>SECTION F – SIGNATURES</Text>
        <Text style={{ color: '#374151', marginBottom: 8 }}>Client’s Signature: ___________________ Date: __________</Text>
        <Text style={{ color: '#374151', marginBottom: 8 }}>Darlyn Alt Global Rep: ________________ Date: __________</Text>
        <Text style={{ color: '#374151', marginBottom: 8 }}>Witness: ___________________ Date: __________</Text>
        <Text style={{ color: '#1d4ed8', fontWeight: 'bold', marginBottom: 8 }}>Postal Stamp Here [Affix ₦100 Stamp Duty]</Text>
      </View>

      {/* Legal Notes */}
      <View style={{ backgroundColor: '#e0e7ff', padding: 12, margin: 16, borderRadius: 8 }}>
        <Text style={{ color: '#1d4ed8', fontWeight: 'bold', marginBottom: 4 }}>
          This form is legally stronger with the postal stamp (stamp duty) and two guarantors, making it enforceable.
        </Text>
        <Text style={{ color: '#1d4ed8', fontWeight: 'bold' }}>
          This Document must be printed In coloured.
        </Text>
      </View>

      <View style={styles.submitButton}>
        <CustomButton title="Generate PDF" onPress={handleGeneratePDF} />
      </View>
    </ScrollView>
  );

  /**
   * Job Booking Modal
   */
  const JobBookingModal = () => {
    const [serviceType, setServiceType] = useState('');
    const [description, setDescription] = useState('');
    const [address, setAddress] = useState('');
    const [loadingSubmit, setLoadingSubmit] = useState(false);

    const handleSubmitJob = async () => {
      if (!serviceType || !description || !address) {
        Alert.alert('Validation Error', 'Please fill all required fields.');
        return;
      }

      try {
        setLoadingSubmit(true);
        const payload = {
          title: `${serviceType} Job`,
          serviceType,
          description,
          address,
          images: [],
          customerId: normalizeId(user?._id || user?.id),
        };

        const res = await api.post('/jobs', payload);

        const newJob = {
          id: res.data.id || res.data._id,
          service: serviceType,
          status: res.data.status || 'pending',
          date: new Date().toISOString().split('T')[0],
          worker: null,
          amount: 0,
          progress: 0,
        };
        setJobs((prevJobs) => [newJob, ...prevJobs]);

        setServiceType('');
        setDescription('');
        setAddress('');
        setShowJobForm(false);

        Alert.alert('Success', 'Service request submitted successfully!');
      } catch (error: any) {
        console.error('Job creation error:', error.response?.data || error.message);
        Alert.alert('Error', error.response?.data?.message || 'Failed to create job');
      } finally {
        setLoadingSubmit(false);
      }
    };

    return (
      <Modal
        visible={showJobForm}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => {
          setShowJobForm(false);
          setInstallmentMode(false);
        }}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Book a Service</Text>
            <TouchableOpacity onPress={() => {
              setShowJobForm(false);
              setInstallmentMode(false);
            }}>
              <Icon name="x" size={24} color="#374151" />
            </TouchableOpacity>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16 }}>
            <Text style={{ fontWeight: '500', marginRight: 8 }}>Installmental Plan</Text>
            <Switch value={installmentMode} onValueChange={setInstallmentMode} />
          </View>
          {installmentMode ? (
            <InstallmentalPlanForm />
          ) : (
            <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Service Type</Text>
                {services.map((service, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.formInput,
                      {
                        marginBottom: 10,
                        backgroundColor: serviceType === service.name ? '#dbeafe' : '#fff',
                      },
                    ]}
                    onPress={() => setServiceType(service.name)}
                  >
                    <Text style={{ color: serviceType === service.name ? '#1d4ed8' : '#374151' }}>
                      {service.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Description</Text>
                <TextInput
                  style={[styles.formInput, styles.textArea]}
                  placeholder="Describe your requirements..."
                  multiline
                  numberOfLines={4}
                  value={description}
                  onChangeText={setDescription}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Address</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="Installation address"
                  value={address}
                  onChangeText={setAddress}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Upload Images (Optional)</Text>
                <TouchableOpacity style={styles.uploadArea}>
                  <Icon name="camera" size={32} color="#9ca3af" />
                  <Text style={styles.uploadText}>Tap to upload images</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.submitButton}>
                <CustomButton
                  title={loadingSubmit ? 'Submitting...' : 'Submit Request'}
                  onPress={handleSubmitJob}
                  disabled={loadingSubmit}
                />
              </View>
            </ScrollView>
          )}
        </View>
      </Modal>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.appTitle}>DARLYN_ALT</Text>
          </View>
          <TouchableOpacity style={styles.notificationButton} onPress={handleOpenNotifications}>
  <Icon name="bell" size={20} color="#fff" />
  {unreadCount > 0 && (
    <View style={styles.notificationBadge}>
      <Text style={styles.notificationBadgeText}>{unreadCount}</Text>
    </View>
  )}
</TouchableOpacity>
        </View>

        {/* Welcome */}
        <View style={styles.welcomeSection}>
          <Text style={styles.welcomeTitle}>Welcome back, {user?.name || profile?.name || 'User'}!</Text>
          <Text style={styles.welcomeSubtitle}>Ready for your next home upgrade?</Text>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActions}>
            <TouchableOpacity style={styles.primaryAction} onPress={() => setShowJobForm(true)}>
              <Icon name="plus" size={20} color="#fff" />
              <Text style={styles.primaryActionText}>Book Service</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryAction}
              onPress={() => navigation.navigate('Invoices')}
            >
              <Icon name="file-text" size={20} color="#374151" />
              <Text style={styles.secondaryActionText}>Invoices</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Services */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Our Services</Text>
          <View style={styles.servicesGrid}>
            {services.map((service, index) => (
              <TouchableOpacity key={index} style={styles.serviceCard}>
                <View style={styles.serviceIconContainer}>
                  <Icon name={service.icon} size={24} color="#2563eb" />
                </View>
                <Text style={styles.serviceName}>{service.name}</Text>
                <Text style={styles.serviceDescription}>{service.description}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Recent Jobs */}
        <View style={styles.section}>
  <View style={styles.sectionHeader}>
    <Text style={styles.sectionTitle}>Recent Jobs</Text>
    <TouchableOpacity onPress={() => navigation.navigate('Jobs')}>
      <Text style={styles.viewAllButton}>View All</Text>
    </TouchableOpacity>
  </View>

  {jobs.length === 0 ? (
    <View style={styles.emptyState}>
      <Icon name="briefcase" size={48} color="#d1d5db" />
      <Text style={styles.emptyText}>No jobs found</Text>
      <Text style={styles.emptySubtext}>Book your first service to get started</Text>
    </View>
  ) : (
    <View style={styles.jobsList}>
      {jobs.slice(0, 2).map((job) => {
        const statusStyle = getStatusColor(job.status);
        return (
          <View
            key={String(job.id)}
            style={styles.jobCard}
          >
            <View style={styles.jobHeader}>
              <Text style={styles.jobTitle}>{job.service}</Text>
              <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
                <Text style={[styles.statusText, { color: statusStyle.text }]}>{job.status}</Text>
              </View>
            </View>

            <View style={styles.jobMeta}>
              <View style={styles.jobMetaItem}>
                <Icon name="calendar" size={14} color="#6b7280" />
                <Text style={styles.jobMetaText}>{job.date}</Text>
              </View>
              {job.worker && (
                <View style={styles.jobMetaItem}>
                  <Icon name="user" size={14} color="#6b7280" />
                  <Text style={styles.jobMetaText}>{job.worker}</Text>
                </View>
              )}
              <View style={styles.jobMetaItem}>
                <Icon name="credit-card" size={14} color="#6b7280" />
                <Text style={styles.jobMetaText}>₦{(job.amount ?? 0).toLocaleString()}</Text>
              </View>
            </View>

            {job.status === 'ongoing' && job.progress !== undefined && (
              <View style={styles.progressSection}>
                <View style={styles.progressHeader}>
                  <Text style={styles.progressLabel}>Progress</Text>
                  <Text style={styles.progressValue}>{job.progress}%</Text>
                </View>
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${job.progress}%` }]} />
                </View>
              </View>
            )}

          
          </View>
        );
      })}
    </View>
  )}
</View>

        {/* Recent Invoices */}
        <View style={[styles.section, { marginBottom: 20 }]}>
  <Text style={styles.sectionTitle}>Recent Invoices</Text>
  {invoices.length === 0 ? (
    <View style={styles.emptyState}>
      <Icon name="file-text" size={48} color="#d1d5db" />
      <Text style={styles.emptyText}>No invoices available</Text>
    </View>
  ) : (
    <View style={styles.invoicesList}>
      {invoices.slice(0, 2).map((invoice) => (
        <View
          key={String(invoice.id)}
          style={styles.invoiceCard}
        >
          <View style={styles.invoiceHeader}>
            <View style={styles.invoiceIconContainer}>
              <Icon name="file-text" size={18} color="#2563eb" />
            </View>
            <View style={styles.invoiceInfo}>
              <Text style={styles.invoiceTitle}>{invoice.service || 'Invoice'}</Text>
              <Text style={styles.invoiceMeta}>
                {invoice.date} • {invoice.status}
              </Text>
            </View>
            <Text style={styles.invoiceAmount}>₦{invoice.amount?.toLocaleString()}</Text>
          </View>
        </View>
      ))}
    </View>
  )}
</View>

       

{showJobDetailsModal && selectedJob && (
  // ...existing code...

<Modal visible={showJobDetailsModal && !!selectedJob} animationType="slide" onRequestClose={() => setShowJobDetailsModal(false)}>
  <View style={styles.modalContainer}>
    <View style={styles.modalHeader}>
      <Text style={styles.modalTitle}>{selectedJob?.service}</Text>
      <TouchableOpacity onPress={() => setShowJobDetailsModal(false)}>
        <Text style={styles.closeButton}>Close</Text>
      </TouchableOpacity>
    </View>

    <ScrollView style={styles.modalContent}>
      {/* Job Details */}
      <View style={styles.modalSection}>
        <Text style={styles.sectionLabel}>Status</Text>
        <View style={[styles.statusBadgeLarge, { backgroundColor: getStatusColor(selectedJob?.status || '').bg }]}>
          <Text style={[styles.statusTextLarge, { color: getStatusColor(selectedJob?.status || '').text }]}>
            {selectedJob?.status}
          </Text>
        </View>
      </View>

      <View style={styles.modalSection}>
        <Text style={styles.sectionLabel}>Assigned Worker</Text>
        <Text style={styles.sectionValue}>{selectedJob?.worker || 'No worker assigned yet'}</Text>
      </View>

      <View style={styles.modalSection}>
        <Text style={styles.sectionLabel}>Date</Text>
        <Text style={styles.sectionValue}>{selectedJob?.date}</Text>
      </View>

      <View style={styles.modalSection}>
        <Text style={styles.sectionLabel}>Amount</Text>
        <Text style={styles.sectionValue}>₦{selectedJob?.amount?.toLocaleString()}</Text>
      </View>

      {/* Optional fields */}
      {selectedJob?.address && (
        <View style={styles.modalSection}>
          <Text style={styles.sectionLabel}>Address</Text>
          <Text style={styles.sectionValue}>{selectedJob?.address}</Text>
        </View>
      )}
      {selectedJob?.description && (
        <View style={styles.modalSection}>
          <Text style={styles.sectionLabel}>Description</Text>
          <Text style={styles.sectionValue}>{selectedJob?.description}</Text>
        </View>
      )}

      {/* Feedback Section */}
      {selectedJob?.feedback && (
        <View style={styles.modalSection}>
          <Text style={styles.sectionLabel}>Your Feedback</Text>
          <Text style={styles.sectionValue}>
            ⭐ {selectedJob.feedback.rating} - {selectedJob.feedback.comment || 'No comment'}
          </Text>
        </View>
      )}

      {/* Complaints Section */}
      {selectedJob?.complaints && selectedJob.complaints.length > 0 && (
  <View style={styles.modalSection}>
    <Text style={styles.sectionLabel}>Complaints</Text>
    {selectedJob.complaints.map((c, i) => (
      <View key={i} style={styles.complaintCard}>
        <Text style={styles.sectionValue}>• {c.title}</Text>
        <Text style={{ color: '#6b7280' }}>{c.description}</Text>
        <Text style={{ color: '#2563eb', fontSize: 12 }}>Status: {c.status}</Text>
      </View>
    ))}
  </View>
)}

      {/* Action Buttons */}
      <View style={{ marginTop: 20 }}>
        <TouchableOpacity style={styles.actionButton} onPress={() => setShowComplaintModal(true)}>
          <Text style={styles.actionButtonText}>Add Complaint</Text>
        </TouchableOpacity>

        {selectedJob?.status === 'completed' && (
          <TouchableOpacity
            style={[
              styles.actionButton,
              { backgroundColor: selectedJob.feedback ? '#9ca3af' : '#2563eb' },
            ]}
            onPress={() => !selectedJob.feedback && setShowFeedbackModal(true)}
            disabled={!!selectedJob.feedback}
          >
            <Text style={styles.actionButtonText}>
              {selectedJob.feedback ? 'Feedback Submitted' : 'Give Feedback'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Previous Feedback & Complaints */}
      <View style={{ marginTop: 30 }}>
        <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 10 }}>Your Submissions</Text>
        {/* Feedback */}
        <View style={[styles.modalSection, { backgroundColor: '#f9fafb', padding: 12, borderRadius: 8 }]}>
          <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 4 }}>Feedback</Text>
          {selectedJob?.feedback ? (
            <Text style={{ fontSize: 14, color: '#374151' }}>
              ⭐ {selectedJob.feedback.rating} - {selectedJob.feedback.comment || 'No comment provided'}
            </Text>
          ) : (
            <Text style={{ color: '#9ca3af' }}>No feedback submitted yet.</Text>
          )}
        </View>
        {/* Complaints */}
        <View style={[styles.modalSection, { backgroundColor: '#f9fafb', padding: 12, borderRadius: 8, marginTop: 12 }]}>
          <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 4 }}>Complaints</Text>
          {selectedJob?.complaints && selectedJob.complaints.length > 0 ? (
            selectedJob.complaints.map((c, i) => (
              <View key={i} style={{ marginBottom: 8 }}>
                <Text style={{ fontSize: 14, fontWeight: '500' }}>• {c.title}</Text>
                <Text style={{ color: '#6b7280', marginBottom: 2 }}>{c.description}</Text>
                <Text style={{ color: c.status === 'resolved' ? '#16a34a' : '#d97706', fontSize: 12 }}>
                  Status: {c.status === 'resolved' ? 'Resolved ✅' : 'Pending ⏳'}
                </Text>
              </View>
            ))
          ) : (
            <Text style={{ color: '#9ca3af' }}>No complaints submitted yet.</Text>
          )}
        </View>
      </View>
    </ScrollView>
  </View>

  {/* Complaint Modal */}
  <Modal visible={showComplaintModal} animationType="slide" onRequestClose={() => setShowComplaintModal(false)}>
    <View style={styles.formModal}>
      <Text style={styles.modalTitle}>Submit Complaint</Text>
      <TextInput placeholder="Complaint Title" value={complaintTitle} onChangeText={setComplaintTitle} style={styles.textInput} />
      <TextInput
        placeholder="Enter your complaint"
        value={complaintText}
        onChangeText={setComplaintText}
        style={styles.textInput}
        multiline
      />
      {submitting ? (
        <ActivityIndicator size="large" color="#2563eb" />
      ) : (
        <>
          <Button title="Submit Complaint" onPress={submitComplaint} />
          <Button title="Cancel" color="gray" onPress={() => setShowComplaintModal(false)} />
        </>
      )}
    </View>
  </Modal>

  {/* Feedback Modal */}
  <Modal visible={showFeedbackModal} animationType="slide" onRequestClose={() => setShowFeedbackModal(false)}>
    <View style={styles.formModal}>
      <Text style={styles.modalTitle}>Give Feedback</Text>
      <Text>Rating: {rating}⭐</Text>
      <View style={{ flexDirection: 'row', marginVertical: 10 }}>
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity key={star} onPress={() => setRating(star)}>
            <Text style={{ fontSize: 28, color: star <= rating ? '#facc15' : '#d1d5db' }}>★</Text>
          </TouchableOpacity>
        ))}
      </View>
      <TextInput
        placeholder="Enter your feedback"
        value={feedbackText}
        onChangeText={setFeedbackText}
        style={styles.textInput}
        multiline
      />
      {submitting ? (
        <ActivityIndicator size="large" color="#2563eb" />
      ) : (
        <>
          <Button title="Submit Feedback" onPress={submitFeedback} />
          <Button title="Cancel" color="gray" onPress={() => setShowFeedbackModal(false)} />
        </>
      )}
    </View>
  </Modal>
</Modal>
)}


{showInvoiceDetailsModal && selectedInvoice && (
  <Modal
    visible={showInvoiceDetailsModal}
    animationType="slide"
    onRequestClose={() => setShowInvoiceDetailsModal(false)}
  >
    <View style={styles.modalContainer}>
      <View style={styles.modalHeader}>
        <Text style={styles.modalTitle}>Invoice Details</Text>
        <TouchableOpacity onPress={() => setShowInvoiceDetailsModal(false)}>
          <Icon name="x" size={24} color="#374151" />
        </TouchableOpacity>
      </View>
      <ScrollView style={styles.modalContent}>
        {/* Render selectedInvoice details here */}
        <Text>Service: {selectedInvoice.service}</Text>
        <Text>Status: {selectedInvoice.status}</Text>
        <Text>Date: {selectedInvoice.date}</Text>
        <Text>Amount: ₦{selectedInvoice.amount?.toLocaleString()}</Text>
        {/* Add more fields as needed */}
      </ScrollView>
    </View>
  </Modal>
)}

      </ScrollView>

      {/* Modals */}
      <NotificationModal />
      <JobBookingModal />
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
  scrollView: {
    flex: 1,
  },
  header: {
    backgroundColor: '#1d4ed8',
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flex: 1,
  },
  appTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  notificationButton: {
    position: 'relative',
    padding: 8,
  },
  notificationBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: '#ef4444',
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  welcomeSection: {
    backgroundColor: '#1d4ed8',
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  welcomeTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  welcomeSubtitle: {
    fontSize: 14,
    color: '#bfdbfe',
  },
  section: {
    paddingHorizontal: 16,
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  viewAllButton: {
    color: '#2563eb',
    fontWeight: '500',
  },
  quickActions: {
    flexDirection: 'row',
    gap: 12,
  },
  primaryAction: {
    flex: 1,
    backgroundColor: '#1d4ed8',
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryActionText: {
    color: '#fff',
    fontWeight: '500',
  },
  secondaryAction: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  secondaryActionText: {
    color: '#374151',
    fontWeight: '500',
  },
  servicesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  serviceCard: {
    backgroundColor: '#fff',
    width: (width - 44) / 2,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  serviceIconContainer: {
    marginBottom: 8,
  },
  serviceName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 4,
  },
  serviceDescription: {
    fontSize: 12,
    color: '#6b7280',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 16,
    color: '#6b7280',
    marginTop: 12,
    fontWeight: '500',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 4,
  },
  jobsList: {
    gap: 12,
  },
  jobCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  jobHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  jobTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  jobMeta: {
    gap: 8,
    marginBottom: 12,
  },
  jobMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  jobMetaText: {
    fontSize: 13,
    color: '#6b7280',
  },
  progressSection: {
    marginBottom: 12,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressLabel: {
    fontSize: 13,
    color: '#6b7280',
  },
  progressValue: {
    fontSize: 13,
    color: '#1d4ed8',
    fontWeight: '500',
  },
  progressBar: {
    height: 6,
    backgroundColor: '#e5e7eb',
    borderRadius: 3,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#1d4ed8',
    borderRadius: 3,
  },
  jobFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  viewDetailsText: {
    color: '#2563eb',
    fontWeight: '500',
  },
  invoicesList: {
    gap: 8,
  },
  invoiceCard: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  invoiceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  invoiceIconContainer: {
    marginRight: 8,
  },
  invoiceInfo: {
    flex: 1,
  },
  invoiceTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  invoiceMeta: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  invoiceAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563eb',
  },
  logoutContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  logoutButton: {
    marginTop: 0,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingTop: 50,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  notificationItem: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    marginBottom: 8,
  },
  notificationIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  notificationMessage: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  notificationTime: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 4,
  },
  formGroup: {
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  formInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  formInputText: {
    color: '#9ca3af',
    flex: 1,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  uploadArea: {
    borderWidth: 2,
    borderColor: '#d1d5db',
    borderStyle: 'dashed',
    borderRadius: 8,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadText: {
    color: '#6b7280',
    marginTop: 8,
  },
  submitButton: {
    marginTop: 20,
  },

  sectionBlue: {
    backgroundColor: '#e0e7ff',
    padding: 16,
    marginVertical: 8,
    borderRadius: 8,
  },
  sectionWhite: {
    backgroundColor: '#fff',
    padding: 16,
    marginVertical: 8,
    borderRadius: 8,
  },
  sectionTitleBlue: {
    color: '#1d4ed8',
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 8,
  },
  paymentHeader: {
    flex: 1,
    fontWeight: 'bold',
    color: '#1d4ed8',
    fontSize: 12,
    textAlign: 'center',
  },
  paymentCell: {
    flex: 1,
    color: '#374151',
    fontSize: 12,
    textAlign: 'center',
    paddingVertical: 4,
  },
  paymentCellInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 4,
    padding: 4,
    fontSize: 12,
    marginHorizontal: 2,
    backgroundColor: '#fff',
    textAlign: 'center',
  },

  // ...existing styles...
closeButton: {
  color: '#2563eb',
  fontWeight: '500',
  fontSize: 16,
},
modalSection: {
  marginBottom: 18,
  paddingBottom: 8,
  borderBottomWidth: 1,
  borderBottomColor: '#e5e7eb',
},
sectionLabel: {
  fontWeight: 'bold',
  color: '#1d4ed8',
  marginBottom: 4,
  fontSize: 14,
},
sectionValue: {
  color: '#374151',
  fontSize: 14,
},
statusBadgeLarge: {
  paddingHorizontal: 12,
  paddingVertical: 6,
  borderRadius: 14,
  alignSelf: 'flex-start',
},
statusTextLarge: {
  fontSize: 14,
  fontWeight: '600',
  textTransform: 'capitalize',
},
complaintCard: {
  backgroundColor: '#f3f4f6',
  padding: 8,
  borderRadius: 8,
  marginBottom: 6,
},
actionButton: {
  backgroundColor: '#2563eb',
  padding: 12,
  borderRadius: 8,
  alignItems: 'center',
  marginBottom: 10,
},
actionButtonText: {
  color: '#fff',
  fontWeight: '600',
  fontSize: 15,
},
formModal: {
  flex: 1,
  backgroundColor: '#fff',
  padding: 24,
  justifyContent: 'center',
},
textInput: {
  borderWidth: 1,
  borderColor: '#d1d5db',
  borderRadius: 8,
  padding: 12,
  fontSize: 15,
  marginBottom: 16,
  backgroundColor: '#fff',
},
// ...existing styles...

});