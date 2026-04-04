import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  Dimensions,
} from 'react-native';
import Animated, { SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useTheme } from '../../themes/ThemeContext';
import { Attachment } from '../dummyData';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface AttachmentPickerProps {
  visible: boolean;
  onClose: () => void;
  onAttach: (attachment: Attachment) => void;
}

interface PickerOption {
  id: string;
  label: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  action: () => Promise<void>;
}

export default function AttachmentPicker({
  visible,
  onClose,
  onAttach,
}: AttachmentPickerProps) {
  const { theme, isDark } = useTheme();
  const [linkUrl, setLinkUrl] = useState('');
  const [showLinkInput, setShowLinkInput] = useState(false);

  useEffect(() => {
    if (!visible) {
      setLinkUrl('');
      setShowLinkInput(false);
    }
  }, [visible]);

  const extractDomain = (url: string): string => {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace('www.', '');
    } catch {
      return url;
    }
  };

  const handleCamera = useCallback(async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'Camera permission is needed to take photos. Please enable it in settings.'
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      const attachment: Attachment = {
        id: Date.now().toString(),
        type: 'image',
        uri: asset.uri,
        name: asset.fileName || `Photo_${Date.now()}.jpg`,
        mimeType: asset.mimeType || 'image/jpeg',
      };
      onAttach(attachment);
      onClose();
    }
  }, [onAttach, onClose]);

  const handlePhotoLibrary = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'Photo library permission is needed to select photos. Please enable it in settings.'
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      const attachment: Attachment = {
        id: Date.now().toString(),
        type: 'image',
        uri: asset.uri,
        name: asset.fileName || `Image_${Date.now()}.jpg`,
        mimeType: asset.mimeType || 'image/jpeg',
      };
      onAttach(attachment);
      onClose();
    }
  }, [onAttach, onClose]);

  const handleDocument = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const isPdf = asset.mimeType === 'application/pdf' || asset.name?.toLowerCase().endsWith('.pdf');
        const attachment: Attachment = {
          id: Date.now().toString(),
          type: 'document',
          uri: asset.uri,
          name: asset.name || `Document_${Date.now()}`,
          mimeType: asset.mimeType || (isPdf ? 'application/pdf' : 'application/octet-stream'),
        };
        onAttach(attachment);
        onClose();
      }
    } catch {
      Alert.alert('Error', 'Failed to pick document. Please try again.');
    }
  }, [onAttach, onClose]);

  const handleLinkSubmit = useCallback(() => {
    if (!linkUrl.trim()) {
      Alert.alert('Invalid URL', 'Please enter a valid URL');
      return;
    }

    let url = linkUrl.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `https://${url}`;
    }

    const domain = extractDomain(url);
    const attachment: Attachment = {
      id: Date.now().toString(),
      type: 'link',
      uri: url,
      name: domain,
      linkMeta: {
        domain,
        title: domain,
      },
    };
    onAttach(attachment);
    setLinkUrl('');
    setShowLinkInput(false);
    onClose();
  }, [linkUrl, onAttach, onClose]);

  const handleLinkPress = useCallback(async () => {
    setShowLinkInput(true);
  }, []);

  const options: PickerOption[] = [
    { id: 'camera', label: 'Camera', icon: 'camera', action: handleCamera },
    { id: 'photo', label: 'Photo Library', icon: 'image', action: handlePhotoLibrary },
    { id: 'document', label: 'Document', icon: 'file-document-outline', action: handleDocument },
    { id: 'link', label: 'Link', icon: 'link-variant', action: handleLinkPress },
  ];

  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <TouchableOpacity
        style={[styles.backdrop, { backgroundColor: isDark ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.5)' }]}
        onPress={onClose}
        activeOpacity={1}
      />
      <Animated.View
        entering={SlideInDown}
        exiting={SlideOutDown}
        style={[
          styles.sheet,
          {
            backgroundColor: theme.colors.cardPrimary,
            borderTopLeftRadius: theme.radii.large,
            borderTopRightRadius: theme.radii.large,
          },
        ]}
      >
        {/* Handle bar */}
        <View style={styles.handleContainer}>
          <View
            style={[
              styles.handle,
              { backgroundColor: theme.colors.border },
            ]}
          />
        </View>

        {/* Title */}
        <Text
          style={[
            styles.title,
            { color: theme.colors.text, marginBottom: theme.spacing.medium },
          ]}
        >
          Add Attachment
        </Text>

        {/* Link Input Section */}
        {showLinkInput ? (
          <View style={[styles.linkInputContainer, { marginBottom: theme.spacing.large }]}>
            <TextInput
              style={[
                styles.linkInput,
                {
                  backgroundColor: theme.colors.secondary,
                  color: theme.colors.text,
                  borderColor: theme.colors.border,
                  borderRadius: theme.radii.medium,
                  padding: theme.spacing.medium,
                },
              ]}
              placeholder="Paste URL here..."
              placeholderTextColor={theme.colors.textSecondary}
              value={linkUrl}
              onChangeText={(text) => setLinkUrl(text)}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              selectTextOnFocus={false}
              contextMenuHidden={false}
            />
            <View style={styles.linkButtons}>
              <TouchableOpacity
                style={[
                  styles.linkButton,
                  styles.cancelButton,
                  {
                    backgroundColor: theme.colors.secondary,
                    borderRadius: theme.radii.medium,
                    marginRight: theme.spacing.small,
                  },
                ]}
                onPress={() => {
                  setShowLinkInput(false);
                  setLinkUrl('');
                }}
              >
                <Text style={{ color: theme.colors.textSecondary }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.linkButton,
                  styles.addButton,
                  {
                    backgroundColor: theme.colors.primary,
                    borderRadius: theme.radii.medium,
                  },
                ]}
                onPress={handleLinkSubmit}
              >
                <Text style={{ color: theme.colors.primaryText, fontWeight: '600' }}>
                  Add
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          /* Options Grid */
          <View style={styles.optionsGrid}>
            {options.map((option) => (
              <TouchableOpacity
                key={option.id}
                style={[
                  styles.optionCard,
                  {
                    backgroundColor: theme.colors.secondary,
                    borderRadius: theme.radii.medium,
                    borderColor: theme.colors.border,
                  },
                ]}
                onPress={option.action}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons
                  name={option.icon}
                  size={28}
                  color={theme.colors.primary}
                />
                <Text
                  style={[
                    styles.optionLabel,
                    { color: theme.colors.text, marginTop: theme.spacing.small },
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Bottom spacing */}
        <View style={{ height: theme.spacing.large }} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    width: '100%',
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  handleContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  optionCard: {
    width: (SCREEN_WIDTH - 60) / 2,
    aspectRatio: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginBottom: 12,
  },
  optionLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  linkInputContainer: {
    width: '100%',
  },
  linkInput: {
    width: '100%',
    fontSize: 16,
    borderWidth: 1,
  },
  linkButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
  },
  linkButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    minWidth: 80,
    alignItems: 'center',
  },
  cancelButton: {},
  addButton: {},
});
