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
import * as FileSystem from 'expo-file-system';
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
      // 1. For Web or Simple Fallback
      if (Platform.OS === 'web') {
        Linking.openURL(imageUrl);
        setDownloading(false);
        return;
      }

      // 2. Download to a local file
      const filename = imageUrl.split('/').pop()?.split('?')[0] || 'receipt.jpg';
      const fileUri = FileSystem.documentDirectory + filename;

      const downloadRes = await FileSystem.downloadAsync(imageUrl, fileUri);

      if (downloadRes.status === 200) {
        Alert.alert(
          'Download Complete',
          'The receipt has been saved to your documents folder.',
          [
            { text: 'OK' },
            { text: 'Open', onPress: () => Linking.openURL(downloadRes.uri) }
          ]
        );
      } else {
        throw new Error('Download failed');
      }
    } catch (error) {
      console.error('Download error:', error);
      Alert.alert('Download Failed', 'Could not download the receipt. Opening in browser instead.');
      Linking.openURL(imageUrl);
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
