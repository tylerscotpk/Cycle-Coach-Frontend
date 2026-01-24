# Cycle Coach - App Store Deployment Guide

## App Details
- **App Name:** Cycle Coach
- **Bundle ID:** com.cyclecoach.app
- **Tagline:** Your personal trainer for peak performance in your relationship
- **Age Rating:** 17+ (Adult content - health/medical information)

---

## Prerequisites Checklist

### 1. Developer Accounts (Required)
- [ ] **Apple Developer Account** - $99/year
  - Sign up at: https://developer.apple.com/programs/enroll/
  - Takes 24-48 hours to approve
  
- [ ] **Google Play Developer Account** - $25 one-time
  - Sign up at: https://play.google.com/console/signup
  - Usually instant approval

### 2. Development Environment (On Your Mac)
- [ ] **Xcode** (for iOS) - Free from Mac App Store
- [ ] **Android Studio** (for Android) - Free from https://developer.android.com/studio
- [ ] **Node.js 18+** - https://nodejs.org
- [ ] **CocoaPods** (for iOS) - Run: `sudo gem install cocoapods`

### 3. Required Assets
- [ ] **App Icon** (1024x1024 PNG, no transparency)
- [ ] **Screenshots** (see sizes below)
- [ ] **Privacy Policy URL** (required by both stores)

---

## Privacy Policy (Required!)

You MUST have a privacy policy URL. Create one at:
- https://www.privacypolicygenerator.info/ (free)
- https://www.termsfeed.com/ (free basic)

Your policy should mention:
- Data is stored locally on device only
- No personal data is sent to servers
- Anonymous AI chat feature (if used)
- No account creation required

---

## App Icon

Create a 1024x1024 PNG app icon. Suggestions:
- Use a simple, recognizable symbol
- Consider a cycle/calendar icon with your brand colors (cyan/slate)
- No text (too small to read at app icon sizes)

Tool recommendation: Canva.com (free)

---

## Screenshots Needed

### iOS Screenshots (Required sizes)
1. **iPhone 6.7"** (1290 x 2796) - iPhone 15 Pro Max
2. **iPhone 6.5"** (1284 x 2778) - iPhone 14 Plus
3. **iPhone 5.5"** (1242 x 2208) - iPhone 8 Plus
4. **iPad 12.9"** (2048 x 2732) - iPad Pro

### Android Screenshots
- Minimum: 2 screenshots
- Size: 16:9 or 9:16 aspect ratio
- Recommended: 1080 x 1920

You need 3-8 screenshots showing:
1. Main dashboard with MoodMap
2. Cycle phase information
3. AI Wingman chat
4. Resources tab
5. Partner profile

---

## Building the Apps

### Step 1: Download the Project
Download your project from Emergent and unzip it.

### Step 2: Install Dependencies
```bash
cd frontend
npm install
```

### Step 3: Build the Web App
```bash
npm run build
```

### Step 4: Sync with Native Projects
```bash
npx cap sync
```

---

## iOS Deployment

### Step 1: Open in Xcode
```bash
npx cap open ios
```

### Step 2: Configure Signing
1. Select the "App" target
2. Go to "Signing & Capabilities"
3. Select your Team (Apple Developer account)
4. Xcode will create provisioning profiles automatically

### Step 3: Update App Version
In Xcode, update:
- Version: 1.0.0
- Build: 1

### Step 4: Add App Icons
1. Go to Assets.xcassets > AppIcon
2. Drag your 1024x1024 icon
3. Xcode will generate all sizes

### Step 5: Archive & Upload
1. Select "Any iOS Device" as build target
2. Product > Archive
3. Once archived, click "Distribute App"
4. Choose "App Store Connect"
5. Upload

### Step 6: App Store Connect
1. Go to https://appstoreconnect.apple.com
2. Create new app
3. Fill in metadata:
   - App name: Cycle Coach
   - Subtitle: Peak relationship performance
   - Description, keywords, etc.
4. Add screenshots
5. Submit for review (takes 1-3 days)

---

## Android Deployment

### Step 1: Open in Android Studio
```bash
npx cap open android
```

### Step 2: Update App Version
In `android/app/build.gradle`:
```gradle
versionCode 1
versionName "1.0.0"
```

### Step 3: Generate Signed APK/Bundle
1. Build > Generate Signed Bundle / APK
2. Choose "Android App Bundle"
3. Create new keystore (SAVE THIS FILE!)
4. Build release

### Step 4: Google Play Console
1. Go to https://play.google.com/console
2. Create new app
3. Fill in store listing:
   - App name: Cycle Coach
   - Short description: Your personal trainer for peak relationship performance
   - Full description
4. Upload screenshots
5. Upload the .aab file
6. Complete content rating questionnaire
7. Set pricing (free with in-app purchase, or paid)
8. Submit for review (takes 1-7 days)

---

## Monetization Setup for App Stores

Your current Stripe setup works for web. For app stores, you have options:

### Option A: Keep External Payments (Recommended for now)
- Users pay on your website via Stripe
- Get license key via email
- Enter key in app
- **Apple takes 0%, Google takes 0%**

### Option B: In-App Purchases
- Apple takes 30% (15% for small business)
- Google takes 15-30%
- More seamless for users
- Requires additional development

I recommend **Option A** for launch - it's already working!

---

## Post-Launch Checklist

- [ ] Test app on real iOS device
- [ ] Test app on real Android device
- [ ] Verify license key activation works
- [ ] Verify AI Wingman works
- [ ] Monitor crash reports
- [ ] Respond to user reviews

---

## Support

If you need help with:
- App icon design
- Screenshot generation
- Privacy policy template
- App store listing optimization

Just ask!

---

## File Structure

```
frontend/
├── ios/                    # iOS native project
│   └── App/
│       └── App/
│           └── Assets.xcassets/  # App icons go here
├── android/                # Android native project
│   └── app/
│       └── src/main/
│           └── res/        # App icons go here
├── capacitor.config.json   # Capacitor configuration
└── build/                  # Compiled web app
```
