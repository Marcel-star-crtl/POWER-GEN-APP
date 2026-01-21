import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome5 } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Colors } from '../../constants/Colors';
import { MessageBubble } from '../../components/ui/MessageBubble';
import { SuggestionChips } from '../../components/ui/SuggestionChips';
import AIAssistantService, { ChatMessage, ChatSuggestion } from '../../services/aiAssistant';

export default function AIAssistant() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<ChatSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    initChat();
  }, []);

  const initChat = async () => {
    // Add welcome message
    const welcomeMessage: ChatMessage = {
      id: 'welcome',
      text: "Hi! I'm your AI assistant. I can help you with tasks, parts, sites, and maintenance advice. What would you like to know?",
      sender: 'assistant',
      timestamp: new Date(),
    };
    setMessages([welcomeMessage]);

    // Load suggestions
    try {
      const sugg = await AIAssistantService.getSuggestions();
      setSuggestions(sugg);
    } catch (error) {
      console.error('Failed to load suggestions:', error);
    }
  };

  const handleSend = async (text?: string) => {
    const messageText = text || inputText.trim();
    if (!messageText || isLoading) return;

    setInputText('');
    setShowSuggestions(false);

    // Add user message
    const userMessage = AIAssistantService.createUserMessage(
      messageText,
      Date.now().toString()
    );
    setMessages(prev => [...prev, userMessage]);

    // Show loading
    setIsLoading(true);

    try {
      // Get AI response
      const response = await AIAssistantService.sendMessage(messageText, messages);
      
      // Add assistant message
      const assistantMessage = AIAssistantService.responseToMessage(
        response,
        (Date.now() + 1).toString()
      );
      setMessages(prev => [...prev, assistantMessage]);

      // Handle actions based on response
      handleAssistantAction(assistantMessage);
    } catch (error: any) {
      console.error('Chat error:', error);
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        text: "Sorry, I encountered an error. Please try again.",
        sender: 'assistant',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAssistantAction = (message: ChatMessage) => {
    // Auto-scroll to bottom
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);

    // Handle specific actions
    if (message.action === 'show_tasks' && message.data && message.data.length > 0) {
      // Optionally show a button to navigate to tasks
      console.log('Tasks data received:', message.data.length);
    } else if (message.action === 'show_task_detail' && message.data) {
      // Optionally navigate to task detail
      console.log('Task detail data received');
    }
  };

  const handleSuggestionPress = (text: string) => {
    handleSend(text);
  };

  const handleMessageAction = (message: ChatMessage) => {
    if (message.action === 'show_tasks') {
      router.push('/(technician)/tasks');
    } else if (message.action === 'show_task_detail' && message.data?._id) {
      router.push({
        pathname: '/(technician)/task-detail',
        params: { id: message.data._id }
      });
    } else if (message.action === 'show_parts') {
      router.push('/(technician)/parts');
    }
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const hasActionData = item.action && item.data && 
      ['show_tasks', 'show_task_detail', 'show_parts'].includes(item.action);

    return (
      <MessageBubble
        message={item}
        onActionPress={() => handleMessageAction(item)}
        showAction={hasActionData}
      />
    );
  };

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeAreaTop}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <FontAwesome5 name="arrow-left" size={20} color={Colors.text} />
          </Pressable>
          <View style={styles.headerContent}>
            <FontAwesome5 name="robot" size={24} color={Colors.primary} />
            <View style={styles.headerText}>
              <Text style={styles.headerTitle}>AI Assistant</Text>
              <Text style={styles.headerSubtitle}>Ask me anything</Text>
            </View>
          </View>
          <View style={{ width: 40 }} />
        </View>
      </SafeAreaView>

      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messageList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        ListFooterComponent={
          isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={Colors.primary} />
              <Text style={styles.loadingText}>Thinking...</Text>
            </View>
          ) : null
        }
      />

      {showSuggestions && suggestions.length > 0 && messages.length <= 1 && (
        <SuggestionChips
          suggestions={suggestions}
          onSuggestionPress={handleSuggestionPress}
        />
      )}

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        style={styles.keyboardView}
      >
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Type a message..."
            placeholderTextColor={Colors.textSecondary}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={500}
            editable={!isLoading}
          />
          <Pressable
            style={[
              styles.sendButton,
              (!inputText.trim() || isLoading) && styles.sendButtonDisabled
            ]}
            onPress={() => handleSend()}
            disabled={!inputText.trim() || isLoading}
          >
            <FontAwesome5 
              name="paper-plane" 
              size={18} 
              color={inputText.trim() && !isLoading ? '#FFFFFF' : Colors.textSecondary} 
            />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  safeAreaTop: {
    backgroundColor: Colors.surface,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    padding: 8,
  },
  headerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  headerText: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
  },
  headerSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  messageList: {
    paddingVertical: 16,
    paddingBottom: 100,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },
  keyboardView: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 28,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 12,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.lightGray,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 100,
    color: Colors.text,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: Colors.lightGray,
  },
});
