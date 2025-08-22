// services/photoService.ts
import { decode } from 'base64-arraybuffer';
import * as ImageManipulator from 'expo-image-manipulator';
import { supabase } from '../lib/supabase';

export class PhotoService {
  /**
   * Initialize storage buckets in Supabase
   */
  static async initializeStorage() {
    try {
      const { data: buckets } = await supabase.storage.listBuckets();
      
      const requiredBuckets = [
        { name: 'location-photos', public: true },
        { name: 'activity-photos', public: true },
        { name: 'profile-avatars', public: true }
      ];
      
      for (const bucket of requiredBuckets) {
        const exists = buckets?.some(b => b.name === bucket.name);
        
        if (!exists) {
          const { error } = await supabase.storage.createBucket(bucket.name, {
            public: bucket.public,
            fileSizeLimit: 10485760, // 10MB limit
          });
          
          if (error) {
            console.error(`Error creating bucket ${bucket.name}:`, error);
          } else {
            console.log(`Created storage bucket: ${bucket.name}`);
          }
        }
      }
    } catch (error) {
      console.error('Error initializing storage:', error);
    }
  }

  /**
   * Compress an image to reduce size
   */
  static async compressImage(uri: string): Promise<string> {
    try {
      // Skip compression if it's already a base64 thumbnail
      if (uri.startsWith('data:') && uri.length < 50000) {
        return uri;
      }

      const result = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 1200 } }], // Max width 1200px
        { 
          compress: 0.7, // 70% quality
          format: ImageManipulator.SaveFormat.JPEG 
        }
      );
      
      return result.uri;
    } catch (error) {
      console.error('Error compressing image:', error);
      return uri; // Return original if compression fails
    }
  }

  /**
   * Convert URI to base64
   */
  static async uriToBase64(uri: string): Promise<string> {
    try {
      if (uri.startsWith('data:')) {
        // Already base64
        return uri.split('base64,')[1];
      }

      // Fetch the image
      const response = await fetch(uri);
      const blob = await response.blob();
      
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result as string;
          resolve(base64.split(',')[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error('Error converting to base64:', error);
      throw error;
    }
  }

  /**
   * Upload a single photo to Supabase Storage
   */
  static async uploadPhoto(
    photoUri: string,
    bucket: 'location-photos' | 'activity-photos' | 'profile-avatars',
    userId: string
  ): Promise<string | null> {
    try {
      console.log(`Uploading photo to ${bucket}...`);

      // Compress the image first
      const compressedUri = await this.compressImage(photoUri);
      
      // Generate unique filename
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(7);
      const fileName = `${userId}/${timestamp}_${random}.jpg`;

      // Convert to base64
      const base64Data = await this.uriToBase64(compressedUri);

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(fileName, decode(base64Data), {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (error) {
        console.error('Upload error:', error);
        return null;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(fileName);

      console.log('Photo uploaded successfully:', urlData.publicUrl);
      return urlData.publicUrl;

    } catch (error) {
      console.error('Error uploading photo:', error);
      return null;
    }
  }

  /**
   * Upload multiple photos
   */
  static async uploadPhotos(
    photoUris: string[],
    bucket: 'location-photos' | 'activity-photos' | 'profile-avatars',
    userId: string
  ): Promise<string[]> {
    if (!photoUris || photoUris.length === 0) {
      return [];
    }

    console.log(`Uploading ${photoUris.length} photos...`);
    
    const uploadPromises = photoUris.map(uri => 
      this.uploadPhoto(uri, bucket, userId)
    );
    
    const results = await Promise.all(uploadPromises);
    
    // Filter out failed uploads
    const successfulUploads = results.filter(url => url !== null) as string[];
    console.log(`Successfully uploaded ${successfulUploads.length} out of ${photoUris.length} photos`);
    
    return successfulUploads;
  }

  /**
   * Delete a photo from storage
   */
  static async deletePhoto(photoUrl: string, bucket: string): Promise<boolean> {
    try {
      // Extract file path from URL
      const urlParts = photoUrl.split('/');
      const fileName = urlParts[urlParts.length - 1];
      const userId = urlParts[urlParts.length - 2];
      const filePath = `${userId}/${fileName}`;

      const { error } = await supabase.storage
        .from(bucket)
        .remove([filePath]);

      if (error) {
        console.error('Error deleting photo:', error);
        return false;
      }

      console.log('Photo deleted successfully');
      return true;
    } catch (error) {
      console.error('Error deleting photo:', error);
      return false;
    }
  }

  /**
   * Get a signed URL for a private photo (if needed)
   */
  static async getSignedUrl(
    photoPath: string,
    bucket: string,
    expiresIn: number = 3600
  ): Promise<string | null> {
    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(photoPath, expiresIn);

      if (error) {
        console.error('Error creating signed URL:', error);
        return null;
      }

      return data.signedUrl;
    } catch (error) {
      console.error('Error getting signed URL:', error);
      return null;
    }
  }

  /**
   * Migrate base64 photos to storage (for existing data)
   */
  static async migrateBase64ToStorage(
    base64Photos: string[],
    bucket: 'location-photos' | 'activity-photos',
    userId: string
  ): Promise<string[]> {
    const urls: string[] = [];
    
    for (const photo of base64Photos) {
      if (photo.startsWith('data:')) {
        // This is base64, upload it
        const url = await this.uploadPhoto(photo, bucket, userId);
        if (url) urls.push(url);
      } else if (photo.startsWith('http')) {
        // Already a URL, keep it
        urls.push(photo);
      }
    }
    
    return urls;
  }
}