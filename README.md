# VA-to-Z

All-in-One VA Disability Helper

**VA to Z** is a single-page app for veterans. It keeps 38 CFR Part 4 diagnostic codes on the device, combines disability ratings, estimates monthly compensation, and stores claims, notes, and documents. Open it from GitHub Pages, or open `index.html` directly in a browser. After the first visit over the web, the page and icons stay available offline.

## Your data stays on your device

Profile details, ratings, claims, notes, documents, and an optional xAI API key are stored only in this browser (IndexedDB and local storage). VA to Z does not upload that information to this site. The only network request the app itself makes is optional: if you save your own xAI API key, chat messages go from your device straight to xAI. Use **Download Backup** on the Tools tab when you want a copy you control.

## Install on a phone

Publish the site (see below), then open it in the phone's browser and add it to the home screen. The icon is labeled **VA to Z** and the app opens full screen.

### iPhone (Safari)

1. Open the site in Safari.
2. Tap the Share button.
3. Tap **Add to Home Screen**.
4. Tap **Add**.

### Android (Chrome)

1. Open the site in Chrome.
2. Tap the menu (⋮).
3. Tap **Install app** or **Add to Home screen**.
4. Confirm.

Installed from the home screen, VA to Z still keeps your data on the device. Open the site once while online so the phone can save the page for offline use.

## VA to Z Sync (Chrome and Edge)

**VA to Z Sync** is a browser extension for a Windows or Mac computer. While you are logged in to VA.gov, it reads your own profile, service history, ratings, and claims and hands them to this app. You review each item before anything is saved. It does not run on phones or tablets.

Install it in developer mode:

1. Download [va-to-z-sync.zip](extension/va-to-z-sync.zip).
2. Unzip it. You get a folder named `va-to-z-sync`. Keep that folder; the extension runs from it.
3. Open `chrome://extensions` in Chrome, or `edge://extensions` in Edge.
4. Turn on **Developer mode**.
5. Click **Load unpacked** and select the unzipped `va-to-z-sync` folder.

Then open the **Tools** tab in VA to Z and use **Sync VA Data**. The extension source is in `extension/src/va-to-z-sync/` so it can be read in this repository. The zip is the copy to download and load.

## VA to Z desktop extension (Chrome and Edge)

The all-in-one **VA to Z** extension is the whole app plus built-in VA.gov sync. It opens in its own tab on a Windows or Mac computer. It does not run on phones or tablets. Data in the extension is separate from this website; move it with a backup file from **Backup and Restore**.

Install it in developer mode:

1. Download [va-to-z-extension.zip](extension/va-to-z-extension.zip).
2. Unzip it. You get a folder named `va-to-z-extension`. Keep that folder; the extension runs from it.
3. Open `chrome://extensions` in Chrome, or `edge://extensions` in Edge.
4. Turn on **Developer mode**.
5. Click **Load unpacked** and select the unzipped `va-to-z-extension` folder.
6. Pin **VA to Z** from the puzzle-piece menu, then click it to open the app.

The extension source is in `extension/src/va-to-z-extension/`. The zip is the copy to download and load. `va-to-z-sync.zip` is still the smaller add-on for the website.
