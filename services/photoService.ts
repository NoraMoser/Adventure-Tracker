// services/photoService.ts - Fixed with robust fetch handling
import { decode } from "base64-arraybuffer";
import * as ImageManipulator from "expo-image-manipulator";
import { supabase } from "../lib/supabase";

export class PhotoService {
  /**
   * Initialize storage buckets in Supabase
   */
  static async initializeStorage() {
    try {
      const { data: buckets } = await supabase.storage.listBuckets();
      console.log("Available buckets:", buckets);
      console.log(
        "Existing buckets:",
        buckets?.map((b) => b.name)
      );
      // Don't try to create buckets - they should already exist
      // Just verify they're there
      const requiredBuckets = [
        "location-photos",
        "activity-photos",
        "profile-avatars",
      ];
      const existingBucketNames = buckets?.map((b) => b.name) || [];

      for (const bucketName of requiredBuckets) {
        if (!existingBucketNames.includes(bucketName)) {
          console.warn(
            `Bucket ${bucketName} doesn't exist. Please create it in Supabase dashboard.`
          );
        }
      }
    } catch (error) {
      console.log("Could not check storage buckets:", error);
    }
  }

  /**
   * Compress an image to reduce size
   */
  static async compressImage(uri: string): Promise<string> {
    try {
      // Skip compression if it's already a base64 thumbnail
      if (uri.startsWith("data:") && uri.length < 50000) {
        return uri;
      }

      const result = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 1200 } }], // Max width 1200px
        {
          compress: 0.7, // 70% quality
          format: ImageManipulator.SaveFormat.JPEG,
        }
      );

      return result.uri;
    } catch (error) {
      console.error("Error compressing image:", error);
      return uri; // Return original if compression fails
    }
  }

  /**
   * Robust fetch with retry logic
   */
  static async fetchWithRetry(uri: string, maxRetries = 3): Promise<Response> {
    let lastError: Error | null = null;
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
        
        const response = await fetch(uri, {
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        return response;
      } catch (error: any) {
        lastError = error;
        
        if (i < maxRetries - 1) {
          // Wait before retrying (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
        }
      }
    }
    
    throw lastError || new Error('Failed to fetch after retries');
  }

  /**
   * Convert URI to base64 - Fixed to handle file:// URIs properly with retry
   */
  static async uriToBase64(uri: string): Promise<string> {
    try {
      // If it's already base64, extract just the data part
      if (uri.startsWith("data:")) {
        return uri.split("base64,")[1];
      }

      // For file:// URIs from ImagePicker, we need to fetch them properly with retry
      const response = await this.fetchWithRetry(uri);
      const blob = await response.blob();

      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result as string;
          // Extract just the base64 data, not the data:image/jpeg;base64, prefix
          const base64Data = base64.split(",")[1];
          resolve(base64Data);
        };
        reader.onerror = (error) => {
          console.error("FileReader error:", error);
          reject(error);
        };
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error("Error converting to base64:", error);
      throw error;
    }
  }

  /**
   * Upload a single photo to Supabase Storage with retry logic
   */
  static async uploadPhoto(
    photoUri: string,
    bucket: "location-photos" | "activity-photos" | "profile-avatars",
    userId: string,
    maxRetries = 3
  ): Promise<string | null> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {

        // Don't skip file:// URIs - they're valid from ImagePicker!
        if (!photoUri) {
          return null;
        }

        // If it's already a URL, return it
        if (photoUri.startsWith("http://") || photoUri.startsWith("https://")) {
          return photoUri;
        }

        // Compress the image first
        const compressedUri = await this.compressImage(photoUri);

        // Generate unique filename
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(7);
        const fileName = `${userId}/${timestamp}_${random}.jpg`;

        // Convert to base64
        const base64Data = await this.uriToBase64(compressedUri);

        if (!base64Data) {
          console.error("Failed to convert image to base64");
          return null;
        }

        // Upload to Supabase Storage
        console.log("Uploading to Supabase Storage...");
        const { data, error } = await supabase.storage
          .from(bucket)
          .upload(fileName, decode(base64Data), {
            contentType: "image/jpeg",
            upsert: true,
          });

        if (error) {
          throw error;
        }

        // Get public URL
        const { data: urlData } = supabase.storage
          .from(bucket)
          .getPublicUrl(fileName);

        return urlData.publicUrl;
        
      } catch (error: any) {
        lastError = error;
        console.error(`Upload attempt ${attempt + 1} failed:`, error);
        
        if (attempt < maxRetries - 1) {
          // Wait before retrying (exponential backoff)
          const waitTime = Math.pow(2, attempt) * 1000;
          console.log(`Waiting ${waitTime}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }
    
    console.error("All upload attempts failed:", lastError);
    return null;
  }

  /**
   * Upload multiple photos
   */
  static async uploadPhotos(
    photoUris: string[],
    bucket: "location-photos" | "activity-photos" | "profile-avatars",
    userId: string
  ): Promise<string[]> {
    if (!photoUris || photoUris.length === 0) {
      return [];
    }

    console.log(`Starting upload of ${photoUris.length} photos...`);

    const uploadPromises = photoUris.map((uri) =>
      this.uploadPhoto(uri, bucket, userId)
    );

    const results = await Promise.all(uploadPromises);

    // Filter out failed uploads
    const successfulUploads = results.filter((url) => url !== null) as string[];
    console.log(
      `Successfully uploaded ${successfulUploads.length} out of ${photoUris.length} photos`
    );

    return successfulUploads;
  }

  /**
   * Delete a photo from storage
   */
  static async deletePhoto(photoUrl: string, bucket: string): Promise<boolean> {
    try {
      // Extract file path from URL
      const urlParts = photoUrl.split("/");
      const fileName = urlParts[urlParts.length - 1];
      const userId = urlParts[urlParts.length - 2];
      const filePath = `${userId}/${fileName}`;

      const { error } = await supabase.storage.from(bucket).remove([filePath]);

      if (error) {
        console.error("Error deleting photo:", error);
        return false;
      }

      console.log("Photo deleted successfully");
      return true;
    } catch (error) {
      console.error("Error deleting photo:", error);
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
        console.error("Error creating signed URL:", error);
        return null;
      }

      return data.signedUrl;
    } catch (error) {
      console.error("Error getting signed URL:", error);
      return null;
    }
  }

  /**
   * Migrate base64 photos to storage (for existing data)
   */
  static async migrateBase64ToStorage(
    base64Photos: string[],
    bucket: "location-photos" | "activity-photos",
    userId: string
  ): Promise<string[]> {
    const urls: string[] = [];

    for (const photo of base64Photos) {
      if (photo.startsWith("data:")) {
        // This is base64, upload it
        const url = await this.uploadPhoto(photo, bucket, userId);
        if (url) urls.push(url);
      } else if (photo.startsWith("http")) {
        // Already a URL, keep it
        urls.push(photo);
      } else if (photo.startsWith("file://")) {
        // This is a local file URI, upload it
        const url = await this.uploadPhoto(photo, bucket, userId);
        if (url) urls.push(url);
      }
    }

    return urls;
  }
}