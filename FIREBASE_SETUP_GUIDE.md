# Firebase Setup Guide for Push Notifications

## Step 1: Create Firebase Account & Project

1. **Go to Firebase Console:**
   - Visit: https://console.firebase.google.com/
   - Click "Get Started" or "Go to Console"
   - Sign in with your Google account

2. **Create New Project:**
   - Click "Add project" or "Create a project"
   - Project name: `do-her-better` (or your preferred name)
   - Click "Continue"

3. **Google Analytics (Optional):**
   - You can enable or disable Google Analytics
   - Recommended: **Disable** for simpler setup
   - Click "Create project"
   - Wait for project creation (30-60 seconds)

## Step 2: Add Web App to Firebase Project

1. **Click the Web icon (</>)** on the project homepage
2. **Register app:**
   - App nickname: `Do Her Better Web App`
   - ✅ Check "Also set up Firebase Hosting" (optional, but recommended)
   - Click "Register app"

3. **Copy Firebase Config:**
   You'll see something like this - **SAVE THESE VALUES**:

   ```javascript
   const firebaseConfig = {
     apiKey: "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXX",
     authDomain: "your-project.firebaseapp.com",
     projectId: "your-project-id",
     storageBucket: "your-project.appspot.com",
     messagingSenderId: "123456789",
     appId: "1:123456789:web:xxxxxxxxxxxxx"
   };
   ```

4. **Click "Continue to console"**

## Step 3: Enable Cloud Messaging

1. **In Firebase Console, click the gear icon ⚙️** (top left) → "Project settings"
2. **Click "Cloud Messaging" tab**
3. **Under "Cloud Messaging API (Legacy)":**
   - You'll see a "Server key" - **COPY THIS**
   - This is your `FIREBASE_SERVER_KEY`

4. **Under "Web Push certificates":**
   - Click "Generate key pair"
   - Copy the "Key pair" value - **SAVE THIS**
   - This is your `VAPID_KEY`

## Step 4: What to Send Me

Once you've completed the setup, send me these values (you can paste them here):

```
FIREBASE_API_KEY=AIzaSy...
FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_STORAGE_BUCKET=your-project.appspot.com
FIREBASE_MESSAGING_SENDER_ID=123456789
FIREBASE_APP_ID=1:123456789:web:xxxxx
FIREBASE_SERVER_KEY=AAAA...
FIREBASE_VAPID_KEY=BN...
```

## Next Steps (After You Provide Keys)

I will then:
1. Set up service worker for background notifications
2. Add notification permission request flow
3. Implement daily notification scheduler
4. Test push notifications

## Estimated Time
- Your part: 10-15 minutes
- My implementation: 30-45 minutes

---

**Note:** All Firebase services we're using (Cloud Messaging) are **FREE** with generous limits:
- Unlimited push notifications
- No credit card required

Let me know once you've completed the setup and have the keys ready!
