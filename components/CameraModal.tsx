import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import { Alert, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface CameraModalProps {
  visible: boolean;
  onClose: () => void;
  onPhotoTaken: (uri: string) => void;
  spotName: string;
}

const CameraModal: React.FC<CameraModalProps> = ({ 
  visible, 
  onClose, 
  onPhotoTaken, 
  spotName 
}) => {
  const [isLoading, setIsLoading] = useState(false);

  const requestPermissions = async () => {
    const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
    const mediaLibraryPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (cameraPermission.status !== 'granted' || mediaLibraryPermission.status !== 'granted') {
      Alert.alert(
        'Permissions Required',
        'Camera and photo library permissions are needed to take photos.',
        [{ text: 'OK' }]
      );
      return false;
    }
    return true;
  };

  const takePhoto = async () => {
    console.log('Taking photo...');
    const hasPermission = await requestPermissions();
    if (!hasPermission) {
      console.log('No camera permission');
      return;
    }

    setIsLoading(true);
    try {
      console.log('Launching camera...');
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
      });

      console.log('Camera result:', result);

      if (!result.canceled && result.assets[0]) {
        console.log('Photo URI:', result.assets[0].uri);
        
        // Convert to base64 for WebView compatibility
        try {
          const base64 = await FileSystem.readAsStringAsync(result.assets[0].uri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          const dataUrl = `data:image/jpeg;base64,${base64}`;
          console.log('Photo converted to base64, length:', base64.length);
          onPhotoTaken(dataUrl);
        } catch (error) {
          console.error('Error converting photo to base64:', error);
          onPhotoTaken(result.assets[0].uri); // Fallback to original URI
        }
        
        onClose();
      } else {
        console.log('Photo was canceled');
      }
    } catch (error) {
      console.error('Camera error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      Alert.alert('Error', `Failed to take photo: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  const chooseFromLibrary = async () => {
    console.log('Choosing from library...');
    const hasPermission = await requestPermissions();
    if (!hasPermission) {
      console.log('No media library permission');
      return;
    }

    setIsLoading(true);
    try {
      console.log('Launching image library...');
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
      });

      console.log('Library result:', result);

      if (!result.canceled && result.assets[0]) {
        console.log('Selected photo URI:', result.assets[0].uri);
        
        // Convert to base64 for WebView compatibility
        try {
          const base64 = await FileSystem.readAsStringAsync(result.assets[0].uri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          const dataUrl = `data:image/jpeg;base64,${base64}`;
          console.log('Photo converted to base64, length:', base64.length);
          onPhotoTaken(dataUrl);
        } catch (error) {
          console.error('Error converting photo to base64:', error);
          onPhotoTaken(result.assets[0].uri); // Fallback to original URI
        }
        
        onClose();
      } else {
        console.log('Photo selection was canceled');
      }
    } catch (error) {
      console.error('Library error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      Alert.alert('Error', `Failed to select photo: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <Text style={styles.title}>Add Photo to {spotName}</Text>
          <Text style={styles.subtitle}>Capture this moment!</Text>
          
          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              style={[styles.button, styles.cameraButton]} 
              onPress={takePhoto}
              disabled={isLoading}
            >
              <Text style={styles.buttonIcon}>📸</Text>
              <Text style={styles.buttonText}>Take Photo</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.button, styles.libraryButton]} 
              onPress={chooseFromLibrary}
              disabled={isLoading}
            >
              <Text style={styles.buttonIcon}>🖼️</Text>
              <Text style={styles.buttonText}>Choose from Library</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelText}>Skip for now</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    backgroundColor: 'white',
    margin: 20,
    borderRadius: 16,
    padding: 24,
    minWidth: 300,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
    color: '#2c3e50',
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    color: '#7f8c8d',
    marginBottom: 24,
  },
  buttonContainer: {
    gap: 12,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    justifyContent: 'center',
  },
  cameraButton: {
    backgroundColor: '#3498db',
  },
  libraryButton: {
    backgroundColor: '#2ecc71',
  },
  buttonIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    marginTop: 16,
    padding: 12,
  },
  cancelText: {
    textAlign: 'center',
    color: '#7f8c8d',
    fontSize: 14,
  },
});

export default CameraModal;