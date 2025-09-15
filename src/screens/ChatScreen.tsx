import React, { useState, useEffect, useRef } from 'react';
import { 
  View, TouchableOpacity, ActivityIndicator, Text, FlatList, TextInput,
  StyleSheet, Image, KeyboardAvoidingView, Platform, Dimensions, Alert, ScrollView
} from 'react-native';
import { io, Socket } from 'socket.io-client';
import { launchImageLibrary } from 'react-native-image-picker';
import Icon from 'react-native-vector-icons/Ionicons';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = "https://darlyn-alt-backend.onrender.com"; 
const { width } = Dimensions.get('window');

interface Message {
  _id: string;
  content?: string;
  senderId: string;
  senderRole: string;
  createdAt: string;
  images?: string[];
  readBy?: Array<{
    userId: string;
    readAt: string;
  }>;
}

interface User {
  _id: string;
  name: string;
  email: string;
  lastSeen?: string;
  isOnline?: boolean;
  unreadCount?: number; // Add unread count
}

interface UserProfile {
  _id: string;
  name: string;
  email: string;
  role: string;
}

interface GroupedMessages {
  date: string;
  dateLabel: string;
  messages: Message[];
}

// Helper: Get JWT token
const getToken = async (): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem('token');
  } catch (e) {
    console.error('Token error:', e);
    return null;
  }
};

// Helper: Group messages by date
const groupMessagesByDate = (messages: Message[]): GroupedMessages[] => {
  const groups: { [key: string]: Message[] } = {};
  
  messages.forEach(message => {
    const messageDate = new Date(message.createdAt);
    const dateKey = messageDate.toDateString();
    
    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }
    groups[dateKey].push(message);
  });

  return Object.entries(groups).map(([dateKey, msgs]) => {
    const date = new Date(dateKey);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    let dateLabel: string;
    if (date.toDateString() === today.toDateString()) {
      dateLabel = 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      dateLabel = 'Yesterday';
    } else {
      dateLabel = date.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    }

    return {
      date: dateKey,
      dateLabel,
      messages: msgs.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    };
  }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
};

// Helper: Get activity status
const getActivityStatus = (user: User): { text: string; color: string } => {
  if (user.isOnline) {
    return { text: 'Online', color: '#4CAF50' };
  }

  if (!user.lastSeen) return { text: 'Offline', color: '#999' };
  
  const lastSeen = new Date(user.lastSeen);
  const now = new Date();
  const diffMinutes = Math.floor((now.getTime() - lastSeen.getTime()) / (1000 * 60));

  if (diffMinutes < 5) {
    return { text: 'Just now', color: '#4CAF50' };
  } else if (diffMinutes < 60) {
    return { text: `${diffMinutes}m ago`, color: '#FF9800' };
  } else if (diffMinutes < 1440) { // 24 hours
    const hours = Math.floor(diffMinutes / 60);
    return { text: `${hours}h ago`, color: '#FF9800' };
  } else {
    const days = Math.floor(diffMinutes / 1440);
    return { text: `${days}d ago`, color: '#999' };
  }
};

