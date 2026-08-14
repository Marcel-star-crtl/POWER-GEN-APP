import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Colors } from '../../constants/Colors';

export interface MessageBubbleProps {
  message: {
    id: string;
    text: string;
    sender: 'user' | 'assistant';
    timestamp: Date;
  };
  onActionPress?: () => void;
  showAction?: boolean;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ 
  message, 
  onActionPress,
  showAction 
}) => {
  const isUser = message.sender === 'user';

  return (
    <View style={[
      styles.container,
      isUser ? styles.userContainer : styles.assistantContainer
    ]}>
      <View style={[
        styles.bubble,
        isUser ? styles.userBubble : styles.assistantBubble
      ]}>
        <Text style={[
          styles.text,
          isUser ? styles.userText : styles.assistantText
        ]}>
          {message.text}
        </Text>
        
        {showAction && onActionPress && (
          <Pressable 
            style={styles.actionButton}
            onPress={onActionPress}
          >
            <Text style={styles.actionButtonText}>View Details</Text>
          </Pressable>
        )}
      </View>
      <Text style={styles.timestamp}>
        {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
    paddingHorizontal: 16,
  },
  userContainer: {
    alignItems: 'flex-end',
  },
  assistantContainer: {
    alignItems: 'flex-start',
  },
  bubble: {
    maxWidth: '80%',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 18,
  },
  userBubble: {
    backgroundColor: Colors.primary,
  },
  assistantBubble: {
    backgroundColor: Colors.lightGray,
  },
  text: {
    fontSize: 15,
    lineHeight: 20,
  },
  userText: {
    color: '#FFFFFF',
  },
  assistantText: {
    color: Colors.text,
  },
  timestamp: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 4,
    marginHorizontal: 4,
  },
  actionButton: {
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
});
