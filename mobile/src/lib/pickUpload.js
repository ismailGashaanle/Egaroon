/**
 * Pick an image or video and upload to Cloudflare R2 via `/api/uploads`.
 * Returns the hosted Cloudflare URL string, or null if cancelled / unavailable.
 */
import * as ImagePicker from 'expo-image-picker';
import { uploadsApi } from '../api/uploads';

export async function pickAndUploadImage({
  folder = 'stadiums',
  /** Headshots use [1,1]; stadium banners use [16,9] */
  aspect = [16, 9],
} = {}) {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    throw new Error('Sawirka library permission lama helin');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.85,
    allowsEditing: true,
    aspect,
  });

  if (result.canceled || !result.assets?.length) return null;

  const asset = result.assets[0];
  const uri = asset.uri;
  const name =
    uri.split('/').pop() ||
    `upload-${Date.now()}.jpg`;
  const type = asset.mimeType || 'image/jpeg';

  const data = await uploadsApi.uploadFile(
    { uri, name, type },
    { folder, resourceType: 'image' }
  );
  const url = data?.upload?.url || data?.url;
  if (!url) throw new Error('Upload URL lama helin');
  return url;
}

export async function pickAndUploadVideo({
  folder = 'videos',
} = {}) {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    throw new Error('Muuqaalka library permission lama helin');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['videos'],
    allowsEditing: true,
    quality: 0.85,
  });

  if (result.canceled || !result.assets?.length) return null;

  const asset = result.assets[0];
  const uri = asset.uri;
  const name =
    uri.split('/').pop() ||
    `video-${Date.now()}.mp4`;
  const type = asset.mimeType || 'video/mp4';

  const data = await uploadsApi.uploadFile(
    { uri, name, type },
    { folder, resourceType: 'video' }
  );
  const url = data?.upload?.url || data?.url;
  if (!url) throw new Error('Upload URL lama helin');
  return url;
}

