import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  Modal,
  ScrollView,
  TextInput,
  Button,
} from 'react-native';
import api from '../utils/api';

type Job = {
  id: string;
  service: string;
  status: string;
  date: string;
  worker?: string | null;
  amount?: number;
  progress?: number;
  description?: string;
  address?: string;
  feedback?: { rating: number; comment: string } | null;
  complaints?: { title: string; description: string; status: string }[];
};

export default function JobsScreen() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  const [showComplaintModal, setShowComplaintModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);

  const [complaintTitle, setComplaintTitle] = useState('');
  const [complaintText, setComplaintText] = useState('');
  const [feedbackText, setFeedbackText] = useState('');
  const [rating, setRating] = useState<number>(5);

  const [submitting, setSubmitting] = useState(false);

  /** ✅ Fetch jobs with feedback and complaints */
  const fetchJobs = async () => {
  try {
    setLoading(true);

    // ✅ Fetch jobs, complaints, feedback, and invoices in parallel
    const [jobsRes, complaintsRes, feedbackRes, invoicesRes] = await Promise.all([
      api.get('/jobs/my'),
      api.get('/complaints/my'),
      api.get('/feedback/my'),
      api.get('/invoices'),
    ]);

    // ✅ Normalize complaints (from `items` or empty array)
    const complaintsData = Array.isArray(complaintsRes.data?.items)
      ? complaintsRes.data.items
      : [];

    // ✅ Normalize feedback
    const feedbackData = Array.isArray(feedbackRes.data)
      ? feedbackRes.data
      : feedbackRes.data?.feedback || [];

    // ✅ Normalize invoices
    const invoicesData = Array.isArray(invoicesRes.data)
      ? invoicesRes.data
      : invoicesRes.data?.invoices || [];

    // ✅ Merge data into jobs
    const jobsData = (jobsRes.data || []).map((job: any) => {
      const jobId = job._id || job.id;

      // ✅ Match complaints
      const jobComplaints = complaintsData.filter((c: any) => {
        const complaintJobId = typeof c.jobId === 'object' ? c.jobId._id : c.jobId;
        return complaintJobId === jobId;
      });

      // ✅ Match feedback
      const jobFeedback = feedbackData.find((f: any) => {
        const feedbackJobId = typeof f.jobId === 'object' ? f.jobId._id : f.jobId;
        return feedbackJobId === jobId;
      }) || null;

      // ✅ Match invoices & calculate total
      const jobInvoices = invoicesData.filter((inv: any) => {
        const invoiceJobId = typeof inv.jobId === 'object' ? inv.jobId._id : inv.jobId;
        return invoiceJobId === jobId;
      });
      const totalInvoiceAmount = jobInvoices.reduce(
  (sum: number, inv: any) => sum + (inv.totalAmount || 0),
  0
);


      return {
        id: jobId,
        service: job.serviceType || job.service || 'Service',
        status: job.status || 'pending',
        date: job.createdAt
          ? new Date(job.createdAt).toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0],
        worker:
          typeof job.assignedWorker === 'object'
            ? job.assignedWorker?.name
            : job.assignedWorker
            ? `Worker ID: ${job.assignedWorker}`
            : null,
        amount: totalInvoiceAmount, // ✅ Sum of all invoices for this job
        progress:
          job.status === 'ongoing'
            ? Math.floor(Math.random() * 80) + 10
            : job.status === 'completed'
            ? 100
            : 0,
        description: job.description || 'No description provided',
        address: job.address || 'No address provided',
        feedback: jobFeedback,
        complaints: jobComplaints,
        invoices: jobInvoices, 
      };
    });

    setJobs(jobsData);
  } catch (error: any) {
    console.error('Failed to fetch jobs:', error.response?.data || error.message || error);
    Alert.alert('Error', 'Failed to fetch jobs');
  } finally {
    setLoading(false);
  }
};

