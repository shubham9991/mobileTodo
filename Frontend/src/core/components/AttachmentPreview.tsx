import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../../themes/ThemeContext';
import { Attachment } from '../dummyData';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface AttachmentPreviewProps {
  attachments: Attachment[];
  onRemove: (id: string) => void;
  onPreview?: (attachment: Attachment) => void;
}

interface ImagePreviewModalProps {
  visible: boolean;
  imageUri: string | null;
  onClose: () => void;
}

function ImagePreviewModal({ visible, imageUri, onClose }: ImagePreviewModalProps) {
  const { theme, isDark } = useTheme();

  if (!visible || !imageUri) return null;

  return (
    <View style={styles.modalOverlay}>
      <TouchableOpacity
        style={[
          styles.modalBackdrop,
          { backgroundColor: isDark ? 'rgba(0,0,0,0.95)' : 'rgba(0,0,0,0.9)' },
        ]}
        onPress={onClose}
        activeOpacity={1}
      />
      <View style={styles.modalContent}>
        <Image
          source={{ uri: imageUri }}
          style={styles.fullSizeImage}
          resizeMode="contain"
        />
        <TouchableOpacity
          style={[
            styles.closeButton,
            {
              backgroundColor: theme.colors.cardPrimary,
              borderRadius: theme.radii.round,
            },
          ]}
          onPress={onClose}
        >
          <MaterialCommunityIcons name="close" size={24} color={theme.colors.text} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function truncateFilename(name: string, maxLength: number = 12): string {
  if (name.length <= maxLength) return name;
  const extension = name.split('.').pop();
  const baseName = name.substring(0, name.lastIndexOf('.'));
  if (extension && baseName.length > maxLength - extension.length - 3) {
    return `${baseName.substring(0, maxLength - extension.length - 3)}...${extension}`;
  }
  return name.substring(0, maxLength) + '...';
}

function truncateUrl(url: string, maxLength: number = 25): string {
  if (url.length <= maxLength) return url;
  return url.substring(0, maxLength) + '...';
}

export default function AttachmentPreview({
  attachments,
  onRemove,
  onPreview,
}: AttachmentPreviewProps) {
  const { theme } = useTheme();
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const handleImagePress = useCallback(
    (attachment: Attachment) => {
      if (onPreview) {
        onPreview(attachment);
      } else {
        setPreviewImage(attachment.uri);
      }
    },
    [onPreview]
  );

  const handleClosePreview = useCallback(() => {
    setPreviewImage(null);
  }, []);

  if (!attachments || attachments.length === 0) {
    return null;
  }

  const renderAttachment = (attachment: Attachment) => {
    const isImage = attachment.type === 'image';
    const isDocument = attachment.type === 'document';
    const isLink = attachment.type === 'link';
    const isPdf = attachment.mimeType === 'application/pdf' ||
      attachment.name?.toLowerCase().endsWith('.pdf');

    return (
      <View
        key={attachment.id}
        style={[
          isImage ? styles.imageItem : isDocument ? styles.documentItem : styles.linkItem,
          {
            backgroundColor: isImage ? 'transparent' : theme.colors.secondary,
            borderRadius: 12,
            marginRight: 10,
          },
        ]}
      >
        {/* Remove button */}
        <TouchableOpacity
          style={[
            styles.removeButton,
            {
              backgroundColor: theme.colors.danger,
              borderRadius: 10,
              borderColor: theme.colors.cardPrimary,
            },
          ]}
          onPress={() => onRemove(attachment.id)}
          hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
        >
          <MaterialCommunityIcons name="close" size={12} color="#FFFFFF" />
        </TouchableOpacity>

        {/* Content based on type */}
        {isImage ? (
          <TouchableOpacity
            onPress={() => handleImagePress(attachment)}
            activeOpacity={0.8}
            style={styles.imageContainer}
          >
            <Image
              source={{ uri: attachment.uri }}
              style={styles.fullImage}
              resizeMode="cover"
            />
          </TouchableOpacity>
        ) : isDocument ? (
          <View style={styles.documentInner}>
            <View style={[styles.iconBox, { backgroundColor: theme.colors.cardPrimary }]}>
              <MaterialCommunityIcons
                name={isPdf ? 'file-pdf-box' : 'file-document'}
                size={24}
                color={theme.colors.primary}
              />
            </View>
            <View style={styles.textStack}>
              <Text
                style={[
                  styles.filename,
                  { color: theme.colors.text, fontFamily: 'Inter_600SemiBold' },
                ]}
                numberOfLines={1}
              >
                {truncateFilename(attachment.name, 16)}
              </Text>
              <Text style={[styles.subText, { color: theme.colors.textSecondary }]}>
                {isPdf ? 'PDF Document' : 'File'}
              </Text>
            </View>
          </View>
        ) : isLink ? (
          <View style={styles.linkInner}>
            <View style={[styles.iconBox, { backgroundColor: theme.colors.cardPrimary }]}>
              <MaterialCommunityIcons
                name="link-variant"
                size={22}
                color={theme.colors.primary}
              />
            </View>
            <View style={styles.linkTextContainer}>
              <Text
                style={[
                  styles.domainText,
                  { color: theme.colors.text, fontFamily: 'Inter_600SemiBold' },
                ]}
                numberOfLines={1}
              >
                {attachment.linkMeta?.domain || attachment.name}
              </Text>
              <Text
                style={[
                  styles.urlText,
                  { color: theme.colors.textSecondary, fontFamily: 'Inter_400Regular' },
                ]}
                numberOfLines={1}
              >
                {truncateUrl(attachment.uri, 28)}
              </Text>
            </View>
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContainer,
          { paddingVertical: theme.spacing.small },
        ]}
      >
        {attachments.map(renderAttachment)}
      </ScrollView>

      <ImagePreviewModal
        visible={!!previewImage}
        imageUri={previewImage}
        onClose={handleClosePreview}
      />
    </>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    minHeight: 88,
  },
  imageItem: {
    width: 90,
    height: 90,
    position: 'relative',
  },
  documentItem: {
    height: 64,
    position: 'relative',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  linkItem: {
    height: 64,
    position: 'relative',
    justifyContent: 'center',
    paddingHorizontal: 12,
    minWidth: 180,
  },
  removeButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 24,
    height: 24,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  imageContainer: {
    flex: 1,
  },
  fullImage: {
    width: '100%',
    height: '100%',
    borderRadius: 14,
  },
  documentInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textStack: {
    flexDirection: 'column',
    justifyContent: 'center',
  },
  filename: {
    fontSize: 14,
  },
  subText: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    marginTop: 2,
  },
  linkInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  linkTextContainer: {
    flexDirection: 'column',
    justifyContent: 'center',
  },
  domainText: {
    fontSize: 14,
  },
  urlText: {
    fontSize: 11,
    marginTop: 2,
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2000,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  modalContent: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullSizeImage: {
    width: SCREEN_WIDTH - 32,
    height: SCREEN_HEIGHT - 120,
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
});
