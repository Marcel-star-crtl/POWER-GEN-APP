import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next'; // ✅ proper import
import { Colors } from '../../constants/Colors';
import { PhotoAttachment, PhotoCapture } from './PhotoCapture';

type WarningLevel = 'critical' | 'warning' | 'info' | 'none';

interface StatusToggleProps {
  label: string;
  value: boolean | null; // true = OK/Yes, false = NOK/No, null = Unselected
  onChange: (value: boolean) => void;
  required?: boolean;
  warningLevel?: WarningLevel;
  comment?: string;
  onCommentChange?: (text: string) => void;
  okLabel?: string;
  nokLabel?: string;
  /** Optional photo(s) attached to this item's issue — e.g. a close-up of the
   *  fault. Purely additive: omit onAddPhoto and no photo UI renders, so every
   *  existing call site keeps behaving exactly as before. */
  photos?: PhotoAttachment[];
  onAddPhoto?: (photo: PhotoAttachment) => void;
  onRemovePhoto?: (uri: string) => void;
  maxPhotos?: number;
}

export const StatusToggle: React.FC<StatusToggleProps> = ({
  label,
  value,
  onChange,
  required,
  warningLevel = 'none',
  comment,
  onCommentChange,
  okLabel = 'OK / Yes',
  nokLabel = 'NOK / No',
  photos,
  onAddPhoto,
  onRemovePhoto,
  maxPhotos = 3,
}) => {
  const { t } = useTranslation(); // ✅ hook at the top of the component, reads from I18nextProvider

  const isNOK = value === false;

  const getWarningConfig = () => {
    switch (warningLevel) {
      case 'critical':
        return {
          icon: 'alert-circle' as const,
          color: Colors.danger,
          bg: '#fef2f2',
          title: 'CRITICAL ISSUE',
          message: 'Immediate attention required'
        };
      case 'warning':
        return {
          icon: 'warning' as const,
          color: Colors.warning,
          bg: '#fffbeb',
          title: 'WARNING',
          message: 'Attention needed'
        };
      case 'info':
        return {
          icon: 'information-circle' as const,
          color: Colors.primary,
          bg: '#eff6ff',
          title: 'INFO',
          message: 'Recommended action'
        };
      default:
        return null;
    }
  };

  // getWarningConfig() returns null for warningLevel 'none'/unset. Previously
  // that meant the comment box below never rendered at all for a call site
  // that passed comment/onCommentChange but no warningLevel — so selecting
  // "NOK" silently did nothing. We still want that visual styling (colored
  // box) to depend on warningLevel, but the comment/photo controls themselves
  // should appear on any NOK selection where the parent actually wants them,
  // via a neutral fallback "issue noted" style.
  const warning = getWarningConfig();
  const hasIssueInputs = Boolean(onCommentChange || onAddPhoto);
  const issuePanel =
    warning ||
    (hasIssueInputs
      ? {
          icon: 'chatbox-ellipses-outline' as const,
          color: Colors.textSecondary,
          bg: Colors.lightGray,
          title: 'ISSUE NOTED',
          message: 'Add any details below (optional)',
        }
      : null);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>
        {t(label, label)}
        {required && <Text style={styles.required}> *</Text>}
      </Text>

      <View style={styles.toggleContainer}>
        <TouchableOpacity
          style={[
            styles.button,
            value === true && styles.buttonOkSelected
          ]}
          onPress={() => onChange(true)}
        >
          {value === true && <Ionicons name="checkmark" size={18} color="white" style={styles.icon} />}
          <Text style={[styles.buttonText, value === true && styles.buttonTextSelected]}>{t(okLabel, okLabel)}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.button,
            value === false && styles.buttonNokSelected
          ]}
          onPress={() => onChange(false)}
        >
          {value === false && <Ionicons name="close" size={18} color="white" style={styles.icon} />}
          <Text style={[styles.buttonText, value === false && styles.buttonTextSelected]}>{t(nokLabel, nokLabel)}</Text>
        </TouchableOpacity>
      </View>

      {isNOK && issuePanel && (
        <View style={[styles.warningContainer, { backgroundColor: issuePanel.bg, borderLeftColor: issuePanel.color }]}>
          <View style={styles.warningHeader}>
            <Ionicons name={issuePanel.icon} size={20} color={issuePanel.color} />
            <Text style={[styles.warningTitle, { color: issuePanel.color }]}>{t(issuePanel.title, issuePanel.title)}</Text>
          </View>
          <Text style={styles.warningMessage}>{t(issuePanel.message, issuePanel.message)}</Text>

          {onCommentChange && (
            <View style={styles.commentContainer}>
              <Text style={styles.commentLabel}>{t('statusToggle.commentsLabel', 'Comments / Observations (optional)')}</Text>
              <TextInput
                style={styles.commentInput}
                multiline
                numberOfLines={3}
                placeholder={t('statusToggle.commentsPlaceholder', 'Describe the issue...')}
                value={comment}
                onChangeText={onCommentChange}
                textAlignVertical="top"
              />
              <Text style={styles.charCount}>{comment?.length || 0}/500</Text>
            </View>
          )}

          {onAddPhoto && onRemovePhoto && (
            <View style={styles.commentContainer}>
              <PhotoCapture
                label={t('statusToggle.issuePhotoLabel', 'Photo (optional)')}
                photos={photos || []}
                onAddPhoto={onAddPhoto}
                onRemovePhoto={onRemovePhoto}
                maxPhotos={maxPhotos}
              />
            </View>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
    marginBottom: 8,
  },
  required: {
    color: Colors.danger,
  },
  toggleContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: Colors.lightGray,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  buttonOkSelected: {
    backgroundColor: Colors.success,
  },
  buttonNokSelected: {
    backgroundColor: Colors.danger,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  buttonTextSelected: {
    color: Colors.surface,
  },
  icon: {
    marginRight: 6,
  },
  warningContainer: {
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
  },
  warningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  warningTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 8,
  },
  warningMessage: {
    fontSize: 14,
    color: Colors.text,
    marginBottom: 12,
  },
  commentContainer: {
    marginTop: 8,
  },
  commentLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  commentInput: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 12,
    minHeight: 80,
    fontSize: 14,
  },
  charCount: {
    fontSize: 10,
    color: Colors.textSecondary,
    textAlign: 'right',
    marginTop: 4,
  },
});