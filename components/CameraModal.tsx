import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import React, { useState, useRef } from 'react';
import { Alert, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Camera, CameraView } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';

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
  const [showCamera, setShowCamera] = useState(false);
  const cameraRef = useRef<CameraView>(null);
  const [cameraKey, setCameraKey] = useState(0);

  const requestPermissions = async () => {
    const cameraPermission = await Camera.requestCameraPermissionsAsync();
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
    console.log('Opening camera...');
    const hasPermission = await requestPermissions();
    if (!hasPermission) {
      console.log('No camera permission');
      return;
    }
    setShowCamera(true);
  };

  const takePicture = async () => {
    if (cameraRef.current) {
      try {
        console.log("Taking picture...");
        
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.7,
          base64: true,
          skipProcessing: true,
        });
        
        console.log("Photo result:", photo);
        
        if (photo) {
          // If base64 is available, use it for WebView compatibility
          if (photo.base64) {
            const dataUrl = `data:image/jpeg;base64,${photo.base64}`;
            console.log('Photo converted to base64, length:', photo.base64.length);
            onPhotoTaken(dataUrl);
          } else if (photo.uri) {
            // Fallback to URI if base64 not available
            try {
              const base64 = await FileSystem.readAsStringAsync(photo.uri, {
                encoding: 'base64', // Changed from FileSystem.EncodingType.Base64
              });
              const dataUrl = `data:image/jpeg;base64,${base64}`;
              console.log('Photo converted to base64, length:', base64.length);
              onPhotoTaken(dataUrl);
            } catch (error) {
              console.error('Error converting photo to base64:', error);
              onPhotoTaken(photo.uri);
            }
          }
          
          // Reset camera
          setCameraKey(prev => prev + 1);
          setShowCamera(false);
          onClose();
        }
        
      } catch (error) {
        console.error("Camera error:", error);
        Alert.alert("Error", "Failed to take picture");
        setShowCamera(false);
      }
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
            encoding: 'base64', // Changed from FileSystem.EncodingType.Base64
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

  // Camera view
  if (showCamera) {
    return (
      <Modal visible={visible} animationType="slide" transparent={false}>
        <View style={styles.cameraContainer}>
          <CameraView 
            key={cameraKey}
            ref={cameraRef}
            style={styles.camera} 
            facing="back"
          />
          <View style={styles.cameraOverlay}>
            <TouchableOpacity style={styles.captureButton} onPress={takePicture}>
              <View style={styles.captureButtonInner} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => {
                setCameraKey(prev => prev + 1);
                setShowCamera(false);
              }}
            >
              <Ionicons name="close" size={30} color="white" />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

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
  // Camera styles
  cameraContainer: {
    flex: 1,
    backgroundColor: 'black',
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 40,
  },
  captureButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'white',
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 10,
    borderRadius: 25,
    zIndex: 1,
  },
});

export default CameraModal;