const ChatScreen: React.FC = () => {
  const [step, setStep] = useState<'selectUser' | 'chat'>('selectUser');
  const [users, setUsers] = useState<User[]>([]);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [groupedMessages, setGroupedMessages] = useState<GroupedMessages[]>([]);
  const [loading, setLoading] = useState(false);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const globalSocketRef = useRef<Socket | null>(null); // Separate global socket
  const scrollViewRef = useRef<ScrollView>(null);
  const [activeUserId, setActiveUserId] = useState<string | null>(null);
  const [activeUser, setActiveUser] = useState<User | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());

  // Update grouped messages when messages change
  useEffect(() => {
    if (messages.length > 0) {
      setGroupedMessages(groupMessagesByDate(messages));
      // Scroll to bottom when messages update
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  // Load user profile from API
  useEffect(() => {
    const loadUserProfile = async () => {
      try {
        const token = await getToken();
        if (!token) {
          Alert.alert('Error', 'No authentication token found');
          return;
        }

        const response = await axios.get<UserProfile>(`${API_BASE_URL}/users/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const userProfile = response.data;
        setUserId(userProfile._id);
        setRole(userProfile.role);

        await AsyncStorage.setItem('userId', userProfile._id);
        await AsyncStorage.setItem('role', userProfile.role);
        
      } catch (error: any) {
        console.error('❌ Error loading user profile:', error.response?.data || error.message);
        
        try {
          const storedUserId = await AsyncStorage.getItem('userId');
          const storedRole = await AsyncStorage.getItem('role');
          
          if (storedUserId && storedRole) {
            setUserId(storedUserId);
            setRole(storedRole);
            console.log('📱 Using stored user data as fallback');
          } else {
            Alert.alert('Error', 'Failed to load user profile. Please login again.');
          }
        } catch (storageError) {
          console.error('❌ AsyncStorage fallback failed:', storageError);
          Alert.alert('Error', 'Failed to load user data');
        }
      }
    };

    loadUserProfile();
  }, []);

  // Initialize global socket connection for user presence
  useEffect(() => {
    if (userId) {
      const initializeGlobalSocket = async () => {
        const token = await getToken();
        if (!token) return;

        // Clean up existing global socket
        if (globalSocketRef.current) {
          globalSocketRef.current.disconnect();
        }

        // Initialize global socket for user presence
        const globalSocket = io(API_BASE_URL, {
          transports: ['websocket'],
          auth: { token },
          query: { userId, type: 'presence' },
        });
        globalSocketRef.current = globalSocket;

        globalSocket.on('connect', () => {
          console.log('🌐 Global socket connected for presence');
          globalSocket.emit('userOnline', userId);
        });

        globalSocket.on('disconnect', () => {
          console.log('🌐 Global socket disconnected');
        });

        // Handle user presence updates
        globalSocket.on('userOnline', (onlineUserId: string) => {
          setOnlineUsers(prev => new Set([...prev, onlineUserId]));
          setUsers(prev => prev.map(user => 
            user._id === onlineUserId ? { ...user, isOnline: true } : user
          ));
        });

        globalSocket.on('userOffline', (offlineUserId: string) => {
          setOnlineUsers(prev => {
            const newSet = new Set(prev);
            newSet.delete(offlineUserId);
            return newSet;
          });
          setUsers(prev => prev.map(user => 
            user._id === offlineUserId ? { ...user, isOnline: false } : user
          ));
        });

        // Update user activity every 30 seconds while app is active
        const activityInterval = setInterval(() => {
          globalSocket.emit('updateActivity', userId);
        }, 30000);

        return () => {
          clearInterval(activityInterval);
          globalSocket.emit('userOffline', userId);
          globalSocket.disconnect();
        };
      };

      const cleanup = initializeGlobalSocket();
      
      return () => {
        cleanup?.then(cleanupFn => cleanupFn?.());
      };
    }
  }, [userId]);

  // Fetch contacts list with activity status and unread counts
  useEffect(() => {
    const fetchUsers = async () => {
      if (!role) return;
      setLoading(true);
      try {
        const token = await getToken();

        if (role === 'customer') {
          const res = await axios.get(`${API_BASE_URL}/users/approved-workers?includeActivity=true`, {
            headers: { Authorization: `Bearer ${token}` },
          });

          const normalized: User[] = res.data.map((w: any) => ({
            _id: w._id || w.id,
            name: w.name || 'Unnamed Worker',
            email: w.email || 'No email',
            lastSeen: w.lastSeen,
            isOnline: w.isOnline || false,
            unreadCount: w.unreadCount || 0,
          }));
          setUsers(normalized);
        } else if (role === 'worker') {
          const res = await axios.get(`${API_BASE_URL}/chat/my-chats?includeActivity=true`, {
            headers: { Authorization: `Bearer ${token}` },
          });

          const normalized: User[] = res.data.map((c: any) => ({
            _id: c._id || c.id,
            name: c.name || 'Unnamed Customer',
            email: c.email || 'No email',
            lastSeen: c.lastSeen,
            isOnline: c.isOnline || false,
            unreadCount: c.unreadCount || 0,
          }));
          setUsers(normalized);
        }
      } catch (err: any) {
        console.error('❌ Error fetching users:', err.response?.data || err.message);
        Alert.alert('Error', 'Failed to load contacts');
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, [role]);

  // Mark messages as read when viewing
  const markMessagesAsRead = async (roomId: string) => {
    if (!userId) return;
    
    try {
      const token = await getToken();
      const response = await axios.post(
        `${API_BASE_URL}/chat/rooms/${roomId}/mark-read`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // Update local messages with the response from server
      if (response.data.updatedMessages && Array.isArray(response.data.updatedMessages)) {
        setMessages(prevMessages => {
          const updatedMessagesMap = new Map<string, Message>(
            response.data.updatedMessages.map((msg: Message) => [msg._id, msg])
          );
          return prevMessages.map((msg: Message): Message => {
            const updated = updatedMessagesMap.get(msg._id);
            return updated ?? msg;
          });
        });

        // Emit read status updates through socket
        if (socketRef.current) {
          response.data.updatedMessages.forEach((msg: Message) => {
            socketRef.current?.emit('messageRead', {
              messageId: msg._id,
              userId: userId,
              roomId: roomId
            });
          });
        }
      }

      // Update unread count for the active user
      if (activeUserId) {
        setUsers(prev => prev.map(user => 
          user._id === activeUserId ? { ...user, unreadCount: 0 } : user
        ));
      }
    } catch (error) {
      console.error('Failed to mark messages as read:', error);
    }
  };

  // Fetch messages for a room
  const fetchMessages = async (roomId: string) => {
    try {
      const token = await getToken();
      const res = await axios.get(`${API_BASE_URL}/chat/rooms/${roomId}/messages`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (Array.isArray(res.data.items)) {
        setMessages(res.data.items.reverse());
        // Mark messages as read after a short delay
        setTimeout(() => markMessagesAsRead(roomId), 500);
      }
    } catch (err: any) {
      console.error('❌ Fetch messages error:', err.response?.data || err.message);
    }
  };

  // Coming soon alert for call features
  const comingSoon = () => {
    Alert.alert("Coming Soon", "This feature will be available in a future update 🚀");
  };

  // Handle selecting a contact
  const handleUserSelect = async (otherUser: User) => {
    setActiveUserId(otherUser._id);
    setActiveUser(otherUser);

    if (!userId) {
      Alert.alert('Error', 'User ID not loaded yet');
      return;
    }

    setLoading(true);
    try {
      const token = await getToken();

      const params =
        role === 'customer'
          ? { customerId: userId, workerId: otherUser._id }
          : { customerId: otherUser._id, workerId: userId };

      const res = await axios.get(`${API_BASE_URL}/chat/rooms`, {
        headers: { Authorization: `Bearer ${token}` },
        params,
      });

      const activeRoomId = res.data.roomId;
      if (!activeRoomId) throw new Error('Room ID missing in API response');

      setRoomId(activeRoomId);
      await fetchMessages(activeRoomId);

      // Disconnect existing room socket
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      
      // Create new socket for this room
      const socket = io(API_BASE_URL, {
        transports: ['websocket'],
        auth: { token },
        query: { roomId: activeRoomId, userId, type: 'chat' },
      });
      socketRef.current = socket;

      socket.on('connect', () => {
        console.log('🔌 Room socket connected');
        socket.emit('joinRoom', activeRoomId);
      });
      
      socket.on('disconnect', () => console.log('🔌 Room socket disconnected'));
      
      // Handle new messages
      socket.on('newMessage', (msg: Message) => {
        console.log('📨 New message received:', msg);
        setMessages(prev => {
          const exists = prev.some(existingMsg => existingMsg._id === msg._id);
          if (exists) return prev;
          return [...prev, msg];
        });
        
        // Auto-mark as read if it's not from current user
        if (msg.senderId !== userId) {
          setTimeout(() => markMessagesAsRead(activeRoomId), 500);
        }
      });

      // Handle message updates (like read status)
      socket.on('messageUpdated', (updatedMsg: Message) => {
        setMessages(prev => 
          prev.map(msg => msg._id === updatedMsg._id ? updatedMsg : msg)
        );
      });

      // Handle read receipts
      socket.on('messageRead', (data: { messageId: string; userId: string; readAt: string }) => {
        setMessages(prev => 
          prev.map(msg => {
            if (msg._id === data.messageId && msg.senderId === userId) {
              const updatedReadBy = [...(msg.readBy || [])];
              const existingReadIndex = updatedReadBy.findIndex(r => r.userId === data.userId);
              
              if (existingReadIndex >= 0) {
                updatedReadBy[existingReadIndex] = { userId: data.userId, readAt: data.readAt };
              } else {
                updatedReadBy.push({ userId: data.userId, readAt: data.readAt });
              }
              
              return { ...msg, readBy: updatedReadBy };
            }
            return msg;
          })
        );
      });

      setStep('chat');
    } catch (err: any) {
      console.error('❌ Error selecting chat user:', err.response?.data || err.message);
      Alert.alert('Error', 'Failed to start chat');
    } finally {
      setLoading(false);
    }
  };

  // Back to contacts
  const handleBack = () => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    setRoomId(null);
    setMessages([]);
    setGroupedMessages([]);
    setInputText('');
    setActiveUser(null);
    setActiveUserId(null);
    setStep('selectUser');
  };

  // Send a text message
  const sendMessage = async () => {
    if (!inputText.trim() || !roomId || !userId || sending) return;

    const messageText = inputText.trim();
    setInputText('');
    setSending(true);

    const tempId = `temp-${Date.now()}`;
    const tempMessage: Message = {
      _id: tempId,
      content: messageText,
      senderId: userId,
      senderRole: role || 'customer',
      createdAt: new Date().toISOString(),
      readBy: [],
    };
    
    setMessages(prev => [...prev, tempMessage]);

    try {
      const token = await getToken();
      const res = await axios.post(
        `${API_BASE_URL}/chat/rooms/${roomId}/messages`,
        { 
          content: messageText,
          customerId: role === 'customer' ? userId : activeUserId,
          workerId: role === 'worker' ? userId : activeUserId
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Replace temporary message with real message
      setMessages(prev =>
        prev.map(msg => (msg._id === tempId ? res.data : msg))
      );
      
      // Emit message through socket
      if (socketRef.current) {
        socketRef.current.emit('sendMessage', res.data);
      }
    } catch (err: any) {
      console.error('❌ Send message error:', err.response?.data || err.message);
      // Remove failed message
      setMessages(prev => prev.filter(msg => msg._id !== tempId));
      Alert.alert('Error', 'Failed to send message');
      setInputText(messageText); 
    } finally {
      setSending(false);
    }
  };

 
  const handleImagePick = () => {
    if (!roomId) return;

    launchImageLibrary({ 
      mediaType: 'photo',
      quality: 0.8,
      maxWidth: 1024,
      maxHeight: 1024
    }, async (response: any) => {
      if (response.assets?.length) {
        const image = response.assets[0];
        
        
        const tempId = `temp-img-${Date.now()}`;
        const tempMessage: Message = {
          _id: tempId,
          senderId: userId!,
          senderRole: role || 'customer',
          createdAt: new Date().toISOString(),
          images: [image.uri], 
          readBy: [],
        };
        setMessages(prev => [...prev, tempMessage]);

        const formData = new FormData();
        formData.append('images', {
          uri: image.uri,
          type: image.type || 'image/jpeg',
          name: image.fileName || 'image.jpg',
        } as any);
        
        formData.append('customerId', role === 'customer' ? userId! : activeUserId!);
        formData.append('workerId', role === 'worker' ? userId! : activeUserId!);

        try {
          const token = await getToken();
          const uploadRes = await axios.post(
            `${API_BASE_URL}/chat/rooms/${roomId}/messages`,
            formData,
            { 
              headers: { 
                'Content-Type': 'multipart/form-data', 
                Authorization: `Bearer ${token}` 
              },
              timeout: 30000 // 30 second timeout for image uploads
            }
          );

          // Replace temporary message with real message containing Cloudinary URL
          setMessages(prev => 
            prev.map(msg => msg._id === tempId ? uploadRes.data : msg)
          );
          
          if (socketRef.current) {
            socketRef.current.emit('sendMessage', uploadRes.data);
          }
        } catch (err: any) {
          console.error('❌ Image upload error:', err.response?.data || err.message);
          // Remove failed temporary message
          setMessages(prev => prev.filter(msg => msg._id !== tempId));
          Alert.alert('Error', 'Failed to send image. Please try again.');
        }
      }
    });
  };

  // Format timestamp
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  // Check if message is read by recipient
  const getMessageReadStatus = (message: Message): { isRead: boolean; isSent: boolean } => {
    if (!message.readBy || message.senderId !== userId) {
      return { isRead: false, isSent: false };
    }

    // Message is sent if it has an _id that's not temporary
    const isSent = !message._id.startsWith('temp-');
    
    // Message is read if someone other than sender has read it
    const isRead = message.readBy.some(read => read.userId !== message.senderId);
    
    return { isRead, isSent };
  };

  // Render date separator
  const renderDateSeparator = (dateLabel: string) => (
    <View style={styles.dateSeparator} key={dateLabel}>
      <View style={styles.dateLine} />
      <Text style={styles.dateText}>{dateLabel}</Text>
      <View style={styles.dateLine} />
    </View>
  );

  // Render single message
  const renderMessage = ({ item }: { item: Message }) => {
    const isMyMessage = item.senderId === userId;
    const { isRead, isSent } = getMessageReadStatus(item);

    return (
      <View style={[styles.messageContainer, isMyMessage ? styles.myMessage : styles.otherMessage]}>
        <View style={[styles.messageBubble, isMyMessage ? styles.myBubble : styles.otherBubble]}>
          {item.images?.map((img, i) => (
            <Image 
              key={`${item._id}-img-${i}`} 
              source={{ uri: img }} 
              style={styles.messageImage} 
              resizeMode="cover"
              onError={(error) => {
                console.warn('Failed to load image:', img, error.nativeEvent.error);
              }}
            />
          ))}
          {item.content && (
            <Text style={[styles.messageText, isMyMessage ? styles.myMessageText : styles.otherMessageText]}>
              {item.content}
            </Text>
          )}
          <View style={styles.messageFooter}>
            <Text style={[styles.timeText, isMyMessage ? styles.myTimeText : styles.otherTimeText]}>
              {formatTime(item.createdAt)}
            </Text>
            {isMyMessage && isSent && (
              <Icon 
                name="checkmark-done" 
                size={16} 
                color={isRead ? "#4CAF50" : "rgba(255,255,255,0.7)"} 
                style={styles.readIcon}
              />
            )}
          </View>
        </View>
      </View>
    );
  };

 
  const renderGroupedMessages = () => {
    return groupedMessages.map((group, index) => (
      <View key={`${group.date}-${index}`}>
        {renderDateSeparator(group.dateLabel)}
        {group.messages.map((message, msgIndex) => (
          <View key={message._id || `${group.date}-${msgIndex}`}>
            {renderMessage({ item: message })}
          </View>
        ))}
      </View>
    ));
  };

  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      if (globalSocketRef.current) {
        globalSocketRef.current.emit('userOffline', userId);
        globalSocketRef.current.disconnect();
      }
    };
  }, [userId]);

  
  if (!userId || !role || loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>
          {!userId ? 'Loading user profile...' : !role ? 'Loading user role...' : 'Loading...'}
        </Text>
      </View>
    );
  }

  // Contact selection screen
  if (step === 'selectUser') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>
          {role === 'customer' ? 'Select a Worker to Chat' : 'Select a Customer to Chat'}
        </Text>
        <FlatList
          data={users}
          keyExtractor={item => item._id}
          renderItem={({ item }) => {
            const activityStatus = getActivityStatus(item);
            return (
              <TouchableOpacity onPress={() => handleUserSelect(item)} style={styles.workerItem}>
                <View style={styles.workerInfo}>
                  <View style={styles.workerDetails}>
                    <View style={styles.nameContainer}>
                      <Text style={styles.workerName}>{item.name}</Text>
                      {(item.unreadCount || 0) > 0 && (
                        <View style={styles.unreadBadge}>
                          <Text style={styles.unreadText}>
                            {item.unreadCount! > 99 ? '99+' : item.unreadCount}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.workerEmail}>{item.email}</Text>
                  </View>
                  <View style={styles.statusContainer}>
                    <View style={[styles.statusDot, { backgroundColor: activityStatus.color }]} />
                    <Text style={[styles.statusText, { color: activityStatus.color }]}>
                      {activityStatus.text}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      </View>
    );
  }

  // Chat screen
  const activityStatus = activeUser ? getActivityStatus(activeUser) : null;

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButtonContainer}>
          <Icon name="arrow-back" size={24} color="#007AFF" />
          <Text style={styles.backButtonText}>
            {role === 'customer' ? 'Workers' : 'Customers'}
          </Text>
        </TouchableOpacity>
        
        {activeUser && activityStatus && (
          <View style={styles.chatHeaderStatus}>
            <Text style={styles.chatPartnerName}>{activeUser.name}</Text>
            <View style={styles.statusContainer}>
              <View style={[styles.statusDot, { backgroundColor: activityStatus.color }]} />
              <Text style={[styles.statusText, { color: activityStatus.color }]}>
                {activityStatus.text}
              </Text>
            </View>
            <View style={styles.callButtonContainer}>
              <TouchableOpacity onPress={comingSoon} style={styles.callButton}>
                <Icon name="call" size={24} color="#007AFF" />
              </TouchableOpacity>

              <TouchableOpacity onPress={comingSoon} style={styles.callButton}>
                <Icon name="videocam" size={24} color="#007AFF" />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* Messages List */}
      <ScrollView
        style={styles.messagesList}
        contentContainerStyle={styles.messagesContent}
        ref={scrollViewRef}
        onContentSizeChange={() => {
          // Auto-scroll to bottom when content changes
          scrollViewRef.current?.scrollToEnd({ animated: false });
        }}
      >
        {renderGroupedMessages()}
      </ScrollView>

      {/* Message Input */}
      <View style={styles.inputContainer}>
        <TouchableOpacity onPress={handleImagePick} style={styles.imageButton}>
          <Icon name="camera" size={24} color="#007AFF" />
        </TouchableOpacity>
        
        <TextInput
          style={styles.textInput}
          value={inputText}
          onChangeText={setInputText}
          placeholder="Type a message..."
          multiline
          maxLength={1000}
          onSubmitEditing={sendMessage}
          returnKeyType="send"
        />
        
        <TouchableOpacity
          onPress={sendMessage}
          style={[styles.sendButton, (!inputText.trim() || sending) && styles.sendButtonDisabled]}
          disabled={!inputText.trim() || sending}
        >
          {sending ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Icon name="send" size={20} color="white" />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8f9fa' },
  loadingText: { marginTop: 10, fontSize: 16, color: '#666' },
  title: { fontSize: 20, fontWeight: 'bold', padding: 16, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#e1e8ed' },
  
  // Contact list styles
  workerItem: { padding: 16, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#e1e8ed' },
  workerInfo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  workerDetails: { flex: 1 },
  nameContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  workerName: { fontSize: 16, fontWeight: '600', color: '#1a1a1a' },
  workerEmail: { fontSize: 14, color: '#666', marginTop: 4 },
  
  // Unread badge styles
  unreadBadge: {
    backgroundColor: '#FF3B30',
    borderRadius: 12,
    minWidth: 24,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
    paddingHorizontal: 6,
  },
  unreadText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  
  // Status styles
  statusContainer: { flexDirection: 'row', alignItems: 'center' },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  statusText: { fontSize: 12, fontWeight: '500' },
  
  // Header styles
  header: { padding: 16, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#e1e8ed' },
  backButtonContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  backButtonText: { fontSize: 16, color: '#007AFF', fontWeight: '500', marginLeft: 8 },
  chatHeaderStatus: { alignItems: 'center' },
  chatPartnerName: { fontSize: 18, fontWeight: '600', color: '#1a1a1a', marginBottom: 4 },
  
  // Call button styles
  callButtonContainer: { flexDirection: 'row', marginTop: 8, gap: 12 },
  callButton: {
    backgroundColor: '#f0f0f0',
    padding: 10,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    width: 50,
    height: 50,
  },
  
  // Messages styles
  messagesList: { flex: 1 },
  messagesContainer: { padding: 16 },
  messagesContent: { paddingBottom: 16, paddingHorizontal: 16 },
  
  // Date separator styles
  dateSeparator: { flexDirection: 'row', alignItems: 'center', marginVertical: 20 },
  dateLine: { flex: 1, height: 1, backgroundColor: '#e1e8ed' },
  dateText: { marginHorizontal: 16, fontSize: 14, color: '#666', fontWeight: '500', backgroundColor: '#f8f9fa', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  
  // Message bubble styles
  messageContainer: { marginBottom: 12 },
  myMessage: { alignItems: 'flex-end' },
  otherMessage: { alignItems: 'flex-start' },
  messageBubble: { maxWidth: width * 0.75, borderRadius: 18, padding: 12 },
  myBubble: { backgroundColor: '#007AFF' },
  otherBubble: { backgroundColor: 'white', borderWidth: 1, borderColor: '#e1e8ed' },
  messageText: { fontSize: 16, lineHeight: 20 },
  myMessageText: { color: 'white' },
  otherMessageText: { color: '#1a1a1a' },
  messageFooter: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  timeText: { fontSize: 12 },
  myTimeText: { color: 'rgba(255,255,255,0.7)' },
  otherTimeText: { color: '#666' },
  readIcon: { marginLeft: 4 },
  messageImage: { width: 200, height: 150, borderRadius: 8, marginBottom: 8 },
  
  // Input styles
  inputContainer: { flexDirection: 'row', padding: 16, backgroundColor: 'white', borderTopWidth: 1, borderTopColor: '#e1e8ed', alignItems: 'flex-end' },
  imageButton: { padding: 8, marginRight: 8 },
  textInput: { flex: 1, borderWidth: 1, borderColor: '#e1e8ed', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 12, fontSize: 16, maxHeight: 100, marginRight: 8 },
  sendButton: { backgroundColor: '#007AFF', width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  sendButtonDisabled: { backgroundColor: '#ccc' },
});

export default ChatScreen;