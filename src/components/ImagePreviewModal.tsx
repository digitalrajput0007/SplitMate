import React from 'react';
import {
  Modal,
  View,
  Image,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  SafeAreaView,
  StatusBar,
  Alert,
  Linking,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../constants/theme';

interface ImagePreviewModalProps {
  visible: boolean;
  imageUrl: string;
  onClose: () => void;
}

const { width, height } = Dimensions.get('window');

export const ImagePreviewModal = ({ visible, imageUrl, onClose }: ImagePreviewModalProps) => {
  const [downloading, setDownloading] = React.useState(false);

  if (!imageUrl) return null;

  const handleDownload = async () => {
    setDownloading(true);
    try {
      // 1. Direct Fallback: Open in Browser
      // This is 100% reliable and doesn't require native modules that might be missing (MediaLibrary/Sharing).
      // Users can long-press the image in the browser to "Save Image".
      console.log('Redirecting to browser for receipt download:', imageUrl);
      await Linking.openURL(imageUrl);
    } catch (error) {
      console.error('Browser redirect failed:', error);
      Alert.alert('Download Error', 'Could not open the receipt link.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#000" />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <MaterialIcons name="close" size={28} color="#FFF" />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleDownload}
              style={[styles.closeButton, { marginLeft: 'auto' }]}
              disabled={downloading}
            >
              {downloading ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <MaterialIcons name="file-download" size={28} color="#FFF" />
              )}
            </TouchableOpacity>
          </View>
          <View style={styles.imageContainer}>
            <Image
              source={{ uri: imageUrl }}
              style={styles.image}
              resizeMode="contain"
            />
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  safeArea: {
    flex: 1,
  },
  header: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: width,
    height: height - 100,
  },
});
