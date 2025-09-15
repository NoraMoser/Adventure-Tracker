import { Ionicons } from '@expo/vector-icons';
import {
  Dimensions,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const { width, height } = Dimensions.get('window');

interface ImageViewerProps {
  visible: boolean;
  images: string[];
  imageIndex: number;
  onClose: () => void;
}

export default function ImageViewer({ 
  visible, 
  images, 
  imageIndex, 
  onClose 
}: ImageViewerProps) {
  return (
    <Modal 
      visible={visible} 
      transparent={false} 
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <TouchableOpacity 
          style={styles.closeButton} 
          onPress={onClose}
          hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
        >
          <Ionicons name="close" size={30} color="white" />
        </TouchableOpacity>
        
        <ScrollView 
          horizontal 
          pagingEnabled 
          showsHorizontalScrollIndicator={false}
          contentOffset={{ x: imageIndex * width, y: 0 }}
        >
          {images.map((uri, index) => (
            <View key={index} style={styles.imageContainer}>
              <Image 
                source={{ uri }} 
                style={styles.image} 
                resizeMode="contain" 
              />
            </View>
          ))}
        </ScrollView>
        
        <View style={styles.counter}>
          <Text style={styles.counterText}>
            {imageIndex + 1} / {images.length}
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 2,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    padding: 10,
  },
  imageContainer: {
    width,
    height,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: width,
    height: height * 0.8,
  },
  counter: {
    position: 'absolute',
    bottom: 50,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 15,
    paddingVertical: 5,
    borderRadius: 15,
  },
  counterText: {
    color: 'white',
    fontSize: 14,
  },
});