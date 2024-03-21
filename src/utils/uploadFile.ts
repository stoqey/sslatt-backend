import { configureFirebase } from "@roadmanjs/firebase-admin";
import { log } from "roadman";

export const DefaultPlaceholder = `https://storage.googleapis.com/stqnetwork.appspot.com/placeholder.png`;

export async function uploadFile(
  filePath: string,
  fileDest: string,
  contentType?: string,
): Promise<string | null> {
  // Uploads a local file to the bucket
  try {
    
    const firebase = await configureFirebase()
    const bucketName = `${firebase.projectId}.appspot.com`;

    const bucket = firebase.storage().bucket(bucketName);
    await bucket.upload(filePath, {
      public: true,
      destination: fileDest,
      // By setting the option `destination`, you can change the name of the
      // object you are uploading to a bucket.
      metadata: {
        // contentType: contentType || "image/png",
        // Enable long-lived HTTP caching headers
        // Use only if the contents of the file will never change
        cacheControl: "no-cache",
        // cacheControl: 'public, max-age=31536000',
      },
    });

    const publicUrl = `https://storage.googleapis.com/${bucketName}/${fileDest}?alt=media`;
    log(`Public url -> ${publicUrl}`);
    return publicUrl;
  } catch (error) {
    console.error("error uploading file", JSON.stringify(error));
    return null;
  }
}