useEffect(() => {
  fetchJobs();
}, []);


  /** ✅ Submit Complaint */
  const submitComplaint = async () => {
    if (!complaintTitle.trim() || !complaintText.trim()) {
      return Alert.alert('Error', 'Please enter both title and complaint details');
    }
    try {
      setSubmitting(true);
      await api.post('/complaints', {
        jobId: selectedJob?.id,
        title: complaintTitle,
        description: complaintText,
      });
      Alert.alert('Success', 'Complaint submitted successfully');
      setComplaintTitle('');
      setComplaintText('');
      setShowComplaintModal(false);
      fetchJobs(); // refresh jobs to show complaints
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to submit complaint');
    } finally {
      setSubmitting(false);
    }
  };

  /** ✅ Submit Feedback */
  const submitFeedback = async () => {
    if (!feedbackText.trim()) return Alert.alert('Error', 'Please enter feedback');

    const payload = {
      jobId: selectedJob?.id,
      rating,
      comment: feedbackText || '',
    };

    try {
      await api.post('/feedback', payload);
      Alert.alert('Success', 'Feedback submitted successfully');
      setFeedbackText('');
      setRating(5);
      setShowFeedbackModal(false);
      fetchJobs(); // refresh jobs to show feedback
    } catch (error: any) {
      console.error('Feedback Error:', error.response?.data || error.message || error);
      Alert.alert('Error', error.response?.data?.message || 'Failed to submit feedback');
    }
  };

  /** ✅ Get color for status */
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

  /** ✅ Render Job Card */
  const renderJob = ({ item }: { item: Job }) => {
    const statusStyle = getStatusColor(item.status);
    return (
      <TouchableOpacity style={styles.jobCard} onPress={() => setSelectedJob(item)}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
          <Text style={styles.jobTitle}>{item.service}</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
            <Text style={[styles.statusText, { color: statusStyle.text }]}>{item.status}</Text>
          </View>
        </View>
        <Text>Date: {item.date}</Text>
        {item.worker && <Text>Worker: {item.worker}</Text>}
        <Text>Amount: ₦{item.amount?.toLocaleString()}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>All Jobs</Text>
      {loading ? (
        <ActivityIndicator size="large" color="#2563eb" />
      ) : jobs.length === 0 ? (
        <Text>No jobs found.</Text>
      ) : (
        <FlatList data={jobs} keyExtractor={(item) => item.id} renderItem={renderJob} contentContainerStyle={{ paddingBottom: 20 }} />
      )}

      {/* Job Details Modal */}
      <Modal visible={!!selectedJob} animationType="slide" onRequestClose={() => setSelectedJob(null)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{selectedJob?.service}</Text>
            <TouchableOpacity onPress={() => setSelectedJob(null)}>
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

            <View style={styles.modalSection}>
              <Text style={styles.sectionLabel}>Address</Text>
              <Text style={styles.sectionValue}>{selectedJob?.address}</Text>
            </View>

            <View style={styles.modalSection}>
              <Text style={styles.sectionLabel}>Description</Text>
              <Text style={styles.sectionValue}>{selectedJob?.description}</Text>
            </View>

            {/* ✅ Feedback Section */}
            {selectedJob?.feedback && (
              <View style={styles.modalSection}>
                <Text style={styles.sectionLabel}>Your Feedback</Text>
                <Text style={styles.sectionValue}>
                  ⭐ {selectedJob.feedback.rating} - {selectedJob.feedback.comment || 'No comment'}
                </Text>
              </View>
            )}

            {/* ✅ Complaints Section */}
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

            {/* ✅ Buttons */}
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
          </ScrollView>
        </View>

        {/* ✅ Previous Feedback & Complaints */}
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
      </Modal>

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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#f3f4f6' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 16, color: '#2563eb', letterSpacing: 1 },

  jobCard: {
    backgroundColor: '#fff',
    padding: 18,
    marginBottom: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 4,
    elevation: 2,
  },
  jobTitle: { fontSize: 19, fontWeight: 'bold', marginBottom: 4, color: '#1e293b' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14 },
  statusText: { fontSize: 13, fontWeight: '600', textTransform: 'capitalize' },

  modalContainer: { flex: 1, backgroundColor: '#f8fafc' },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#fff',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  modalTitle: { fontSize: 22, fontWeight: 'bold', color: '#2563eb', letterSpacing: 1 },
  closeButton: { color: '#2563eb', fontWeight: '600', fontSize: 16 },

  modalContent: { padding: 18 },
  modalSection: {
    marginBottom: 18,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  sectionLabel: { fontSize: 15, fontWeight: '600', color: '#374151', marginBottom: 6 },
  sectionValue: { fontSize: 17, color: '#111827', marginBottom: 2 },

  statusBadgeLarge: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 18,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  statusTextLarge: { fontSize: 15, fontWeight: '700', textTransform: 'capitalize' },

  complaintCard: {
    padding: 10,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    marginVertical: 5,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },

  actionButton: {
    backgroundColor: '#2563eb',
    padding: 15,
    borderRadius: 10,
    marginVertical: 8,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
  actionButtonText: { color: '#fff', fontSize: 17, fontWeight: '700', textAlign: 'center' },

  formModal: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#f8fafc',
  },
  textInput: {
    borderWidth: 1.5,
    borderColor: '#2563eb',
    borderRadius: 10,
    padding: 14,
    marginBottom: 18,
    backgroundColor: '#fff',
    textAlignVertical: 'top',
    minHeight: 60,
    fontSize: 16,
    color: '#1e293b',
  },

  // Extra styling for feedback/complaints section
  submissionsSection: {
    marginTop: 30,
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  submissionsTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10, color: '#2563eb' },
  feedbackLabel: { fontSize: 16, fontWeight: '600', marginBottom: 4, color: '#1e293b' },
  feedbackText: { fontSize: 14, color: '#374151' },
  complaintTitle: { fontSize: 14, fontWeight: '500', color: '#dc2626' },
  complaintDesc: { color: '#6b7280', marginBottom: 2 },
  complaintStatus: { fontSize: 12, fontWeight: '600' },
});
