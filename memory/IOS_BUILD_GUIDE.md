# Cycle Coach — iOS Build Guide

## Prerequisites
- Mac with Xcode 15+ installed
- Apple Developer Program membership (active)
- Node.js 18+ and Yarn installed on the Mac
- CocoaPods installed (`sudo gem install cocoapods`)

---

## Quick Reference
- **Bundle ID**: `net.cyclecoach.app`
- **Production API**: `https://partner-sync-6.emergent.host`
- **App Name**: Cycle Coach

---

## Step 1: Clone & Install

```bash
git clone <your-repo-url> cycle-coach
cd cycle-coach/frontend
yarn install
```

## Step 2: Create Production .env

Create a file called `.env.production` in the `frontend/` folder:

```env
REACT_APP_BACKEND_URL=https://partner-sync-6.emergent.host
REACT_APP_STRIPE_BASIC_PRICE=price_1Tp7MMISn9QYeFgUNM6enfS2
REACT_APP_STRIPE_ADVANCED_PRICE=price_1Tp7R9ISn9QYeFgU6Rxkc8Td
```

> **IMPORTANT**: Do NOT use the preview URL (`partner-guide-4.preview.emergentagent.com`). 
> The iOS app must point to your production server.

## Step 3: Build the React App for Production

```bash
yarn build
```

This creates the `build/` folder that Capacitor will bundle into the iOS app.
The `REACT_APP_BACKEND_URL` from `.env.production` gets baked in at build time.

**Verify it's correct:**
```bash
grep -r "partner-sync-6" build/static/js/*.js | head -1
# Should show the production URL. If you see "partner-guide-4", rebuild.
```

## Step 4: Sync Capacitor

```bash
npx cap sync ios
```

This copies the `build/` folder into the iOS project and installs any Capacitor plugins.

## Step 5: Open in Xcode

```bash
npx cap open ios
```

This opens the Xcode project. You can also open it manually:
`frontend/ios/App/App.xcworkspace`

> **Use `.xcworkspace`**, NOT `.xcodeproj` — the workspace includes CocoaPods dependencies.

## Step 6: Fix Signing & Provisioning

This is the error you're seeing. Here's how to fix it:

### In Xcode:
1. Click on **App** in the left sidebar (the blue project icon)
2. Select the **App** target (not the project)
3. Go to the **Signing & Capabilities** tab
4. Check **"Automatically manage signing"**
5. Select your **Team** from the dropdown (your Apple Developer account)
6. The **Bundle Identifier** should already be `net.cyclecoach.app`

### If "Automatically manage signing" fails:
You need to register your device first:

1. Connect your iPhone to the Mac via USB
2. In Xcode, go to **Window → Devices and Simulators**
3. Your device should appear — Xcode will register it automatically
4. Go back to Signing & Capabilities and try again

### For Simulator Only (no device needed):
1. Change the build target from "Any iOS Device" to a simulator (e.g., "iPhone 15 Pro")
2. Simulators don't need provisioning profiles — they use automatic signing
3. Click ▶️ Run

## Step 7: Run on Simulator

1. Select **iPhone 15 Pro** (or any simulator) from the target dropdown
2. Click ▶️ **Run** (or Cmd+R)
3. The app should build, install on the simulator, and launch

### If you see a blank screen or errors:
- Check Xcode console (bottom panel) for errors
- Make sure you ran `yarn build` with the correct `.env.production`
- Make sure you ran `npx cap sync ios` after building

## Step 8: Run on a Physical Device

1. Connect your iPhone via USB
2. Trust the computer on your phone if prompted
3. Select your device from the target dropdown
4. Click ▶️ Run
5. On first run, go to **Settings → General → VPN & Device Management** on your phone and trust the developer certificate

---

## App Store Submission

### Step 9: Create App Store Listing

1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Click **My Apps → + → New App**
3. Fill in:
   - **Platform**: iOS
   - **Name**: Cycle Coach
   - **Primary Language**: English
   - **Bundle ID**: net.cyclecoach.app
   - **SKU**: cyclecoach-001

### Step 10: Archive & Upload

1. In Xcode, select **"Any iOS Device (arm64)"** as the build target
2. Go to **Product → Archive**
3. Wait for the build to complete
4. In the **Organizer** window that opens, click **Distribute App**
5. Choose **App Store Connect** → **Upload**
6. Follow the prompts to upload

### Step 11: Submit for Review

1. In App Store Connect, go to your app
2. Fill in all required metadata (description, screenshots, privacy policy)
3. Select the uploaded build
4. Click **Submit for Review**

---

## Troubleshooting

### "VITE_BACKEND_URL is missing"
This means the app was built without `REACT_APP_BACKEND_URL` set. Fix:
```bash
# Make sure .env.production exists with the correct URL
cat .env.production
# Rebuild
yarn build
npx cap sync ios
```

### "No provisioning profiles matching net.cyclecoach.app"
- Enable "Automatically manage signing" in Xcode
- Select your team
- If building for a device, connect it first so Xcode can register it

### Blank white screen in simulator
- Open Safari → Develop → Simulator → inspect the web view
- Check for JavaScript errors in the console
- Verify the build has the correct API URL baked in

### CORS errors
The production server at `partner-sync-6.emergent.host` already includes `capacitor://localhost` and `https://localhost` in its CORS allowed origins. If you're using a custom domain, add it to `backend/.env` `CORS_ORIGINS`.

---

## GitHub Actions (Automated Builds)

For automated CI/CD builds, you'll need:
1. An Apple Developer certificate exported as `.p12`
2. A provisioning profile downloaded from Apple Developer portal
3. These stored as GitHub Secrets

I can set up the GitHub Actions workflow once you're ready — just let me know.
