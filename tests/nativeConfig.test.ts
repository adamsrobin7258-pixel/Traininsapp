// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import capacitorConfig from '../capacitor.config';
import packageJson from '../package.json' with { type: 'json' };

/**
 * Guards the product identity across web, Capacitor, Android and iOS.
 * If this fails, a native project drifted from capacitor.config.ts or package.json.
 */
const APP_ID = 'com.kalethra.app';
const APP_NAME = 'Kalethra';

const read = (path: string) => readFileSync(resolve(import.meta.dirname, '..', path), 'utf8');

describe('native project configuration', () => {
  it('uses the Kalethra identity in Capacitor', () => {
    expect(capacitorConfig.appId).toBe(APP_ID);
    expect(capacitorConfig.appName).toBe(APP_NAME);
  });

  it('matches on Android', () => {
    const gradle = read('android/app/build.gradle');
    expect(gradle).toContain(`namespace = "${APP_ID}"`);
    expect(gradle).toContain(`applicationId "${APP_ID}"`);
    expect(read('android/app/src/main/java/com/kalethra/app/MainActivity.java')).toContain(
      `package ${APP_ID};`,
    );
    const strings = read('android/app/src/main/res/values/strings.xml');
    expect(strings).toContain(`<string name="app_name">${APP_NAME}</string>`);
    expect(strings).toContain(`<string name="package_name">${APP_ID}</string>`);
  });

  it('matches on iOS, including the version', () => {
    const project = read('ios/App/App.xcodeproj/project.pbxproj');
    const bundleIds = [...project.matchAll(/PRODUCT_BUNDLE_IDENTIFIER = ([^;]+);/g)].map(
      (m) => m[1],
    );
    expect(bundleIds.length).toBeGreaterThan(0);
    expect(new Set(bundleIds)).toEqual(new Set([APP_ID]));

    const versions = [...project.matchAll(/MARKETING_VERSION = ([^;]+);/g)].map((m) => m[1]);
    expect(new Set(versions)).toEqual(new Set([packageJson.version]));

    const [major = 0, minor = 0, patch = 0] = packageJson.version.split('.').map(Number);
    const builds = [...project.matchAll(/CURRENT_PROJECT_VERSION = ([^;]+);/g)].map((m) => m[1]);
    expect(new Set(builds)).toEqual(new Set([String(major * 10000 + minor * 100 + patch)]));

    expect(read('ios/App/App/Info.plist')).toMatch(
      new RegExp(`<key>CFBundleDisplayName</key>\\s*<string>${APP_NAME}</string>`),
    );
  });

  it('shows the product name in the HTML shell', () => {
    expect(read('index.html')).toContain(`<title>${APP_NAME}</title>`);
  });
});

describe('database encryption configuration', () => {
  it('enables SQLCipher on Android and iOS', () => {
    const sqlite = capacitorConfig.plugins?.CapacitorSQLite;
    expect(sqlite?.androidIsEncryption).toBe(true);
    expect(sqlite?.iosIsEncryption).toBe(true);
    expect(sqlite?.iosKeychainPrefix).toBe('kalethra');
  });

  it('does not enable biometric unlock, which would block background access', () => {
    const sqlite = capacitorConfig.plugins?.CapacitorSQLite;
    expect(sqlite?.androidBiometric).toBeUndefined();
    expect(sqlite?.iosBiometric).toBeUndefined();
  });
});

describe('Android privacy configuration', () => {
  const manifest = read('android/app/src/main/AndroidManifest.xml');
  const rules = read('android/app/src/main/res/xml/data_extraction_rules.xml');
  const domains = [
    'root',
    'file',
    'database',
    'sharedpref',
    'external',
    'device_root',
    'device_file',
    'device_database',
    'device_sharedpref',
  ];

  it('disables automatic backup', () => {
    expect(manifest).toContain('android:allowBackup="false"');
    expect(manifest).toContain('android:dataExtractionRules="@xml/data_extraction_rules"');
  });

  it.each(['cloud-backup', 'device-transfer'])('excludes every data domain from %s', (section) => {
    const block = new RegExp(`<${section}>([\\s\\S]*?)</${section}>`).exec(rules)?.[1] ?? '';
    for (const domain of domains) {
      expect(block, domain).toContain(`<exclude domain="${domain}" path="." />`);
    }
    expect(block).not.toContain('<include');
  });

  it('does not request location or other sensitive permissions yet', () => {
    expect(manifest).not.toMatch(/ACCESS_(FINE|COARSE|BACKGROUND)_LOCATION/);
    expect(manifest).not.toMatch(/android\.permission\.health\./);
  });
});
