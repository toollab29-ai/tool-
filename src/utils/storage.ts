import { TemplateId, Template2Settings, WeatherTemplateSettings } from '../types';

const STORAGE_KEY = '24_sky_alert_weather_template_v1';
const STORAGE_KEY_T2 = '24_sky_alert_weather_template2_v1';
const ACTIVE_TEMPLATE_KEY = '24_sky_alert_active_template_v1';

/**
 * Saves Template 1 branding and template settings to localStorage.
 */
export function saveTemplateSettingsToStorage(settings: WeatherTemplateSettings): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    return true;
  } catch (err) {
    console.warn('Could not save template settings to localStorage:', err);
    return false;
  }
}

/**
 * Loads saved Template 1 branding and template settings from localStorage.
 */
export function loadTemplateSettingsFromStorage(): Partial<WeatherTemplateSettings> | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Partial<WeatherTemplateSettings>;
  } catch (err) {
    console.warn('Failed to parse saved Template 1 settings:', err);
    return null;
  }
}

/**
 * Saves Template 2 branding, panel, typography, accent, and lower-footage settings separately.
 */
export function saveTemplate2SettingsToStorage(settings: Template2Settings): boolean {
  try {
    localStorage.setItem(STORAGE_KEY_T2, JSON.stringify(settings));
    return true;
  } catch (err) {
    console.warn('Could not save Template 2 settings to localStorage:', err);
    return false;
  }
}

/**
 * Loads saved Template 2 settings from localStorage.
 */
export function loadTemplate2SettingsFromStorage(): Partial<Template2Settings> | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_T2);
    if (!raw) return null;
    return JSON.parse(raw) as Partial<Template2Settings>;
  } catch (err) {
    console.warn('Failed to parse saved Template 2 settings:', err);
    return null;
  }
}

export function saveActiveTemplateToStorage(templateId: TemplateId): void {
  try {
    localStorage.setItem(ACTIVE_TEMPLATE_KEY, templateId);
  } catch {
    // ignore
  }
}

export function loadActiveTemplateFromStorage(): TemplateId | null {
  try {
    const val = localStorage.getItem(ACTIVE_TEMPLATE_KEY);
    if (val === 'template-1' || val === 'template-2') return val;
    return null;
  } catch {
    return null;
  }
}

/**
 * Clears saved Template 1 settings from localStorage.
 */
export function clearTemplateSettingsStorage(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
