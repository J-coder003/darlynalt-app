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
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import api from '../utils/api';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '../store/store';
import * as ImagePicker from 'expo-image-picker';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useFocusEffect } from '@react-navigation/native';

const { width } = Dimensions.get('window');

const normalizeId = (id: string) =>
  /^[0-9a-fA-F]{24}$/.test(id) ? id : id.padStart(24, '0');

type Invoice = { id: string; amount: number; status: string; service?: string; date?: string };
type Notification = { id: string | number; title: string; message: string; time: string; type: string; unread?: boolean };
type Service = { name: string; icon: string; description: string };
type Job = {
  id: string; service: string; status: string; date: string;
  worker?: string | null; amount?: number; progress?: number;
  address?: string; description?: string;
  feedback?: { rating: number; comment?: string };
  complaints?: { title: string; description: string; status: string }[];
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

  const [installForm, setInstallForm] = useState({
    clientName: '', clientAddress: '', clientPhone: '', clientEmail: '',
    clientIdType: '', clientIdNo: '', projectDescription: '', totalCost: '',
    downPayment: '', balance: '', monthlyInstallment: '', passportPhoto: null as string | null,
    guarantor1: { name: '', address: '', phone: '', occupation: '', idType: '', idNo: '' },
    guarantor2: { name: '', address: '', phone: '', occupation: '', idType: '', idNo: '' },
  });

  const [paymentSchedule, setPaymentSchedule] = useState(
    Array.from({ length: 18 }, (_, i) => ({ no: i + 1, dueDate: '', amount: '', balance: i === 17 ? '0.00' : '', initials: '' }))
  );

  const services: Service[] = [
    { name: 'Solar Energy', icon: 'sun', description: 'Full install' },
    { name: 'Smart Home', icon: 'home', description: 'Automation' },
    { name: 'Security', icon: 'shield', description: 'Advanced' },
    { name: 'Audio Systems', icon: 'music', description: 'Digital audio' },
  ];

  useEffect(() => {
    if (prevJobs.length > 0) {
      jobs.forEach(job => {
        const oldJob = prevJobs.find(j => j.id === job.id);
        if (oldJob && oldJob.status !== job.status) {
          setNotifications(n => [{ id: Date.now(), title: 'Job Status Updated', message: `Your "${job.service}" job is now "${job.status}".`, time: new Date().toLocaleTimeString(), type: 'job', unread: true }, ...n]);
          setUnreadCount(c => c + 1);
        }
      });
      jobs.forEach(job => {
        if (!prevJobs.find(j => j.id === job.id)) {
          setNotifications(n => [{ id: Date.now(), title: 'New Job Created', message: `Your "${job.service}" job has been created.`, time: new Date().toLocaleTimeString(), type: 'job', unread: true }, ...n]);
          setUnreadCount(c => c + 1);
        }
      });
    }
    setPrevJobs(jobs);
  }, [jobs]);

  useEffect(() => {
    if (prevInvoices.length > 0) {
      invoices.forEach(inv => {
        if (!prevInvoices.find(i => i.id === inv.id)) {
          setNotifications(n => [{ id: Date.now(), title: 'New Invoice', message: `Invoice for "${inv.service}" has been generated.`, time: new Date().toLocaleTimeString(), type: 'payment', unread: true }, ...n]);
          setUnreadCount(c => c + 1);
        }
      });
    }
    setPrevInvoices(invoices);
  }, [invoices]);

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
      const [jobsRes, invoicesRes] = await Promise.all([api.get('/jobs/my'), api.get('/invoices')]);
      const jobsWithProgress = (jobsRes.data || []).map((job: any) => ({
        id: job.id || job._id, service: job.serviceType || job.service || 'Service',
        status: job.status || 'pending',
        date: job.createdAt ? new Date(job.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        worker: job.workerName || job.worker || null, amount: job.amount || 0,
        progress: job.status === 'ongoing' ? Math.floor(Math.random() * 80) + 10 : job.status === 'completed' ? 100 : 0,
      }));
      setJobs(jobsWithProgress);
      setInvoices((invoicesRes.data || []).map((invoice: any) => ({
        id: invoice.id || invoice._id, amount: invoice.amount || 0,
        status: invoice.status || 'pending', service: invoice.serviceType || 'Service',
        date: invoice.createdAt ? new Date(invoice.createdAt).toISOString().split('T')[0] : '',
      })));
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => { setRefreshing(true); await fetchAll(); setRefreshing(false); }, []);
  useEffect(() => { fetchAll(); }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return { bg: '#0a2a1a', text: '#44cc77' };
      case 'ongoing':   return { bg: '#0a1a3e', text: '#6688ff' };
      case 'pending':   return { bg: '#2a1a0a', text: '#dd9944' };
      default:          return { bg: '#1a1a2e', text: '#8888bb' };
    }
  };

  const submitComplaint = async () => {
    if (!complaintTitle || !complaintText || !selectedJob) return;
    setSubmitting(true);
    const newComplaint = { title: complaintTitle, description: complaintText, status: 'pending' };
    setJobs(jobs => jobs.map(job => job.id === selectedJob.id ? { ...job, complaints: job.complaints ? [...job.complaints, newComplaint] : [newComplaint] } : job));
    setSelectedJob(job => job ? { ...job, complaints: job.complaints ? [...job.complaints, newComplaint] : [newComplaint] } : job);
    setComplaintTitle(''); setComplaintText(''); setShowComplaintModal(false);
    setSubmitting(false);
  };

  const submitFeedback = async () => {
    if (!feedbackText || !rating || !selectedJob) return;
    setSubmitting(true);
    const newFeedback = { rating, comment: feedbackText };
    setJobs(jobs => jobs.map(job => job.id === selectedJob.id ? { ...job, feedback: newFeedback } : job));
    setSelectedJob(job => job ? { ...job, feedback: newFeedback } : job);
    setFeedbackText(''); setRating(0); setShowFeedbackModal(false);
    setSubmitting(false);
  };

  const handlePickPassport = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.7 });
    if (!result.canceled && result.assets?.length > 0) setInstallForm(f => ({ ...f, passportPhoto: result.assets[0].uri }));
  };

  const handleGeneratePDF = async () => {
    const html = `<html><head><meta charset="utf-8"/><style>body{font-family:Arial,sans-serif;color:#222;background:#f3f4f6}h1{color:#1d4ed8}h2{color:#1d4ed8;margin-top:24px}.section{margin-bottom:18px;border-radius:8px;padding:16px}.section-blue{background:#e0e7ff}.section-white{background:#fff}.label{font-weight:bold;color:#1d4ed8}table{width:100%;border-collapse:collapse;margin-top:8px}th,td{border:1px solid #d1d5db;padding:4px;font-size:12px;text-align:center}</style></head><body><div class="section section-blue" style="text-align:center"><h1>DARLYN ALT GLOBAL</h1><div>2 olofin close, off Ajoke salako street, Gabagada, Lagos. | 08072768813</div><h2>18-MONTH INSTALLMENT PAYMENT AGREEMENT FORM</h2></div><div class="section section-blue"><span class="label">SECTION A – CLIENT INFORMATION</span><br/><b>Full Name:</b> ${installForm.clientName}<br/><b>Address:</b> ${installForm.clientAddress}<br/><b>Phone:</b> ${installForm.clientPhone}<br/><b>Email:</b> ${installForm.clientEmail}</div><div class="section section-white"><span class="label">SECTION B – PROJECT DESCRIPTION</span><br/><b>Project:</b> ${installForm.projectDescription}<br/><b>Total Cost:</b> ₦${installForm.totalCost}<br/><b>Down Payment:</b> ₦${installForm.downPayment}<br/><b>Balance:</b> ₦${installForm.balance}<br/><b>Monthly Installment:</b> ₦${installForm.monthlyInstallment}</div><div class="section section-blue"><span class="label">SECTION C – PAYMENT SCHEDULE</span><table><tr><th>No.</th><th>Due Date</th><th>Amount</th><th>Balance</th><th>Initials</th></tr>${paymentSchedule.map(r => `<tr><td>${r.no}</td><td>${r.dueDate}</td><td>${r.amount}</td><td>${r.balance}</td><td>${r.initials}</td></tr>`).join('')}</table></div></body></html>`;
    try {
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri);
      else Alert.alert('PDF Generated', 'PDF created at: ' + uri);
    } catch (err) { Alert.alert('PDF Error', err instanceof Error ? err.message : 'Unknown error'); }
  };

  // ─── NOTIFICATION MODAL ────────────────────────────────────────────────────
  const NotificationModal = () => (
    <Modal visible={showNotifications} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowNotifications(false)}>
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Notifications</Text>
          <TouchableOpacity onPress={() => setShowNotifications(false)}>
            <Icon name="x" size={22} color="#aaaacc" />
          </TouchableOpacity>
        </View>
        <ScrollView style={styles.modalContent}>
          {notifications.length === 0 ? (
            <View style={{ alignItems: 'center', paddingTop: 60 }}>
              <Icon name="bell-off" size={40} color="#2a2a40" />
              <Text style={{ color: '#333355', marginTop: 12, fontSize: 14 }}>No notifications yet</Text>
            </View>
          ) : notifications.map((n) => (
            <View key={n.id} style={styles.notificationItem}>
              <View style={[styles.notificationIcon, { backgroundColor: n.type === 'job' ? '#0d1f4e' : '#1a1a0a' }]}>
                <Icon name={n.type === 'job' ? 'briefcase' : 'credit-card'} size={14} color={n.type === 'job' ? '#6688ff' : '#dd9944'} />
              </View>
              <View style={styles.notificationContent}>
                <Text style={styles.notificationTitle}>{n.title}</Text>
                <Text style={styles.notificationMessage}>{n.message}</Text>
                <Text style={styles.notificationTime}>{n.time}</Text>
              </View>
            </View>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );

  // ─── INSTALLMENT FORM ──────────────────────────────────────────────────────
  const InstallmentalPlanForm = () => (
    <ScrollView style={{ flex: 1 }}>
      <View style={{ backgroundColor: '#1d4ed8', padding: 16, alignItems: 'center' }}>
        <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 18 }}>DARLYN ALT GLOBAL</Text>
        <Text style={{ color: '#bfdbfe', marginTop: 2, fontSize: 12 }}>18-MONTH INSTALLMENT PAYMENT AGREEMENT FORM</Text>
      </View>
      <View style={{ alignItems: 'center', marginTop: 16 }}>
        <TouchableOpacity style={{ borderWidth: 1, borderColor: '#2a2a50', borderRadius: 10, padding: 8, backgroundColor: '#111120' }} onPress={handlePickPassport}>
          {installForm.passportPhoto ? <Image source={{ uri: installForm.passportPhoto }} style={{ width: 90, height: 90, borderRadius: 8 }} /> : <Text style={{ color: '#5340f0', fontSize: 13 }}>Attach Passport Photograph</Text>}
        </TouchableOpacity>
      </View>
      {/* Sections A-F — kept intact, styled to match dark theme */}
      {[
        { label: 'SECTION A – CLIENT INFORMATION', fields: [['clientName','Full Name'],['clientAddress','Address'],['clientPhone','Phone','phone-pad'],['clientEmail','Email','email-address'],['clientIdType','ID Type'],['clientIdNo','ID Number']] },
      ].map(section => (
        <View key={section.label} style={styles.installSection}>
          <Text style={styles.installSectionTitle}>{section.label}</Text>
          {section.fields.map(([key, placeholder, kb]) => (
            <TextInput key={key} style={styles.installInput} placeholder={placeholder} placeholderTextColor="#444466"
              value={(installForm as any)[key]} onChangeText={v => setInstallForm(f => ({ ...f, [key]: v }))}
              keyboardType={(kb as any) ?? 'default'} />
          ))}
        </View>
      ))}
      <View style={styles.installSection}>
        <Text style={styles.installSectionTitle}>SECTION B – PROJECT / SERVICE DESCRIPTION</Text>
        {[['projectDescription','Project Description'],['totalCost','Total Cost (₦)','numeric'],['downPayment','Down Payment 20% (₦)','numeric'],['balance','Balance (₦)','numeric'],['monthlyInstallment','Monthly Installment (₦)','numeric']].map(([key, ph, kb]) => (
          <TextInput key={key} style={styles.installInput} placeholder={ph} placeholderTextColor="#444466"
            value={(installForm as any)[key]} onChangeText={v => setInstallForm(f => ({ ...f, [key]: v }))}
            keyboardType={(kb as any) ?? 'default'} />
        ))}
      </View>
      <View style={styles.installSection}>
        <Text style={styles.installSectionTitle}>SECTION C – PAYMENT SCHEDULE</Text>
        <View style={{ flexDirection: 'row', marginBottom: 6 }}>
          {['No.','Due Date','Amount','Balance','Initials'].map(h => <Text key={h} style={styles.paymentHeader}>{h}</Text>)}
        </View>
        {paymentSchedule.map((row, idx) => (
          <View key={idx} style={{ flexDirection: 'row', marginBottom: 4 }}>
            <Text style={styles.paymentCell}>{row.no}</Text>
            {['dueDate','amount','balance','initials'].map(field => (
              <TextInput key={field} style={styles.paymentCellInput} placeholder="—" placeholderTextColor="#333355"
                value={(row as any)[field]} keyboardType={field === 'amount' || field === 'balance' ? 'numeric' : 'default'}
                onChangeText={v => { const u = [...paymentSchedule]; (u[idx] as any)[field] = v; setPaymentSchedule(u); }} />
            ))}
          </View>
        ))}
      </View>
      {/* Guarantors D */}
      {[1, 2].map(n => (
        <View key={n} style={styles.installSection}>
          <Text style={styles.installSectionTitle}>GUARANTOR {n}</Text>
          {['name','address','phone','occupation','idType','idNo'].map(field => (
            <TextInput key={field} style={styles.installInput} placeholder={field.charAt(0).toUpperCase() + field.slice(1)} placeholderTextColor="#444466"
              value={(installForm as any)[`guarantor${n}`][field]}
              onChangeText={v => setInstallForm(f => ({ ...f, [`guarantor${n}`]: { ...(f as any)[`guarantor${n}`], [field]: v } }))} />
          ))}
        </View>
      ))}
      <View style={styles.installSection}>
        <Text style={styles.installSectionTitle}>SECTION E – TERMS & CONDITIONS</Text>
        <Text style={{ color: '#7777aa', fontSize: 13, lineHeight: 20 }}>
          {'• Client shall pay 20% down payment before installation commences.\n• Balance is spread over 18 months, payable monthly.\n• Default of more than 2 consecutive payments may result in suspension or removal of installed equipment.\n• Installed equipment remains property of Darlyn Alt Global until full payment is completed.'}
        </Text>
      </View>
      <View style={[styles.installSection, { marginBottom: 32 }]}>
        <Text style={styles.installSectionTitle}>SECTION F – SIGNATURES</Text>
        <Text style={{ color: '#7777aa', fontSize: 13, lineHeight: 24 }}>
          {'Client\'s Signature: ___________________ Date: __________\nDarlyn Alt Global Rep: ________________ Date: __________\nWitness: ___________________ Date: __________'}
        </Text>
        <View style={{ marginTop: 16 }}>
          <TouchableOpacity style={styles.ctaButton} onPress={handleGeneratePDF}>
            <Icon name="file-text" size={16} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.ctaButtonText}>Generate PDF</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );

  // ─── JOB BOOKING MODAL ─────────────────────────────────────────────────────
  const JobBookingModal = () => {
    const [serviceType, setServiceType] = useState('');
    const [description, setDescription] = useState('');
    const [address, setAddress] = useState('');
    const [loadingSubmit, setLoadingSubmit] = useState(false);

    const handleSubmitJob = async () => {
      if (!serviceType || !description || !address) { Alert.alert('Validation Error', 'Please fill all required fields.'); return; }
      try {
        setLoadingSubmit(true);
        const res = await api.post('/jobs', { title: `${serviceType} Job`, serviceType, description, address, images: [], customerId: normalizeId(user?._id || user?.id) });
        setJobs(prev => [{ id: res.data.id || res.data._id, service: serviceType, status: res.data.status || 'pending', date: new Date().toISOString().split('T')[0], worker: null, amount: 0, progress: 0 }, ...prev]);
        setShowJobForm(false);
        Alert.alert('Success', 'Service request submitted successfully!');
      } catch (error: any) { Alert.alert('Error', error.response?.data?.message || 'Failed to create job'); }
      finally { setLoadingSubmit(false); }
    };

    return (
      <Modal visible={showJobForm} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => { setShowJobForm(false); setInstallmentMode(false); }}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Book a Service</Text>
            <TouchableOpacity onPress={() => { setShowJobForm(false); setInstallmentMode(false); }}>
              <Icon name="x" size={22} color="#aaaacc" />
            </TouchableOpacity>
          </View>
          {/* Installment toggle */}
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: '#1a1a30' }}>
            <Icon name="calendar" size={15} color="#7a6ff0" style={{ marginRight: 8 }} />
            <Text style={{ color: '#aaaacc', fontSize: 14, flex: 1 }}>Installmental Plan (18 months)</Text>
            <Switch value={installmentMode} onValueChange={setInstallmentMode} trackColor={{ false: '#2a2a40', true: '#5340f0' }} thumbColor="#fff" />
          </View>

          {installmentMode ? <InstallmentalPlanForm /> : (
            <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
              <Text style={styles.fieldLabel}>Select Service</Text>
              <View style={{ gap: 8, marginBottom: 20 }}>
                {services.map((service) => (
                  <TouchableOpacity key={service.name} style={[styles.serviceSelectCard, serviceType === service.name && styles.serviceSelectCardActive]} onPress={() => setServiceType(service.name)}>
                    <View style={[styles.serviceSelectIcon, serviceType === service.name && { backgroundColor: '#5340f0' }]}>
                      <Icon name={service.icon} size={16} color={serviceType === service.name ? '#fff' : '#7a6ff0'} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.serviceSelectName, serviceType === service.name && { color: '#fff' }]}>{service.name}</Text>
                      <Text style={styles.serviceSelectDesc}>{service.description}</Text>
                    </View>
                    {serviceType === service.name && <Icon name="check-circle" size={16} color="#5340f0" />}
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Description</Text>
              <TextInput style={[styles.formInput, { height: 90, textAlignVertical: 'top' }]} placeholder="Describe your requirements..." placeholderTextColor="#333366" multiline numberOfLines={4} value={description} onChangeText={setDescription} />

              <Text style={styles.fieldLabel}>Address</Text>
              <TextInput style={styles.formInput} placeholder="Installation address" placeholderTextColor="#333366" value={address} onChangeText={setAddress} />

              <TouchableOpacity style={[styles.ctaButton, { marginTop: 24, marginBottom: 40 }, (loadingSubmit || !serviceType) && { backgroundColor: '#2a2a50' }]} onPress={handleSubmitJob} disabled={loadingSubmit}>
                {loadingSubmit ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.ctaButtonText}>Submit Request</Text>}
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>
      </Modal>
    );
  };

  // ─── MAIN RENDER ───────────────────────────────────────────────────────────
  const displayName = (user?.name || profile?.name || 'User').split(' ');
  const shortName = displayName[0] + (displayName[1] ? ` ${displayName[1][0]}.` : '');
  const activeJobs = jobs.filter(j => j.status === 'ongoing' || j.status === 'pending').length;
  const totalSpent = invoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#5340f0" />} showsVerticalScrollIndicator={false}>

        {/* ── HEADER ── */}
        <View style={styles.header}>
          <Text style={styles.appTitle}>DARLYN-ALT</Text>
          <TouchableOpacity style={styles.notifBtn} onPress={handleOpenNotifications}>
            <Icon name="bell" size={18} color="#fff" />
            {unreadCount > 0 && (
              <View style={styles.notifBadge}>
                <Text style={styles.notifBadgeText}>{unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* ── WELCOME CARD ── */}
        <View style={styles.welcomeCard}>
          <View style={styles.welcomeOrb} />
          <Text style={styles.welcomeGreeting}>Good morning</Text>
          <Text style={styles.welcomeName}>{shortName}</Text>
          <Text style={styles.welcomeSub}>Ready for your next home upgrade?</Text>
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{activeJobs}</Text>
              <Text style={styles.statLabel}>Active Jobs</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={styles.statValue}>₦{totalSpent >= 1000 ? `${(totalSpent / 1000).toFixed(0)}k` : totalSpent.toLocaleString()}</Text>
              <Text style={styles.statLabel}>Total Spent</Text>
            </View>
          </View>
        </View>

        {/* ── SERVICES ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>SERVICES</Text>
            <TouchableOpacity><Text style={styles.seeAll}>See all</Text></TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20, paddingHorizontal: 20 }}>
            {services.map((service, i) => (
              <TouchableOpacity key={i} style={styles.serviceCard} onPress={() => { setShowJobForm(true); }}>
                <View style={styles.serviceIconWrap}>
                  <Icon name={service.icon} size={22} color="#a090ff" />
                </View>
                <Text style={styles.serviceName}>{service.name}</Text>
                <Text style={styles.serviceDesc}>{service.description}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* ── RECENT JOBS ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>RECENT JOBS</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Jobs')}>
              <Text style={styles.seeAll}>View all</Text>
            </TouchableOpacity>
          </View>

          {jobs.length === 0 ? (
            <View style={styles.emptyState}>
              <Icon name="briefcase" size={36} color="#2a2a40" />
              <Text style={styles.emptyText}>No jobs yet</Text>
              <Text style={styles.emptySubtext}>Book your first service to get started</Text>
            </View>
          ) : (
            jobs.slice(0, 2).map((job) => {
              const sc = getStatusColor(job.status);
              return (
                <TouchableOpacity key={String(job.id)} style={styles.jobCard} onPress={() => { setSelectedJob(job); setShowJobDetailsModal(true); }}>
                  <View style={styles.jobCardHeader}>
                    <View>
                      <Text style={styles.jobTitle}>{job.service}</Text>
                      <Text style={styles.jobDate}>{job.date}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
                      <Text style={[styles.statusText, { color: sc.text }]}>{job.status.charAt(0).toUpperCase() + job.status.slice(1)}</Text>
                    </View>
                  </View>

                  {job.status === 'ongoing' && job.progress !== undefined && (
                    <View style={styles.progressBar}>
                      <View style={[styles.progressFill, { width: `${job.progress}%` as any }]} />
                    </View>
                  )}

                  <View style={styles.jobMeta}>
                    {job.worker && (
                      <View style={styles.jobMetaItem}>
                        <Icon name="user" size={13} color="#555577" />
                        <Text style={styles.jobMetaText}>{job.worker}</Text>
                      </View>
                    )}
                    <View style={styles.jobMetaItem}>
                      <Icon name="credit-card" size={13} color="#555577" />
                      <Text style={styles.jobMetaText}>₦{(job.amount ?? 0).toLocaleString()}</Text>
                    </View>
                    {job.status === 'ongoing' && job.progress !== undefined && (
                      <View style={styles.jobMetaItem}>
                        <Text style={styles.progressPct}>{job.progress}%</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>

        {/* ── RECENT INVOICES ── */}
        <View style={[styles.section, { marginBottom: 120 }]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>RECENT INVOICES</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Invoices')}>
              <Text style={styles.seeAll}>View all</Text>
            </TouchableOpacity>
          </View>
          {invoices.length === 0 ? (
            <View style={styles.emptyState}>
              <Icon name="file-text" size={36} color="#2a2a40" />
              <Text style={styles.emptyText}>No invoices yet</Text>
            </View>
          ) : invoices.slice(0, 2).map((invoice) => (
            <TouchableOpacity key={String(invoice.id)} style={styles.invoiceCard} onPress={() => { setSelectedInvoice(invoice); setShowInvoiceDetailsModal(true); }}>
              <View style={styles.invoiceIconWrap}>
                <Icon name="file-text" size={16} color="#a090ff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.invoiceService}>{invoice.service || 'Invoice'}</Text>
                <Text style={styles.invoiceMeta}>{invoice.date} • {invoice.status}</Text>
              </View>
              <Text style={styles.invoiceAmount}>₦{invoice.amount?.toLocaleString()}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* ── BOOK SERVICE FLOATING CTA ── */}
      <View style={styles.ctaContainer}>
        <TouchableOpacity style={styles.ctaButton} onPress={() => setShowJobForm(true)} activeOpacity={0.9}>
          <Icon name="plus" size={18} color="#fff" style={{ marginRight: 8 }} />
          <Text style={styles.ctaButtonText}>Book a Service</Text>
        </TouchableOpacity>
      </View>

      {/* ── MODALS ── */}
      <NotificationModal />
      <JobBookingModal />

      {/* Job Details Modal */}
      {showJobDetailsModal && selectedJob && (
        <Modal visible={showJobDetailsModal} animationType="slide" onRequestClose={() => setShowJobDetailsModal(false)}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{selectedJob.service}</Text>
              <TouchableOpacity onPress={() => setShowJobDetailsModal(false)}>
                <Text style={styles.closeLink}>Close</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalContent}>
              {[
                { label: 'Status', value: selectedJob.status, badge: true },
                { label: 'Worker', value: selectedJob.worker || 'Not assigned' },
                { label: 'Date', value: selectedJob.date },
                { label: 'Amount', value: `₦${selectedJob.amount?.toLocaleString()}` },
                ...(selectedJob.address ? [{ label: 'Address', value: selectedJob.address }] : []),
                ...(selectedJob.description ? [{ label: 'Description', value: selectedJob.description }] : []),
              ].map(({ label, value, badge }) => (
                <View key={label} style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{label}</Text>
                  {badge ? (
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(value as string).bg }]}>
                      <Text style={[styles.statusText, { color: getStatusColor(value as string).text }]}>{value}</Text>
                    </View>
                  ) : <Text style={styles.detailValue}>{value}</Text>}
                </View>
              ))}

              {selectedJob.feedback && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Feedback</Text>
                  <Text style={styles.detailValue}>{'⭐'.repeat(selectedJob.feedback.rating)} {selectedJob.feedback.comment}</Text>
                </View>
              )}

              {selectedJob.complaints?.length ? (
                <View style={{ marginTop: 8 }}>
                  <Text style={styles.detailLabel}>Complaints</Text>
                  {selectedJob.complaints.map((c, i) => (
                    <View key={i} style={styles.complaintCard}>
                      <Text style={styles.detailValue}>{c.title}</Text>
                      <Text style={{ color: '#555577', fontSize: 13 }}>{c.description}</Text>
                      <Text style={{ color: c.status === 'resolved' ? '#44cc77' : '#dd9944', fontSize: 12, marginTop: 4 }}>Status: {c.status}</Text>
                    </View>
                  ))}
                </View>
              ) : null}

              <TouchableOpacity style={[styles.ctaButton, { marginTop: 20 }]} onPress={() => setShowComplaintModal(true)}>
                <Text style={styles.ctaButtonText}>Add Complaint</Text>
              </TouchableOpacity>
              {selectedJob.status === 'completed' && (
                <TouchableOpacity style={[styles.ctaButton, { marginTop: 10, backgroundColor: selectedJob.feedback ? '#2a2a50' : '#5340f0' }]}
                  onPress={() => !selectedJob.feedback && setShowFeedbackModal(true)} disabled={!!selectedJob.feedback}>
                  <Text style={styles.ctaButtonText}>{selectedJob.feedback ? 'Feedback Submitted' : 'Give Feedback'}</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>

          {/* Complaint Modal */}
          <Modal visible={showComplaintModal} animationType="slide" onRequestClose={() => setShowComplaintModal(false)}>
            <View style={[styles.modalContainer, { justifyContent: 'center', padding: 24 }]}>
              <Text style={[styles.modalTitle, { marginBottom: 20 }]}>Submit Complaint</Text>
              <TextInput style={styles.formInput} placeholder="Complaint Title" placeholderTextColor="#333366" value={complaintTitle} onChangeText={setComplaintTitle} />
              <TextInput style={[styles.formInput, { height: 90, textAlignVertical: 'top', marginTop: 12 }]} placeholder="Describe your complaint..." placeholderTextColor="#333366" value={complaintText} onChangeText={setComplaintText} multiline />
              <TouchableOpacity style={[styles.ctaButton, { marginTop: 20 }]} onPress={submitComplaint} disabled={submitting}>
                {submitting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.ctaButtonText}>Submit</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={[styles.ctaButton, { backgroundColor: '#1a1a2e', marginTop: 10 }]} onPress={() => setShowComplaintModal(false)}>
                <Text style={[styles.ctaButtonText, { color: '#aaaacc' }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </Modal>

          {/* Feedback Modal */}
          <Modal visible={showFeedbackModal} animationType="slide" onRequestClose={() => setShowFeedbackModal(false)}>
            <View style={[styles.modalContainer, { justifyContent: 'center', padding: 24 }]}>
              <Text style={[styles.modalTitle, { marginBottom: 20 }]}>Give Feedback</Text>
              <View style={{ flexDirection: 'row', marginBottom: 20 }}>
                {[1, 2, 3, 4, 5].map(star => (
                  <TouchableOpacity key={star} onPress={() => setRating(star)}>
                    <Text style={{ fontSize: 32, color: star <= rating ? '#facc15' : '#2a2a40', marginRight: 4 }}>★</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput style={[styles.formInput, { height: 90, textAlignVertical: 'top' }]} placeholder="Share your experience..." placeholderTextColor="#333366" value={feedbackText} onChangeText={setFeedbackText} multiline />
              <TouchableOpacity style={[styles.ctaButton, { marginTop: 20 }]} onPress={submitFeedback} disabled={submitting}>
                {submitting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.ctaButtonText}>Submit Feedback</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={[styles.ctaButton, { backgroundColor: '#1a1a2e', marginTop: 10 }]} onPress={() => setShowFeedbackModal(false)}>
                <Text style={[styles.ctaButtonText, { color: '#aaaacc' }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </Modal>
        </Modal>
      )}

      {/* Invoice Details Modal */}
      {showInvoiceDetailsModal && selectedInvoice && (
        <Modal visible={showInvoiceDetailsModal} animationType="slide" onRequestClose={() => setShowInvoiceDetailsModal(false)}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Invoice Details</Text>
              <TouchableOpacity onPress={() => setShowInvoiceDetailsModal(false)}>
                <Icon name="x" size={22} color="#aaaacc" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalContent}>
              {[{ label: 'Service', value: selectedInvoice.service }, { label: 'Status', value: selectedInvoice.status }, { label: 'Date', value: selectedInvoice.date }, { label: 'Amount', value: `₦${selectedInvoice.amount?.toLocaleString()}` }].map(({ label, value }) => (
                <View key={label} style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{label}</Text>
                  <Text style={styles.detailValue}>{value}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f' },
  scrollView: { flex: 1 },

  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 56, paddingHorizontal: 20, paddingBottom: 12 },
  appTitle: { fontSize: 16, fontWeight: '800', color: '#ffffff', letterSpacing: 3 },
  notifBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#111128', borderWidth: 0.5, borderColor: '#2a2a40', alignItems: 'center', justifyContent: 'center' },
  notifBadge: { position: 'absolute', top: -2, right: -2, backgroundColor: '#e03b6a', width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  notifBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },

  // Welcome card
  welcomeCard: { margin: 20, marginTop: 8, backgroundColor: '#0d1f4e', borderRadius: 20, padding: 20, borderWidth: 0.5, borderColor: '#2a3a8e', overflow: 'hidden' },
  welcomeOrb: { position: 'absolute', width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(83,64,240,0.2)', right: -30, top: -30 },
  welcomeGreeting: { color: '#7a90cc', fontSize: 14, marginBottom: 2 },
  welcomeName: { color: '#ffffff', fontSize: 26, fontWeight: '700', marginBottom: 4 },
  welcomeSub: { color: '#5566aa', fontSize: 13, marginBottom: 16 },
  statsRow: { flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 14, overflow: 'hidden' },
  statBox: { flex: 1, padding: 14, alignItems: 'center' },
  statDivider: { width: 0.5, backgroundColor: '#2a3a8e' },
  statValue: { color: '#ffffff', fontSize: 20, fontWeight: '700', marginBottom: 2 },
  statLabel: { color: '#5566aa', fontSize: 12 },

  // Sections
  section: { paddingHorizontal: 20, marginTop: 24 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: '#555577', letterSpacing: 1.5 },
  seeAll: { color: '#5340f0', fontSize: 13, fontWeight: '500' },

  // Service cards (horizontal)
  serviceCard: { backgroundColor: '#111120', borderRadius: 16, borderWidth: 0.5, borderColor: '#2a2a40', padding: 16, marginRight: 12, width: 140 },
  serviceIconWrap: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#1a0a3e', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  serviceName: { color: '#ddddff', fontSize: 14, fontWeight: '600', marginBottom: 2 },
  serviceDesc: { color: '#444466', fontSize: 12 },

  // Job cards
  jobCard: { backgroundColor: '#111120', borderRadius: 16, borderWidth: 0.5, borderColor: '#2a2a40', padding: 16, marginBottom: 12 },
  jobCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  jobTitle: { color: '#eeeeee', fontSize: 15, fontWeight: '600', marginBottom: 3 },
  jobDate: { color: '#444466', fontSize: 12 },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  statusText: { fontSize: 11, fontWeight: '600', textTransform: 'capitalize' },
  progressBar: { height: 4, backgroundColor: '#1a1a30', borderRadius: 2, marginBottom: 12 },
  progressFill: { height: '100%', backgroundColor: '#5340f0', borderRadius: 2 },
  jobMeta: { flexDirection: 'row', gap: 14, flexWrap: 'wrap' },
  jobMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  jobMetaText: { color: '#555577', fontSize: 12 },
  progressPct: { color: '#5340f0', fontSize: 12, fontWeight: '600' },

  // Invoice cards
  invoiceCard: { backgroundColor: '#111120', borderRadius: 14, borderWidth: 0.5, borderColor: '#2a2a40', padding: 14, flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  invoiceIconWrap: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#1a0a3e', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  invoiceService: { color: '#ddddff', fontSize: 13, fontWeight: '500', marginBottom: 2 },
  invoiceMeta: { color: '#444466', fontSize: 11 },
  invoiceAmount: { color: '#a090ff', fontSize: 14, fontWeight: '700' },

  // Empty state
  emptyState: { alignItems: 'center', paddingVertical: 28 },
  emptyText: { color: '#333355', fontSize: 14, fontWeight: '500', marginTop: 10 },
  emptySubtext: { color: '#222244', fontSize: 12, marginTop: 4 },

  // Floating CTA
  ctaContainer: { position: 'absolute', bottom: 24, left: 20, right: 20 },
  ctaButton: { backgroundColor: '#4f35e8', paddingVertical: 17, borderRadius: 18, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', shadowColor: '#5340f0', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.45, shadowRadius: 16, elevation: 10 },
  ctaButtonText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },

  // Modal
  modalContainer: { flex: 1, backgroundColor: '#0a0a0f' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 56, borderBottomWidth: 0.5, borderBottomColor: '#1a1a30' },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#ffffff' },
  modalContent: { flex: 1, padding: 20 },
  closeLink: { color: '#5340f0', fontWeight: '500', fontSize: 15 },

  // Detail rows (job/invoice detail modal)
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: '#1a1a30' },
  detailLabel: { color: '#555577', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 },
  detailValue: { color: '#ddddff', fontSize: 14, flex: 1, textAlign: 'right' },

  complaintCard: { backgroundColor: '#111120', borderWidth: 0.5, borderColor: '#2a2a40', borderRadius: 10, padding: 12, marginBottom: 8 },

  // Form inputs (inside modals)
  formInput: { backgroundColor: '#111120', borderWidth: 0.5, borderColor: '#2a2a40', borderRadius: 12, padding: 14, color: '#e0e0ff', fontSize: 14, marginBottom: 4 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: '#6666aa', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8, marginTop: 4 },

  // Service selector (inside booking modal)
  serviceSelectCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#111120', borderWidth: 0.5, borderColor: '#2a2a40', borderRadius: 14, padding: 14, gap: 12 },
  serviceSelectCardActive: { borderColor: '#5340f0', backgroundColor: '#13132a' },
  serviceSelectIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#1a0a3e', alignItems: 'center', justifyContent: 'center' },
  serviceSelectName: { color: '#aaaacc', fontSize: 14, fontWeight: '600' },
  serviceSelectDesc: { color: '#444466', fontSize: 12, marginTop: 1 },

  // Notification modal
  notificationItem: { flexDirection: 'row', backgroundColor: '#111120', borderWidth: 0.5, borderColor: '#2a2a40', borderRadius: 14, padding: 14, marginBottom: 10 },
  notificationIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  notificationContent: { flex: 1 },
  notificationTitle: { color: '#ddddff', fontSize: 13, fontWeight: '600' },
  notificationMessage: { color: '#555577', fontSize: 12, marginTop: 2 },
  notificationTime: { color: '#333355', fontSize: 11, marginTop: 4 },

  // Installment form
  installSection: { backgroundColor: '#0e0e1c', borderWidth: 0.5, borderColor: '#1e1e38', borderRadius: 14, padding: 16, margin: 16, marginBottom: 0 },
  installSectionTitle: { color: '#a090ff', fontWeight: '600', fontSize: 13, marginBottom: 12, letterSpacing: 0.5 },
  installInput: { backgroundColor: '#111120', borderWidth: 0.5, borderColor: '#2a2a40', borderRadius: 10, padding: 12, color: '#e0e0ff', fontSize: 13, marginBottom: 8 },
  paymentHeader: { flex: 1, color: '#7070aa', fontSize: 11, fontWeight: '600', textAlign: 'center' },
  paymentCell: { flex: 1, color: '#aaaacc', fontSize: 11, textAlign: 'center', paddingVertical: 4 },
  paymentCellInput: { flex: 1, borderWidth: 0.5, borderColor: '#2a2a40', borderRadius: 6, padding: 4, fontSize: 11, marginHorizontal: 2, backgroundColor: '#0d0d18', color: '#e0e0ff', textAlign: 'center' },
});