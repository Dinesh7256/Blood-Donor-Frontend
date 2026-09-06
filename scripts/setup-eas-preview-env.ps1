# Run from blood-donor-frontend after: eas login
# Uploads Firebase client config to EAS (preview environment).
# Alternative: values are already in eas.json preview.env for cloud builds.

eas env:create --environment preview --name EXPO_PUBLIC_FIREBASE_API_KEY --value "AIzaSyBxoK_qstUnMeJhIulLXJCDUItTVLJLeVk" --visibility plaintext --force
eas env:create --environment preview --name EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN --value "blood-finder-b3f71.firebaseapp.com" --visibility plaintext --force
eas env:create --environment preview --name EXPO_PUBLIC_FIREBASE_PROJECT_ID --value "blood-finder-b3f71" --visibility plaintext --force
eas env:create --environment preview --name EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET --value "blood-finder-b3f71.firebasestorage.app" --visibility plaintext --force
eas env:create --environment preview --name EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID --value "970374855783" --visibility plaintext --force
eas env:create --environment preview --name EXPO_PUBLIC_FIREBASE_APP_ID --value "1:970374855783:web:eb50f5e4ab4883a277e8c2" --visibility plaintext --force
